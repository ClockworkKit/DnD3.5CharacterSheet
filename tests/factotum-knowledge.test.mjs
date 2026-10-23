import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {cunningKnowledgeProblem,useCunningKnowledge,factotumNumbers} from '../lib/factotum.ts';
import {makeCunningKnowledgeRoll} from '../lib/factotum-rolls.ts';
import {skillLedger,setSkillPoints} from '../lib/skill-points.ts';
import {skillBonus,resetDaily,makeRequest} from '../lib/rules.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const create=()=>createPlayerCharacter({name:'Knowledge QA',kind:'Factotum',level:3,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:10},method:'manual'});
const train=(c,name)=>{const s=c.skills.find(s=>s.name===name);setSkillPoints(c,skillLedger(c).levels[0].key,s.id,1);return s;};
const saved=c=>JSON.parse(JSON.stringify(c));

test('Cunning Knowledge validates training and resources before rolling or spending, without partial mutations',()=>{
 const c=create(),s=c.skills.find(s=>s.name==='Climb');
 for(const rank of [0,.5]){
  s.ranks=rank;const before=saved(c);assert.match(cunningKnowledgeProblem(c,s.id),/1 rank/);
  assert.throws(()=>makeCunningKnowledgeRoll(c,s.id),/1 rank/);assert.throws(()=>useCunningKnowledge(c,s.id),/1 rank/);assert.deepEqual(saved(c),before);
 }
 train(c,'Climb');c.factotum.spent=factotumNumbers(c).inspiration;const before=saved(c);
 assert.throws(()=>useCunningKnowledge(c,s.id),/inspiration/);assert.deepEqual(saved(c),before);
 c.factotum.spent=0;assert.throws(()=>useCunningKnowledge(c,'missing'),/1 rank/);
 c.classLevels[0].classId='cleric';assert.throws(()=>useCunningKnowledge(c,s.id),/Factotum/);
});

test('roll cards add Factotum level once without spending until accepted; repeated use is rejected',()=>{
 const c=create(),s=train(c,'Climb'),before=saved(c),r=makeCunningKnowledgeRoll(c,s.id);
 assert.equal(r.formula,'1d20+'+(skillBonus(c,s)+3));assert.deepEqual(saved(c),before);
 assert.match(makeRequest(r,c.name,'https://example.com/').message,/Cunning Knowledge/);
 useCunningKnowledge(c,s.id);assert.equal(c.factotum.spent,1);assert.deepEqual(c.factotum.knowledgeUsed,[s.id]);
 const used=saved(c);assert.throws(()=>useCunningKnowledge(c,s.id),/already/);assert.deepEqual(saved(c),used);
 c.factotum.spent=0;assert.throws(()=>makeCunningKnowledgeRoll(c,s.id),/already/,'encounter refresh must not restore a daily use');
 const rested=resetDaily(c);assert.equal(cunningKnowledgeProblem(rested,s.id),'');useCunningKnowledge(rested,s.id);
});

test('duplicate rows share a daily skill limit while different Knowledge specialties remain distinct',()=>{
 const c=create(),s=train(c,'Climb');c.skills.push({...structuredClone(s),id:'duplicate',name:'  CLIMB  '});
 useCunningKnowledge(c,s.id);assert.match(cunningKnowledgeProblem(c,'duplicate'),/already/);
 const arcana=train(c,'Knowledge (arcana)'),religion=train(c,'Knowledge (religion)');useCunningKnowledge(c,arcana.id);
 assert.equal(cunningKnowledgeProblem(c,religion.id),'');useCunningKnowledge(c,religion.id);assert.equal(c.factotum.spent,3);
});

test('existing daily-use IDs survive advancement and browser/native saves without losing ranks or other spent resources',async()=>{
 const c=create(),s=train(c,'Climb');c.factotum.knowledgeUsed=[s.id];c.factotum.spent=1;c.factotum.pietyUsed=2;
 c.classLevels[0].level=5;recompute(c);c.hp-=3;c.notes='Advanced after import';
 const before=saved(c),records=new Map(),api=createBrowserCharacterApi({scope:'knowledge',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 const restored=await prepareCharacter(characterSchema.parse(backup));assert.deepEqual(saved(restored),before);assert.match(cunningKnowledgeProblem(restored,s.id),/already/);
});
