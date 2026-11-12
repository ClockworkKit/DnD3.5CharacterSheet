import type {Character} from './model.ts';
import {activeAlternateFeatures} from './alternate-features.ts';
import {replacementOverlap} from './alternate-feature-schema.ts';
import {classLevel} from './effects.ts';

export const strengthDomainEffect='strength-domain-power';

export function strengthDomainPower(c:Character){
 const level=classLevel(c,'cleric');
 const grants=c.features.filter(f=>f.kind==='Class feature'&&f.name.trim().toLowerCase()==='strength domain');
 if(!level||!grants.length)return null;
 const feature=grants[0],limit=feature.max||1;
 const effect=c.effects.find(e=>e.preset===strengthDomainEffect);
 const altered=activeAlternateFeatures(c).some(d=>d.classId==='cleric'&&(d.replaces.some(key=>replacementOverlap(key,'domains'))||d.id==='cleric-improved-domain-powers'));
 let problem='';
 if(grants.length>1)problem='Review the duplicate Strength domain cards in Feats & features.';
 else if(altered)problem='An alternate class feature changes your domains. Track the power using its feature card.';
 else if(feature.used>=limit)problem='All recorded uses have been spent today.';
 return {level,feature,limit,effect,problem,manual:altered||grants.length>1};
}

export function useStrengthDomain(c:Character,activate:boolean){
 const power=strengthDomainPower(c);
 if(!power||power.problem)throw new Error(power?.problem||'A cleric with the Strength domain is required.');
 if(activate){
  if(!c.automation.enabled)throw new Error('Enable calculations to apply the Strength bonus.');
  if(!power.effect&&c.effects.length>=100)throw new Error('The effects list is full.');
  const effect={id:power.effect?.id??crypto.randomUUID(),preset:strengthDomainEffect,name:'Strength domain',active:true,permanent:false,
   casterLevel:0,rounds:1,notes:'Free action. The enhancement bonus lasts one round.',
   modifiers:[{target:'STR',type:'enhancement' as const,value:String(power.level),when:''}]};
  if(power.effect)Object.assign(power.effect,effect);
  else c.effects.push(effect);
 }
 power.feature.max=power.limit;
 power.feature.used++;
}
