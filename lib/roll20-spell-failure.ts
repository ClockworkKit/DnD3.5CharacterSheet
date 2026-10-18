import type {Character} from './model.ts';
import {attributeReader,type AttributeReader} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';
import {roll20ArmorItems} from './roll20-equipment.ts';
import {gearEquipment} from './equipment.ts';

const components=(r:AttributeReader)=>(r.boolean('armorworn')===false?0:r.number('acitemspellfailure')??0)+(r.boolean('shieldworn')===false?0:r.number('shieldspellfailure')??0);

// Both fields are totals, not additional armor penalties. Numeric zero is an
// intentional total; arbitrary Roll20 formulas are never evaluated.
export function roll20SpellFailure(r:AttributeReader){
 return r.number('arcane_spell_failure','arcanespellfailure')??components(r);
}

/** Repair only the recognizable old importer signature, never replay an export. */
export function repairRoll20SpellFailure(c:Character){
 const source=c.roll20Import;
 if(!source||source.spellFailureMigration===1||c.sheetKind==='monster')return;
 const parsed=roll20ExportSchema.safeParse(source.raw);
 if(!parsed.success||parsed.data.version!==1)return;
 const warn=(message:string)=>{if(!source.report.warnings.includes(message))source.report.warnings.push(message);};
 const r=attributeReader(parsed.data,()=>{}),total=r.number('arcanespellfailure'),extra=components(r);
 source.spellFailureMigration=1;
 if(r.number('arcane_spell_failure')!==undefined||total===undefined||extra===0)return;
 const oldTotal=total+extra,path='defense.spellFailure';
 let repaired=false;
 if(c.automation.enabled){
  // Armor restoration runs first. Equipment changes afterward do not alter
  // this permanent offset; explicit overrides and edited offsets win.
  const originalFailure=roll20ArmorItems(r,()=>{}).reduce((sum,g)=>sum+(gearEquipment(g)?.spellFailure||0),0);
  const expectedAdjustment=oldTotal-originalFailure;
  if(c.automation.overrides[path]===undefined&&(c.automation.adjustments[path]||0)===expectedAdjustment){
   c.automation.adjustments[path]=expectedAdjustment-extra;
   if(!c.automation.adjustments[path])delete c.automation.adjustments[path];
   repaired=true;
  }
 }else if(c.defense.spellFailure===oldTotal){c.defense.spellFailure=total;repaired=true;}
 warn(repaired?'Corrected an importer error that added armor/shield spell failure to an already recorded total. Current advancement, equipment, and other statistics were retained.':'The original import could have counted spell failure twice. Current values or overrides differ from the old importer signature, so they were preserved. Review spell failure in Calculations.');
}
