'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {ZodError} from 'zod';
import {findClass} from '@/lib/classes';
import {gestaltClassPolicies} from '@/lib/gestalt-progression';
import {gestaltCastingChoices} from '@/lib/gestalt-casting';
import {applyGestaltLevel,levelUpClasses,levelUpStatus,previewGestaltLevel,type GestaltLevelPreview} from '@/lib/level-up';
import {prestigeEligibility} from '@/lib/prerequisites';
import {Btn,Choice,F,N,type SheetProps} from './sheet-ui';
import {PrerequisiteStatus} from './prerequisite-status';

type Props=Pick<SheetProps,'c'|'edit'>&{navigate:(tab:string)=>void};
type Approval={gm:string;reason:string};
const signed=(n:number)=>(n>=0?'+':'')+n;
const errorMessage=(error:unknown,fallback:string)=>error instanceof ZodError?error.issues.slice(0,3).map(issue=>issue.message).join(' '):error instanceof Error?error.message:fallback;

/** Only explicit paired characters enter this workflow; no legacy save conversion. */
export function GestaltLevelUp({c,edit,navigate}:Props){
 const last=c.gestaltProgression?.levels.at(-1);
 const [left,setLeft]=useState(()=>c.classLevels.find(e=>e.id===last?.left)?.classId??'');
 const [right,setRight]=useState(()=>c.classLevels.find(e=>e.id===last?.right)?.classId??'');
 const [die,setDie]=useState(1),[approvals,setApprovals]=useState<Record<string,Approval>>({});
 const [review,setReview]=useState<GestaltLevelPreview>(),[error,setError]=useState('');
 const [targetSelection,setTargetSelection]=useState<Record<string,string>>({});
 const status=levelUpStatus(c),options=levelUpClasses(c,true);
 const sides=[left,right].map(id=>options.find(d=>d.id===id));
 const castingChoices=gestaltCastingChoices(c,[left,right]);
 const hitDie=Math.max(...sides.map(d=>d?.hitDie??1));
 const combinationClasses=[...new Set([left,right])].filter(id=>(gestaltClassPolicies[id]?.combinationPrestige||c.customClasses?.find(row=>row.definition.id===id)?.policy.combinationPrestige));
 const stale=!!review&&review.source!==JSON.stringify(c);
 const clearReview=()=>{setReview(undefined);setError('');};
 function choose(side:'left'|'right',id:string){
  (side==='left'?setLeft:setRight)(id);setDie(1);setApprovals({});setTargetSelection({});clearReview();
 }
 function prepare(){
  try{
   const missing=combinationClasses.find(id=>!approvals[id]?.gm.trim()||!approvals[id]?.reason.trim());
   if(missing)throw new Error('Record the approving GM and reason for '+findClass(missing,c)?.name+'.');
   const castingTargets=castingChoices.map(choice=>{
    const traditionId=targetSelection[choice.classId+':'+choice.kind]??choice.selected;
    if(!traditionId)throw new Error('Choose '+choice.label+' before reviewing this level.');
    return {classId:choice.classId,kind:choice.kind,traditionId};
   });
   setReview(previewGestaltLevel(c,{left,right,hitDieRoll:die,castingTargets,approvals:combinationClasses.map(classId=>({classId,gm:approvals[classId].gm.trim(),reason:approvals[classId].reason.trim()}))}));
   setError('');
  }catch(e){setReview(undefined);setError(errorMessage(e,'Could not preview this level.'));}
 }
 function confirm(){
  if(!review)return;
  try{
   edit(d=>applyGestaltLevel(d,review));clearReview();setApprovals({});setTargetSelection({});setDie(1);
   toast.success('Paired level gained. Allocate skill points and review earned abilities, feats, and spells.');
  }catch(e){setError(errorMessage(e,'Could not apply this level.'));}
 }
 return <section className="level-up-notice" aria-label="Paired level up">
  <h2 role="status">Paired level up available</h2>
  <p>{c.experience.toLocaleString()} XP qualifies for effective level {status.eligible}. Advance both classes together to gain one character level.</p>
  {!c.automation.enabled?<Btn onClick={()=>navigate('calculations')}>Enable automatic calculations</Btn>:<>
   <p>Choose each side independently. New prestige classes must qualify before this level; a GM approval does not waive their prerequisites.</p>
   {(['left','right'] as const).map((side,i)=>{
    const selected=side==='left'?left:right,def=sides[i];
    const entering=def?.kind==='Prestige'&&!c.classLevels.some(e=>e.classId===def.id);
    return <div key={side}>
     <Choice label={side==='left'?'Left class to advance':'Right class to advance'} value={selected} onChange={id=>choose(side,id)} options={options.map(d=>[d.id,d.name+' '+((c.classLevels.find(e=>e.classId===d.id)?.level??0)+1)])}/>
     {!def&&<p>Choose a class with another supported level.</p>}
     {entering&&<PrerequisiteStatus value={prestigeEligibility(c,def)} edit={edit}/>}
    </div>;
   })}
   {castingChoices.length>0&&<fieldset><legend>Prestige advancement for this level</legend>
    <p className="fine">Choose a tradition held before entering this prestige class. Each choice is saved with this pair; earlier gains stay where they were. Overlapping advancement of the same tradition counts once.</p>
    {castingChoices.map(choice=>{
     const key=choice.classId+':'+choice.kind;
     return <Choice key={key} label={choice.label} value={(targetSelection[key]??choice.selected)||'choose'} options={[[ 'choose','Choose a tradition'],['none','No advancement this level'],...choice.candidates.map(p=>[p.id,p.name] as [string,string])]} onChange={value=>{setTargetSelection(previous=>({...previous,[key]:value==='choose'?'':value}));clearReview();}}/>;
    })}
   </fieldset>}
   {combinationClasses.map(id=><fieldset key={id}>
    <legend>{findClass(id,c)?.name}: combination-class approval for this level</legend>
    <p className="fine">Only record approval already given by your GM. This exception is saved with this pair, not applied to future levels.</p>
    <F label={'Approving GM for '+findClass(id,c)?.name} value={approvals[id]?.gm??''} onChange={gm=>{setApprovals(a=>({...a,[id]:{reason:a[id]?.reason??'',gm}}));clearReview();}}/>
    <F label={'Approval reason for '+findClass(id,c)?.name} area value={approvals[id]?.reason??''} onChange={reason=>{setApprovals(a=>({...a,[id]:{gm:a[id]?.gm??'',reason}}));clearReview();}}/>
   </fieldset>)}
   {c.automation.hpMethod==='rolled'?<N label={'One new Hit Die roll (d'+hitDie+')'} value={die} min={1} max={hitDie} onChange={v=>{setDie(v);clearReview();}}/>:<p>HP method: {c.automation.hpMethod}. The larger Hit Die is used once.</p>}
   <div className="button-row"><Btn disabled={sides.some(d=>!d)} onClick={prepare}>{review?'Refresh paired level review':'Review paired level'}</Btn></div>
   {error&&<p role="alert">{error}</p>}
   {stale&&<p role="status">The character changed. Refresh the paired level review before confirming.</p>}
   {review&&!stale&&<section aria-label="Paired level review" aria-live="polite">
    <h3>Review character level {review.summary.level}: {review.summary.label}</h3>
    <p>No changes have been saved yet. Confirming adds one level, one HP grant and one skill-point grant.</p>
    <dl>
     <dt>Hit points</dt><dd>d{review.summary.die}; maximum HP {c.maxHp} → {review.character.maxHp} ({signed(review.summary.hpGain)}). Current HP {c.hp} → {review.character.hp}; existing damage retained.</dd>
     <dt>Skill points</dt><dd>{signed(review.summary.skillPoints)} to allocate; existing ranks and historical Intelligence retained.</dd>
     <dt>Base attack bonus</dt><dd>{signed(review.summary.bab.before)} → {signed(review.summary.bab.after)}</dd>
     {(['fort','ref','will'] as const).map(stat=><div key={stat}><dt>{{fort:'Base Fortitude',ref:'Base Reflex',will:'Base Will'}[stat]}</dt><dd>{signed(review.summary.saves.before[stat])} → {signed(review.summary.saves.after[stat])}</dd></div>)}
    </dl>
    <details><summary>How this pair contributes BAB and saves</summary>
     <p>{c.gestaltProgression?.bonusMethod==='fractional-v1'?'Optional fractional bonuses; totals rounded down.':'Printed-table progressions (standard table convention).'}</p>
     <ul>{(['bab','fort','ref','will'] as const).map(stat=>{
      const b=review.summary.bonusDecision.bonuses[stat];
      return <li key={stat}>{{bab:'BAB',fort:'Fortitude',ref:'Reflex',will:'Will'}[stat]}: {findClass(b.classId,c)?.name} {b.classLevel}; contribution {c.gestaltProgression?.bonusMethod==='fractional-v1'?b.units+'/12':signed(b.tableDelta)}; resulting base {signed(b.total)}.</li>;
     })}</ul>
    </details>
    <h4>Class milestones</h4>
    <ul>{review.summary.milestones.map(m=><li key={m.classId}>{m.name} {m.level}: {m.text||'No new named class milestone.'}</li>)}</ul>
    <h4>New feat and ability choices</h4>
    {review.summary.choices.length?<ul>{review.summary.choices.map(choice=><li key={choice.key}>{choice.label}</li>)}</ul>:<p>No new feat or ability-score choices at this level.</p>}
    <p className="fine">Choices and skill points are allocated after confirmation; no feat or ability increase is selected automatically.</p>
    {review.summary.castingTargets.length>0&&<><h4>Prestige advancement this level</h4><ul>{review.summary.castingTargets.map(target=><li key={target.classId+':'+target.kind}>{findClass(target.classId,c)?.name} ({target.kind==='psi'?'manifesting':target.kind==='divine'?'divine':'spellcasting'}): {target.traditionId==='none'?'No advancement':(target.kind==='psi'?c.psionics:c.casters).find(p=>p.id===target.traditionId)?.name}.</li>)}</ul></>}
    {(review.summary.casting.length>0||review.summary.psionics.length>0)&&<>
     <h4>Resulting spellcasting and psionics</h4>
     <ul>{review.summary.casting.map(p=><li key={p.id}>{p.name}: caster level {p.level}; daily slots by spell level: {p.slots.map((max,i)=>i+': '+max).join(', ')}.</li>)}
      {review.summary.psionics.map(p=><li key={p.id}>{p.name}: manifester level {p.level}; maximum power points {p.points}.</li>)}</ul>
     <p className="fine">Check each tradition before confirming. Prestige targets are recorded for this level only; earlier automatic gains are retained. Spent slots, power points and uses are not refreshed.</p>
    </>}
    <div className="button-row"><Btn className="primary" onClick={confirm}>Confirm paired level {review.summary.level}</Btn><Btn onClick={clearReview}>Cancel level review</Btn></div>
   </section>}
  </>}
  <p className="fine">Take one actual level at a time. XP, existing choices and spent resources are retained. Level adjustment affects the XP threshold unless ignored in your race settings.</p>
 </section>;
}
