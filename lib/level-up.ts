import {prestigeEligibility} from './prerequisites.ts';
import {uid,characterSchema,type Character} from './model.ts';
import {classCatalog,classTotals,classHitDie,findClass,copyClassFeatures,makeCaster,makePsionic,castingAbility,manifestingAbility,type ClassDefinition} from './classes.ts';
import {advancementNumbers} from './advancement.ts';
import {effectiveScore} from './ancestry.ts';
import {skillIntelligence} from './level-history.ts';
import {characterGestaltRows,gestaltBonusLedger,type GestaltProgression} from './gestalt-progression.ts';
import {recompute} from './automation.ts';
import {advancementChoices} from './advancement-choices.ts';
import {effectiveClassMilestone} from './alternate-features.ts';
import {resolveGestaltCastingTargets,retainGestaltCastingHistory} from './gestalt-casting.ts';
import type {GestaltCastingTarget} from './gestalt-schema.ts';
export function levelUpStatus(c:Character){
 const n=advancementNumbers(c);let eligible=n.ecl;
 while(eligible<100&&c.experience>=eligible*(eligible+1)*500)eligible++;
 return {...n,eligible,available:Math.max(0,eligible-n.ecl)};
}
export function levelUpClasses(c:Character,showAll=false){return classCatalog.filter(d=>{
 const level=c.classLevels.filter(e=>e.classId===d.id).reduce((n,e)=>n+e.level,0);
 return d.levels.some(r=>r.level===level+1)&&(showAll||level>0||prestigeEligibility(c,d).eligible);
}).map(d=>({...d,hitDie:classHitDie(c,d.id)}));}
export function gainLevel(c:Character,classId:string,hitDieRoll?:number){
 if(c.advancementMode==='gestalt')throw new Error('Choose a pair of classes to advance a gestalt character.');
 if(c.sheetKind==='monster')throw new Error('Advance monster Hit Dice and class levels manually.');
 if(!c.automation.enabled)throw new Error('Enable automatic calculations before using guided level-up.');
 if(!c.classLevels.length||classTotals(c.classLevels,c.ancestry,c).missing.length)throw new Error('Record supported class levels before using guided level-up.');
 if(levelUpStatus(c).available<1)throw new Error('Not enough XP for another level.');
 const def=findClass(classId);if(def?.kind==='Prestige'&&!c.classLevels.some(e=>e.classId===classId)&&!prestigeEligibility(c,def).eligible)throw new Error('Prestige prerequisites are not met.');if(!def||!levelUpClasses(c).some(d=>d.id===classId))throw new Error('No further supported levels in this class.');
 if(c.automation.hpMethod==='rolled'&&(!Number.isInteger(hitDieRoll)||hitDieRoll!<1||hitDieRoll!>classHitDie(c,def.id)))throw new Error('Record a valid roll for the new Hit Die.');
 let entry=c.classLevels.find(e=>e.classId===classId);
 if(entry)entry.level++;else{entry={id:uid(),classId:def.id,name:def.name,level:1,notes:''};c.classLevels.push(entry);}
 if(c.automation.hpMethod==='rolled')c.automation.history.push({key:entry.id+'-'+entry.level,intScore:skillIntelligence(c),skillRanks:{},skillClassOverrides:{},hitDieRoll});
 initializeClassResources(c,def,entry.level);
 copyClassFeatures(c);
}

export function initializeClassResources(c:Character,def:ClassDefinition,level:number){
 if(def.levels.some(r=>r.slots)&&(!['paladin','ranger'].includes(def.id)||level>=4)&&!c.casters.some(p=>p.casting?.classId===def.id||p.name===def.name)){
  const ability=castingAbility(def);c.casters.push(makeCaster(def,level,effectiveScore(c,ability),effectiveScore(c,def.casting?.bonusAbility||ability)));
 }
 if((def.kind==='Psionic'||def.manifesting)&&!c.psionics.some(p=>p.manifesting?.classId===def.id||p.name===def.name))c.psionics.push(makePsionic(def,level,effectiveScore(c,manifestingAbility(def))));
}

export type GestaltLevelSelection={left:string;right:string;hitDieRoll?:number;approvals?:GestaltProgression['levels'][number]['approvals'];castingTargets?:GestaltCastingTarget[]};
export type GestaltLevelPreview=ReturnType<typeof previewGestaltLevel>;

/** Read-only, atomic preview. Both new classes must qualify BEFORE this level. */
function buildGestaltLevelPreview(c:Character,selection:GestaltLevelSelection){
 if(c.advancementMode!=='gestalt')throw new Error('Paired advancement requires an existing gestalt character.');
 if(!c.automation.enabled)throw new Error('Enable automatic calculations before using guided level-up.');
 characterGestaltRows(c);
 if(levelUpStatus(c).available<1)throw new Error('Not enough XP for another level.');
 // Do not let the first side supply BAB, spells, feats or ranks needed to enter
 // the other side. Existing prestige entries retain ordinary continuation rules.
 const definitions=[selection.left,selection.right].map(id=>{
  const def=findClass(id),entry=c.classLevels.find(e=>e.classId===id);
  if(!def||def.id!==id||!def.levels.some(row=>row.level===(entry?.level??0)+1))throw new Error('No further supported levels in this class.');
  if(def.kind==='Prestige'&&!entry&&!prestigeEligibility(c,def).eligible)throw new Error(def.name+' prerequisites must be met before gaining this level.');
  return def;
 });
 const next=structuredClone(c),entries=definitions.map(def=>{
  let entry=next.classLevels.find(e=>e.classId===def.id);
  if(entry)entry.level++;else{entry={id:uid(),classId:def.id,name:def.name,level:1,notes:''};next.classLevels.push(entry);}
  return entry;
 });
 retainGestaltCastingHistory(c,next);
 const castingTargets=resolveGestaltCastingTargets(c,[selection.left,selection.right],selection.castingTargets);
 const pair={id:uid(),left:entries[0].id,right:entries[1].id,approvals:structuredClone(selection.approvals??[]),...(castingTargets.length?{castingTargets}:{})};
 next.gestaltProgression!.levels.push(pair);
 // Same-class/family, two-prestige and scoped combination approvals all use
 // the authoritative compiler, before resources or history are initialized.
 const rows=characterGestaltRows(next)!,row=rows.at(-1)!;
 if(next.automation.hpMethod==='rolled'&&(!Number.isInteger(selection.hitDieRoll)||selection.hitDieRoll!<1||selection.hitDieRoll!>row.die))throw new Error('Record a valid roll for the new Hit Die.');
 next.automation.history.push({key:row.key,intScore:skillIntelligence(c),skillRanks:{},skillClassOverrides:{},
  ...(next.automation.hpMethod==='rolled'?{hitDieRoll:selection.hitDieRoll}:{}),});
 definitions.forEach((def,i)=>initializeClassResources(next,def,entries[i].level));
 copyClassFeatures(next);
 // Keep the uncalculated edit recipe too: the sheet's existing edit boundary
 // recomputes once. Installing already-adjusted HP there would heal twice.
 const pending=structuredClone(next);
 recompute(next,c);characterSchema.parse(next);
 const before=advancementNumbers(c),after=advancementNumbers(next),oldChoices=new Set(advancementChoices(c).map(choice=>choice.key));
 return {pending,source:JSON.stringify(c),selection:structuredClone(selection),selectionKey:JSON.stringify(selection),character:next,summary:{
  level:next.level,label:row.label,die:row.die,hpGain:next.maxHp-c.maxHp,skillPoints:after.skillBudget-before.skillBudget,castingTargets,
  bab:{before:c.bab,after:next.bab},saves:{before:{fort:c.saves.fort.base,ref:c.saves.ref.base,will:c.saves.will.base},after:{fort:next.saves.fort.base,ref:next.saves.ref.base,will:next.saves.will.base}},
  bonusDecision:gestaltBonusLedger(rows).at(-1)!,choices:advancementChoices(next).filter(choice=>!oldChoices.has(choice.key)),
  milestones:definitions.map((def,i)=>({classId:def.id,name:def.name,level:entries[i].level,text:effectiveClassMilestone(next,def.id,def.levels.find(r=>r.level===entries[i].level)!.special,entries[i].level)})),
  casting:next.casters.map(p=>({id:p.id,name:p.name,level:p.level,slots:p.slots.map(s=>s.max)})),
  psionics:next.psionics.map(p=>({id:p.id,name:p.name,level:p.level,points:p.max})),
 }};
}

export function previewGestaltLevel(c:Character,selection:GestaltLevelSelection){
 const {pending,...preview}=buildGestaltLevelPreview(c,selection);
 return preview;
}

/** Like gainLevel, apply an edit recipe; the caller's existing edit boundary recomputes once. */
export function applyGestaltLevel(c:Character,preview:GestaltLevelPreview){
 if(JSON.stringify(c)!==preview.source)throw new Error('The character changed. Review the paired level again before confirming.');
 if(JSON.stringify(preview.selection)!==preview.selectionKey)throw new Error('The class choices changed. Review the paired level again before confirming.');
 const checked=buildGestaltLevelPreview(c,preview.selection);
 Object.assign(c,checked.pending);
}
