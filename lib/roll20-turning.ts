import type {Character} from './model.ts';
import {attributeReader} from './roll20-attributes.ts';
import {roll20ExportSchema,type Roll20Export} from './roll20-schema.ts';
import {turningClassLevel} from './alternate-features.ts';
import {axeBrotherImportEvidence} from './roll20-cleric-review.ts';
import {turningName} from './turn-undead.ts';

export function originalTurningUses(raw:unknown){
 const result=roll20ExportSchema.safeParse(raw);
 if(!result.success)return null;
 let conflict=false;
 const reader=attributeReader(result.data,()=>{conflict=true;});
 const remaining=reader.number('turningperday');
 const inlineMax=reader.max('turningperday'),separateMax=reader.number('turningperday_max');
 if(inlineMax!==undefined&&separateMax!==undefined&&inlineMax!==separateMax)return null;
 const max=inlineMax??separateMax;
 if(conflict||remaining===undefined||max===undefined||!Number.isInteger(remaining)||!Number.isInteger(max)||remaining<0||max<remaining||max>10000)return null;
 return {remaining,max,used:max-remaining};
}

// Only a fresh export can supply today's expenditure automatically.
export function importTurningUses(c:Character,raw:Roll20Export){
 const imported=c.roll20Import;
 if(!imported)return;
 if(!raw.attributes.some(a=>a.name.trim().toLowerCase()==='turningperday'))return;
 const source=originalTurningUses(raw);
 if(!source){imported.report.warnings.push('Review the original turning attempts. A consistent remaining count and maximum were unavailable.');return;}
 if(!source.max)return;
 const ordinary=turningClassLevel(c)>0||(!c.classLevels.length&&axeBrotherImportEvidence(c));
 if(!ordinary||c.classLevels.some(e=>['blackguard','death-master','dread-necromancer'].includes(e.classId))||
    c.features.some(f=>f.name.toLowerCase()===turningName.toLowerCase())||c.features.length>=250){
  imported.report.warnings.push('Review the original turning attempts before use. The export does not identify one available cleric or paladin counter.');
  return;
 }
 c.features.push({id:crypto.randomUUID(),kind:'Class feature',name:turningName,description:'Daily turning attempts from Roll20.',source:'Roll20 import',max:source.max,used:source.used});
 const fields=new Set(['turningperday','turningperday_max']);
 const unmapped=imported.report.unmapped.filter(name=>!fields.has(name.trim().toLowerCase()));
 imported.report.mapped+=imported.report.unmapped.length-unmapped.length;
 imported.report.unmapped=unmapped;
}
