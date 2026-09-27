'use client';
import {alternateFeatureCatalog,alternateClassLevel,alternateFeatureProblem,alternateFeatureWarnings,alternateResources,selectAlternateFeature,spendAlternateResource} from '@/lib/alternate-features';
import {withBonus} from '@/lib/rules';
import {Btn,N,Section,type SheetProps} from './sheet-ui';

export function AlternateClassFeatures({c,edit,roll,confirm}:SheetProps){
 const choices=alternateFeatureCatalog.filter(d=>alternateClassLevel(c,d.classId)>0||c.alternateFeatures.selected.includes(d.id));
 if(!choices.length)return null;
 return <Section title="Alternate class features" note="Trade a standard class feature for an alternative from Ultimate SRD. This first set covers paladin options and cleric Divine Counterspell.">
  <p className="fine">Choose these when the original feature is gained. Later changes require your DM’s agreement. Removing a choice restores the standard feature and preserves spent uses.</p>
  {alternateFeatureWarnings(c).map(w=><p className="error-text" key={w}>{w}</p>)}
  {choices.map(d=>{const selected=c.alternateFeatures.selected.includes(d.id),problem=alternateFeatureProblem(c,d.id);return <div className="subcard" key={d.id}>
   <div className="row-head"><div><h3>{d.name}</h3><p className="fine">{d.classId==='paladin'?'Paladin':'Cleric'} {d.level} · Replaces {d.replacementLabels.join(', ')}</p></div><Btn aria-label={(selected?'Remove ':'Choose ')+d.classId+' '+d.name} disabled={!selected&&!!problem} onClick={()=>confirm((selected?'Remove ':'Choose ')+d.name+'?',selected?'Restore the original class feature. Spent uses remain recorded.':'Replace '+d.replacementLabels.join(', ')+'. Confirm that this choice is allowed for your character.',()=>edit(c=>selectAlternateFeature(c,d.id,!selected)))}>{selected?'Remove choice':'Choose'}</Btn></div>
   <p>{d.description}</p>{!selected&&problem&&<p className="fine">{problem}</p>}<a className="source-link" href={d.source} target="_blank" rel="noreferrer">Read on Ultimate SRD</a>
  </div>})}
  {alternateResources(c).map(r=>{const used=c.alternateFeatures.uses[r.key]||0,remaining=Math.max(0,r.max-used);const use=(cost:number,title:string)=>{if(roll({title,details:r.description,...(r.check===undefined?{}:{formula:withBonus('1d20',r.check)})}))edit(d=>spendAlternateResource(d,r.key,cost));};return <div className="subcard" key={r.key}>
   <h3>{r.name} uses</h3><p className="fine">{remaining} of {r.max} remaining this {r.period}. {r.description}</p><div className="feature-controls">
    <N label={r.name+' used this '+r.period} value={used} min={0} max={10000} onChange={v=>edit(d=>{d.alternateFeatures.uses[r.key]=v})}/>
    <Btn disabled={remaining<1} onClick={()=>use(1,r.key==='weekly:curse-breaker'?'Remove curse':r.name)}>{r.key==='weekly:curse-breaker'?'Remove curse (1 use)':r.check!==undefined?'Counterspell check':'Summon spirit'}</Btn>
    {r.key==='weekly:curse-breaker'&&alternateClassLevel(c,'paladin')>=12&&<Btn disabled={remaining<2} onClick={()=>use(2,'Break enchantment')}>Break enchantment (2 uses)</Btn>}
    {r.period==='week'&&<Btn disabled={!used} onClick={()=>confirm('Reset weekly uses?','Restore Curse Breaker after its weekly recovery. A daily rest does not restore this pool.',()=>edit(d=>{d.alternateFeatures.uses[r.key]=0}))}>Reset weekly uses</Btn>}
   </div>
  </div>})}
 </Section>;
}
