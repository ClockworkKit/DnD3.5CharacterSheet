import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {weaponAttack,makeFullAttackRoll,criticalConfirmation} from '../lib/rules.ts';
import {characterSchema} from '../lib/model.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'attack-total-test',name:'Attack total test'},attributes:Object.entries({class1:'Fighter',level1:4,str:16,dex:12,hp:25,hp_max:30,feats:'Weapon Focus (Longsword)',weapon1name:'Longsword',weapon1attackcalc:8,...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
function legacy(extra={}){
 const c=importRoll20(raw(extra)).character;c.roll20Import.weaponBonusMigration=1;
 for(const w of c.weapons){const prior=w.roll20AttackSource?.explicitFocusAdjustment;delete w.roll20AttackSource;if(prior)w.roll20AttackAdjustment=prior;else delete w.roll20AttackAdjustment;}
 return activateAutomation(migrateRoll20Automation(c));
}

test('numeric source attacks do not gain a second Focus bonus when components are absent, zero or formulas',async()=>{
 for(const extra of [{},{weapon1focus:0},{weapon1focus:'@{unresolved}'},{weapon1focus:1}]){
  const data=raw(extra),manual=importRoll20(data).character;assert.equal(weaponAttack(manual,manual.weapons[0]),8);
  const c=await load(manual),w=c.weapons[0];assert.equal(weaponAttack(c,w),8);assert.equal(w.roll20AttackAdjustment,-1);
  assert.equal(w.roll20AttackSource.total,8);assert.deepEqual(c.roll20Import.raw,data);
  c.automation.enabled=false;assert.equal(weaponAttack(c,w),8);
 }
});

test('old version-one saves keep later levels, ability gains, new feats, upgrades and resources',async()=>{
 const c=legacy();assert.equal(weaponAttack(c,c.weapons[0]),9);
 c.classLevels[0].level=12;c.scores.STR=18;recompute(c);c.hp-=4;c.notes='Player notes';
 c.features.push({id:'greater-focus',name:'Greater Weapon Focus (Longsword)',kind:'Feat',description:'Later feat',source:'',max:0,used:0});
 c.weapons[0].enhancement=2;c.weapons[0].ammo=7;c.weapons[0].notes='Player upgrade';
 const before=saved(c),fixed=await load(c),w=fixed.weapons[0];
 assert.equal(weaponAttack(fixed,w),20);assert.equal(w.roll20AttackAdjustment,-1);assert.equal(w.enhancement,2);assert.equal(w.ammo,7);
 for(const key of ['classLevels','scores','automation','skills','features','hp','maxHp','notes','gear','casters','psionics'])assert.deepEqual(saved(fixed[key]),before[key],key);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('a partially recorded Greater Focus component upgrades only the known old generated adjustment',async()=>{
 const extra={level1:8,feats:'Weapon Focus (Longsword);Greater Weapon Focus (Longsword)',weapon1focus:1,weapon1attackcalc:13};
 const c=legacy(extra);assert.equal(c.weapons[0].roll20AttackAdjustment,-1);assert.equal(weaponAttack(c,c.weapons[0]),14);
 const fixed=await load(c);assert.equal(fixed.weapons[0].roll20AttackAdjustment,-2);assert.equal(weaponAttack(fixed,fixed.weapons[0]),13);
 for(const explicit of [0,-3]){const edited=legacy(extra);edited.weapons[0].roll20AttackAdjustment=explicit;assert.equal((await load(edited)).weapons[0].roll20AttackAdjustment,explicit);}
});

test('later removal of an original Focus feat removes its old contribution without retaining a ghost bonus',async()=>{
 const c=legacy();c.features=c.features.filter(f=>f.name!=='Weapon Focus (Longsword)');
 const fixed=await load(c);assert.equal(weaponAttack(fixed,fixed.weapons[0]),7);
});

test('changed misc, ability, form and weapon identity are kept for review',async()=>{
 for(const change of [w=>{w.attack=0;},w=>{w.ability='DEX';},w=>{w.attackMode='ranged';},w=>{w.catalogId='weapon-dagger';},w=>{w.name='Replacement';},w=>{w.roll20AttackAdjustment=0;}]){
  const c=legacy();change(c.weapons[0]);const before=saved(c.weapons);assert.deepEqual((await load(c)).weapons,before);
 }
 const c=legacy();c.weapons.push({...c.weapons[0],id:'duplicate'});const before=saved(c.weapons);assert.deepEqual((await load(c)).weapons,before);
});

test('zero and negative source totals remain recorded totals, not guesses about source correctness',async()=>{
 for(const total of [0,-2,100007]){const c=await load(importRoll20(raw({weapon1attackcalc:total})).character);assert.equal(weaponAttack(c,c.weapons[0]),total);}
 const noTotal=await load(importRoll20(raw({weapon1attackcalc:'@{unresolved}'})).character);
 assert.equal(noTotal.weapons[0].roll20AttackSource,undefined);assert.equal(noTotal.weapons[0].roll20AttackAdjustment,undefined);assert.equal(weaponAttack(noTotal,noTotal.weapons[0]),8);
});

test('fixed and repeating numeric aliases reconcile identically and retain global/enhancement components',async()=>{
 for(const section of ['weapon','weapons','attack','attacks']){
  const data=raw({weapon1name:'',globalAttackBonus:2,globalBonusEnabled:1});
  for(const [name,current]of Object.entries({npcattackname:'Longsword',npcattackattackcalc:12,npcattackenh:2,npcattackdicenumber:1,npcattackdicetype:8}))data.attributes.push({name:`repeating_${section}_ROW_${name}`,current});
  const c=await load(importRoll20(data).character);assert.equal(weaponAttack(c,c.weapons[0]),12,section);
  assert.equal(c.globalCombat.attack,2);assert.equal(c.weapons[0].globalAttackOffset,2);assert.equal(c.weapons[0].enhancement,2);
  c.globalCombat.attack=4;assert.equal(weaponAttack(c,c.weapons[0]),14);
 }
});

test('full attacks and critical confirmation use the reconciled attack while later iterative penalties remain intact',async()=>{
 const c=await load(legacy({level1:6,weapon1attackcalc:10})),w=c.weapons[0],roll=makeFullAttackRoll(c);
 assert.equal(roll.rolls[0].formula,'1d20+10');assert.equal(roll.rolls[2].formula,'1d20+5');assert.equal(criticalConfirmation(c,w),10);
});

test('browser and native round trips retain source provenance and later explicit zero choices',async()=>{
 const c=await load(legacy());c.weapons[0].roll20AttackAdjustment=0;
 const records=new Map(),api=createBrowserCharacterApi({scope:'attack-totals',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backed=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backed)),saved(c));
});

test('invalid retained source cannot change current weapons or complete the migration',async()=>{
 const c=legacy();c.roll20Import.raw={invalid:true};const before=saved(c.weapons),fixed=await load(c);
 assert.deepEqual(fixed.weapons,before);assert.equal(fixed.roll20Import.weaponBonusMigration,1);
 assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('Imported weapon bonuses could not be checked')));
});

test('Weapon Finesse replaces Strength only, not explicit imported or edited alternate attack abilities',async()=>{
 for(const [ability,expected]of [['INT',10],['WIS',9],['CHA',6],['CON',7],['DEX',8],['STR',8]]){
  const c=await load(importRoll20(raw({str:12,dex:18,int:22,wis:20,cha:14,con:16,feats:'Weapon Finesse',weapon1name:'Rapier',weapon1stat:ability,weapon1attackcalc:''})).character),w=c.weapons[0];
  assert.equal(w.ability,ability);assert.equal(weaponAttack(c,w),expected,ability);
  assert.equal(criticalConfirmation(c,w),expected);assert.equal(makeFullAttackRoll(c).rolls[0].formula,'1d20+'+expected);
  assert.equal((await load(c)).weapons[0].ability,ability);
 }
 const c=await load(importRoll20(raw({str:12,dex:18,int:22,feats:'Weapon Finesse',weapon1name:'Rapier',weapon1stat:'STR',weapon1attackcalc:''})).character);
 c.weapons[0].ability='INT';assert.equal(weaponAttack(c,c.weapons[0]),10);
 c.weapons[0].ability='STR';c.scores.STR=22;assert.equal(weaponAttack(c,c.weapons[0]),10,'Finesse must not replace stronger Strength');
});
