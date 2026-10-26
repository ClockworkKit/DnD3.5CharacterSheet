'use client';
import {baseClasses,findClass} from '@/lib/classes';
import type {StartingClassPair} from '@/lib/character-creation';
import type {GestaltBonusMethod} from '@/lib/gestalt-schema';
import {Choice} from './sheet-ui';

export function GestaltStartingLevels({pairs,onChange,bonusMethod,onBonusMethod}:{pairs:StartingClassPair[];onChange:(pairs:StartingClassPair[])=>void;bonusMethod:GestaltBonusMethod;onBonusMethod:(method:GestaltBonusMethod)=>void}){
 const counts:Record<string,number>={};
 return <section aria-label="Starting paired levels">
  <h3>Gestalt starting levels</h3>
  <p className="fine">Each row is one actual character level. Either side can change classes. Use the larger Hit Die and skill allowance once, with both class skill lists and independent class features.</p>
  <Choice label="Gestalt BAB and saves" value={bonusMethod} onChange={v=>onBonusMethod(v as GestaltBonusMethod)} options={[[ 'printed-table-v1','Printed-table progressions (default)'],['fractional-v1','Optional fractional bonuses']]}/>
  {pairs.map((pair,i)=>{
   const labels=([pair.left,pair.right]).map(id=>{counts[id]=(counts[id]??0)+1;return (findClass(id)?.name??id)+' '+counts[id]});
   return <fieldset className="subcard" key={i}>
    <legend>Character level {i+1}: {labels.join(' // ')}</legend>
    <div className="fields two">{(['left','right'] as const).map(side=><Choice key={side} label={'Level '+(i+1)+' '+side+' class'} value={pair[side]} onChange={id=>onChange(pairs.map((p,index)=>index===i?{...p,[side]:id}:p))} options={baseClasses.map(d=>[d.id,d.name])}/>)}</div>
   </fieldset>;
  })}
  <p className="fine">Starting rows use base classes, as in standard creation. To enter a prestige class, create the earlier levels, allocate its required skills and feats, then use paired level-up. It checks entry requirements before either new class advances.</p>
 </section>;
}
