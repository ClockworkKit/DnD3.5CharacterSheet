import type {Character} from './model.ts';

/** Explicit source classifications, never substring matches against class names.
 * Complete Psionic calls Erudite a variant psion. The Mind's Eye designers call
 * Psychic Rogue a psionic version of the core rogue. See the implementation doc.
 * Alternate features on a catalog class already retain their parent class ID.
 */
export const gestaltVariantParents:Readonly<Record<string,string>>={erudite:'psion','psychic-rogue':'rogue'};
const family=(id:string)=>gestaltVariantParents[id]??id;
const labels:Readonly<Record<string,string>>={erudite:'Erudite',psion:'Psion','psychic-rogue':'Psychic Rogue',rogue:'Rogue'};

/** Identical IDs are rejected separately by the plan/compiler, including old plans. */
export function gestaltVariantPairProblem(left:string,right:string){
 return left!==right&&family(left)===family(right)
  ?`${labels[left]??left} and ${labels[right]??right} are versions of the same class; choose a different class for one side of this gestalt level.`:'';
}

/** Legacy plans stay readable, exportable and unchanged; violations remain visible. */
export function gestaltVariantWarnings(c:Character){
 if(c.advancementMode!=='gestalt'||!c.gestaltProgression)return [];
 const entries=new Map(c.classLevels.map(e=>[e.id,e.classId]));
 return c.gestaltProgression.levels.flatMap((pair,index)=>{
  const left=entries.get(pair.left),right=entries.get(pair.right);
  const problem=left&&right?gestaltVariantPairProblem(left,right):'';
  return problem?[{key:pair.id,level:index+1,message:problem}]:[];
 });
}
