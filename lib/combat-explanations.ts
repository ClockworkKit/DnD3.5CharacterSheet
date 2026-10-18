import type {Character} from './model.ts';
import {carrying,equippedArmor} from './equipment.ts';
import {classFeatureLevel,hasAlternateFeature} from './alternate-features.ts';
import {resourceNumbers} from './automation.ts';

export function armorBreakdown(c:Character){
 const armor=equippedArmor(c),load=carrying(c),encumbrance=c.automation.enabled&&c.automation.encumbrance;
 return {armor,load,encumbrance,basePenalty:Math.min(armor.checkPenalty,encumbrance?load.checkPenalty:0),baseDexCap:Math.min(armor.dexCap,encumbrance?load.dexCap:100)};
}
export function rogueCombatFeatures(c:Character){
 const {armor,load,encumbrance}=armorBreakdown(c);
 const evasion=classFeatureLevel(c,'rogue','evasion')>=2;
 const evasionBlocked=armor.category>1?'medium or heavy armor':encumbrance&&load.category!=='Light'?'a medium or heavier load':c.automation.context.helpless?'being helpless':'';
 return {evasion,evasionBlocked,deathsRuin:hasAlternateFeature(c,'rogue-deaths-ruin'),deathsRuinDice:Math.floor(resourceNumbers(c).sneakDice/2)};
}
export function setDeathsRuin(c:Character,enabled:boolean){
 c.automation.context.deathsRuin=enabled;
 if(enabled)c.automation.context.targetType='undead';
}
