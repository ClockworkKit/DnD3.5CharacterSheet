import test from 'node:test';
import assert from 'node:assert/strict';
import {createReviewedCharacter,startingAlignmentEligibility,startingAlignmentContext} from '../lib/reviewed-character-creation.ts';
import {classAlignmentEligibility} from '../lib/class-alignment.ts';
import {findClass} from '../lib/classes.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {customClassDraft,customClassTable} from '../lib/custom-class-editor.ts';
import {recordAdvancementChoice} from '../lib/advancement-choices.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
const options={name:'Creation alignment QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:12},method:'manual',hpMethod:'average'};
const review=(alignment='',deity='')=>({alignment,deity,prerequisiteConfirmations:{}});
const confirm=(opts,context)=>{for(const r of startingAlignmentEligibility(opts,context).requirements)if(r.state==='confirm')context.prerequisiteConfirmations[r.key]=true;};
const paired=(pairs)=>({...options,advancementMode:'gestalt',level:pairs.length,gestaltPairs:pairs.map(([left,right])=>({left,right}))});

test('guided standard creation accepts unrestricted classes and requires valid alignment or an explicit exception for restricted ones',()=>{
 const fighter=createReviewedCharacter(options,review());assert.equal(fighter.alignment,'');assert.equal(fighter.advancementMode,'standard');assert.equal(fighter.gear.length,0);
 const barbarian={...options,kind:'Barbarian'},blank=review();
 assert.equal(startingAlignmentEligibility(barbarian,blank).requirements[0].state,'missing');
 confirm(barbarian,blank);assert.throws(()=>createReviewedCharacter(barbarian,blank),/alignment/);
 const lawful=review('LG'),before=structuredClone(lawful);
 assert.throws(()=>createReviewedCharacter(barbarian,lawful),/House rule/);assert.deepEqual(lawful,before);
 assert.equal(createReviewedCharacter(barbarian,review(' CG ')).alignment,'CG');
 confirm(barbarian,lawful);const c=createReviewedCharacter(barbarian,lawful);
 assert.equal(c.alignment,'LG');assert.equal(c.classLevels[0].level,1);
 assert.equal(classAlignmentEligibility(c,findClass('barbarian')).eligible,false,'creation approval is not next-level approval');
});

test('starting review checks every paired row and both sides, including a later alignment conflict',()=>{
 for(const pairs of [[['fighter','wizard'],['monk','wizard']],[['wizard','fighter'],['wizard','monk']]]){
  const opts=paired(pairs),context=review('CG'),original=structuredClone(opts);
  const result=startingAlignmentEligibility(opts,context);assert.equal(result.eligible,false);
  assert.match(result.requirements.find(r=>r.state==='confirm').label,/Monk 1/);
  assert.throws(()=>createReviewedCharacter(opts,context),/Monk/);
  assert.deepEqual(opts,original);assert.equal(startingAlignmentEligibility(opts,review('LG')).eligible,true);
 }
 const valid=paired([['barbarian','warlock']]);assert.equal(createReviewedCharacter(valid,review('CG')).level,1);
 const invalid=paired([['fighter','fighter']]);assert.equal(startingAlignmentEligibility(invalid,review()).eligible,false);
 assert.throws(()=>createReviewedCharacter(invalid,review()),/different classes/);
});

test('high-level creation approvals cover each affected class level and omit discarded or future confirmations',()=>{
 const opts={...options,kind:'Monk',level:3},context=review('NG');
 const result=startingAlignmentEligibility(opts,context);assert.equal(result.requirements.length,3);
 confirm(opts,context);assert.equal(startingAlignmentEligibility(opts,context).eligible,true);
 const higher={...opts,level:4};assert.equal(startingAlignmentEligibility(higher,context).eligible,false);
 confirm(higher,context);context.prerequisiteConfirmations['unrelated-draft']=true;
 const c=createReviewedCharacter(opts,context);assert.equal(Object.keys(c.prerequisiteConfirmations).length,3);
 assert.equal(classAlignmentEligibility(c,findClass('monk')).eligible,false);
 context.alignment='CG';assert.equal(startingAlignmentEligibility(opts,context).eligible,false);
});

test('cleric source review records the final deity, deduplicates across levels and persists for later advancement',()=>{
 for(const opts of [{...options,kind:'Cleric',level:2},paired([['fighter','cleric'],['wizard','cleric']])]){
  const context=review('LG','Test deity');assert.equal(startingAlignmentEligibility(opts,context).requirements.filter(r=>r.state==='confirm').length,1);
  confirm(opts,context);context.deity='Changed deity';assert.equal(startingAlignmentEligibility(opts,context).eligible,false);
  context.deity='Test deity';const c=createReviewedCharacter(opts,context);
  assert.equal(c.deity,'Test deity');assert.equal(c.alignment,'LG');assert.equal(classAlignmentEligibility(c,findClass('cleric')).eligible,true);
  const specialty={...opts,clericSpecialty:'axe-brother'};
  assert.equal(startingAlignmentEligibility(specialty,context).eligible,false);
  assert.equal(startingAlignmentContext(specialty,context).deity,'Clangeddin Silverbeard');
  confirm(specialty,context);const brother=createReviewedCharacter(specialty,context);
  assert.equal(brother.deity,'Clangeddin Silverbeard');assert.equal(brother.clericSpecialty,'axe-brother');
  assert.equal(classAlignmentEligibility(brother,findClass('cleric')).eligible,true);
 }
});

test('NPC and custom-class creation use the same declared restrictions and changed source rules invalidate review',()=>{
 const draft=customClassDraft(createPlayerCharacter(options));
 Object.assign(draft.definition,{id:'custom-alignment',name:'Alignment order',source:'Synthetic class source',alignment:'Any lawful and accepted by the order'});
 draft.policy.family=draft.definition.id;const profile=customClassTable(draft,20);
 const opts={...options,kind:profile.definition.id,customClasses:[profile]},context=review('LG');
 assert.throws(()=>createReviewedCharacter(opts,context,'npc'),/complete class source/);
 confirm(opts,context);const c=createReviewedCharacter(opts,context,'npc');
 assert.equal(c.sheetKind,'npc');assert.equal(c.alignment,'LG');assert.deepEqual(c.customClasses,[profile]);
 profile.definition.alignment='Lawful good and accepted by the changed order';
 assert.equal(startingAlignmentEligibility(opts,context).eligible,false);
});

test('racial Hit Dice do not create extra alignment approvals and invalid starting classes fail explicitly',()=>{
 const opts={...paired([['monk','wizard']]),raceId:'gnoll'},context=review('CG');
 assert.equal(startingAlignmentEligibility(opts,context).requirements.filter(r=>r.state==='confirm').length,1);
 confirm(opts,context);const c=createReviewedCharacter(opts,context);assert.equal(c.level,3);
 assert.equal(Object.keys(c.prerequisiteConfirmations).length,1);
 for(const invalid of [{...options,kind:'missing'},{...options,level:0},{...options,level:21},{...options,kind:'Assassin'},{...paired([['fighter','wizard']]),gestaltPairs:[]}]){
  assert.equal(startingAlignmentEligibility(invalid,review()).eligible,false);
  assert.throws(()=>createReviewedCharacter(invalid,review()));
 }
});

test('reviewed creation saves and legacy imports preserve later ability choices, damage and spell expenditure',async()=>{
 const opts=paired(Array.from({length:4},()=>['monk','wizard'])),context=review('CG');confirm(opts,context);
 const c=createReviewedCharacter(opts,context);recordAdvancementChoice(c,'ability-1','INT',true);recompute(c);c.hp-=3;c.casters[0].slots[1].used=1;
 const native=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(native,c);
 const values=new Map(),config={scope:'/creation-alignment-qa/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_key,fn)=>fn()};
 const saved=await createBrowserCharacterApi(config)('/api/characters',{method:'POST',body:JSON.stringify({data:native})});
 const loaded=await prepareCharacter((await createBrowserCharacterApi(config)('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);
 const legacy=structuredClone(c);legacy.alignment='';legacy.prerequisiteConfirmations={};
 assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:legacy}))),legacy,'legacy load never invokes creation validation');
});
