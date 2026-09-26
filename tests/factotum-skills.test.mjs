import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {newCharacter,characterSchema,uid} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {advancementNumbers,hitDieSequence} from '../lib/advancement.ts';
import {skillLedger,setSkillPoints,assignExistingSkillRanks,skillRankLimit} from '../lib/skill-points.ts';
import {skillBonus,sheetTotals} from '../lib/rules.ts';

const exported=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-09-26',character:{id:'factotum-test',name:'Imported factotum'},attributes:Object.entries({class1:'Factotum',level1:3,race:'Illumian',int:18,hp:19,hp_max:25,bab:2,climbranks:6,climb:12,climbclassskill:0,knowarcanaranks:4,craft1name:'bookbinding',craft1ranks:3,repeating_skills_CUSTOM_name:'Knowledge (siegecraft)',repeating_skills_CUSTOM_ranks:2,...extra}).map(([name,current])=>({name,current,max:''}))});
const imported=(extra)=>importRoll20(exported(extra)).character;
const skill=(c,name)=>c.skills.find(s=>s.name===name);

test('Roll20 Factotum imports classify every skill and specialty without changing recorded totals',()=>{
 const source=exported(),before=structuredClone(source),c=importRoll20(source).character;
 assert.ok(c.skills.every(s=>s.classSkill));
 assert.equal(c.automation.enabled,false);
 assert.equal(skill(c,'Climb').ranks,6);assert.equal(skillBonus(c,skill(c,'Climb')),12);
 assert.equal(skill(c,'Craft (bookbinding)').ranks,3);assert.equal(skill(c,'Knowledge (siegecraft)').ranks,2);
 const n=advancementNumbers(c);assert.equal(n.skillBudget,60);assert.equal(n.skillSpent,15);assert.equal(n.classMax,6);
 assert.deepEqual(source,before);assert.deepEqual(c.roll20Import.raw,before);
});

test('saved legacy imports repair skill flags on opening, preserve totals, and remain stable',async()=>{
 const legacy=imported();legacy.skills.forEach(s=>s.classSkill=false);
 const before=structuredClone(legacy),totals=sheetTotals(legacy),bonuses=legacy.skills.map(s=>skillBonus(legacy,s));
 const values=new Map(),api=createBrowserCharacterApi({scope:'factotum-test',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:legacy})});
 const loaded=(await api('/api/characters/'+saved.id)).data;
 const c=activateAutomation(characterSchema.parse(loaded));
 assert.ok(c.skills.every(s=>s.classSkill));
 assert.deepEqual(sheetTotals(c),totals);assert.deepEqual(c.skills.map(s=>skillBonus(c,s)),bonuses);
 const expected=structuredClone(before);expected.skills.forEach(s=>s.classSkill=true);assert.deepEqual(c,expected);
 assert.deepEqual(recompute(structuredClone(c)),c);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:legacy}));
 assert.deepEqual(activateAutomation(backup),c);
 c.skills.push({...skill(c,'Craft'),id:uid(),name:'Craft (new specialty)',classSkill:false});recompute(c);assert.equal(c.skills.at(-1).classSkill,true);
});

test('Factotum ranks allocate at one point each after enabling calculations; multiclass costs stay per level',()=>{
 const c=imported();c.automation.enabled=true;recompute(c);assignExistingSkillRanks(c);
 assert.equal(skillLedger(c).unassigned,0);assert.equal(skillLedger(c).spent,15);
 assert.ok(skillLedger(c).levels.every(r=>Object.values(r.costs).every(cost=>cost===1)));
 assert.ok(skillLedger(c).levels.every(r=>Object.values(r.limits).every(limit=>limit===r.index+4)));
 const multi=activateAutomation(newCharacter('Factotum',1,'human'),false),bluff=skill(multi,'Bluff');
 setSkillPoints(multi,hitDieSequence(multi)[0].key,bluff.id,4);
 multi.classLevels.push({id:uid(),classId:'fighter',name:'Fighter',level:1,notes:''});recompute(multi);
 setSkillPoints(multi,hitDieSequence(multi)[1].key,bluff.id,2);
 assert.equal(bluff.ranks,5);assert.equal(skillRankLimit(multi,bluff,1),5);
 assert.deepEqual(skillLedger(multi).levels.map(r=>[r.costs[bluff.id],r.spent]),[[1,4],[2,2]]);
});

test('explicit training overrides and unrelated manual imports remain intact',()=>{
 const c=imported(),climb=skill(c,'Climb');climb.classSkillOverride=false;recompute(c);assert.equal(climb.classSkill,false);
 c.automation.enabled=true;recompute(c);const row=skillLedger(c).levels[0];assert.equal(row.costs[climb.id],2);
 c.automation.history[0].skillClassOverrides[climb.id]=true;recompute(c);assert.equal(skillLedger(c).levels[0].costs[climb.id],1);
 const fighter=imported({class1:'Fighter'}),before=structuredClone(fighter);assert.equal(skill(fighter,'Climb').classSkill,false);assert.deepEqual(activateAutomation(fighter),before);
});
