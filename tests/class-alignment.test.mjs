import test from 'node:test';
import assert from 'node:assert/strict';
import {classAlignmentEligibility,normalizedAlignment} from '../lib/class-alignment.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findClass} from '../lib/classes.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
const create=(paired=false,alignment='Lawful Good')=>{
 const c=createPlayerCharacter({name:'Alignment QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:12},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:[{left:'fighter',right:'wizard'}]}:{})});
 c.alignment=alignment;c.experience=10000;return c;
};
const eligibility=(c,id)=>classAlignmentEligibility(c,findClass(id));
const confirm=(c,id)=>{for(const r of eligibility(c,id).requirements)if(r.state==='confirm')c.prerequisiteConfirmations[r.key]=true;};

test('core alignment rules distinguish the nine alignments and canonical abbreviations',()=>{
 const all=['LG','NG','CG','LN','TN','CN','LE','NE','CE'];
 const expected={barbarian:['NG','CG','TN','CN','NE','CE'],bard:['NG','CG','TN','CN','NE','CE'],monk:['LG','LN','LE'],paladin:['LG'],druid:['NG','LN','TN','CN','NE']};
 for(const [id,allowed] of Object.entries(expected))for(const value of all){
  assert.equal(eligibility(create(false,value),id).eligible,allowed.includes(value),id+' '+value);
 }
 assert.equal(normalizedAlignment(' Neutral '),'true neutral');assert.equal(normalizedAlignment('Lawful-Good'),'lawful good');
 assert.equal(normalizedAlignment('usually lawful good'),null);
});

test('standard and paired advancement reject invalid alignment atomically, including further levels in an existing class',()=>{
 for(const paired of [false,true]){
  const c=create(paired);c.hp-=3;if(paired)c.casters[0].slots[1].used=1;
  const before=structuredClone(c);
  assert.throws(()=>paired?previewGestaltLevel(c,{left:'barbarian',right:'wizard'}):gainLevel(c,'barbarian'),/alignment requirement/);
  assert.deepEqual(c,before);
  c.alignment='Chaotic Good';
  if(paired){const old=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left:'bard',right:'wizard'}));recompute(c,old);}
  else {const old=structuredClone(c);gainLevel(c,'bard');recompute(c,old);}
  assert.equal(c.level,2);assert.equal(c.maxHp-c.hp,3);
  c.alignment='Lawful Good';const after=structuredClone(c);
  assert.throws(()=>paired?previewGestaltLevel(c,{left:'bard',right:'wizard'}):gainLevel(c,'bard'),/alignment requirement/);
  assert.deepEqual(c,after);
 }
});

test('blank alignment requires an entry and unrecognized wording requires review without keyword guessing',()=>{
 const c=create(false,'');assert.equal(eligibility(c,'fighter').eligible,true);
 assert.equal(eligibility(c,'monk').requirements[0].state,'missing');confirm(c,'monk');assert.equal(eligibility(c,'monk').eligible,false);
 c.alignment='Devoted to order';const review=eligibility(c,'monk');
 assert.equal(review.eligible,false);assert.equal(review.requirements[0].state,'confirm');
 confirm(c,'monk');assert.equal(eligibility(c,'monk').eligible,true);
 c.alignment='Devoted to chaos';assert.equal(eligibility(c,'monk').eligible,false);
 const custom={...findClass('fighter'),id:'custom-rule',alignment:'Any good except members of the order.'};
 c.alignment='NG';assert.equal(classAlignmentEligibility(c,custom).eligible,false);
 assert.match(classAlignmentEligibility(c,custom).requirements[0].label,/complete class source/);
});

test('cleric deity checks remain explicit and are invalidated by alignment, deity or source-rule changes',()=>{
 const c=create(false,'NG');c.deity='Test deity';
 assert.equal(eligibility(c,'cleric').eligible,false);confirm(c,'cleric');
 assert.equal(eligibility(c,'cleric').eligible,true);
 gainLevel(c,'cleric');recompute(c);assert.equal(eligibility(c,'cleric').eligible,true);
 c.deity='Different deity';assert.equal(eligibility(c,'cleric').eligible,false);
 c.deity='Test deity';c.alignment='CG';assert.equal(eligibility(c,'cleric').eligible,false);
 c.alignment='NG';const rule={...findClass('cleric'),alignment:'Lawful good.'};
 assert.equal(classAlignmentEligibility(c,rule).eligible,false);
});

test('approved alignment exceptions apply only to that class level and survive native saves',async()=>{
 const c=create(true);c.hp-=3;c.casters[0].slots[1].used=1;
 const requirement=eligibility(c,'barbarian').requirements[0];assert.match(requirement.label,/House rule/);
 confirm(c,'barbarian');assert.equal(eligibility(c,'barbarian').eligible,true);assert.equal(eligibility(c,'bard').eligible,false);
 const old=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left:'barbarian',right:'wizard'}));recompute(c,old);
 assert.equal(c.level,2);assert.equal(c.maxHp-c.hp,3);assert.equal(c.casters[0].slots[1].used,1);
 assert.equal(eligibility(c,'barbarian').eligible,false);
 assert.equal(c.prerequisiteConfirmations[requirement.key],true);
 const restored=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));
 assert.deepEqual(restored,c);
});

test('changing alignment or clearing a ruling makes a pending paired review stale',()=>{
 const c=create(true,'CG'),p=previewGestaltLevel(c,{left:'barbarian',right:'wizard'});
 c.alignment='LG';const before=structuredClone(c);
 assert.throws(()=>applyGestaltLevel(c,p),/changed/);assert.deepEqual(c,before);
 confirm(c,'barbarian');const reviewed=previewGestaltLevel(c,{left:'barbarian',right:'wizard'});
 for(const r of eligibility(c,'barbarian').requirements)if(r.key)delete c.prerequisiteConfirmations[r.key];
 assert.throws(()=>applyGestaltLevel(c,reviewed),/changed/);
});

test('load preserves historical alignment conflicts and manual settings rather than changing old levels',async()=>{
 const c=create(true);c.classLevels[0].classId='barbarian';c.classLevels[0].name='Barbarian';
 recompute(c);c.hp-=3;c.casters[0].slots[1].used=1;c.automation.hpMethod='maximum';recompute(c);
 const expected=structuredClone(c);
 const restored=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));
 assert.deepEqual(restored,expected);assert.equal(restored.alignment,'Lawful Good');assert.equal(restored.classLevels[0].level,1);
});
