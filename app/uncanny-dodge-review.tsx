'use client';
import {useState} from 'react';
import {ZodError} from 'zod';
import {uncannyDodgeFeatures} from '@/lib/defensive-class-features';
import {previewUncannyDodgeRuling,applyUncannyDodgeRuling,type UncannyDodgeReview} from '@/lib/uncanny-dodge-ruling';
import {Btn,F,Choice,type SheetProps} from './sheet-ui';

export function UncannyDodgeRuling({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const f=uncannyDodgeFeatures(c),saved=c.classSystems.uncannyDodgeRuling;
 const [improved,setImproved]=useState(saved?.decision.improved??f.automaticImproved);
 const [minimum,setMinimum]=useState(saved?.decision.minimumRogueLevel?.toString()??'');
 const [gm,setGm]=useState(saved?.decision.gm??''),[reason,setReason]=useState(saved?.decision.reason??'');
 const [review,setReview]=useState<UncannyDodgeReview|null>(null),[error,setError]=useState('');
 const changed=()=>{setReview(null);setError('');};
 const report=(e:unknown)=>setError(e instanceof ZodError?e.issues.slice(0,3).map(issue=>issue.message).join(' '):e instanceof Error?e.message:'Check the ruling details.');
 if(!f.rulingEligible&&!saved)return null;
 const summarize=(improved:boolean,minimum:number|null)=>improved?'granted; minimum attacker rogue level '+(minimum??'needs review'):'not granted';
 const prepare=()=>{
  if(improved&&!/^\d+$/.test(minimum.trim())){setError('Enter a positive whole-number minimum attacker rogue level.');return;}
  try{setReview(previewUncannyDodgeRuling(c,{improved,minimumRogueLevel:improved?Number(minimum):null,gm,reason}));setError('');}
  catch(e){report(e);}
 };
 return <details className="subcard"><summary>Review mixed gestalt Uncanny Dodge</summary>
  <p className="fine">The shared-feature rule does not fully specify these mixed or staggered histories. Record the timing and rogue-level exception agreed with your GM. This is an explicit table ruling, not an automatic standard rule. It cannot remove a listed improvement, restore a surrendered feature, or waive psionic focus.</p>
  {saved&&<p className="fine">Saved ruling: {summarize(saved.decision.improved,saved.decision.minimumRogueLevel)} · {saved.decision.gm} · {saved.decision.reason}. {f.staleRuling||f.incompatibleRuling?'Needs review; retained but not applied.':f.rulingApplied?'Applied to the reviewed progression.':'Temporarily inactive; required sources must be available.'}</p>}
  {f.rulingEligible?<><div className="fields two">
   <Choice label="Reviewed Improved Uncanny Dodge" value={improved?'granted':'not-granted'} options={[["not-granted","Not yet granted"],["granted","Granted"]]} onChange={v=>{setImproved(v==='granted');changed();}}/>
   {improved&&<F label="Minimum attacker rogue level" value={minimum} onChange={v=>{setMinimum(v);changed();}}/>}
   <F label="GM name" value={gm} onChange={v=>{setGm(v);changed();}}/>
   <F label="Sources and ruling" value={reason} onChange={v=>{setReason(v);changed();}} area/>
  </div><p className="fine">Changing the progression or relevant feature replacements requires a new review. Temporary loss of focus suspends a dependent ruling; it does not erase the record.</p>
  {!review&&<Btn disabled={!gm.trim()||!reason.trim()||improved&&!minimum.trim()} onClick={prepare}>Review ruling</Btn>}
  {review&&<div aria-label="Uncanny Dodge ruling confirmation"><p>Improved Uncanny Dodge: {summarize(review.before.improved,review.before.minimumRogueLevel)} → {summarize(review.ruling.decision.improved,review.ruling.decision.minimumRogueLevel)}.</p><p className="fine">GM: {review.ruling.decision.gm}. {review.ruling.decision.reason}{review.suspended?' Saved for this progression; temporarily inactive until the reviewed sources are available.':''}</p><div className="button-row"><Btn onClick={()=>{try{edit(d=>applyUncannyDodgeRuling(d,review));setReview(null);setError('');}catch(e){setError(e instanceof Error?e.message:'Review the ruling again.');}}}>Confirm ruling</Btn><Btn onClick={()=>{setReview(null);setError('');}}>Cancel review</Btn></div></div>}
  </>:<p className="fine">This character no longer has a supported mixed gestalt case. Its saved ruling remains available for reference.</p>}
  {error&&<p className="error-text" role="alert">{error}</p>}
  {saved&&<Btn onClick={()=>{edit(d=>{delete d.classSystems.uncannyDodgeRuling;});changed();}}>Clear saved ruling and use automatic rules</Btn>}
 </details>;
}
