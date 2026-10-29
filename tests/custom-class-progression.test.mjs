import test from 'node:test';
import assert from 'node:assert/strict';
import {customClassesSchema} from '../lib/custom-class-schema.ts';
import {characterSchema} from '../lib/model.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {classTotals,copyClassFeatures,findClass} from '../lib/classes.ts';
import {recompute} from '../lib/automation.ts';
import {characterGestaltRows,gestaltLevelSequence} from '../lib/gestalt-progression.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {skillLedger,classSkillAt} from '../lib/skill-points.ts';
import {previewGestaltLevel,applyGestaltLevel,gainLevel,levelUpClasses} from '../lib/level-up.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const definition=(id='custom-warden',kind='Supplemental')=>({
 version:1,
 definition:{id,name:'Test Warden',kind,hitDie:8,skillPoints:6,skills:'Hide, Survival, Knowledge (nature)',alignment:'Any',requirements:'',headers:[],source:'Synthetic QA class, not published rules',
  levels:Array.from({length:10},(_,i)=>({level:i+1,bab:Math.floor((i+1)*.75),fort:2+Math.floor((i+1)/2),ref:Math.floor((i+1)/3),will:Math.floor((i+1)/3),special:'Recorded milestone '+(i+1),extra:[]}))},
 policy:{family:id,combinationPrestige:false,bonusProfile:{bab:'medium',fort:'good',ref:'poor',will:'poor'}}});
function make(paired=false){
 const c=createPlayerCharacter({name:'Custom class QA',kind:'Fighter',level:3,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:12,WIS:14,CHA:10},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'fighter',right:'wizard'}))}:{})});
 c.customClasses=[definition()];const entry=c.classLevels.find(e=>e.classId==='fighter');entry.classId='custom-warden';entry.name='Test Warden';
 recompute(c);copyClassFeatures(c);return c;
}

test('custom basic tables persist and supply standard HP, saves, BAB, skill history and feature summaries',async()=>{
 const c=make();assert.equal(c.level,3);assert.equal(c.bab,2);assert.equal(c.hitDice,'3d8');
 assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[3,1,1]);
 assert.equal(c.maxHp,23);assert.equal(skillLedger(c).levels.reduce((n,r)=>n+r.granted,0),48);
 const hide=c.skills.find(s=>s.name==='Hide');assert.ok(hide.classSkill);assert.ok(classSkillAt(c,hide,hitDieSequence(c)[0]));
 assert.match(c.features.find(f=>f.id.startsWith('class-summary-')).description,/Recorded milestone 3/);
 c.hp-=4;c.features.push({id:'daily',name:'Manual class power',kind:'Class feature',description:'Personal note',source:'',max:3,used:2});
 const before=structuredClone(c);classTotals(c.classLevels,c.ancestry,c);skillLedger(c);assert.deepEqual(c,before);
 assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),c);
 assert.equal(findClass('custom-warden'),undefined,'custom data never changes the global catalog');
});

test('gestalt custom tables choose better progression and union skills without advancing the other caster twice',()=>{
 const c=make(true);assert.equal(c.level,3);assert.equal(c.bab,2);assert.equal(c.hitDice,'3d8');
 assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[3,1,3]);
 assert.equal(c.casters[0].level,3);assert.equal(c.customClasses.length,1);
 const row=characterGestaltRows(c)[0];
 for(const name of ['Hide','Spellcraft'])assert.ok(classSkillAt(c,c.skills.find(s=>s.name===name),row),name);
 const before=classTotals(c.classLevels,c.ancestry,c);
 for(const pair of c.gestaltProgression.levels)[pair.left,pair.right]=[pair.right,pair.left];
 assert.deepEqual(classTotals(c.classLevels,c.ancestry,c),before);
 c.gestaltProgression.bonusMethod='fractional-v1';assert.equal(classTotals(c.classLevels,c.ancestry,c).bab,2);
});

test('standard and paired level-up use saved custom tables, preserving damage, ranks and expenditures',async()=>{
 for(const paired of [false,true]){
  const c=make(paired);c.hp-=3;c.experience=6000;
  const skill=c.skills.find(s=>s.name==='Hide');c.automation.history[0].skillRanks[skill.id]=2;recompute(c);
  if(paired)c.casters[0].slots[1].used=2;
  assert.ok(levelUpClasses(c).some(d=>d.id==='custom-warden'));
  const previous=structuredClone(c);
  if(paired){const preview=previewGestaltLevel(c,{left:'custom-warden',right:'wizard'});assert.deepEqual(c,previous);assert.equal(preview.summary.die,8);assert.match(preview.summary.milestones[0].text,/milestone 4/);applyGestaltLevel(c,preview);}
  else gainLevel(c,'custom-warden');
  recompute(c,previous);assert.equal(c.level,4);assert.equal(c.bab,3);assert.equal(c.maxHp-c.hp,3);assert.equal(c.skills.find(s=>s.id===skill.id).ranks,2);
  if(paired){assert.equal(c.casters[0].level,4);assert.equal(c.casters[0].slots[1].used,2);}
  assert.deepEqual(await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c)))),c);
 }
});

test('custom profiles reject catalog collisions, duplicate IDs, incomplete tables and unsupported data without stripping it',()=>{
 assert.ok(customClassesSchema.safeParse([definition()]).success);
 for(const change of [
  d=>d.version=2,d=>d.definition.id='fighter',d=>d.definition.levels[1].level=3,d=>d.definition.levels[2].bab=3,
  d=>d.definition.levels[0].slots=[3,1],d=>d.definition.casting={ability:'INT'},d=>d.policy.bonusProfile.bab='guess',
  d=>d.definition.hitDie=7,d=>d.definition.source='',d=>d.policy.combinationPrestige=true,
 ]){const d=definition();change(d);assert.equal(customClassesSchema.safeParse([d]).success,false);}
 assert.equal(customClassesSchema.safeParse([definition(),definition()]).success,false);
 const c=make(true);delete c.customClasses;assert.equal(characterSchema.safeParse(c).success,false,'missing definitions never silently drop a side');
});

test('saved families and prestige status enforce pairing restrictions and complete source confirmation',()=>{
 const c=make(true);c.experience=6000;const d=definition('custom-order','Prestige');d.policy.combinationPrestige=true;d.definition.requirements='Base attack bonus: +1\n\nSpecial: Complete the whole source ritual';c.customClasses.push(d);
 const q=prestigeEligibility(c,d.definition);assert.equal(q.eligible,false);assert.match(q.requirements[0].label,/whole source ritual/);
 assert.throws(()=>previewGestaltLevel(c,{left:d.definition.id,right:'wizard',approvals:[{classId:d.definition.id,gm:'QA GM',reason:'QA approval'}]}),/prerequisites/);
 c.prerequisiteConfirmations[q.requirements[0].key]=true;
 assert.throws(()=>previewGestaltLevel(c,{left:d.definition.id,right:'wizard'}),/named GM approval/);
 const preview=previewGestaltLevel(c,{left:d.definition.id,right:'wizard',approvals:[{classId:d.definition.id,gm:'QA GM',reason:'QA approval'}]});
 assert.equal(preview.character.level,4);assert.equal(preview.character.customClasses.length,2);
 assert.throws(()=>gestaltLevelSequence(c,c.gestaltProgression,{policies:{'custom-warden':{family:'changed'}}}),/saved custom/);
 c.customClasses[0].policy.family='wizard';assert.throws(()=>characterGestaltRows(c),/versions of the same class/);
 c.customClasses[0].policy.family='custom-warden';
 const custom2=definition('custom-other','Prestige');c.customClasses[0].definition.kind='Prestige';c.customClasses.push(custom2);
 c.classLevels.find(e=>e.classId==='wizard').classId='custom-other';assert.throws(()=>characterGestaltRows(c),/two prestige/);
});

test('complete custom prerequisites retain long confirmations and require review again after source changes',()=>{
 const c=make(true),d=definition('custom-long','Prestige');d.definition.requirements='Requirement '.repeat(150);c.customClasses.push(d);
 const q=prestigeEligibility(c,d.definition);c.prerequisiteConfirmations[q.requirements[0].key]=true;
 const loaded=characterSchema.parse(JSON.parse(JSON.stringify(c)));
 assert.equal(prestigeEligibility(loaded,loaded.customClasses[1].definition).eligible,true);
 loaded.customClasses[1].definition.requirements+='Changed';
 assert.equal(prestigeEligibility(loaded,loaded.customClasses[1].definition).eligible,false);
});

test('legacy manual custom classes stay manual, with no invented profile or stats',async()=>{
 const c=createPlayerCharacter({name:'Legacy custom QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},method:'manual'});
 c.automation.enabled=false;c.classLevels=[{id:'legacy',classId:'custom-old',name:'Old custom class',level:7,notes:'Keep source notes'}];c.classes='Old custom class 7';c.level=7;c.bab=5;c.hp=19;c.maxHp=31;
 assert.equal('customClasses' in characterSchema.parse(c),false);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
 assert.equal(loaded.bab,5);assert.equal(loaded.hp,19);assert.equal(loaded.maxHp,31);assert.equal(loaded.classLevels[0].notes,'Keep source notes');assert.equal('customClasses' in loaded,false);
});

test('custom tables survive the browser store, native export and a fresh client without a global registry',async()=>{
 const values=new Map();let sequence=0;
 const options={scope:'/custom-profile-qa/',storage:()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}),lock:(_name,fn)=>fn(),id:()=>String(++sequence),now:()=> '2026-10-29T00:00:00.000Z'};
 const api=createBrowserCharacterApi(options),c=make(true);c.hp-=2;c.casters[0].slots[1].used=1;
 const row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const reopened=createBrowserCharacterApi(options),saved=await reopened('/api/characters/'+row.id);
 assert.deepEqual(saved.data,c);
 const imported=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:saved.data})));
 const copy=await reopened('/api/characters',{method:'POST',body:JSON.stringify({data:imported})});
 assert.notEqual(copy.id,row.id);assert.deepEqual((await reopened('/api/characters/'+copy.id)).data,c);assert.equal(findClass('custom-warden'),undefined);
});
