'use client';
import {prestigeEligibility} from '@/lib/prerequisites';
import {PrerequisiteStatus} from './prerequisite-status';
import {useState} from 'react';
import {levelUpStatus,levelUpClasses,needsPsionDiscipline,gainLevel} from '@/lib/level-up';
import {standardCastingChoices} from '@/lib/gestalt-casting';
import {classTotals} from '@/lib/classes';
import {Btn,Choice,N,type SheetProps} from './sheet-ui';
import {toast} from 'sonner';
import {GestaltLevelUp} from './gestalt-level-up';
import {PsionDisciplineChoice} from './psion-discipline';
import type {PsionDiscipline} from '@/lib/psion-disciplines';
export function LevelUp({c,edit,navigate}:Pick<SheetProps,'c'|'edit'>&{navigate:(tab:string)=>void}){
 const [discipline,setDiscipline]=useState<PsionDiscipline>();
 const [targets,setTargets]=useState<Record<string,string>>({}),[error,setError]=useState('');
 const [showAll,setShowAll]=useState(false);const [selected,setSelected]=useState(''),[die,setDie]=useState(1);const n=levelUpStatus(c);if(!n.available)return null;
 if(c.advancementMode==='gestalt')return <GestaltLevelUp c={c} edit={edit} navigate={navigate}/>;
 const options=levelUpClasses(c,showAll),choice=options.find(d=>d.id===selected)||options.find(d=>c.classLevels.some(e=>e.classId===d.id))||options[0];
 const enteringPsion=!!choice&&needsPsionDiscipline(c,[choice.id]);
 const castingChoices=choice?standardCastingChoices(c,choice.id):[];
 const eligibility=choice?prestigeEligibility(c,choice):null,entering=choice?.kind==='Prestige'&&!c.classLevels.some(e=>e.classId===choice.id);const supported=c.classLevels.length>0&&!classTotals(c.classLevels,c.ancestry,c).missing.length;
 function advance(){
  if(!choice)return;
  try{
   const castingTargets=castingChoices.map(q=>{
    const traditionId=targets[q.kind]??q.selected;
    if(!traditionId)throw new Error('Choose '+q.label+' before gaining this level.');
    return {classId:q.classId,kind:q.kind,traditionId};
   });
   edit(d=>gainLevel(d,choice.id,die,castingTargets,enteringPsion?discipline:undefined));
   setTargets({});setDie(1);setError('');
   toast.success('Level gained. Allocate skill points and review earned abilities, feats, and spells.');
  }catch(e){setError(e instanceof Error?e.message:'Could not gain this level.');}
 }
 return <section className="level-up-notice" aria-label="Level up"><div role="status"><h2>Level up available</h2></div><p>{c.experience.toLocaleString()} XP qualifies for effective level {n.eligible}. You have {n.available} level{n.available===1?'':'s'} to take.</p><Btn className="quiet" onClick={()=>setShowAll(v=>!v)}>{showAll?"Show eligible classes":"Show all classes"}</Btn>{!c.automation.enabled?<Btn onClick={()=>navigate('calculations')}>Enable automatic calculations</Btn>:!supported?<Btn onClick={()=>navigate('classes')}>Record class levels</Btn>:choice?<><Choice label="Class to advance" value={choice.id} options={options.map(d=>[d.id,d.name+' · '+(c.classLevels.some(e=>e.classId===d.id)?'next level':'new class')])} onChange={v=>{setSelected(v);setDiscipline(undefined);setDie(1);setTargets({});setError('')}}/>
 {enteringPsion&&<PsionDisciplineChoice value={discipline} onChange={value=>{setDiscipline(value);setError('');}}/>}
 {castingChoices.map(q=><Choice key={q.kind} label={q.label} value={(targets[q.kind]??q.selected)||'choose'} options={[["choose","Choose a tradition"],["none","No advancement this level"],...q.candidates.map(p=>[p.id,p.name] as [string,string])]} onChange={v=>{setTargets(t=>({...t,[q.kind]:v==='choose'?'':v}));setError('')}}/>)}{!!castingChoices.length&&<p className="fine">Each target is saved with this class level. Earlier prestige choices remain unchanged.</p>}{entering&&eligibility&&<PrerequisiteStatus value={eligibility} edit={edit}/>}{c.automation.hpMethod==='rolled'&&<N label={'New Hit Die roll (d'+choice.hitDie+')'} value={die} min={1} max={choice.hitDie} onChange={setDie}/>}<Btn className="primary" disabled={(enteringPsion&&!discipline)||(!!entering&&!eligibility?.eligible)} onClick={advance}>Gain level {n.hd+1} in {choice.name}</Btn></>:<p>No further class levels are supported by the class library.</p>}{error&&<p role="alert">{error}</p>}<p className="fine">Take one level at a time so you can make advancement choices before the next level. XP is retained, existing damage and spent uses are preserved. New prestige classes must meet their entry requirements. Existing prestige classes can continue advancing. Level adjustment counts toward the XP threshold unless ignored in your race settings.</p></section>;
}
