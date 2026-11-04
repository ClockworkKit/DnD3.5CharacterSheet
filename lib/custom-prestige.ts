import type {Character} from './model.ts';
import type {CustomClass} from './custom-class-schema.ts';
import {classCastingAdvancesSchema,type ClassCastingAdvance} from './gestalt-schema.ts';
import {advancementCandidates} from './advancement.ts';
import {characterGestaltRows} from './gestalt-progression.ts';

/** Review explicit target choices for already earned custom prestige levels. */
export function customPrestigeChoices(c:Character,profile:CustomClass){
 const entries=c.classLevels.filter(e=>e.classId===profile.definition.id);
 if(!profile.definition.advances||!entries.length)return [];
 if(entries.length>1)throw new Error('Duplicate custom prestige entries require separate history review before configuring advancement.');
 const entry=entries[0],profiles=[...(c.customClasses??[]).filter(p=>p.definition.id!==profile.definition.id),profile];
 const proposed={...c,customClasses:profiles},pairs=characterGestaltRows(proposed);
 return profile.definition.levels.filter(row=>row.level<=entry.level).flatMap(row=>
  (['spell','divine','psi'] as const).filter(kind=>row.advances?.[kind]).map(kind=>{
   const pair=pairs?.find(p=>[p.left,p.right].some(side=>side.entryId===entry.id&&side.classLevel===row.level));
   const saved=pair?.castingTargets?.find(t=>t.classId===entry.classId&&t.kind===kind)
    ??(!pairs?entry.castingAdvances?.find(t=>t.level===row.level&&t.kind===kind):undefined);
   const before=saved?.traditionId??(kind==='spell'?entry.castingTarget:kind==='divine'?entry.divineTarget:entry.psionicTarget);
   const candidates=advancementCandidates(proposed,{...entry,level:row.level},kind);
   const selected=before?(before==='none'||candidates.some(p=>p.id===before)?before:''):candidates.length===1?candidates[0].id:'';
   return {level:row.level,kind,candidates,selected,before,label:'Class level '+row.level+': '+(kind==='psi'?'manifesting':kind==='divine'?'divine spellcasting':profile.definition.advances?.spell==='arcane'?'arcane spellcasting':'spellcasting')};
  }));
}

export function applyCustomPrestigeChoices(source:Character,pending:Character,profile:CustomClass,requested:ClassCastingAdvance[]=[]){
 const choices=customPrestigeChoices(source,profile),targets=classCastingAdvancesSchema.parse(requested);
 for(const target of targets)if(!choices.some(choice=>choice.level===target.level&&choice.kind===target.kind))throw new Error('This reviewed prestige target is not granted at that earned class level.');
 const entry=pending.classLevels.find(e=>e.classId===profile.definition.id),pairs=characterGestaltRows(pending);
 return choices.map(choice=>{
  const traditionId=targets.find(t=>t.level===choice.level&&t.kind===choice.kind)?.traditionId??choice.selected;
  if(!traditionId)throw new Error('Choose '+choice.label+' before reviewing the table.');
  if(traditionId!=='none'&&!choice.candidates.some(p=>p.id===traditionId))throw new Error('Choose an eligible pre-entry tradition for '+choice.label+'.');
  if(pairs){
   const i=pairs.findIndex(row=>[row.left,row.right].some(side=>side.entryId===entry!.id&&side.classLevel===choice.level));
   if(i<0)throw new Error('The earned prestige level has no saved pair.');
   const row=pending.gestaltProgression!.levels[i];
   row.castingTargets=[...(row.castingTargets??[]).filter(t=>t.classId!==entry!.classId||t.kind!==choice.kind),{classId:entry!.classId,kind:choice.kind,traditionId}];
  }else entry!.castingAdvances=[...(entry!.castingAdvances??[]).filter(t=>t.level!==choice.level||t.kind!==choice.kind),{level:choice.level,kind:choice.kind,traditionId}];
  const before=choice.before==='none'?'No advancement':source.casters.find(p=>p.id===choice.before)?.name??source.psionics.find(p=>p.id===choice.before)?.name??choice.before??'Previously automatic / unconfigured';
  return {level:choice.level,kind:choice.kind,before,after:traditionId==='none'?'No advancement':choice.candidates.find(p=>p.id===traditionId)!.name,traditionId};
 });
}

export function customPrestigeWarnings(c:Character){
 return (c.customClasses??[]).flatMap(p=>{
  try{return customPrestigeChoices(c,p).filter(choice=>!choice.selected).map(choice=>p.definition.name+', '+choice.label+': review the saved prestige target; no eligible tradition is selected.');}
  catch(error){return [error instanceof Error?error.message:'Review custom prestige history.'];}
 });
}
