import type {Character,Skill} from './model.ts';
import {findClass,isClassSkill} from './classes.ts';
import {hitDieSequence,skillPointGrant,skillIntelligence,type LevelRow} from './level-history.ts';

export function classSkillAt(c:Character,skill:Skill,row:LevelRow):boolean {
  const override=c.automation.history.find(h=>h.key===row.key)?.skillClassOverrides[skill.id];
  if(override!==undefined)return override;
  if(skill.classSkillOverride!==undefined)return skill.classSkillOverride;
  if(row.classId==='racial')return (c.ancestry.raceId==='lizardfolk'?['Balance','Jump','Swim']:c.ancestry.raceId==='gnoll'?['Climb','Listen','Spot']:[]).includes(skill.name);
  const definition=findClass(row.classId);
  return definition?isClassSkill(skill.name,[definition]):skill.classSkill;
}

export function skillRankLimit(c:Character,skill:Skill,index:number):number {
  const sequence=hitDieSequence(c);
  return (index+4)/(sequence.slice(0,index+1).some(row=>classSkillAt(c,skill,row))?1:2);
}

export function ranksAtLevel(c:Character,skillId:string,index:number):number {
  return hitDieSequence(c).slice(0,index+1).reduce((total,row)=>total+(c.automation.history.find(h=>h.key===row.key)?.skillRanks[skillId]||0),0);
}

export function skillLedger(c:Character) {
  const levels=hitDieSequence(c).map((row,index)=>{
    const history=c.automation.history.find(h=>h.key===row.key);
    const costs=Object.fromEntries(c.skills.map(skill=>[skill.id,classSkillAt(c,skill,row)?1:2]));
    const spent=c.skills.reduce((n,skill)=>n+(history?.skillRanks[skill.id]||0)*costs[skill.id],0);
    const granted=skillPointGrant(c,row,index);
    return {...row,index,granted,spent,remaining:granted-spent,costs,ranks:{} as Record<string,number>,limits:{} as Record<string,number>,available:{} as Record<string,number>};
  });
  const granted=levels.reduce((n,row)=>n+row.granted,0),spent=levels.reduce((n,row)=>n+row.spent,0);
  const unassigned=c.skills.reduce((n,skill)=>n+(c.automation.skillTraining.unassigned[skill.id]||0),0);
  const warnings:string[]=[];
  if(unassigned)warnings.push(unassigned+' existing ranks still need a purchase level. They remain in your checks.');
  const cumulative=new Map<string,number>(),classSkills=new Set<string>();
  for(const row of levels){
    if(row.remaining<0)warnings.push('Level '+(row.index+1)+' ('+row.label+') exceeds its skill budget by '+(-row.remaining)+'.');
    if(!Number.isInteger(row.spent))warnings.push('Level '+(row.index+1)+' spends a fraction of a skill point. Adjust the half ranks or their training type.');
    const history=c.automation.history.find(h=>h.key===row.key);
    for(const skill of c.skills){
      const ranks=(cumulative.get(skill.id)||0)+(history?.skillRanks[skill.id]||0);cumulative.set(skill.id,ranks);
      if(row.costs[skill.id]===1)classSkills.add(skill.id);
      row.ranks[skill.id]=ranks;row.limits[skill.id]=(row.index+4)/(classSkills.has(skill.id)?1:2);
      if(ranks>row.limits[skill.id])warnings.push(skill.name+' exceeds its rank limit at level '+(row.index+1)+'.');
    }
  }
  const futureSpace=new Map<string,number>();
  for(const row of [...levels].reverse())for(const skill of c.skills){const space=Math.min(futureSpace.get(skill.id)??Infinity,row.limits[skill.id]-row.ranks[skill.id]);futureSpace.set(skill.id,space);row.available[skill.id]=Math.max(0,Math.floor(Math.min(row.remaining,space*row.costs[skill.id])))}
  return {levels,granted,spent,remaining:granted-spent,unassigned,warnings:[...new Set(warnings)]};
}

export function initializeSkillTraining(c:Character) {
  if(c.automation.skillTraining.version===1)return;
  c.automation.skillTraining.version=1;
  c.automation.skillTraining.unassigned=Object.fromEntries(c.skills.filter(s=>s.ranks>0).map(s=>[s.id,s.ranks]));
}

export function preserveRemovedSkillLevels(c:Character,sequence:LevelRow[]) {
  const keys=new Set(sequence.map(row=>row.key));
  for(const history of c.automation.history)if(!keys.has(history.key))for(const [id,ranks] of Object.entries(history.skillRanks))c.automation.skillTraining.unassigned[id]=(c.automation.skillTraining.unassigned[id]||0)+ranks;
}

export function syncSkillRanks(c:Character) {
  for(const skill of c.skills)skill.ranks=(c.automation.skillTraining.unassigned[skill.id]||0)+c.automation.history.reduce((n,h)=>n+(h.skillRanks[skill.id]||0),0);
}

export function adoptManualSkillChanges(c:Character) {
  for(const skill of c.skills){
    const assigned=c.automation.history.reduce((n,h)=>n+(h.skillRanks[skill.id]||0),0);
    const delta=skill.ranks-assigned-(c.automation.skillTraining.unassigned[skill.id]||0);
    if(delta>=0)c.automation.skillTraining.unassigned[skill.id]=(c.automation.skillTraining.unassigned[skill.id]||0)+delta;
    else {let remove=-delta;const loose=Math.min(remove,c.automation.skillTraining.unassigned[skill.id]||0);c.automation.skillTraining.unassigned[skill.id]=(c.automation.skillTraining.unassigned[skill.id]||0)-loose;remove-=loose;for(const history of [...c.automation.history].reverse()){const take=Math.min(remove,history.skillRanks[skill.id]||0);history.skillRanks[skill.id]=(history.skillRanks[skill.id]||0)-take;remove-=take}}
  }
}

export function availableSkillPoints(c:Character,key:string,id:string):number {
  return skillLedger(c).levels.find(row=>row.key===key)?.available[id]||0;
}

export function setSkillPoints(c:Character,key:string,id:string,points:number) {
  if(!Number.isInteger(points)||points<0)throw new Error('Spend whole skill points. A cross-class point buys half a rank.');
  initializeSkillTraining(c);
  const sequence=hitDieSequence(c),index=sequence.findIndex(row=>row.key===key),skill=c.skills.find(s=>s.id===id);
  if(index<0||!skill)throw new Error('Choose a current character level and skill.');
  let history=c.automation.history.find(h=>h.key===key);
  if(!history){history={key,intScore:skillIntelligence(c),skillRanks:{},skillClassOverrides:{}};c.automation.history.push(history)}
  const cost=classSkillAt(c,skill,sequence[index])?1:2;
  const oldRanks=history.skillRanks[id]||0,oldPoints=oldRanks*cost,delta=points-oldPoints;
  if(delta>availableSkillPoints(c,key,id))throw new Error('That purchase exceeds this level’s remaining points or a rank limit.');
  const ranks=points/cost;
  if(ranks)history.skillRanks[id]=ranks;else delete history.skillRanks[id];
  if(ranks>oldRanks)c.automation.skillTraining.unassigned[id]=Math.max(0,(c.automation.skillTraining.unassigned[id]||0)-(ranks-oldRanks));
  syncSkillRanks(c);
}

/** Fit imported ranks to legal levels without inventing or discarding ranks. */
export function assignExistingSkillRanks(c:Character) {
  initializeSkillTraining(c);
  for(const classOnly of [true,false])for(const row of hitDieSequence(c))for(const skill of c.skills){
    const cost=classSkillAt(c,skill,row)?1:2;
    if(classOnly&&cost!==1)continue;
    const pending=c.automation.skillTraining.unassigned[skill.id]||0;
    const points=Math.min(Math.floor(pending*cost),availableSkillPoints(c,row.key,skill.id));
    if(points>0){const current=(c.automation.history.find(h=>h.key===row.key)?.skillRanks[skill.id]||0)*cost;setSkillPoints(c,row.key,skill.id,current+points)}
  }
  syncSkillRanks(c);
}

export function moveSkillLevel(c:Character,key:string,direction:-1|1) {
  const rows=hitDieSequence(c),index=rows.findIndex(row=>row.key===key),other=index+direction;
  if(index<0||other<0||other>=rows.length||rows[index].classId==='racial'||rows[other].classId==='racial'||rows[index].entryId===rows[other].entryId)return;
  [rows[index],rows[other]]=[rows[other],rows[index]];
  c.automation.levelOrder=rows.map(row=>row.key);
  c.automation.firstClassId=rows.find(row=>row.classId!=='racial')?.entryId||'';
}

export function removeSkillPurchases(c:Character,id:string) {
  delete c.automation.skillTraining.unassigned[id];
  for(const history of c.automation.history){delete history.skillRanks[id];delete history.skillClassOverrides[id]}
}
