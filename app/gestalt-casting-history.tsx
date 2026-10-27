import type {Character} from '@/lib/model';
import {findClass} from '@/lib/classes';
import {advancementCandidates} from '@/lib/advancement';

export function GestaltCastingHistory({c}:{c:Character}){
 if(c.advancementMode!=='gestalt')return null;
 const rows=c.gestaltProgression!.levels.flatMap((row,index)=>(row.castingTargets??[]).map(target=>({level:index+1,...target})));
 if(!rows.length)return <p className="fine">Paired level-up will record prestige casting choices separately for each new level. Existing unrecorded levels still use the class-wide settings below.</p>;
 return <details><summary>Recorded prestige casting choices by character level</summary>
  <p className="fine">These choices stay with their recorded pairs. Class-wide settings below affect only unrecorded historical levels and suggestions for future advancement. Use paired level-up to choose the next level's target.</p>
  <ul>{rows.map(row=>{
   const entry=c.classLevels.find(e=>e.classId===row.classId);
   const target=entry&&advancementCandidates(c,entry,row.kind).find(p=>p.id===row.traditionId);
   return <li key={row.level+':'+row.classId+':'+row.kind}>Character level {row.level}, {findClass(row.classId)?.name??row.classId} ({row.kind==='psi'?'manifesting':row.kind==='divine'?'divine':'spellcasting'}): {row.traditionId==='none'?'No advancement':target?.name??'Recorded tradition is missing or no longer eligible; no automatic replacement is applied.'}</li>;
  })}</ul>
 </details>;
}
