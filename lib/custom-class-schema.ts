import {z} from 'zod';
import equipment from './equipment-data.json' with {type:'json'};

const text=z.string().max(2000);
const id=z.string().trim().min(1).max(80);
const count=z.number().int().min(0).max(100);
const ability=z.enum(['STR','DEX','CON','INT','WIS','CHA']);
const startLevel=z.number().int().min(1).max(100);
export const customCastingSchema=z.object({
 ability,bonusAbility:ability.optional(),dcAbility:ability.optional(),mode:z.enum(['prepared','spontaneous']),
 type:z.enum(['arcane','divine']),list:z.string().trim().min(1).max(160),startLevel,halfLevel:z.boolean(),
}).strict();
export const customManifestingSchema=z.object({
 ability,startLevel,levelOffset:z.number().int().min(-100).max(100),bonusPoints:z.number().int().min(0).max(10000),
}).strict();
const spellCounts=z.array(count).length(10);
const resourceRow={slots:z.array(count.nullable()).length(10).optional(),spellsKnown:spellCounts.optional(),
 powerPoints:z.number().int().min(0).max(10000).optional(),powersKnown:count.optional(),powerLevel:z.number().int().min(0).max(9).optional()};
const profile=z.object({bab:z.enum(['full','medium','poor']),fort:z.enum(['good','poor']),ref:z.enum(['good','poor']),will:z.enum(['good','poor'])}).strict();
const items=(kind:'weapon'|'armor')=>z.array(z.string().min(1).max(200).refine(name=>equipment.some(e=>e.kind===kind&&e.name===name),'Choose an exact item from the equipment catalog.')).max(100).refine(names=>new Set(names).size===names.length,'Do not repeat an equipment choice.');
/** Explicit source-checked training, using the existing equipment calculation contract. */
export const customProficienciesSchema=z.object({
 simple:z.boolean(),martial:z.boolean(),simpleMeleeOnly:z.boolean().optional(),martialMeleeOnly:z.boolean().optional(),
 weapons:items('weapon'),armor:z.enum(['none','light','medium','heavy']),armors:items('armor').optional(),
 shields:z.enum(['none','buckler','light','standard','all']),mediumAt:z.number().int().min(1).max(100).optional(),
}).strict().superRefine((p,ctx)=>{
 if(p.simpleMeleeOnly&&!p.simple)ctx.addIssue({code:'custom',path:['simpleMeleeOnly'],message:'A melee-only simple group must also grant simple weapons.'});
 if(p.martialMeleeOnly&&!p.martial)ctx.addIssue({code:'custom',path:['martialMeleeOnly'],message:'A melee-only martial group must also grant martial weapons.'});
 if(p.mediumAt&&['medium','heavy'].includes(p.armor))ctx.addIssue({code:'custom',path:['mediumAt'],message:'Delayed medium armor requires a starting armor group below medium.'});
});
export type CustomProficiencies=z.infer<typeof customProficienciesSchema>;
export function customProficiencyText(p?:CustomProficiencies){
 if(!p)return 'Not configured; no custom class equipment training is automated.';
 const groups=[p.simple?(p.simpleMeleeOnly?'simple melee weapons':'all simple weapons'):'',p.martial?(p.martialMeleeOnly?'martial melee weapons':'all martial weapons'):'',...p.weapons].filter(Boolean);
 const shields={none:'no shields',buckler:'bucklers only',light:'bucklers and light shields',standard:'shields except tower shields',all:'all shields including tower shields'}[p.shields];
 return 'Weapons: '+(groups.join(', ')||'no class grant')+'. Armor: '+(p.armor==='none'?'no armor group':'up to '+p.armor)+(p.armors?.length?'; individually '+p.armors.join(', '):'')+(p.mediumAt?'; up to medium from class level '+p.mediumAt:'')+'. Shields: '+shields+'.';
}
/** Explicit source tables. Unknown mechanics fail rather than being discarded. */
export const customClassSchema=z.object({
 version:z.literal(1),
 definition:z.object({
  id:id.regex(/^custom-[a-z0-9-]+$/,'Use a distinct custom- class ID.'),name:z.string().trim().min(1).max(200),
  kind:z.enum(['Core','Supplemental','Prestige']),hitDie:z.union([z.literal(4),z.literal(6),z.literal(8),z.literal(10),z.literal(12)]),
  skillPoints:count,skills:text,alignment:text,requirements:text,headers:z.array(z.string().max(200)).max(30),
  levels:z.array(z.object({level:z.number().int().min(1).max(100),bab:count,fort:count,ref:count,will:count,special:text,extra:z.array(text).max(30),...resourceRow}).strict()).min(1).max(100),
  source:z.string().trim().min(1).max(500),description:z.string().max(12000).optional(),book:z.string().max(200).optional(),
  proficiencies:customProficienciesSchema.optional(),
  casting:customCastingSchema.optional(),manifesting:customManifestingSchema.optional(),
 }).strict(),
 policy:z.object({family:id,combinationPrestige:z.boolean(),bonusProfile:profile}).strict(),
}).strict().superRefine(({definition:d,policy},ctx)=>{
 if(d.proficiencies?.mediumAt&&d.proficiencies.mediumAt>d.levels.length)ctx.addIssue({code:'custom',path:['definition','proficiencies','mediumAt'],message:'Keep a table row for the delayed armor-training level.'});
 if(policy.combinationPrestige&&d.kind!=='Prestige')ctx.addIssue({code:'custom',path:['policy','combinationPrestige'],message:'Only prestige classes can require combination-class approval.'});
 d.levels.forEach((row,index)=>{
  const issue=(field:string,message:string)=>ctx.addIssue({code:'custom',path:['definition','levels',index,field],message});
  if(!!d.casting!==!!row.slots)issue('slots','Configure casting and a complete ten-column slots table together. Use null for an unavailable spell level.');
  if(row.spellsKnown&&!d.casting)issue('spellsKnown','Spells known requires an explicit casting table.');
  if(d.levels.some(r=>r.spellsKnown)&&!row.spellsKnown)issue('spellsKnown','Supply spells-known allowances for every class level, or omit the whole allowance table.');
  if(d.casting&&row.level<d.casting.startLevel&&(row.slots?.some(n=>n!==null)||row.spellsKnown?.some(n=>n>0)))issue('slots','Before casting begins, all slots must be unavailable and spells-known allowances zero.');
  for(const key of ['powerPoints','powersKnown','powerLevel'] as const)if(!!d.manifesting!==(row[key]!==undefined))issue(key,'Configure manifesting and complete power-point, powers-known and maximum-power-level tables together.');
  if(d.manifesting&&row.level<d.manifesting.startLevel&&[row.powerPoints,row.powersKnown,row.powerLevel].some(n=>n!==0))issue('powerPoints','Before manifesting begins, power points, powers known and maximum power level must be zero.');
  if(d.manifesting&&row.level>=d.manifesting.startLevel&&row.level+d.manifesting.levelOffset>100)issue('powerLevel','The configured manifester level exceeds the supported maximum of 100; use a supported formula rather than a capped approximation.');
  if(row.level!==index+1)ctx.addIssue({code:'custom',path:['definition','levels',index,'level'],message:'Supply consecutive class levels beginning at 1.'});
  for(const stat of ['bab','fort','ref','will'] as const){
   const rate=policy.bonusProfile[stat];
   const expected=stat==='bab'?Math.floor(row.level*({full:1,medium:.75,poor:.5}[rate as 'full'|'medium'|'poor'])):rate==='good'?2+Math.floor(row.level/2):Math.floor(row.level/3);
   if(row[stat]!==expected)ctx.addIssue({code:'custom',path:['definition','levels',index,stat],message:'The table must match its declared '+stat+' progression; irregular progressions need a separate supported policy.'});
  }
 });
});
export const customClassesSchema=z.array(customClassSchema).max(30).superRefine((rows,ctx)=>{
 const seen=new Set<string>();
 rows.forEach((row,index)=>{if(seen.has(row.definition.id))ctx.addIssue({code:'custom',path:[index,'definition','id'],message:'Custom class IDs must be unique.'});seen.add(row.definition.id);});
});
export type CustomClass=z.infer<typeof customClassSchema>;
export function customResourceText(d:CustomClass['definition']){
 const cast=d.casting,psi=d.manifesting;
 return [cast?`${cast.type} ${cast.mode} casting from class level ${cast.startLevel}; ${cast.halfLevel?'half':'full'} caster level; ${cast.ability} eligibility, ${cast.bonusAbility??'tradition ability'} bonus slots, ${cast.dcAbility??'tradition ability'} save DCs; list: ${cast.list}.`:'No automatic spellcasting table.',
  psi?`Manifesting from class level ${psi.startLevel}; ${psi.ability}; manifester level equals progression ${psi.levelOffset<0?'−':'+'} ${Math.abs(psi.levelOffset)}; ${psi.bonusPoints} fixed additional power points.`:'No automatic manifesting table.'].join(' ');
}
