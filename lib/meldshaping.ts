import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import {findClass} from './classes.ts';
import {characterGestaltRows} from './gestalt-progression.ts';
import {essentiaRulingSchema} from './meldshaping-schema.ts';

const classes=['incarnate','soulborn','totemist'] as const;
const tableRow=(id:string,level:number)=>findClass(id)?.levels.find(r=>r.level===level);
const column=(id:string,level:number,index:number)=>Number(tableRow(id,level)?.extra[index]??0);

/** Read-only limits. Independent meld lists/binds share one Constitution ceiling
 * and essentia pool (Magic of Incarnum p. 20). No recorded meld is removed. */
export function meldshapingSummary(c:Character){
 const sources=classes.flatMap(classId=>{
  const level=c.classLevels.filter(e=>e.classId===classId).reduce((sum,e)=>sum+e.level,0);
  return level?[{classId,name:findClass(classId)!.name,level,tableAvailable:!!tableRow(classId,level),soulmelds:column(classId,level,0),essentia:column(classId,level,1)}]:[];
 });
 const choices=c.classSystems.choices.filter(s=>s.kind==='soulmeld');
 const constitutionLimit=Math.max(0,effectiveScore(c,'CON')-10);
 const classSoulmelds=sources.reduce((sum,s)=>sum+s.soulmelds,0),classEssentia=sources.reduce((sum,s)=>sum+s.essentia,0);
 const rows=characterGestaltRows(c);
 // Side placement and entry UUIDs do not change the reviewed mechanics. Include
 // actual levels and source table values so advancement cannot reuse a stale total.
 const progression=JSON.stringify({version:1,mode:c.advancementMode??'standard',
  classes:sources.map(s=>[s.classId,s.level,s.essentia]),
  levels:rows?.map(r=>[r.left,r.right].map(s=>[s.classId,s.classLevel]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))??null});
 const tableMissing=sources.some(s=>!s.tableAvailable);
 let automaticEssentia:number|null=tableMissing?null:classEssentia;
 const overlapLevels:number[]=[];
 if(rows&&!tableMissing){
  const active=sources.filter(s=>s.essentia>0),neighbors=new Map<string,Set<string>>(active.map(s=>[s.classId,new Set()]));
  rows.forEach((row,index)=>{
   const a=row.left,b=row.right;
   if(neighbors.has(a.classId)&&neighbors.has(b.classId)&&column(a.classId,a.classLevel,1)>0&&column(b.classId,b.classLevel,1)>0){
    neighbors.get(a.classId)!.add(b.classId);neighbors.get(b.classId)!.add(a.classId);overlapLevels.push(index+1);
   }
  });
  automaticEssentia=0;const visited=new Set<string>();
  for(const source of active){
   if(visited.has(source.classId))continue;
   const pending:string[]=[source.classId],group:string[]=[];
   while(pending.length){const id=pending.pop()!;if(visited.has(id))continue;visited.add(id);group.push(id);pending.push(...neighbors.get(id)!);}
   if(group.length===1){automaticEssentia+=source.essentia;continue;}
   const histories=group.map(id=>rows.flatMap((row,i)=>row.left.classId===id||row.right.classId===id?[i]:[]));
   const parallel=histories.every(h=>h.length===histories[0].length&&h.every((n,i)=>n===histories[0][i]));
   // The supported gestalt convention requires a consistently dominant,
   // simultaneous table. Never alternate rounded gains or sum both sides.
   const dominant=parallel?group.find(id=>histories[0].every((_,i)=>group.every(other=>column(id,i+1,1)>=column(other,i+1,1)))):undefined;
   if(!dominant){automaticEssentia=null;break;}
   automaticEssentia+=column(dominant,histories[0].length,1);
  }
 }
 const ruling=c.classSystems.essentiaRuling;
 const staleRuling=!!ruling&&ruling.progression!==progression;
 const essentia=ruling?(staleRuling?null:ruling.total):automaticEssentia;
 const review=staleRuling?'Essentia: the saved GM ruling needs review after progression changed. Its total is retained but is not applied.'
  :tableMissing&&!ruling?'Essentia: a class level has no supported meldshaping table. Review its source; no total is extrapolated.'
  :automaticEssentia===null&&!ruling?'Essentia: mixed or staggered gestalt meldshaping needs a GM ruling for the shared pool. No combined total is inferred.':'';
 return {sources,tableMissing,constitutionLimit,classSoulmelds,soulmeldLimit:tableMissing?null:Math.min(constitutionLimit,classSoulmelds),shaped:choices.length,
  allocated:choices.reduce((sum,s)=>sum+s.essentia,0),classEssentia,automaticEssentia,essentia,overlapLevels,progression,staleRuling,review};
}

export function recordEssentiaRuling(c:Character,input:{total:number;gm:string;reason:string}){
 const ruling=essentiaRulingSchema.parse({...input,version:1,progression:meldshapingSummary(c).progression});
 c.classSystems.essentiaRuling=ruling;
}

export function meldshapingWarnings(c:Character){
 const m=meldshapingSummary(c),warnings:string[]=[];
 if(m.shaped>m.constitutionLimit)warnings.push('Soulmelds: '+m.shaped+' shaped across all classes exceeds the Constitution limit of '+m.constitutionLimit+'. Recorded choices are retained.');
 if(m.review)warnings.push(m.review);
 if(m.essentia!==null&&m.allocated>m.essentia)warnings.push('Soulmeld investments exceed the '+(c.classSystems.essentiaRuling?'GM-reviewed essentia pool':c.advancementMode==='gestalt'?'shared gestalt class essentia pool':'combined class essentia pool')+' of '+m.essentia+'.');
 return warnings;
}
