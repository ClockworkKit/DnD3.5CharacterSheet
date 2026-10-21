import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {characterSchema,newWeapon} from '../lib/model.ts';
import {weaponAttack,weaponDamage,sheetTotals,skillBonus,makeFullAttackRoll} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const values={class1:'Fighter',level1:4,str:16,dex:12,hp:30,hp_max:30,weapon1name:'Longsword',weapon1dicenumber:1,weapon1dicetype:8,globalAttackBonus:2,globalDamageBonus:3,globalVariableDamageBonus:'1d6'};
const raw=extra=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-20',character:{id:'global-test',name:'Global bonus test'},attributes:Object.entries({...values,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
function legacy(extra={}){
 const c=importRoll20(raw(extra)).character;delete c.globalCombat;delete c.roll20Import.globalCombatMigration;
 for(const w of c.weapons){delete w.globalAttackOffset;delete w.globalDamageIncluded;}
 return activateAutomation(migrateRoll20Automation(c));
}

test('global attack, flat damage and extra dice survive fresh imports in manual and automatic modes',async()=>{
 const source=raw({}),before=saved(source),manual=importRoll20(source).character;
 for(const c of [manual,await load(manual)]){
  const w=c.weapons[0];assert.equal(weaponAttack(c,w),9);assert.equal(weaponDamage(c,w),'1d8+6+1d6');
  assert.equal(weaponDamage(c,w,true),'2d8+12+1d6');
  const totals=sheetTotals(c),skill=skillBonus(c,c.skills[0]);c.globalCombat.enabled=false;
  assert.equal(weaponAttack(c,w),7);assert.equal(weaponDamage(c,w),'1d8+3');
  assert.deepEqual(sheetTotals(c),totals);assert.equal(skillBonus(c,c.skills[0]),skill);
 }
 assert.deepEqual(source,before);assert.deepEqual(manual.roll20Import.raw,before);
});

test('numeric attack totals retain one global contribution and follow later edits and disabling',async()=>{
 for(const start of [importRoll20(raw({weapon1attackcalc:9})).character,legacy({weapon1attackcalc:9})]){
  const c=await load(start),w=c.weapons[0];assert.equal(w.attack,2);assert.equal(w.globalAttackOffset,2);
  assert.equal(weaponAttack(c,w),9);c.globalCombat.attack=4;assert.equal(weaponAttack(c,w),11);
  c.globalCombat.enabled=false;assert.equal(weaponAttack(c,w),7);
  assert.deepEqual(saved(await load(c)),saved(c));
 }
});

test('old saves retain level-ups, newly acquired weapons, current resources and source data',async()=>{
 const c=legacy();c.classLevels[0].level=9;c.scores.STR=18;recompute(c);
 c.hp-=4;c.notes='Progress after import';c.weapons[0].enhancement=2;c.weapons[0].notes='Upgraded';
 c.weapons.push({...newWeapon(),name:'New weapon since import',damage:'1d6',proficiency:'yes'});
 const before=saved(c),fixed=await load(c),w=fixed.weapons[0];
 assert.equal(weaponAttack(fixed,w),17);assert.equal(weaponDamage(fixed,w),'1d8+9+1d6');
 assert.equal(weaponAttack(fixed,fixed.weapons[1]),15);
 for(const key of ['classLevels','skills','automation','features','hp','maxHp','notes','gear','casters','weapons'])assert.deepEqual(saved(fixed[key]),before[key],key);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);
 assert.deepEqual(saved(await load(fixed)),saved(fixed));
 const roll=makeFullAttackRoll(fixed);assert.equal(roll.rolls[0].formula,'1d20+17');assert.equal(roll.rolls[1].formula,'1d8+9+1d6');
});

test('complete damage formulas remain intact until the player chooses to add global damage',async()=>{
 const extra={weapon1dicenumber:'',weapon1dicetype:'',weapon1damage:'1d8+6'};
 for(const start of [importRoll20(raw(extra)).character,legacy(extra)]){
  const c=await load(start),w=c.weapons[0];assert.equal(w.globalDamageIncluded,true);
  assert.equal(weaponDamage(c,w),'1d8+6');
  assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('may already include global damage')));
  w.globalDamageIncluded=false;assert.equal(weaponDamage(c,w),'1d8+6+3+1d6');
 }
});

test('disabled, zero, negative and resolved-only globals preserve their exact meaning',async()=>{
 const disabled=await load(importRoll20(raw({globalBonusEnabled:0})).character);
 assert.equal(disabled.globalCombat.enabled,false);assert.equal(weaponAttack(disabled,disabled.weapons[0]),7);
 disabled.globalCombat.enabled=true;assert.equal(weaponAttack(disabled,disabled.weapons[0]),9);
 const negative=await load(importRoll20(raw({globalAttackBonus:-2,globalDamageBonus:-1,globalVariableDamageBonus:'-1d4'})).character);
 assert.equal(weaponAttack(negative,negative.weapons[0]),5);assert.equal(weaponDamage(negative,negative.weapons[0],true),'2d8+4-1d4');
 const zero=importRoll20(raw({globalAttackBonus:0,globalDamageBonus:0,globalVariableDamageBonus:0})).character;
 assert.equal(weaponAttack(zero,zero.weapons[0]),7);assert.equal(weaponDamage(zero,zero.weapons[0]),'1d8+3');
 const source=raw({});source.attributes=source.attributes.filter(a=>!a.name.startsWith('global'));
 source.resolvedCoreValues={globalAttackBonus:2,globalDamageBonus:3,globalVariableDamageBonus:'1d6',globalBonusEnabled:1};
 const resolved=await load(importRoll20(source).character);assert.equal(weaponAttack(resolved,resolved.weapons[0]),9);
 assert.equal(weaponDamage(resolved,resolved.weapons[0]),'1d8+6+1d6');
});

test('repeating weapons and feat/enhancement repairs do not duplicate global modifiers',async()=>{
 for(const section of ['weapon','weapons','attack','attacks']){
  const data=raw({weapon1name:'',feats:'Weapon Focus (Longsword);Weapon Specialization (Longsword)'});
  for(const [name,current] of Object.entries({npcattackname:'Longsword',npcattackattackcalc:12,npcattackenh:2,npcattackfocus:1,npcattackspecialize:2,npcattackdicenumber:1,npcattackdicetype:8}))data.attributes.push({name:'repeating_'+section+'_ROW_'+name,current});
  const c=await load(importRoll20(data).character),w=c.weapons[0];
  assert.equal(weaponAttack(c,w),12);assert.equal(weaponDamage(c,w),'1d8+10+1d6');
  c.globalCombat.enabled=false;assert.equal(weaponAttack(c,w),10);assert.equal(weaponDamage(c,w),'1d8+7');
 }
});

test('edits that may already compensate for missing globals are kept for review instead of overwritten',async()=>{
 for(const edit of [c=>{c.weapons[0].attack+=2;},c=>{c.weapons[0].damageExtra+=3;},c=>{c.weapons[0].extraDamage='1d6';},c=>{c.situational=2;},c=>{c.weapons.push({...c.weapons[0],id:'duplicate'});},c=>{c.weapons[0].catalogId='weapon-dagger';},c=>{c.effects.push({id:'manual',name:'Manual compensation',active:true,permanent:false,preset:'',casterLevel:1,remaining:0,notes:'',modifiers:[{target:'attack',type:'untyped',value:'2',when:''}]});}]){
  const c=legacy({weapon1attackcalc:9});edit(c);const before=saved(c),fixed=await load(c);
  assert.equal(fixed.globalCombat,undefined);assert.deepEqual(fixed.weapons,before.weapons);assert.equal(fixed.situational,before.situational);
  assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('not applied automatically')));
 }
 const c=legacy();c.globalCombat={enabled:false,attack:0,damage:0,extraDamage:''};
 assert.deepEqual((await load(c)).globalCombat,c.globalCombat);
});

test('unsupported formulas are never executed and invalid source exports leave current state unchanged',async()=>{
 const c=await load(importRoll20(raw({globalAttackBonus:'@{unknown}',globalDamageBonus:'1d6',globalVariableDamageBonus:'1d6 &{tracker}'})).character);
 assert.deepEqual(c.globalCombat,{enabled:true,attack:0,damage:0,extraDamage:''});
 assert.ok(c.roll20Import.report.warnings.filter(s=>/global|Global/.test(s)).length>=3);
 c.globalCombat.extraDamage='@{unknown}';assert.throws(()=>weaponDamage(c,c.weapons[0]));
 const old=legacy();old.roll20Import.raw={invalid:true};const before=saved(old.weapons),fixed=await load(old);
 assert.deepEqual(fixed.weapons,before);assert.equal(fixed.globalCombat,undefined);assert.equal(fixed.roll20Import.globalCombatMigration,undefined);
});

test('browser and native backup round trips retain global modifiers and explicit player choices',async()=>{
 const records=new Map(),api=createBrowserCharacterApi({scope:'global-combat',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const c=await load(legacy({weapon1attackcalc:9}));c.globalCombat.enabled=false;c.weapons[0].globalAttackOffset=0;
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=await load((await api('/api/characters/'+record.id)).data);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:restored}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});
