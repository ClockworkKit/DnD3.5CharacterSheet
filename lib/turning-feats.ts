import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import {featCount,hasFeat} from './effects.ts';

/** SRD Extra Turning is repeatable; use the existing earned-feat identity rules. */
export function turningDailyUses(c:Character){
 return Math.max(0,3+Math.floor((effectiveScore(c,'CHA')-10)/2)+4*featCount(c,'Extra Turning'));
}

/** Improved Turning changes an existing effective level, never its entry level. */
export function effectiveTurningLevel(c:Character,baseLevel:number){
 return baseLevel>0?baseLevel+(hasFeat(c,'Improved Turning')?1:0):0;
}
