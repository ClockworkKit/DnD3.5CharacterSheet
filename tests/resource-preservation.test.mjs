import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute} from '../lib/automation.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {resetDaily} from '../lib/rules.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const make=(kind='barbarian',paired=false)=>createPlayerCharacter({name:'Resource preservation QA',kind,level:4,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:14,WIS:14,CHA:14},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:4},()=>({left:kind,right:'wizard'}))}:{})});
function personalize(f){f.name='My '+f.name;f.description='My tactics\n\n'+f.description+'\nKeep this personal note';f.source='My campaign source';f.used=1;}
function advance(c,id){const before=structuredClone(c);c.experience=10000;if(c.advancementMode==='gestalt')applyGestaltLevel(c,previewGestaltLevel(c,{left:id,right:'wizard'}));else gainLevel(c,id);recompute(c,before);}

test('renamed daily and supplemental resources retain identity, annotations and expenditure through advancement',()=>{
 for(const paired of [false,true])for(const [kind,key]of [['barbarian','daily:Rage'],['ninja','supp:ninja:Ki power']]){
  const c=make(kind,paired),f=c.features.find(f=>f.ruleId===key);personalize(f);c.hp-=3;
  const original=structuredClone(f);recompute(c);
  assert.equal(c.features.find(f=>f.ruleId===key)?.id,original.id);
  assert.equal(c.features.find(f=>f.ruleId===key)?.used,1);
  advance(c,kind);const after=c.features.find(f=>f.id===original.id);
  assert.ok(after);assert.equal(after.name,original.name);assert.equal(after.source,original.source);
  assert.match(after.description,/^My tactics/);assert.match(after.description,/Keep this personal note$/);assert.equal(after.used,1);
  assert.equal(c.maxHp-c.hp,3);
 }
});

test('legacy rewritten and blank resource notes survive recomputation without invented provenance',()=>{
 for(const description of ['A completely rewritten personal description','']){
  const c=make(),f=c.features.find(f=>f.ruleId==='daily:Rage');delete f.generatedSummary;f.description=description;f.used=1;
  recompute(c);assert.equal(c.features.find(x=>x.id===f.id).description,description);assert.equal(f.used,1);
 }
});

test('replacing and restoring a class resource retains its full card and uses until an explicit rest',()=>{
 const c=make(),f=c.features.find(f=>f.ruleId==='daily:Rage');personalize(f);const original=structuredClone(f);
 configureAlternateFeature(c,'barbarian-whirling-frenzy',{reviewed:true});selectAlternateFeature(c,'barbarian-whirling-frenzy',true);recompute(c);
 assert.equal(c.features.some(f=>f.ruleId==='daily:Rage'),false);
 assert.equal(c.retiredResources.find(f=>f.id===original.id).description,original.description);
 c.alternateFeatures.uses['retained:daily:Rage']=2;
 selectAlternateFeature(c,'barbarian-whirling-frenzy',false);recompute(c);
 assert.equal(c.features.find(f=>f.ruleId==='daily:Rage').id,original.id);assert.equal(c.features.find(f=>f.ruleId==='daily:Rage').used,2);
 assert.equal(c.features.find(f=>f.ruleId==='daily:Rage').name,original.name);
 selectAlternateFeature(c,'barbarian-whirling-frenzy',true);recompute(c);
 const rested=resetDaily(c);selectAlternateFeature(rested,'barbarian-whirling-frenzy',false);recompute(rested);
 assert.equal(rested.features.find(f=>f.ruleId==='daily:Rage').used,0);
 assert.equal(rested.features.find(f=>f.ruleId==='daily:Rage').description,original.description);
});

test('daily resources never claim another managed pool or a personal counter with the same label',()=>{
 const c=make(),rage=c.features.find(f=>f.ruleId==='daily:Rage');c.features=c.features.filter(f=>f!==rage);
 const personal={...rage,id:'personal-counter',kind:'Other',used:7,description:'Personal pool'};delete personal.ruleId;delete personal.generatedSummary;
 c.features.push(personal);recompute(c);
 assert.equal(c.features.find(f=>f.id==='personal-counter').used,7);assert.equal(c.features.find(f=>f.id==='personal-counter').ruleId,undefined);
 assert.equal(c.features.filter(f=>f.ruleId==='daily:Rage').length,1);
});

test('active and retired resource records round-trip through native files and a fresh storage client',async()=>{
 const c=make('barbarian',true),f=c.features.find(f=>f.ruleId==='daily:Rage');personalize(f);c.hp-=4;c.casters[0].slots[1].used=1;
 configureAlternateFeature(c,'barbarian-whirling-frenzy',{reviewed:true});selectAlternateFeature(c,'barbarian-whirling-frenzy',true);recompute(c);
 const native=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(native,c);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();
 const api=createBrowserCharacterApi({scope:'/resource-preservation/',storage,lock});
 const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/resource-preservation/',storage,lock});
 const loaded=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);
 selectAlternateFeature(loaded,'barbarian-whirling-frenzy',false);recompute(loaded);
 assert.equal(loaded.features.find(x=>x.id===f.id).used,1);assert.equal(loaded.maxHp-loaded.hp,4);assert.equal(loaded.casters[0].slots[1].used,1);
 const stable=structuredClone(loaded);recompute(loaded);assert.deepEqual(loaded,stable);
});
