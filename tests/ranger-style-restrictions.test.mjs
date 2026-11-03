import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {recompute} from '../lib/automation.ts';
import {hasFeat,addEffect} from '../lib/effects.ts';
import {carrying,equipmentCatalog} from '../lib/equipment.ts';
import {attackRoutine,weaponAttack} from '../lib/rules.ts';
import {newWeapon,characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';

const make=(level=11,paired=false)=>createPlayerCharacter({name:'Ranger restrictions QA',kind:'Ranger',level,raceId:'human',scores:{STR:10,DEX:16,CON:14,INT:14,WIS:14,CHA:10},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left:'ranger',right:'wizard'}))}:{})});
const choose=(c,choice='Strong-Arm')=>{configureAlternateFeature(c,'ranger-combat-styles',{reviewed:true,choice});selectAlternateFeature(c,'ranger-combat-styles',true);recompute(c);};
const load=(c,weight)=>{c.gear=[{id:'cargo',name:'Carried supplies',qty:1,weight,carried:true,equipped:false,notes:''}];};
const weapon=(name='Longbow',off=false)=>({...newWeapon(),name,catalogId:equipmentCatalog.find(e=>e.name===name).id,ability:name==='Longbow'?'DEX':'STR',strength:off?'off':'one'});
const personal=(c,name)=>c.features.push({id:'personal-'+name,name,kind:'Feat',description:'Chosen independently',source:'My notes',max:0,used:0});
const armor=(category,material='standard')=>({id:'imported-armor',name:'Imported armor',qty:1,weight:0,carried:true,equipped:true,notes:'Keep this annotation',material,armorStats:{kind:'armor',category,armor:4,dexCap:4,checkPenalty:-3,spellFailure:20}});

test('ordinary archery loses its extra attack and penalty at the light-load boundary on either advancement mode',()=>{
 for(const paired of [false,true])for(const level of [2,6,11]){
  const c=make(level,paired),w=weapon();c.automation.rangerStyle='archery';load(c,33);c.automation.context.rapidShot=false;const normal=weaponAttack(c,w),count=attackRoutine(c,w).length;
  c.automation.context.rapidShot=true;assert.equal(weaponAttack(c,w),normal-2);assert.equal(attackRoutine(c,w).length,count+1);
  for(const weight of [34,67,101,201]){load(c,weight);assert.equal(weaponAttack(c,w),normal);assert.equal(attackRoutine(c,w).length,count);assert.equal(c.automation.rangerStyle,'archery');}
  load(c,33);assert.equal(attackRoutine(c,w).length,count+1);
 }
});

test('ordinary two-weapon style loses both reduced penalties and advanced offhand attacks when encumbered',()=>{
 for(const paired of [false,true])for(const level of [2,6,11]){
  const c=make(level,paired),w=weapon('Sword, short',true);c.automation.rangerStyle='two-weapon';c.automation.context.twoWeapon=true;c.automation.context.offhandLight=true;load(c,33);
  const trained=weaponAttack(c,w);assert.equal(attackRoutine(c,w).length,level>=11?3:level>=6?2:1);
  load(c,34);assert.equal(weaponAttack(c,w),trained-6);assert.equal(attackRoutine(c,w).length,1);
  c.automation.encumbrance=false;assert.equal(weaponAttack(c,w),trained);assert.equal(attackRoutine(c,w).length,level>=11?3:level>=6?2:1);
 }
});

test('alternate style grants obey load restrictions without rewriting or retiring the feat cards',()=>{
 const c=make(11,true);choose(c);const grants=structuredClone(c.features.filter(f=>f.ruleId?.startsWith('acf-grant:ranger-combat-styles:')));
 for(const weight of [33,34,66,67,100,101,201]){load(c,weight);recompute(c);for(const name of ['Power Attack','Improved Sunder','Great Cleave'])assert.equal(hasFeat(c,name),weight<=33);assert.deepEqual(c.features.filter(f=>f.ruleId?.startsWith('acf-grant:ranger-combat-styles:')),grants);}
 c.automation.encumbrance=false;assert.equal(hasFeat(c,'Power Attack'),true);c.automation.encumbrance=true;assert.equal(hasFeat(c,'Power Attack'),false);
});

test('imported armor, mithral and actual worn state restrict ordinary and alternate styles consistently',()=>{
 for(const alternate of [false,true]){
  const c=make();c.automation.rangerStyle='archery';c.automation.context.rapidShot=true;if(alternate)choose(c);const w=weapon(),active=()=>alternate?hasFeat(c,'Power Attack'):attackRoutine(c,w).some(a=>a.label==='Rapid shot');
  for(const [category,material,allowed] of [['light','standard',true],['medium','standard',false],['heavy','standard',false],['medium','mithral',true],['heavy','mithral',false]]){
   c.gear=[armor(category,material)];assert.equal(active(),allowed,category+' '+material);
   c.automation.encumbrance=false;assert.equal(active(),allowed,'load override does not override armor');c.automation.encumbrance=true;
  }
  for(const patch of [{equipped:false},{carried:false},{qty:0}]){c.gear=[{...armor('medium'),...patch}];assert.equal(active(),true);}
  c.gear=[{...armor('heavy'),armorStats:{kind:'shield',category:'shields',armor:2,dexCap:100,checkPenalty:-2,spellFailure:15}}];assert.equal(active(),true,'shields alone do not restrict a ranger style');
  characterSchema.parse(c);
 }
});

test('independently selected feats remain usable when the corresponding ranger style is unavailable',()=>{
 const c=make(),w=weapon();c.automation.rangerStyle='archery';c.automation.context.rapidShot=true;load(c,67);personal(c,'Rapid Shot');assert.equal(attackRoutine(c,w).some(a=>a.label==='Rapid shot'),true);
 c.automation.rangerStyle='two-weapon';c.automation.context.twoWeapon=true;const off=weapon('Sword, short',true);for(const name of ['Two-Weapon Fighting','Improved Two-Weapon Fighting','Greater Two-Weapon Fighting'])personal(c,name);assert.equal(attackRoutine(c,off).length,3);
 choose(c);personal(c,'Power Attack');recompute(c);assert.equal(hasFeat(c,'Power Attack'),true);assert.equal(hasFeat(c,'Great Cleave'),false);assert.equal(c.features.find(f=>f.id==='personal-Power Attack').description,'Chosen independently');
});

test('style activation uses current effective Strength, size, coins and the saved encumbrance option',()=>{
 const c=make();choose(c);load(c,40);assert.equal(carrying(c).category,'Medium');assert.equal(hasFeat(c,'Power Attack'),false);
 addEffect(c,'ability-STR');assert.equal(carrying(c).category,'Light');assert.equal(hasFeat(c,'Power Attack'),true);
 addEffect(c,'ability-STR');assert.equal(hasFeat(c,'Power Attack'),false);c.temps.STR=4;assert.equal(hasFeat(c,'Power Attack'),true);c.temps.STR=0;
 c.size='Large';assert.equal(hasFeat(c,'Power Attack'),true);c.size='Medium';load(c,33);c.coinWeight=true;c.coins.gp=50;assert.equal(hasFeat(c,'Power Attack'),false);c.coinWeight=false;assert.equal(hasFeat(c,'Power Attack'),true);
 c.automation.encumbrance=false;load(c,201);assert.equal(hasFeat(c,'Power Attack'),true);
});

test('replaced ordinary styles cannot add extra attacks and disabled alternate sources stay inactive',()=>{
 const c=make();c.automation.rangerStyle='archery';c.automation.context.rapidShot=true;choose(c);assert.equal(attackRoutine(c,weapon()).some(a=>a.label==='Rapid shot'),false);
 selectAlternateFeature(c,'ranger-combat-styles',false);assert.equal(hasFeat(c,'Power Attack'),false);assert.equal(attackRoutine(c,weapon()).some(a=>a.label==='Rapid shot'),true);
});

test('inactive style records survive native files, fresh storage and paired advancement without resource resets',async()=>{
 const c=make(2,true);choose(c);load(c,34);recompute(c);const f=c.features.find(f=>f.ruleId==='acf-grant:ranger-combat-styles:style-2');f.name='My training';f.description='Keep my notes';f.max=5;f.used=2;c.hp-=3;c.casters[0].slots[1].used=1;c.experience=3000;
 const before=structuredClone(c);assert.equal(hasFeat(c,'Power Attack'),false);attackRoutine(c,weapon());assert.deepEqual(c,before);
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(loaded,c);assert.equal(hasFeat(loaded,'Power Attack'),false);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();const api=createBrowserCharacterApi({scope:'/ranger-style-qa/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/ranger-style-qa/',storage,lock});const restored=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(restored,c);
 const history=structuredClone(restored.automation.history);applyGestaltLevel(restored,previewGestaltLevel(restored,{left:'ranger',right:'wizard'}));recompute(restored);assert.equal(restored.level,3);assert.equal(hasFeat(restored,'Power Attack'),false);assert.deepEqual(restored.features.find(x=>x.id===f.id),f);assert.equal(restored.maxHp-restored.hp,3);assert.equal(restored.casters[0].slots[1].used,1);for(const [key,value] of Object.entries(history))assert.deepEqual(restored.automation.history[key],value);
 restored.gear[0].carried=false;recompute(restored);assert.equal(hasFeat(restored,'Power Attack'),true);assert.deepEqual(restored.features.find(x=>x.id===f.id),f);
});
