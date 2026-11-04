/** Shared normalization for saved feat names and their weapon/skill choices. */
export const featName=(name:string)=>name.toLowerCase().replace(/\s*\[[^\]]*\]/g,'').replace(/\s*\(.*/, '').replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
export const featChoice=(name:string)=>name.replace(/\s*\[[^\]]*\]/g,'').match(/\((.*)\)\s*$/)?.[1]?.trim()||'';
export const featChoiceKey=(choice:string)=>choice.toLowerCase().trim().split(/,\s*/).reverse().join(' ').replace(/[–—-]/g,' ').replace(/\s*([()])\s*/g,'$1').replace(/\s+/g,' ').trim();
export type FeatIdentity={name:string;choice?:string};
type FeatRecord=FeatIdentity&{id?:string;ruleId?:string;grantedFeat?:FeatIdentity};
export const isGrantedFeat=(f:{ruleId?:string})=>!!f.ruleId?.match(/^(granted|acf-grant):/);
export const effectiveFeatIdentity=(f:FeatRecord):FeatIdentity=>isGrantedFeat(f)&&f.grantedFeat?f.grantedFeat:f;
export function sameFeat(a:FeatIdentity,b:FeatIdentity){return featName(a.name)===featName(b.name)&&featChoiceKey(a.choice?.trim()||featChoice(a.name))===featChoiceKey(b.choice?.trim()||featChoice(b.name));}
export function retainedResourceIdentity(f:FeatRecord){
 // One slot can have several historical feat choices or legacy duplicate cards.
 // Preserve each card by ID; restoration also checks the saved feat identity.
 return isGrantedFeat(f)?'feat:'+f.id:f.ruleId;
}
