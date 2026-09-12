import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,characterSchema} from '../lib/model.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {advancementChoices,recordAdvancementChoice} from '../lib/advancement-choices.ts';
const create=(level)=>activateAutomation(newCharacter('Fighter',level,'human'),false);
test('ability and feat milestones appear at earned HD and ignore level adjustment',()=>{
 const c=create(3);assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,0);c.classLevels[0].level=4;recompute(c);assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,1);c.ancestry.levelAdjustment=4;c.ancestry.ignoreLevelAdjustment=false;assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,1);c.classLevels[0].level=6;recompute(c);assert.equal(advancementChoices(c).filter(r=>r.key.startsWith('general')).length,3);
});
test('apply ability increase once, or acknowledge an existing increase without changing scores',()=>{
 const c=create(8),before=c.scores.STR;recordAdvancementChoice(c,'ability-1','STR',true);assert.equal(c.scores.STR,before+1);assert.throws(()=>recordAdvancementChoice(c,'ability-1','STR',true));recordAdvancementChoice(c,'ability-2','INT');assert.equal(advancementChoices(c).filter(r=>r.kind==='ability'&&!r.choice).length,0);assert.throws(()=>recordAdvancementChoice(c,'ability-3','STR',true));
});
test('feat entries cannot fill two choices and removing a feat restores its reminder',()=>{
 const c=create(3);const f={id:'chosen',name:'Custom feat',kind:'Feat',description:'',max:0,used:0,source:''};c.features.push(f);recordAdvancementChoice(c,'general-0',f.id);assert.throws(()=>recordAdvancementChoice(c,'human',f.id));c.features=c.features.filter(x=>x.id!==f.id);assert.equal(advancementChoices(c).find(r=>r.key==='general-0').choice,'');
});
test('advancement tracking round trips and legacy saves remain pending without score changes',()=>{
 const c=create(4);recordAdvancementChoice(c,'ability-1','STR');assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);delete c.advancementChoices;const loaded=characterSchema.parse(c);assert.deepEqual(loaded.advancementChoices,{});assert.equal(loaded.scores.STR,c.scores.STR);assert.equal(advancementChoices(loaded).find(r=>r.key==='ability-1').choice,'');
});
test('reducing and restoring levels preserves recorded choices without reapplying score bonuses',()=>{
 const c=create(4);recordAdvancementChoice(c,'ability-1','STR',true);const score=c.scores.STR;c.classLevels[0].level=3;recompute(c);assert.ok(!advancementChoices(c).some(r=>r.key==='ability-1'));c.classLevels[0].level=4;recompute(c);assert.equal(advancementChoices(c).find(r=>r.key==='ability-1').choice,'STR');assert.equal(c.scores.STR,score);
});
