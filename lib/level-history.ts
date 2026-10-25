import type {Character} from './model.ts';
import {classHitDie,classSkillPoints} from './classes.ts';
import {effectiveScore,raceProgression,racialBonusSkillPoints} from './ancestry.ts';

export type LevelRow = {key:string;entryId:string;label:string;die:number;skillBase:number;classId:string;classLevel:number;classIds?:string[]};

export function skillIntelligence(c:Character):number {
  // Enhancement items such as a headband do not grant 3.5 skill points.
  const effects=c.effects.map(effect=>({...effect,modifiers:effect.modifiers.filter(modifier=>modifier.target!=='INT'||modifier.type!=='enhancement')}));
  return Math.min(100,Math.max(1,effectiveScore({...c,effects},'INT',true)));
}

export function hitDieSequence(c:Character):LevelRow[] {
  const racial:LevelRow[]=[];
  const progression=raceProgression(c.ancestry.raceId);
  for(let i=1;i<=c.ancestry.racialHitDice;i++)racial.push({key:'racial-'+i,entryId:'racial',label:'Racial HD '+i,die:progression?.die||8,skillBase:progression?.skillBase||2,classId:'racial',classLevel:i});
  const rows:LevelRow[]=[];
  const entries=[...c.classLevels].sort((a,b)=>a.id===c.automation.firstClassId?-1:b.id===c.automation.firstClassId?1:0);
  for(const e of entries){for(let i=1;i<=e.level;i++)rows.push({key:e.id+'-'+i,entryId:e.id,label:e.name+' '+i,die:classHitDie(c,e.classId),skillBase:classSkillPoints(c,e.classId),classId:e.classId,classLevel:i})}
  const order=c.automation.levelOrder;
  const first=order.find(key=>rows.some(row=>row.key===key));
  if(!order.length||first&&c.automation.firstClassId&&rows.find(row=>row.key===first)?.entryId!==c.automation.firstClassId)return [...racial,...rows];
  const position=new Map(order.map((key,index)=>[key,index]));
  rows.sort((a,b)=>(position.get(a.key)??Infinity)-(position.get(b.key)??Infinity));
  const placed=new Set<string>(),result=[...racial];
  // Class levels stay in order even if an imported order was malformed.
  while(rows.length){const index=rows.findIndex(row=>row.classLevel===1||placed.has(row.entryId+'-'+(row.classLevel-1)));const row=rows.splice(index<0?0:index,1)[0];result.push(row);placed.add(row.key)}
  return result;
}

export function skillPointGrant(c:Character,row:LevelRow,index:number):number {
  const history=c.automation.history.find(h=>h.key===row.key);
  if(history?.skillPoints!==undefined)return history.skillPoints;
  const score=history?.intScore??skillIntelligence(c);
  return (Math.max(1,row.skillBase+Math.floor((score-10)/2))+racialBonusSkillPoints(c))*(index===0?4:1);
}

/** One actual Hit Die grant; shared by ordinary and paired-level history. */
export function hitPointGrant(c:Character,row:LevelRow,index:number,con=Math.floor((effectiveScore(c,'CON')-10)/2)):number {
 const raw=index===0||c.automation.hpMethod==='maximum'?row.die:c.automation.hpMethod==='rolled'?Math.min(row.die,c.automation.history.find(h=>h.key===row.key)?.hitDieRoll??c.automation.hpRolls[index]??Math.ceil((row.die+1)/2)):(index%2===1?Math.ceil((row.die+1)/2):Math.floor((row.die+1)/2));
 return Math.max(1,raw+con);
}
