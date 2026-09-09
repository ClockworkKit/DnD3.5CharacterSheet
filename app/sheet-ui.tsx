'use client';
import {useId,type ReactNode,type ButtonHTMLAttributes} from 'react';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
import type {Character} from '@/lib/model';
import type {Roll} from '@/lib/rules';
export type Edit=(recipe:(c:Character)=>void)=>void;
export type SheetProps={c:Character,edit:Edit,roll:(r:Roll)=>boolean,confirm:(title:string,description:string,action:()=>void)=>void};
export function F({label,value,onChange,area=false,placeholder='',className='',calculated=false}:{calculated?:boolean,label:string,value:string,onChange:(v:string)=>void,area?:boolean,placeholder?:string,className?:string}) {const id=useId();return <label htmlFor={id} className={'field '+className}><span>{label}{calculated&&<small className="auto-label">auto</small>}</span>{area?<Textarea id={id} readOnly={calculated} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={4}/>:<Input id={id} readOnly={calculated} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/>}</label>;}
export function N({label,value,onChange,min=-10000,max=100000,step=1,calculated=false}:{calculated?:boolean,label:string,value:number,onChange:(v:number)=>void,min?:number,max?:number,step?:number}) {const id=useId();return <label htmlFor={id} className="field"><span>{label}{calculated&&<small className="auto-label">auto</small>}</span><Input id={id} readOnly={calculated} type="number" inputMode="decimal" value={value} min={min} max={max} step={step} onChange={e=>{const n=e.target.valueAsNumber;onChange(Number.isFinite(n)?Math.min(max,Math.max(min,n)):0);}}/></label>;}
export function Choice({label,value,onChange,options}:{label:string,value:string,onChange:(v:string)=>void,options:Array<string|[string,string]>}){const id=useId();return <div className="field"><label htmlFor={id}>{label}</label><Select value={value} onValueChange={onChange}><SelectTrigger id={id} className="sheet-select"><SelectValue/></SelectTrigger><SelectContent>{options.map(o=>{const [v,t]=Array.isArray(o)?o:[o,o];return <SelectItem key={v} value={v}>{t}</SelectItem>;})}</SelectContent></Select></div>;}
export function Check({label,checked,onChange}:{label:string,checked:boolean,onChange:(v:boolean)=>void}){const id=useId();return <label htmlFor={id} className="check"><Checkbox id={id} checked={checked} onCheckedChange={v=>onChange(v===true)}/><span>{label}</span></label>;}
export function Btn({children,className='',...props}:ButtonHTMLAttributes<HTMLButtonElement>){return <Button type="button" className={'ledger-button '+className} variant="outline" {...props}>{children}</Button>;}
export function Section({title,note,children,action}:{title:string,note?:string,children:ReactNode,action?:ReactNode}){return <section className="sheet-section"><div className="section-heading"><div><h2>{title}</h2>{note&&<p className="muted">{note}</p>}</div>{action}</div>{children}</section>;}
export function Stat({label,value}:{label:string,value:string|number}){return <div className="stat"><span>{label}</span><strong>{value}</strong></div>;}
