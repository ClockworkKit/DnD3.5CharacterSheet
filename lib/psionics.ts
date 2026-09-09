import type {Character,Psionic} from './model.ts';
import {scaledSpellText,type Roll} from './rules.ts';
import {manifestDefinition,psionicProgression} from './advancement.ts';
import {effectBonus} from './effects.ts';
import {racialPowerPoints,effectiveScore} from './ancestry.ts';
export type PowerReference={id:string,name:string,school:string,levels:Record<string,number>,levelText:string,cost:number,display:string,manifesting:string,range:string,target:string,duration:string,save:string,resistance:string,description:string,source:string};
export function powerReserve(c:Character){const max=c.psionics.reduce((a,p)=>a+p.max,0)+racialPowerPoints(c),spent=c.psionics.reduce((a,p)=>a+p.spent,0)+c.ancestry.powerPointsSpent;return {max,spent,remaining:Math.max(0,max-spent)};}
export function powerDC(c:Character,p:Psionic,k:Psionic['powers'][number]){return 10+k.level+Math.floor((effectiveScore(c,p.ability)-10)/2)+p.dcExtra+(c.automation.enabled?effectBonus(c,'powerDC'):0);}
export function manifestingProblem(c:Character,p:Psionic,k:Psionic['powers'][number]){
 if(c.automation.enabled){
  if(effectiveScore(c,p.ability)<10+k.level)return p.ability+' is too low to manifest this power level.';
  const d=manifestDefinition(p),progression=psionicProgression(c,p).progression;
  const highest=d?.levels.find(r=>r.level===Math.min(progression,d.levels.length))?.powerLevel;
  if(p.manifesting?.automatic&&d&&(highest===undefined||k.level>highest))return 'This tradition cannot manifest that power level yet.';
 }
 if(k.cost<2*k.level-1)return 'The cost is below the base cost for this power level.';
 if(k.cost>p.level)return 'The power exceeds the manifester-level spending limit.';
 if(k.cost>powerReserve(c).remaining)return 'Not enough power points remain.';
 return '';
}
export function canManifest(c:Character,p:Psionic,k:Psionic['powers'][number]){return !manifestingProblem(c,p,k);}

export function spendPower(c:Character,profileId:string,powerId:string){const p=c.psionics.find(x=>x.id===profileId),k=p?.powers.find(x=>x.id===powerId);if(!p||!k||!canManifest(c,p,k))throw new Error('The power exceeds your remaining power points or manifester-level spending limit.');p.spent+=k.cost;}
export function powerCard(c:Character,p:Psionic,k:Psionic['powers'][number],r?:PowerReference):Roll{return {title:k.name,details:k.notes,fields:[['Tradition',p.name],['Manifester level',String(p.level)],['Power level',String(k.level)],['Power points',String(k.cost)],...(r?[[ 'Manifesting time',r.manifesting],['Range',scaledSpellText(r.range,p.level)],['Duration',scaledSpellText(r.duration,p.level)],['Save',r.save+(r.save.toLowerCase()==='none'?'':' (DC '+powerDC(c,p,k)+')')],['Power resistance',r.resistance],['Summary',r.description.slice(0,240)]] as Array<[string,string]>:[[ 'Base save DC',String(powerDC(c,p,k))] as [string,string]])]};}
