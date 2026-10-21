import type {Character,Skill} from './model.ts';
import {activateAutomation,migrateRoll20Automation} from './automation.ts';
import {skillBonus} from './rules.ts';
import {repairRoll20WeaponBonuses} from './roll20-weapon-bonuses.ts';
import {repairRoll20WeaponEnhancement} from './roll20-weapon-enhancement.ts';
import {repairRoll20GlobalCombat} from './roll20-global-combat.ts';
import {repairRoll20LegacySpells} from './roll20-legacy-spells.ts';
import {repairRoll20CastingProgression} from './roll20-casting-progression.ts';
import {repairRoll20PowerDetails} from './roll20-power-details.ts';
import {repairRoll20MonkDefense} from './roll20-monk-defense.ts';
import {skillFeatBonus} from './advancement.ts';

// Only subtract bonuses recorded at import time, never today's level/feat gains.
// Keeping the adjustment separate also leaves the original misc field editable.
export function chooseImportedSkillBonus(s:Skill,included:boolean){
 if(!s.roll20Bonus)return;
 s.roll20Bonus.adjustment=included?-s.roll20Bonus.automatic:0;
 s.roll20Bonus.status=included?'included':'separate';
}

export async function repairRoll20SkillBonuses(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.skillBonusMigration===1||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 // Lazy reconstruction is a comparison only. Never replace the current sheet,
 // ranks, resources, history, or features with its older source export.
 let source:Character;
 try{
  const {importRoll20}=await import('./roll20-import.ts');
  source=importRoll20(imported.raw).character;
 }catch{
  warn('Imported skill bonuses could not be checked against the original export. Current values were kept; review Skills.');
  return c;
 }
 const manual=structuredClone(source);
 const calculated=activateAutomation(migrateRoll20Automation(source));
 for(const original of manual.skills){
  const same=(s:Skill)=>s.name===original.name&&s.ability===original.ability;
  const oldMatches=manual.skills.filter(same),matches=c.skills.filter(same);
  if(oldMatches.length!==1||matches.length!==1)continue;
  const current=matches[0],computed=calculated.skills.find(s=>s.id===original.id)!;
  if(current.roll20Bonus&&current.roll20Bonus.status!=='pending')continue;
  const total=original.roll20Bonus?.sourceTotal;
  const automatic=total!==undefined?skillBonus(calculated,computed)-skillBonus(manual,original):skillFeatBonus(calculated,original.name);
  // An unresolved formula is not a numeric total. Nonzero misc plus a known
  // feat is only a possible overlap, not evidence sufficient to subtract it.
  if(!automatic||(total===undefined&&!original.misc)){delete current.roll20Bonus;continue;}
  const unchanged=current.misc===original.misc&&current.armor===original.armor;
  const preserveTotal=total!==undefined&&unchanged;
  current.roll20Bonus={sourceMisc:original.misc,...(total!==undefined?{sourceTotal:total}:{}),automatic,adjustment:preserveTotal?-automatic:0,status:preserveTotal?'total':'review'};
 }
 imported.skillBonusMigration=1;
 if(c.skills.some(s=>s.roll20Bonus?.status==='review'))warn('Some imported miscellaneous skill bonuses may already include feat bonuses. Open Skills > Imported bonus review and confirm what was included. No ambiguous bonus was subtracted automatically.');
 return c;
}

// All UI load/import entry points use the same awaited migration.
export async function prepareCharacter(c:Character){
 await repairRoll20SkillBonuses(c);
 await repairRoll20WeaponBonuses(c);
 await repairRoll20WeaponEnhancement(c);
 await repairRoll20GlobalCombat(c);
 await repairRoll20LegacySpells(c);
 await repairRoll20PowerDetails(c);
 await repairRoll20MonkDefense(c);
 activateAutomation(migrateRoll20Automation(c));
 return repairRoll20CastingProgression(c);
}
