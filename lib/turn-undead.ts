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
 if(!counter||counter.used>=counter.max||!resourceNumbers(c).turnLevel)return false;
 const accepted=send(turningRoll(c));
 if(accepted)counter.used++;
 return accepted;
}
