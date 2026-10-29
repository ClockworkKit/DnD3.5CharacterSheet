import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {customClassDraft,customClassTable,previewCustomClassChange,applyCustomClassChange} from '../lib/custom-class-editor.ts';
import {recompute} from '../lib/automation.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {copyClassFeatures} from '../lib/classes.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {gestaltClassFamily,gestaltVariantWarnings} from '../lib/gestalt-class-families.ts';
import {gestaltLevelSequence} from '../lib/gestalt-progression.ts';
import {previewGestaltLevel} from '../lib/level-up.ts';

const make=(paired=false)=>createPlayerCharacter({name:'Custom editor QA',kind:'Fighter',level:3,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:12,WIS:14,CHA:10},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'fighter',right:'wizard'}))}:{})});
const draft=c=>{const d=customClassDraft(c);d.definition.name='Test class';d.definition.source='Synthetic source for tests';return d;};
function apply(c,review){const old=structuredClone(c);applyCustomClassChange(c,review);recompute(c,old);}
function installed(paired=false){const c=make(paired),d=draft(c);c.customClasses=[d];const entry=c.classLevels.find(e=>e.classId==='fighter');entry.classId=d.definition.id;entry.name=d.definition.name;recompute(c);copyClassFeatures(c);return c;}

test('adding a reviewed profile does not add levels, change mode or grant resources',()=>{
 const c=make(true),d=draft(c),before=structuredClone(c);
 const review=previewCustomClassChange(c,d.definition.id,d);assert.deepEqual(c,before);assert.equal(review.summary.used,0);
 apply(c,review);const after=structuredClone(c);delete after.customClasses;
 assert.deepEqual(after,before);assert.deepEqual(c.customClasses,[d]);
});

test('reviewed standard and gestalt table edits show new totals and preserve injuries, ranks and spent spells',async()=>{
 for(const paired of [false,true]){
  const c=installed(paired);c.hp-=3;if(paired)c.casters[0].slots[1].used=1;
  c.features.push({id:'personal',name:'Manual resource',kind:'Other',description:'Keep my note',source:'',max:4,used:3});
  const hide=c.skills.find(s=>s.name==='Hide');c.automation.history[0].skillRanks[hide.id]=1;recompute(c);
  const old=structuredClone(c);let d=customClassDraft(c,c.customClasses[0].definition.id);d.definition.hitDie=12;d.definition.skillPoints=6;d.definition.skills='Hide';d.policy.bonusProfile.bab='full';d=customClassTable(d,20);
  const review=previewCustomClassChange(c,d.definition.id,d);assert.deepEqual(c,old);assert.equal(review.summary.before.bab,2);assert.equal(review.summary.after.bab,3);assert.ok(review.summary.after.maxHp>c.maxHp);
  apply(c,review);assert.equal(c.maxHp-c.hp,3);assert.equal(c.bab,3);assert.deepEqual(c.automation.history,old.automation.history);assert.equal(c.skills.find(s=>s.id===hide.id).ranks,1);assert.equal(c.features.find(f=>f.id==='personal').used,3);
  if(paired)assert.equal(c.casters[0].slots[1].used,1);
  assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),c);
 }
});

test('manual legacy custom entries keep entered totals and do not enable automation',()=>{
 const c=make();c.automation.enabled=false;c.classLevels[0].classId='custom-legacy';c.classLevels[0].name='Legacy';c.bab=9;c.maxHp=41;c.hp=32;
 const d=customClassDraft(c,'custom-legacy');assert.equal(d.definition.name,'Legacy');assert.equal(d.definition.source,'');
 d.definition.source='Player source';const before=structuredClone(c),review=previewCustomClassChange(c,d.definition.id,d);
 assert.ok(review.summary.manual);apply(c,review);const after=structuredClone(c);delete after.customClasses;assert.deepEqual(after,before);
});

test('invalid, shortened, renamed and stale profile edits are atomic; tampered calculated results are ignored',()=>{
 const c=installed(true),d=customClassDraft(c,c.customClasses[0].definition.id),before=structuredClone(c);
 for(const change of [p=>p.definition.source='',p=>p.definition.id='fighter',p=>p.definition.levels.splice(2),p=>p.policy.family='wizard']){
  const bad=structuredClone(d);change(bad);assert.throws(()=>previewCustomClassChange(c,d.definition.id,bad));assert.deepEqual(c,before);
 }
 const review=previewCustomClassChange(c,d.definition.id,d);review.character.hp=999;apply(c,review);assert.equal(c.hp,before.hp);
 const stale=previewCustomClassChange(c,d.definition.id,d);c.hp--;assert.throws(()=>applyCustomClassChange(c,stale),/character changed/);
 const altered=previewCustomClassChange(c,d.definition.id,d);altered.profile.definition.skillPoints++;const current=structuredClone(c);assert.throws(()=>applyCustomClassChange(c,altered),/table changed/);assert.deepEqual(c,current);
});

test('table generation preserves milestone text and extra columns, and cannot delete them by shortening',()=>{
 const c=make(),d=draft(c);d.definition.levels[4].special='Keep this milestone';d.definition.levels[4].extra=['Keep extra column'];d.policy.bonusProfile.bab='full';
 const generated=customClassTable(d,10);assert.equal(generated.definition.levels[4].bab,5);assert.equal(generated.definition.levels[4].special,'Keep this milestone');assert.deepEqual(generated.definition.levels[4].extra,['Keep extra column']);
 assert.throws(()=>customClassTable(d,4),/remove recorded/);assert.equal(d.definition.levels.length,20);
});

test('existing HP rolls are never clamped or invented by a source-table edit',()=>{
 const c=installed(),d=customClassDraft(c,c.customClasses[0].definition.id);c.automation.hpMethod='rolled';c.automation.history[0].hitDieRoll=8;c.automation.history[1].hitDieRoll=7;c.automation.history[2].hitDieRoll=5;recompute(c);
 d.definition.hitDie=6;const before=structuredClone(c);assert.throws(()=>previewCustomClassChange(c,d.definition.id,d),/does not fit/);assert.deepEqual(c,before);
 d.definition.hitDie=8;delete c.automation.history[1].hitDieRoll;assert.throws(()=>previewCustomClassChange(c,d.definition.id,d),/Record the existing HP roll/);
});

test('custom feature notes are not rewritten by unrelated alternate-feature synchronization during table edits',()=>{
 const c=installed();c.classLevels.push({id:'monk',classId:'monk',name:'Monk',level:2,notes:''});recompute(c);
 configureAlternateFeature(c,'monk-invisible-fist',{reviewed:true});selectAlternateFeature(c,'monk-invisible-fist',true);recompute(c);
 const card=c.features.find(f=>f.name==='Test class class features');card.description+='\nPersonal source annotation';card.used=2;
 const d=customClassDraft(c,c.customClasses[0].definition.id);d.definition.levels[0].special='Revised source milestone';
 const review=previewCustomClassChange(c,d.definition.id,d);apply(c,review);
 assert.match(c.features.find(f=>f.id===card.id).description,/Personal source annotation/);assert.equal(c.features.find(f=>f.id===card.id).used,2);
});

test('custom families cannot disguise a catalog variant in a reviewed edit, strict plan or new advancement',()=>{
 for(const [parent,variant]of [['rogue','psychic-rogue'],['psion','erudite']]){
  const c=installed(true),d=customClassDraft(c,c.customClasses[0].definition.id);
  const other=c.classLevels.find(e=>e.classId==='wizard');other.classId=variant;other.name=variant;
  recompute(c);const before=structuredClone(c);d.policy.family=parent;
  assert.throws(()=>previewCustomClassChange(c,d.definition.id,d),/versions of the same class/);assert.deepEqual(c,before);
  // Historical saves remain readable; only new conflicting choices are refused.
  c.customClasses[0]=d;assert.equal(gestaltClassFamily(variant),parent);assert.equal(gestaltVariantWarnings(c).length,3);
  assert.throws(()=>gestaltLevelSequence(c,c.gestaltProgression),/versions of the same class/);
  assert.doesNotThrow(()=>gestaltLevelSequence(c,c.gestaltProgression,{allowHistoricalFamilyConflicts:true}));
  c.experience=6000;
  assert.throws(()=>previewGestaltLevel(c,{left:d.definition.id,right:variant}),/versions of the same class/);
 }
});
