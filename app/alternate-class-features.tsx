'use client';
import {useState} from 'react';
import {alternateFeatureCatalog,alternateClassLevel,alternateFeatureProblem,alternateFeatureWarnings,alternateResources,selectAlternateFeature,spendAlternateResource,alternateSettings,alternateReplacementLabels,configureAlternateFeature,alternateResourceUsed,setAlternateResourceUsed} from '@/lib/alternate-features';
import type {AlternateSettings} from '@/lib/alternate-feature-schema';
import {findClass} from '@/lib/classes';
import {withBonus} from '@/lib/rules';
import {Btn,N,F,Check,Choice,Section,type SheetProps} from './sheet-ui';

export function AlternateClassFeatures({c,edit,roll,confirm}:SheetProps){
 const [search,setSearch]=useState(''),[scope,setScope]=useState('mine'),[view,setView]=useState('all'),[limit,setLimit]=useState(30),[error,setError]=useState('');
 const attempt=(action:()=>void)=>{try{action();setError('');}catch(e){setError(e instanceof Error?e.message:'Unable to update this choice.');}};
 const configure=(id:string,patch:Partial<AlternateSettings>)=>attempt(()=>edit(d=>configureAlternateFeature(d,id,patch)));
 const choices=alternateFeatureCatalog.filter(d=>(scope==='all'||alternateClassLevel(c,d.classId)>0||c.alternateFeatures.selected.includes(d.id))&&(view==='all'||view==='selected'&&c.alternateFeatures.selected.includes(d.id)||view==='references'&&d.kind==='reference')&&[d.name,d.classId,d.description,...d.replacementLabels,...(d.choices||[])].join(' ').toLowerCase().includes(search.toLowerCase()));
 return <Section title="Alternate class features" note="Search the Ultimate SRD class-feature catalog and record your character’s trades.">
  <p className="fine">Choose a replacement when the original feature is gained; later changes require your DM’s agreement. Check the linked source for prerequisites and effects. Rule notes and custom trackers cover abilities that need table resolution. Removing a choice preserves its notes and spent uses.</p>
  <div className="fields three"><F label="Search alternate features" value={search} onChange={v=>{setSearch(v);setLimit(30)}}/><Choice label="Catalog scope" value={scope} onChange={v=>{setScope(v);setLimit(30)}} options={[["mine","My classes"],["all","All classes"]]}/><Choice label="Show features" value={view} onChange={v=>{setView(v);setLimit(30)}} options={[["all","All features"],["selected","Selected"],["references","Reference collections"]]}/></div>
  <p className="fine">{choices.length} matching options · {c.alternateFeatures.selected.length} selected</p>
  {error&&<p className="error-text" role="alert">{error}</p>}
  {alternateFeatureWarnings(c).map(w=><p className="error-text" key={w}>{w}</p>)}
  {choices.slice(0,limit).map(d=>{const selected=c.alternateFeatures.selected.includes(d.id),settings=alternateSettings(c,d.id),problem=alternateFeatureProblem(c,d.id),reference=d.kind==='reference';return <div className="subcard" key={d.id}>
   <div className="row-head"><div><h3>{d.name}</h3><p className="fine">{findClass(d.classId)?.name||d.classId} {d.levels?(settings.level??d.level):d.level} · {reference?'Reference collection':d.replaces.length?'Replaces '+alternateReplacementLabels(c,d).join(', '):'Optional rule'}</p></div>{!reference&&<Btn aria-label={(selected?'Remove ':'Choose ')+d.classId+' '+d.name} disabled={!selected&&!!problem} onClick={()=>confirm((selected?'Remove ':'Choose ')+d.name+'?',selected?'Restore the original class feature. Spent uses remain recorded.':'Confirm this source option is allowed for your character.',()=>attempt(()=>edit(c=>selectAlternateFeature(c,d.id,!selected))))}>{selected?'Remove choice':'Choose'}</Btn>}</div>
   <p>{d.description}</p><a className="source-link" href={d.source} target="_blank" rel="noreferrer">Read on Ultimate SRD</a>
   {reference?<p className="fine">This section contains several choices. Use the source to record the individual companion, familiar, racial variant, or other rule on the appropriate sheet tab.</p>:<details open={selected||undefined}><summary>Requirements, options and trackers</summary>
    {d.requirementsNote&&<p className="fine">{d.requirementsNote}</p>}
    <div className="fields three">
     {d.levels&&<Choice label={d.name+' replacement level'} value={String(settings.level??d.level)} onChange={v=>configure(d.id,{level:Number(v)})} options={d.levels.map(l=>[String(l),'Level '+l])}/>}
     {d.choices&&<Choice label={d.name+' option'} value={settings.choice||'__choose__'} onChange={v=>configure(d.id,{choice:v==='__choose__'?'':v})} options={[["__choose__","Choose an option"],...d.choices]}/>}
     {d.choiceRequired&&!d.choices&&<F label={d.name+' option'} value={settings.choice} onChange={v=>configure(d.id,{choice:v})} placeholder="Domain, feat, fighting style, or other required choice"/>}
    </div>
    {d.review&&<Check label={'I checked the source prerequisites for '+d.name} checked={settings.reviewed} onChange={v=>configure(d.id,{reviewed:v})}/>}
    {d.activation&&<Check label={d.activation+' — '+d.name} checked={settings.active} onChange={v=>configure(d.id,{active:v})}/>}
    <F area label={d.name+' rule notes'} value={settings.notes} onChange={v=>configure(d.id,{notes:v})} placeholder="Record benefits, prerequisites, limits, and choices resolved at the table."/>
    <p className="fine">Automatic calculations cover supported bonuses and lost features. Use Effects for other modifiers and record spell, feat, companion, or power choices in their sheet tabs.</p>
    {settings.counters.map(counter=><div className="subcard" key={counter.id}><div className="fields three"><F label="Tracker name" value={counter.name} onChange={v=>configure(d.id,{counters:settings.counters.map(r=>r.id===counter.id?{...r,name:v||'Ability'}:r)})}/><N label={counter.name+' maximum uses'} value={counter.max} min={0} max={10000} onChange={v=>configure(d.id,{counters:settings.counters.map(r=>r.id===counter.id?{...r,max:v}:r)})}/><Choice label={counter.name+' recovery'} value={counter.period} options={['day','week','encounter','manual']} onChange={v=>configure(d.id,{counters:settings.counters.map(r=>r.id===counter.id?{...r,period:v as typeof r.period}:r)})}/></div><Btn onClick={()=>confirm('Remove tracker?','Delete this tracker and its spent-use record.',()=>configure(d.id,{counters:settings.counters.filter(r=>r.id!==counter.id)}))}>Remove tracker</Btn></div>)}
    <Btn disabled={settings.counters.length>=12} onClick={()=>configure(d.id,{counters:[...settings.counters,{id:crypto.randomUUID(),name:d.name,max:1,used:0,period:'day'}]})}>Add use tracker</Btn>
   </details>}
   {!selected&&problem&&!reference&&<p className="fine">{problem}</p>}
  </div>})}
  {!choices.length&&<p>No matching features. Try another search or choose All classes.</p>}
  {choices.length>limit&&<Btn onClick={()=>setLimit(v=>v+30)}>Show more features</Btn>}
  {alternateResources(c).map(r=>{const used=alternateResourceUsed(c,r.key),remaining=Math.max(0,r.max-used);const use=(cost:number,title:string)=>attempt(()=>{if(roll({title,details:r.description,...(r.check===undefined?{}:{formula:withBonus('1d20',r.check)})}))edit(d=>spendAlternateResource(d,r.key,cost));});return <div className="subcard" key={r.key}>
   <h3>{r.name} uses</h3><p className="fine">{remaining} of {r.max} remaining · {r.period} recovery. {r.description}</p><div className="feature-controls">
    <N label={r.name+' used this '+r.period} value={used} min={0} max={10000} onChange={v=>attempt(()=>edit(d=>setAlternateResourceUsed(d,r.key,v)))}/>
    <Btn disabled={remaining<1} onClick={()=>use(1,r.key==='weekly:curse-breaker'?'Remove curse':r.name)}>{r.key==='weekly:curse-breaker'?'Remove curse (1 use)':r.check!==undefined?'Counterspell check':r.key.startsWith('daily:spirit-')?'Summon spirit':'Use ability'}</Btn>
    {r.key==='weekly:curse-breaker'&&alternateClassLevel(c,'paladin')>=12&&<Btn disabled={remaining<2} onClick={()=>use(2,'Break enchantment')}>Break enchantment (2 uses)</Btn>}
    {r.period!=='day'&&<Btn disabled={!used} onClick={()=>confirm('Reset '+r.period+' uses?','Restore this pool after its '+r.period+' recovery. A daily rest does not restore it.',()=>attempt(()=>edit(d=>setAlternateResourceUsed(d,r.key,0))))}>Reset {r.period==='week'?'weekly':r.period} uses</Btn>}
   </div>
  </div>})}
 </Section>;
}
