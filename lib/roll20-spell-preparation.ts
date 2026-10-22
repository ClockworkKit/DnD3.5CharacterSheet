import type {Character} from './model.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {legacyDivineSpell} from './roll20-legacy-spells.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

/** Historical preparation is not evidence of today's remaining spells. Warn, never refill. */
export function reviewRoll20SpellPreparation(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.spellPreparationReview===1||c.sheetKind==='monster')return;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 const parsed=roll20ExportSchema.safeParse(imported.raw);
 if(!parsed.success||parsed.data.version!==1){warn('Original spell preparation could not be checked. Current preparations and spent uses were kept.');return;}
 const reader=attributeReader(parsed.data,warn);let affected=false;
 for(const [section,group] of Object.entries(parseRepeating(parsed.data.attributes))){
  if(!/^(spell|spells|spellbook)$|^spells\d+[12]$/.test(section))continue;
  for(const row of Object.values(group.rows)){
   const suffix=legacyDivineSpell(section,row)?'11':section.match(/^spells(\d+[12])$/)?.[1]||'';
   const first=Object.values(row.fields)[0][0],prefix=first.originalName.slice(0,-first.name.length);
   if(!reader.text(prefix+'spellname'+suffix,prefix+'spellname',prefix+'name'))continue;
   const names=['spellprep'+suffix,'prepared','memorized'].map(name=>prefix+name);
   if(reader.number(...names)===undefined&&reader.boolean(names[0])===true&&reader.boolean(...names.slice(1))!==true)affected=true;
   const spent=['spellused'+suffix,'spent','used'].map(name=>prefix+name);
   if(reader.number(...spent)===undefined&&reader.boolean(...spent)===true)affected=true;
  }
 }
 if(affected)warn('The original Roll20 export contains checkbox-style spell preparations or usage that older imports could read as zero. Current preparations and spent uses were kept to avoid restoring spells already used. Review Magic against your current session records before casting; reset only during normal daily preparation. Do not re-import over your current character.');
 imported.spellPreparationReview=1;
}
