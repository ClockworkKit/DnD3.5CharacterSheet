import {z} from 'zod';
import {abilityKeys,baseSkills,characterSchema,newCharacter,type Character} from './model.ts';
import {createPlayerCharacter} from './character-creation.ts';
import {creatureProfileSchema,creatureRulesSource,naturalAttackSchema,type CreatureProfile,type NaturalAttack} from './creature-schema.ts';
import {defaultAutomation} from './automation-schema.ts';
import {effectiveScore} from './ancestry.ts';
import {hasFeat} from './effects.ts';
import {withBonus} from './dice.mjs';

type Save = 'fort'|'ref'|'will';
type Ability = typeof abilityKeys[number];
type CreatureType = CreatureProfile['type'];
// Type defaults only: published entries and templates can override HD and good saves.
export const creatureTypeRules:Record<CreatureType,{hitDie:4|6|8|10|12,bab:number,goodSaves:Save[]}> = {
  Aberration:{hitDie:8,bab:.75,goodSaves:['will']},Animal:{hitDie:8,bab:.75,goodSaves:['fort','ref']},
  Construct:{hitDie:10,bab:.75,goodSaves:[]},Dragon:{hitDie:12,bab:1,goodSaves:['fort','ref','will']},
  Elemental:{hitDie:8,bab:.75,goodSaves:[]},Fey:{hitDie:6,bab:.5,goodSaves:['ref','will']},
  Giant:{hitDie:8,bab:.75,goodSaves:['fort']},Humanoid:{hitDie:8,bab:.75,goodSaves:['ref']},
  'Magical Beast':{hitDie:10,bab:1,goodSaves:['fort','ref']},'Monstrous Humanoid':{hitDie:8,bab:1,goodSaves:['ref','will']},
  Ooze:{hitDie:10,bab:.75,goodSaves:[]},Outsider:{hitDie:8,bab:1,goodSaves:['fort','ref','will']},
  Plant:{hitDie:8,bab:.75,goodSaves:['fort']},Undead:{hitDie:12,bab:.5,goodSaves:['will']},
  Vermin:{hitDie:8,bab:.75,goodSaves:['fort']},
};
const sizeAttack:Record<Character['size'],number>={Fine:8,Diminutive:4,Tiny:2,Small:1,Medium:0,Large:-1,Huge:-2,Gargantuan:-4,Colossal:-8};
const constructHp:Record<Character['size'],number>={Fine:0,Diminutive:0,Tiny:0,Small:10,Medium:20,Large:30,Huge:40,Gargantuan:60,Colossal:80};
const sizeSpace:Record<Character['size'],number>={Fine:.5,Diminutive:1,Tiny:2.5,Small:5,Medium:5,Large:10,Huge:15,Gargantuan:20,Colossal:30};

export function createCreatureProfile(input:z.input<typeof creatureProfileSchema>):CreatureProfile {
  // Parse first so unknown types fail validation rather than indexing arbitrary properties.
  const parsed=creatureProfileSchema.parse(input),rule=creatureTypeRules[parsed.type];
  let goodSaves=input.goodSaves??rule.goodSaves;
  if(parsed.type==='Elemental'&&input.goodSaves===undefined){
    const elements=parsed.subtypes.map(s=>s.toLowerCase());
    if(elements.some(s=>['earth','water'].includes(s)))goodSaves=['fort'];
    else if(elements.some(s=>['air','fire'].includes(s)))goodSaves=['ref'];
    else throw new Error('Choose an elemental subtype or explicitly supply its good saves.');
  }
  const nonabilities=input.nonabilities??(['Undead','Construct'].includes(parsed.type)?['CON']:['Ooze','Vermin'].includes(parsed.type)?['INT']:[]);
  return creatureProfileSchema.parse({...parsed,hitDie:input.hitDie??rule.hitDie,goodSaves,nonabilities});
}

/** Null represents a nonability, never a score of zero. */
export function creatureAbilityScore(c:Character,ability:Ability):number|null {
  return c.creature?.nonabilities.includes(ability)?null:effectiveScore(c,ability);
}
export function creatureAbilityModifier(c:Character,ability:Ability):number {
  const score=creatureAbilityScore(c,ability);return score===null?0:Math.floor((score-10)/2);
}

/** Suggestions, not an overwrite: templates and individual stat blocks often have exceptions. */
export function racialCreatureStatistics(c:Character) {
  if(!c.creature)throw new Error('A creature profile is required.');
  const p=creatureProfileSchema.parse(c.creature),hd=p.racialHitDice,rule=creatureTypeRules[p.type];
  const saves=Object.fromEntries((['fort','ref','will'] as const).map(s=>[s,hd===0?0:p.goodSaves.includes(s)?2+Math.floor(hd/2):Math.floor(hd/3)])) as Record<Save,number>;
  // Fractional HD entries need their printed HP; do not guess rounding or Con treatment.
  const averageHp=hd===0?0:!Number.isInteger(hd)?null:Math.max(hd,Math.floor(hd*((p.hitDie+1)/2+creatureAbilityModifier(c,'CON'))))+(p.type==='Construct'?constructHp[c.size]:0);
  return {hitDice:hd,hitDie:p.hitDie,bab:Math.floor(hd*rule.bab),saves,averageHp,source:creatureRulesSource};
}

export function createNpcSheet(options:Parameters<typeof createPlayerCharacter>[0]):Character {
  const c=createPlayerCharacter(options);c.sheetKind='npc';
  return characterSchema.parse(c);
}

export function createMonsterSheet(options:{name:string,creature:z.input<typeof creatureProfileSchema>,scores:Record<Ability,number|null>,size?:Character['size'],speed?:number,maxHp?:number}):Character {
  const profile=createCreatureProfile(options.creature),size=options.size??'Medium';
  if(!profile.racialHitDice)throw new Error('Provide racial Hit Dice for a classless monster. Use an NPC sheet for a creature with only class levels.');
  for(const a of abilityKeys){
    const score=options.scores[a];
    if(score===null){if(!profile.nonabilities.includes(a))profile.nonabilities.push(a);}
    else if(!Number.isInteger(score)||score<1||score>100)throw new Error('Creature abilities must be whole scores from 1 to 100, or null for a nonability.');
  }
  // Reuse the common shape, then clear every sample class, race, possession, and resource.
  const c=newCharacter('Fighter',1);
  c.sheetKind='monster';c.creature=profile;c.name=options.name.trim();c.race='';c.classes='';c.classLevels=[];
  c.level=Math.max(1,Math.ceil(profile.racialHitDice));c.experience=0;c.languages='';c.size=size;
  c.scores=Object.fromEntries(abilityKeys.map(a=>[a,profile.nonabilities.includes(a)?10:options.scores[a]])) as Character['scores'];
  c.temps={STR:0,DEX:0,CON:0,INT:0,WIS:0,CHA:0};c.gear=[];c.weapons=[];c.features=[];c.casters=[];c.psionics=[];
  c.skills=baseSkills.map(([name,ability,trained,armor],i)=>({id:'skill-'+i,name,ability,trained,armor,ranks:0,misc:0,classSkill:false}));
  c.coins={cp:0,sp:0,gp:0,pp:0};c.automation=defaultAutomation();c.automation.baseSize=size;
  c.speed=options.speed??30;c.automation.baseSpeed=c.speed;
  c.defense={armor:0,shield:0,natural:0,deflection:0,dodge:0,misc:0,dexCap:100,checkPenalty:0,spellFailure:0,sr:0,dr:'',drSources:[],resistances:''};
  c.creature.space=options.creature.space??sizeSpace[size];
  // Reach depends on anatomy (tall/long); callers must choose it for large creatures.
  c.creature.reach=options.creature.reach??(['Fine','Diminutive','Tiny'].includes(size)?0:5);
  const stats=racialCreatureStatistics(c);
  if(stats.averageHp===null&&options.maxHp===undefined)throw new Error('Enter printed hit points for a fractional-HD monster.');
  c.bab=stats.bab;c.saves={fort:{base:stats.saves.fort,misc:0},ref:{base:stats.saves.ref,misc:0},will:{base:stats.saves.will,misc:0}};
  c.hitDice=(profile.racialHitDice===.25?'1/4':profile.racialHitDice===.5?'1/2':profile.racialHitDice)+'d'+profile.hitDie;
  c.maxHp=options.maxHp??stats.averageHp!;c.hp=c.maxHp;c.tempHp=0;c.nonlethal=0;
  return characterSchema.parse(c);
}

/** One result per physical attack. Natural weapons never gain BAB iterative attacks. */
export function naturalAttackRoutine(c:Character,options:{withManufacturedWeapon?:boolean,multiattack?:boolean}={}) {
  if(!c.creature)return [];
  const multiattack=options.multiattack??hasFeat(c,'Multiattack');
  return c.creature.naturalAttacks.flatMap((raw:NaturalAttack)=>{
    const a=naturalAttackSchema.parse(raw),secondary=options.withManufacturedWeapon||a.role==='secondary';
    const ability=creatureAbilityModifier(c,a.ability),strength=creatureAbilityModifier(c,'STR');
    const multiplier=secondary?Math.min(.5,a.strengthMultiplier):a.strengthMultiplier;
    const damageBonus=a.damageBonus+(multiplier===0?0:strength<0?strength:Math.floor(strength*multiplier));
    const bonus=c.bab+ability+sizeAttack[c.size]+a.attackBonus+c.situational-(secondary?(multiattack?2:5):0);
    return Array.from({length:a.count},(_,i)=>({id:a.id+':'+i,name:a.name,role:secondary?'secondary':'primary',attackBonus:bonus,attackFormula:withBonus('1d20',bonus),damageFormula:withBonus(a.damage,damageBonus),criticalRange:a.criticalRange,criticalMultiplier:a.criticalMultiplier,damageTypes:a.damageTypes,notes:a.notes}));
  });
}
