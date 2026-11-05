import {z} from 'zod';

export const uncannyDodgeDecisionSchema=z.object({
 improved:z.boolean(),
 minimumRogueLevel:z.number().int().min(1).max(10000).nullable(),
 gm:z.string().trim().min(1).max(160),
 reason:z.string().trim().min(1).max(2000),
}).strict().refine(r=>r.improved?r.minimumRogueLevel!==null:r.minimumRogueLevel===null,
 {message:'A granted improvement needs a minimum attacker rogue level; an ungranted improvement has no threshold.'});

/** Optional, explicit table ruling. Never a default gestalt interpretation. */
export const uncannyDodgeRulingSchema=z.object({
 version:z.literal(1),
 decision:uncannyDodgeDecisionSchema,
 progression:z.string().min(1).max(20000),
}).strict();
export type UncannyDodgeDecision=z.infer<typeof uncannyDodgeDecisionSchema>;
