import {z} from 'zod';
import type {Character,ClassLevel} from './model.ts';
import {classCatalog,classHitDie,classSkillPoints,type ClassDefinition} from './classes.ts';
import {hasAlternateFeature} from './alternate-features.ts';
import type {LevelRow} from './level-history.ts';

const id=z.string().trim().min(1).max(80);
const approval=z.object({classId:id,gm:z.string().trim().min(1).max(160),reason:z.string().trim().min(1).max(2000)}).strict();
/** Explicit, versioned data only. Never infer a gestalt plan from old class totals. */
export const gestaltProgressionSchema=z.object({
 version:z.literal(1),
 // Compare whole progressions, never cherry-pick individual rounded increments.
 bonusMethod:z.literal('best-progression-v1'),
 levels:z.array(z.object({id,left:id,right:id,approvals:z.array(approval).max(2).default([])}).strict()).min(1).max(100),
}).strict().superRefine((plan,ctx)=>{
 const seen=new Set<string>();
 plan.levels.forEach((row,i)=>{
  if(seen.has(row.id))ctx.addIssue({code:'custom',path:['levels',i,'id'],message:'Gestalt level IDs must be unique.'});
  seen.add(row.id);
  if(row.left===row.right)ctx.addIssue({code:'custom',path:['levels',i],message:'Choose two different classes for a gestalt level.'});
  if(new Set(row.approvals.map(a=>a.classId)).size!==row.approvals.length)ctx.addIssue({code:'custom',path:['levels',i,'approvals'],message:'Record each combination-class approval once.'});
 });
});
export type GestaltProgression=z.infer<typeof gestaltProgressionSchema>;

/** Extension point for source-specific class families and combination prestige rules. */
export type GestaltClassPolicy={family?:string;combinationPrestige?:boolean};
export const gestaltClassPolicies:Readonly<Record<string,GestaltClassPolicy>>={
 'arcane-trickster':{combinationPrestige:true},
 'eldritch-knight':{combinationPrestige:true},
 'mystic-theurge':{combinationPrestige:true},
 'cerebremancer':{combinationPrestige:true},
};
export type GestaltOptions={definitions?:readonly ClassDefinition[];policies?:Readonly<Record<string,GestaltClassPolicy>>};
export type BaseProgression={bab:number;fort:number;ref:number;will:number};
export type GestaltClassAdvance={entryId:string;classId:string;classLevel:number;name:string;base:BaseProgression};
export type GestaltLevelRow=LevelRow & {
 left:GestaltClassAdvance;right:GestaltClassAdvance;
};

/**
 * Compile ordered pairs against existing class entries. Does not change the sheet,
 * initialize resources, validate historical prerequisites, or perform a conversion.
 * The integrated level-up transaction must check prerequisites BEFORE advancing.
 */
export function gestaltLevelSequence(c:Character,input:GestaltProgression,options:GestaltOptions={}):GestaltLevelRow[]{
 const plan=gestaltProgressionSchema.parse(input);
 if(c.sheetKind==='monster')throw new Error('Gestalt progression requires a class-based character sheet.');
 // UA does not specify how monster/RHD levels occupy the two class choices.
 // Do not invent an implicit monster-class progression or silently drop racial HD.
 if(c.ancestry.racialHitDice)throw new Error('Gestalt racial Hit Dice require an explicit supported progression policy.');
 const entries=new Map<string,ClassLevel>(),classIds=new Set<string>();
 for(const entry of c.classLevels){
  if(entries.has(entry.id)||classIds.has(entry.classId))throw new Error('Gestalt needs one unique entry per class.');
  if(!Number.isInteger(entry.level)||entry.level<1)throw new Error('Record a valid class level.');
  entries.set(entry.id,entry);classIds.add(entry.classId);
 }
 const definitions=new Map(classCatalog.map(d=>[d.id,d]));
 for(const d of options.definitions??[]){
  if(definitions.has(d.id))throw new Error('A custom class cannot silently replace a catalog class.');
  definitions.set(d.id,d);
 }
 const policies={...gestaltClassPolicies,...options.policies};
 const counts=new Map<string,number>();
 const rows:GestaltLevelRow[]=[];
 for(const [index,pair] of plan.levels.entries()){
  const resolve=(entryId:string)=>{
   const entry=entries.get(entryId);if(!entry)throw new Error('Gestalt level '+(index+1)+' references a missing class entry.');
   const def=definitions.get(entry.classId);if(!def)throw new Error('Provide an explicit class table for '+entry.name+'.');
   const level=(counts.get(entryId)??0)+1,table=def.levels.find(r=>r.level===level),previous=def.levels.find(r=>r.level===level-1);
   if(!table||level>1&&!previous)throw new Error(def.name+' has no complete table for level '+level+'.');
   return {entry,def,level,table,previous,policy:policies[def.id]??{}};
  };
  const left=resolve(pair.left),right=resolve(pair.right),sides=[left,right];
  if((left.policy.family??left.def.id)===(right.policy.family??right.def.id))throw new Error('A gestalt level cannot combine versions of the same class.');
  if(sides.every(s=>s.def.kind==='Prestige'))throw new Error('A gestalt level cannot combine two prestige classes.');
  for(const a of pair.approvals)if(!sides.some(s=>s.def.id===a.classId&&s.def.kind==='Prestige'&&s.policy.combinationPrestige))throw new Error('Combination-class approval does not match this level.');
  for(const s of sides)if(s.def.kind==='Prestige'&&s.policy.combinationPrestige&&!pair.approvals.some(a=>a.classId===s.def.id))throw new Error(s.def.name+' requires a named GM approval and reason for gestalt.');
  const advance=(s:typeof left):GestaltClassAdvance=>{
   const base:BaseProgression={bab:s.table.bab,fort:s.table.fort,ref:s.table.ref,will:s.table.will};
   if(s.def.id==='cleric'&&hasAlternateFeature(c,'cleric-golarion-cleric'))base.bab=s.level;
   for(const stat of ['bab','fort','ref','will'] as const){
    const value=base[stat],delta=value-(s.previous?.[stat]??0);
    if(!Number.isInteger(value)||value<0||stat==='bab'&&value>s.level||delta<0)throw new Error(s.def.name+' needs an explicit progression policy for its '+stat+' table.');
   }
   return {entryId:s.entry.id,classId:s.def.id,classLevel:s.level,name:s.entry.name,base};
  };
  const dice=sides.map(s=>classCatalog.some(d=>d.id===s.def.id)?classHitDie(c,s.def.id):s.def.hitDie);
  const skillBases=sides.map(s=>classSkillPoints(c,s.def.id,s.def));
  if(dice.some(n=>![4,6,8,10,12].includes(n))||skillBases.some(n=>!Number.isInteger(n)||n<0||n>100))throw new Error('Provide valid Hit Dice and skill grants for each class.');
  rows.push({key:'gestalt-'+pair.id,label:left.entry.name+' '+left.level+' // '+right.entry.name+' '+right.level,
   entryId:'gestalt-'+pair.id,classId:'gestalt',classLevel:index+1,classIds:[left.def.id,right.def.id],
   left:advance(left),right:advance(right),die:Math.max(...dice),skillBase:Math.max(...skillBases)});
  for(const s of sides)counts.set(s.entry.id,s.level);
 }
 for(const entry of entries.values())if(counts.get(entry.id)!==entry.level)throw new Error('Paired levels do not match the recorded level of '+entry.name+'.');
 return rows;
}

export function gestaltBaseTotals(rows:readonly GestaltLevelRow[]){
 if(!rows.length)throw new Error('Record at least one paired level.');
 const identities=rows[0]?[rows[0].left.classId,rows[0].right.classId].sort().join('//'):'';
 if(rows.some(row=>[row.left.classId,row.right.classId].sort().join('//')!==identities))throw new Error('Mixed-class gestalt bonuses require an explicit supported rounding policy.');
 const dice=new Map<number,number>();
 const totals={level:rows.length,bab:0,fort:0,ref:0,will:0,hitDice:''};
 for(const row of rows) dice.set(row.die,(dice.get(row.die)??0)+1);
 const last=rows[rows.length-1];
 for(const stat of ['bab','fort','ref','will'] as const)totals[stat]=Math.max(last.left.base[stat],last.right.base[stat]);
 totals.hitDice=[...dice].sort(([a],[b])=>a-b).map(([die,count])=>count+'d'+die).join(' + ');
 return totals;
}
