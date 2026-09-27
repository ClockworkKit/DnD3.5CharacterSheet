import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,characterSchema,newWeapon,uid} from '../lib/model.ts';
import {activateAutomation,recompute,resourceNumbers} from '../lib/automation.ts';
import {alternateFeaturesSchema} from '../lib/alternate-feature-schema.ts';
import {alternateResources,alternateFeatureProblem,alternateFeatureWarnings,selectAlternateFeature,spendAlternateResource,featureReplaced,turningClassLevel,hasTurningAbility} from '../lib/alternate-features.ts';
import {resetDaily,weaponDamage,weaponAttack} from '../lib/rules.ts';
import {featEligibility} from '../lib/prerequisites.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const create=(name='Paladin',level=12)=>activateAutomation(newCharacter(name,level),false);
const arcana=(c,ranks=1)=>{c.skills.find(s=>s.name==='Knowledge (arcana)').ranks=ranks;};
const choose=(c,id,selected=true)=>{selectAlternateFeature(c,id,selected);recompute(c);};
const turning=c=>c.features.find(f=>f.ruleId==='daily:Turn or rebuke undead');
const summary=c=>c.features.find(f=>f.name==='Paladin class features').description;
const pool=(c,key)=>alternateResources(c).find(r=>r.key===key);

test('legacy sheets gain an empty selection and malformed replacement state is rejected',()=>{
 const c=create();delete c.alternateFeatures;assert.deepEqual(characterSchema.parse(c).alternateFeatures,{selected:[],uses:{}});
 for(const selected of [['unknown'],['paladin-charging-smite','paladin-charging-smite'],['paladin-charging-smite','paladin-divine-spirit']])assert.equal(alternateFeaturesSchema.safeParse({selected}).success,false);
 assert.equal(alternateFeaturesSchema.safeParse({selected:['paladin-divine-counterspell','cleric-divine-counterspell']}).success,true);
 assert.equal(alternateFeaturesSchema.safeParse({uses:{x:-1}}).success,false);
});
test('choices enforce class level, skill ranks and overlapping replacements',()=>{
 const c=create('Paladin',3);assert.throws(()=>choose(c,'paladin-charging-smite'),/level 5/);assert.throws(()=>choose(c,'cleric-divine-counterspell'),/cleric level/);
 c.classLevels[0].level=6;assert.throws(()=>choose(c,'paladin-curse-breaker'),/arcana/);arcana(c);choose(c,'paladin-curse-breaker');choose(c,'paladin-charging-smite');
 assert.match(alternateFeatureProblem(c,'paladin-divine-spirit'),/Conflicts/);assert.throws(()=>choose(c,'paladin-divine-spirit'),/Conflicts/);
 choose(c,'paladin-detect-undead');assert.equal(c.alternateFeatures.selected.length,3);
});
test('replacement removes original milestones, restores them and preserves unrelated notes',()=>{
 const c=create();c.features.push({id:'personal',name:'Personal note',description:'My mount’s history',kind:'Other',source:'',max:0,used:0});
 choose(c,'paladin-charging-smite');choose(c,'paladin-detect-undead');arcana(c);choose(c,'paladin-curse-breaker');
 assert.doesNotMatch(summary(c),/special mount|detect evil|remove disease/i);assert.match(summary(c),/divine grace/i);
 choose(c,'paladin-charging-smite',false);choose(c,'paladin-detect-undead',false);choose(c,'paladin-curse-breaker',false);
 assert.match(summary(c),/special mount/i);assert.match(summary(c),/detect evil/i);assert.match(summary(c),/remove disease/i);
 assert.equal(c.features.find(f=>f.id==='personal').description,'My mount’s history');assert.equal(c.features.some(f=>f.ruleId?.startsWith('acf:')),false);
});
test('turning replacement removes rolls and feat eligibility, without granting bonus uses to counterspell',()=>{
 const c=create('Paladin',8);c.scores.CHA=16;arcana(c,5);selectAlternateFeature(c,'paladin-divine-counterspell',true);
 assert.equal(pool(c,'daily:counterspell').check,7);recompute(c);assert.equal(turning(c),undefined);assert.equal(resourceNumbers(c).turnLevel,0);assert.equal(hasTurningAbility(c),false);
 c.features.push({id:uid(),kind:'Feat',name:'Improved Turning',description:'',source:'',max:0,used:0});assert.equal(resourceNumbers(c).turnLevel,0);
 const feat={id:'extra-turning',name:'Extra Turning',description:'',source:'',prerequisites:'Ability to turn or rebuke creatures.'};assert.equal(featEligibility(c,feat).eligible,false);
 c.features.push({id:uid(),kind:'Feat',name:'Extra Turning',description:'',source:'',max:0,used:0});assert.equal(pool(c,'daily:counterspell').max,4);
});
test('multiclass turning retains the class not replaced; counterspell uses cleric level',()=>{
 const c=create('Paladin',8);c.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:2,notes:''});recompute(c);arcana(c,5);selectAlternateFeature(c,'paladin-divine-counterspell',true);
 assert.equal(pool(c,'daily:counterspell').check,4);recompute(c);assert.equal(turningClassLevel(c),2);assert.equal(hasTurningAbility(c),true);assert.ok(turning(c));
 arcana(c);choose(c,'cleric-divine-counterspell');assert.equal(turningClassLevel(c),0);assert.equal(alternateResources(c).filter(r=>r.key==='daily:counterspell').length,1);
 choose(c,'paladin-divine-counterspell',false);assert.equal(turningClassLevel(c),5);assert.ok(turning(c));
});
test('spent turning survives replacement, restoration and rest in automatic and manual modes',()=>{
 for(const automatic of [true,false]){
  const c=create('Paladin',8);c.automation.enabled=automatic;turning(c).used=2;arcana(c);choose(c,'paladin-divine-counterspell');assert.equal(turning(c),undefined);
  choose(c,'paladin-divine-counterspell',false);assert.equal(turning(c).used,2);
  arcana(c);choose(c,'paladin-divine-counterspell');Object.assign(c,resetDaily(c));choose(c,'paladin-divine-counterspell',false);assert.equal(turning(c).used,0);
 }
});
test('choices suspend below their level without deleting selection or spent uses',()=>{
 const c=create();choose(c,'paladin-divine-spirit');spendAlternateResource(c,'daily:spirit-healing');c.classLevels[0].level=4;recompute(c);
 assert.equal(featureReplaced(c,'paladin','special-mount'),false);assert.equal(alternateResources(c).length,0);assert.match(alternateFeatureWarnings(c)[0],/inactive/);
 c.classLevels[0].level=12;recompute(c);assert.equal(c.alternateFeatures.uses['daily:spirit-healing'],1);assert.equal(featureReplaced(c,'paladin','special-mount'),true);
});
test('Divine Spirit unlocks individual once-daily pools and healing uses full lay on hands capacity',()=>{
 const c=create('Paladin',5);c.scores.CHA=16;choose(c,'paladin-divine-spirit');assert.equal(alternateResources(c).length,1);assert.match(pool(c,'daily:spirit-healing').description,/30 HP/);
 for(const [level,count] of [[11,2],[16,3],[20,4]]){c.classLevels[0].level=level;recompute(c);assert.equal(alternateResources(c).length,count);}
 spendAlternateResource(c,'daily:spirit-healing');assert.throws(()=>spendAlternateResource(c,'daily:spirit-healing'),/No uses/);spendAlternateResource(c,'daily:spirit-combat');
 choose(c,'paladin-divine-spirit',false);choose(c,'paladin-divine-spirit');assert.throws(()=>spendAlternateResource(c,'daily:spirit-healing'),/No uses/);
 assert.equal(resetDaily(c).alternateFeatures.uses['daily:spirit-healing'],undefined);
});
test('Curse Breaker shares a weekly pool; daily rest and switching choices preserve it',()=>{
 const c=create();arcana(c);choose(c,'paladin-curse-breaker');assert.equal(pool(c,'weekly:curse-breaker').max,3);
 spendAlternateResource(c,'weekly:curse-breaker',2);spendAlternateResource(c,'weekly:curse-breaker');assert.throws(()=>spendAlternateResource(c,'weekly:curse-breaker'),/No uses/);
 Object.assign(c,resetDaily(c));assert.equal(c.alternateFeatures.uses['weekly:curse-breaker'],3);choose(c,'paladin-curse-breaker',false);arcana(c);choose(c,'paladin-curse-breaker');assert.equal(c.alternateFeatures.uses['weekly:curse-breaker'],3);
 const low=create('Paladin',6);arcana(low);choose(low,'paladin-curse-breaker');assert.throws(()=>spendAlternateResource(low,'weekly:curse-breaker',2),/not available/);
});
test('resource spending rejects inactive choices, invalid costs and overdraw',()=>{
 const c=create();assert.throws(()=>spendAlternateResource(c,'daily:counterspell'),/not available/);arcana(c);c.scores.CHA=6;choose(c,'paladin-divine-counterspell');assert.equal(pool(c,'daily:counterspell').max,0);assert.throws(()=>spendAlternateResource(c,'daily:counterspell'),/No uses/);
 for(const cost of [0,-1,0.5,NaN,2])assert.throws(()=>spendAlternateResource(c,'daily:counterspell',cost),/not available/);
});
test('Charging Smite adds twice paladin level only to an eligible charging melee smite',()=>{
 const c=create('Paladin',5),w={...newWeapon(),name:'Test blade',damage:'1d8',damageAbility:'none',damageExtra:0,attackMode:'melee',proficiency:'yes'};c.automation.context.targetType='evil';c.automation.context.smite=true;
 const normal=weaponDamage(c,w);choose(c,'paladin-charging-smite');assert.equal(weaponDamage(c,w),normal);c.automation.context.charge=true;assert.equal(weaponDamage(c,w),'1d8+15');assert.equal(weaponDamage(c,w,true),'2d8+30');
 c.automation.context.smite=false;assert.equal(weaponDamage(c,w),'1d8');c.automation.context.smite=true;c.automation.context.targetType='good';assert.equal(weaponDamage(c,w),'1d8');
 c.automation.context.targetType='evil';w.attackMode='ranged';w.range='60 ft.';const attack=weaponAttack(c,w);assert.equal(weaponDamage(c,w),'1d8');c.automation.context.smite=false;assert.equal(weaponAttack(c,w),attack);
});
test('generated features and schema stay stable across repeated recomputation',()=>{
 const c=create();arcana(c);choose(c,'paladin-divine-counterspell');choose(c,'paladin-divine-spirit');choose(c,'paladin-detect-undead');arcana(c);choose(c,'paladin-curse-breaker');
 const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));assert.deepEqual(saved,c);recompute(c);recompute(c);assert.deepEqual(c,saved);
});
test('browser persistence and export/import retain selected replacements and weekly expenditure',async()=>{
 const values=new Map(),options={storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),scope:'/test/',lock:(_,f)=>Promise.resolve(f()),id:()=>uid()};const api=createBrowserCharacterApi(options),c=create();arcana(c);choose(c,'paladin-curse-breaker');spendAlternateResource(c,'weekly:curse-breaker',2);
 const row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})}),fresh=createBrowserCharacterApi(options);const saved=await fresh('/api/characters/'+row.id);assert.deepEqual(saved.data,c);
 const imported=characterSchema.parse(JSON.parse(JSON.stringify(saved.data)));recompute(imported);assert.deepEqual(imported,c);
});
