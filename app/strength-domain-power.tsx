import {strengthDomainPower,useStrengthDomain} from '@/lib/strength-domain';
import {advanceEffects} from '@/lib/effects';
import {toast} from 'sonner';
import {Btn,type SheetProps} from './sheet-ui';

export function StrengthDomainPower({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const power=strengthDomainPower(c);
 if(!power)return null;
 if(power.manual)return <div className="subcard"><h3>Strength domain</h3><p>{power.problem}</p></div>;
 const spend=(activate:boolean)=>{
  try{edit(d=>useStrengthDomain(d,activate));}
  catch(error){toast.error(error instanceof Error?error.message:'Could not use the Strength domain power.');}
 };
 return <div className="subcard"><h3>Strength domain</h3>
  <p>Free action. Gain a +{power.level} enhancement bonus to Strength for one round. {Math.max(0,power.limit-power.feature.used)} / {power.limit} uses remaining today.</p>
  {power.problem&&<p className="fine">{power.problem}</p>}
  {!c.automation.enabled&&<p className="fine">Enable calculations to apply the bonus to rolls.</p>}
  <div className="button-row">
   <Btn disabled={!!power.problem||!c.automation.enabled} onClick={()=>spend(true)}>Use feat of strength</Btn>
   <Btn disabled={!!power.problem} onClick={()=>spend(false)}>Record an earlier use</Btn>
   {power.effect?.active&&<Btn onClick={()=>edit(advanceEffects)}>Advance one round (all effects)</Btn>}
  </div>
 </div>;
}
