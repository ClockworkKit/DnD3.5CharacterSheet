import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import {equippedArmor,carrying} from './equipment.ts';
import {alternateClassLevel} from './alternate-features.ts';
import {monkAbilityLevel} from './shared-class-features.ts';

/** Complete nonstacking AC abilities: Complete Adventurer ninja; PHB monk.
 * Psionic Fist retains its existing, separately verified monk advancement.
 * Neither ordinary multiclass nor gestalt adds the monk and ninja grants.
 */
export function classArmorBonus(c:Character){
 const monk=monkAbilityLevel(c),ninja=alternateClassLevel(c,'ninja');
 const wisdom=Math.max(0,Math.floor((effectiveScore(c,'WIS')-10)/2));
 const sources=[...(monk?[{name:'Monk (including applicable Psionic Fist advancement)',level:monk,bonus:wisdom+Math.floor(monk/5)}]:[]),
  ...(ninja?[{name:'Ninja',level:ninja,bonus:wisdom+Math.floor(ninja/5)}]:[])];
 const armor=equippedArmor(c);
 const blocked=!c.automation.enabled?'manual calculations':c.automation.context.helpless?'being helpless or immobilized':armor.category>0?'wearing armor':armor.hasShield?'carrying a shield':c.automation.encumbrance&&carrying(c).category!=='Light'?'a medium or heavy load':'';
 return {sources,blocked,bonus:blocked?0:Math.max(0,...sources.map(s=>s.bonus))};
}
