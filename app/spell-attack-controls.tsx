'use client';
import type {Character,Spell} from '@/lib/model';
import type {SpellAttackSettings} from '@/lib/spell-attack-schema';
import {spellAttackProfile,spellAttackModes,spellAttackBonus,makeSpellAttackOnlyRoll} from '@/lib/spell-attacks';
import {signed,type Roll} from '@/lib/rules';
import {Choice,N,Btn} from './sheet-ui';
import {hasSearingLightTargets,searingLightTargets} from '@/lib/spell-effect-targets';

export function SpellAttackControls({c,spell,cl,settings,onChange,roll}:{c:Character,spell:Spell,cl:number,settings?:SpellAttackSettings,onChange:(value:SpellAttackSettings)=>void,roll:(r:Roll)=>boolean}){
 const p=spellAttackProfile(spell,cl,settings),value=settings||spell.attack||{mode:'auto' as const,bonus:0};
 const update=(patch:Partial<SpellAttackSettings>)=>onChange({...value,...patch});
 return <details className="spell-attack-controls"><summary>{p.mode==='none'?'Attack delivery: none / choose if needed':`Cast: ${p.count} ${spellAttackModes.find(([id])=>id===p.mode)![1]} ${signed(spellAttackBonus(c,spell,cl,settings))}`}</summary>
  <div className="fields three"><Choice label="Attack delivery" value={value.mode} options={spellAttackModes} onChange={mode=>update({mode:mode as SpellAttackSettings['mode']})}/>{p.mode!=='spiritual-weapon'&&<N label="Attack rolls (0 = automatic count)" value={value.count??0} min={0} max={20} onChange={count=>update({count:Math.trunc(count)||undefined})}/>}<N label="Conditional attack adjustment" value={value.bonus} min={-1000} max={1000} onChange={bonus=>update({bonus:Math.trunc(bonus)})}/></div>
  {hasSearingLightTargets(spell)&&<><Choice label="Searing Light damage target" value={value.effectTarget??'ordinary'} options={searingLightTargets} onChange={effectTarget=>update({effectTarget:effectTarget as SpellAttackSettings['effectTarget']})}/><p className="fine">Choose the target before casting. This changes the default damage dice, not the ranged touch attack or DC. An Effect roll override still takes priority.</p></>}
  <p className="fine">{p.note} Healing a willing ally needs no attack. For an unwilling target, select the appropriate touch attack. The conditional attack adjustment changes attacks only, not save DC or damage.</p>
  <p className="fine">Cast spends the spell once and rolls the selected attacks. Attack only does not spend another use: use it for a legal held charge or ongoing effect. Summoned creatures, weapon buffs and special attack formulas must use their own statistics; automatic detection is not a complete rules engine.</p>
  {p.mode!=='none'&&<Btn onClick={()=>roll(makeSpellAttackOnlyRoll(c,spell,cl,settings))}>Attack only (no new cast)</Btn>}
 </details>;
}
