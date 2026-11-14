import type {Character} from './model.ts';
import type {ClassDefinition} from './classes.ts';
import type {Eligibility,Requirement} from './prerequisites.ts';
import {normalizedAlignment} from './alignment-values.ts';

export type DeityIdentity=Pick<Character,'deity'|'deityAlignment'>;
export function deityAlignmentValue(c:DeityIdentity){
 return c.deity.trim()&&c.deityAlignment?.deity===c.deity.trim()?c.deityAlignment.alignment:'';
}
const deityRules:Record<string,string>={
 cleric:'Within one alignment step of the deity; a true neutral cleric requires a true neutral deity. A cleric may instead follow a cause without a deity.',
 'favored-soul':'A deity is required. A true neutral favored soul requires a true neutral deity.',
 'divine-mind':'A deity is required. Neither character alignment component may oppose the corresponding deity component.'
};
export const hasDeityAlignmentRule=(id:string)=>Object.hasOwn(deityRules,id);
type Context=Pick<Character,'alignment'|'deity'|'deityAlignment'|'classLevels'|'prerequisiteConfirmations'>;
const axes=(alignment:string)=>[alignment.includes('lawful')?1:alignment.includes('chaotic')?-1:0,alignment.includes('good')?1:alignment.includes('evil')?-1:0];

/** Only prospective prerequisites. No changes to existing powers, levels or resources. */
export function deityAlignmentEligibility(c:Context,definition:ClassDefinition):Eligibility|undefined{
 if(!hasDeityAlignmentRule(definition.id))return;
 const rule=deityRules[definition.id];
 const rows:Requirement[]=[],recorded=c.alignment.trim(),alignment=normalizedAlignment(recorded),deity=c.deity.trim();
 const code=deityAlignmentValue(c),patron=normalizedAlignment(code);
 const finish=():Eligibility=>{const eligible=rows.every(r=>r.state==='met'||r.state==='confirm'&&r.confirmed);return {eligible,requirements:rows,status:eligible?'Eligible':rows.some(r=>r.state==='missing')?'Missing prerequisites':'Needs confirmation'};};
 if(!recorded)rows.push({state:'missing',label:'Record the character alignment before taking '+definition.name+'. '+rule});
 if(!deity&&definition.id!=='cleric')rows.push({state:'missing',label:'Record a patron deity before taking '+definition.name+'. '+rule});
 if(rows.length)return finish();
 let allowed:boolean|undefined;
 if(alignment){
  if(definition.id==='cleric'&&!deity)allowed=true;
  else if(definition.id==='favored-soul'&&alignment!=='true neutral')allowed=true;
  else if(definition.id==='divine-mind'&&alignment==='true neutral')allowed=true;
  else if(patron){
   const a=axes(alignment),b=axes(patron);
   allowed=definition.id==='cleric'?Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<=1&&(alignment!=='true neutral'||patron==='true neutral')
    :definition.id==='favored-soul'?patron==='true neutral'
    :a.every((value,i)=>value*b[i]!==-1);
  }
 }
 const identity=definition.name+' with alignment '+recorded+' and deity '+(deity||'(none)')+(patron?' ('+code+')':'');
 if(allowed===true)rows.push({state:'met',label:identity+'. '+rule});
 else{
  const exception=allowed===false,next=(c.classLevels.find(e=>e.classId===definition.id)?.level??0)+1;
  // Retain prior Cleric source confirmations when no new deity-alignment evidence has been recorded.
  const key=definition.id==='cleric'&&!code
   ?'class-alignment:'+JSON.stringify([definition.id,0,recorded,c.deity,definition.alignment])
   :'class-deity:'+JSON.stringify([definition.id,exception?next:0,recorded,c.deity,code||null,definition.alignment,rule]);
  rows.push({state:'confirm',key,confirmed:!!c.prerequisiteConfirmations[key],label:(exception?'House rule: the GM permits '+definition.name+' '+next+'. ':'Verify against the complete class source: ')+identity+'. '+rule+(patron?'':' Record the deity alignment to check the relationship automatically, or verify it with the player / DM.')});
 }
 return finish();
}
