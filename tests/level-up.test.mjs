import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {gainLevel,levelUpStatus,levelUpClasses} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {hitDieSequence} from '../lib/level-history.ts';
const create=(extra={})=>createPlayerCharacter({name:'XP test',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual',...extra});
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
