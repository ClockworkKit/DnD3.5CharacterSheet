import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spellFormula,makeSpellRoll,spendSpell} from '../lib/rules.ts';
import {spellAttackBonus} from '../lib/spell-attacks.ts';
import {hasSearingLightTargets,spellEffectTargetNote} from '../lib/spell-effect-targets.ts';
import {spellAttackSchema} from '../lib/spell-attack-schema.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {recompute,formulaPreview} from '../lib/automation.ts';

const spells=JSON.parse(fs.readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const s=spells.find(s=>s.id==='searing-light');
const settings=effectTarget=>({mode:'auto',bonus:0,effectTarget});
const create=()=>createPlayerCharacter({name:'Searing Light QA',kind:'Cleric',level:11,raceId:'human',scores:{STR:12,DEX:16,CON:12,INT:12,WIS:18,CHA:12},method:'manual'});
const known=()=>({id:'light-known',spellId:s.id,level:3,slotLevel:3,prepared:2,spent:0,formula:'',notes:'Keep this prayer',custom:null});
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('Searing Light selects all four damage progressions and their caps without changing old defaults',()=>{
 for(const cl of [1,2,5,9,10,11,20]){
  const half=Math.max(1,Math.min(5,Math.floor(cl/2))),full=Math.min(10,cl);
  for(const [target,expected] of [['ordinary',`${half}d8`],['undead',`${full}d6`],['light-vulnerable-undead',`${full}d8`],['construct',`${half}d6`]])assert.equal(spellFormula(s,cl,settings(target)),expected);
  assert.equal(spellFormula(s,cl),`${half}d8`);
 }
 assert.equal(spellFormula({...s,attack:settings('undead')},11),'10d6');
 assert.equal(spellFormula({...s,attack:settings('undead')},11,settings('ordinary')),'5d8');
 assert.equal(hasSearingLightTargets(spells.find(s=>s.id==='scorching-ray')),false);
 assert.equal(spellFormula(spells.find(s=>s.id==='scorching-ray'),11,settings('construct')),'4d6');
 assert.throws(()=>spellAttackSchema.parse(settings('dragon')));
});

test('Cast and preview select the same dice, keep the attack unchanged and spend only once',()=>{
 const c=create(),p=c.casters[0],k=known();p.spells=[k];const base=spellAttackBonus(c,s,p.level);
 for(const [target,formula] of [['ordinary','5d8'],['undead','10d6'],['light-vulnerable-undead','10d8'],['construct','5d6']]){
  k.attack=settings(target);const before=snapshot(c),r=makeSpellRoll(c,p,k,s,true);
  assert.equal(r.rolls[0].formula,'1d20+'+base);assert.equal(r.rolls[1].formula,formula);
  assert.match(r.details,/Searing Light damage target:/);assert.deepEqual(snapshot(c),before);
  const preview=formulaPreview(c,spellFormula(s,p.level,k.attack),{CL:p.level,SL:k.level});
  assert.equal(makeSpellRoll(c,p,k,s,true,preview.formula).rolls[1].formula,formula);
  assert.equal(makeSpellRoll(c,p,k,s).rolls,undefined);
 }
 Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,1);
});

test('manual formulas retain priority and selecting a target never modifies the catalog or other characters',()=>{
 const c=create(),p=c.casters[0],k={...known(),attack:settings('undead'),formula:'2d8+7'},before=structuredClone(s);
 assert.equal(makeSpellRoll(c,p,k,s,true).rolls[1].formula,'2d8+7');
 assert.equal(makeSpellRoll(c,p,k,s,true,'3d6').rolls[1].formula,'3d6');
 assert.equal(makeSpellRoll(c,p,known(),s,true).rolls[1].formula,'5d8');assert.deepEqual(s,before);
 assert.match(spellEffectTargetNote(s,settings('construct')),/Construct or inanimate object/);
});

test('target choice survives browser and native saves without resetting preparation, damage or advancement',async()=>{
 const c=create(),p=c.casters[0];p.spells=[{...known(),attack:settings('light-vulnerable-undead'),spent:1}];
 c.classLevels[0].level=12;recompute(c);c.hp-=5;c.notes='After last session';const before=snapshot(c);
 const records=new Map(),api=createBrowserCharacterApi({scope:'searing-qa',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=(await api('/api/characters/'+record.id)).data;
 const restored=await prepareCharacter(characterSchema.parse(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:loaded}))));
 assert.deepEqual(snapshot(restored),before);
 assert.equal(makeSpellRoll(restored,restored.casters[0],restored.casters[0].spells[0],s,true).rolls[1].formula,'10d8');
 const old=create();assert.deepEqual(snapshot(characterSchema.parse(old)),snapshot(old));
});

test('existing Roll20 Searing Light imports accept target selection without replaying old levels or spent counts',async()=>{
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-23',character:{id:'light-import',name:'Light import'},attributes:Object.entries({class1:'Cleric',level1:5,wis:18,repeating_spells31_ROW_spellname31:'Searing Light',repeating_spells31_ROW_spellprep31:2,repeating_spells31_ROW_spellused31:1}).map(([name,current])=>({name,current,max:''}))};
 const c=await prepareCharacter(importRoll20(raw).character);c.classLevels[0].level=7;recompute(c);c.hp-=4;
 const p=c.casters.find(p=>p.spells.some(k=>k.spellId===s.id)),k=p.spells.find(k=>k.spellId===s.id);k.attack=settings('undead');
 const before=snapshot(c),restored=await prepareCharacter(characterSchema.parse(snapshot(c)));assert.deepEqual(snapshot(restored),before);assert.deepEqual(restored.roll20Import.raw,raw);
 assert.equal(makeSpellRoll(c,p,k,s,true).rolls[1].formula,'7d6');assert.equal(k.spent,1);assert.equal(k.prepared,2);
});
