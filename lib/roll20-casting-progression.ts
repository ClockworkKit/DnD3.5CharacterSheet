import {characterSchema,type Character,type Caster} from './model.ts';
import {recompute} from './automation.ts';
import {arcaneClasses} from './advancement.ts';
import {attributeReader} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

const kind=(p:Caster)=>arcaneClasses.includes(p.casting?.classId||'')?'arcane':'divine';
const equal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

/** Unfreeze unchanged imported traditions using offsets measured at export time, not today's level. */
export async function repairRoll20CastingProgression(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.castingProgressionMigration===1||!c.automation.enabled||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Imported casting progression could not be checked against the original export. Current traditions and resource use were kept; review Calculations.');return c;}
 const reader=attributeReader(roll20ExportSchema.parse(imported.raw),()=>{});
 const baseline=structuredClone(source);
 baseline.automation.enabled=true;
 for(const p of baseline.casters)if(p.casting?.classId&&!p.casting.domain)p.casting.automatic=true;
 for(const p of baseline.psionics)if(p.manifesting?.classId)p.manifesting.automatic=true;
 recompute(baseline);
 // Only numeric source totals establish offsets. Missing/formula fields were
 // importer placeholders, not player overrides of class/prestige progression.
 for(const p of baseline.casters){
  if(!p.casting?.automatic)continue;
  const old=source.casters.find(q=>q.id===p.id)!;
  const unique=source.casters.filter(q=>!q.casting?.domain&&kind(q)===kind(p)).length===1;
  p.casting.levelAdjustment=unique&&reader.number(kind(p)+'casterlevel')!==undefined?old.level-p.level:0;
  p.casting.slotAdjustments=old.slots.map((s,i)=>unique&&reader.number(kind(p)+'spells'+i)!==undefined?s.max-p.slots[i].max:0);
 }
 for(const p of baseline.psionics){
  if(!p.manifesting?.automatic)continue;
  const old=source.psionics.find(q=>q.id===p.id)!;
  p.manifesting.levelAdjustment=source.psionics.length===1&&reader.number('manifesterlevel','manifester_level')!==undefined?old.level-p.level:0;
 }
 // Bonus power points depend on the corrected manifester level.
 recompute(baseline);
 for(const p of baseline.psionics){
  if(!p.manifesting?.automatic)continue;
  const old=source.psionics.find(q=>q.id===p.id)!;
  const explicit=reader.max('powerpoints','power_points')??reader.number('powerpoints_max','power_points_max');
  const raised=source.roll20Import!.report.warnings.some(s=>s.startsWith('Power points exceed the recorded maximum'));
  p.manifesting.pointsAdjustment=source.psionics.length===1&&(explicit!==undefined||raised)?old.max-p.max:0;
 }
 const next=structuredClone(c);let repaired=false,review=false;
 for(const old of source.casters){
  if(!old.casting?.classId||old.casting.domain){review=true;continue;}
  const matches=next.casters.filter(p=>p.casting?.classId===old.casting!.classId&&!p.casting.domain);
  if(source.casters.filter(p=>p.casting?.classId===old.casting!.classId&&!p.casting.domain).length!==1||matches.length!==1){review=true;continue;}
  const p=matches[0];if(p.casting?.automatic)continue;
  if(!next.classLevels.some(e=>e.classId===old.casting!.classId)||p.ability!==old.ability||p.list!==old.list||p.mode!==old.mode||p.level!==old.level||!equal(p.casting,old.casting)||!equal(p.slots.map(s=>s.max),old.slots.map(s=>s.max))){review=true;continue;}
  p.casting=structuredClone(baseline.casters.find(q=>q.id===old.id)!.casting);repaired=true;
 }
 for(const old of source.psionics){
  if(!old.manifesting?.classId){review=true;continue;}
  const matches=next.psionics.filter(p=>p.manifesting?.classId===old.manifesting!.classId);
  if(source.psionics.filter(p=>p.manifesting?.classId===old.manifesting!.classId).length!==1||matches.length!==1){review=true;continue;}
  const p=matches[0];if(p.manifesting?.automatic)continue;
  if(!next.classLevels.some(e=>e.classId===old.manifesting!.classId)||p.ability!==old.ability||p.level!==old.level||p.max!==old.max||!equal(p.manifesting,old.manifesting)){review=true;continue;}
  p.manifesting=structuredClone(baseline.psionics.find(q=>q.id===old.id)!.manifesting);repaired=true;
 }
 if(repaired){
  recompute(next);
  if(!characterSchema.safeParse(next).success){warn('Imported casting progression requires adjustments outside supported limits. Current traditions and resource use were kept; review Calculations.');return c;}
  // Recompute only supplies the revised profiles. No unrelated character state
  // (HP, ranks/history, features or equipment) is copied from the comparison.
  c.casters=next.casters;c.psionics=next.psionics;
  warn('Enabled advancement for unchanged imported casting/psionic traditions. Numeric source adjustments were retained at their original level; later levels and lasting ability changes now apply. Prepared spells, spent slots and spent power points were kept. Review Automatic progression and adjustments in Calculations.');
 }
 imported.castingProgressionMigration=1;
 if(review)warn('Some imported casting traditions were edited, removed, or ambiguous and remain unchanged. Review Automatic progression, level/slot adjustments and power points in Calculations.');
 return c;
}
