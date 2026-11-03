import type {Character} from './model.ts';
import {isGrantedFeat,effectiveFeatIdentity,sameFeat,retainedResourceIdentity,type FeatIdentity} from './feat-identity.ts';

type Feature=Character['features'][number];
type Generated=NonNullable<Feature['generatedSummary']>;

/** Update only a known generated block; free-form player text is never guessed. */
export function refreshResourceText(f:Feature,current:Generated){
 const previous=f.generatedSummary;
 if(previous?.description&&f.description!==current.description){
  const at=f.description.indexOf(previous.description);
  if(at>=0&&f.description.indexOf(previous.description,at+1)<0){
   const updated=f.description.slice(0,at)+current.description+f.description.slice(at+previous.description.length);
   if(updated.length<=20000)f.description=updated;
  }
 }
 // This records current guidance separately even when a legacy/custom block
 // cannot be safely replaced. It is not a claim about the old text's origin.
 f.generatedSummary={...current};
}

export function resourceGuidance(f:Feature){
 if(!f.ruleId?.startsWith('daily:')&&!f.ruleId?.startsWith('supp:')&&!isGrantedFeat(f))return undefined;
 const current=f.generatedSummary;
 return current&&!f.description.includes(current.description)?current:undefined;
}

/** Keep replaced resources out of active calculations, with their full records intact. */
export function retireResources(c:Character,remove:(f:Feature)=>boolean){
 const removed=c.features.filter(remove);
 if(!removed.length)return;
 const retired=[...(c.retiredResources??[])];
 for(const f of removed){
  if(retired.some(old=>old.id===f.id||retainedResourceIdentity(old)===retainedResourceIdentity(f)))throw new Error('A retained resource already has this identity. Review it before replacing the active card.');
  retired.push(structuredClone(f));
 }
 if(retired.length>250)throw new Error('Too many retained resource cards. Export and review them before replacing more resources.');
 c.retiredResources=retired;
 for(const f of removed)c.alternateFeatures.uses[isGrantedFeat(f)?'retained-feat:'+f.id:'retained:'+f.ruleId]=f.used;
 const ids=new Set(removed.map(f=>f.id));c.features=c.features.filter(f=>!ids.has(f.id));
}

export function restoreResource(c:Character,ruleId:string,feat?:FeatIdentity){
 const f=c.retiredResources?.find(f=>f.ruleId===ruleId&&(!feat||sameFeat(effectiveFeatIdentity(f),feat)));
 if(!f)return undefined;
 if(c.features.length>=250)throw new Error('Make room in active features before restoring this retained resource.');
 f.used=c.alternateFeatures.uses[isGrantedFeat(f)?'retained-feat:'+f.id:'retained:'+ruleId]??f.used;
 c.features.push(f);
 c.retiredResources=c.retiredResources!.filter(row=>row.id!==f.id);
 if(!c.retiredResources.length)delete c.retiredResources;
 return f;
}
