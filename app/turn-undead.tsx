import {useMemo} from 'react';
import {attemptTurning,turningCounter,turningRoll} from '@/lib/turn-undead';
import {originalTurningUses} from '@/lib/roll20-turning';
import {Btn,type SheetProps} from './sheet-ui';

export function TurnUndead({c,edit,roll}:Pick<SheetProps,'c'|'edit'|'roll'>){
 const counter=turningCounter(c);
 const raw=c.roll20Import?.raw;
 const original=useMemo(()=>raw?originalTurningUses(raw):null,[raw]);
 return <div className="subcard"><h3>Turn or rebuke undead</h3>
  {counter?<><p>{Math.max(0,counter.max-counter.used)} / {counter.max} attempts remaining today.</p>
   <Btn disabled={counter.used>=counter.max} onClick={()=>edit(d=>{attemptTurning(d,roll);})}>Roll turning attempt</Btn>
  </>:<><Btn onClick={()=>roll(turningRoll(c))}>Roll with manual tracking</Btn><p>Record the attempt on your daily counter in Feats &amp; features.</p></>}
  {original&&<p className="fine">At export, Roll20 recorded {original.remaining} / {original.max} attempts remaining. If needed, adjust today's spent uses in Feats &amp; features.</p>}
 </div>;
}
