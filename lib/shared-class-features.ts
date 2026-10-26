import type {Character} from './model.ts';
import {classFeatureLevel,alternateClassLevel,hasAlternateFeature} from './alternate-features.ts';
import {gestaltSharedLevelCount,gestaltFeatureLedger,type GestaltFeatureProgression} from './gestalt-progression.ts';

/**
 * Psionic Fist advances only unarmed damage, AC and unarmored speed. In
 * gestalt, simultaneous monk/Psionic Fist advancement counts once. Ordinary
 * multiclass levels still stack. Never use this for flurry or other monk powers.
 * Source: SRD Psionic Fist, Monk Abilities; UA gestalt shared class features.
 */
export function monkAbilityLevel(c:Character,feature?:'fast-movement'):number{
 const monk=feature?classFeatureLevel(c,'monk',feature):alternateClassLevel(c,'monk');
 return gestaltSharedLevelCount(c,side=>side.classId==='psionic-fist'||side.classId==='monk'&&monk>0)
  ??monk+alternateClassLevel(c,'psionic-fist');
}

/** Shared sneak attack only: ninja sudden strike and scout skirmish stay separate. */
export function sneakAttackProgressions(c:Character):Readonly<Record<string,GestaltFeatureProgression>>{
 const trickster=hasAlternateFeature(c,'spellthief-trickster'),cursed=hasAlternateFeature(c,'spellthief-cursed-blow');
 return {
  rogue:{rate:1/2,cumulative:level=>Math.ceil(level/2)},
  assassin:{rate:1/2,cumulative:level=>Math.ceil(level/2)},
  'arcane-trickster':{rate:1/2,cumulative:level=>Math.floor(level/2)},
  blackguard:{rate:1/3,cumulative:level=>Math.floor(Math.max(0,level-1)/3)},
  'psychic-rogue':{rate:1/3,cumulative:level=>Math.ceil(level/3)},
  spellthief:{rate:trickster?0:1/4,cumulative:level=>trickster?(cursed?0:1):Math.ceil(level/4)-(cursed&&level>=5?1:0)},
  ...(c.psionics.some(p=>p.manifesting?.classId==='lurk'&&p.focused)?{lurk:{rate:1/5,cumulative:(level:number)=>level<2?0:1+Math.floor((level-2)/5)}}:{}),
 };
}

export function sneakAttackDice(c:Character):number{
 const policies=sneakAttackProgressions(c),ledger=gestaltFeatureLedger(c,policies);
 if(ledger)return ledger.at(-1)?.total??0;
 return Object.entries(policies).reduce((total,[classId,policy])=>{
  const level=alternateClassLevel(c,classId);return total+(level?policy.cumulative(level):0);
 },0);
}
