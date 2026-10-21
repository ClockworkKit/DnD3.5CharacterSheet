import {characterSchema,type Character} from './model.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

type PowerReader={t:(...names:string[])=>string|undefined,b:(...names:string[])=>boolean|undefined};
export function roll20PowerNotes(r:PowerReader,suffix:string){
 const original=r.t('notes','description')||'';
 const fields:[string,string|undefined][]=[
  ['Discipline',r.t('powerschool'+suffix,'powerschool','school')],
  ['Descriptor',r.t('powerdescriptor'+suffix,'powerdescriptor','descriptor')],
  ['Display',r.t('powerdisplay'+suffix,'powerdisplay','display')],
  ['Manifesting time',r.t('powercastingtime'+suffix,'powercastingtime','castingtime')],
  // The upstream input name is powerrange1 at every level, despite its title.
  ['Range',r.t('powerrange'+suffix,'powerrange1','powerrange','range')],
  ['Target / area',r.t('powertea'+suffix,'powertea','target')],
  ['Duration',r.t('powerduration'+suffix,'powerduration','duration')],
  ['Saving throw',r.t('powerst'+suffix,'powerst','save')],
  ['Power resistance',r.t('powerpr'+suffix,'powerpr','resistance')],
 ];
 const augment=r.b('poweraugment'+suffix,'poweraugment','augment');
 if(augment!==undefined)fields.push(['Augmentable (source checkbox)',augment?'Yes':'No']);
 const details=fields.filter(([,value])=>value).map(([label,value])=>label+': '+value).join('\n');
 const full=[original,details?'Imported Roll20 power details:\n'+details:''].filter(Boolean).join('\n\n');
 return {original,details,notes:full.slice(0,10000),truncated:full.length>10000};
}

/** Restore omitted text only; never replay source point use or replace edited powers. */
export async function repairRoll20PowerDetails(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.powerDetailsMigration===1)return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 const parsed=roll20ExportSchema.safeParse(imported.raw);
 if(!parsed.success||parsed.data.version!==1){warn('Imported power details could not be checked against the original export. Current powers and resources were kept.');return c;}
 let source:Character;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}
 catch{warn('Imported power details could not be reconstructed. Current powers and resources were kept; review the original export.');return c;}
 const reader=attributeReader(parsed.data,()=>{}),rows=[];
 for(const [section,group] of Object.entries(parseRepeating(parsed.data.attributes))){
  if(!/^spells\d+3$/.test(section)&&section!=='powers')continue;
  const suffix=section.replace(/^spells/,'');
  for(const row of Object.values(group.rows)){
   const first=Object.values(row.fields)[0][0],prefix=first.originalName.slice(0,-first.name.length);
   const r={t:(...names:string[])=>reader.text(...names.map(n=>prefix+n)),b:(...names:string[])=>reader.boolean(...names.map(n=>prefix+n))};
   const name=r.t('powername'+suffix,'powername','name'),level=reader.number(prefix+'level',prefix+'powerlevel')??Number(suffix.slice(0,-1));
   if(name)rows.push({name,level,...roll20PowerNotes(r,suffix)});
  }
 }
 let recovered=0,review=false;
 const next=structuredClone(c);
 for(const old of source.psionics){
  const candidates=next.psionics.filter(p=>old.manifesting?.classId&&p.manifesting?.classId===old.manifesting.classId);
  for(const power of old.powers){
   const matches=rows.filter(row=>row.name===power.name&&row.level===power.level);
   if(!matches.some(row=>row.details))continue;
   if(matches.length!==1||candidates.length!==1){review=true;continue;}
   const row=matches[0],same=(p:typeof power)=>p.name===power.name&&p.level===power.level&&p.powerId===power.powerId;
   const targets=candidates[0].powers.filter(same);
   if(old.powers.filter(same).length!==1||targets.length!==1){review=true;continue;}
   const target=targets[0];
   if(target.notes===row.notes)continue;
   if(target.notes!==row.original){review=true;continue;}
   target.notes=row.notes;recovered++;if(row.truncated)review=true;
  }
 }
 if(recovered){
  if(!characterSchema.safeParse(next).success||new TextEncoder().encode(JSON.stringify({data:next})).length>980000){warn('Recovered power details would exceed the save limits. Current powers were kept; read the full details in the original export.');return c;}
  c.psionics=next.psionics;
  warn(`Recovered recorded details for ${recovered} imported powers in Magic. Current costs, effect rolls, levels, focus and spent points were kept.`);
 }
 imported.powerDetailsMigration=1;
 if(review)warn('Some imported power details were edited, removed, ambiguous or too long for the notes field. Current choices were kept; review the original export for the full details.');
 return c;
}
