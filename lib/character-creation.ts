import {abilityKeys,newCharacter,type Character} from './model.ts';
import {findRace} from './ancestry.ts';
import {activateAutomation} from './automation.ts';
import {secureDie} from './dice.mjs';

export type AbilityMethod='4d6-drop-lowest'|'3d6'|'manual';
export type AbilityRoll={dice:number[],droppedIndex:number|null,total:number};
export type AbilityScores=Character['scores'];
export const abilityMethods:Array<[AbilityMethod,string]>=[['4d6-drop-lowest','4d6 · drop the lowest'],['3d6','3d6 · add all three'],['manual','Enter scores manually']];
export const startingAssignment=()=>[0,1,2,3,4,5];
export const blankScores=():AbilityScores=>({STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10});

export function rollAbilityScores(method:Exclude<AbilityMethod,'manual'>,die:(sides:number)=>number=secureDie):AbilityRoll[]{
  if(!['4d6-drop-lowest','3d6'].includes(method))throw new Error('Choose a dice method.');
  return abilityKeys.map(()=>{
    const dice=Array.from({length:method==='3d6'?3:4},()=>die(6));
    if(dice.some(n=>!Number.isInteger(n)||n<1||n>6))throw new Error('The dice source returned an invalid d6.');
    const droppedIndex=method==='3d6'?null:dice.indexOf(Math.min(...dice));
    return {dice,droppedIndex,total:dice.reduce((n,value,index)=>n+(index===droppedIndex?0:value),0)};
  });
}

function validAssignment(assignment:number[]){return assignment.length===6&&new Set(assignment).size===6&&assignment.every(n=>Number.isInteger(n)&&n>=0&&n<6);}
export function assignAbilityRoll(assignment:number[],abilityIndex:number,rollIndex:number):number[]{
  if(!validAssignment(assignment)||!Number.isInteger(abilityIndex)||abilityIndex<0||abilityIndex>5||!Number.isInteger(rollIndex)||rollIndex<0||rollIndex>5)throw new Error('Assign each roll to one ability.');
  const next=[...assignment],other=next.indexOf(rollIndex);
  [next[abilityIndex],next[other]]=[next[other],next[abilityIndex]];
  return next;
}
export function assignedScores(rolls:AbilityRoll[],assignment:number[]):AbilityScores{
  if(rolls.length!==6||!validAssignment(assignment)||rolls.some(r=>!Number.isInteger(r.total)||r.total<3||r.total>18))throw new Error('Roll six scores and assign each one once.');
  return Object.fromEntries(abilityKeys.map((ability,index)=>[ability,rolls[assignment[index]].total])) as AbilityScores;
}
export function startingAbilityScores(scores:AbilityScores,raceId:string):AbilityScores{
  const race=findRace(raceId);if(!race)throw new Error('Choose a race from the library.');
  return Object.fromEntries(abilityKeys.map(ability=>[ability,raceId==='half-orc'&&ability==='INT'?Math.max(3,scores.INT+(race.abilities.INT||0)):scores[ability]+(race.abilities[ability]||0)])) as AbilityScores;
}
export function abilityRollRecord(method:AbilityMethod,scores:AbilityScores,rolls:AbilityRoll[]=[],assignment=startingAssignment()):string{
  const title=abilityMethods.find(([id])=>id===method)?.[1];
  if(!title)throw new Error('Choose an ability-score method.');
  if(method!=='manual'){
    const assigned=assignedScores(rolls,assignment);
    if(abilityKeys.some(a=>assigned[a]!==scores[a]))throw new Error('The assigned scores do not match the rolls.');
  }
  return ['Starting ability scores — '+title+' (before racial adjustments)',...abilityKeys.map((ability,index)=>{
    const roll=method==='manual'?null:rolls[assignment[index]];
    return ability+': '+scores[ability]+(roll?' · dice '+roll.dice.map((n,i)=>String(n)+(i===roll.droppedIndex?' [dropped]':'')).join(', '):'');
  })].join('\n');
}

export function createPlayerCharacter(options:{name:string,kind:string,level:number,raceId:string,scores:AbilityScores,method:AbilityMethod,rolls?:AbilityRoll[],assignment?:number[]}):Character{
  const {name,kind,level,raceId,scores}=options;
  if(abilityKeys.some(a=>!Number.isInteger(scores[a])||scores[a]<1||scores[a]>100))throw new Error('Enter whole ability scores between 1 and 100.');
  if(!Number.isInteger(level)||level<1||level>20)throw new Error('Choose a starting class level from 1 to 20.');
  const record=abilityRollRecord(options.method,scores,options.rolls,options.assignment);
  const c=newCharacter(kind,level,raceId);
  c.name=name.trim()||'Unnamed adventurer';c.scores={...scores};
  // Keep class/race rules, but do not give new players a sample character's possessions or choices.
  c.gear=[];c.weapons=[];c.coins={cp:0,sp:0,gp:0,pp:0};
  c.defense={armor:0,shield:0,natural:0,deflection:0,dodge:0,misc:0,dexCap:100,checkPenalty:0,spellFailure:0,sr:0,dr:'',resistances:''};
  c.skills.forEach(skill=>{skill.ranks=0;skill.misc=0});
  c.casters.forEach(caster=>{caster.spells=[];caster.slots.forEach(slot=>slot.used=0)});
  c.psionics.forEach(tradition=>{tradition.powers=[];tradition.spent=0});
  c.features=c.features.filter(feature=>feature.kind==='Class feature'||feature.kind==='Racial trait');
  c.features.forEach(feature=>feature.used=0);c.notes=record;c.hp=c.maxHp;
  activateAutomation(c,false);c.hp=c.maxHp;
  return c;
}
