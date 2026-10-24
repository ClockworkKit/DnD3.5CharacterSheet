import test from 'node:test';
import assert from 'node:assert/strict';
import {roll20SpellCatalog,importRoll20} from '../lib/roll20-import.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {makeSpellRoll,spellDC,spellFormula,spendSpell,makeRequest} from '../lib/rules.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {makeSpellAttackOnlyRoll} from '../lib/spell-attacks.ts';

const spell=roll20SpellCatalog().find(s=>s.id==='poison');
const known=()=>({id:'poison-qa',spellId:'poison',level:4,slotLevel:4,prepared:1,spent:0,formula:'',notes:'',custom:null});
const create=()=>createPlayerCharacter({name:'Poison QA',kind:'Cleric',level:7,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:10},method:'manual'});
const save=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(save(c)));

test('Poison uses half caster level and Wisdom, not ordinary spell level or another casting ability',()=>{
 const c=create(),p=c.casters[0],k=known();
 for(const [cl,dc] of [[1,13],[7,16],[8,17],[12,19],[20,23]]){
  p.level=cl;assert.equal(spellDC(c,p,k,spell),dc);assert.equal(spellDC(c,p,k),dc);
  assert.equal(spellFormula(spell,cl),'1d10');
 }
 p.ability='INT';p.casting.classId='wizard';p.level=7;
 assert.equal(spellDC(c,p,k,spell),16);
 p.dcExtra=2;assert.equal(spellDC(c,p,k,spell),18);
 c.temps.WIS=4;assert.equal(spellDC(c,p,k,spell),20);
 c.features.push({id:'focus',name:'Spell Focus (Necromancy)',kind:'Feat',description:'',source:'',max:0,used:0});
 assert.equal(spellDC(c,p,k,spell),21);
});

test('Cast rolls one touch attack and initial ability damage, not both poison stages or HP damage',()=>{
 const c=create(),p=c.casters[0],k=known();p.spells=[k];const before=save(c),roll=makeSpellRoll(c,p,k,spell,true);
 assert.deepEqual(roll.rolls.map(r=>r.formula),['1d20+6','1d10']);
 assert.match(roll.rolls[1].label,/Constitution damage/);assert.match(roll.rolls[1].label,/negates/);
 assert.equal(Object.fromEntries(roll.fields).Save,'Fortitude negates; see text (DC 16)');
 assert.match(roll.details,/One minute later/);assert.match(roll.details,/not rolled now/);
 assert.deepEqual(save(c),before);assert.equal(spendSpell(p,k,c).spells[0].spent,1);
 const macro=makeRequest(roll,c.name,'https://example.com').message;
 assert.equal((macro.match(/\[\[1d10\]\]/g)||[]).length,1);assert.match(macro,/Constitution damage/);
});

test('Post card stays roll-free, held-charge attack does not spend another spell, and overrides keep priority',()=>{
 const c=create(),p=c.casters[0],k=known();k.formula='2d10';k.notes='Campaign note';p.spells=[k];
 const post=makeSpellRoll(c,p,k,spell);assert.equal(post.formula,undefined);assert.equal(post.rolls,undefined);assert.match(post.details,/Campaign note/);
 assert.equal(makeSpellRoll(c,p,k,spell,true).rolls[1].formula,'2d10');
 assert.equal(makeSpellRoll(c,p,k,spell,true,'3d10').rolls[1].formula,'3d10');
 const before=save(c),attack=makeSpellAttackOnlyRoll(c,spell,p.level);
 assert.equal(attack.rolls.length,1);assert.deepEqual(save(c),before);
});

test('ordinary, similarly named custom and mass spells keep their existing DC and effect rules',()=>{
 const c=create(),p=c.casters[0],k=known(),custom={...spell,id:'custom-poison',name:'Poison'};
 assert.equal(spellDC(c,p,{...k,custom},custom),17);
 assert.equal(spellFormula(custom,7),'');
 const harm=roll20SpellCatalog().find(s=>s.id==='harm');assert.equal(spellDC(c,p,{...k,spellId:'harm',level:6},harm),19);
});

test('a Roll20 prayer after level-up keeps source data, preparations, spent uses, notes and damage',async()=>{
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-24',character:{id:'poison-import-qa',name:'Poison import QA'},attributes:Object.entries({class1:'Cleric',level1:7,wis:16,hp:20,hp_max:30,divinecasterlevel:7,divinespells4:1,repeating_spells41_TEST_spellname41:'Poison',repeating_spells41_TEST_spellprep41:1,repeating_spells41_TEST_spellused41:1}).map(([name,current])=>({name,current,max:''}))};
 const c=await load(importRoll20(raw).character);c.classLevels[0].level=12;recompute(c);c.hp-=2;c.notes='Later progress';
 const p=c.casters[0],k=p.spells.find(k=>k.spellId==='poison');assert.ok(k);k.notes='Later spell note';
 const before=save(c),reloaded=await load(c),roll=makeSpellRoll(reloaded,reloaded.casters[0],k,spell,true);
 assert.equal(reloaded.casters[0].level,12);assert.equal(spellDC(reloaded,reloaded.casters[0],k,spell),19);
 assert.equal(k.spent,1);assert.match(roll.details,/Later spell note/);assert.deepEqual(save(reloaded),before);
 assert.throws(()=>spendSpell(p,k,c));assert.deepEqual(c.roll20Import.raw,raw);
});
