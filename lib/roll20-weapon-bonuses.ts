import type {Character,Weapon} from './model.ts';
import {hasFeat} from './effects.ts';
import {matchEquipment} from './equipment.ts';

/** Numeric attack totals already include their source modifiers; otherwise use explicit components. */
export function recordRoll20WeaponFeatBonuses(c:Character,w:Weapon,focus:number,specialization:number,completeDamage:boolean,total?:number){
 const attack=Number(hasFeat(c,'Weapon Focus',w.name))+Number(hasFeat(c,'Greater Weapon Focus',w.name));
 const damage=2*(Number(hasFeat(c,'Weapon Specialization',w.name))+Number(hasFeat(c,'Greater Weapon Specialization',w.name)));
 const explicitOverlap=Math.min(Math.max(0,focus),attack);
 const overlapAttack=total===undefined?explicitOverlap:attack;
 const overlapDamage=completeDamage?0:Math.min(Math.max(0,specialization),damage);
 if(overlapAttack)w.roll20AttackAdjustment=-overlapAttack;
 if(total!==undefined)w.roll20AttackSource={total,explicitFocusAdjustment:explicitOverlap?-explicitOverlap:0};
 if(overlapDamage)w.roll20DamageAdjustment=-overlapDamage;
}

/** Repair old saves by comparison, never re-importing over today's character. */
export async function repairRoll20WeaponBonuses(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.weaponBonusMigration===2||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{
  const {importRoll20}=await import('./roll20-import.ts');
  source=importRoll20(imported.raw).character;
 }catch{
  warn('Imported weapon bonuses could not be checked against the original export. Current weapons were kept; review Combat.');
  return c;
 }
 for(const message of source.roll20Import?.report.warnings||[])if(message.includes('complete damage formula and specialization fields overlap ambiguously'))warn(message);
 let repaired=false,review=false;
 for(const original of source.weapons){
  if(!original.roll20AttackAdjustment&&!original.roll20DamageAdjustment)continue;
  // Names are not unique IDs: ambiguous duplicates or replacements are review-only.
  const same=(w:Weapon)=>w.name===original.name;
  const matches=c.weapons.filter(same);
  if(source.weapons.filter(same).length!==1||matches.length!==1){review=true;continue;}
  const current=matches[0],catalog=matchEquipment(original.name,'weapon');
  if(current.catalogId&&current.catalogId!==catalog?.id||c.automation.enabled&&catalog&&!current.catalogId){review=true;continue;}
  const prior=original.roll20AttackSource?.explicitFocusAdjustment;
  const upgrade=imported.weaponBonusMigration===1&&prior!==undefined&&prior!==0&&current.roll20AttackAdjustment===prior&&original.roll20AttackAdjustment!==prior;
  if(original.roll20AttackAdjustment&&(current.roll20AttackAdjustment===undefined||upgrade)){
   if(current.attack===original.attack&&current.ability===original.ability&&current.attackMode===original.attackMode){
    current.roll20AttackAdjustment=original.roll20AttackAdjustment;
    if(original.roll20AttackSource)current.roll20AttackSource={...original.roll20AttackSource};
    repaired=true;
   }else review=true;
  }
  if(original.roll20DamageAdjustment&&current.roll20DamageAdjustment===undefined){
   if(current.damageExtra===original.damageExtra&&current.damage===original.damage&&current.damageAbility===original.damageAbility&&current.strength===original.strength){
    current.roll20DamageAdjustment=original.roll20DamageAdjustment;repaired=true;
   }else review=true;
  }
 }
 imported.weaponBonusMigration=2;
 if(repaired)warn('Removed duplicate imported Weapon Focus/Specialization contributions with separate automatic-only adjustments in Combat. Numeric attack totals are preserved when automating original Focus feats, even when separate component fields were missing. Later levels, feats, equipment properties, and original miscellaneous fields were retained.');
 if(review)warn('Some imported weapon bonuses could not be safely matched or were edited after import. No uncertain adjustment was applied; review those weapons in Combat.');
 return c;
}
