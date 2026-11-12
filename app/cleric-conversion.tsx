'use client';
import {useState} from 'react';
import type {Character,Caster,Spell} from '@/lib/model';
import {canCast} from '@/lib/rules';
import {alignmentChannel,clericConversionRoll,eligibleConversionSpell,spendClericConversion} from '@/lib/cleric-conversion';
import {Btn,Choice,Check,type SheetProps} from './sheet-ui';

export function ClericConversion({c,p,edit,roll,spells,byId}:Pick<SheetProps,'c'|'edit'|'roll'>&{p:Caster,spells:Spell[],byId:Map<string,Spell>}){
 const [donorId,setDonor]=useState(''),[spellId,setSpell]=useState(''),[hostile,setHostile]=useState(false);
 const fixed=alignmentChannel(c.alignment),channel=fixed??c.clericChannel;
 const available=p.spells.filter(k=>canCast(p,k,c));
 const donor=available.find(k=>k.id===donorId);
 const targets=donor?spells.filter(s=>eligibleConversionSpell(c,donor,s)).sort((a,b)=>b.levels.Cleric-a.levels.Cleric):[];
 const target=targets.find(s=>s.id===spellId);
 function cast(){
  if(!donor||!target)return;
  const result=clericConversionRoll(c,p.id,donor.id,target,hostile);
  if(roll(result))edit(d=>spendClericConversion(d,p.id,donor.id,target));
 }
 return <details><summary>Spontaneous Cleric casting</summary>
  {!fixed&&<><Choice label="Cleric channel" value={channel??'choose'} options={[[ 'choose','Choose the recorded channel'],['cure','Cure'],['inflict','Inflict']]}
   onChange={v=>{edit(d=>{if(v==='choose')delete d.clericChannel;else d.clericChannel=v as Character['clericChannel'];});setSpell('');}}/>
   <p className="fine">Use the channel allowed by your deity. A neutral cleric of a neutral deity records the same permanent choice used for turning or rebuking undead.</p></>}
  {channel&&<>{available.length?<Choice label="Preparation to spend" value={donor?.id??'choose'}
   options={[[ 'choose','Choose an unspent preparation'],...available.map(k=>[k.id,(k.custom?.name??byId.get(k.spellId)?.name??k.spellId)+' (slot '+k.slotLevel+', '+(k.prepared-k.spent)+' left)'] as [string,string])]}
   onChange={id=>{setDonor(id);setSpell('');}}/>:<p className="fine">Prepare an ordinary Cleric spell to use spontaneous casting.</p>}
  {donor&&<Choice label={'Spontaneous '+channel+' spell'} value={target?.id??'choose'}
   options={[[ 'choose','Choose a spell'],...targets.map(s=>[s.id,s.name+' (level '+s.levels.Cleric+')'] as [string,string])]}
   onChange={id=>{setSpell(id);setHostile(channel==='inflict');}}/>}
  {target&&/^touch\b/i.test(target.range)&&<Check label="Roll melee touch against an unwilling target" checked={hostile} onChange={setHostile}/>}
  {target&&<Btn onClick={cast}>Cast {target.name} using this preparation</Btn>}</>}
 </details>;
}
