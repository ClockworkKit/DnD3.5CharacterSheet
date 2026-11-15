import type {Character} from './model.ts';
import type {ClassDefinition} from './classes.ts';
import type {Eligibility} from './prerequisites.ts';
import {classAlignmentEligibility,assertClassAlignment} from './class-alignment.ts';
import {classContinuationEligibility} from './class-continuation.ts';

export function classAdvancementEligibility(c:Character,definition:ClassDefinition):Eligibility {
 const alignment=classAlignmentEligibility(c,definition),continuation=classContinuationEligibility(c,definition);
 const requirements=[...alignment.requirements,...continuation.requirements];
 const eligible=alignment.eligible&&continuation.eligible;
 return {eligible,requirements,status:eligible?'Eligible':requirements.some(r=>r.state==='missing')?'Missing prerequisites':'Needs confirmation'};
}
export function assertClassAdvancement(c:Character,definition:ClassDefinition){
 assertClassAlignment(c,definition);
 const check=classContinuationEligibility(c,definition);
 if(!check.eligible)throw new Error(definition.name+' continuation requirement needs review. '+check.requirements.find(r=>r.state!=='met'&&!r.confirmed)!.label);
}
