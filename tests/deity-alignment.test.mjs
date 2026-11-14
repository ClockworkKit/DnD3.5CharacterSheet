import test from 'node:test';
import assert from 'node:assert/strict';
import {alignmentCodes} from '../lib/alignment-values.ts';
import {classAlignmentEligibility} from '../lib/class-alignment.ts';
import {deityAlignmentValue} from '../lib/deity-alignment.ts';
import {findClass} from '../lib/classes.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {createReviewedCharacter,startingAlignmentEligibility} from '../lib/reviewed-character-creation.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
const options={name:'Deity alignment QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:16},method:'manual',hpMethod:'average'};
const create=(paired=false)=>{const c=createPlayerCharacter({...options,...(paired?{advancementMode:'gestalt',gestaltPairs:[{left:'fighter',right:'wizard'}]}:{})});c.experience=6000;return c;};
const context=(alignment='LG',patron='LG')=>({alignment,deity:'Synthetic deity',prerequisiteConfirmations:{},...(patron?{deityAlignment:{deity:'Synthetic deity',alignment:patron}}:{})});
const check=(c,id)=>classAlignmentEligibility(c,findClass(id));
const confirm=(c,id)=>{for(const r of check(c,id).requirements)if(r.state==='confirm')c.prerequisiteConfirmations[r.key]=true;};

test('cleric and divine mind apply distinct source restrictions across all 81 recorded relationships',()=>{
 const cleric={LG:['LG','NG','LN'],NG:['LG','NG','CG'],CG:['NG','CG','CN'],LN:['LG','LN','LE'],TN:['NG','LN','TN','CN','NE'],CN:['CG','CN','CE'],LE:['LN','LE','NE'],NE:['LE','NE','CE'],CE:['CN','NE','CE']};
 const divine={LG:['LG','NG','LN','TN'],NG:['LG','NG','CG','LN','TN','CN'],CG:['NG','CG','TN','CN'],LN:['LG','NG','LN','TN','LE','NE'],TN:[...alignmentCodes],CN:['NG','CG','TN','CN','NE','CE'],LE:['LN','TN','LE','NE'],NE:['LN','TN','CN','LE','NE','CE'],CE:['TN','CN','NE','CE']};
 for(const deity of alignmentCodes)for(const alignment of alignmentCodes){
  const c={...create(),...context(alignment,deity)};
  assert.equal(check(c,'cleric').eligible,cleric[deity].includes(alignment),'Cleric '+alignment+' / '+deity);
  assert.equal(check(c,'divine-mind').eligible,divine[deity].includes(alignment),'Divine Mind '+alignment+' / '+deity);
  assert.equal(check(c,'favored-soul').eligible,alignment!=='TN'||deity==='TN','Favored Soul '+alignment+' / '+deity);
 }
});

test('deity-free clerics remain supported while favored souls and divine minds require a recorded patron',()=>{
 for(const alignment of alignmentCodes){const c={...create(),...context(alignment,'')};c.deity='';
  assert.equal(check(c,'cleric').eligible,true);
  for(const id of ['favored-soul','divine-mind']){assert.equal(check(c,id).requirements[0].state,'missing');confirm(c,id);assert.equal(check(c,id).eligible,false);}
 }
 const c={...create(),...context('TN','')};assert.equal(check(c,'divine-mind').eligible,true);
 c.alignment='LG';assert.equal(check(c,'favored-soul').eligible,true,'do not invent a one-step constraint from descriptive prose');
});

test('unknown deity alignment uses explicit source review, preserves old cleric confirmation and ignores mismatched patron records',()=>{
 const c={...create(),...context('LG','')},definition=findClass('cleric');
 const oldKey='class-alignment:'+JSON.stringify(['cleric',0,'LG',c.deity,definition.alignment]);
 c.prerequisiteConfirmations[oldKey]=true;assert.equal(check(c,'cleric').eligible,true);
 assert.equal(check(c,'divine-mind').eligible,false);confirm(c,'divine-mind');assert.equal(check(c,'divine-mind').eligible,true);
 c.deityAlignment={deity:c.deity,alignment:'CE'};assert.equal(deityAlignmentValue(c),'CE');
 assert.equal(check(c,'cleric').eligible,false);assert.equal(check(c,'divine-mind').eligible,false);
 assert.match(check(c,'cleric').requirements[0].label,/House rule/);
 c.deity='Different deity';assert.equal(deityAlignmentValue(c),'');
 assert.match(check(c,'divine-mind').requirements[0].label,/complete class source/);assert.equal(check(c,'divine-mind').eligible,false);
 c.alignment='devoted to order';assert.equal(check(c,'divine-mind').eligible,false);
});

test('standard and paired advancement reject opposed deity alignments atomically; exceptions expire at the next class level',async()=>{
 for(const id of ['cleric','favored-soul','divine-mind'])for(const paired of [false,true]){
  const c={...create(paired),...context(id==='favored-soul'?'TN':'LG','CE')};c.hp-=3;if(paired)c.casters[0].slots[1].used=1;
  const before=structuredClone(c);assert.throws(()=>paired?previewGestaltLevel(c,{left:id,right:'wizard'}):gainLevel(c,id),/alignment/);assert.deepEqual(c,before);
  confirm(c,id);const old=structuredClone(c);if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:id,right:'wizard'}));else gainLevel(c,id);recompute(c,old);
  assert.equal(c.level,2);assert.equal(c.maxHp-c.hp,3);if(paired)assert.equal(c.casters.find(b=>b.casting.classId==='wizard').slots[1].used,1);
  assert.equal(check(c,id).eligible,false);
  const restored=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(restored,c);
 }
});

test('changing recorded deity alignment invalidates an open paired review even when both values qualify',()=>{
 const c={...create(true),...context('LG','LG')},preview=previewGestaltLevel(c,{left:'cleric',right:'wizard'});
 c.deityAlignment.alignment='NG';assert.equal(check(c,'cleric').eligible,true);const before=structuredClone(c);
 assert.throws(()=>applyGestaltLevel(c,preview),/changed/);assert.deepEqual(c,before);
});

test('guided creation records matching deity evidence, filters stale evidence and uses the specialty deity',()=>{
 const opts={...options,kind:'Cleric'},valid=context('LG','LG');
 const c=createReviewedCharacter(opts,valid);assert.deepEqual(c.deityAlignment,valid.deityAlignment);assert.deepEqual(c.prerequisiteConfirmations,{});
 const specialty={...opts,clericSpecialty:'axe-brother'};assert.equal(startingAlignmentEligibility(specialty,valid).eligible,false);
 valid.deityAlignment={deity:'Clangeddin Silverbeard',alignment:'LG'};const brother=createReviewedCharacter(specialty,valid);
 assert.equal(brother.deityAlignment.deity,brother.deity);assert.equal(brother.deity,'Clangeddin Silverbeard');assert.deepEqual(brother.prerequisiteConfirmations,{});
 const stale={...context('LG','LG'),deity:'New patron'};
 for(const r of startingAlignmentEligibility(opts,stale).requirements)if(r.state==='confirm')stale.prerequisiteConfirmations[r.key]=true;
 assert.equal(createReviewedCharacter(opts,stale).deityAlignment,undefined);
});

test('deity evidence persists through browser storage and older characters retain their exact data',async()=>{
 const c=createReviewedCharacter({...options,kind:'Cleric',level:4},context('LG','NG'));c.hp-=3;c.casters[0].slots[1].used=1;
 const values=new Map(),config={scope:'/deity-qa/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_key,fn)=>fn()};
 const saved=await createBrowserCharacterApi(config)('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await prepareCharacter((await createBrowserCharacterApi(config)('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);
 delete c.deityAlignment;c.alignment='CE';const before=structuredClone(c);
 assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),before);
});

test('dragon shaman requests totem review while spirit shaman remains unrestricted',()=>{
 const c={...create(),...context('LG','LG')};assert.equal(check(c,'spirit-shaman').eligible,true);
 const totem=check(c,'dragon-shaman');assert.equal(totem.eligible,false);assert.match(totem.requirements[0].label,/totem dragon/);
 confirm(c,'dragon-shaman');assert.equal(check(c,'dragon-shaman').eligible,true);c.alignment='CG';assert.equal(check(c,'dragon-shaman').eligible,false);
});
