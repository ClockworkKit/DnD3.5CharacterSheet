import type {Character} from './model.ts';
import {classFeatureLevel,alternateClassLevel} from './alternate-features.ts';
import {characterGestaltRows} from './gestalt-progression.ts';

/**
 * Psionic Fist advances only unarmed damage, AC and unarmored speed. In
 * gestalt, simultaneous monk/Psionic Fist advancement counts once. Ordinary
 * multiclass levels still stack. Never use this for flurry or other monk powers.
 * Source: SRD Psionic Fist, Monk Abilities; UA gestalt shared class features.
 */
export function monkAbilityLevel(c:Character,feature?:'fast-movement'):number{
 const monk=feature?classFeatureLevel(c,'monk',feature):alternateClassLevel(c,'monk');
 const rows=characterGestaltRows(c);
 if(!rows)return monk+alternateClassLevel(c,'psionic-fist');
 return rows.reduce((total,row)=>total+Number([row.left,row.right].some(side=>
  side.classId==='psionic-fist'||side.classId==='monk'&&monk>0)),0);
}
