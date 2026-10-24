'use client';
import {useState} from 'react';
import type {Character,Spell} from '@/lib/model';
import {arcaneImportEvidence,factotumImportedBook,repairFactotumImport,repairSorcererImport,type ImportedDailyStatus} from '@/lib/roll20-arcane-review';
import {Btn,Choice} from './sheet-ui';
import {toast} from 'sonner';

export function ArcaneImportReview({c,spells,onRepair,disabled=false}:{c:Character,spells:Spell[],onRepair:(c:Character)=>void,disabled?:boolean}){
 const [statuses,setStatuses]=useState<Record<string,ImportedDailyStatus>>({});
 const kind=arcaneImportEvidence(c),book=factotumImportedBook(c);
 if(!kind||kind==='sorcerer'&&c.roll20Import?.sorcererReview===1||kind==='factotum'&&c.roll20Import?.factotumReview===1)return null;
 const run=()=>{try{onRepair(kind==='sorcerer'?repairSorcererImport(c):repairFactotumImport(c,spells,statuses));toast.success('Import reviewed; later levels and spent resources retained.');}catch(e){toast.error(e instanceof Error?e.message:'Could not repair this import.');}};
 return <div className="subcard"><h3>Review {kind==='sorcerer'?'Sorcerer progression':'Factotum import'}</h3>{kind==='sorcerer'?<><p>The export records Sorcerer 2 but caster level 1. Confirm normal Sorcerer progression using your current class levels and Charisma.</p><p className="fine">Replaces casting level/slot overrides, not later levels, known spells or spent slots. Export a backup first if you use house rules.</p><Btn disabled={disabled} onClick={run}>Confirm normal Sorcerer progression</Btn></>:<><p>The export records Factotum 1 with caster level 2. Confirm Factotum 2 (or keep your higher current level) and use Arcane Dilettante instead of generic wizard slots.</p><p className="fine">Your full old spellbook becomes a read-only reference. Existing daily choices, inspiration spent, skill ranks, recorded HP and base totals stay intact. Old preparation/use counts do not establish whether a spell was used today. Choose its actual current status below; this does not spend or restore inspiration. Export a backup first.</p>
 <fieldset disabled={disabled}>{book?.spells.map(k=>{
  const spell=k.custom||spells.find(s=>s.id===k.spellId),existing=c.factotum.spells.find(s=>s.spell.id===(spell?.id||k.spellId));
  return existing?<p key={k.id}>{existing.spell.name}: keep current daily choice ({existing.spent?'used':'unused'}).</p>:<Choice key={k.id} label={(spell?.name||k.spellId)+" - today's status"} value={statuses[k.id]||''} onChange={v=>setStatuses(s=>({...s,[k.id]:v as ImportedDailyStatus}))} options={[[ '', 'Confirm current status'],['reference','Reference only; not a daily choice'],['unused','Chosen today, not yet used'],['spent','Chosen today, already used']]}/>;
 })}</fieldset>
 <p className="fine">Daily choices use current spell rules and imported attack settings. Old effect formulas and notes stay in the reference. Each chosen spell can be used once per day for 1 inspiration; a new encounter does not restore it.</p><Btn disabled={disabled||!spells.length||!book||book.spells.some(k=>!c.factotum.spells.some(s=>s.spell.id===(k.custom?.id||k.spellId))&&!statuses[k.id])} onClick={run}>Confirm Factotum 2 and daily spell status</Btn></>}</div>;
}

export function ArchivedFactotumCasting({c,spells}:{c:Character,spells:Spell[]}){
 const books=c.roll20Import?.factotumArchivedCasting;if(!books?.length)return null;
 return <details className="subcard"><summary>Original imported spellbook — reference only</summary><p className="fine">Kept when the Factotum import was repaired. These historical counts are not extra spell slots or today’s Arcane Dilettante uses. Use the Factotum controls to cast.</p>{books.map(p=><div key={p.id}><h4>{p.name}</h4><p className="reference-text">{p.notes}</p>{p.spells.map(k=><div key={k.id}><h4>{k.custom?.name||spells.find(s=>s.id===k.spellId)?.name||k.spellId}</h4><p className="fine">Recorded level {k.level}; slot level {k.slotLevel}; prepared {k.prepared}; used {k.spent}{k.formula?'; effect formula: '+k.formula:''}</p><p className="reference-text">{k.notes}</p>{k.custom&&<p className="reference-text">{k.custom.description}</p>}</div>)}<details><summary>Full archived data (including overrides and counters)</summary><pre className="reference-text">{JSON.stringify(p,null,2)}</pre></details></div>)}</details>;
}
