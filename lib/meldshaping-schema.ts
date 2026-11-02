import {z} from 'zod';

/** An explicit table ruling, scoped to the progression reviewed by the GM. */
export const essentiaRulingSchema=z.object({
 version:z.literal(1),
 total:z.number().int().min(0).max(10000),
 gm:z.string().trim().min(1).max(160),
 reason:z.string().trim().min(1).max(2000),
 progression:z.string().min(1).max(20000),
}).strict();
