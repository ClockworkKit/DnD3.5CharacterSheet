import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {weaponAttack,weaponDamage,makeFullAttackRoll} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const values={class1:'Fighter',level1:4,str:16,dex:12,hp:30,hp_max:30,feats:'Weapon Focus (Longsword);Weapon Specialization (Longsword)',weapon1name:'Longsword',weapon1enh:2,weapon1focus:1,weapon1specialize:2,weapon1dicenumber:1,weapon1dicetype:8};
const raw=extra=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-20',character:{id:'enhancement-test',name:'Enhancement test'},attributes:Object.entries({...values,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
function legacy(extra={}){
 const c=importRoll20(raw(extra)).character;delete c.roll20Import.weaponEnhancementMigration;
 for(const w of c.weapons){delete w.roll20Enhancement;delete w.enhancement;}
 return activateAutomation(migrateRoll20Automation(c));
}
function buff(c,n=3){c.effects.push({id:'enhancement-buff',name:'Weapon enhancement',active:true,permanent:false,preset:'',casterLevel:1,remaining:0,notes:'',modifiers:[{target:'attack',type:'enhancement',value:String(n),when:''},{target:'damage',type:'enhancement',value:String(n),when:''}]});}

test('imported enhancement is typed once and does not stack with another enhancement or masterwork',async()=>{
 const source=raw({}),before=saved(source),manual=importRoll20(source).character;
 assert.equal(weaponAttack(manual,manual.weapons[0]),10);assert.equal(weaponDamage(manual,manual.weapons[0]),'1d8+7');
 const c=await load(manual),w=c.weapons[0];
 assert.equal(w.enhancement,2);assert.deepEqual(w.roll20Enhancement,{attack:2,damage:2});
 assert.equal(w.attack,3);assert.equal(w.damageExtra,4);
 assert.equal(weaponAttack(c,w),10);assert.equal(weaponDamage(c,w),'1d8+7');
 w.masterwork=true;assert.equal(weaponAttack(c,w),10);
 buff(c,1);assert.equal(weaponAttack(c,w),10);assert.equal(weaponDamage(c,w),'1d8+7');
 c.effects=[];buff(c,3);assert.equal(weaponAttack(c,w),11);assert.equal(weaponDamage(c,w),'1d8+8');
 assert.equal(weaponDamage(c,w,true),'2d8+16');
 const roll=makeFullAttackRoll(c);assert.equal(roll.rolls[0].formula,'1d20+11');assert.equal(roll.rolls[1].formula,'1d8+8');
 c.automation.enabled=false;assert.equal(weaponAttack(c,w),10);assert.equal(weaponDamage(c,w),'1d8+7');
 assert.deepEqual(source,before);assert.deepEqual(c.roll20Import.raw,before);
});

test('linked gear adopts imported enhancement and later upgrades remain authoritative',async()=>{
 const extra={repeating_inventory_ROW_name:'Longsword',repeating_inventory_ROW_weight:4};
 for(const start of [importRoll20(raw(extra)).character,legacy(extra)]){
  const c=await load(start),w=c.weapons[0],g=c.gear[0];
  assert.equal(g.weaponId,w.id);assert.equal(g.enhancement,2);assert.equal(w.enhancement,2);
  assert.equal(weaponAttack(c,w),10);
  g.enhancement=4;recompute(c);assert.equal(w.enhancement,4);
  assert.equal(weaponAttack(c,w),12);assert.equal(weaponDamage(c,w),'1d8+9');
  g.enhancement=0;recompute(c);assert.equal(weaponAttack(c,w),8);assert.equal(weaponDamage(c,w),'1d8+5');
  assert.deepEqual(saved(await load(c)),saved(c));
 }
 const old=legacy(extra);old.gear[0].enhancement=3;recompute(old);
 const upgraded=await load(old);assert.equal(upgraded.gear[0].enhancement,3);assert.equal(weaponAttack(upgraded,upgraded.weapons[0]),11);
 const zero=legacy(extra);zero.gear[0].enhancement=0;
 const fixed=await load(zero);assert.equal(fixed.gear[0].enhancement,0);assert.equal(fixed.weapons[0].enhancement,0);
});

test('old-save repair preserves level-ups, current weapon upgrades, damage taken and unrelated state',async()=>{
 const c=legacy();buff(c);assert.equal(weaponAttack(c,c.weapons[0]),13);
 c.effects=[];c.classLevels[0].level=12;c.scores.STR=18;recompute(c);
 c.weapons[0].enhancement=4;c.weapons[0].extraDamage='1d6';c.weapons[0].notes='New enchantment';
 c.hp-=7;c.notes='Progress since import';c.features.find(f=>f.name.startsWith('Weapon Focus')).used=1;
 const before=saved(c),fixed=await load(c),w=fixed.weapons[0];
 assert.equal(weaponAttack(fixed,w),21);assert.equal(weaponDamage(fixed,w),'1d8+10+1d6');
 for(const key of ['classLevels','automation','skills','features','hp','maxHp','notes','gear','casters','scores'])assert.deepEqual(saved(fixed[key]),before[key],key);
 assert.deepEqual(fixed.weapons.map(({roll20Enhancement,...w})=>w),before.weapons);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('explicit player component choices, zero enhancement and edited or ambiguous weapons are respected',async()=>{
 for(const change of [
  w=>{w.attack=0;},w=>{w.damageExtra=0;},w=>{w.damage='1d10';},w=>{w.ability='DEX';},w=>{w.strength='two';},
  w=>{w.catalogId='weapon-dagger';},w=>{delete w.catalogId;},w=>{w.name='Replacement';},
  w=>{w.roll20Enhancement={attack:0,damage:0};},
 ]){
  const c=legacy();change(c.weapons[0]);const before=saved(c.weapons);
  assert.deepEqual((await load(c)).weapons,before);
 }
 const zero=legacy();zero.weapons[0].enhancement=0;const fixed=await load(zero);
 assert.equal(fixed.weapons[0].enhancement,0);assert.equal(weaponAttack(fixed,fixed.weapons[0]),8);
 const duplicates=legacy();duplicates.weapons.push({...duplicates.weapons[0],id:'copy'});const before=saved(duplicates.weapons);
 assert.deepEqual((await load(duplicates)).weapons,before);
 const sourceDuplicates=raw({weapon2name:'Longsword',weapon2enh:3,weapon2dicenumber:1,weapon2dicetype:8});
 const d=importRoll20(sourceDuplicates).character;delete d.roll20Import.weaponEnhancementMigration;
 for(const w of d.weapons){delete w.roll20Enhancement;delete w.enhancement;}
 d.weapons.pop();const lone=await load(activateAutomation(migrateRoll20Automation(d)));
 assert.equal(lone.weapons[0].roll20Enhancement,undefined);
});

test('ambiguous duplicate gear never overrides a freshly imported weapon enhancement',async()=>{
 const c=await load(importRoll20(raw({repeating_inventory_A_name:'Longsword',repeating_inventory_B_name:'Longsword'})).character);
 assert.equal(c.gear.filter(g=>g.weaponId===c.weapons[0].id).length,0);
 assert.equal(c.weapons[0].enhancement,2);assert.equal(weaponAttack(c,c.weapons[0]),10);
});

test('complete formulas and unsupported enhancement components remain review-only',async()=>{
 const extra={weapon1dicenumber:'',weapon1dicetype:'',weapon1damage:'1d8+7'};
 for(const start of [importRoll20(raw(extra)).character,legacy(extra)]){
  const c=await load(start);assert.equal(c.weapons[0].roll20Enhancement,undefined);
  assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('enhancement bonus could not be separated')));
 }
 for(const value of [0,-1,1.5,'@{unknown}']){
  const c=await load(importRoll20(raw({weapon1enh:value})).character);
  assert.equal(c.weapons[0].roll20Enhancement,undefined);
 }
});

test('fixed and repeating aliases, numeric attack totals and absent feat components retain correct stacking',async()=>{
 for(const section of ['weapon','weapons','attack','attacks']){
  const data=raw({weapon1name:'',feats:''});
  for(const [name,current] of Object.entries({npcattackname:'Longsword',npcattackenh:2,npcattackdicenumber:1,npcattackdicetype:8,npcattackattackcalc:9}))data.attributes.push({name:'repeating_'+section+'_ROW_'+name,current});
  const c=await load(importRoll20(data).character),w=c.weapons[0];
  assert.equal(weaponAttack(c,w),9);assert.equal(weaponDamage(c,w),'1d8+5');
  buff(c);assert.equal(weaponAttack(c,w),10);assert.equal(weaponDamage(c,w),'1d8+6');
 }
});

test('native backups and browser persistence retain enhancement provenance without repeating repairs',async()=>{
 const records=new Map(),api=createBrowserCharacterApi({scope:'enhancement',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const c=await load(legacy());c.weapons[0].roll20Enhancement.attack=0;
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=await load((await api('/api/characters/'+record.id)).data);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:restored}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('missing or invalid original exports never change current weapon data',async()=>{
 const c=legacy();c.roll20Import.raw={invalid:true};const before=saved(c.weapons);
 const fixed=await load(c);assert.deepEqual(fixed.weapons,before);
 assert.equal(fixed.roll20Import.weaponEnhancementMigration,undefined);
 assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('enhancement bonuses could not be checked')));
});
