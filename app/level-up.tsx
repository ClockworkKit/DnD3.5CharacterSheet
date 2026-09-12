'use client';
import {useState} from 'react';
import {levelUpStatus,levelUpClasses,gainLevel} from '@/lib/level-up';
import {classTotals} from '@/lib/classes';
import {Btn,Choice,N,type SheetProps} from './sheet-ui';
import {toast} from 'sonner';
export function LevelUp({c,edit,navigate}:Pick<SheetProps,'c'|'edit'>&{navigate:(tab:string)=>void}){
 const [selected,setSelected]=useState(''),[die,setDie]=useState(1);const n=levelUpStatus(c);if(!n.available)return null;
 const options=levelUpClasses(c),choice=options.find(d=>d.id===selected)||options.find(d=>c.classLevels.some(e=>e.classId===d.id))||options[0];
 const supported=c.classLevels.length>0&&!classTotals(c.classLevels,c.ancestry).missing.length;
 return <section className="level-up-notice" aria-label="Level up"><h2 role="status">Level up available</h2><p>{c.experience.toLocaleString()} XP qualifies for effective level {n.eligible}. You have {n.available} level{n.available===1?'':'s'} to take.</p>{!c.automation.enabled?<Btn onClick={()=>navigate('calculations')}>Enable automatic calculations</Btn>:!supported?<Btn onClick={()=>navigate('classes')}>Record class levels</Btn>:choice?<><Choice label="Class to advance" value={choice.id} options={options.map(d=>[d.id,d.name+' · '+(c.classLevels.some(e=>e.classId===d.id)?'next level':'new class')])} onChange={v=>{setSelected(v);setDie(1)}}/>{choice.kind==='Prestige'&&<p className="fine">Confirm prestige prerequisites with your DM: {choice.requirements}</p>}{c.automation.hpMethod==='rolled'&&<N label={'New Hit Die roll (d'+choice.hitDie+')'} value={die} min={1} max={choice.hitDie} onChange={setDie}/>}<Btn className="primary" onClick={()=>{edit(d=>gainLevel(d,choice.id,die));toast.success('Level gained. Allocate skill points and review earned abilities, feats, and spells.')}}>Gain level {n.hd+1} in {choice.name}</Btn></>:<p>No further class levels are supported by the class library.</p>}<p className="fine">Take one level at a time so you can make advancement choices before the next level. XP is retained, existing damage and spent uses are preserved. Multiclass and prestige requirements need DM approval. Level adjustment counts toward the XP threshold unless ignored in your race settings.</p></section>;
}
