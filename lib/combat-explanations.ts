import type {Character} from './model.ts';
import {carrying,equippedArmor} from './equipment.ts';
import {hasAlternateFeature} from './alternate-features.ts';
import {evasionFeatures,uncannyDodgeFeatures} from './defensive-class-features.ts';
import {resourceNumbers} from './automation.ts';

export function armorBreakdown(c:Character){
 const armor=equippedArmor(c),load=carrying(c),encumbrance=c.automation.enabled&&c.automation.encumbrance;
 return {armor,load,encumbrance,basePenalty:Math.min(armor.checkPenalty,encumbrance?load.checkPenalty:0),baseDexCap:Math.min(armor.dexCap,encumbrance?load.dexCap:100)};
}
export function rogueCombatFeatures(c:Character){
 const defensive=evasionFeatures(c),evasion=defensive.tier>0;
 const evasionBlocked=defensive.magicTier?'':defensive.sources[0]?.blocked??'';
 const uncannyDefense=uncannyDodgeFeatures(c);
 return {evasion,evasionBlocked,defensive,uncanny:uncannyDefense.sources,uncannyDefense,deathsRuin:hasAlternateFeature(c,'rogue-deaths-ruin'),deathsRuinDice:Math.floor(resourceNumbers(c).sneakDice/2)};
}
export function setDeathsRuin(c:Character,enabled:boolean){
 c.automation.context.deathsRuin=enabled;
 if(enabled)c.automation.context.targetType='undead';
}
