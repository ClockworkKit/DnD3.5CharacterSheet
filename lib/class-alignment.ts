import type {Character} from './model.ts';
import type {ClassDefinition} from './classes.ts';
import type {Eligibility,Requirement} from './prerequisites.ts';

const alignments=['lawful good','neutral good','chaotic good','lawful neutral','true neutral','chaotic neutral','lawful evil','neutral evil','chaotic evil'] as const;
const abbreviations:Record<string,string>={lg:alignments[0],ng:alignments[1],cg:alignments[2],ln:alignments[3],n:alignments[4],tn:alignments[4],cn:alignments[5],le:alignments[6],ne:alignments[7],ce:alignments[8]};
export function normalizedAlignment(value:string):string|null{
 const text=value.trim().toLowerCase().replace(/[-–—]/g,' ').replace(/\s+/g,' ');
 const expanded=abbreviations[text]??(text==='neutral'?'true neutral':text);
 return alignments.includes(expanded as typeof alignments[number])?expanded:null;
}

/** Only recognize complete, unambiguous rules, not keywords inside source prose. */
function allowedAlignments(rule:string):readonly string[]|null|undefined{
 const text=rule.toLowerCase().trim().replace(/\.$/,'').replace(/non[- ]/g,'non');
 if(!text||/^any(?: alignment)?$/.test(text))return null;
 const axes=text.split(/\s+or\s+/).map(part=>part.match(/^(?:any )?(non)?(lawful|chaotic|good|evil)$/));
 if(axes.every(Boolean))return alignments.filter(a=>axes.some(axis=>a.includes(axis![2])!==!!axis![1]));
 const choices=text.split(/,\s*(?:or\s+)?|\s+or\s+/).map(normalizedAlignment);
 return choices.every(Boolean)?choices as string[]:undefined;
}

/** Prospective advancement only: loading a sheet never removes historical levels. */
export function classAlignmentEligibility(c:Character,definition:ClassDefinition):Eligibility{
 const rows:Requirement[]=[];
 // Prestige entry retains its own source-specific checker and continuation policy.
 if(definition.kind==='Prestige')return {eligible:true,requirements:rows,status:'Eligible'};
 const allowed=allowedAlignments(definition.alignment);
 if(allowed===null)return {eligible:true,requirements:rows,status:'Eligible'};
 const recorded=c.alignment.trim(),alignment=normalizedAlignment(recorded);
 const label=definition.name+' alignment: '+definition.alignment;
 if(!recorded)rows.push({label:'Record the character alignment on Sheet before advancing '+definition.name+'. '+label,state:'missing'});
 else if(alignment&&allowed?.includes(alignment))rows.push({label,state:'met'});
 else{
  const exception=alignment&&allowed!==undefined;
  const next=(c.classLevels.find(e=>e.classId===definition.id)?.level??0)+1;
  const review=(exception?'House rule: the GM permits ':'Verify against the complete class source: ')+definition.name+(exception?' '+next:'')+' with alignment '+recorded+(definition.id==='cleric'?' and deity '+(c.deity.trim()||'(no deity recorded)'):'')+'. '+definition.alignment;
  // Exceptions are per level; source verification remains valid for the same alignment, deity and exact rule.
  const key='class-alignment:'+JSON.stringify([definition.id,exception?next:0,recorded,c.deity,definition.alignment]);
  rows.push({label:review,key,state:'confirm',confirmed:!!c.prerequisiteConfirmations[key]});
 }
 const eligible=rows.every(r=>r.state==='met'||r.state==='confirm'&&r.confirmed);
 return {eligible,requirements:rows,status:eligible?'Eligible':rows.some(r=>r.state==='missing')?'Missing prerequisites':'Needs confirmation'};
}

export function assertClassAlignment(c:Character,definition:ClassDefinition){
 const result=classAlignmentEligibility(c,definition);
 if(!result.eligible)throw new Error(definition.name+' alignment requirement needs review. '+result.requirements.find(r=>r.state!=='met'&&!r.confirmed)!.label);
}
