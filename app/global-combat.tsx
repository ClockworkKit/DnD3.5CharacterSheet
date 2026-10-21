'use client';
import {Check,F,N,Section,type SheetProps} from './sheet-ui';

export function GlobalCombat({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const value=c.globalCombat||{enabled:false,attack:0,damage:0,extraDamage:''};
 const set=(patch:Partial<typeof value>)=>edit(d=>{d.globalCombat={...value,...patch};});
 return <Section title="Global weapon modifiers" note="Applies to weapon attacks and damage, including full attacks, in manual and automatic modes. Does not affect saves, skills, initiative or spell rolls.">
  <Check label="Enable global weapon modifiers" checked={value.enabled} onChange={enabled=>set({enabled})}/>
  <div className="fields three"><N label="Global attack bonus" value={value.attack} onChange={attack=>set({attack})}/><N label="Global damage bonus" value={value.damage} onChange={damage=>set({damage})}/><F label="Global extra damage dice" value={value.extraDamage} placeholder="1d6" onChange={extraDamage=>set({extraDamage})}/></div>
  <p className="fine">Flat damage multiplies on a critical; extra damage is added once. These are untyped manual adjustments: do not repeat bonuses already supplied by feats or Active effects. Imported complete damage formulas skip global damage until you review their included bonuses under the weapon’s enhancement options. Disabling global modifiers removes the original global component from numeric imported attack totals too.</p>
 </Section>;
}
