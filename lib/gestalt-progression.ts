import {gestaltBonusMethodSchema,gestaltProgressionSchema,type GestaltBonusMethod,type GestaltProgression} from './gestalt-schema.ts';
export {gestaltBonusMethodSchema,gestaltProgressionSchema,type GestaltBonusMethod,type GestaltProgression} from './gestalt-schema.ts';
import type {Character,ClassLevel} from './model.ts';
import {classCatalog,classHitDie,classSkillPoints,type ClassDefinition} from './classes.ts';
import {hasAlternateFeature} from './alternate-features.ts';
import {gestaltVariantPairProblem} from './gestalt-class-families.ts';
import type {LevelRow} from './level-history.ts';

/** Extension point for source-specific class families and combination prestige rules. */
export type GestaltBonusProfile={bab:'full'|'medium'|'poor';fort:'good'|'poor';ref:'good'|'poor';will:'good'|'poor'};
export type GestaltClassPolicy={family?:string;combinationPrestige?:boolean;bonusProfile?:GestaltBonusProfile};
export const gestaltClassPolicies:Readonly<Record<string,GestaltClassPolicy>>={
 'arcane-trickster':{combinationPrestige:true},
 'eldritch-knight':{combinationPrestige:true},
 'mystic-theurge':{combinationPrestige:true},
 'cerebremancer':{combinationPrestige:true},
};
export type GestaltOptions={definitions?:readonly ClassDefinition[];policies?:Readonly<Record<string,GestaltClassPolicy>>;allowHistoricalFamilyConflicts?:boolean};
export type BaseProgression={bab:number;fort:number;ref:number;will:number};
const baseStats=['bab','fort','ref','will'] as const;
const rateUnits={full:12,medium:9,poor:6,good:6} as const;
export type GestaltClassAdvance={entryId:string;classId:string;classLevel:number;name:string;base:BaseProgression;previous:BaseProgression;rates:BaseProgression};
export type GestaltLevelRow=LevelRow & {
 left:GestaltClassAdvance;right:GestaltClassAdvance;bonusMethod:GestaltBonusMethod;
 castingTargets?:GestaltProgression['levels'][number]['castingTargets'];
};

/** Return null only for explicitly standard/legacy sheets, never for a broken gestalt plan. */
export function characterGestaltRows(c:Character):GestaltLevelRow[]|null{
 if(c.advancementMode!=='gestalt')return null;
 if(!c.gestaltProgression)throw new Error('Gestalt advancement requires a recorded pair for every level.');
 // Preserve existing sheets made before catalog variants were classified. New
 // creation and level-up validate each proposed pair before adding it. The sheet
 // prominently reports historical conflicts; loading never removes a class.
 return gestaltLevelSequence(c,c.gestaltProgression,{allowHistoricalFamilyConflicts:true});
}

/** Full effective-class-level advancement: overlapping eligible sides count once. */
export function gestaltSharedLevelCount(c:Character,eligible:(side:GestaltClassAdvance)=>boolean):number|null{
 const rows=characterGestaltRows(c);
 return rows?rows.reduce((total,row)=>total+Number([row.left,row.right].some(eligible)),0):null;
}

export type GestaltFeatureProgression={rate:number|((level:number)=>number);cumulative:(level:number)=>number};
/**
 * Discrete shared features use their faster underlying progression, not the
 * larger rounded grant this level. Equal rates retain the previous class, then
 * prefer higher class level and stable ID, as with the printed bonus policy.
 * No fractional dice/uses are invented. Callers supply only currently active
 * sources of the SAME feature; distinct abilities must remain separate.
 */
export function gestaltFeatureLedger(c:Character,policies:Readonly<Record<string,GestaltFeatureProgression>>){
 const rows=characterGestaltRows(c);if(!rows)return null;
 let previous='',total=0;
 return rows.map(row=>{
  const candidates=[row.left,row.right].flatMap(side=>{
   const policy=policies[side.classId];if(!policy)return [];
   const current=policy.cumulative(side.classLevel),before=side.classLevel>1?policy.cumulative(side.classLevel-1):0;
   const rate=typeof policy.rate==='function'?policy.rate(side.classLevel):policy.rate;
   if(!Number.isFinite(rate)||rate<0||![current,before].every(n=>Number.isInteger(n)&&n>=0)||current<before)
    throw new Error('A shared feature needs an explicit nonnegative progression policy.');
   return current>0?[{...side,rate,grant:current-before}]:[];
  }).sort((a,b)=>b.rate-a.rate||Number(b.classId===previous)-Number(a.classId===previous)
   ||b.classLevel-a.classLevel||(a.classId<b.classId?-1:a.classId>b.classId?1:0));
  const selected=candidates[0];total+=selected?.grant??0;previous=selected?.classId??'';
  return {key:row.key,classId:selected?.classId??null,classLevel:selected?.classLevel??0,grant:selected?.grant??0,total};
 });
}

/** Overlapping advancement of the SAME tradition grants at most the better side per pair. */
export function gestaltTraditionGrants(c:Character,grant:(entry:ClassLevel,level:number,row:GestaltLevelRow)=>number):number[]|null{
 const rows=characterGestaltRows(c);if(!rows)return null;
 const entries=new Map(c.classLevels.map(entry=>[entry.id,entry]));
 return rows.map(row=>Math.max(...[row.left,row.right].map(side=>{
  const entry=entries.get(side.entryId)!;
  const value=grant(entry,side.classLevel,row)-(side.classLevel>1?grant(entry,side.classLevel-1,row):0);
  if(!Number.isFinite(value)||value<0)throw new Error('A casting progression needs an explicit nonnegative advancement policy.');
  return value;
 })));
}

/** Infer only exact standard progressions. Short/ambiguous custom tables need metadata. */
function bonusRates(def:ClassDefinition,policy:GestaltClassPolicy,golarion:boolean):BaseProgression{
 const rates={} as BaseProgression;
 for(const stat of baseStats){
  const names=stat==='bab'?['full','medium','poor'] as const:['good','poor'] as const;
  const units=(name:typeof names[number])=>stat!=='bab'&&name==='poor'?4:rateUnits[name];
  const matches=(name:typeof names[number])=>def.levels.every(row=>{
   const actual=stat==='bab'&&golarion?row.level:row[stat];
   return actual===Math.floor(row.level*units(name)/12)+(stat!=='bab'&&name==='good'?2:0);
  });
  const explicit=policy.bonusProfile?.[stat];
  const candidates=names.filter(name=>(!explicit||name===explicit)&&matches(name));
  if(candidates.length!==1)throw new Error(def.name+' needs an explicit progression policy matching its '+stat+' table.');
  rates[stat]=units(candidates[0]);
 }
 return rates;
}

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
 for(const d of [...(c.customClasses??[]).map(row=>row.definition),...options.definitions??[]]){
  if(definitions.has(d.id))throw new Error('A custom class cannot silently replace a catalog class.');
  definitions.set(d.id,d);
 }
 const policies:Record<string,GestaltClassPolicy>={...gestaltClassPolicies};
 if((c.customClasses??[]).some(row=>options.policies?.[row.definition.id]))throw new Error('Temporary policies cannot replace a saved custom class policy.');
 for(const [classId,policy] of [...(c.customClasses??[]).map(row=>[row.definition.id,row.policy] as const),...Object.entries(options.policies??{})])policies[classId]={...policies[classId],...policy,
  // Adding custom metadata must not remove a catalog restriction or bypass GM approval.
  combinationPrestige:!!(policies[classId]?.combinationPrestige||policy.combinationPrestige)};
 const ratesByClass=new Map<string,BaseProgression>();
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
  for(const target of pair.castingTargets??[])if(!sides.some(s=>s.def.id===target.classId))throw new Error('Prestige casting target does not belong to either class at this paired level.');
  if((left.policy.family??left.def.id)===(right.policy.family??right.def.id))throw new Error('A gestalt level cannot combine versions of the same class.');
  const variantProblem=gestaltVariantPairProblem(left.def.id,right.def.id);
  if(variantProblem&&!options.allowHistoricalFamilyConflicts)throw new Error(variantProblem);
  if(sides.every(s=>s.def.kind==='Prestige'))throw new Error('A gestalt level cannot combine two prestige classes.');
  for(const a of pair.approvals)if(!sides.some(s=>s.def.id===a.classId&&s.def.kind==='Prestige'&&s.policy.combinationPrestige))throw new Error('Combination-class approval does not match this level.');
  for(const s of sides)if(s.def.kind==='Prestige'&&s.policy.combinationPrestige&&!pair.approvals.some(a=>a.classId===s.def.id))throw new Error(s.def.name+' requires a named GM approval and reason for gestalt.');
  const advance=(s:typeof left):GestaltClassAdvance=>{
   const base:BaseProgression={bab:s.table.bab,fort:s.table.fort,ref:s.table.ref,will:s.table.will};
   const previous:BaseProgression={bab:s.previous?.bab??0,fort:s.previous?.fort??0,ref:s.previous?.ref??0,will:s.previous?.will??0};
   const golarion=s.def.id==='cleric'&&hasAlternateFeature(c,'cleric-golarion-cleric');
   if(golarion){base.bab=s.level;previous.bab=s.level-1;}
   for(const stat of baseStats){
    const value=base[stat],delta=value-previous[stat];
    if(!Number.isInteger(value)||value<0||stat==='bab'&&value>s.level||delta<0)throw new Error(s.def.name+' needs an explicit progression policy for its '+stat+' table.');
   }
   let rates=ratesByClass.get(s.def.id);
   if(!rates){rates=bonusRates(s.def,s.policy,golarion);ratesByClass.set(s.def.id,rates);}
   return {entryId:s.entry.id,classId:s.def.id,classLevel:s.level,name:s.entry.name,base,previous,rates};
  };
  const dice=sides.map(s=>classCatalog.some(d=>d.id===s.def.id)?classHitDie(c,s.def.id):s.def.hitDie);
  const skillBases=sides.map(s=>classSkillPoints(c,s.def.id,s.def));
  if(dice.some(n=>![4,6,8,10,12].includes(n))||skillBases.some(n=>!Number.isInteger(n)||n<0||n>100))throw new Error('Provide valid Hit Dice and skill grants for each class.');
  rows.push({key:'gestalt-'+pair.id,label:left.entry.name+' '+left.level+' // '+right.entry.name+' '+right.level,
   entryId:'gestalt-'+pair.id,classId:'gestalt',classLevel:index+1,classIds:[left.def.id,right.def.id],
   left:advance(left),right:advance(right),bonusMethod:plan.bonusMethod,...(pair.castingTargets?{castingTargets:pair.castingTargets}:{}),die:Math.max(...dice),skillBase:Math.max(...skillBases)});
  for(const s of sides)counts.set(s.entry.id,s.level);
 }
 for(const entry of entries.values())if(counts.get(entry.id)!==entry.level)throw new Error('Paired levels do not match the recorded level of '+entry.name+'.');
 return rows;
}

export type GestaltBonusContribution={classId:string;classLevel:number;units:number;tableDelta:number;total:number};
/**
 * Compare progression rates BEFORE rounding. Ties keep the preceding selected
 * class, then prefer the higher class level, then stable class ID. Left/right,
 * display names and entry UUIDs never change the result. See the policy document.
 * All arithmetic uses twelfths so fractional thirds cannot round down spuriously.
 */
export function gestaltBonusLedger(rows:readonly GestaltLevelRow[]){
 if(!rows.length)throw new Error('Record at least one paired level.');
 const method=gestaltBonusMethodSchema.parse(rows[0].bonusMethod);
 if(rows.some(row=>row.bonusMethod!==method))throw new Error('All paired levels must use the same bonus method.');
 const previous:Partial<Record<keyof BaseProgression,string>>={},totals:BaseProgression={bab:0,fort:0,ref:0,will:0};
 return rows.map(row=>{
  const bonuses={} as Record<keyof BaseProgression,GestaltBonusContribution>;
  for(const stat of baseStats){
   const sides=[row.left,row.right].sort((a,b)=>b.rates[stat]-a.rates[stat]
    ||Number(b.classId===previous[stat])-Number(a.classId===previous[stat])
    ||b.classLevel-a.classLevel||(a.classId<b.classId?-1:a.classId>b.classId?1:0));
   const selected=sides[0],tableDelta=selected.base[stat]-selected.previous[stat];
   const units=method==='printed-table-v1'?tableDelta*12:selected.rates[stat]+(stat!=='bab'&&selected.rates[stat]===6&&selected.classLevel===1?24:0);
   totals[stat]+=units;previous[stat]=selected.classId;
   bonuses[stat]={classId:selected.classId,classLevel:selected.classLevel,tableDelta,units,total:Math.floor(totals[stat]/12)};
  }
  return {key:row.key,bonuses};
 });
}

export function gestaltBaseTotals(rows:readonly GestaltLevelRow[]){
 const ledger=gestaltBonusLedger(rows);
 const dice=new Map<number,number>();
 const totals={level:rows.length,bab:0,fort:0,ref:0,will:0,hitDice:''};
 for(const row of rows) dice.set(row.die,(dice.get(row.die)??0)+1);
 const last=ledger[ledger.length-1];
 for(const stat of baseStats)totals[stat]=last.bonuses[stat].total;
 totals.hitDice=[...dice].sort(([a],[b])=>a-b).map(([die,count])=>count+'d'+die).join(' + ');
 return totals;
}
