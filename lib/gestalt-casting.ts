import type {Character,ClassLevel} from './model.ts';
import {findClass} from './classes.ts';
import {advanceTargets,advancementCandidates,selectedAdvancementTarget,castingDefinition,manifestDefinition} from './advancement.ts';
import {characterGestaltRows} from './gestalt-progression.ts';
import {gestaltCastingTargetSchema,type GestaltCastingTarget} from './gestalt-schema.ts';

/** Only choices that actually grant progression at this class level. */
function advancingKinds(c:Character,entry:ClassLevel):GestaltCastingTarget['kind'][] {
 const now=advanceTargets(c,entry),before=advanceTargets(c,{...entry,level:entry.level-1});
 const kinds:GestaltCastingTarget['kind'][]=[];
 if(now.spell&&now.spellLevels>before.spellLevels)kinds.push('spell');
 if(now.divine&&(entry.classId==='hierophant'||now.spellLevels>before.spellLevels))kinds.push('divine');
 if(now.psi&&now.psiLevels>before.psiLevels)kinds.push('psi');
 return kinds;
}

/** Prestige advances a tradition held before entry, not one gained on/after entry. */
export function gestaltCastingChoices(c:Character,classIds:readonly string[]){
 return [...new Set(classIds)].flatMap(classId=>{
  const def=findClass(classId);if(!def)return [];
  const old=c.classLevels.find(e=>e.classId===classId);
  const entry:ClassLevel=old?{...old,level:old.level+1}:{id:'pending-'+classId,classId,name:def.name,level:1,notes:''};
  const first=old?c.gestaltProgression?.levels.findIndex(row=>row.left===old.id||row.right===old.id)??-1:-1;
  const priorEntries=first>=0?new Set(c.gestaltProgression!.levels.slice(0,first).flatMap(row=>[row.left,row.right])):null;
  const priorClasses=new Set(c.classLevels.filter(e=>!priorEntries||priorEntries.has(e.id)).map(e=>e.classId));
  const advance=advanceTargets(c,entry);
  return advancingKinds(c,entry).map(kind=>{
   const candidates=advancementCandidates(c,entry,kind).filter(p=>{
    const definition=kind==='psi'?manifestDefinition(c.psionics.find(q=>q.id===p.id)!):castingDefinition(c.casters.find(q=>q.id===p.id)!);
    return !!definition&&priorClasses.has(definition.id);
   });
   const previous=c.gestaltProgression?.levels.flatMap(row=>row.castingTargets??[]).findLast(t=>t.classId===classId&&t.kind===kind)?.traditionId;
   const preferred=previous??(kind==='spell'?entry.castingTarget:kind==='divine'?entry.divineTarget:entry.psionicTarget);
   const selected=preferred?(preferred==='none'||candidates.some(p=>p.id===preferred)?preferred:''):candidates.length===1?candidates[0].id:'';
   const label=kind==='psi'?'manifesting tradition':kind==='divine'?(classId==='hierophant'?'divine caster level only':'divine tradition'):advance.arcane?'arcane tradition':'spell tradition';
   return {classId,kind,label:def.name+': advance '+label,candidates,selected};
  });
 });
}

export function resolveGestaltCastingTargets(c:Character,classIds:readonly string[],requested:GestaltCastingTarget[]=[]){
 const choices=gestaltCastingChoices(c,classIds),targets=gestaltCastingTargetSchema.array().max(6).parse(requested);
 if(new Set(targets.map(t=>t.classId+':'+t.kind)).size!==targets.length)throw new Error('Choose each prestige casting target once.');
 for(const target of targets)if(!choices.some(choice=>choice.classId===target.classId&&choice.kind===target.kind))throw new Error('This casting choice is not granted by either class at the new level.');
 return choices.map(choice=>{
  const traditionId=targets.find(t=>t.classId===choice.classId&&t.kind===choice.kind)?.traditionId??choice.selected;
  if(!traditionId)throw new Error('Choose '+choice.label+' before reviewing this level.');
  if(traditionId!=='none'&&!choice.candidates.some(p=>p.id===traditionId))throw new Error('Choose an eligible existing tradition for '+choice.label+'.');
  return {classId:choice.classId,kind:choice.kind,traditionId};
 });
}

/** Capture old automatic/class-wide results before new profiles can change ambiguity.
 * Called only on the pending edit clone, never during ordinary load/recomputation.
 */
export function retainGestaltCastingHistory(source:Character,pending:Character){
 const rows=characterGestaltRows(source);if(!rows)return;
 rows.forEach((row,index)=>{
  const pair=pending.gestaltProgression!.levels[index],targets=[...(pair.castingTargets??[])];
  for(const side of [row.left,row.right]){
   const entry=source.classLevels.find(e=>e.id===side.entryId)!;
   for(const kind of advancingKinds(source,{...entry,level:side.classLevel}))if(!targets.some(t=>t.classId===entry.classId&&t.kind===kind))targets.push({classId:entry.classId,kind,traditionId:selectedAdvancementTarget(source,entry,kind,row)||'none'});
  }
  if(targets.length)pair.castingTargets=targets;
 });
}
