'use client';
import {useState} from 'react';
import {meldshapingSummary,recordEssentiaRuling} from '@/lib/meldshaping';
import {Btn,F,type SheetProps} from './sheet-ui';

export function MeldshapingLimits({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const m=meldshapingSummary(c),saved=c.classSystems.essentiaRuling;
 const [total,setTotal]=useState(saved?String(saved.total):''),[gm,setGm]=useState(saved?.gm??''),[reason,setReason]=useState(saved?.reason??''),[error,setError]=useState('');
 if(!m.sources.length&&!m.shaped&&!saved)return null;
 const apply=()=>{
  if(!/^\d+$/.test(total.trim())){setError('Enter a whole-number essentia total.');return;}
  try{edit(d=>recordEssentiaRuling(d,{total:Number(total),gm,reason}));setError('');}
  catch(e){setError(e instanceof Error?e.message:'Check the total, GM name and reason.');}
 };
 return <div className="subcard"><h3>Shared meldshaping limits</h3>
  <p>{m.shaped} soulmelds recorded · {m.soulmeldLimit===null?'class limit needs source review':m.soulmeldLimit+' maximum across all classes'} (Constitution limit {m.constitutionLimit}). Each class retains its own meld and bind limits.</p>
  <p>{m.allocated} essentia allocated · {m.essentia===null?'shared pool needs review':m.essentia+' in the shared pool'}{saved&&!m.staleRuling?' · GM ruling':m.overlapLevels.length&&m.automaticEssentia!==null?' · overlapping class progressions counted once':''}.</p>
  <p className="fine">Recorded choices count as shaped soulmelds. Warnings preserve your choices, binds and allocations. Check alignment, chakra access, items and other source-specific restrictions with your book.</p>
  <details><summary>Review an essentia ruling or additional source</summary>
   <p className="fine">{m.automaticEssentia===null?(m.tableMissing?'A class level has no supported meldshaping table. Check its source before recording a total.':'Mixed or staggered gestalt progressions need a table ruling; the class tables are not added automatically.'):'Automatic class contribution: '+m.automaticEssentia+'.'} Record a total after checking all sources with your GM. This total replaces the automatic class contribution; include any additional essentia in it.</p>
   {saved&&<p className="fine">Saved ruling: {saved.total} essentia · {saved.gm} · {saved.reason}{m.staleRuling?' · Progression changed; review again before this total applies.':''}</p>}
   <div className="fields three"><F label="Reviewed essentia total" value={total} onChange={setTotal}/><F label="GM name" value={gm} onChange={setGm}/><F label="Sources and ruling" value={reason} onChange={setReason} area/></div>
   <p className="fine">Review: {m.essentia===null?'unresolved':m.essentia} → {total.trim()||'enter a total'} essentia. A change to the relevant class progression requires a new review. Other source changes must also be checked with your GM.</p>
   {error&&<p className="error-text">{error}</p>}
   <div className="button-row"><Btn disabled={!total.trim()||!gm.trim()||!reason.trim()} onClick={apply}>Apply reviewed total</Btn>{saved&&<Btn onClick={()=>edit(d=>{delete d.classSystems.essentiaRuling;})}>{m.automaticEssentia===null?'Return to unresolved pool':'Use automatic class contribution'}</Btn>}</div>
  </details>
 </div>;
}
