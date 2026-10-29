import {z} from 'zod';

const text=z.string().max(2000);
const id=z.string().trim().min(1).max(80);
const count=z.number().int().min(0).max(100);
const profile=z.object({bab:z.enum(['full','medium','poor']),fort:z.enum(['good','poor']),ref:z.enum(['good','poor']),will:z.enum(['good','poor'])}).strict();
/** Explicit basic progression only. Unknown fields fail rather than losing casting data. */
export const customClassSchema=z.object({
 version:z.literal(1),
 definition:z.object({
  id:id.regex(/^custom-[a-z0-9-]+$/,'Use a distinct custom- class ID.'),name:z.string().trim().min(1).max(200),
  kind:z.enum(['Core','Supplemental','Prestige']),hitDie:z.union([z.literal(4),z.literal(6),z.literal(8),z.literal(10),z.literal(12)]),
  skillPoints:count,skills:text,alignment:text,requirements:text,headers:z.array(z.string().max(200)).max(30),
  levels:z.array(z.object({level:z.number().int().min(1).max(100),bab:count,fort:count,ref:count,will:count,special:text,extra:z.array(text).max(30)}).strict()).min(1).max(100),
  source:z.string().trim().min(1).max(500),description:z.string().max(12000).optional(),book:z.string().max(200).optional(),
 }).strict(),
 policy:z.object({family:id,combinationPrestige:z.boolean(),bonusProfile:profile}).strict(),
}).strict().superRefine(({definition:d,policy},ctx)=>{
 if(policy.combinationPrestige&&d.kind!=='Prestige')ctx.addIssue({code:'custom',path:['policy','combinationPrestige'],message:'Only prestige classes can require combination-class approval.'});
 d.levels.forEach((row,index)=>{
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
