import type {Character,Weapon} from './model.ts';
import {matchEquipment} from './equipment.ts';

/** Retain manual totals, but separate their known enhancement component for stacking. */
export function recordRoll20WeaponEnhancement(w:Weapon,enhancement:number,completeDamage:boolean){
 if(completeDamage||!Number.isInteger(enhancement)||enhancement<=0||enhancement>10000)return;
 w.enhancement=enhancement;
 w.roll20Enhancement={attack:enhancement,damage:enhancement};
}

/** Restore typing only where the retained source components still match today's weapon. */
export async function repairRoll20WeaponEnhancement(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.weaponEnhancementMigration===1||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{
  const {importRoll20}=await import('./roll20-import.ts');
  source=importRoll20(imported.raw).character;
 }catch{
  warn('Imported weapon enhancement bonuses could not be checked against the original export. Current weapons were kept; review Combat.');
  return c;
 }
 for(const message of source.roll20Import?.report.warnings||[])if(message.includes('enhancement bonus could not be separated'))warn(message);
 let repaired=false,review=false;
 for(const original of source.weapons){
  if(!original.roll20Enhancement)continue;
  const same=(w:Weapon)=>w.name===original.name;
  const matches=c.weapons.filter(same);
  if(source.weapons.filter(same).length!==1||matches.length!==1){review=true;continue;}
  const current=matches[0],catalog=matchEquipment(original.name,'weapon');
  if(current.roll20Enhancement!==undefined)continue;
  if(current.catalogId&&current.catalogId!==catalog?.id||c.automation.enabled&&catalog&&!current.catalogId){review=true;continue;}
  if(current.attack!==original.attack||current.damageExtra!==original.damageExtra||current.damage!==original.damage||current.ability!==original.ability||current.damageAbility!==original.damageAbility||current.strength!==original.strength||current.attackMode!==original.attackMode){review=true;continue;}
  const gear=c.gear.filter(g=>g.weaponId===current.id);
  if(gear.length>1){review=true;continue;}
  // Gear is authoritative when linked. An explicit zero is a player choice, not missing data.
  if(gear.length&&gear[0].catalogId){
   if(gear[0].catalogId!==catalog?.id){review=true;continue;}
   gear[0].enhancement??=original.enhancement;
   current.enhancement=gear[0].enhancement;
  }else current.enhancement??=original.enhancement;
  current.roll20Enhancement={...original.roll20Enhancement};repaired=true;
 }
 imported.weaponEnhancementMigration=1;
 if(repaired)warn('Separated imported weapon enhancement bonuses from miscellaneous totals for automatic stacking. Original misc values, later levels and weapon upgrades were retained. Review Imported enhancement components in Combat if you change those misc fields.');
 if(review)warn('Some imported weapon enhancement components were edited or could not be safely matched. They were kept unchanged; review enhancement stacking in Combat.');
 return c;
}
