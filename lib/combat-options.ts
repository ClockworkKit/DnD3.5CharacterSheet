import type {Character} from './model.ts';
import {alternateActionActive} from './alternate-actions.ts';
import {hasFeat} from './effects.ts';

export function effectiveBab(c:Character){return c.bab-(alternateActionActive(c,'fighter-resolute','resolute')?Math.floor(c.bab/2):0);}

/** A saved selection alone is not a feat grant. Keep attacks, AC and style triggers in sync. */
export function combatExpertiseAmount(c:Character,selected=c.automation.context.combatExpertise){
 return c.automation.enabled&&hasFeat(c,'Combat Expertise')?Math.max(0,Math.min(5,effectiveBab(c),selected)):0;
}
