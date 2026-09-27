'use client';
import {useState} from 'react';
import {alternateClassLevel,alternateSettings,configureAlternateFeature} from '@/lib/alternate-features';
import {alternateActions,alternateActionProblem,alternateActionRemaining,useAlternateAction as spendAlternateAction,endAlternateAction,type AlternateAction} from '@/lib/alternate-actions';
import {alternateFeatSlots,allowedAlternateFeats,alternateFeatSelectionProblem,selectAlternateBonusFeat,alternateWeaponChoices,selectedMonkStyle} from '@/lib/alternate-grants';
import {featChoices} from '@/lib/prerequisites';
import {advanceEffects} from '@/lib/effects';
import {Btn,N,Check,Choice,type SheetProps} from './sheet-ui';

function AbilityAction({c,edit,roll,ability:a}:SheetProps&{ability:AlternateAction}){
 const [cost,setCost]=useState(1),[error,setError]=useState('');
 const state=alternateSettings(c,a.featureId).actions[a.id],problem=alternateActionProblem(c,a.featureId,a.id,cost),remaining=alternateActionRemaining(c,a);
 return <div className="subcard"><h4>{a.name}</h4><p className="fine">{a.action}{a.pool?' · '+remaining+' remaining':''}{a.formula?' · '+a.formula:''}{a.dc!==undefined?' · '+a.save+' DC '+a.dc:''}</p><p>{a.description}</p>
  {a.variableCost&&<N label={a.name+' points to spend'} value={cost} min={1} max={10000} onChange={setCost}/>}
  {!!state?.rounds&&<p role="status">Active · {state.rounds} round{state.rounds===1?'':'s'} remaining</p>}
  {!!state?.cooldown&&<p className="fine">Recharge: {state.cooldown} round{state.cooldown===1?'':'s'}</p>}
  <div className="button-row"><Btn disabled={!!problem||!c.automation.enabled} onClick={()=>{try{const issue=alternateActionProblem(c,a.featureId,a.id,cost);if(issue)throw new Error(issue);if(roll({title:a.name,formula:a.formula,details:a.description+(a.variableCost?' Points spent: '+cost+'.':''),fields:[['Action',a.action],...(a.dc===undefined?[]:[['Save',a.save+' DC '+a.dc] as [string,string]])]}))edit(d=>spendAlternateAction(d,a.featureId,a.id,cost));setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to use ability.');}}}>Use {a.name}</Btn>
  {!!state?.rounds&&<Btn onClick={()=>edit(d=>endAlternateAction(d,a.featureId,a.id))}>End {a.name}</Btn>}</div>
  {problem&&<p className="fine">{problem}</p>}{error&&<p role="alert" className="error-text">{error}</p>}
 </div>;
}
function BonusFeat({c,edit,id,slot}:{c:SheetProps['c'],edit:SheetProps['edit'],id:string,slot:{key:string,level:number}}){
 const settings=alternateSettings(c,id),[pending,setPending]=useState(settings.rules[slot.key]||''),[choice,setChoice]=useState(settings.rules[slot.key+'-choice']||''),[error,setError]=useState('');
 const feats=allowedAlternateFeats(c,id),feat=feats.find(f=>f.id===pending),options=feat?featChoices(c,feat):[],problem=feat?alternateFeatSelectionProblem(c,id,slot.key,feat.id,choice):'Choose a bonus feat.';
 return <div className="subcard"><h4>Level {slot.level} bonus feat</h4><p className="fine">Current: {feats.find(f=>f.id===settings.rules[slot.key])?.name||'Unassigned'}{settings.rules[slot.key+'-choice']?' ('+settings.rules[slot.key+'-choice']+')':''}</p>
 <div className="fields two"><Choice label={'Level '+slot.level+' bonus feat'} value={pending||'__choose__'} options={[["__choose__","Choose a feat"],...feats.map(f=>[f.id,f.name] as [string,string])]} onChange={v=>{setPending(v==='__choose__'?'':v);setChoice('');}}/>
 {!!options.length&&<Choice label={'Level '+slot.level+' feat choice'} value={choice||'__choose__'} options={[["__choose__","Choose an option"],...options]} onChange={v=>setChoice(v==='__choose__'?'':v)}/>}</div>
 {problem&&<p className="fine">{problem}</p>}<div className="button-row"><Btn disabled={!!problem} onClick={()=>{try{edit(d=>selectAlternateBonusFeat(d,id,slot.key,pending,choice));setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to select feat.');}}}>Assign bonus feat</Btn><Btn disabled={!settings.rules[slot.key]} onClick={()=>edit(d=>selectAlternateBonusFeat(d,id,slot.key,''))}>Clear bonus feat</Btn></div>{error&&<p role="alert">{error}</p>}
 </div>;
}
export function AlternateRuleControls(props:SheetProps&{id:string}){
 const {c,edit,id}=props,s=alternateSettings(c,id),style=id==='monk-fighting-styles'?selectedMonkStyle(c):undefined,actions=alternateActions(c).filter(a=>a.featureId===id),slots=alternateFeatSlots(c,id);
 const weapon=id==='sorcerer-stalwart-sorcerer'||id==='monk-fighting-styles'&&s.choice==='Knight Hospitaller'||id==='ranger-combat-styles'&&s.choice==='Piscator';
 const rule=(key:string,value:string)=>edit(d=>configureAlternateFeature(d,id,{rules:{...alternateSettings(d,id).rules,[key]:value}}));
 return <div>
 {!c.automation.enabled&&<p className="fine">Enable automatic calculations in Calculations to apply granted feats and activate ability effects.</p>}
 {style&&<><p className="fine">Style feats: {style.feats.join(' → ')}. +2 {style.skill}.</p><p>{style.bonus}</p><p className="fine">Sixth-level benefit: {style.requirements} Requirements must have been met when monk level 6 was gained.</p><Check label="Qualified for this style’s sixth-level benefit when gained" checked={s.styleQualifiedAtSix} onChange={v=>edit(d=>configureAlternateFeature(d,id,{styleQualifiedAtSix:v}))}/></>}
 {id==='monk-draconic-fist'&&<Choice label="Draconic Fist energy" value={s.rules.energy||'__choose__'} options={[["__choose__","Choose an energy type"],'acid','cold','electricity','fire']} onChange={v=>rule('energy',v==='__choose__'?'':v)}/>}
 {weapon&&<Choice label="Granted weapon choice" value={s.rules.weapon||'__choose__'} options={[["__choose__","Choose a weapon"],...alternateWeaponChoices(id)]} onChange={v=>rule('weapon',v==='__choose__'?'':v)}/>}
 {slots.length>0&&<><p className="fine">Choose from supported feats below; prerequisites are checked before assignment. Source feats absent from this list can be recorded in Features after checking their requirements.{id==='soulknife-bonus-feats'?' Confirm the chosen feat works with your mind blade.':''}</p>{slots.map(slot=><BonusFeat key={slot.key} c={c} edit={edit} id={id} slot={slot}/>)}</>}
 {id==='swashbuckler-arcane-stunt'&&Array.from({length:alternateClassLevel(c,'swashbuckler')>=20?3:alternateClassLevel(c,'swashbuckler')>=11?2:1},(_,i)=><Choice key={i} label={'Arcane stunt '+(i+1)} value={s.rules['stunt-'+i]||'__choose__'} options={[["__choose__","Choose a stunt"],'Blur','Expeditious retreat','Feather fall','Jump','Spider climb']} onChange={v=>rule('stunt-'+i,v==='__choose__'?'':v)}/>)}
 {actions.map(a=><AbilityAction key={a.id} {...props} ability={a}/>)}
 {Object.values(s.actions).some(a=>a.rounds||a.cooldown)&&<Btn onClick={()=>edit(advanceEffects)}>Advance one round (all effects)</Btn>}
 </div>;
}
