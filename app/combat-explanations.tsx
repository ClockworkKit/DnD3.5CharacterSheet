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
 if(!features.evasion&&!features.uncanny.length&&!features.uncannyDefense.improved&&!features.deathsRuin)return null;
 return <div className="subcard">
 <h3>Defensive class features & conditional attacks</h3>
 {features.evasion&&<div aria-label="Evasion class features">
 <p className="fine"><strong>{features.defensive.tier>1?'Improved evasion':'Evasion'} — class feature, not a feat.</strong> Against an effect that allows a Reflex save for half damage, Evasion prevents damage on success. Improved evasion also halves damage on failure. Duplicate grants do not stack or automatically upgrade Evasion. Resolve damage at the table; the sheet does not deduct it automatically.</p>
 <ul>{features.defensive.sources.map(source=><li key={source.classId}>{source.name}: {source.tier>1?'improved evasion':'evasion'} — {source.blocked?'unavailable because of '+source.blocked:'available under recorded conditions'}.</li>)}</ul>
 <p className="fine">Ordinary Evasion needs light/no armor and a light load when encumbrance applies; ninja Evasion needs no armor. Eldritch Grace applies only to spells and magical effects. Being helpless prevents these benefits. One available source is sufficient; a restricted source does not disable another.</p>
 </div>}
 {features.uncanny.length>0&&<p className="fine"><strong>Uncanny Dodge.</strong> Granted by {features.uncanny.map(source=>source.name).join(', ')}. Retains Dexterity and dodge bonuses to AC while flat-footed, but not when immobilized or otherwise denied Dexterity. The flat-footed AC display and the flat-footed situation use this benefit when automatic calculations are enabled. The explicit lose-Dexterity override still takes precedence.</p>}
 {(features.uncanny.length>0||features.uncannyDefense.improved)&&<div aria-label="Improved Uncanny Dodge progression">
 <p className="fine"><strong>Improved Uncanny Dodge: {features.uncannyDefense.improved?'granted':features.uncannyDefense.review?'review needed':'not yet granted'}.</strong> {features.uncannyDefense.earned.length>0&&<>Listed improvement from {features.uncannyDefense.earned.map(s=>s.name).join(', ')}. </>}{features.uncannyDefense.duplicateUpgrade&&<>Granted by ordinary multiclass Uncanny Dodge from a second class. </>}{features.uncannyDefense.gestalt&&<>Gestalt uses the faster shared progression; overlapping basic grants do not automatically upgrade it. </>}{features.uncannyDefense.improved&&<>Prevents flanking, including sneak attacks that depend on flanking. {features.uncannyDefense.minimumRogueLevel!==null&&<>The rogue exception requires at least {features.uncannyDefense.minimumRogueLevel} rogue levels in the attacker. </>}It does not prevent sneak attacks from other qualifying conditions. Resolve the opponent's abilities and attacks at the table; this does not alter your outgoing flanking or sneak-attack selections.</>}</p>
 {features.uncannyDefense.review&&<p className="fine" role="note">{features.uncannyDefense.review}</p>}
 </div>}
 {features.deathsRuin&&<><Check label="Death's Ruin: this is an eligible sneak attack against undead" checked={ctx.deathsRuin&&ctx.targetType==='undead'} onChange={v=>edit(d=>setDeathsRuin(d,v))}/><p className="fine">Sets the target type to undead and uses {features.deathsRuinDice}d6 sneak-attack damage (half the normal dice, rounded down). You still need the usual sneak-attack conditions, and ranged sneak attacks must be within 30 ft. Applies to the weapon Damage buttons and full-attack damage rolls. Changing the target away from undead disables this benefit.</p></>}
 </div>;
}
