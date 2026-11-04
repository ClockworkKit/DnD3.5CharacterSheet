'use client';
import type {CustomClass} from '@/lib/custom-class-schema';
import {abilityKeys} from '@/lib/model';
import {F,N,Choice,Check} from './sheet-ui';

/** Source tables stay in the class draft and use its normal review transaction. */
export function CustomClassResources({draft,change,level,setLevel}:{draft:CustomClass;change:(recipe:(d:CustomClass)=>void)=>void;level:number;setLevel:(n:number)=>void}){
 const d=draft.definition,row=d.levels[level-1],casting=d.casting,manifesting=d.manifesting;
 return <details><summary>Spellcasting and manifesting tables</summary>
  <p className="fine">Configure this class’s own progression from its complete source. Slots are base daily slots before ability bonuses; power points are the base daily allowance. To advance another class’s tradition, use Prestige advancement below. Feature text does not grant automatic mechanics. Leave exceptional rules manual.</p>
  <Check label="This class has its own spellcasting table" checked={!!casting} onChange={on=>change(p=>{
   if(on){p.definition.casting={ability:'INT',mode:'prepared',type:'arcane',list:p.definition.name||'Custom',startLevel:1,halfLevel:false};p.definition.levels.forEach(r=>{r.slots=Array(10).fill(null)});}
   else {delete p.definition.casting;p.definition.levels.forEach(r=>{delete r.slots;delete r.spellsKnown});}
  })}/>
  {casting&&<div className="fields two">
   <Choice label="Casting ability (spell eligibility)" value={casting.ability} options={[...abilityKeys]} onChange={v=>change(p=>{p.definition.casting!.ability=v as typeof casting.ability})}/>
   <Choice label="Bonus-slot ability" value={casting.bonusAbility??''} options={[["","Use tradition’s casting ability"],...abilityKeys.map(a=>[a,a] as [string,string])]} onChange={v=>change(p=>{if(v)p.definition.casting!.bonusAbility=v as typeof casting.ability;else delete p.definition.casting!.bonusAbility})}/>
   <Choice label="Spell save DC ability" value={casting.dcAbility??''} options={[["","Use tradition’s casting ability"],...abilityKeys.map(a=>[a,a] as [string,string])]} onChange={v=>change(p=>{if(v)p.definition.casting!.dcAbility=v as typeof casting.ability;else delete p.definition.casting!.dcAbility})}/>
   <Choice label="Casting method" value={casting.mode} options={['prepared','spontaneous']} onChange={v=>change(p=>{p.definition.casting!.mode=v as typeof casting.mode})}/>
   <Choice label="Magic type" value={casting.type} options={['arcane','divine']} onChange={v=>change(p=>{p.definition.casting!.type=v as typeof casting.type})}/>
   <F label="Spell list name" value={casting.list} onChange={v=>change(p=>{p.definition.casting!.list=v})}/>
   <N label="First class level with casting" value={casting.startLevel} min={1} max={100} onChange={v=>change(p=>{p.definition.casting!.startLevel=v})}/>
   <Check label="Caster level is half progression, rounded down" checked={casting.halfLevel} onChange={v=>change(p=>{p.definition.casting!.halfLevel=v})}/>
   <Check label="Limited spells known: record allowances for every row" checked={!!row.spellsKnown} onChange={v=>change(p=>{p.definition.levels.forEach(r=>{if(v)r.spellsKnown=Array(10).fill(0);else delete r.spellsKnown})})}/>
  </div>}
  <Check label="This class has its own manifesting table" checked={!!manifesting} onChange={on=>change(p=>{
   if(on){p.definition.manifesting={ability:'INT',startLevel:1,levelOffset:0,bonusPoints:0};p.definition.levels.forEach(r=>{r.powerPoints=0;r.powersKnown=0;r.powerLevel=0});}
   else {delete p.definition.manifesting;p.definition.levels.forEach(r=>{delete r.powerPoints;delete r.powersKnown;delete r.powerLevel});}
  })}/>
  {manifesting&&<div className="fields two">
   <Choice label="Manifesting ability" value={manifesting.ability} options={[...abilityKeys]} onChange={v=>change(p=>{p.definition.manifesting!.ability=v as typeof manifesting.ability})}/>
   <N label="First class level with manifesting" value={manifesting.startLevel} min={1} max={100} onChange={v=>change(p=>{p.definition.manifesting!.startLevel=v})}/>
   <N label="Manifester level adjustment to progression" value={manifesting.levelOffset} min={-100} max={100} onChange={v=>change(p=>{p.definition.manifesting!.levelOffset=v})}/>
   <N label="Additional fixed power points from this class" value={manifesting.bonusPoints} min={0} max={10000} onChange={v=>change(p=>{p.definition.manifesting!.bonusPoints=v})}/>
  </div>}
  {(casting||manifesting)&&<>
   <Choice label="Resource table class level" value={String(level)} options={d.levels.map(r=>[String(r.level),'Class level '+r.level])} onChange={v=>setLevel(Number(v))}/>
   {casting&&<><p className="fine">An unavailable spell level grants no slots, even with a high ability score. An available level with 0 base slots can receive bonus slots. Check all {d.levels.length} rows before applying.</p>
    {Array.from({length:10},(_,i)=><div className="fields three" key={i}>
     <Check label={'Spell level '+i+' is available'} checked={row.slots?.[i]!=null} onChange={v=>change(p=>{p.definition.levels[level-1].slots![i]=v?0:null})}/>
     {row.slots?.[i]!=null&&<N label={'Level '+i+' base daily slots'} value={row.slots[i]!} min={0} max={100} onChange={v=>change(p=>{p.definition.levels[level-1].slots![i]=v})}/>}
     {row.spellsKnown&&<N label={'Level '+i+' spells known allowance'} value={row.spellsKnown[i]} min={0} max={100} onChange={v=>change(p=>{p.definition.levels[level-1].spellsKnown![i]=v})}/>}
    </div>)}
   </>}
   {manifesting&&<div className="fields three">
    <N label="Base daily power points" value={row.powerPoints??0} min={0} max={10000} onChange={v=>change(p=>{p.definition.levels[level-1].powerPoints=v})}/>
    <N label="Powers known allowance" value={row.powersKnown??0} min={0} max={100} onChange={v=>change(p=>{p.definition.levels[level-1].powersKnown=v})}/>
    <N label="Maximum power level (0 means none)" value={row.powerLevel??0} min={0} max={9} onChange={v=>change(p=>{p.definition.levels[level-1].powerLevel=v})}/>
   </div>}
  </>}
  <p className="fine">Existing traditions keep their selected abilities, method, list, notes, preparations and expenditure. Review those settings separately when the source changes. Removing a table retains existing pools for manual use; it does not delete spells or powers.</p>
 </details>;
}
