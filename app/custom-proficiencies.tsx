'use client';
import {equipmentCatalog} from '@/lib/equipment';
import {customProficiencyText,type CustomProficiencies} from '@/lib/custom-class-schema';
import {Check,Choice,N} from './sheet-ui';

export function CustomProficiencyEditor({value,levels,onChange}:{value?:CustomProficiencies;levels:number;onChange:(value?:CustomProficiencies)=>void}){
 const set=(patch:Partial<CustomProficiencies>)=>value&&onChange({...value,...patch});
 return <details><summary>Source-defined equipment proficiencies</summary>
  <p className="fine">Enter only training granted by the source. Groups are independent; weapon training does not grant armor or shields. Item-specific choices refer to the equipment catalog. Other items and unusual conditional grants remain manual; no training is inferred from the class name or feature text.</p>
  <Check label="Configure this class's equipment training" checked={!!value} onChange={enabled=>onChange(enabled?{simple:false,martial:false,armor:'none',shields:'none',weapons:[]}:undefined)}/>
  {value&&<>
   <div className="fields two">
    <Choice label="Simple weapons" value={value.simple?(value.simpleMeleeOnly?'melee':'all'):'none'} options={[[ 'none','No group grant'],['melee','Simple melee weapons'],['all','All simple weapons']]} onChange={v=>set({simple:v!=='none',simpleMeleeOnly:v==='melee'})}/>
    <Choice label="Martial weapons" value={value.martial?(value.martialMeleeOnly?'melee':'all'):'none'} options={[[ 'none','No group grant'],['melee','Martial melee weapons'],['all','All martial weapons']]} onChange={v=>set({martial:v!=='none',martialMeleeOnly:v==='melee'})}/>
    <Choice label="Armor group" value={value.armor} options={[[ 'none','No group grant'],['light','Light armor'],['medium','Light and medium armor'],['heavy','Light, medium and heavy armor']]} onChange={v=>{const next={...value,armor:v as CustomProficiencies['armor']};if(v==='medium'||v==='heavy')delete next.mediumAt;onChange(next);}}/>
    <Choice label="Shield training" value={value.shields} options={[[ 'none','None'],['buckler','Bucklers only'],['light','Bucklers and light shields'],['standard','Shields except tower shields'],['all','All shields including tower shields']]} onChange={v=>set({shields:v as CustomProficiencies['shields']})}/>
   </div>
   {['none','light'].includes(value.armor)&&<>
    <Check label="Gains medium armor proficiency at a later class level" checked={!!value.mediumAt} onChange={enabled=>{const next={...value};if(enabled)next.mediumAt=Math.min(levels,3);else delete next.mediumAt;onChange(next);}}/>
    {value.mediumAt!==undefined&&<N label="Medium armor starting class level" value={value.mediumAt} min={1} max={levels} onChange={v=>set({mediumAt:v})}/>}
   </>}
   {(['weapon','armor'] as const).map(kind=>{
    const selected=kind==='weapon'?value.weapons:value.armors??[];
    return <details key={kind}><summary>{kind==='weapon'?'Individual weapons (including exotic)':'Individual armor types'} · {selected.length} selected</summary>
     <div className="fields two">{equipmentCatalog.filter(e=>e.kind===kind).map(e=><Check key={e.id} label={e.name} checked={selected.includes(e.name)} onChange={checked=>set({[kind==='weapon'?'weapons':'armors']:checked?[...selected,e.name]:selected.filter(name=>name!==e.name)})}/>)}</div>
    </details>;
   })}
   <p className="fine">{customProficiencyText(value)}</p>
  </>}
 </details>;
}
