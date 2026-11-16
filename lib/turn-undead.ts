import {featureUseNumbers,spendTrackedFeature,sharedTurningPools} from './shared-turning.ts';
import {effectiveTurningLevel} from './turning-feats.ts';
import type {Character} from './model.ts';
import {resourceNumbers} from './automation.ts';
import {withBonus,type Roll} from './rules.ts';

export const turningName='Turn or rebuke undead';

export function turningCounter(c:Character){
 const managed=c.features.filter(f=>f.ruleId==='daily:'+turningName);
 const candidates=managed.length?managed:c.features.filter(f=>!f.ruleId&&f.kind==='Class feature'&&f.name===turningName);
 return candidates.length===1?candidates[0]:undefined;
}

export function turningRoll(c:Character):Roll{
 const numbers=resourceNumbers(c);
 return {title:turningName,rolls:[
  {label:'Turning check',formula:withBonus('1d20',numbers.turnCheck)},
  {label:'Total undead HD affected',formula:withBonus('2d6',numbers.turnDamage)}
 ],fields:[['Effective turning level',String(numbers.turnLevel)]],
 details:'Use the turning check to find the strongest undead affected. Apply the total HD to eligible undead within 60 feet, closest first.'};
}

export function attemptTurning(c:Character,send:(card:Roll)=>boolean){
 const counter=turningCounter(c);
 if(!counter||featureUseNumbers(c,counter).remaining<1||!resourceNumbers(c).turnLevel)return false;
 const accepted=send(turningRoll(c));
 if(accepted)spendTrackedFeature(c,counter.id);
 return accepted;
}

export function attemptSharedTurning(c:Character,kind:'turn'|'rebuke',send:(card:Roll)=>boolean){
 const pool=sharedTurningPools(c).find(p=>p.kind===kind);
 if(!pool||pool.remaining<1||!pool.activeCards.length)return false;
 const base=resourceNumbers(c),level=effectiveTurningLevel(c,pool.baseLevel);
 const card:Roll={title:pool.label,rolls:[
  {label:'Turning check',formula:withBonus('1d20',base.turnCheck)},
  {label:'Total undead HD affected',formula:withBonus('2d6',base.turnDamage-base.turnLevel+level)}
 ],fields:[['Effective turning level',String(level)],['Shared sources',pool.active.map(s=>s.name).join(', ')]],
 details:'One shared daily pool. Apply the turning check and total undead HD to eligible targets within 60 feet, closest first.'};
 const accepted=send(card);if(accepted)spendTrackedFeature(c,pool.activeCards[0].id);return accepted;
}
