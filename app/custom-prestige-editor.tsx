'use client';
import type {CustomClass} from '@/lib/custom-class-schema';
import {Choice,Check} from './sheet-ui';

export function CustomPrestigeEditor({draft,change,level,setLevel}:{draft:CustomClass;change:(recipe:(d:CustomClass)=>void)=>void;level:number;setLevel:(n:number)=>void}){
 const d=draft.definition,config=d.advances;
 if(d.kind!=='Prestige'&&!config)return null;
 const update=(recipe:(p:CustomClass)=>void)=>change(p=>{
  recipe(p);const a=p.definition.advances;
  if(a&&(Number(a.spell!=='none')+Number(a.divine)+Number(a.psi)>1||p.definition.casting||p.definition.manifesting))p.policy.combinationPrestige=true;
 });
 return <details><summary>Prestige advancement of existing traditions</summary>
  <p className="fine">Use only the complete source’s “+1 level of existing class” grants. This advances slots or power points, spells/powers known and caster/manifester level. It does not grant that class’s other features. Caster-level-only or other exceptional grants require manual adjustments.</p>
  <Check label="This prestige class advances existing traditions" checked={!!config} onChange={on=>update(p=>{
   if(on){p.definition.advances={spell:'arcane',divine:false,psi:false};p.definition.levels.forEach(row=>{row.advances={spell:false,divine:false,psi:false}});}
   else{delete p.definition.advances;p.definition.levels.forEach(row=>{delete row.advances});}
  })}/>
  {config&&<>
   <Choice label="Spellcasting tradition to advance" value={config.spell} options={[["none","No general spellcasting grant"],["arcane","Existing arcane tradition"],["any","Any existing spellcasting tradition"]]} onChange={v=>update(p=>{p.definition.advances!.spell=v as typeof config.spell})}/>
   <Check label="Separate existing divine tradition" checked={config.divine} onChange={v=>update(p=>{p.definition.advances!.divine=v})}/>
   <Check label="Existing manifesting tradition" checked={config.psi} onChange={v=>update(p=>{p.definition.advances!.psi=v})}/>
   <p className="fine">Separate arcane/divine or spell/psionic progressions require combination-class approval in gestalt. The same-class and two-prestige restrictions still apply. Choose traditions held before entry during level-up; each level keeps its own target.</p>
   <Choice label="Prestige grant class level" value={String(level)} options={d.levels.map(r=>[String(r.level),'Class level '+r.level])} onChange={v=>setLevel(Number(v))}/>
   {(['spell','divine','psi'] as const).map(kind=><Check key={kind} label={'At this class level: +1 '+({spell:'spellcasting',divine:'divine spellcasting',psi:'manifesting'}[kind])+' progression'} checked={!!d.levels[level-1]?.advances?.[kind]} onChange={v=>update(p=>{p.definition.levels[level-1].advances![kind]=v})}/>)}
   <p className="fine">Unselected rows grant no advancement. Check every row against the source.</p>
   <ul className="fine">{d.levels.map(row=><li key={row.level}>Class level {row.level}: {(['spell','divine','psi'] as const).filter(k=>row.advances?.[k]).map(k=>({spell:'spellcasting +1',divine:'divine +1',psi:'manifesting +1'}[k])).join(', ')||'no advancement'}</li>)}</ul>
  </>}
 </details>;
}
