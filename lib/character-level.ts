import type {Character} from './model.ts';

/** Character-wide limits use actual levels; individual class features keep their own levels. */
export function characterHitDice(c:Character):number{
 if(c.advancementMode==='gestalt'){
  if(!c.gestaltProgression)throw new Error('Gestalt advancement requires recorded paired levels.');
  return c.gestaltProgression.levels.length;
 }
 return c.classLevels.reduce((sum,entry)=>sum+entry.level,0)+c.ancestry.racialHitDice||c.level;
}
