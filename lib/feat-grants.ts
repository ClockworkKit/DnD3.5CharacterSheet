import type {Character} from './model.ts';
import {effectiveFeatIdentity,sameFeat} from './feat-identity.ts';
import {refreshResourceText,retireResources,restoreResource} from './managed-resources.ts';

export type FeatGrant={ruleId:string;name:string;choice?:string;description:string;source:string;repeatable?:boolean};

/** Synchronize existing class grants without replacing personal cards or
 * transferring an old choice's identity/notes to a different feat. */
export function syncFeatGrants(c:Character,grants:FeatGrant[],prefix:'granted:'|'acf-grant:'){
 if(prefix==='granted:'){
  // Preserve the existing source when several classes grant the same fixed feat.
  const ordered=[...grants].sort((a,b)=>Number(c.features.some(f=>f.ruleId===b.ruleId))-Number(c.features.some(f=>f.ruleId===a.ruleId)));
  grants=ordered.filter((g,i)=>g.repeatable||!ordered.slice(0,i).some(other=>sameFeat(g,other)));
 }
 const byKey=new Map(grants.map(g=>[g.ruleId,g]));
 if(byKey.size!==grants.length)throw new Error('A class feat grant slot must be unique.');
 const suppressed=(g:FeatGrant)=>!g.repeatable&&c.features.some(f=>!f.ruleId?.startsWith(prefix)
  &&!f.ruleId?.startsWith('acf-grant:')&&f.kind==='Feat'&&sameFeat(effectiveFeatIdentity(f),g));
 const remove=new Set<string>();
 for(const f of c.features.filter(f=>f.ruleId?.startsWith(prefix))){
  const g=byKey.get(f.ruleId!);
  // Catalog keys identify fixed grants. Variable legacy slots can only adopt
  // a known matching choice; ambiguous old text remains retained for review.
  if(!f.grantedFeat){const identity=g&&(prefix==='granted:'||sameFeat(f,g))?g:f;f.grantedFeat={name:identity.name,choice:identity.choice||''};}
  if(!g||!sameFeat(f.grantedFeat,g)||suppressed(g))remove.add(f.id);
 }
 retireResources(c,f=>remove.has(f.id));
 for(const g of grants){
  if(suppressed(g))continue;
  let f=c.features.find(f=>f.ruleId===g.ruleId);
  if(!f)f=restoreResource(c,g.ruleId,g);
  if(!f){if(c.features.length>=250)continue;f={id:crypto.randomUUID(),ruleId:g.ruleId,name:g.name,kind:'Feat',choice:g.choice||'',description:g.description,source:g.source,max:0,used:0};c.features.push(f);}
  f.grantedFeat={name:g.name,choice:g.choice||''};
  refreshResourceText(f,{name:g.name,description:g.description,source:g.source});
 }
}
