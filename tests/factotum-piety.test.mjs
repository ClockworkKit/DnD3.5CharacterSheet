import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,uid} from '../lib/model.ts';
import {factotumNumbers,opportunisticPietyProblem,useOpportunisticPiety} from '../lib/factotum.ts';
import {makeOpportunisticPietyRoll} from '../lib/factotum-rolls.ts';
import {makeRequest,resetDaily} from '../lib/rules.ts';
import {recompute} from '../lib/automation.ts';
import {applyClericSpecialty} from '../lib/cleric-specialty.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const create=(level=5)=>createPlayerCharacter({name:'Piety QA',kind:'Factotum',level,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:14},method:'manual'});
const saved=c=>JSON.parse(JSON.stringify(c));

test('Piety validates class level, daily limit and inspiration before rolling or spending',()=>{
 const lowLevel=create(4),dailyEmpty=create(),inspirationEmpty=create();
 dailyEmpty.factotum.pietyUsed=factotumNumbers(dailyEmpty).piety;
 inspirationEmpty.factotum.spent=factotumNumbers(inspirationEmpty).inspiration;
 for(const c of [lowLevel,dailyEmpty,inspirationEmpty]){
  const before=saved(c);assert.ok(opportunisticPietyProblem(c));
  assert.throws(()=>makeOpportunisticPietyRoll(c,'heal'));assert.throws(()=>useOpportunisticPiety(c));assert.deepEqual(saved(c),before);
 }
 const c=create(),before=saved(c);assert.throws(()=>makeOpportunisticPietyRoll(c,'rebuke'),/supported/);assert.deepEqual(saved(c),before);
});

test('healing and harm send the fixed amount without inventing dice, saves or changing HP',()=>{
 const c=create();c.hp-=3;const before=saved(c);
 for(const [action,field] of [['heal','Healing'],['harm-undead','Positive energy damage']]){
  const r=makeOpportunisticPietyRoll(c,action);assert.equal(Object.fromEntries(r.fields)[field],'14');
  assert.equal(r.formula,undefined);assert.equal(r.rolls,undefined);assert.match(r.details,/Standard action/);assert.match(r.details,/14/);
  assert.match(makeRequest(r,c.name,'https://example.com/').message,/14/);assert.deepEqual(saved(c),before);
 }
});

test('Piety turning uses Factotum level and Charisma, not cleric level or Intelligence',()=>{
 const c=create();c.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:3,notes:''});recompute(c);applyClericSpecialty(c,'axe-brother');
 const r=makeOpportunisticPietyRoll(c,'turn-undead');
 assert.equal(Object.fromEntries(r.fields)['Effective turning level'],'5');
 assert.deepEqual(r.rolls.map(x=>x.formula),['1d20+2','2d6+7']);
 assert.match(r.details,/cannot rebuke or control/);
 assert.equal((makeRequest(r,c.name,'https://example.com/').message.match(/\[\[/g)||[]).length,2);
 c.features.push({id:uid(),name:'Improved Turning',kind:'Feat',description:'',source:'',max:0,used:0});
 c.skills.find(s=>s.name==='Knowledge (religion)').ranks=5;
 const improved=makeOpportunisticPietyRoll(c,'turn-undead');
 assert.equal(Object.fromEntries(improved.fields)['Effective turning level'],'6');
 assert.deepEqual(improved.rolls.map(x=>x.formula),['1d20+4','2d6+8']);
});

test('each accepted Piety use spends exactly one inspiration and one daily use, without touching cleric pools',()=>{
 const c=create();c.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:3,notes:''});recompute(c);applyClericSpecialty(c,'axe-brother');
 const turn=c.features.find(f=>f.name==='Turn or rebuke undead');turn.used=2;
 const p=c.casters[0];p.slots[1].used=1;p.spells[0].prepared=2;p.spells[0].spent=1;
 const books=saved(c.casters),features=saved(c.features);
 for(const [i,action] of ['heal','harm-undead','turn-undead'].entries()){
  const before=saved(c);makeOpportunisticPietyRoll(c,action);assert.deepEqual(saved(c),before);
  useOpportunisticPiety(c);assert.equal(c.factotum.spent,i+1);assert.equal(c.factotum.pietyUsed,i+1);
 }
 assert.deepEqual(saved(c.casters),books);assert.deepEqual(saved(c.features),features);
 c.factotum.spent=0;assert.equal(c.factotum.pietyUsed,3);
 c.factotum.pietyUsed=factotumNumbers(c).piety;assert.match(opportunisticPietyProblem(c),/daily/);
 assert.equal(opportunisticPietyProblem(resetDaily(c)),'');
});

test('Piety counters survive advancement and browser/native saves alongside HP, spells and other daily abilities',async()=>{
 let c=create();useOpportunisticPiety(c);c.factotum.knowledgeUsed=['trained'];c.factotum.dodgeUsed=true;
 c.hp-=4;c.notes='Keep last session';c.classLevels[0].level=10;recompute(c);
 const before=saved(c),records=new Map(),api=createBrowserCharacterApi({scope:'piety',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 c=await prepareCharacter(characterSchema.parse(backup));assert.deepEqual(saved(c),before);
 makeOpportunisticPietyRoll(c,'turn-undead');assert.deepEqual(saved(c),before);
 assert.equal(factotumNumbers(c).piety,7);assert.equal(c.factotum.pietyUsed,1);assert.equal(c.maxHp-c.hp,4);
});
