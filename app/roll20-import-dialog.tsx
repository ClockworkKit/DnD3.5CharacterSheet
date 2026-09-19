'use client';
import {useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Textarea} from '@/components/ui/textarea';
import {Btn} from './sheet-ui';
import {Roll20ImportReport} from './roll20-import-report';
import {importRoll20} from '@/lib/roll20-import';
import type {Character} from '@/lib/model';
import {toast} from 'sonner';

export function Roll20ImportDialog({open,onOpenChange,onImport,busy=false}:{open:boolean,onOpenChange:(v:boolean)=>void,onImport:(c:Character)=>Promise<boolean>,busy?:boolean}){
 const [raw,setRaw]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false),[reading,setReading]=useState(false),[preview,setPreview]=useState<ReturnType<typeof importRoll20>|null>(null);
 const locked=busy||saving||reading;
 function change(value:string){setRaw(value);setPreview(null);setError('');}
 async function readFile(file:File){setReading(true);setError('');try{if(file.size>1000000)throw Error('Choose a Roll20 JSON file smaller than 1 MB.');change(await file.text());}catch(e){setPreview(null);setError(e instanceof Error?e.message:'Could not read this file.');}finally{setReading(false);}}
 function analyze(){setError('');try{setPreview(importRoll20(JSON.parse(raw)));}catch(e){setPreview(null);setError(e instanceof Error?e.message:'Could not read this Roll20 export.');}}
 async function submit(){if(!preview||locked)return;setSaving(true);setError('');try{if(await onImport(preview.character)){toast.success(preview.character.name+' imported as a new character. Saving…');onOpenChange(false);}else setError('Your current character could not be saved. Resolve its save error before importing.');}catch(e){setError(e instanceof Error?e.message:'Could not import this character.');}finally{setSaving(false);}}
 return <Dialog open={open} onOpenChange={v=>{if(!locked)onOpenChange(v)}}><DialogContent className="ledger-modal library-modal"><DialogHeader><DialogTitle>Import from Roll20</DialogTitle><DialogDescription>Use the JSON handout from !export35. Review the conversion before adding a new character. The complete original export stays attached to it.</DialogDescription></DialogHeader>
  <label className="field"><span>Choose Roll20 JSON</span><input type="file" accept=".json,application/json" disabled={locked} onChange={e=>{const file=e.target.files?.[0];if(file)void readFile(file);e.target.value='';}}/></label>
  <Textarea className="field-sizing-fixed h-40 max-h-64" value={raw} disabled={locked} onChange={e=>change(e.target.value)} placeholder="Or paste the complete JSON from the handout…" rows={8} aria-label="Roll20 export JSON"/>
  {error&&<div className="error-box" role="alert">{error}</div>}
  {preview&&<><h3>{preview.character.name}</h3><p>{preview.character.race||'Race needs review'} · {preview.character.classes||'Classes need review'} · {preview.character.hp}/{preview.character.maxHp} HP</p><p>{preview.character.weapons.length} weapons · {preview.character.features.length} features · {preview.character.casters.reduce((n,c)=>n+c.spells.length,0)} spells · {preview.character.gear.length} equipment entries</p><Roll20ImportReport source={preview.character.roll20Import!}/></>}
  <div className="button-row"><Btn onClick={()=>onOpenChange(false)} disabled={locked}>Cancel</Btn><Btn onClick={analyze} disabled={locked||!raw.trim()}>Review import</Btn><Btn className="primary" onClick={()=>void submit()} disabled={locked||!preview}>{saving?'Importing…':'Import as new character'}</Btn></div>
 </DialogContent></Dialog>;
}
