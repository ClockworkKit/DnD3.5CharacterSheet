import type {Spell} from './model.ts';
import type {SpellAttackSettings} from './spell-attack-schema.ts';

export const searingLightTargets:Array<[NonNullable<SpellAttackSettings['effectTarget']>,string]>=[
 ['ordinary','Ordinary creature'],['undead','Undead'],
 ['light-vulnerable-undead','Undead vulnerable to bright light'],['construct','Construct or inanimate object'],
];
export const hasSearingLightTargets=(s:Spell)=>s.id==='searing-light';
export function searingLightFormula(cl:number,target:SpellAttackSettings['effectTarget']='ordinary'){
 const undead=target==='undead'||target==='light-vulnerable-undead';
 const count=Math.max(1,Math.min(undead?10:5,undead?cl:Math.floor(cl/2)));
 return `${count}d${target==='undead'||target==='construct'?6:8}`;
}
export function spellEffectTargetNote(s:Spell,settings?:SpellAttackSettings){
 if(!hasSearingLightTargets(s))return '';
 const target=(settings??s.attack)?.effectTarget??'ordinary';
 return 'Searing Light damage target: '+searingLightTargets.find(([id])=>id===target)![1]+'. A custom effect formula takes priority.';
}
