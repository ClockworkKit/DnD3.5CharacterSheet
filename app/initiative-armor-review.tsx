'use client';
import {equippedArmor} from '@/lib/equipment';
import {chooseInitiativeArmor,initiativeArmorPenalty} from '@/lib/roll20-initiative';
import {signed} from '@/lib/rules';
import {Btn,N,type SheetProps} from './sheet-ui';

export function InitiativeArmorReview({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const review=c.roll20Import?.initiativeArmor;
 if(!review||c.sheetKind==='monster')return null;
 const current=equippedArmor(c).nonproficient;
 const choose=(included:number|null)=>edit(d=>chooseInitiativeArmor(d,included));
 return <details className="subcard" open={review.mode==='review'}>
  <summary>Initiative armor penalty{review.mode==='review'?' — review needed':''}</summary>
  <p className="fine">Initiative is a Dexterity check. Armor or shields you are not proficient with apply their check penalty. Ordinary armor penalties, carrying-load penalties and the tower shield’s separate attack penalty do not apply here.</p>
  <p className="fine">Current equipment penalty: {signed(current)}. Additional initiative adjustment: {signed(initiativeArmorPenalty(c))}. {review.mode==='review'?'Your existing initiative is unchanged until you choose below.':review.mode==='manual'?'Equipment penalties are handled manually in Initiative misc.':'Equipment penalties update automatically; the recorded included component is subtracted only once.'} Automatic adjustments are disabled in manual calculation mode.</p>
  <div className="button-row"><Btn onClick={()=>choose(0)}>Apply penalty — not already in misc.</Btn>{review.sourcePenalty!==undefined&&review.sourcePenalty<0&&<Btn onClick={()=>choose(review.sourcePenalty!)}>Original penalty already in misc. ({signed(review.sourcePenalty)})</Btn>}<Btn onClick={()=>choose(null)}>Keep equipment penalty manual</Btn></div>
  <N label="Penalty already included in Initiative misc." value={review.includedPenalty} min={-200} max={0} onChange={choose}/>
  <p className="fine">Enter the negative amount already contained in misc. if you adjusted it yourself. This does not change your misc field, ability scores, level-ups or spent resources. Other initiative bonuses remain separate.</p>
 </details>;
}
