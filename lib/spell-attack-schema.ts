import {z} from 'zod';

export const spellAttackSchema=z.object({
 mode:z.enum(['auto','none','melee-touch','ranged-touch','melee','ranged','spiritual-weapon']).default('auto'),
 count:z.number().int().min(1).max(20).optional(),
 bonus:z.number().int().min(-1000).max(1000).default(0),
 // Optional so loading older characters never adds or resets a target choice.
 effectTarget:z.enum(['ordinary','undead','light-vulnerable-undead','construct']).optional(),
});
export type SpellAttackSettings=z.infer<typeof spellAttackSchema>;
