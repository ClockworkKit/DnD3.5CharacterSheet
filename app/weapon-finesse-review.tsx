'use client';
import type {Weapon} from '@/lib/model';
import {chooseWeaponFinesse} from '@/lib/roll20-weapon-finesse';
import {finesseShieldPenalty,weaponFinesse} from '@/lib/weapon-finesse';
import {sheetTotals,signed,weaponContext} from '@/lib/rules';
import {Btn,N,type SheetProps} from './sheet-ui';

export function WeaponFinesseReview({c,w,edit}:Pick<SheetProps,'c'|'edit'>&{w:Weapon}){
 const review=c.roll20Import?.weaponFinesse?.[w.id];
 if(!review)return null;
 const choose=(included:number|null)=>edit(d=>chooseWeaponFinesse(d,w.id,included));
 const result=weaponFinesse(c,w,weaponContext(c,w).weapon==='ranged',sheetTotals(c).mods);
 return <details className="subcard" open={review.mode==='review'}>
  <summary>Weapon Finesse shield penalty{review.mode==='review'?' - review needed':''}</summary>
  <p className="fine">Weapon Finesse applies a shield's armor check penalty to a Dexterity-based melee attack. A nonproficient shield already applies that penalty through the general attack rules; it is not charged twice. Current additional shield penalty: {signed(finesseShieldPenalty(c))}.</p>
  <p className="fine">{review.mode==='review'?'Existing attack handling is unchanged until you choose.':review.mode==='manual'?'Finesse shield penalties remain manual in Attack misc.':'Finesse shield penalties update automatically; STR-based automatic selection uses the better result after the penalty.'} Current calculated ability: {result.ability}; finesse/import adjustment: {signed(result.penalty)}. Automatic adjustments are disabled in manual calculation mode.</p>
  <div className="button-row"><Btn onClick={()=>choose(0)}>Apply penalty - not already in misc.</Btn>{review.sourcePenalty!==undefined&&review.sourcePenalty<0&&<Btn onClick={()=>choose(review.sourcePenalty!)}>Original shield penalty already in misc. ({signed(review.sourcePenalty)})</Btn>}<Btn onClick={()=>choose(null)}>Keep finesse shield penalty manual</Btn></div>
  <N label="Finesse shield penalty already in Attack misc." value={review.includedPenalty} min={-100} max={0} onChange={choose}/>
  <p className="fine">Only the shield component is reconciled here. If an original numeric total also included an unlabelled Strength-to-Dexterity substitution, review Attack ability and Attack misc. separately. No weapons, level-ups or spent resources are replaced.</p>
 </details>;
}
