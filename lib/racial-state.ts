import {z} from 'zod';
export const sigils=['aesh','hoon','krau','naen','uur','vaul'] as const;
export const racialStateSchema=z.object({
 sigils:z.array(z.enum(sigils)).max(2).default([]),suppressed:z.boolean().default(false),bonusCasters:z.array(z.string()).max(15).default([]),
 uses:z.record(z.number().int().min(0).max(100)).default({}),reservations:z.array(z.object({casterId:z.string(),level:z.number().int().min(0).max(9),word:z.string()})).max(2).default([]),
 active:z.object({word:z.string(),level:z.number().int().min(0).max(9),rounds:z.number().int().min(0).max(1000),mode:z.string().default(''),targetId:z.string().default('')}).nullable().default(null),
 environment:z.object({targetElement:z.enum(['none','air','earth','fire','water','cold']).default('none'),targetLarge:z.boolean().default(false),magicElement:z.enum(['none','air','earth','fire','water','cold']).default('none'),magicSource:z.enum(['none','air','earth','fire','water','cold']).default('none'),shadow:z.boolean().default(false),glyph:z.boolean().default(false),incomingCasterLevel:z.number().int().min(0).max(100).default(0),grounded:z.boolean().default(true),resistTrip:z.boolean().default(false),stonework:z.boolean().default(false),brightLight:z.boolean().default(false),wordTarget:z.boolean().default(false),underwater:z.boolean().default(false),breathRounds:z.number().int().min(0).max(10000).default(0)}).default({})
}).default({});
export const emptyRacialState=()=>racialStateSchema.parse({});
