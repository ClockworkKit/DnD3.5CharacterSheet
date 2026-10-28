import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {activeDamageReductions,newDamageReductionSource} from '../lib/damage-reduction.ts';
import {characterSchema} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';
import {gainLevel} from '../lib/level-up.ts';

const create=(kind='Barbarian',level=7)=>createPlayerCharacter({name:'Class DR QA',kind,level,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:12,WIS:10,CHA:10},method:'manual'});
const earned=c=>activeDamageReductions(c).filter(s=>s.id.startsWith('class-dr:'));

test('Barbarian and Dwarven Defender DR appears at every published boundary without requiring rage or stance',()=>{
 for(const [id,limit] of [['barbarian',20],['dwarven-defender',10]])for(let level=1;level<=limit;level++){
  const c=create('Fighter',1);c.classLevels=[{id:'class',classId:id,name:id,level,notes:''}];
  const expected=id==='barbarian'?Math.max(0,Math.floor((level-4)/3)):level>=10?6:level>=6?3:0;
  assert.deepEqual(earned(c).map(s=>s.amount),expected?[expected]:[],id+' '+level);
  assert.ok(earned(c).every(s=>s.bypass==='\u2014'&&s.active&&!s.gearId));
  assert.deepEqual(c.defense.drSources,[],'derived sources are never saved as manual entries');
 }
});

test('DR replacements remove only Barbarian grants and restoring the feature restores the grant',()=>{
 const c=create('Barbarian',19);
 c.classLevels.push({id:'defender',classId:'dwarven-defender',name:'Dwarven Defender',level:10,notes:''});
 for(const id of ['barbarian-devils-luck','barbarian-streetfighter','barbarian-totem-manifestation']){
  c.alternateFeatures.selected=[id];assert.deepEqual(earned(c).map(s=>s.amount),[6]);
  c.alternateFeatures.selected=[];assert.deepEqual(earned(c).map(s=>s.amount),[5,6]);
 }
 c.alternateFeatures.selected=['barbarian-berserker-strength'];c.hp=1;
 assert.deepEqual(earned(c).map(s=>s.amount),[5,6],'Berserker Strength replaces rage, not ordinary DR');
 assert.equal(activeDamageReductions(c).find(s=>s.id==='acf-berserker').amount,3);
 assert.match(activeDamageReductions(c).find(s=>s.id==='acf-berserker').notes,/Stacks/);
});

test('manual mode, existing entries and imported notes are preserved without guessing or summing sources',()=>{
 const c=create();const manual={...newDamageReductionSource(),source:'Barbarian (old manual copy)',amount:1,notes:'Player note'};
 c.defense.drSources=[manual,{...newDamageReductionSource(),source:'Stoneskin',amount:10,bypass:'adamantine'}];
 c.defense.dr='Old Roll20 DR notes';const before=structuredClone(c);
 assert.deepEqual(activeDamageReductions(c).map(s=>s.amount),[1,10,1]);assert.deepEqual(c,before);
 c.automation.enabled=false;assert.deepEqual(activeDamageReductions(c),c.defense.drSources);
 c.classLevels=[];c.automation.enabled=true;c.classes='Barbarian 20';
 c.features.push({id:'free-text',name:'Damage reduction 100/-',kind:'Class feature',description:'Custom note',source:'',max:0,used:0});
 assert.equal(earned(c).length,0,'free text is not authority for class mechanics');
});

test('ordinary and gestalt DR keep class sources separate; overlapping grants never become a summed source',()=>{
 const c=createPlayerCharacter({name:'Paired DR QA',kind:'Fighter',level:17,raceId:'hill-dwarf',scores:{STR:14,DEX:14,CON:14,INT:12,WIS:10,CHA:10},method:'manual',advancementMode:'gestalt',gestaltPairs:Array.from({length:17},()=>({left:'barbarian',right:'fighter'}))});
 const fighter=c.classLevels.find(e=>e.classId==='fighter');fighter.level=7;
 c.classLevels.push({id:'defender',classId:'dwarven-defender',name:'Dwarven Defender',level:10,notes:''});
 for(const row of c.gestaltProgression.levels.slice(7))row.right='defender';
 assert.deepEqual(earned(c).map(s=>s.amount),[4,6]);
 assert.equal(Math.max(...earned(c).map(s=>s.amount)),6,'best applicable source, not 10');
 for(const row of c.gestaltProgression.levels)[row.left,row.right]=[row.right,row.left];
 assert.deepEqual(earned(c).map(s=>s.amount),[4,6]);
 c.gestaltProgression.bonusMethod='fractional-v1';assert.deepEqual(earned(c).map(s=>s.amount),[4,6]);
 c.advancementMode='standard';assert.deepEqual(earned(c).map(s=>s.amount),[4,6]);
});

test('ordinary advancement unlocks DR without healing, refunding uses or duplicating manual sources on native reload',async()=>{
 const c=create('Barbarian',6);c.hp-=3;c.experience=500000;
 c.features.push({id:'spent',name:'Player counter',kind:'Other',description:'Keep this note',source:'',max:4,used:2});
 c.defense.drSources=[{...newDamageReductionSource(),source:'Campaign armor',amount:2,notes:'Keep armor rule'}];
 assert.equal(earned(c).length,0);const previous=structuredClone(c);
 gainLevel(c,'barbarian',6);recompute(c,previous);
 assert.deepEqual(earned(c).map(s=>s.amount),[1]);assert.equal(c.level,7);assert.equal(c.maxHp-c.hp,3);
 const before=structuredClone(c);activeDamageReductions(c);assert.deepEqual(c,before);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
 assert.deepEqual(loaded,c);assert.equal(loaded.features.find(f=>f.id==='spent').used,2);
 assert.equal(loaded.defense.drSources.length,1);assert.equal(loaded.defense.drSources[0].notes,'Keep armor rule');
 assert.deepEqual(await prepareCharacter(characterSchema.parse(loaded)),loaded);
});
