import type {Character,Caster,KnownSpell} from './model.ts';
import {attributeReader,parseRepeating,roll20Text,type RepeatingRow} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

// Before Roll20 sheet v2.7.9, first-level divine spells used this retired section.
export function legacyDivineSpell(section:string,row:RepeatingRow){
 return section==='spells'&&Object.entries(row.fields).some(([name,fields])=>name.toLowerCase()==='spellname11'&&fields.some(field=>roll20Text(field.current)?.trim()));
}
const sameSpell=(a:KnownSpell,b:KnownSpell,sourceName:string|undefined)=>a.level===b.level&&(a.custom?a.custom.name.trim().toLowerCase()===(b.custom?.name||sourceName)?.trim().toLowerCase():!b.custom&&a.spellId===b.spellId);
function sameTradition(a:Caster,b:Caster){
 if(!!a.casting?.domain!==!!b.casting?.domain)return false;
 if(b.casting?.classId)return a.casting?.classId===b.casting.classId&&a.mode===b.mode&&a.list===b.list;
 return a.name===b.name&&a.list===b.list&&a.mode===b.mode;
}

/** Recover omitted entries, never roll today's preparations or resource use back to export time. */
export async function repairRoll20LegacySpells(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.legacySpellsMigration===1)return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 const parsed=roll20ExportSchema.safeParse(imported.raw);
 if(!parsed.success||parsed.data.version!==1){warn('Legacy Roll20 spells could not be checked against the original export. Current spells and usage were kept.');return c;}
 const rows=parseRepeating(parsed.data.attributes);
 if(!Object.values(rows.spells?.rows||{}).some(row=>legacyDivineSpell('spells',row))){imported.legacySpellsMigration=1;return c;}
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Legacy Roll20 spells could not be reconstructed from the original export. Current spells and usage were kept.');return c;}
 for(const message of source.roll20Import?.report.warnings||[])if(/spell/i.test(message))warn(message);
 const reader=attributeReader(parsed.data,warn);
 const existing=new Map(c.casters.map(p=>[p.id,[...p.spells]]));
 let recovered=0,review=false;
 for(const original of source.casters){
  const missing=original.spells.filter(s=>s.roll20LegacyRow);
  if(!missing.length)continue;
  const matches=c.casters.filter(p=>sameTradition(p,original));
  if(matches.length!==1){review=true;continue;}
  const target=matches[0];
  for(const spell of missing){
   // Keep manual re-additions and edits; stable source row IDs prevent resurrection.
   if(c.casters.some(p=>p.spells.some(s=>s.roll20LegacyRow?.toLowerCase()===spell.roll20LegacyRow?.toLowerCase())))continue;
   const sourceName=reader.text('repeating_spells_'+spell.roll20LegacyRow+'_spellname11');
   if(existing.get(target.id)!.some(s=>sameSpell(s,spell,sourceName)))continue;
   if(target.spells.length>=1000){review=true;continue;}
   const note=`Recovered legacy Roll20 spell. Original prepared: ${spell.prepared}; used: ${spell.spent}. Today's preparations and spent slots were not changed. Review this spell before preparing or casting it.`;
   target.spells.push({...structuredClone(spell),prepared:0,spent:0,notes:(note+'\n'+spell.notes).slice(0,2000)});
   recovered++;
  }
 }
 imported.legacySpellsMigration=1;
 if(recovered)warn(`Recovered ${recovered} omitted legacy Roll20 spell entries in Magic. Prepared casters must prepare them before use. Today's slots, spent uses, class levels, and existing spells were not changed; original counts are in each recovered spell's notes.`);
 if(review)warn('Some legacy Roll20 spells could not be assigned to one current casting tradition or its spell list was full. Current spells were kept; review the original export before adding them manually.');
 return c;
}
