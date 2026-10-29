import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {copyClassFeatures,classSummaryView,classSummaryPostText} from '../lib/classes.ts';
import {characterSchema} from '../lib/model.ts';
import {customClassDraft,previewCustomClassChange,applyCustomClassChange} from '../lib/custom-class-editor.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
import {selectAlternateFeature,configureAlternateFeature} from '../lib/alternate-features.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';

const make=(paired=false)=>createPlayerCharacter({name:'Summary preservation QA',kind:'Rogue',level:3,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:16,WIS:10,CHA:10},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'rogue',right:'wizard'}))}:{})});
const card=c=>c.features.find(f=>f.id==='class-summary-'+c.classLevels.find(e=>e.classId==='rogue').id);

test('standard and paired advancement retain annotations and counters while refreshing earned milestones',()=>{
 for(const paired of [false,true]){
  const c=make(paired),f=card(c);f.description='My preface\n\n'+f.description+'\n\nPersonal note: keep the silver key';f.max=5;f.used=3;f.name='My rogue abilities';f.source='My campaign reference';
  c.hp-=3;c.experience=6000;if(paired)c.casters[0].slots[1].used=1;
  const before=structuredClone(c);
  if(paired){const review=previewGestaltLevel(c,{left:'rogue',right:'wizard'});assert.deepEqual(c,before);applyGestaltLevel(c,review);}else gainLevel(c,'rogue');
  recompute(c,before);const after=card(c);
  assert.match(after.description,/^My preface/);assert.match(after.description,/silver key$/);assert.match(after.description,/Level 4: Uncanny dodge/);
  assert.equal(after.name,'My rogue abilities');assert.equal(after.source,'My campaign reference');assert.equal(after.max,5);assert.equal(after.used,3);
  assert.equal(c.maxHp-c.hp,3);assert.deepEqual(c.automation.history.slice(0,3),before.automation.history);if(paired)assert.equal(c.casters[0].slots[1].used,1);
  const refreshed=structuredClone(c);copyClassFeatures(c);assert.deepEqual(c,refreshed);
 }
});

test('custom rewritten descriptions and ambiguous repeated summaries are never replaced',()=>{
 for(const text of ['My rewritten class rules','']){
  const c=make(),f=card(c);f.description=text;const before=structuredClone(f);copyClassFeatures(c);assert.deepEqual(f,before);
 }
 const c=make(),f=card(c);f.description+='\n\nQuoted again:\n'+f.description;const before=structuredClone(f);c.classLevels[0].level=4;copyClassFeatures(c);assert.deepEqual(f,before);
});

test('alternate feature refresh keeps personal text and updates only the recognized generated block',()=>{
 const c=make(),f=card(c);f.description+='\nMy trap notes';const before=structuredClone(c);
 configureAlternateFeature(c,'rogue-deaths-ruin',{reviewed:true});selectAlternateFeature(c,'rogue-deaths-ruin',true);recompute(c,before);
 assert.match(f.description,/My trap notes$/);assert.doesNotMatch(f.description.split('\n\n')[0],/trap sense/i);
 assert.ok(c.features.some(f=>f.ruleId==='acf:rogue-deaths-ruin'));
 const refreshed=structuredClone(c);recompute(c);assert.deepEqual(c,refreshed);
});

test('nearly full descriptions remain valid and personal data survives native reload',async()=>{
 const c=make(),f=card(c);f.description=f.description.padEnd(20000,'x');f.max=5;f.used=3;const before=structuredClone(f);c.experience=6000;gainLevel(c,'rogue');recompute(c);
 assert.deepEqual(card(c),before);assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),c);
});

test('legacy cards without provenance refresh only exact generated text and expose custom rewrites separately',()=>{
 const c=make(),f=card(c);delete f.generatedSummary;f.description+='\nLegacy player notes';c.experience=6000;
 gainLevel(c,'rogue');recompute(c);assert.match(f.description,/Level 4: Uncanny dodge/);assert.match(f.description,/Legacy player notes$/);assert.equal(classSummaryView(c,f),undefined);
 f.description='My rewritten mechanics and campaign note';delete f.generatedSummary;
 const before=structuredClone(f);copyClassFeatures(c);assert.deepEqual(f,before);
 assert.match(classSummaryView(c,f).description,/Level 4: Uncanny dodge/);
 assert.match(classSummaryPostText(c,f),/Current generated class summary:/);assert.ok(classSummaryPostText(c,f).endsWith(f.description));
 const personal={...f,id:'unrelated',description:'Ordinary note'};assert.equal(classSummaryView(c,personal),undefined);assert.equal(classSummaryPostText(c,personal),'Ordinary note');
});

test('saved generated provenance survives a fresh client and toggling alternate choices without a previous snapshot',async()=>{
 const c=make(),f=card(c);f.description+='\nPlayer tactics';f.max=5;f.used=2;c.hp-=3;
 configureAlternateFeature(c,'rogue-deaths-ruin',{reviewed:true});selectAlternateFeature(c,'rogue-deaths-ruin',true);recompute(c);
 assert.doesNotMatch(f.description.split('\n\n')[0],/trap sense/i);assert.match(f.description,/Player tactics$/);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();
 const api=createBrowserCharacterApi({scope:'/summary-preservation/',storage,lock});
 const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/summary-preservation/',storage,lock});
 const loaded=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);
 selectAlternateFeature(loaded,'rogue-deaths-ruin',false);recompute(loaded);
 assert.match(card(loaded).description.split('\n\n')[0],/trap sense/i);assert.match(card(loaded).description,/Player tactics$/);
 assert.equal(card(loaded).used,2);assert.equal(loaded.maxHp-loaded.hp,3);
 const again=structuredClone(loaded);recompute(loaded);assert.deepEqual(loaded,again);
 const malformed=structuredClone(c);card(malformed).generatedSummary.extra='unsupported';assert.equal(characterSchema.safeParse(malformed).success,false);
});

test('reviewed custom table updates and later advancement preserve notes while showing current milestones',()=>{
 const c=make(),profile=customClassDraft(c);profile.definition.name='Synthetic Scout';profile.definition.source='Synthetic test source';
 profile.definition.levels[0].special='First training';profile.definition.levels[3].special='Advanced training';
 const entry=c.classLevels[0];entry.classId=profile.definition.id;entry.name=profile.definition.name;c.customClasses=[profile];copyClassFeatures(c);recompute(c);
 const f=c.features.find(f=>f.id==='class-summary-'+entry.id);f.description+='\nKeep my custom tactics';f.max=3;f.used=2;
 const draft=structuredClone(profile);draft.definition.levels[0].special='Reviewed first training';
 const review=previewCustomClassChange(c,profile.definition.id,draft),old=structuredClone(c);applyCustomClassChange(c,review);recompute(c,old);
 assert.match(classSummaryView(c,f).description,/Reviewed first training/);
 c.experience=6000;gainLevel(c,profile.definition.id);recompute(c);
 const refreshed=c.features.find(row=>row.id===f.id);assert.match(refreshed.description,/Reviewed first training/);assert.match(refreshed.description,/Advanced training/);assert.match(refreshed.description,/Keep my custom tactics$/);assert.equal(refreshed.used,2);
});
