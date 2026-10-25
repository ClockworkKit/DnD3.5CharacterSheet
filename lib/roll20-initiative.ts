import type {Character} from './model.ts';
import {equippedArmor} from './equipment.ts';
import {attributeReader} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

/** Only the armor term; initiative's existing ability/feat/effect terms stay separate. */
export function initiativeArmorPenalty(c:Character){
 if(!c.automation.enabled||c.sheetKind==='monster')return 0;
 const review=c.roll20Import?.initiativeArmor;
 // Unreviewed imports retain the pre-fix total until the shared load repair runs.
 if(c.roll20Import&&review?.mode!=='automatic')return 0;
 return equippedArmor(c).nonproficient-(review?.includedPenalty||0);
}

export function chooseInitiativeArmor(c:Character,includedPenalty:number|null){
 if(!c.roll20Import?.initiativeArmor)throw new Error('Load the imported initiative review first.');
 if(includedPenalty!==null&&(!Number.isFinite(includedPenalty)||includedPenalty>0||includedPenalty< -200))throw new Error('The included armor/shield penalty must be between -200 and 0.');
 c.roll20Import.initiativeArmor={...c.roll20Import.initiativeArmor,mode:includedPenalty===null?'manual':'automatic',includedPenalty:includedPenalty??0};
}

/** Compare source evidence once, without changing misc, abilities, equipment or resources. */
export async function reviewRoll20Initiative(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.initiativeArmor||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{
  imported.initiativeArmor={mode:'review',includedPenalty:0};
  warn('Original initiative equipment could not be checked. Current initiative was kept; review Initiative armor penalty in Combat.');return c;
 }
 const original=equippedArmor(source).nonproficient,current=equippedArmor(c).nonproficient;
 const r=attributeReader(roll20ExportSchema.parse(imported.raw),()=>{}),total=r.number('init','initiative','initiative_bonus');
 const classEvidence=source.classLevels.length>0&&source.classLevels.every(e=>e.classId)&&source.classLevels.reduce((n,e)=>n+e.level,0)===source.level;
 // Numeric totals are authoritative only with unchanged misc and equipment penalty.
 // A missing class (e.g. an unresolved specialty) cannot establish proficiency.
 const safe=original===0&&current===0||classEvidence&&original===current&&c.initiative===source.initiative&&(total!==undefined||source.initiative===0);
 imported.initiativeArmor={mode:safe?'automatic':'review',includedPenalty:safe&&total!==undefined?original:0,...(classEvidence?{sourcePenalty:original}:{})};
 if(!safe)warn('Imported initiative may already include an armor/shield penalty, or its equipment/class/misc values changed. Current initiative was kept. Review Initiative armor penalty in Combat; do not re-import over this character.');
 else if(original)warn(total!==undefined?'Recorded initiative was preserved with a separate included armor/shield penalty. Future equipment/proficiency changes update that term; review it in Combat if the original total was wrong.':'Initiative now applies the nonproficiency penalty from equipped armor/shields. No penalty was already recorded in the imported initiative misc field.');
 return c;
}
