'use client';
import {trapSense} from '@/lib/trap-sense';
import {isTrapSave,isTrapAttack} from '@/lib/trap-context';
import {hasAlternateFeature,alternateClassLevel,alternateSettings} from '@/lib/alternate-features';
import {Check,type SheetProps} from './sheet-ui';

export function TrapDefenses({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const sense=trapSense(c),crasher=hasAlternateFeature(c,'fighter-dungeon-crasher');
 const relic=hasAlternateFeature(c,'cleric-no-turning')&&alternateSettings(c,'cleric-no-turning').choice==='Relic Hunter';
 if(!sense.bonus&&!sense.focusRequired&&!crasher&&!relic)return null;
 return <div className="subcard" aria-label="Conditional trap defenses">
 <h3>Defenses against traps</h3>
 {sense.bonus>0&&<><p className="fine"><strong>Trap Sense +{sense.bonus}.</strong> Adds to Reflex saves against traps and gives a dodge bonus to AC against trap attacks. It does not improve other saves, find traps or disable them. The dodge bonus is lost when Dexterity is denied.</p>
 <p className="fine">Class grants: {sense.sources.map(s=>`${s.name} +${s.amount}`).join(', ')}. {sense.gestalt?'Gestalt uses the faster shared progression, not the sum of overlapping grants. Mixed-class grants use the sheet’s documented progression convention.':'Ordinary multiclass Trap Sense bonuses stack.'}</p></>}
 {sense.focusRequired&&<p className="fine">True Thief’s Psionic Trapsense requires psionic focus; that source is currently unavailable.</p>}
 {crasher&&<p className="fine"><strong>Dungeon Crasher +{alternateClassLevel(c,'fighter')>=6?4:2}.</strong> Competence bonus to AC and all saves against traps. Unlike Trap Sense’s dodge bonus, it remains when Dexterity is denied. Competence bonuses do not stack with each other.</p>}
 {relic&&<p className="fine"><strong>Relic Hunter.</strong> Adds 1 + Wisdom modifier (minimum +1) to Reflex saves against traps, not AC or other saves.</p>}
 <Check label="Incoming attack is from a trap" checked={isTrapAttack(c)} onChange={v=>edit(d=>{d.automation.context.trapAttack=v})}/>
 <Check label="Saving throw is against a trap" checked={isTrapSave(c.automation.context.saveAgainst)} onChange={v=>edit(d=>{d.automation.context.saveAgainst=v?'trap':''})}/>
 <p className="fine">These controls update the displayed defenses and save rolls independently. Clear them after resolving the trap. {c.automation.enabled?'Automatic calculations are enabled.':'Automatic calculations are disabled; these bonuses are not added.'}</p>
 </div>;
}
