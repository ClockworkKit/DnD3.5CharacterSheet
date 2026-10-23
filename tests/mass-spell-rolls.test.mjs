import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spellFormula,makeSpellRoll,makeRequest,spendSpell} from '../lib/rules.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const spells=JSON.parse(fs.readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const spell=id=>spells.find(s=>s.id===id);
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('all eight catalog mass cure/inflict spells and their legacy aliases scale to their own caps',()=>{
 for(const kind of ['cure','inflict'])for(const [i,severity] of ['light','moderate','serious','critical'].entries()){
  const s=spell(`${kind}-${severity}-wounds-mass`),before=structuredClone(s),cap=25+5*i;
  for(const cl of [1,9,20,cap-1,cap,cap+1,100]){
   const expected=`${i+1}d8+${Math.min(cl,cap)}`;
   assert.equal(spellFormula(s,cl),expected,s.id);
   assert.equal(spellFormula({...s,id:`mass-${kind}-${severity}-wounds`},cl),expected);
  }
  assert.deepEqual(s,before);assert.equal(spellFormula(spell(`${kind}-${severity}-wounds`),100),`${i+1}d8+${5+5*i}`);
 }
});

test('Mass Heal resolves the fixed amount for both IDs without inventing dice',()=>{
 for(const [cl,amount] of [[17,'170'],[24,'240'],[25,'250'],[100,'250']]){
  assert.equal(spellFormula(spell('heal-mass'),cl),amount);
  assert.equal(spellFormula({...spell('heal-mass'),id:'mass-heal'},cl),amount);
 }
});

test('cleric mass casts roll one shared effect and spend once, without adding touch attacks',()=>{
 const c=createPlayerCharacter({name:'Mass prayer QA',kind:'Cleric',level:20,raceId:'human',scores:{STR:12,DEX:12,CON:12,INT:12,WIS:20,CHA:14},method:'manual'}),p=c.casters[0];
 for(const s of spells.filter(s=>/^(cure|inflict)-(light|moderate|serious|critical)-wounds-mass$|^heal-mass$/.test(s.id))){
  const level=s.levels.Cleric,k={id:'known-'+s.id,spellId:s.id,level,slotLevel:level,prepared:1,spent:0,formula:'',notes:'Keep this',custom:null};p.spells=[k];
  const before=snapshot(c),r=makeSpellRoll(c,p,k,s,true);
  assert.equal(r.formula,spellFormula(s,20));assert.equal(r.rolls,undefined);assert.deepEqual(snapshot(c),before);
  assert.equal((makeRequest(r,c.name,'https://example.com/').message.match(/\[\[/g)||[]).length,1);
  assert.equal(makeSpellRoll(c,p,k,s).formula,undefined);
  Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,1);
  assert.equal(makeSpellRoll(c,p,{...p.spells[0],formula:'2d8+7'},s,true).formula,'2d8+7','player overrides retain priority');
 }
});

test('Roll20-matched mass prayers work after advancement and reload without changing imported or current resources',async()=>{
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-23',character:{id:'mass-test',name:'Mass prayer import'},attributes:Object.entries({class1:'Cleric',level1:17,wis:20,repeating_spells51_ROW_spellname51:'Cure Light Wounds, Mass',repeating_spells51_ROW_spellprep51:2,repeating_spells51_ROW_spellused51:1}).map(([name,current])=>({name,current,max:''}))};
 const c=await prepareCharacter(importRoll20(raw).character),p=c.casters.find(p=>p.spells.some(k=>k.spellId==='cure-light-wounds-mass'));
 assert.ok(p,'import matches the actual catalog ID');const k=p.spells.find(k=>k.spellId==='cure-light-wounds-mass');assert.equal(k.spent,1);
 c.classLevels[0].level=18;recompute(c);c.hp-=3;c.notes='Level-up after import';
 const before=snapshot(c),restored=await prepareCharacter(characterSchema.parse(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))));
 assert.deepEqual(snapshot(restored),before);assert.deepEqual(restored.roll20Import.raw,raw);
 const rp=restored.casters.find(x=>x.id===p.id),rk=rp.spells.find(x=>x.id===k.id);
 assert.equal(makeSpellRoll(restored,rp,rk,spell(rk.spellId),true).formula,`1d8+${Math.min(25,rp.level)}`);assert.equal(rk.spent,1);
});
