import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,characterSchema,uid} from '../lib/model.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {hitDieSequence,advancementNumbers} from '../lib/advancement.ts';
import {skillLedger,setSkillPoints,skillRankLimit,availableSkillPoints,assignExistingSkillRanks,moveSkillLevel,removeSkillPurchases} from '../lib/skill-points.ts';
import {skillBonus} from '../lib/rules.ts';

const automatic=(kind='Fighter',level=1)=>activateAutomation(newCharacter(kind,level,'human'),false);
const edit=(c,recipe)=>{const before=structuredClone(c);recipe(c);return recompute(c,before);};
const skill=(c,name)=>c.skills.find(s=>s.name===name);
const addClass=(c,name,level=1)=>c.classLevels.push({id:uid(),classId:name.toLowerCase(),name,level,notes:''});

test('class and cross-class purchases spend whole points, derive ranks, and refund immediately',()=>{
  const c=automatic(),row=hitDieSequence(c)[0],climb=skill(c,'Climb'),bluff=skill(c,'Bluff');
  assert.equal(skillLedger(c).granted,12);
  const bonus=skillBonus(c,bluff);
  edit(c,c=>setSkillPoints(c,row.key,climb.id,3));
  edit(c,c=>setSkillPoints(c,row.key,bluff.id,1));
  assert.equal(climb.ranks,3);assert.equal(bluff.ranks,.5);assert.equal(skillBonus(c,bluff),bonus);
  assert.equal(skillLedger(c).remaining,8);
  edit(c,c=>setSkillPoints(c,row.key,bluff.id,2));assert.equal(bluff.ranks,1);assert.equal(skillBonus(c,bluff),bonus+1);
  edit(c,c=>setSkillPoints(c,row.key,climb.id,1));assert.equal(climb.ranks,1);assert.equal(skillLedger(c).spent,3);
  assert.throws(()=>setSkillPoints(c,row.key,climb.id,1.5),/whole skill points/);
});

test('overspending and rank caps are blocked without changing the character',()=>{
  const c=automatic(),row=hitDieSequence(c)[0];
  for(const name of ['Climb','Jump','Swim'])setSkillPoints(c,row.key,skill(c,name).id,4);
  const before=structuredClone(c);
  assert.throws(()=>setSkillPoints(c,row.key,skill(c,'Ride').id,1),/remaining points/);
  assert.deepEqual(c,before);
  setSkillPoints(c,row.key,skill(c,'Swim').id,0);
  assert.throws(()=>setSkillPoints(c,row.key,skill(c,'Climb').id,5),/rank limit/);
  assert.throws(()=>setSkillPoints(c,row.key,skill(c,'Bluff').id,5),/rank limit/);
  assert.equal(availableSkillPoints(c,row.key,skill(c,'Bluff').id),4);
});

test('multiclass purchases use the advancing class while previous classes retain higher caps',()=>{
  const c=automatic('Rogue'),rogue=hitDieSequence(c)[0],bluff=skill(c,'Bluff');
  setSkillPoints(c,rogue.key,bluff.id,4);
  edit(c,c=>addClass(c,'Fighter'));
  const fighter=hitDieSequence(c)[1];assert.equal(skillRankLimit(c,bluff,1),5);
  edit(c,c=>setSkillPoints(c,fighter.key,bluff.id,2));assert.equal(bluff.ranks,5);
  assert.deepEqual(skillLedger(c).levels.map(r=>r.spent),[4,2]);
  assert.equal(skillLedger(c).spent,6);assert.equal(advancementNumbers(c).skillSpent,6);
  const reverse=automatic();edit(reverse,c=>addClass(c,'Rogue'));
  assert.equal(skillRankLimit(reverse,skill(reverse,'Bluff'),0),2);
  assert.equal(skillRankLimit(reverse,skill(reverse,'Bluff'),1),5);
});

test('points remain attached to their level and Intelligence increases affect only later grants',()=>{
  const c=automatic();const old=skillLedger(c).granted;
  edit(c,c=>{c.scores.INT=14;c.classLevels[0].level=2;});
  const rows=skillLedger(c).levels;assert.equal(rows[0].granted,old);assert.equal(rows[1].granted,5);
  c.automation.history[1].skillPoints=1;
  setSkillPoints(c,rows[1].key,skill(c,'Ride').id,1);
  assert.throws(()=>setSkillPoints(c,rows[1].key,skill(c,'Swim').id,1),/remaining points/);
  assert.equal(skillLedger(c).levels[0].remaining,12);
  const low=newCharacter('Fighter',1,'human');low.scores.INT=3;activateAutomation(low,false);
  assert.equal(skillLedger(low).granted,8); // Minimum one, plus human, times four.
});

test('new multiclass levels append and reordering carries recorded purchases and Intelligence',()=>{
  const c=automatic('Fighter',2);edit(c,c=>addClass(c,'Rogue'));
  const keys=hitDieSequence(c).map(r=>r.key),second=c.automation.history.find(h=>h.key===keys[1]);
  second.intScore=12;setSkillPoints(c,keys[1],skill(c,'Climb').id,2);
  edit(c,c=>moveSkillLevel(c,keys[2],-1));
  assert.deepEqual(hitDieSequence(c).map(r=>r.key),[keys[0],keys[2],keys[1]]);
  assert.equal(c.automation.history.find(h=>h.key===keys[1]).intScore,12);
  assert.equal(c.automation.history.find(h=>h.key===keys[1]).skillRanks[skill(c,'Climb').id],2);
  edit(c,c=>c.classLevels[0].level=3);
  assert.deepEqual(hitDieSequence(c).slice(0,3).map(r=>r.key),[keys[0],keys[2],keys[1]]);
  assert.equal(hitDieSequence(c).at(-1).classLevel,3);
});

test('legacy ranks remain intact and legal allocation does not add them twice',()=>{
  const raw=newCharacter('Fighter',2,'human');skill(raw,'Climb').ranks=5;skill(raw,'Bluff').ranks=1.5;
  const c=activateAutomation(raw,true),before=c.skills.map(s=>s.ranks);
  assert.equal(skillLedger(c).unassigned,6.5);
  edit(c,assignExistingSkillRanks);
  assert.deepEqual(c.skills.map(s=>s.ranks),before);assert.equal(skillLedger(c).unassigned,0);
  assert.equal(skillLedger(c).spent,8);
  const once=structuredClone(c);recompute(c);recompute(c);assert.deepEqual(c,once);
  assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
  const impossible=activateAutomation(newCharacter('Fighter',1,'human'),false);
  impossible.automation.skillTraining.unassigned[skill(impossible,'Bluff').id]=10;recompute(impossible);
  assignExistingSkillRanks(impossible);assert.equal(skill(impossible,'Bluff').ranks,10);assert.equal(skillLedger(impossible).unassigned,8);
});

test('removing a level preserves its ranks for review; deleting a specialty refunds its purchases',()=>{
  const c=automatic('Fighter',2),row=hitDieSequence(c)[1],climb=skill(c,'Climb');
  setSkillPoints(c,row.key,climb.id,2);edit(c,c=>c.classLevels[0].level=1);
  assert.equal(climb.ranks,2);assert.equal(skillLedger(c).unassigned,2);assert.equal(skillLedger(c).spent,0);
  const once=structuredClone(c);recompute(c);assert.deepEqual(c,once);
  edit(c,assignExistingSkillRanks);assert.equal(climb.ranks,2);assert.equal(skillLedger(c).spent,2);
  const custom={id:uid(),name:'Craft (bookbinding)',ability:'INT',ranks:0,misc:0,trained:false,armor:0,classSkill:false};c.skills.push(custom);
  setSkillPoints(c,hitDieSequence(c)[0].key,custom.id,2);assert.equal(custom.ranks,2);
  removeSkillPurchases(c,custom.id);c.skills=c.skills.filter(s=>s.id!==custom.id);assert.equal(skillLedger(c).spent,2);
});

test('manual edits and house-rule training costs retain ranks and show budget conflicts',()=>{
  const c=automatic(),row=hitDieSequence(c)[0],climb=skill(c,'Climb');setSkillPoints(c,row.key,climb.id,4);
  edit(c,c=>c.automation.enabled=false);climb.ranks=2;edit(c,c=>c.automation.enabled=true);assert.equal(climb.ranks,2);
  const history=c.automation.history[0];history.skillClassOverrides[climb.id]=false;recompute(c);
  assert.equal(climb.ranks,2);assert.equal(skillLedger(c).spent,4);
  history.skillPoints=1;assert.ok(skillLedger(c).warnings.some(w=>w.includes('exceeds its skill budget')));
  const language=skill(c,'Speak Language');assert.ok(language);history.skillPoints=12;
  setSkillPoints(c,row.key,language.id,2);assert.equal(language.ranks,1);
});


test('enhancement Intelligence does not grant skill points and restricted specialties retain their costs',()=>{
  const c=automatic();
  edit(c,c=>{c.effects.push({id:uid(),name:'Headband of intellect',preset:'',active:true,permanent:true,casterLevel:8,rounds:0,notes:'',modifiers:[{target:'INT',type:'enhancement',value:'4',when:''}]});c.classLevels[0].level=2;});
  assert.equal(skillLedger(c).levels[0].granted,12);assert.equal(skillLedger(c).levels[1].granted,3);
  const archmage=automatic('Wizard');edit(archmage,c=>{
    addClass(c,'Archmage');
    for(const name of ['Craft (alchemy)','Craft (bookbinding)'])c.skills.push({...skill(c,'Craft'),id:uid(),name});
  });
  const last=skillLedger(archmage).levels.at(-1);
  assert.equal(last.costs[skill(archmage,'Craft').id],2);assert.equal(last.costs[skill(archmage,'Spellcraft').id],1);
  assert.equal(last.costs[skill(archmage,'Craft (alchemy)').id],1);assert.equal(last.costs[skill(archmage,'Craft (bookbinding)').id],2);
});
