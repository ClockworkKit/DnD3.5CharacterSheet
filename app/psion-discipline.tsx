'use client';
import {psionDisciplines,psionDisciplineRules,type PsionDiscipline} from '@/lib/psion-disciplines';
import {Choice} from './sheet-ui';

export function PsionDisciplineChoice({value,onChange}:{value?:PsionDiscipline,onChange:(value?:PsionDiscipline)=>void}){
 return <>
  <Choice label="Psion discipline" value={value??'unrecorded'}
   options={[['unrecorded','Choose a discipline'],...psionDisciplines.map(d=>[d,d+' ('+psionDisciplineRules[d].school+')'] as [string,string])]}
   onChange={id=>onChange(psionDisciplines.find(d=>d===id))}/>
  {!value&&<p className="fine">A first-level Psion chooses a discipline for additional class skills and powers.</p>}
  {value&&<p className="fine">Additional Psion class skills include {psionDisciplineRules[value].skills.join(', ')}.</p>}
 </>;
}
