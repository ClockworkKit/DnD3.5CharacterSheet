import {z} from 'zod';

export const spellAttackSchema=z.object({
 mode:z.enum(['auto','none','melee-touch','ranged-touch','melee','ranged','spiritual-weapon']).default('auto'),
 count:z.number().int().min(1).max(20).optional(),
 bonus:z.number().int().min(-1000).max(1000).default(0),
});
export type SpellAttackSettings=z.infer<typeof spellAttackSchema>;
