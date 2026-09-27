import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import {alternateFeatureCatalog,alternateFeaturesSchema,type AlternateFeatureId} from './alternate-feature-schema.ts';
export {alternateFeatureCatalog};
export const alternateClassLevel=(c:Character,id:string)=>c.classLevels.filter(e=>e.classId===id).reduce((n,e)=>n+e.level,0);
export function activeAlternateFeatures(c:Character){return alternateFeatureCatalog.filter(d=>c.alternateFeatures.selected.includes(d.id)&&alternateClassLevel(c,d.classId)>=d.level);}
export function hasAlternateFeature(c:Character,id:AlternateFeatureId){return activeAlternateFeatures(c).some(d=>d.id===id);}
export function featureReplaced(c:Character,classId:string,feature:string){return activeAlternateFeatures(c).some(d=>d.classId===classId&&d.replaces.includes(feature));}
export function alternateFeatureProblem(c:Character,id:AlternateFeatureId){
 const d=alternateFeatureCatalog.find(d=>d.id===id);if(!d)return 'Unknown alternate class feature.';
 if(c.sheetKind==='monster')return 'Use class-based character sheets for alternate class features.';
 if(alternateClassLevel(c,d.classId)<d.level)return 'Requires '+d.classId+' level '+d.level+'.';
 if(d.skill&&(c.skills.find(s=>s.name===d.skill!.name)?.ranks||0)<d.skill.ranks)return 'Requires '+d.skill.name+' '+d.skill.ranks+' rank.';
 const conflict=alternateFeatureCatalog.find(other=>other.id!==id&&c.alternateFeatures.selected.includes(other.id)&&other.classId===d.classId&&other.replaces.some(k=>d.replaces.includes(k)));
 return conflict?'Conflicts with '+conflict.name+': both replace '+d.replacementLabels.join(', ')+'.':'';
}
export function selectAlternateFeature(c:Character,id:AlternateFeatureId,selected:boolean){
 if(selected){const problem=alternateFeatureProblem(c,id);if(problem)throw new Error(problem);}
 c.alternateFeatures=alternateFeaturesSchema.parse({...c.alternateFeatures,selected:selected?[...new Set([...c.alternateFeatures.selected,id])]:c.alternateFeatures.selected.filter(x=>x!==id)});
}
export function turningClassLevel(c:Character){return (featureReplaced(c,'cleric','turn-undead')?0:alternateClassLevel(c,'cleric'))+(featureReplaced(c,'paladin','turn-undead')?0:Math.max(0,alternateClassLevel(c,'paladin')-3));}
export function hasTurningAbility(c:Character){
 if(turningClassLevel(c)>0||alternateClassLevel(c,'blackguard')>=3||alternateClassLevel(c,'dread-necromancer')>0||alternateClassLevel(c,'death-master')>0)return true;
 // A stale generated turning card must not re-grant a surrendered class feature.
 return c.features.some(f=>/^(turn|rebuke)\b/i.test(f.name)&&!f.ruleId?.startsWith('daily:')&&(!featureReplaced(c,'cleric','turn-undead')&&!featureReplaced(c,'paladin','turn-undead')||f.kind==='Racial trait'||f.kind==='Other'));
}
const replacedNames:Record<string,RegExp>={'special-mount':/^special mount$/i,'detect-evil':/^detect evil$/i,'turn-undead':/^(turn|rebuke|turn or rebuke) undead$/i,'remove-disease':/^remove disease\b/i};
export function effectiveClassMilestone(c:Character,classId:string,text:string){const replaced=activeAlternateFeatures(c).filter(d=>d.classId===classId).flatMap(d=>d.replaces);return text.split(/,\s*/).filter(part=>!replaced.some(key=>replacedNames[key]?.test(part.trim()))).join(', ')||'—';}
export function alternateFeatureWarnings(c:Character){return c.alternateFeatures.selected.flatMap(id=>{const d=alternateFeatureCatalog.find(d=>d.id===id)!;return alternateClassLevel(c,d.classId)<d.level?[d.name+' is inactive until '+d.classId+' level '+d.level+'.']:[];});}
export type AlternateResource={key:string,name:string,max:number,period:'day'|'week',description:string,check?:number};
export function alternateResources(c:Character):AlternateResource[]{
 const resources:AlternateResource[]=[],pal=alternateClassLevel(c,'paladin'),cha=Math.floor((effectiveScore(c,'CHA')-10)/2);
 const add=(key:string,name:string,max:number,description:string,period:'day'|'week'='day',check?:number)=>resources.push({key,name,max:Math.max(0,max),description,period,...(check===undefined?{}:{check})});
 if(hasAlternateFeature(c,'paladin-divine-counterspell')||hasAlternateFeature(c,'cleric-divine-counterspell')){const check=(alternateClassLevel(c,'cleric')||Math.max(0,pal-3))+((c.skills.find(s=>s.name==='Knowledge (arcana)')?.ranks||0)>=5?2:0);add('daily:counterspell','Divine Counterspell',1+cha,'Counterspell check: d20 + '+check+'. Resolve against the opposing spell; no identification roll is required.','day',check);}
 if(hasAlternateFeature(c,'paladin-divine-spirit')){
  add('daily:spirit-healing','Spirit of healing',1,'Healing capacity '+2*pal*Math.max(0,cha)+' HP; up to '+pal+' rounds. A creature sharing its square spends a standard action to receive healing. Track healing on the affected sheets.');
  if(pal>=11)add('daily:spirit-combat','Spirit of combat',1,'Adjacent allies gain +'+Math.min(5,Math.floor(pal/4))+' sacred attack/damage and good-aligned weapons for DR. Up to '+pal+' rounds; apply only while in range.');
  if(pal>=16)add('daily:spirit-heroism','Spirit of heroism',1,'Occupies your space: DR 10/—, Diehard, and lay on hands as a free action once per round. Up to '+pal+' rounds. Apply these benefits while the spirit lasts.');
  if(pal>=20)add('daily:spirit-fallen','Spirit of the fallen',1,'Adjacent allies gain fast healing 10. Revival within 30 ft. heals '+2*pal+' HP at the start of the target’s next turn, at most once per round; source restrictions apply. Up to '+pal+' rounds.');
 }
 if(hasAlternateFeature(c,'paladin-curse-breaker'))add('weekly:curse-breaker','Curse Breaker',1+Math.floor((pal-6)/3),'Remove curse costs one use.'+(pal>=12?' Break enchantment costs two uses.':''),'week');
 return resources;
}
export function spendAlternateResource(c:Character,key:string,cost=1){const r=alternateResources(c).find(r=>r.key===key);if(!r||!Number.isInteger(cost)||cost<1||cost>1&&!(key==='weekly:curse-breaker'&&cost===2&&alternateClassLevel(c,'paladin')>=12))throw new Error('This ability is not available.');const used=c.alternateFeatures.uses[key]||0;if(used+cost>r.max)throw new Error('No uses remain for this ability.');c.alternateFeatures.uses[key]=used+cost;}
export function rememberTurningUses(c:Character){if(!c.alternateFeatures.selected.length&&!Object.keys(c.alternateFeatures.uses).length)return;const f=c.features.find(f=>f.ruleId==='daily:Turn or rebuke undead'||f.name==='Turn or rebuke undead');if(f){c.alternateFeatures.uses['daily:original-turning']=f.used;f.ruleId='daily:Turn or rebuke undead';}}
export function syncAlternateFeatureCards(c:Character){
 const active=activeAlternateFeatures(c),ids=new Set(active.map(d=>'acf:'+d.id));
 c.features=c.features.filter(f=>!f.ruleId?.startsWith('acf:')||ids.has(f.ruleId));
 for(const d of active){const ruleId='acf:'+d.id;let f=c.features.find(f=>f.ruleId===ruleId);if(!f){if(c.features.length>=250)continue;f={id:crypto.randomUUID(),name:d.name,kind:'Class feature',description:'',source:d.source,max:0,used:0,ruleId,magic:false};c.features.push(f);}f.description=d.description+'\nReplaces '+d.replacementLabels.join(', ')+'. Manage tracked uses in Classes → Alternate class features.';f.source=d.source;}
 if(!c.automation.enabled&&turningClassLevel(c)&&'daily:original-turning' in c.alternateFeatures.uses&&!c.features.some(f=>f.ruleId==='daily:Turn or rebuke undead')){c.features.push({id:crypto.randomUUID(),name:'Turn or rebuke undead',kind:'Class feature',description:'Effective turning level '+turningClassLevel(c)+'.',max:Math.max(0,3+Math.floor((effectiveScore(c,'CHA')-10)/2)+4*c.features.filter(f=>f.kind==='Feat'&&f.name==='Extra Turning').length),used:c.alternateFeatures.uses['daily:original-turning'],source:'https://srd.dndtools.org/srd/classes/classes.html',ruleId:'daily:Turn or rebuke undead'});}
 // Only this app's generated resource is removed. User-written references remain untouched.
 if(!turningClassLevel(c)&&(featureReplaced(c,'cleric','turn-undead')||featureReplaced(c,'paladin','turn-undead')))c.features=c.features.filter(f=>f.ruleId!=='daily:Turn or rebuke undead');
}
