import {z} from 'zod';
import {essentiaRulingSchema} from './meldshaping-schema.ts';
import {uncannyDodgeRulingSchema} from './uncanny-dodge-schema.ts';

// Keep persistence independent of calculations and the Character module.
export const classSystemsSchema=z.object({
 choices:z.array(z.object({id:z.string().min(1).max(100),classId:z.string().max(100),name:z.string().min(1).max(160),invocationGrade:z.enum(['least','lesser','greater','dark']).optional(),kind:z.enum(['invocation','maneuver','stance','vestige','soulmeld','mystery','fundamental','utterance','aura']),level:z.number().int().min(0).max(9),readied:z.boolean().default(false),granted:z.boolean().default(false),spent:z.number().int().min(0).max(10000).default(0),essentia:z.number().int().min(0).max(20).default(0),bound:z.boolean().default(false),totem:z.boolean().default(false),notes:z.string().max(4000).default('')})).max(200).default([]),
 pools:z.record(z.number().int().min(0).max(10000)).default({}),
 delayedDamage:z.number().int().min(0).max(1000).default(0),
 essentiaRuling:essentiaRulingSchema.optional(),
 uncannyDodgeRuling:uncannyDodgeRulingSchema.optional(),
}).default({});
export type SystemChoice=z.infer<typeof classSystemsSchema>['choices'][number];
