'use client';
import type {Eligibility} from '@/lib/prerequisites';
import {Btn,type SheetProps} from './sheet-ui';
export function PrerequisiteStatus({value,edit}:{value:Eligibility}&Pick<SheetProps,'edit'>){return <details><summary>{value.status}</summary><ul>{value.requirements.map((r,i)=><li key={r.key||i}>{r.state==='met'?'Met':r.state==='missing'?'Missing':r.confirmed?'Confirmed':'Needs confirmation'}: {r.label}{r.state==='confirm'&&r.key&&<Btn className="quiet" onClick={()=>edit(d=>{d.prerequisiteConfirmations[r.key!]=!r.confirmed})}>{r.confirmed?'Clear confirmation':'Confirm with player / DM'}</Btn>}</li>)}</ul></details>;}
