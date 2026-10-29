'use client';
import {useState} from 'react';
import {toast} from 'sonner';
import {ZodError} from 'zod';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {characterClasses} from '@/lib/classes';
import type {CustomClass} from '@/lib/custom-class-schema';
import {gestaltClassFamily} from '@/lib/gestalt-class-families';
import {customClassDraft,customClassTable,previewCustomClassChange,applyCustomClassChange,type CustomClassPreview} from '@/lib/custom-class-editor';
import {F,N,Choice,Check,Btn,Section,type SheetProps} from './sheet-ui';

/** Drafts stay local until the player reviews and explicitly applies the table. */
export function CustomClassEditor({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const [draft,setDraft]=useState<CustomClass|null>(null);
 const [review,setReview]=useState<CustomClassPreview|null>(null);
 const [checked,setChecked]=useState(false),[error,setError]=useState(''),[milestone,setMilestone]=useState(1);
 const report=(e:unknown)=>setError(e instanceof ZodError?e.issues.slice(0,3).map(issue=>issue.message).join(' '):e instanceof Error?e.message:'Could not review this class table.');
 function begin(id=''){
  try{setDraft(customClassDraft(c,id));setReview(null);setChecked(false);setError('');setMilestone(1);}catch(e){report(e);}
 }
 function change(recipe:(d:CustomClass)=>void,regenerate=false){
  if(!draft)return;
  try{let next=structuredClone(draft);recipe(next);if(regenerate)next=customClassTable(next,next.definition.levels.length);setDraft(next);setReview(null);setChecked(false);setError('');}catch(e){report(e);}
 }
 function resize(length:number){
  if(!draft)return;
  try{setDraft(customClassTable(draft,length));setMilestone(Math.min(milestone,length));setReview(null);setChecked(false);setError('');}catch(e){report(e);}
 }
 function preview(){
  if(!draft||!checked)return;
  if(!draft.definition.name.trim()||!draft.definition.source.trim()){setReview(null);setError('Enter a class name and its source citation before reviewing.');return;}
  try{setReview(previewCustomClassChange(c,draft.definition.id,draft));setError('');}catch(e){setReview(null);report(e);}
 }
 function apply(){
  if(!review||!checked)return;
  try{edit(next=>applyCustomClassChange(next,review));setDraft(null);setReview(null);setChecked(false);setError('');toast.success('Custom class table saved. No levels were added.');}catch(e){setReview(null);report(e);}
 }
 const saved=c.customClasses??[];
 const legacy=c.classLevels.filter(e=>e.classId.startsWith('custom-')&&!saved.some(p=>p.definition.id===e.classId));
 const definitions=characterClasses(c);
 const families=new Map(definitions.map(d=>{const id=gestaltClassFamily(d.id,c.customClasses);return [id,definitions.find(p=>p.id===id)?.name??d.name];}));
 for(const p of saved)if(!families.has(p.policy.family))families.set(p.policy.family,'Recorded family: '+p.policy.family);
 if(draft&&!families.has(draft.policy.family))families.set(draft.policy.family,'Recorded family: '+draft.policy.family);
 const stale=!!review&&review.source!==JSON.stringify(c);
 if(c.sheetKind==='monster')return null;
 return <Section title="Custom class tables" note="Optional source-based progression, saved only with this character.">
  <details><summary>Create or review a custom class table</summary>
   <p className="fine">These tables calculate basic HP, attack, saves and skills. They do not automate casting, proficiencies or abilities from their names or milestone text. Use the complete class source. Irregular progressions are not supported by this editor.</p>
   {!draft&&<div className="button-row"><Btn onClick={()=>begin()}>New class table</Btn>{saved.map(p=><Btn key={p.definition.id} onClick={()=>begin(p.definition.id)}>Edit {p.definition.name}</Btn>)}{legacy.map(e=><Btn key={e.id} onClick={()=>begin(e.classId)}>Define table for {e.name}</Btn>)}</div>}
   {draft&&<div className="subcard">
    <p className="fine">This is an unsaved draft. The starting values are a template, not a verified class. Applying a table does not add a class, level up, or switch advancement mode. Use Add class or guided advancement afterward.</p>
    <div className="fields two">
     <F label="Class name" value={draft.definition.name} onChange={v=>change(d=>{d.definition.name=v})}/>
     <F label="Source citation (book and page, or URL)" value={draft.definition.source} onChange={v=>change(d=>{d.definition.source=v})}/>
     <Choice label="Class type" value={draft.definition.kind} options={['Core','Supplemental','Prestige']} onChange={v=>change(d=>{d.definition.kind=v as CustomClass['definition']['kind'];if(v!=='Prestige')d.policy.combinationPrestige=false})}/>
     <Choice label="Hit Die" value={String(draft.definition.hitDie)} options={[4,6,8,10,12].map(n=>[String(n),'d'+n])} onChange={v=>change(d=>{d.definition.hitDie=Number(v) as CustomClass['definition']['hitDie']})}/>
     <N label="Skill points per level (before Intelligence)" value={draft.definition.skillPoints} min={0} max={100} onChange={v=>change(d=>{d.definition.skillPoints=v})}/>
     <N label="Supported class levels" value={draft.definition.levels.length} min={1} max={100} onChange={resize}/>
     <Choice label="Base attack progression" value={draft.policy.bonusProfile.bab} options={['full','medium','poor']} onChange={v=>change(d=>{d.policy.bonusProfile.bab=v as 'full'|'medium'|'poor'},true)}/>
     {(['fort','ref','will'] as const).map(stat=><Choice key={stat} label={{fort:'Fortitude',ref:'Reflex',will:'Will'}[stat]+' progression'} value={draft.policy.bonusProfile[stat]} options={['good','poor']} onChange={v=>change(d=>{d.policy.bonusProfile[stat]=v as 'good'|'poor'},true)}/>)}
     <Choice label="Class family (same-class gestalt restriction)" value={draft.policy.family} options={[[draft.definition.id,'Distinct class'],...[...families].filter(([id])=>id!==draft.definition.id).map(([id,name]):[string,string]=>[id,name])]} onChange={v=>change(d=>{d.policy.family=v})}/>
    </div>
    <F label="Class skills" value={draft.definition.skills} area onChange={v=>change(d=>{d.definition.skills=v})}/>
    <F label="Alignment requirements" value={draft.definition.alignment} onChange={v=>change(d=>{d.definition.alignment=v})}/>
    <F label="Complete entry requirements" value={draft.definition.requirements} area onChange={v=>change(d=>{d.definition.requirements=v})}/>
    <F label="Source description / notes" value={draft.definition.description??''} area onChange={v=>change(d=>{d.definition.description=v})}/>
    {draft.definition.kind==='Prestige'&&<Check label="Combination prestige class: require named GM approval for each gestalt level" checked={draft.policy.combinationPrestige} onChange={v=>change(d=>{d.policy.combinationPrestige=v})}/>}
    <details><summary>Generated table and feature milestones</summary>
     <p className="fine">Check every row against the source. Changing rates preserves milestone text and extra columns. Existing personal feature cards are not rewritten; use the class reference to see the updated table.</p>
     <Choice label="Milestone class level" value={String(milestone)} options={draft.definition.levels.map(row=>[String(row.level),'Level '+row.level])} onChange={v=>setMilestone(Number(v))}/>
     <F label="Features gained at this class level" value={draft.definition.levels[milestone-1]?.special??''} area onChange={v=>change(d=>{d.definition.levels[milestone-1].special=v})}/>
     <Table className="class-table"><caption>Proposed custom class progression</caption><TableHeader><TableRow><TableHead>Level</TableHead><TableHead>BAB</TableHead><TableHead>Fort</TableHead><TableHead>Ref</TableHead><TableHead>Will</TableHead><TableHead>Features</TableHead></TableRow></TableHeader><TableBody>{draft.definition.levels.map(row=><TableRow key={row.level}><TableCell>{row.level}</TableCell><TableCell>{row.bab}</TableCell><TableCell>{row.fort}</TableCell><TableCell>{row.ref}</TableCell><TableCell>{row.will}</TableCell><TableCell>{row.special}</TableCell></TableRow>)}</TableBody></Table>
    </details>
    <Check label="I checked this table, its family and requirements against the complete source" checked={checked} onChange={v=>{setChecked(v);setReview(null)}}/>
    <div className="button-row"><Btn disabled={!checked} onClick={preview}>Review changes</Btn><Btn onClick={()=>{setDraft(null);setReview(null);setChecked(false);setError('')}}>Cancel draft</Btn></div>
    {review&&<div className="subcard" aria-live="polite">
     <h3>Review before applying</h3>
     <p className="fine">{review.summary.used?'Updates the table for '+review.summary.used+' earned class levels.':'Adds an unused table to this character’s class library only.'} Existing class-entry names and personal notes are retained.</p>
     {review.summary.manual&&<p className="fine">Manual calculations remain enabled: this table will not replace your entered totals.</p>}
     <Table className="class-table"><caption>Character totals</caption><TableHeader><TableRow><TableHead>Statistic</TableHead><TableHead>Current</TableHead><TableHead>Proposed</TableHead></TableRow></TableHeader><TableBody>{([['level','Character level'],['bab','Base attack'],['fort','Base Fortitude'],['ref','Base Reflex'],['will','Base Will'],['hp','Current HP'],['maxHp','Maximum HP'],['skills','Total skill-point allowance']] as const).map(([key,label])=><TableRow key={key}><TableHead scope="row">{label}</TableHead><TableCell>{review.summary.before[key]}</TableCell><TableCell>{review.summary.after[key]}</TableCell></TableRow>)}</TableBody></Table>
     {!!review.summary.overspent.length&&<p className="error-text">Recorded skill spending exceeds the proposed allowance at: {review.summary.overspent.join(', ')}. Purchases and ranks are retained; review them separately with your GM.</p>}
     <p className="fine">Recorded history, skill ranks, personal feature descriptions and spent feature uses are protected. This does not rest the character or refill resources.</p>
     {stale&&<p className="error-text">The character changed since this preview. Review again before applying.</p>}
     <Btn className="primary" disabled={stale||!checked} onClick={apply}>Apply reviewed table</Btn>
    </div>}
   </div>}
   {error&&<p className="error-text" role="alert">{error}</p>}
  </details>
 </Section>;
}
