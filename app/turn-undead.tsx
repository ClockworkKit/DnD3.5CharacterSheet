import {clericChannelState} from '@/lib/cleric-channel';
import {classFeatureLevel} from '@/lib/alternate-features';
import {featureUseNumbers,sharedTurningPools,sharedTurningWarnings,coreTurningId} from '@/lib/shared-turning';
import {effectiveTurningLevel} from '@/lib/turning-feats';
import {useMemo} from 'react';
import {attemptSharedTurning,attemptTurning,turningCounter,turningRoll} from '@/lib/turn-undead';
import {originalTurningUses} from '@/lib/roll20-turning';
import {Btn,Choice,type SheetProps} from './sheet-ui';

export function TurnUndead({c,edit,roll}:Pick<SheetProps,'c'|'edit'|'roll'>){
 const counter=turningCounter(c),uses=counter?featureUseNumbers(c,counter):undefined;
 const channel=clericChannelState(c),cleric=classFeatureLevel(c,'cleric','turn-undead')>0;
 const raw=c.roll20Import?.raw;
 const original=useMemo(()=>raw?originalTurningUses(raw):null,[raw]);
 return <div className="subcard"><h3>Turn or rebuke undead</h3>
  {cleric&&(channel.fixed?<p className="fine">The recorded {channel.source==='deity'?'deity':'character'} alignment requires {channel.fixed==='cure'?'turning':'rebuking'} undead.</p>:<><Choice label="Cleric turning channel" value={channel.channel??'choose'} options={[['choose','Choose the recorded channel'],['cure','Turn undead / Cure'],['inflict','Rebuke undead / Inflict']]} onChange={v=>edit(d=>{if(v==='choose')delete d.clericChannel;else d.clericChannel=v as 'cure'|'inflict'})}/><p className="fine">Record the permanent choice allowed by your deity and class rules. This is also your spontaneous Cleric casting channel.</p></>)}
  {cleric&&channel.savedConflict&&<p className="fine">Your saved channel choice is retained, but the recorded alignment determines the current ability.</p>}
  {counter?<><p>{uses!.remaining} / {uses!.max} attempts remaining today.</p>
   <Btn disabled={uses!.remaining<1} onClick={()=>edit(d=>{attemptTurning(d,roll);})}>Roll turning attempt</Btn>
  </>:<><Btn onClick={()=>roll(turningRoll(c))}>Roll with manual tracking</Btn><p>Record the attempt on your daily counter in Feats &amp; features.</p></>}
  {uses?.shared&&<p className="fine">One shared pool from {uses.shared.active.map(s=>s.name).join(", ")}. Saved expenditure on every source is included.</p>}
  {original&&<p className="fine">At export, Roll20 recorded {original.remaining} / {original.max} attempts remaining. If needed, adjust today's spent uses in Feats &amp; features.</p>}
 </div>;
}

export function SharedTurning({c,edit,roll}:Pick<SheetProps,'c'|'edit'|'roll'>){
 const pools=sharedTurningPools(c).filter(p=>!p.activeRuleIds.includes(coreTurningId));
 return <>{sharedTurningWarnings(c).map(w=><p className="fine" key={w}>{w}</p>)}{pools.map(p=><div className="subcard" key={p.kind}><h3>{p.label}</h3>
  <p>{p.remaining} / {p.max} attempts remaining today. Effective turning level {effectiveTurningLevel(c,p.baseLevel)}.</p>
  <p className="fine">{p.active.map(s=>s.name).join(", ")} advance the same ability once per paired level. All recorded source expenditure is included; edit individual records in Feats &amp; features.</p>
  <Btn disabled={p.remaining<1||!p.activeCards.length} onClick={()=>edit(d=>{attemptSharedTurning(d,p.kind,roll)})}>Roll {p.kind==='rebuke'?'shared rebuking':'shared turning'} attempt</Btn>
 </div>)}</>;
}
