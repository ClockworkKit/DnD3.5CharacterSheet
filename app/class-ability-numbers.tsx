'use client';
import {StrengthDomainPower} from './strength-domain-power';
import {resourceNumbers} from '@/lib/automation';
import {classLevel} from '@/lib/effects';
import {TurnUndead} from './turn-undead';
import {Section,Stat,type SheetProps} from './sheet-ui';

export function ClassAbilityNumbers({c,edit,roll}:Pick<SheetProps,'c'|'edit'|'roll'>){
 const r=resourceNumbers(c);
 return (<Section title="Class ability numbers"><StrengthDomainPower c={c} edit={edit}/><div className="stats">{classLevel(c,'barbarian')>0&&<><Stat label="Rage per day" value={r.rageUses}/><Stat label="Rage duration" value={r.rageRounds+' rounds'}/></>}{r.sneakDice>0&&<Stat label="Sneak attack" value={r.sneakDice+'d6'}/>}<Stat label="Stunning Fist DC" value={r.stunningDC}/>{classLevel(c,'assassin')>0&&<Stat label="Death attack DC" value={r.deathAttackDC}/>} {r.breathDice>0&&<Stat label="Dragon breath / DC" value={r.breathDice+'d8 / '+r.breathDC}/>}</div>{r.turnLevel>0&&<TurnUndead c={c} edit={edit} roll={roll}/>}<p className="fine">Daily resource limits and spent uses share the counters in Feats & features. Apply damage, healing, forms, targets, and triggered abilities when they occur.</p></Section>);
}
