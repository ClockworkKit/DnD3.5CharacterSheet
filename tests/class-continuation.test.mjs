import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {createReviewedCharacter,startingAlignmentEligibility} from '../lib/reviewed-character-creation.ts';
import {classContinuationEligibility,classOrderKeys,recordedStandardClassOrder} from '../lib/class-continuation.ts';
import {findClass} from '../lib/classes.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const options={name:'Continuation QA',kind:'Monk',level:1,raceId:'human',method:'manual',hpMethod:'average',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:14}};
const create=(extra={})=>{const c=createPlayerCharacter({...options,...extra});c.alignment='LG';c.experience=100000;return c};
const check=(c,id='monk')=>classContinuationEligibility(c,findClass(id));
const confirm=(c,id='monk')=>{for(const r of check(c,id).requirements)if(r.key)c.prerequisiteConfirmations[r.key]=true};
const advance=(c,id)=>{const old=structuredClone(c);gainLevel(c,id);recompute(c,old)};
const pairs=(rows)=>({advancementMode:'gestalt',level:rows.length,gestaltPairs:rows.map(([left,right])=>({left,right}))});
const pairedAdvance=(c,left,right)=>{const old=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left,right}));recompute(c,old)};

test('recorded standard Monk and Paladin returns reject atomically after another class',()=>{
 for(const [kind,id] of [['Monk','monk'],['Paladin','paladin']]){
  const c=create({kind});c.hp-=3;advance(c,'fighter');
  assert.deepEqual(recordedStandardClassOrder(c),[[id],['fighter']]);
  const before=structuredClone(c);assert.throws(()=>gainLevel(c,id),/continuation requirement/);assert.deepEqual(c,before);
  assert.match(check(c,id).requirements[0].label,/cannot normally resume after fighter/);
  assert.equal(c.maxHp-c.hp,3);
 }
});

test('starting other classes before Monk and uninterrupted continuation keep their recorded order',()=>{
 const c=create({kind:'Fighter'});advance(c,'monk');advance(c,'monk');
 assert.deepEqual(recordedStandardClassOrder(c),[['fighter'],['monk'],['monk']]);assert.equal(check(c).eligible,true);
 const recorded=[...c.classAdvancementOrder];
 c.classLevels.find(e=>e.classId==='fighter').level++;recompute(c);
 assert.equal(recordedStandardClassOrder(c),null);assert.equal(check(c).eligible,false);
 assert.deepEqual(c.classAdvancementOrder,recorded,'manual edits do not overwrite old provenance');
});

test('legacy mixed classes request source/history review rather than inventing chronology on load',async()=>{
 const c=create({kind:'Fighter'});advance(c,'monk');delete c.classAdvancementOrder;
 const before=structuredClone(c);await prepareCharacter(c);assert.deepEqual(c,before);
 assert.match(check(c).requirements[0].label,/no verified class order/);
 assert.throws(()=>gainLevel(c,'monk'),/continuation/);assert.deepEqual(c,before);
 confirm(c);advance(c,'monk');assert.equal(c.classAdvancementOrder,undefined);
 assert.equal(check(c).eligible,false,'legacy confirmation is scoped to one new class level');
});

test('Illumian and Psionic Fist exceptions do not waive unrelated restrictions',()=>{
 for(const kind of ['Monk','Paladin']){
  const c=create({kind,raceId:'illumian'});advance(c,'fighter');advance(c,kind.toLowerCase());
  assert.equal(check(c,kind.toLowerCase()).eligible,true);
 }
 const c=create({level:6});
 c.classLevels.push({id:'pf',classId:'psionic-fist',name:'Psionic Fist',level:1,notes:''});
 recompute(c);c.classAdvancementOrder=classOrderKeys(c);
 const order=c.classAdvancementOrder;delete c.classAdvancementOrder;assert.equal(check(c).eligible,true,'only Monk/Psionic Fist needs no inferred order');c.classAdvancementOrder=order;
 assert.equal(check(c).eligible,true);advance(c,'monk');advance(c,'fighter');
 assert.equal(check(c).eligible,false,'Psionic Fist is not permission for a Fighter detour');
});

test('exception confirmations are per level and change when recorded source evidence changes',()=>{
 const c=create();advance(c,'fighter');const before=structuredClone(c);
 confirm(c);assert.equal(check(c).eligible,true);
 c.features.push({id:'qa-source',name:'Exceptional training',kind:'Feat',description:'Needs source review',max:0,used:0,source:''});
 assert.equal(check(c).eligible,false);confirm(c);advance(c,'monk');
 assert.equal(check(c).eligible,false);assert.equal(c.level,before.level+1);
 const key=check(c).requirements[0].key;assert.ok(key.length<4000);characterSchema.parse(c);
});

test('gestalt continues a restricted class on either side but a gap requires prospective review',()=>{
 const c=create(pairs([['monk','wizard'],['fighter','monk']]));
 assert.equal(check(c).eligible,true);pairedAdvance(c,'wizard','monk');
 pairedAdvance(c,'fighter','wizard');const before=structuredClone(c);
 assert.equal(check(c).eligible,false);
 assert.throws(()=>previewGestaltLevel(c,{left:'monk',right:'wizard'}),/continuation/);assert.deepEqual(c,before);
 confirm(c);pairedAdvance(c,'monk','wizard');assert.equal(c.level,5);assert.equal(check(c).eligible,false);
});

test('gestalt review policy is persisted, invalidates prior approvals and never rewrites earned levels',async()=>{
 const c=create(pairs([['monk','wizard'],['monk','wizard']]));
 const before=structuredClone(c);c.gestaltContinuationRule='review';
 assert.equal(check(c).eligible,false);assert.match(check(c).requirements[0].label,/gestalt.*interaction/);
 confirm(c);assert.equal(check(c).eligible,true);
 const restored=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));assert.deepEqual(restored,c);
 c.gestaltContinuationRule='continuous';assert.equal(check(c).eligible,true);
 assert.deepEqual(c.classLevels,before.classLevels);assert.deepEqual(c.automation.history,before.automation.history);
});

test('higher-level paired creation reviews class returns before constructing or rolling the character',()=>{
 const opts={...options,...pairs([['monk','wizard'],['fighter','wizard'],['monk','wizard']])};
 const review={alignment:'LG',deity:'',prerequisiteConfirmations:{}};
 const result=startingAlignmentEligibility(opts,review);
 assert.equal(result.eligible,false);assert.throws(()=>createReviewedCharacter(opts,review),/cannot normally resume/);
 for(const r of result.requirements)if(r.key)review.prerequisiteConfirmations[r.key]=true;
 const c=createReviewedCharacter(opts,review);assert.equal(c.level,3);
 assert.equal(check(c).eligible,false,'starting exception does not approve the next level');
 assert.equal(startingAlignmentEligibility({...opts,raceId:'illumian'},{...review,prerequisiteConfirmations:{}}).eligible,true);
});

test('recorded history and continuation review preserve advancement, skill purchases, injury and spent slots through storage',async()=>{
 const c=create({kind:'Wizard',level:4});c.hp-=4;c.casters[0].slots[1].used=1;
 c.advancementChoices['ability-1']='DEX';c.scores.DEX++;
 c.automation.history[0].skillRanks[c.skills[0].id]=2;recompute(c);
 advance(c,'monk');advance(c,'fighter');confirm(c);
 const before=structuredClone(c),values=new Map();
 const api=createBrowserCharacterApi({scope:'continuation',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify((await api('/api/characters/'+row.id)).data)));
 assert.deepEqual(loaded,before);advance(loaded,'monk');
 assert.equal(loaded.maxHp-loaded.hp,4);assert.equal(loaded.casters[0].slots[1].used,1);
 assert.deepEqual(loaded.advancementChoices,before.advancementChoices);
 assert.deepEqual(loaded.automation.history.slice(0,before.automation.history.length),before.automation.history);
});

test('unrestricted class advancement does not require interpreting an unrelated old mixed history',()=>{
 const c=create();advance(c,'fighter');delete c.classAdvancementOrder;
 assert.equal(check(c,'fighter').eligible,true);advance(c,'fighter');
 assert.equal(c.classAdvancementOrder,undefined);
});
