'use client';
import {resourceNumbers} from '@/lib/automation';
import {classLevel} from '@/lib/effects';
import {signed,withBonus} from '@/lib/rules';
import {Section,Stat,Btn,type SheetProps} from './sheet-ui';

export function ClassAbilityNumbers({c,roll}:Pick<SheetProps,'c'|'roll'>){
 const r=resourceNumbers(c);
 return (<Section title="Class ability numbers"><div className="stats">{classLevel(c,'barbarian')>0&&<><Stat label="Rage per day" value={r.rageUses}/><Stat label="Rage duration" value={r.rageRounds+' rounds'}/></>}{r.sneakDice>0&&<Stat label="Sneak attack" value={r.sneakDice+'d6'}/>}<Stat label="Stunning Fist DC" value={r.stunningDC}/>{classLevel(c,'assassin')>0&&<Stat label="Death attack DC" value={r.deathAttackDC}/>} {r.breathDice>0&&<Stat label="Dragon breath / DC" value={r.breathDice+'d8 / '+r.breathDC}/>}</div>{r.turnLevel>0&&<div className="button-row"><Btn onClick={()=>roll({title:'Turn undead · turning check',formula:withBonus('1d20',r.turnCheck),details:'Effective turning level '+r.turnLevel+'. Use the turning table for the strongest undead affected.'})}>Turning check {signed(r.turnCheck)}</Btn><Btn onClick={()=>roll({title:'Turn undead · HD affected',formula:withBonus('2d6',r.turnDamage),details:'Total Hit Dice affected. Spend one turning attempt using its daily feature counter.'})}>Turning damage</Btn></div>}<p className="fine">Daily resource limits and spent uses share the counters in Feats & features. Apply damage, healing, forms, targets, and triggered abilities when they occur.</p></Section>);
}
