import {characterSchema,type Character,type Spell} from './model.ts';

// Verified SRD summaries, not a general "strip everything after a colon" rule.
// Open Game Content: public/data/OPEN-GAME-LICENSE.txt.
// https://www.d20srd.org/srd/spellLists/bardSpells.htm
const summaries:Record<string,string>={
 'Detect Magic':'Detects spells and magic items within 60 ft.',
 'Lullaby':'Makes subject drowsy; -5 on Spot and Listen checks, -2 on Will saves against sleep.',
 'Message':'Whispered conversation at distance.',
 'Prestidigitation':'Performs minor tricks.',
};
// Keep punctuation, numbers and signs meaningful: a changed bonus is a variant.
const normalized=(text:string)=>text.trim().replace(/\s+/g,' ').toLowerCase();
const emptyDefinition=(s:Spell)=>s.source==='Roll20 import'&&Object.keys(s.levels).length===0&&
 !s.attack&&s.catalogOrigin===undefined&&s.referenceOnly===undefined&&
 [s.school,s.components,s.castingTime,s.range,s.target,s.duration,s.save,s.resistance,s.description].every(v=>v==='');

export function matchRoll20AnnotatedSpell(custom:Spell,list:string,catalog:Spell[]){
 if(!emptyDefinition(custom))return;
 const entry=Object.entries(summaries).find(([name,summary])=>normalized(custom.name)===normalized(name+': '+summary));
 if(!entry)return;
 const matches=catalog.filter(s=>s.name===entry[0]&&s.levels[list]===Number(custom.levelText));
 return matches.length===1?matches[0]:undefined;
}
export const roll20SpellNameNote=(name:string)=>'Original Roll20 spell name: '+name;

/** Only relink an unchanged empty imported definition; never replay the export. */
export async function repairRoll20SpellNames(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.spellNamesMigration===1)return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Imported spell names could not be checked against the original export. Current spells and resources were kept.');return c;}
 const next=structuredClone(c);let recovered=0,review=false;
 for(const old of source.casters){
  const annotated=old.spells.filter(s=>s.roll20OriginalName);
  if(!annotated.length)continue;
  const candidates=next.casters.filter(p=>p.list===old.list&&p.mode===old.mode&&
   p.casting?.domain===old.casting?.domain&&
   (old.casting?.classId?p.casting?.classId===old.casting.classId:p.name===old.name));
  if(candidates.length!==1){review=true;continue;}
  const p=candidates[0];
  for(const original of annotated){
   const name=original.roll20OriginalName!;
   // Duplicate source rows and existing catalog copies require manual review.
   if(old.spells.filter(s=>s.spellId===original.spellId).length!==1||p.spells.some(s=>!s.custom&&s.spellId===original.spellId)){review=true;continue;}
   const targets=p.spells.filter(s=>s.custom?.name===name&&s.level===original.level);
   if(targets.length!==1){review=true;continue;}
   const target=targets[0],custom=target.custom!;
   if(!emptyDefinition(custom)||!custom.id.startsWith('roll20-')||target.spellId!==custom.id||custom.levelText!==String(original.level)){review=true;continue;}
   const note=roll20SpellNameNote(name),notes=target.notes.includes(note)?target.notes:[target.notes,note].filter(Boolean).join('\n\n');
   if(notes.length>2000){review=true;continue;}
   target.spellId=original.spellId;target.custom=null;target.roll20OriginalName=name;target.notes=notes;recovered++;
  }
 }
 if(recovered){
  if(!characterSchema.safeParse(next).success||new TextEncoder().encode(JSON.stringify({data:next})).length>980000){warn('Recovered spell names would exceed the save limits. Current spells were kept; review their library matches manually.');return c;}
  c.casters=next.casters;
  warn(`Linked ${recovered} imported spell names to their full library descriptions. Original names, current preparations, spent uses and later notes were kept.`);
 }
 imported.spellNamesMigration=1;
 if(review)warn('Some annotated spell names were edited, removed, duplicated or ambiguous. Current spells were kept; review their library matches manually.');
 return c;
}
