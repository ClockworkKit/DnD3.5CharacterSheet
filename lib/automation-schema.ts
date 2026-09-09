import {z} from 'zod';
const number=z.number().finite().min(-100000).max(100000);
export const automationSchema=z.object({
 version:z.number().int().min(0).max(1).default(0),enabled:z.boolean().default(false),
 hpMethod:z.enum(['average','maximum','rolled']).default('average'),hpRolls:z.array(z.number().min(1).max(100)).max(100).default([]),
 baseSize:z.enum(['Fine','Diminutive','Tiny','Small','Medium','Large','Huge','Gargantuan','Colossal']).default('Medium'),baseSpeed:number.default(30),
 encumbrance:z.boolean().default(true),quadruped:z.boolean().default(false),adjustments:z.record(number).default({}),overrides:z.record(number).default({}),
 history:z.array(z.object({key:z.string().max(150),intScore:z.number().min(1).max(100),skillPoints:z.number().min(0).max(1000).optional()})).max(100).default([]),
 firstClassId:z.string().max(100).default(''),rangerStyle:z.enum(['archery','two-weapon','none']).default('none'),
 context:z.object({incoming:z.enum(['none','melee','ranged']).default('none'),unseen:z.boolean().default(false),sneakAttack:z.boolean().default(false),smite:z.boolean().default(false),combatExpertise:z.number().int().min(0).max(5).default(0),targetType:z.string().max(60).default(''),targetRace:z.string().max(60).default(''),saveAgainst:z.string().max(60).default(''),skillUse:z.string().max(60).default(''),distance:z.number().min(0).max(100000).default(0),targetInMelee:z.boolean().default(false),flanking:z.boolean().default(false),flatFooted:z.boolean().default(false),dodgeTarget:z.boolean().default(false),powerAttack:z.number().int().min(0).max(100).default(0),twoWeapon:z.boolean().default(false),offhandLight:z.boolean().default(true),rapidShot:z.boolean().default(false),flurry:z.boolean().default(false),defensive:z.enum(['none','fighting','total']).default('none'),charge:z.boolean().default(false)}).default({})
});
export const effectSchema=z.object({id:z.string().min(1).max(100),name:z.string().max(160),preset:z.string().max(100).default(''),active:z.boolean().default(true),permanent:z.boolean().default(false),casterLevel:z.number().int().min(0).max(100).default(0),rounds:z.number().int().min(0).max(100000).default(0),notes:z.string().max(2000).default(''),modifiers:z.array(z.object({target:z.string().max(100),type:z.enum(['untyped','enhancement','morale','resistance','competence','insight','luck','sacred','profane','circumstance','dodge','armor','shield','natural','deflection','size']),value:z.string().max(200),when:z.string().max(100).default('')})).max(30)});
export const defaultAutomation=()=>automationSchema.parse({});
