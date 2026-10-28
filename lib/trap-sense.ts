import type {Character} from './model.ts';
import {alternateClassLevel,classFeatureLevel,hasAlternateFeature} from './alternate-features.ts';
import {gestaltFeatureLedger,type GestaltFeatureProgression} from './gestalt-progression.ts';
import {findClass} from './classes.ts';

/** The same Trap Sense ability: ordinary class bonuses stack; overlapping
 * gestalt progression uses the existing faster-feature ledger convention. */
export function trapSense(c:Character){
 const policies:Record<string,GestaltFeatureProgression>={};
 for(const id of ['rogue','barbarian','dwarven-defender']){
  if(!classFeatureLevel(c,id,'trap-sense'))continue;
  policies[id]=id==='dwarven-defender'
   ?{rate:level=>level>8?0:1/4,cumulative:level=>Math.min(2,Math.floor(level/4))}
   :{rate:1/3,cumulative:level=>Math.floor(level/3)};
 }
 const thief=hasAlternateFeature(c,'lurk-true-thief');
 const focused=c.psionics.some(p=>p.manifesting?.classId==='lurk'&&p.focused);
 if(thief&&focused)policies.lurk={rate:level=>level>11?0:1/3,cumulative:level=>Math.min(3,Math.max(0,Math.floor((level-2)/3)))};
 const sources=Object.entries(policies).flatMap(([id,policy])=>{
  const amount=policy.cumulative(alternateClassLevel(c,id));
  return amount?[{classId:id,name:id==='lurk'?'Lurk (focused True Thief)':findClass(id)!.name,amount}]:[];
 });
 const ledger=gestaltFeatureLedger(c,policies);
 return {sources,bonus:ledger?ledger.at(-1)?.total??0:sources.reduce((n,s)=>n+s.amount,0),gestalt:!!ledger,
  focusRequired:thief&&alternateClassLevel(c,'lurk')>=5&&!focused};
}
