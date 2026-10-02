import {z} from 'zod';

export const creatureTypes = ['Aberration','Animal','Construct','Dragon','Elemental','Fey','Giant','Humanoid','Magical Beast','Monstrous Humanoid','Ooze','Outsider','Plant','Undead','Vermin'] as const;
export const creatureRulesSource = 'https://srd.dndtools.org/srd/monsters/monsterTypes.html';
const label = z.string().trim().min(1).max(160);
const note = z.string().max(4000);
const bounded = z.number().finite().min(-10000).max(10000);
const distance = z.number().finite().min(0).max(10000);
const ability = z.enum(['STR','DEX','CON','INT','WIS','CHA']);
const save = z.enum(['fort','ref','will']);
const unique = <T>(values:T[])=>new Set(values).size===values.length;
export const naturalAttackSchema = z.object({
  id:z.string().min(1).max(100),name:label,count:z.number().int().min(1).max(50).default(1),
  role:z.enum(['primary','secondary']).default('primary'),
  ability:ability.default('STR'),damage:z.string().regex(/^\d{1,2}d\d{1,3}$/).default('1d4'),
  damageTypes:z.array(z.enum(['bludgeoning','piercing','slashing'])).max(3).default([]),
  strengthMultiplier:z.union([z.literal(0),z.literal(.5),z.literal(1),z.literal(1.5)]).default(1),
  attackBonus:bounded.default(0),damageBonus:bounded.default(0),
  attackRoll:z.boolean().default(true),
  damageKind:z.enum(['hit-points','ability-damage','ability-drain']).default('hit-points'),
  damageAbility:ability.nullable().default(null),
  criticalRange:z.number().int().min(2).max(20).default(20),criticalMultiplier:z.number().int().min(2).max(10).default(2),
  notes:note.default(''),
}).refine(a=>{const [count,sides]=a.damage.split('d').map(Number);return count>=1&&count<=50&&sides>=2&&sides<=100;},'Choose 1–50 damage dice with 2–100 sides.');

/** Creature metadata augments the existing saved sheet; CR is independent of HD and LA. */
export const creatureProfileSchema = z.object({
  raceOrigin:z.string().max(100).optional(),
  type:z.enum(creatureTypes),subtypes:z.array(label).max(20).refine(unique,'Subtypes must be unique.').default([]),
  challengeRating:z.number().finite().min(0).max(100).nullable().default(null),
  racialHitDice:z.number().finite().min(0).max(100).refine(n=>Number.isInteger(n)||[.25,.5].includes(n),'Use whole HD, 1/2 HD, or 1/4 HD.').default(0),
  hitDie:z.union([z.literal(4),z.literal(6),z.literal(8),z.literal(10),z.literal(12)]).default(8),
  goodSaves:z.array(save).max(3).refine(unique,'Good saves must be unique.').default([]),
  nonabilities:z.array(ability).max(6).refine(unique,'Nonabilities must be unique.').default([]),
  space:distance.default(5),reach:distance.default(5),
  movement:z.object({burrow:distance.default(0),climb:distance.default(0),swim:distance.default(0),fly:distance.default(0),maneuverability:z.enum(['perfect','good','average','poor','clumsy']).nullable().default(null)}).default({}),
  naturalAttacks:z.array(naturalAttackSchema).max(50).refine(rows=>unique(rows.map(r=>r.id)),'Natural attack IDs must be unique.').default([]),
  specialAttacks:z.array(label).max(100).default([]),specialQualities:z.array(label).max(100).default([]),
  senses:note.default(''),immunities:note.default(''),vulnerabilities:note.default(''),
  environment:note.default(''),organization:note.default(''),treasure:note.default(''),advancement:note.default(''),
  source:z.string().max(500).default(creatureRulesSource),notes:note.default(''),
});
export type CreatureProfile = z.infer<typeof creatureProfileSchema>;
export type NaturalAttack = z.infer<typeof naturalAttackSchema>;
