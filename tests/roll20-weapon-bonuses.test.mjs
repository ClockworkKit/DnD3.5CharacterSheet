import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {weaponAttack,weaponDamage,makeFullAttackRoll} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const values={class1:'Fighter',level1:4,str:16,dex:12,hp:30,hp_max:30,feats:'Weapon Focus (Longsword);Weapon Specialization (Longsword)',weapon1name:'Longsword',weapon1dicenumber:1,weapon1dicetype:8,weapon1focus:1,weapon1specialize:2};
const raw=extra=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-20',character:{id:'weapon-bonus-test',name:'Weapon bonus test'},attributes:Object.entries({...values,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
function legacy(extra={}){
 const c=importRoll20(raw(extra)).character;delete c.roll20Import.weaponBonusMigration;
 for(const w of c.weapons){delete w.roll20AttackAdjustment;delete w.roll20DamageAdjustment;}
 return activateAutomation(migrateRoll20Automation(c));
}
function feat(c,name){c.features.push({id:name,name,kind:'Feat',description:'',source:'',max:0,used:0});}

test('explicit Focus and Specialization contributions count once in manual and automatic modes',async()=>{
 const source=raw({}),before=saved(source),manual=importRoll20(source).character;
 assert.equal(weaponAttack(manual,manual.weapons[0]),8);assert.equal(weaponDamage(manual,manual.weapons[0]),'1d8+5');
 const c=await load(manual),w=c.weapons[0];
 assert.equal(weaponAttack(c,w),8);assert.equal(weaponDamage(c,w),'1d8+5');assert.equal(weaponDamage(c,w,true),'2d8+10');
 assert.equal(w.attack,1);assert.equal(w.damageExtra,2);assert.equal(w.roll20AttackAdjustment,-1);assert.equal(w.roll20DamageAdjustment,-2);
 c.automation.enabled=false;assert.equal(weaponAttack(c,w),8);assert.equal(weaponDamage(c,w),'1d8+5');
 assert.deepEqual(source,before);assert.deepEqual(c.roll20Import.raw,before);
});

test('old saves retain later levels, ability gains, new feats, weapon upgrades, and resources',async()=>{
 const c=legacy();assert.equal(weaponAttack(c,c.weapons[0]),9);assert.equal(weaponDamage(c,c.weapons[0]),'1d8+7');
 c.classLevels[0].level=12;c.scores.STR=18;recompute(c);
 feat(c,'Greater Weapon Focus (Longsword)');feat(c,'Greater Weapon Specialization (Longsword)');
 c.hp-=5;c.notes='Advanced after import';c.weapons[0].enhancement=2;c.weapons[0].extraDamage='1d6';c.weapons[0].notes='Upgraded';
 const before=saved(c),fixed=await load(c),w=fixed.weapons[0];
 assert.equal(weaponAttack(fixed,w),20);assert.equal(weaponDamage(fixed,w),'1d8+10+1d6');
 for(const key of ['classLevels','automation','skills','features','hp','maxHp','notes','gear','casters'])assert.deepEqual(saved(fixed[key]),before[key],key);
 assert.deepEqual(fixed.weapons.map(({roll20AttackAdjustment,roll20DamageAdjustment,...w})=>w),before.weapons);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('repair follows the original feat baseline even when those feats were later removed',async()=>{
 const c=legacy();c.features=c.features.filter(f=>!f.name.startsWith('Weapon Focus')&&!f.name.startsWith('Weapon Specialization'));
 const fixed=await load(c);assert.equal(weaponAttack(fixed,fixed.weapons[0]),7);assert.equal(weaponDamage(fixed,fixed.weapons[0]),'1d8+3');
});

test('all repeating weapon aliases share the same source component reconciliation',async()=>{
 for(const section of ['weapon','weapons','attack','attacks']){
  const data=raw({weapon1name:''});
  const prefix='repeating_'+section+'_ROW_';
  for(const [name,current] of Object.entries({npcattackname:'Longsword',npcattackdicenumber:1,npcattackdicetype:8,npcattackfocus:1,npcattackspecialize:2}))data.attributes.push({name:prefix+name,current});
  const c=await load(importRoll20(data).character);assert.equal(c.weapons.length,1);
  assert.equal(weaponAttack(c,c.weapons[0]),8,section);assert.equal(weaponDamage(c,c.weapons[0]),'1d8+5',section);
 }
});

test('corrections are bounded by source components and feats actually present at import',async()=>{
 for(const [extra,attack,damage] of [
  [{weapon1focus:0,weapon1specialize:0},8,'1d8+5'],
  [{weapon1focus:3,weapon1specialize:6},10,'1d8+9'],
  [{feats:''},8,'1d8+5'],
  [{weapon1focus:'@{unknown}',weapon1specialize:'@{unknown}'},8,'1d8+5'],
  [{weapon1focus:-1,weapon1specialize:-2},7,'1d8+3'],
 ]){
  const c=await load(importRoll20(raw(extra)).character),w=c.weapons[0];
  assert.equal(weaponAttack(c,w),attack);assert.equal(weaponDamage(c,w),damage);
 }
});

test('changed misc fields are left alone, but an independently unchanged component can be repaired',async()=>{
 const c=legacy();c.weapons[0].attack=0;const fixed=await load(c),w=fixed.weapons[0];
 assert.equal(w.roll20AttackAdjustment,undefined);assert.equal(w.attack,0);
 assert.equal(w.roll20DamageAdjustment,-2);assert.equal(weaponAttack(fixed,w),8);assert.equal(weaponDamage(fixed,w),'1d8+5');
 assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('edited after import')));
 const d=legacy();d.weapons[0].damageExtra=0;const damageFixed=await load(d);
 assert.equal(damageFixed.weapons[0].roll20DamageAdjustment,undefined);assert.equal(damageFixed.weapons[0].roll20AttackAdjustment,-1);
});

test('explicit zero adjustments, changed identities, duplicate names and replacement catalog entries are retained',async()=>{
 for(const change of [
  w=>{w.roll20AttackAdjustment=0;w.roll20DamageAdjustment=0;},
  w=>{w.name='Replacement sword';},
  w=>{w.catalogId='weapon-dagger';},
  w=>{delete w.catalogId;},
 ]){
  const c=legacy();change(c.weapons[0]);const before=saved(c.weapons);
  assert.deepEqual((await load(c)).weapons,before);
 }
 const c=legacy();c.weapons.push({...c.weapons[0],id:'second'});const before=saved(c.weapons);
 assert.deepEqual((await load(c)).weapons,before);
});

test('complete damage formulas remain review-only; ordinary full attack and critical rolls use corrected bonuses',async()=>{
 const c=await load(importRoll20(raw({weapon1dicenumber:'',weapon1dicetype:'',weapon1damage:'1d8+5'})).character);
 assert.equal(c.weapons[0].roll20DamageAdjustment,undefined);
 assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('overlap ambiguously')));
 const old=legacy({weapon1dicenumber:'',weapon1dicetype:'',weapon1damage:'1d8+5'});old.roll20Import.report.warnings=[];
 assert.ok((await load(old)).roll20Import.report.warnings.some(s=>s.includes('overlap ambiguously')));
 const fixed=await load(legacy()),roll=makeFullAttackRoll(fixed);
 assert.equal(roll.rolls[0].formula,'1d20+8');assert.equal(roll.rolls[1].formula,'1d8+5');
});

test('browser storage and native backups retain the one-time repair and manual overrides',async()=>{
 const records=new Map(),api=createBrowserCharacterApi({scope:'weapon-bonuses',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const c=await load(legacy());c.weapons[0].roll20AttackAdjustment=0;
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=await load((await api('/api/characters/'+record.id)).data);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:restored}));
 assert.deepEqual(saved(await load(backup)),saved(c));assert.equal(restored.weapons[0].roll20AttackAdjustment,0);
});
