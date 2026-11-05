import type {Character} from './model.ts';
import {uncannyDodgeFeatures} from './defensive-class-features.ts';
import {uncannyDodgeDecisionSchema,uncannyDodgeRulingSchema,type UncannyDodgeDecision} from './uncanny-dodge-schema.ts';

function reviewSource(c:Character){
 return JSON.stringify({progression:uncannyDodgeFeatures(c).progression,saved:c.classSystems.uncannyDodgeRuling??null});
}

/** Review only the unresolved mixed gestalt case; explicit listed grants remain. */
export function previewUncannyDodgeRuling(c:Character,input:UncannyDodgeDecision){
 const decision=uncannyDodgeDecisionSchema.parse(input),features=uncannyDodgeFeatures(c);
 if(!features.rulingEligible)throw new Error('A ruling is available only for mixed or staggered gestalt Uncanny Dodge sources.');
 if(features.listedImprovement&&!decision.improved)throw new Error('A listed Improved Uncanny Dodge grant cannot be removed by this progression ruling.');
 if(decision.improved&&!features.improvementAvailable)throw new Error('All reviewed sources replace Improved Uncanny Dodge. This ruling cannot restore a surrendered feature.');
 const ruling=uncannyDodgeRulingSchema.parse({version:1,decision,progression:features.progression});
 return {source:reviewSource(c),ruling,selection:JSON.stringify(ruling),before:{improved:features.improved,minimumRogueLevel:features.minimumRogueLevel},suspended:features.suspendedSources.length>0};
}
export type UncannyDodgeReview=ReturnType<typeof previewUncannyDodgeRuling>;

export function applyUncannyDodgeRuling(c:Character,review:UncannyDodgeReview){
 if(reviewSource(c)!==review.source)throw new Error('The progression or saved ruling changed. Review the ruling again before confirming.');
 if(JSON.stringify(review.ruling)!==review.selection)throw new Error('The ruling choices changed. Review again before confirming.');
 const checked=previewUncannyDodgeRuling(c,review.ruling.decision);
 c.classSystems.uncannyDodgeRuling=checked.ruling;
}
