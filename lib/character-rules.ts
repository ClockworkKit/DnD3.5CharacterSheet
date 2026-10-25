import type {Character} from './model.ts';
import {hitDieSequence} from './level-history.ts';
import {secureDie} from './dice.mjs';

export const hitPointMethods:Array<[Character['automation']['hpMethod'],string]>=[
 ['rolled','Standard: maximum first die, then recorded rolls'],
 ['average','Optional: maximum first die, then average'],
 ['maximum','House rule: maximum every Hit Die'],
];

/** Creation only. Loading/recomputing an existing sheet must never generate dice. */
export function recordStartingHitDice(c:Character,provided?:number[]){
 const sequence=hitDieSequence(c);
 if(provided&&provided.length!==Math.max(0,sequence.length-1))throw new Error('Provide one HP roll for each Hit Die after the first.');
 const values=sequence.map((row,i)=>i===0?row.die:provided?.[i-1]??secureDie(row.die));
 if(values.some((value,i)=>!Number.isInteger(value)||value<1||value>sequence[i].die))throw new Error('Each recorded HP roll must be a whole number within its Hit Die.');
 const history=sequence.map((row,i)=>{
  const h=c.automation.history.find(h=>h.key===row.key);
  if(!h)throw new Error('Initialize level history before recording starting HP.');
  return {...h,hitDieRoll:values[i]};
 });
 c.automation.history=history;
 return sequence.map((row,i)=>`${i+1}. ${row.label}: d${row.die} = ${values[i]}${i===0?' (maximum first Hit Die)':''}`).join('\n');
}

/** A view of existing independent settings, not a second set of homebrew flags. */
export function optionalRuleSettings(c:Character){
 const settings:string[]=[];
 if(c.automation.hpMethod!=='rolled')settings.push(c.automation.hpMethod==='maximum'?'Maximum HP at every level':'Average HP after the first Hit Die');
 if(c.ancestry.ignoreLevelAdjustment)settings.push('Level adjustment ignored');
 if(!c.automation.encumbrance)settings.push('Weight-based encumbrance disabled');
 if(Object.values(c.automation.adjustments).some(n=>n!==0)||Object.keys(c.automation.overrides).length)settings.push('Custom calculation adjustments / overrides');
 if(c.automation.history.some(h=>h.skillPoints!==undefined||Object.keys(h.skillClassOverrides).length))settings.push('Custom historical skill grants / training');
 return settings;
}
