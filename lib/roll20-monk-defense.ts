import {characterSchema,type Character} from './model.ts';
import {classLevel} from './effects.ts';
import {effectiveScore} from './ancestry.ts';
import {activateAutomation,migrateRoll20Automation} from './automation.ts';

/** Remove only the old, identifiable deduction for an unavailable monk AC bonus. */
export async function repairRoll20MonkDefense(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.monkDefenseMigration===1||c.sheetKind==='monster')return c;
 if(!c.automation.enabled){imported.monkDefenseMigration=1;return c;}
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Imported monk AC could not be checked against the original export. Current defenses were kept; review Calculations.');return c;}
 const monk=classLevel(source,'monk');
 if(!monk){imported.monkDefenseMigration=1;return c;}
 const oldMisc=source.defense.misc-Math.floor((effectiveScore(source,'WIS')-10)/2)-Math.floor(monk/5);
 const corrected=activateAutomation(migrateRoll20Automation(source)).defense.misc;
 if(oldMisc!==corrected&&c.defense.misc!==corrected){
  const next=structuredClone(c);next.defense.misc=corrected;
  if(c.defense.misc===oldMisc&&c.automation.overrides['defense.misc']===undefined&&characterSchema.safeParse(next).success){
   c.defense.misc=corrected;
   warn('Corrected an old import deduction for a monk AC bonus that armor, a shield or encumbrance prevented. Later levels, ability scores, equipment, HP and spent resources were kept.');
  }else warn('The original import may have deducted an unavailable monk AC bonus, but current miscellaneous AC was edited or overridden. Current defenses were kept; review Calculations.');
 }
 imported.monkDefenseMigration=1;
 return c;
}
