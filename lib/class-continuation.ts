import type {Character} from './model.ts';
import type {ClassDefinition} from './classes.ts';
import type {Eligibility,Requirement} from './prerequisites.ts';
import {hitDieSequence} from './level-history.ts';

const restricted=new Set(['monk','paladin']);
export const classOrderKeys=(c:Character)=>hitDieSequence(c).filter(r=>r.classId!=='racial').map(r=>r.key);

/** The old levelOrder is also generated during import; it is not provenance. */
export function recordedStandardClassOrder(c:Character){
 const rows=hitDieSequence(c).filter(r=>r.classId!=='racial');
 const verified=c.classAdvancementOrder;
 const exact=!!verified&&verified.length===rows.length&&verified.every((key,i)=>key===rows[i].key);
 // A sheet containing only one class has no inter-class ordering ambiguity.
 const single=new Set(rows.map(r=>r.classId)).size<=1;
 return exact||single?rows.map(r=>[r.classId]):null;
}

// Compact change detector for review keys; not a security or authorization token.
function fingerprint(value:unknown){
 const text=JSON.stringify(value);let a=2166136261,b=5381;
 for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
 return text.length+':'+(a>>>0).toString(16)+':'+(b>>>0).toString(16);
}
type Context={raceId:string;confirmations:Character['prerequisiteConfirmations'];scope:unknown;reviewGestalt?:boolean};
export function continuationRequirements(classId:string,name:string,nextLevel:number,history:readonly (readonly string[])[]|null,context:Context):Requirement[]{
 if(!restricted.has(classId)||nextLevel<=1)return [];
 if(context.raceId==='illumian')return [{label:'Illumian: may leave and return to Monk and Paladin (Races of Destiny, p. 55).',state:'met'}];
 const first=history?.findIndex(row=>row.includes(classId))??-1;
 // A paired level that includes the restricted class continues its progression.
 // This is a documented gestalt interpretation, not an explicit UA multiclass-return rule.
 const interruptions=history===null?null:history.slice(first+1).flatMap((row,index)=>
  row.includes(classId)?[]:row.filter(id=>!(classId==='monk'&&id==='psionic-fist')).map(id=>({level:first+index+2,classId:id})));
 if(interruptions?.length===0&&!context.reviewGestalt)return [];
 const unknown=interruptions===null;
 const label=context.reviewGestalt&&interruptions?.length===0
  ?'Verify the gestalt Monk/Paladin multiclass interaction before taking '+name+' '+nextLevel+'. This character uses per-level rules review rather than the uninterrupted-either-side interpretation.'
  :unknown
  ?'Verify '+name+' '+nextLevel+' continuation: this sheet has no verified class order. Confirm that no prohibited break occurred, or that a documented source exception or GM house rule permits this level.'
  :name+' cannot normally resume after '+[...new Set(interruptions.map(r=>r.classId))].join(', ')+'. Confirm a documented source exception or GM house rule permitting '+name+' '+nextLevel+'.';
 const key='class-continuation:'+JSON.stringify([classId,nextLevel,context.raceId,fingerprint(context.scope),interruptions===null?null:fingerprint(interruptions)]);
 return [{label,key,state:'confirm',confirmed:!!context.confirmations[key]}];
}

export function classContinuationEligibility(c:Character,definition:ClassDefinition):Eligibility{
 const level=c.classLevels.filter(e=>e.classId===definition.id).reduce((n,e)=>n+e.level,0);
 if(!restricted.has(definition.id)||level===0)return {eligible:true,requirements:[],status:'Eligible'};
 if(c.advancementMode!=='gestalt'&&definition.id==='monk'&&c.classLevels.some(e=>e.classId==='psionic-fist')&&c.classLevels.every(e=>e.classId==='monk'||e.classId==='psionic-fist'))return {eligible:true,requirements:[{label:'Monk and Psionic Fist may continue advancing together (Psionic Fist multiclass note).',state:'met'}],status:'Eligible'};
 let history:readonly (readonly string[])[]|null;
 if(c.advancementMode==='gestalt'){
  const entries=new Map(c.classLevels.map(e=>[e.id,e.classId]));
  history=c.gestaltProgression?.levels.map(pair=>[entries.get(pair.left)!,entries.get(pair.right)!])??null;
 }else history=recordedStandardClassOrder(c);
 const scope={mode:c.advancementMode,policy:c.gestaltContinuationRule??'continuous',classes:c.classLevels.map(e=>[e.classId,e.level]),history,
  // Changed source evidence invalidates an old exceptional-continuation confirmation.
  deity:c.deity,alternates:c.alternateFeatures.selected,
  feats:c.features.filter(f=>f.kind==='Feat').map(f=>[f.name,f.choice??'',f.source]),custom:c.customClasses??[]};
 const rows=continuationRequirements(definition.id,definition.name,level+1,history,{raceId:c.ancestry.raceId,confirmations:c.prerequisiteConfirmations,scope,reviewGestalt:c.advancementMode==='gestalt'&&c.gestaltContinuationRule==='review'});
 const eligible=rows.every(r=>r.state==='met'||r.state==='confirm'&&r.confirmed);
 return {eligible,requirements:rows,status:eligible?'Eligible':'Needs confirmation'};
}
