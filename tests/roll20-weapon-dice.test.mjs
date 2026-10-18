import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {weaponDamage,weaponDice,weaponAttack,makeFullAttackRoll} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const raw=values=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-18',character:{id:'dice-regression',name:'Dice test'},attributes:Object.entries({class1:'Fighter',level1:1,str:10,hp:10,hp_max:10,...values}).map(([name,current])=>({name,current,max:''}))});
const load=c=>activateAutomation(migrateRoll20Automation(characterSchema.parse(JSON.parse(JSON.stringify(c)))));
function legacy(values){const c=importRoll20(raw(values)).character;delete c.roll20Import.weaponDiceMigration;for(const w of c.weapons)delete w.useRecordedDice;c.automation.version=0;return activateAutomation(c);}
const saved=c=>JSON.parse(JSON.stringify(c));

test('complete fixed weapon damage survives adoption without losing catalog rules',()=>{
 const source=raw({weapon1name:'Longsword',weapon1damage:'1d8+5'}),before=structuredClone(source);
 const manual=importRoll20(source).character,c=load(manual),w=c.weapons[0];
 assert.equal(weaponDamage(manual,manual.weapons[0]),'1d8+5');assert.equal(weaponDamage(c,w),'1d8+5');
 assert.equal(w.catalogId,'weapon-longsword');assert.equal(w.useRecordedDice,true);assert.equal(w.damageAbility,'none');
 w.proficiency='no';assert.equal(weaponAttack(c,w),-3);
 assert.equal(makeFullAttackRoll(c).rolls[1].formula,'1d8+5');assert.deepEqual(source,before);
 assert.deepEqual(saved(load(c)),saved(c));
});

test('custom numbered and legacy dice survive, while normal small weapon dice remain automatic',()=>{
 const c=load(importRoll20(raw({weapon1name:'Longsword',weapon1dicenumber:3,weapon1dicetype:6,weapon2name:'Dagger',weapon2statdamage:'2d4'})).character);
 assert.deepEqual(c.weapons.map(w=>weaponDamage(c,w)),['3d6','2d4']);
 const small=load(importRoll20(raw({size:'Small',weapon1name:'Longsword',weapon1statdamage:'1d6'})).character);
 assert.equal(small.weapons[0].useRecordedDice,undefined);assert.equal(weaponDice(small,small.weapons[0]),'1d6');
 small.size='Large';assert.equal(weaponDice(small,small.weapons[0]),'2d6');
});

test('all supported repeating weapon sections preserve complete damage',()=>{
 for(const section of ['weapon','weapons','attack','attacks']){
  const c=load(importRoll20(raw({[`repeating_${section}_ROW_name`]:'Longsword',[`repeating_${section}_ROW_damage`]:'2d6+4'})).character);
  assert.equal(weaponDamage(c,c.weapons[0]),'2d6+4',section);
 }
});

test('missing and unsupported imported dice remain reviewable instead of becoming invented catalog damage',()=>{
 for(const values of [{weapon1name:'Longsword'},{weapon1name:'Longsword',weapon1damage:'@{unknown}'},{weapon1name:'Longsword',weapon1dicenumber:1000,weapon1dicetype:6}]){
  const result=importRoll20(raw(values)),c=load(result.character);
  assert.equal(weaponDamage(c,c.weapons[0]),'0');assert.equal(c.weapons[0].useRecordedDice,true);
  assert.ok(result.report.warnings.some(w=>/review|recorded/.test(w)));
 }
});

test('old saves recover source dice and retain later advancement and weapon edits',()=>{
 const c=legacy({weapon1name:'Longsword',weapon1damage:'1d8+5'});assert.equal(weaponDamage(c,c.weapons[0]),'1d8');
 c.classLevels[0].level=3;recompute(c);c.hp-=2;c.notes='Advanced after import';c.weapons[0].notes='Keeps its name';c.weapons[0].attack=2;c.weapons[0].enhancement=1;
 const before=saved(c),fixed=load(c);assert.equal(weaponDamage(fixed,fixed.weapons[0]),'1d8+5+1');
 for(const key of ['classLevels','skills','hp','maxHp','notes','features','gear','casters','automation'])assert.deepEqual(saved(fixed[key]),before[key],key);
 for(const key of ['notes','attack','enhancement','catalogId','damageAbility','damage'])assert.equal(fixed.weapons[0][key],before.weapons[0][key],key);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);assert.deepEqual(saved(load(fixed)),saved(fixed));
 fixed.weapons[0].useRecordedDice=false;assert.equal(weaponDice(load(fixed),fixed.weapons[0]),'1d8');
});

test('repair does not replace changed formulas, replacement identities, or explicit dice choices',()=>{
 for(const edit of [w=>{w.damage='2d8';},w=>{w.name='My new sword';},w=>{w.catalogId='weapon-dagger';},w=>{w.useRecordedDice=false;},w=>{delete w.catalogId;}]){
  const c=legacy({weapon1name:'Longsword',weapon1damage:'1d8+5'});edit(c.weapons[0]);const before=saved(c.weapons);
  assert.deepEqual(saved(load(c).weapons),before);
 }
});

test('duplicate weapon names repair by matching their retained source formula',()=>{
 const c=legacy({weapon1name:'Longsword',weapon1damage:'1d8+5',weapon2name:'Longsword',weapon2damage:'2d6+4'});
 assert.deepEqual(load(c).weapons.map(w=>weaponDamage(c,w)),['1d8+5','2d6+4']);
});

test('normal monk dice keep progressing, including repaired saves levelled since import',()=>{
 const values={class1:'Monk',level1:2,weapon1name:'Unarmed strike',weapon1statdamage:'1d6'};
 for(const c of [load(importRoll20(raw(values)).character),legacy(values)]){
  c.classLevels[0].level=4;recompute(c);const fixed=load(c);
  assert.equal(fixed.weapons[0].useRecordedDice,undefined);assert.equal(weaponDice(fixed,fixed.weapons[0]),'1d8');
 }
 const custom=legacy({...values,weapon1damage:'1d6+5',weapon1statdamage:''});custom.classLevels[0].level=4;recompute(custom);
 const fixed=load(custom);assert.equal(weaponDamage(fixed,fixed.weapons[0]),'1d6+5');
});

test('recorded dice persist through browser storage and native backups',async()=>{
 const values=new Map(),api=createBrowserCharacterApi({scope:'dice-regression',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const c=load(legacy({weapon1name:'Longsword',weapon1damage:'1d8+5'}));
 const savedRecord=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=load((await api('/api/characters/'+savedRecord.id)).data);
 assert.equal(weaponDamage(restored,restored.weapons[0]),'1d8+5');assert.equal(restored.weapons[0].catalogId,'weapon-longsword');
});
