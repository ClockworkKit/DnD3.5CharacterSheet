import type {Character,Weapon} from './model.ts';
import type {AttributeReader} from './roll20-attributes.ts';
import {parseDiceFormula} from './dice.mjs';
import {matchEquipment} from './equipment.ts';

export function readRoll20GlobalCombat(r:AttributeReader,warn:(message:string)=>void):Character['globalCombat']{
 const names=['globalAttackBonus','globalDamageBonus','globalVariableDamageBonus'];
 if(!r.present(...names))return;
 const number=(name:string)=>{const n=r.number(name);if(n===undefined&&r.text(name))warn(name+' is not a numeric literal; no formula was executed. Review Global weapon modifiers in Combat.');return n??0;};
 const attack=number(names[0]),damage=number(names[1]),raw=r.text(names[2]);
 let extraDamage='';
 if(raw&&raw.trim()!=='0')try{extraDamage=parseDiceFormula(raw).formula;}catch{warn('Global variable damage is not a supported dice formula. It remains in the original export; review Global weapon modifiers in Combat.');}
 return {enabled:r.boolean('globalBonusEnabled')!==false,attack,damage,extraDamage};
}

/** Source totals already contain their global attack component; keep it separate. */
export function recordRoll20GlobalWeapon(w:Weapon,global:Character['globalCombat'],numericAttack:boolean,completeDamage:boolean){
 if(!global)return;
 if(numericAttack&&global.enabled&&global.attack)w.globalAttackOffset=global.attack;
 if(completeDamage&&(global.damage||global.extraDamage))w.globalDamageIncluded=true;
}

export async function repairRoll20GlobalCombat(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.globalCombatMigration===1||c.sheetKind==='monster')return c;
 const warn=(s:string)=>{if(!imported.report.warnings.includes(s))imported.report.warnings.push(s);};
 if(c.globalCombat!==undefined){imported.globalCombatMigration=1;return c;}
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Global weapon modifiers could not be checked against the original export. Current combat settings were kept.');return c;}
 const global=source.globalCombat;
 for(const message of source.roll20Import?.report.warnings||[])if(/global|Global/.test(message))warn(message);
 if(!global||!global.attack&&!global.damage&&!global.extraDamage){imported.globalCombatMigration=1;return c;}
 const pairs:Array<[Weapon,Weapon]>=[];
 let uncertain=!!c.situational||c.effects.some(e=>e.active&&e.modifiers.some(m=>['attack','damage'].includes(m.target)));
 for(const original of source.weapons){
  const same=(w:Weapon)=>w.name===original.name,found=c.weapons.filter(same);
  if(source.weapons.filter(same).length!==1||found.length!==1){uncertain=true;continue;}
  const current=found[0],catalog=matchEquipment(original.name,'weapon');
  if(current.catalogId&&current.catalogId!==catalog?.id||c.automation.enabled&&catalog&&!current.catalogId){uncertain=true;continue;}
  if(current.attack!==original.attack||current.damageExtra!==original.damageExtra||current.damage!==original.damage||current.extraDamage||current.ability!==original.ability||current.damageAbility!==original.damageAbility||current.strength!==original.strength||current.attackMode!==original.attackMode||current.globalAttackOffset!==undefined||current.globalDamageIncluded!==undefined){uncertain=true;continue;}
  pairs.push([current,original]);
 }
 if(uncertain){
  warn(`Original global weapon modifiers: attack ${global.attack}, damage ${global.damage}, extra damage ${global.extraDamage||'none'}, ${global.enabled?'enabled':'disabled'}. Current combat entries or effects were edited, so these were not applied automatically. Review Global weapon modifiers and each weapon's included-global fields in Combat before enabling them.`);
 }else{
  c.globalCombat={...global};
  for(const [current,original] of pairs){
   if(original.globalAttackOffset!==undefined)current.globalAttackOffset=original.globalAttackOffset;
   if(original.globalDamageIncluded!==undefined)current.globalDamageIncluded=original.globalDamageIncluded;
  }
  warn('Restored global weapon modifiers in Combat without replacing weapons, progression, HP, or spent resources. Numeric attack totals retain their original included component; complete damage formulas require review before adding global damage.');
 }
 imported.globalCombatMigration=1;
 return c;
}
