import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findClass} from '../lib/classes.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {setSkillPoints,skillLedger} from '../lib/skill-points.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {recompute} from '../lib/automation.ts';

const skill=(c,name)=>c.skills.find(row=>row.name===name);
const reload=c=>prepareCharacter(parseCharacterFile(JSON.stringify(c)));
function roll20(fields){
 return {format:'roll20-dnd35-export',version:1,exportedAt:'2026-11-12',
  character:{id:'psionic-qa',name:'Psionic skills QA'},
  attributes:Object.entries({class1:'Psion',level1:3,int:16,hp:10,hp_max:14,...fields})
   .map(([name,current])=>({name,current}))};
}

test('a Wizard // Psion can buy six ranks in both Cerebremancer prerequisites through the normal ledger',async()=>{
 const c=createPlayerCharacter({name:'Paired psion',kind:'Wizard',level:3,raceId:'human',
  method:'manual',scores:{STR:10,DEX:10,CON:12,INT:16,WIS:14,CHA:10},hpMethod:'average',
  advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'wizard',right:'psion'}))});
 const ledger=skillLedger(c),psionic=skill(c,'Knowledge (psionics)');
 assert.deepEqual(ledger.levels.map(row=>row.limits[psionic.id]),[4,5,6]);
 assert.equal(ledger.levels[0].costs[skill(c,'Psicraft').id],1);
 assert.equal(ledger.levels[0].costs[skill(c,'Use Psionic Device').id],2);
 assert.equal(skill(c,'Autohypnosis').ability,'WIS');
 assert.equal(skill(c,'Autohypnosis').trained,true);
 assert.equal(prestigeEligibility(c,findClass('cerebremancer')).eligible,false);
 for(const name of ['Knowledge (arcana)','Knowledge (psionics)']){
  for(const [i,points] of [4,1,1].entries())setSkillPoints(c,ledger.levels[i].key,skill(c,name).id,points);
 }
 assert.equal(skillLedger(c).spent,12);
 assert.equal(prestigeEligibility(await reload(c),findClass('cerebremancer')).eligible,true);
});

test('old Roll20 saves recover omitted fixed ranks once and retain later skill purchases and damage',async()=>{
 const c=await prepareCharacter(importRoll20(roll20({knowpsionicranks:4,knowpsionicmiscmod:2,
  psicraftranks:3,repeating_skills_qa_otherskillname:'Autohypnosis',repeating_skills_qa_otherskillranks:2})).character);
 const restored=skill(c,'Knowledge (psionics)');
 assert.equal(restored.ranks,4);
 assert.equal(restored.misc,2);
 c.skills=c.skills.filter(s=>s.id!==restored.id);
 delete c.automation.skillTraining.unassigned[restored.id];
 delete c.roll20Import.psionicSkillsMigration;
 c.classLevels[0].level++;
 recompute(c);
 const later=skill(c,'Psicraft');
 setSkillPoints(c,c.automation.history.at(-1).key,later.id,1);
 skill(c,'Autohypnosis').name='Personal focus';
 c.notes='Advanced after import';
 const before=structuredClone(c),updated=await reload(c);
 assert.equal(skill(updated,'Knowledge (psionics)').ranks,4);
 assert.equal(updated.automation.skillTraining.unassigned[restored.id],4);
 assert.equal(skill(updated,'Knowledge (psionics)').misc,2);
 assert.deepEqual(skill(updated,'Psicraft'),later);
 assert.equal(skill(updated,'Autohypnosis'),undefined);
 assert.deepEqual(skill(updated,'Personal focus'),skill(before,'Personal focus'));
 assert.deepEqual(updated.automation.history,before.automation.history);
 assert.deepEqual([updated.level,updated.hp,updated.maxHp,updated.notes],[4,before.hp,before.maxHp,before.notes]);
 assert.deepEqual(await reload(updated),updated);
});

test('imports near the skill limit retain custom rows and prioritize a recorded fixed skill over blank defaults',()=>{
 const fields={usepsionicdeviceranks:2};
 const baseCount=importRoll20(roll20({})).character.skills.length-4;
 for(let index=0;index<119-baseCount;index++){
  fields['repeating_skills_s'+index+'_otherskillname']='Custom skill '+index;
  fields['repeating_skills_s'+index+'_otherskillranks']=1;
 }
 const c=importRoll20(roll20(fields)).character;
 assert.equal(c.skills.length,120);
 assert.equal(skill(c,'Use Psionic Device').ranks,2);
 assert.equal(skill(c,'Use Psionic Device').ability,'CHA');
 assert.equal(skill(c,'Autohypnosis'),undefined);
 assert.equal(c.skills.filter(s=>s.name.startsWith('Custom skill')&&s.ranks===1).length,119-baseCount);
});

test('a missing fixed row is retried when the player makes room and existing custom skills keep their identity',async()=>{
 const c=await prepareCharacter(importRoll20(roll20({knowpsionicranks:3,psicraftranks:2})).character);
 const psi=skill(c,'Psicraft');
 psi.id='my-psicraft';
 psi.misc=7;
 c.skills=c.skills.filter(s=>s.name!=='Knowledge (psionics)');
 delete c.automation.skillTraining.unassigned['skill-knowpsionic'];
 delete c.roll20Import.psionicSkillsMigration;
 while(c.skills.length<120)c.skills.push({...psi,id:'extra-'+c.skills.length,name:'Specialty '+c.skills.length,ranks:0});
 const full=await reload(c);
 assert.equal(full.roll20Import.psionicSkillsMigration,undefined);
 assert.equal(skill(full,'Knowledge (psionics)'),undefined);
 full.skills.pop();
 const repaired=await reload(full);
 assert.equal(skill(repaired,'Knowledge (psionics)').ranks,3);
 assert.equal(skill(repaired,'Psicraft').id,'my-psicraft');
 assert.equal(skill(repaired,'Psicraft').misc,7);
 assert.equal(repaired.skills.length,120);
 assert.deepEqual(await reload(repaired),repaired);
});
