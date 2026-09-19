import type {Roll20Export} from './roll20-schema.ts';

export type RepeatingField={name:string,current:unknown,max?:unknown,attributeId?:string,originalName:string};
export type RepeatingRow={rowId:string,fields:Record<string,RepeatingField[]>};
export type RepeatingSections=Record<string,{section:string,rows:Record<string,RepeatingRow>}>;
const dictionary=<T>()=>Object.create(null) as Record<string,T>;
const key=(name:string)=>name.trim().toLowerCase();

/** Raw attributes are authoritative; the redundant grouping never replaces them. */
export function parseRepeating(attributes:Roll20Export['attributes']):RepeatingSections {
 const sections:RepeatingSections=dictionary(),orders:Record<string,string[]>=dictionary();
 for(const a of attributes)if(a.name.startsWith('_reporder_repeating_')&&typeof a.current==='string')orders[a.name.slice(20)]=a.current.split(',').filter(Boolean);
 for(const a of attributes){
  if(!a.name.startsWith('repeating_'))continue;
  let match:string[]|null=null;
  for(const section of Object.keys(orders).sort((a,b)=>b.length-a.length)){
   const prefix='repeating_'+section+'_';if(!a.name.startsWith(prefix))continue;
   const rest=a.name.slice(prefix.length),row=orders[section].find(id=>rest.startsWith(id+'_'));
   if(row){match=[a.name,section,row,rest.slice(row.length+1)];break;}
  }
  // Generated RowIDs are 20 characters; legacy fixtures may use shorter IDs.
  match??=a.name.match(/^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/)||a.name.match(/^repeating_([^_]+)_([^_]+)_(.+)$/);
  if(!match)continue;
  const [,section,rowId,field]=match,group=sections[section]??(sections[section]={section,rows:dictionary()});
  const row=group.rows[rowId]??(group.rows[rowId]={rowId,fields:dictionary()});
  (row.fields[field]??=[]).push({name:field,current:a.current,max:a.max,attributeId:a.id,originalName:a.name});
 }
 for(const [section,order] of Object.entries(orders))if(sections[section]){
  const rows=sections[section].rows,sorted:Record<string,RepeatingRow>=dictionary();
  for(const id of [...order,...Object.keys(rows)])if(rows[id])sorted[id]=rows[id];
  sections[section].rows=sorted;
 }
 return sections;
}

/** Only numeric literals are converted. Roll20 formulas and dice remain raw. */
export function roll20Number(value:unknown):number|undefined {
 if(typeof value==='number')return Number.isFinite(value)?value:undefined;
 if(typeof value!=='string')return undefined;
 const s=value.trim().replace(/−/g,'-');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d*)?)$/.test(s))return undefined;
 const n=Number(s.replace(/,/g,''));return Number.isFinite(n)?n:undefined;
}
export function roll20Boolean(value:unknown):boolean|undefined {
 if(value===true||value===1||typeof value==='string'&&/^(1|true|on|yes|x)$/i.test(value.trim()))return true;
 if(value===false||value===0||typeof value==='string'&&/^(0|false|off|no)$/i.test(value.trim()))return false;
 return undefined;
}
export const roll20Text=(value:unknown)=>typeof value==='string'?value:typeof value==='number'||typeof value==='boolean'?String(value):undefined;

export function attributeReader(data:Roll20Export,warn:(message:string)=>void){
 const used=new Set<number>(),byName=new Map<string,number[]>();
 data.attributes.forEach((a,i)=>{const k=key(a.name);byName.set(k,[...(byName.get(k)||[]),i])});
 const queried=new Map(Object.entries(data.resolvedCoreValues||{}).map(([name,value])=>[key(name),value]));
 function read<T>(names:string[],convert:(value:unknown)=>T|undefined,slot:'current'|'max'='current'):T|undefined {
  for(const name of names){
   const indices=byName.get(key(name))||[],values=indices.map(i=>data.attributes[i][slot]);
   if(new Set(values.map(v=>JSON.stringify(v))).size>1){warn('Conflicting attributes named '+name+' were preserved without choosing a value.');return undefined;}
   if(indices.length){const result=convert(values[0]);if(result!==undefined){indices.forEach(i=>used.add(i));return result;}}
   const result=convert(queried.get(key(name)+(slot==='max'?'_max':'')));if(result!==undefined)return result;
  }
 }
 const number=(...names:string[])=>read(names,roll20Number);
 const text=(...names:string[])=>read(names,v=>{const value=roll20Text(v);return value?.trim()?value:undefined});
 return {used,read,number,text,boolean:(...names:string[])=>read(names,roll20Boolean),max:(...names:string[])=>read(names,roll20Number,'max'),
  present:(...names:string[])=>names.some(name=>byName.has(key(name))||queried.has(key(name))),
 };
}
export type AttributeReader=ReturnType<typeof attributeReader>;
