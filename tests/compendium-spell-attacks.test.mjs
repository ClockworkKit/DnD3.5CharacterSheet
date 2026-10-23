import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {spellAttackProfile,spellAttackBonus} from '../lib/spell-attacks.ts';
import {spellFormula,makeSpellRoll,makeRequest,spendSpell} from '../lib/rules.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {chooseDilettante,castDilettante} from '../lib/factotum.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {recompute} from '../lib/automation.ts';

const entries=JSON.parse(fs.readFileSync(new URL('../public/data/supplemental-spells.json',import.meta.url)));
const spell=id=>{const e=entries.find(e=>e.id===id);return {...e.spell,levels:e.levels};};
const create=(kind='Wizard',level=11)=>createPlayerCharacter({name:'Compendium attack QA',kind,level,raceId:'human',scores:{STR:12,DEX:16,CON:12,INT:20,WIS:18,CHA:12},method:'manual'});
const known=s=>({id:'known-'+s.id,spellId:s.id,level:Object.values(s.levels)[0],slotLevel:Object.values(s.levels)[0],prepared:2,spent:0,formula:'',notes:'Keep my notes',custom:null});
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('Shocking Spark uses its own 6th/10th-level projectile thresholds, full attack bonus and 4d6 per spark',()=>{
 const c=create(),s=spell('supp-shocking-spark'),k=known(s);
 for(const [cl,count] of [[1,1],[5,1],[6,2],[9,2],[10,3],[20,3]]){
  const p=spellAttackProfile(s,cl);assert.equal(p.mode,'ranged-touch');assert.equal(p.count,count);
  const r=makeSpellRoll(c,{...c.casters[0],level:cl},k,s,true);
  assert.deepEqual(r.rolls.filter((_,i)=>i%2===0).map(x=>x.formula),Array(count).fill('1d20+'+(c.bab+3)));
  assert.deepEqual(r.rolls.filter((_,i)=>i%2).map(x=>x.formula),Array(count).fill('4d6'));
 }
 assert.match(spellAttackProfile(s,11).note,/metal/i);
 assert.equal(spellAttackBonus(c,s,11,{mode:'auto',bonus:3}),c.bab+6,'existing conditional adjustment supports the metal-target bonus once');
});

test('Scourge of Force rolls a maximum of four melee touches at the highest bonus, each with capped damage',()=>{
 const c=create(),s=spell('supp-scourge-of-force'),k=known(s);
 for(const [cl,count,damage] of [[1,1,'1d8+0'],[2,1,'1d8+1'],[3,2,'1d8+1'],[5,2,'1d8+2'],[6,3,'1d8+3'],[8,3,'1d8+4'],[9,4,'1d8+4'],[10,4,'1d8+5'],[20,4,'1d8+5']]){
  assert.equal(spellAttackProfile(s,cl).mode,'melee-touch');
  const r=makeSpellRoll(c,{...c.casters[0],level:cl},k,s,true);assert.equal(r.rolls.length,count*2);
  assert.deepEqual(r.rolls.filter((_,i)=>i%2===0).map(x=>x.formula),Array(count).fill('1d20+'+(c.bab+1)));
  assert.deepEqual(r.rolls.filter((_,i)=>i%2).map(x=>x.formula),Array(count).fill(damage));
 }
});

test('Flesh Ripper uses one ranged touch and capped d8 damage without treating it as a weapon maneuver',()=>{
 const c=create('Cleric'),p=c.casters[0],s=spell('supp-flesh-ripper');
 for(const cl of [1,5,9,10,20])assert.equal(spellFormula(s,cl),`${Math.min(10,cl)}d8`);
 const r=makeSpellRoll(c,p,known(s),s,true);assert.equal(r.rolls.length,2);
 assert.equal(r.rolls[0].formula,'1d20+'+(c.bab+3));assert.equal(r.rolls[1].formula,'10d8');
 assert.equal(spellAttackProfile({...s,id:'custom-maneuver',name:'Flesh Ripper',range:'Melee attack',description:'As part of this maneuver, make a melee attack.'},11).mode,'none');
});

test('compendium attack casts spend once and keep later progress, custom formulas and spent preparations on reload',async()=>{
 for(const id of ['supp-shocking-spark','supp-scourge-of-force','supp-flesh-ripper']){
  const c=create(id==='supp-flesh-ripper'?'Cleric':'Wizard'),p=c.casters[0],s=spell(id),k=known(s);p.spells=[k];c.hp-=3;
  const before=snapshot(c),r=makeSpellRoll(c,p,k,s,true);assert.ok(r.rolls.length>=2);assert.deepEqual(snapshot(c),before);
  assert.equal(makeSpellRoll(c,p,k,s).rolls,undefined);
  assert.equal((makeRequest(r,c.name,'https://example.com/').message.match(/\[\[1d20/g)||[]).length,spellAttackProfile(s,p.level).count);
  Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,1);
  p.spells[0].formula='2d6+7';p.spells[0].attack={mode:'auto',count:1,bonus:2};
  c.classLevels[0].level=12;recompute(c);
  const saved=snapshot(c),restored=await prepareCharacter(characterSchema.parse(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))));
  assert.deepEqual(snapshot(restored),saved);
  const rr=makeSpellRoll(restored,restored.casters[0],restored.casters[0].spells[0],s,true);
  assert.equal(rr.rolls.length,2);assert.equal(rr.rolls[1].formula,'2d6+7');
 }
});

test('Factotum multi-attack spells spend one inspiration and one daily choice',()=>{
 for(const id of ['supp-shocking-spark','supp-scourge-of-force']){
  const c=create('Factotum'),s=spell(id);chooseDilettante(c,s);const before=snapshot(c);
  const r=makeDilettanteRoll(c,s);assert.equal(r.rolls.length,spellAttackProfile(s,11).count*2);assert.deepEqual(snapshot(c),before);
  castDilettante(c,s.id);assert.equal(c.factotum.spent,1);assert.equal(c.factotum.spells[0].spent,true);
 }
});

test('Roll20-matched compendium spells retain IDs and expenditure after level-up while attacks use the new caster level',async()=>{
 for(const id of ['supp-shocking-spark','supp-scourge-of-force','supp-flesh-ripper']){
  const s=spell(id),divine=id==='supp-flesh-ripper',suffix=divine?'31':'22';
  const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-23',character:{id:'attack-import',name:'Attack import'},attributes:Object.entries({class1:divine?'Cleric':'Wizard',level1:9,int:20,wis:18,[`repeating_spells${suffix}_ROW_spellname${suffix}`]:s.name,[`repeating_spells${suffix}_ROW_spellprep${suffix}`]:2,[`repeating_spells${suffix}_ROW_spellused${suffix}`]:1}).map(([name,current])=>({name,current,max:''}))};
  const c=await prepareCharacter(importRoll20(raw).character);c.classLevels[0].level=10;recompute(c);c.hp-=2;c.notes='Advanced since Roll20';
  const before=snapshot(c),restored=await prepareCharacter(characterSchema.parse(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))));
  assert.deepEqual(snapshot(restored),before);assert.deepEqual(restored.roll20Import.raw,raw);
  const p=restored.casters.find(p=>p.spells.some(k=>k.spellId===id));assert.ok(p,`matched ${id}`);
  const k=p.spells.find(k=>k.spellId===id);assert.equal(k.prepared,2);assert.equal(k.spent,1);
  const r=makeSpellRoll(restored,p,k,s,true);assert.equal(r.rolls.length,spellAttackProfile(s,p.level).count*2);
  if(id==='supp-shocking-spark')assert.equal(r.rolls.length,6);
 }
});
