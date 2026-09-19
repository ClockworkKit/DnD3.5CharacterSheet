'use client';
import type {Character} from '@/lib/model';
import {Btn} from './sheet-ui';

export function Roll20ImportReport({source}:{source:NonNullable<Character['roll20Import']>}){
 const {report}=source;
 function download(){const blob=new Blob([JSON.stringify(source.raw,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='roll20-original-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <div className="subcard"><h3>Roll20 import report</h3><p>{report.mapped} attributes mapped · {report.unmapped.length} attributes retained for review.</p>
  <ul>{report.warnings.map(w=><li key={w}>{w}</li>)}</ul>
  {!!report.unmapped.length&&<details><summary>Fields retained in the original export</summary><ul>{report.unmapped.slice(0,200).map((name,i)=><li key={i}><code>{name}</code></li>)}</ul>{report.unmapped.length>200&&<p>Showing the first 200 fields. Download the original JSON to inspect all fields.</p>}</details>}
  <Btn onClick={download}>Download original Roll20 JSON</Btn>
 </div>;
}
