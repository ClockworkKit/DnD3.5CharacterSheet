import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spellFormula,makeSpellRoll,makeRequest,spendSpell} from '../lib/rules.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const spells=JSON.parse(fs.readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const spell=id=>spells.find(s=>s.id===id);
const snapshot=c=>JSON.parse(JSON.stringify(c));
const create=kind=>createPlayerCharacter({name:'Sonic spell QA',kind,level:18,raceId:'human',scores:{STR:12,DEX:12,CON:12,INT:20,WIS:12,CHA:14},method:'manual'});

test('Shout and Greater Shout use fixed ordinary-target damage, including the catalog ID and legacy alias',()=>{
 for(const [id,formula] of [['shout','5d6'],['shout-greater','10d6']]){
  const s=spell(id),before=structuredClone(s);assert.ok(s);
  for(const cl of [1,4,7,15,20,100])assert.equal(spellFormula(s,cl),formula);
  assert.deepEqual(s,before);
 }
 assert.equal(spellFormula({...spell('shout-greater'),id:'greater-shout'},18),'10d6');
});

test('Greater Shout casts one damage roll without an attack, spends once, and preserves saved state and overrides',async()=>{
 const c=create('Wizard'),p=c.casters[0],s=spell('shout-greater');
 const k={id:'sonic-known',spellId:s.id,level:8,slotLevel:8,prepared:3,spent:1,formula:'',notes:'Keep my notes',custom:null};p.spells=[k];c.hp-=4;
 const before=snapshot(c),r=makeSpellRoll(c,p,k,s,true);
 assert.equal(r.formula,'10d6');assert.equal(r.rolls,undefined);assert.deepEqual(snapshot(c),before);
 assert.equal((makeRequest(r,c.name,'https://example.com/').message.match(/\[\[/g)||[]).length,1);
 assert.equal(makeSpellRoll(c,p,k,s).formula,undefined);
 Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,2);
 // The existing override remains available for crystalline targets and table-specific effects.
 p.spells[0].formula='18d6';assert.equal(makeSpellRoll(c,p,p.spells[0],s,true).formula,'18d6');
 const saved=snapshot(c),restored=await prepareCharacter(characterSchema.parse(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))));
 assert.deepEqual(snapshot(restored),saved);
});

test('Factotum Shout uses the same fixed damage without changing inspiration or daily choices while building a roll',()=>{
 const c=create('Factotum'),before=snapshot(c),r=makeDilettanteRoll(c,spell('shout'));
 assert.equal(r.formula,'5d6');assert.equal(r.rolls,undefined);assert.deepEqual(snapshot(c),before);
});
