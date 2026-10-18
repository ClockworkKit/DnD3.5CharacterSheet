'use client';
import {armorBreakdown,rogueCombatFeatures,setDeathsRuin} from '@/lib/combat-explanations';
import {signed} from '@/lib/rules';
import {Check,type SheetProps} from './sheet-ui';

export function ArmorBreakdown({c}:Pick<SheetProps,'c'>){
 const {armor,load,encumbrance,basePenalty,baseDexCap}=armorBreakdown(c);
 const cap=(n:number)=>n>=100?'no limit':signed(n);
 return <div className="subcard" aria-label="Armor and load breakdown">
 <h3>Armor and carrying load</h3>
 <p className="fine">Equipped: {armor.selected.map(g=>g.name).join(', ')||'No armor or shield'}. Gear bonuses: armor {signed(armor.armor)}, shield {signed(armor.shield)}. Gear check penalty {signed(armor.checkPenalty)}; maximum Dex {cap(armor.dexCap)}.</p>
 <p className="fine">Carried weight {load.weight.toFixed(2)} lb. — {load.category.toLowerCase()} load. Light-load limit {load.light} lb. {encumbrance?`Load check penalty ${signed(load.checkPenalty)}; maximum Dex ${cap(load.dexCap)}. The worse gear/load value applies, not their sum.`:'Weight-based encumbrance is disabled in Calculations.'}</p>
 <p className="fine">Sheet check penalty {signed(c.defense.checkPenalty)}; maximum Dex {cap(c.defense.dexCap)}. {c.automation.enabled?`Before adjustments: ${signed(basePenalty)} and ${cap(baseDexCap)}.`:'These fields are currently entered manually.'}</p>
 {c.automation.enabled&&(['defense.armor','defense.shield','defense.checkPenalty','defense.dexCap','defense.spellFailure'] as const).some(k=>c.automation.overrides[k]!==undefined||c.automation.adjustments[k])&&<p className="fine">Saved adjustments / overrides: {(['defense.armor','defense.shield','defense.checkPenalty','defense.dexCap','defense.spellFailure'] as const).filter(k=>c.automation.overrides[k]!==undefined||c.automation.adjustments[k]).map(k=>`${({'defense.armor':'armor','defense.shield':'shield','defense.checkPenalty':'check penalty','defense.dexCap':'maximum Dex','defense.spellFailure':'spell failure'}[k])} ${c.automation.overrides[k]!==undefined?'override '+c.automation.overrides[k]:signed(c.automation.adjustments[k])}`).join('; ')}. Review these in Calculations with your DM; imported totals are preserved rather than silently erased.</p>}
 </div>;
}
export function RogueCombatFeatures({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const features=rogueCombatFeatures(c),ctx=c.automation.context;
 if(!features.evasion&&!features.deathsRuin)return null;
 return <div className="subcard">
 <h3>Rogue combat features</h3>
 {features.evasion&&<p className="fine"><strong>Evasion — class feature, not a feat.</strong> Granted at rogue level 2. On a successful Reflex save against an effect that normally deals half damage, take no damage instead. Requires light/no armor, a light load when encumbrance applies, and not being helpless. {features.evasionBlocked?`Currently unavailable because of ${features.evasionBlocked}.`:'Available under the recorded armor and load conditions.'} Resolve damage at the table; the sheet does not deduct it automatically.</p>}
 {features.deathsRuin&&<><Check label="Death's Ruin: this is an eligible sneak attack against undead" checked={ctx.deathsRuin&&ctx.targetType==='undead'} onChange={v=>edit(d=>setDeathsRuin(d,v))}/><p className="fine">Sets the target type to undead and uses {features.deathsRuinDice}d6 sneak-attack damage (half the normal dice, rounded down). You still need the usual sneak-attack conditions, and ranged sneak attacks must be within 30 ft. Applies to the weapon Damage buttons and full-attack damage rolls. Changing the target away from undead disables this benefit.</p></>}
 </div>;
}
