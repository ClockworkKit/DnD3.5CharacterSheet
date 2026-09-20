'use client';
import {maxDamageReductionSources,type Character,type DamageReductionSource} from '@/lib/model';
import {activeDamageReductions,damageReductionStatus,formatDamageReduction,newDamageReductionSource} from '@/lib/damage-reduction';
import {F,N,Choice,Check,Btn,Section,type SheetProps} from './sheet-ui';

export function DamageReductionSummary({c}:{c:Character}) {
  const sources=activeDamageReductions(c);
  return <div className="damage-reduction-summary">
    {sources.length>0&&<ul className="damage-reduction-list">{sources.map(source=><li key={source.id}>
      <strong>{formatDamageReduction(source)}</strong> · {source.source.trim()||'Unnamed source'}
    </li>)}</ul>}
    {c.defense.dr.trim()&&<p className="fine">Other DR / notes: {c.defense.dr}</p>}
    {!sources.length&&<p className="fine">No active DR sources.{c.defense.dr.trim()?' Check the notes above.':''}</p>}
  </div>;
}

export function DamageReduction({c,edit,confirm}:Pick<SheetProps,'c'|'edit'|'confirm'>) {
  function update(id:string,patch:Partial<DamageReductionSource>){
    edit(d=>{const source=d.defense.drSources.find(row=>row.id===id);if(source)Object.assign(source,patch);});
  }
  return <Section title="Damage reduction" note="Track armor, class abilities, spells, and other sources. Enter your campaign’s DR values."
    action={<Btn disabled={c.defense.drSources.length>=maxDamageReductionSources} onClick={()=>edit(d=>{
      if(d.defense.drSources.length<maxDamageReductionSources)d.defense.drSources.push(newDamageReductionSource());
    })}>+ Add DR</Btn>}>
    <DamageReductionSummary c={c}/>
    {c.defense.drSources.map((source,index)=>{
      const missingGear=!!source.gearId&&!c.gear.some(item=>item.id===source.gearId);
      const equipmentOptions:Array<[string,string]>=[['manual','Manual toggle'],...c.gear.map(item=>['gear:'+item.id,item.name||'Unnamed item'] as [string,string])];
      if(missingGear)equipmentOptions.push(['gear:'+source.gearId,'Linked item removed']);
      return <div className="subcard damage-reduction-source" key={source.id} role="group" aria-label={'DR source '+(index+1)}>
        <div className="row-head"><Check label="Active" checked={source.active} onChange={active=>update(source.id,{active})}/>
          <span className="fine">{damageReductionStatus(c,source)}</span>
          <Btn className="quiet danger" onClick={()=>confirm('Remove '+(source.source.trim()||'DR source')+'?','This removes the damage reduction entry.',()=>edit(d=>{d.defense.drSources=d.defense.drSources.filter(row=>row.id!==source.id)}))}>Remove</Btn>
        </div>
        <div className="fields three">
          <F label="Source" value={source.source} placeholder="Metal armor, barbarian, stoneskin…" onChange={value=>update(source.id,{source:value.slice(0,160)})}/>
          <N label="DR amount" value={source.amount} min={0} max={10000} onChange={amount=>update(source.id,{amount:Math.floor(amount)})}/>
          <F label="Bypassed by" value={source.bypass} placeholder="—, adamantine, silver, magic…" onChange={value=>update(source.id,{bypass:value.slice(0,160)})}/>
        </div>
        <Choice label="Linked equipment (optional)" value={source.gearId?'gear:'+source.gearId:'manual'} options={equipmentOptions} onChange={value=>update(source.id,{gearId:value==='manual'?'':value.slice(5)})}/>
        {missingGear&&<p className="fine">This source stays inactive until you choose another item or Manual toggle.</p>}
        <details><summary>Conditions & house rules</summary><F label="DR notes" value={source.notes} area placeholder="Damage types, stacking rules, duration, or remaining absorption…" onChange={value=>update(source.id,{notes:value.slice(0,2000)})}/></details>
      </div>;
    })}
    <p className="fine">Leave Bypassed by blank for DR/—. Linked equipment must be carried, equipped, and have a quantity above zero; Active must also be checked. Use your armor rule’s amount when adding a metal armor source.</p>
    <p className="fine">Apply the best relevant DR to each hit, unless your rule explicitly allows stacking. Record stacking exceptions in Conditions & house rules. Adjust HP after resolving damage at the table.</p>
    <F label="Other DR / imported notes" value={c.defense.dr} placeholder="Existing DR notes and Roll20 imports" onChange={value=>edit(d=>{d.defense.dr=value.slice(0,160)})}/>
  </Section>;
}
