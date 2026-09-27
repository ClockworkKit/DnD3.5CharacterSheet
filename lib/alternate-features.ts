import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import {alternateFeatureCatalog,alternateFeatureById,alternateFeaturesSchema,alternateSettingsSchema,replacementKeys,replacementOverlap,type AlternateFeatureId,type AlternateSettings,type AlternateFeatureDefinition} from './alternate-feature-schema.ts';
export {alternateFeatureCatalog};
export const alternateClassLevel=(c:Character,id:string)=>c.classLevels.filter(e=>e.classId===id).reduce((n,e)=>n+e.level,0);
export function alternateSettings(c:Character,id:string):AlternateSettings{return c.alternateFeatures.settings[id]||{choice:'',notes:'',reviewed:false,active:false,counters:[]};}
export function alternateReplacementLabels(c:Character,d:AlternateFeatureDefinition){if(d.id.includes('-skilled-city-dweller-')||!d.replaces.some(k=>k.includes('@')))return d.replacementLabels;return replacementKeys(d,alternateSettings(c,d.id)).map(key=>{const [name,slot]=key.split('@');return name.replaceAll('-',' ')+(slot?(name.startsWith('domain')?' '+slot:' at level '+slot):'');});}
export function alternateSelectionLevel(c:Character,d:AlternateFeatureDefinition){return d.levels?(alternateSettings(c,d.id).level??d.level):d.level;}
export function activeAlternateFeatures(c:Character){return c.alternateFeatures.selected.map(id=>alternateFeatureById.get(id)!).filter(d=>d&&alternateClassLevel(c,d.classId)>=alternateSelectionLevel(c,d));}
export function hasAlternateFeature(c:Character,id:AlternateFeatureId){return activeAlternateFeatures(c).some(d=>d.id===id);}
export function featureReplaced(c:Character,classId:string,feature:string,level?:number){return activeAlternateFeatures(c).some(d=>d.classId===classId&&replacementKeys(d,alternateSettings(c,d.id)).some(k=>{if(k.includes('@')&&level===undefined)return false;return replacementOverlap(k,feature+(level===undefined?'':'@'+level));}));}
export function classFeatureLevel(c:Character,classId:string,feature:string){return featureReplaced(c,classId,feature)?0:alternateClassLevel(c,classId);}
export function alternateFeatureProblem(c:Character,id:AlternateFeatureId){
 const d=alternateFeatureById.get(id);if(!d)return 'Unknown alternate class feature.';
 if(c.sheetKind==='monster')return 'Use class-based character sheets for alternate class features.';
 if(d.kind==='reference')return 'This source contains a collection of rules. Record individual options with their source restrictions.';
 const settings=alternateSettings(c,id),level=alternateSelectionLevel(c,d);
 if(alternateClassLevel(c,d.classId)<level)return 'Requires '+d.classId+' level '+level+'.';
 if(d.skill&&(c.skills.find(s=>s.name===d.skill!.name)?.ranks||0)<d.skill.ranks)return 'Requires '+d.skill.name+' '+d.skill.ranks+' rank.';
 if(d.levels&&!d.levels.includes(level))return 'Choose a valid replacement level.';
 const keys=replacementKeys(d,settings);
 const conflict=c.alternateFeatures.selected.map(x=>alternateFeatureById.get(x)!).find(other=>other&&other.id!==id&&other.classId===d.classId&&replacementKeys(other,alternateSettings(c,other.id)).some(k=>keys.some(key=>replacementOverlap(k,key))));
 if(conflict)return 'Conflicts with '+conflict.name+': both replace the same original feature.';
 if((d.choiceRequired||d.choices)&&!settings.choice.trim())return 'Record the required option before choosing this feature.';
 if(d.choices&&!d.choices.includes(settings.choice))return 'Choose a valid option.';
 if(id==='barbarian-totem-manifestation'&&c.alternateFeatures.selected.includes('barbarian-spiritual-totem')&&alternateSettings(c,'barbarian-spiritual-totem').choice!==settings.choice)return 'The manifestation must match your spiritual totem.';
 if(id==='barbarian-spiritual-totem'&&c.alternateFeatures.selected.includes('barbarian-totem-manifestation')&&alternateSettings(c,'barbarian-totem-manifestation').choice!==settings.choice)return 'The spiritual totem must match your manifestation.';
 if(d.review&&!settings.reviewed)return 'Review the linked source and confirm its prerequisites.';
 return '';
}
export function configureAlternateFeature(c:Character,id:string,patch:Partial<AlternateSettings>){
 if(!alternateFeatureById.has(id))throw new Error('Unknown alternate class feature.');
 const next=alternateSettingsSchema.parse({...alternateSettings(c,id),...patch});
 // Normalize optional properties to the same shape as JSON persistence.
 if(next.level===undefined)delete next.level;
 const before=c.alternateFeatures.settings[id];c.alternateFeatures.settings[id]=next;
 if(c.alternateFeatures.selected.includes(id)&&('level' in patch||'choice' in patch||'reviewed' in patch)){
  const problem=alternateFeatureProblem(c,id);if(problem){if(before)c.alternateFeatures.settings[id]=before;else delete c.alternateFeatures.settings[id];throw new Error(problem);}
 }
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
const replacedNames:Record<string,RegExp>={'special-mount':/^special mount$/i,'detect-evil':/^detect evil$/i,'turn-undead':/^(turn|rebuke|turn or rebuke) undead$/i,'remove-disease':/^remove disease\b/i,'spellcasting':/^(spells|spellcasting)$/i,'combat-style':/^(improved |greater )?combat style/i,'domains':/^domains?$/i,'familiar':/^(summon )?familiar$/i,'wild-shape':/^wild shape/i,'wild-shape-animal':/^wild shape(?!.*elemental)/i,'wild-shape-elemental':/^wild shape.*elemental/i};
export function effectiveClassMilestone(c:Character,classId:string,text:string,level?:number){
 const keys=activeAlternateFeatures(c).filter(d=>d.classId===classId).flatMap(d=>replacementKeys(d,alternateSettings(c,d.id)));
 return text.split(/,\s*/).filter(part=>!keys.some(key=>{const [base,slot]=key.split('@');if(slot&&Number(slot)!==level)return false;return replacedNames[base]?.test(part.trim())||part.trim().toLowerCase().replaceAll(' ','-').replace(/[-(]?[+\d].*$/,'')===base;})).join(', ')||'—';
}
export function alternateFeatureWarnings(c:Character){return c.alternateFeatures.selected.flatMap(id=>{const d=alternateFeatureById.get(id)!;return alternateClassLevel(c,d.classId)<alternateSelectionLevel(c,d)?[d.name+' is inactive until '+d.classId+' level '+alternateSelectionLevel(c,d)+'.']:[];});}
export type AlternateResource={key:string,name:string,max:number,period:'day'|'week'|'encounter'|'manual',description:string,check?:number};
export function alternateResources(c:Character):AlternateResource[]{
 const resources:AlternateResource[]=[],pal=alternateClassLevel(c,'paladin'),cha=Math.floor((effectiveScore(c,'CHA')-10)/2);
 const add=(key:string,name:string,max:number,description:string,period:'day'|'week'|'encounter'|'manual'='day',check?:number)=>resources.push({key,name,max:Math.max(0,max),description,period,...(check===undefined?{}:{check})});
 if(hasAlternateFeature(c,'paladin-divine-counterspell')||hasAlternateFeature(c,'cleric-divine-counterspell')){const check=(alternateClassLevel(c,'cleric')||Math.max(0,pal-3))+((c.skills.find(s=>s.name==='Knowledge (arcana)')?.ranks||0)>=5?2:0);add('daily:counterspell','Divine Counterspell',1+cha,'Counterspell check: d20 + '+check+'. Resolve against the opposing spell; no identification roll is required.','day',check);}
 if(hasAlternateFeature(c,'paladin-divine-spirit')){
  add('daily:spirit-healing','Spirit of healing',1,'Healing capacity '+2*pal*Math.max(0,cha)+' HP; up to '+pal+' rounds. A creature sharing its square spends a standard action to receive healing. Track healing on the affected sheets.');
  if(pal>=11)add('daily:spirit-combat','Spirit of combat',1,'Adjacent allies gain +'+Math.min(5,Math.floor(pal/4))+' sacred attack/damage and good-aligned weapons for DR. Up to '+pal+' rounds; apply only while in range.');
  if(pal>=16)add('daily:spirit-heroism','Spirit of heroism',1,'Occupies your space: DR 10/—, Diehard, and lay on hands as a free action once per round. Up to '+pal+' rounds. Apply these benefits while the spirit lasts.');
  if(pal>=20)add('daily:spirit-fallen','Spirit of the fallen',1,'Adjacent allies gain fast healing 10. Revival within 30 ft. heals '+2*pal+' HP at the start of the target’s next turn, at most once per round; source restrictions apply. Up to '+pal+' rounds.');
 }
 if(hasAlternateFeature(c,'paladin-curse-breaker'))add('weekly:curse-breaker','Curse Breaker',1+Math.floor((pal-6)/3),'Remove curse costs one use.'+(pal>=12?' Break enchantment costs two uses.':''),'week');
 const int=Math.floor((effectiveScore(c,'INT')-10)/2),barb=alternateClassLevel(c,'barbarian'),druid=alternateClassLevel(c,'druid');
 if(hasAlternateFeature(c,'barbarian-whirling-frenzy')||hasAlternateFeature(c,'barbarian-ferocity'))add('retained:daily:Rage',hasAlternateFeature(c,'barbarian-ferocity')?'Ferocity':'Whirling Frenzy',1+Math.floor(barb/4),'Activate the Rage effect while this ability is in use.');
 if(['druid-aspect-of-nature','druid-aspect-of-the-dragon','druid-city-shape','druid-drow-druid'].some(id=>hasAlternateFeature(c,id)))add('retained:daily:Wild shape','Alternate wild shape',druid>=18?6:druid>=14?5:druid>=10?4:druid>=7?3:druid>=6?2:1,'Resolve the selected form or aspect using the source.');
 if(hasAlternateFeature(c,'paladin-underdark-knight')){if(pal>=7)add('daily:underdark-spike','Spike stones',1,'Caster level equals paladin level.');if(pal>=15)add('daily:underdark-door','Dimension door',Math.floor(pal/5),'Caster level equals paladin level.');}
 for(const [id,name,max] of [['sorcerer-metamagic-specialist','Metamagic Specialist',Math.max(1,3+int)],['wizard-immediate-magic','Immediate Magic',Math.max(1,int)]] as const)if(hasAlternateFeature(c,id))add('daily:'+id,name,max,'Resolve the chosen option using the linked source.');
 for(const d of activeAlternateFeatures(c))for(const counter of alternateSettings(c,d.id).counters)add('custom:'+d.id+':'+counter.id,counter.name,counter.max,'Custom tracker for '+d.name+'.',counter.period);
 return resources;
}
export function alternateResourceUsed(c:Character,key:string){if(key.startsWith('custom:')){const [,id,counter]=key.split(':');return alternateSettings(c,id).counters.find(r=>r.id===counter)?.used||0;}return c.alternateFeatures.uses[key]||0;}
export function setAlternateResourceUsed(c:Character,key:string,used:number){if(!Number.isInteger(used)||used<0||used>10000)throw new Error('Invalid spent uses.');if(key.startsWith('custom:')){const [,id,counter]=key.split(':');const row=c.alternateFeatures.settings[id]?.counters.find(r=>r.id===counter);if(!row)throw new Error('Unknown tracker.');row.used=used;}else c.alternateFeatures.uses[key]=used;}
export function spendAlternateResource(c:Character,key:string,cost=1){const r=alternateResources(c).find(r=>r.key===key);if(!r||!Number.isInteger(cost)||cost<1||cost>1&&!(key==='weekly:curse-breaker'&&cost===2&&alternateClassLevel(c,'paladin')>=12))throw new Error('This ability is not available.');const used=alternateResourceUsed(c,key);if(used+cost>r.max)throw new Error('No uses remain for this ability.');setAlternateResourceUsed(c,key,used+cost);}
export function rememberTurningUses(c:Character){if(!c.alternateFeatures.selected.length&&!Object.keys(c.alternateFeatures.uses).length)return;for(const r of c.features)if((r.ruleId?.startsWith('daily:')||r.ruleId?.startsWith('supp:'))&&(r.used||'retained:'+r.ruleId in c.alternateFeatures.uses))c.alternateFeatures.uses['retained:'+r.ruleId]=r.used;const f=c.features.find(f=>f.ruleId==='daily:Turn or rebuke undead'||f.name==='Turn or rebuke undead');if(f){c.alternateFeatures.uses['daily:original-turning']=f.used;f.ruleId='daily:Turn or rebuke undead';}}
export function syncAlternateFeatureCards(c:Character){
 const active=activeAlternateFeatures(c),ids=new Set(active.map(d=>'acf:'+d.id));
 c.features=c.features.filter(f=>!f.ruleId?.startsWith('acf:')||ids.has(f.ruleId));
 for(const d of active){const ruleId='acf:'+d.id;let f=c.features.find(f=>f.ruleId===ruleId);if(!f){if(c.features.length>=250)continue;f={id:crypto.randomUUID(),name:d.name,kind:'Class feature',description:'',source:d.source,max:0,used:0,ruleId,magic:false};c.features.push(f);}const settings=alternateSettings(c,d.id);f.description=d.description+'\n'+(d.replaces.length?'Replaces '+alternateReplacementLabels(c,d).join(', ')+'.':'Optional class rule.')+(settings.choice?'\nOption: '+settings.choice:'')+(settings.notes?'\n'+settings.notes:'')+'\nManage tracked uses in Classes → Alternate class features.';f.source=d.source;}
 if(!c.automation.enabled&&turningClassLevel(c)&&'daily:original-turning' in c.alternateFeatures.uses&&!c.features.some(f=>f.ruleId==='daily:Turn or rebuke undead')){c.features.push({id:crypto.randomUUID(),name:'Turn or rebuke undead',kind:'Class feature',description:'Effective turning level '+turningClassLevel(c)+'.',max:Math.max(0,3+Math.floor((effectiveScore(c,'CHA')-10)/2)+4*c.features.filter(f=>f.kind==='Feat'&&f.name==='Extra Turning').length),used:c.alternateFeatures.uses['daily:original-turning'],source:'https://srd.dndtools.org/srd/classes/classes.html',ruleId:'daily:Turn or rebuke undead'});}
 // Only this app's generated resource is removed. User-written references remain untouched.
 if(!turningClassLevel(c)&&(featureReplaced(c,'cleric','turn-undead')||featureReplaced(c,'paladin','turn-undead')))c.features=c.features.filter(f=>f.ruleId!=='daily:Turn or rebuke undead');
}
