import type {Character} from './model.ts';
import {magicSections,magicalSystemIds} from './magic.ts';
import {systemLimits} from './class-systems.ts';
import {alternateActions} from './alternate-actions.ts';

/** Visibility only: combat tools must share the character's existing resource stores. */
export function combatToolSections(c:Character){
 return {
  magic:Object.values(magicSections(c)).some(Boolean),
  martial:c.classLevels.some(e=>!magicalSystemIds.includes(e.classId)&&!!systemLimits(c,e.classId))||c.classSystems.choices.some(s=>!magicalSystemIds.includes(s.classId)),
  alternateIds:[...new Set(alternateActions(c).map(a=>a.featureId))],
 };
}
