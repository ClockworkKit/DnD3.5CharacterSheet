import {withFixtureAlignment} from './alignment-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {gainLevel,levelUpStatus,levelUpClasses} from '../lib/level-up.ts';
import {standardCastingChoices} from '../lib/gestalt-casting.ts';
import {recompute,calculationWarnings} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {hitDieSequence} from '../lib/level-history.ts';
const create=(extra={})=>withFixtureAlignment(createPlayerCharacter({name:'XP test',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual',...extra}));
const gain=(c,id,roll)=>{const previous=structuredClone(c);gainLevel(c,id,roll);recompute(c,previous)};
test('30000 XP offers advancement through level 8, retains XP, damage and history',()=>{
 const c=create();c.experience=30000;c.hp-=3;assert.equal(levelUpStatus(c).eligible,8);
 for(let level=2;level<=8;level++){gain(c,'fighter',5);assert.equal(c.level,level);assert.equal(c.maxHp-c.hp,3);assert.equal(c.automation.history.length,level);}
 assert.equal(c.experience,30000);assert.equal(levelUpStatus(c).available,0);assert.throws(()=>gain(c,'fighter'));assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});
test('XP threshold uses effective level and respects ignored LA',()=>{
 const c=create();c.ancestry.levelAdjustment=2;c.ancestry.ignoreLevelAdjustment=false;c.experience=5999;assert.equal(levelUpStatus(c).available,0);c.experience=6000;assert.equal(levelUpStatus(c).available,1);c.ancestry.ignoreLevelAdjustment=true;assert.equal(levelUpStatus(c).eligible,4);
});
test('multiclass advancement appends a class, initializes casting and preserves spent slots',()=>{
 const c=create();c.experience=3000;gain(c,'wizard',2);assert.equal(c.classLevels.length,2);assert.equal(c.casters.length,1);c.casters[0].slots[0].used=1;gain(c,'wizard',2);assert.equal(c.classLevels.length,2);assert.equal(c.casters[0].level,2);assert.equal(c.casters[0].slots[0].used,1);
});
test('recorded HP rolls validate before mutation and grant only the rolled die plus CON',()=>{
 const c=create();c.experience=1000;c.automation.hpMethod='rolled';const before=structuredClone(c);assert.throws(()=>gain(c,'fighter',11));assert.deepEqual(c,before);gain(c,'fighter',3);assert.equal(c.maxHp,before.maxHp+5);assert.equal(c.automation.history.at(-1).hitDieRoll,3);
});
test('insufficient XP, manual mode and unsupported class levels cannot advance',()=>{
 const c=create();assert.throws(()=>gain(c,'fighter'));c.experience=30000;c.automation.enabled=false;assert.throws(()=>gain(c,'fighter'));c.automation.enabled=true;assert.throws(()=>gain(c,'unknown'));const max=create({level:20});max.experience=300000;assert.throws(()=>gain(max,'fighter'));
});

test('alternate cleric Hit Die is honored at level-up without changing standard or specialty clerics',()=>{
 const c=create({kind:'Cleric'});
 configureAlternateFeature(c,'cleric-golarion-cleric',{reviewed:true});selectAlternateFeature(c,'cleric-golarion-cleric',true);recompute(c);
 c.experience=1000;c.hp-=3;c.casters[0].slots[1].used=1;const before=structuredClone(c);
 assert.equal(levelUpClasses(c).find(d=>d.id==='cleric').hitDie,10,'UI selection uses the same die as advancement');
 assert.throws(()=>gainLevel(c,'cleric',11),/valid roll/);assert.deepEqual(c,before);
 gain(c,'cleric',10);
 assert.equal(c.maxHp,before.maxHp+12);assert.equal(c.maxHp-c.hp,3);assert.equal(c.hitDice,'2d10');assert.equal(hitDieSequence(c)[1].die,10);assert.equal(c.automation.history[1].hitDieRoll,10);assert.equal(c.casters[0].slots[1].used,1);
 for(const specialty of ['none','axe-brother']){
  const ordinary=create({kind:'Cleric',clericSpecialty:specialty});ordinary.experience=1000;const original=structuredClone(ordinary);
  assert.equal(levelUpClasses(ordinary).find(d=>d.id==='cleric').hitDie,8);
  assert.throws(()=>gainLevel(ordinary,'cleric',9),/valid roll/);assert.deepEqual(ordinary,original);
  gain(ordinary,'cleric',8);assert.equal(ordinary.hitDice,'2d8');assert.equal(ordinary.maxHp,original.maxHp+10);
 }
});

test('standard Mystic Theurge records each eligible prior tradition per level and retains legacy allocations',()=>{
 const c=create({kind:'Wizard',level:3,hpMethod:'average'});c.experience=1000000;
 for(const id of ['sorcerer','cleric','cleric','cleric'])gain(c,id);
 // A saved Mystic Theurge with one older, class-wide arcane grant.
 const legacy={id:'old-theurge',classId:'mystic-theurge',name:'Mystic Theurge',level:1,notes:'Keep campaign notes',castingTarget:c.casters[0].id};
 c.classLevels.push(legacy);recompute(c);
 const wizard=c.casters.find(p=>p.name==='Wizard'),sorcerer=c.casters.find(p=>p.name==='Sorcerer'),cleric=c.casters.find(p=>p.name==='Cleric');
 wizard.slots[1].used=1;c.hp-=3;
 gain(c,'druid');
 const choices=standardCastingChoices(c,legacy.classId);
 assert.deepEqual(choices.map(q=>q.candidates.map(p=>p.name)),[['Wizard','Sorcerer'],['Cleric']]);
 const snapshot=structuredClone(c);
 assert.throws(()=>gainLevel(c,legacy.classId,undefined,[{classId:legacy.classId,kind:'divine',traditionId:c.casters.find(p=>p.name==='Druid').id}]),/eligible/);
 assert.deepEqual(c,snapshot);
 gainLevel(c,legacy.classId,undefined,[{classId:legacy.classId,kind:'spell',traditionId:sorcerer.id}]);recompute(c,snapshot);
 assert.deepEqual(legacy.castingAdvances,[{level:2,kind:'spell',traditionId:sorcerer.id},{level:2,kind:'divine',traditionId:cleric.id}]);
 assert.deepEqual([wizard.level,sorcerer.level,cleric.level],[4,2,5]);
 const previous=structuredClone(c);gainLevel(c,legacy.classId,undefined,[{classId:legacy.classId,kind:'spell',traditionId:wizard.id}]);recompute(c,previous);
 const loaded=characterSchema.parse(JSON.parse(JSON.stringify(c)));recompute(loaded);
 assert.deepEqual(loaded.casters.map(p=>[p.name,p.level]),[['Wizard',5],['Sorcerer',2],['Cleric',6],['Domain',6],['Druid',1]]);
 assert.equal(loaded.casters[0].slots[1].used,1);assert.equal(loaded.maxHp-loaded.hp,3);
 assert.deepEqual(loaded.classLevels.find(e=>e.id===legacy.id),legacy);
 assert.ok(!calculationWarnings(loaded).some(w=>w.startsWith('Mystic Theurge: choose')));
});

test('first catalog prestige entry requires an arcane choice and records the sole divine target automatically',()=>{
 const c=create({kind:'Wizard',level:3,hpMethod:'average'});c.experience=1000000;
 for(const id of ['sorcerer','cleric','cleric','cleric'])gain(c,id);
 for(const name of ['Knowledge (arcana)','Knowledge (religion)']){
  const skill=c.skills.find(s=>s.name===name);c.automation.history[0].skillRanks[skill.id]=4;c.automation.history[1].skillRanks[skill.id]=1;c.automation.history[2].skillRanks[skill.id]=1;
 }
 recompute(c);
 const before=structuredClone(c);
 assert.throws(()=>gainLevel(c,'mystic-theurge'),/Choose Mystic Theurge: advance arcane/);assert.deepEqual(c,before);
 gainLevel(c,'mystic-theurge',undefined,[{classId:'mystic-theurge',kind:'spell',traditionId:c.casters[0].id}]);recompute(c,before);
 assert.deepEqual(c.casters.map(p=>p.level),[4,1,4,4]);
 assert.ok(!calculationWarnings(c).some(w=>w.startsWith('Mystic Theurge: choose')));
 const entry=c.classLevels.at(-1);delete entry.castingAdvances;
 assert.ok(calculationWarnings(c).some(w=>w.startsWith('Mystic Theurge: choose')));
});
