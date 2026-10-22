import type {Character} from './model.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

type Reader={n:(...names:string[])=>number|undefined};
export function roll20SkillModifiers(r:Reader,prefixes:string[]){
 let value=0,legacy=0;
 for(const suffix of ['miscmod','tempmod','actionmod']){
  const names=prefixes.map(prefix=>prefix+suffix);
  value+=r.n(...names)??0;
  legacy+=names.reduce((sum,name)=>sum+(r.n(name)??0),0);
 }
 return {value,legacy};
}

/** Correct alias addition only where the original misc component still matches. */
export async function repairRoll20SkillAliases(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.skillAliasesMigration===1||c.sheetKind==='monster')return c;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 const parsed=roll20ExportSchema.safeParse(imported.raw);
 if(!parsed.success||parsed.data.version!==1){warn('Imported skill aliases could not be checked. Current ranks and modifiers were kept.');return c;}
 let conflict=false;
 const reader=attributeReader(parsed.data,()=>{conflict=true;});
 const modifiers=roll20SkillModifiers({n:reader.number},['movesilently','movesilent']);
 const total=reader.number('movesilently','movesilent');
 // Repeating custom rows override fixed misc components; numeric totals already
 // reconcile the alias sum. Neither case needs this correction.
 const repeated=Object.values(parseRepeating(parsed.data.attributes).skills?.rows||{}).some(row=>{
  const first=Object.values(row.fields)[0][0],prefix=first.originalName.slice(0,-first.name.length);
  return (reader.text(prefix+'otherskillname',prefix+'name')||'').toLowerCase().replace(/[^a-z0-9]/g,'')==='movesilently';
 });
 if(modifiers.value===modifiers.legacy||total!==undefined||repeated){imported.skillAliasesMigration=1;return c;}
 const matches=c.skills.filter(s=>s.name==='Move Silently'&&s.ability==='DEX');
 if(!conflict&&matches.length===1&&matches[0].misc===modifiers.legacy&&(!matches[0].roll20Bonus||matches[0].roll20Bonus!.sourceMisc===modifiers.legacy)){
  const skill=matches[0];skill.misc=modifiers.value;
  if(skill.roll20Bonus)skill.roll20Bonus.sourceMisc=modifiers.value;
  warn('Corrected duplicated Move Silently modifier aliases from the original import. Current ranks, advancement and imported-bonus review choices were kept.');
 }else if(matches.length!==1||matches[0].misc!==modifiers.value){
  warn('The original Move Silently fields may have been counted twice, but current skill values were edited or ambiguous. Current ranks and modifiers were kept; review Skills and the original export.');
 }
 imported.skillAliasesMigration=1;
 return c;
}
