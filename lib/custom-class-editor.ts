import {customClassSchema,customProficiencyText,type CustomClass} from './custom-class-schema.ts';
import {characterSchema,uid,type Character} from './model.ts';
import {findClass} from './classes.ts';
import {recompute} from './automation.ts';
import {hitDieSequence} from './level-history.ts';
import {skillLedger} from './skill-points.ts';
import {gestaltVariantPairProblem} from './gestalt-class-families.ts';
import {weaponProficient,armorProficient,gearEquipment} from './equipment.ts';
import {assertCustomResourceTables,castingNumbers,castingDefinition,manifestDefinition,psionicProgression} from './advancement.ts';
import {initializeClassResources} from './level-up.ts';
import {retainCastingHistory} from './gestalt-casting.ts';

/** Build only standard rate tables chosen by the player; never infer a source class. */
export function customClassTable(draft:CustomClass,length:number):CustomClass{
 if(!Number.isInteger(length)||length<1||length>100)throw new Error('Choose 1 to 100 supported class levels.');
 if(draft.definition.levels.slice(length).some(row=>row.special.trim()||row.extra.some(text=>text.trim())||row.slots||row.spellsKnown||row.powerPoints!==undefined))throw new Error('Shortening this table would remove recorded milestones, resource tables or extra text. Keep those rows.');
 const next=structuredClone(draft),p=next.policy.bonusProfile;
 next.definition.levels=Array.from({length},(_,index)=>{
  const level=index+1,old=draft.definition.levels.find(row=>row.level===level);
  const save=(kind:'good'|'poor')=>kind==='good'?2+Math.floor(level/2):Math.floor(level/3);
  return {...(old?structuredClone(old):{
   ...(draft.definition.casting?{slots:Array(10).fill(null)}:{}),
   ...(draft.definition.levels.some(r=>r.spellsKnown)?{spellsKnown:Array(10).fill(0)}:{}),
   ...(draft.definition.manifesting?{powerPoints:0,powersKnown:0,powerLevel:0}:{}),
  }),level,bab:Math.floor(level*({full:1,medium:.75,poor:.5}[p.bab])),fort:save(p.fort),ref:save(p.ref),will:save(p.will),special:old?.special??'',extra:[...(old?.extra??[])]};
 });
 return next;
}

export function customClassDraft(c:Character,classId=''):CustomClass{
 const existing=c.customClasses?.find(row=>row.definition.id===classId);
 if(existing)return structuredClone(existing);
 const entry=c.classLevels.find(row=>row.classId===classId);
 if(classId&&(!entry||!/^custom-[a-z0-9-]+$/.test(classId)||findClass(classId)))throw new Error('Choose an existing custom class or create a new profile.');
 const id=classId||'custom-'+uid();
 return customClassTable({version:1,definition:{id,name:entry?.name??'',kind:'Supplemental',hitDie:8,skillPoints:2,skills:'',alignment:'',requirements:'',headers:[],levels:[],source:''},policy:{family:id,combinationPrestige:false,bonusProfile:{bab:'medium',fort:'poor',ref:'poor',will:'poor'}}},Math.max(20,entry?.level??1));
}

const summary=(c:Character)=>({level:c.level,hp:c.hp,maxHp:c.maxHp,bab:c.bab,fort:c.saves.fort.base,ref:c.saves.ref.base,will:c.saves.will.base,skills:skillLedger(c).granted});
function trainingChanges(before:Character,after:Character){
 const items=before.weapons.map(w=>({id:'weapon:'+w.id,name:w.name,before:weaponProficient(before,w),after:weaponProficient(after,w)}));
 for(const g of before.gear){const e=gearEquipment(g);if(e&&e.kind!=='weapon')items.push({id:'gear:'+g.id,name:g.name,before:g.proficient??armorProficient(before,e),after:g.proficient??armorProficient(after,e)});}
 return items.filter(item=>item.before!==item.after);
}

function resourceChanges(before:Character,after:Character){
 const snapshot=(c:Character)=>[
  ...c.casters.map(p=>({id:p.id,name:p.name,kind:'Spellcasting',level:p.level,capacity:p.slots.map(s=>s.max).join(' / '),automatic:!!p.casting?.automatic,supported:!!castingDefinition(p,c),allowance:castingNumbers(c,p).known?.join(' / ')??'Follow source spellbook/list rules'})),
  ...c.psionics.map(p=>{const d=manifestDefinition(p,c),row=d?.levels.find(r=>r.level===psionicProgression(c,p).progression);return {id:p.id,name:p.name,kind:'Manifesting',level:p.level,capacity:String(p.max),automatic:!!p.manifesting?.automatic,supported:!!d,allowance:row?`${row.powersKnown??'Source-defined'} powers; maximum power level ${row.powerLevel??'source-defined'}`:'Follow source power rules'};}),
 ];
 const old=snapshot(before);
 return snapshot(after).flatMap(p=>{const previous=old.find(q=>q.id===p.id);return JSON.stringify(previous)===JSON.stringify(p)?[]:[{before:previous,after:p}];});
}

function buildCustomClassChange(c:Character,targetId:string,input:CustomClass){
 if(c.sheetKind==='monster')throw new Error('Custom player-class tables are not monster Hit Dice.');
 const profile=customClassSchema.parse(input);
 if(profile.definition.id!==targetId)throw new Error('A profile edit cannot change its class identity.');
 const next=structuredClone(c),profiles=next.customClasses??[],index=profiles.findIndex(row=>row.definition.id===targetId);
 if(index<0)profiles.push(profile);else profiles[index]=profile;
 next.customClasses=profiles;
 // Saving a reviewed table is not permission to introduce a same-family pair.
 // Unrelated historical conflicts remain readable under the existing policy.
 if(next.advancementMode==='gestalt')for(const pair of next.gestaltProgression?.levels??[]){
  const left=next.classLevels.find(e=>e.id===pair.left)?.classId,right=next.classLevels.find(e=>e.id===pair.right)?.classId;
  if(left&&right&&(left===targetId||right===targetId)){
   const problem=gestaltVariantPairProblem(left,right,next.customClasses);
   if(problem)throw new Error(problem);
  }
 }
 const used=Math.max(0,...c.classLevels.filter(entry=>entry.classId===targetId).map(entry=>entry.level));
 if(profile.definition.levels.length<used)throw new Error('Keep a table row for every class level already earned.');
 // Newly configured resources join the existing interface. Explicit manual
 // pools are never adopted by label or switched to automatic progression.
 if(c.automation.enabled)for(const entry of next.classLevels.filter(e=>e.classId===targetId))initializeClassResources(next,profile.definition,entry.level);
 const previousDefinition=c.customClasses?.find(p=>p.definition.id===targetId)?.definition;
 const changedLink=c.casters.some(p=>p.casting?.classId===targetId)&&JSON.stringify(previousDefinition?.casting)!==JSON.stringify(profile.definition.casting)
  ||c.psionics.some(p=>p.manifesting?.classId===targetId)&&JSON.stringify(previousDefinition?.manifesting)!==JSON.stringify(profile.definition.manifesting);
 if(next.casters.length!==c.casters.length||next.psionics.length!==c.psionics.length||changedLink)retainCastingHistory(c,next);
 characterSchema.parse(next);
 // Never clamp or invent a previously recorded die when changing its class table.
 if(c.automation.enabled&&c.automation.hpMethod==='rolled')for(const [i,row]of hitDieSequence(next).entries()){
  if(!(row.classIds??[row.classId]).includes(targetId))continue;
  const rolled=c.automation.history.find(h=>h.key===row.key)?.hitDieRoll??c.automation.hpRolls[i];
  if(i>0&&rolled===undefined)throw new Error('Record the existing HP roll for '+row.label+' before applying this table.');
  if(rolled!==undefined&&(!Number.isInteger(rolled)||rolled<1||rolled>row.die))throw new Error('The recorded HP roll for '+row.label+' does not fit the proposed Hit Die. No roll was changed.');
 }
 assertCustomResourceTables(next);
 const pending=structuredClone(next);
 recompute(next,c);characterSchema.parse(next);
 // These are source-table edits, not migrations or feature-card replacement.
 for(const history of c.automation.history){const after=next.automation.history.find(h=>h.key===history.key);if(JSON.stringify(after)!==JSON.stringify(history))throw new Error('This edit would change recorded level history. Review that history separately first.');}
 for(const skill of c.skills)if(next.skills.find(s=>s.id===skill.id)?.ranks!==skill.ranks)throw new Error('This edit would change purchased skill ranks. Review skill training separately first.');
 for(const feature of c.features){const after=next.features.find(f=>f.id===feature.id);if(!after||after.used!==feature.used||after.description!==feature.description)throw new Error('This edit would rewrite a recorded feature or its expenditure. Review feature records separately first.');}
 for(const p of c.casters){
  const after=next.casters.find(q=>q.id===p.id);
  if(!after||JSON.stringify({...after,level:p.level,slots:after.slots.map((s,i)=>({...s,max:p.slots[i].max}))})!==JSON.stringify(p))throw new Error('This edit would rewrite a spellbook, preparation or spent slot. Review the tradition separately first.');
 }
 for(const p of c.psionics){const after=next.psionics.find(q=>q.id===p.id);if(!after||JSON.stringify({...after,level:p.level,max:p.max})!==JSON.stringify(p))throw new Error('This edit would rewrite a power, note or spent point. Review the tradition separately first.');}
 const ledger=skillLedger(next);
 return {pending,source:JSON.stringify(c),targetId,profile,profileKey:JSON.stringify(profile),character:next,summary:{before:summary(c),after:summary(next),used,manual:!c.automation.enabled,resources:resourceChanges(c,next),overspent:ledger.levels.filter(row=>row.spent>row.granted).map(row=>row.label),proficiencies:{before:customProficiencyText(c.customClasses?.find(p=>p.definition.id===targetId)?.definition.proficiencies),after:customProficiencyText(profile.definition.proficiencies),items:trainingChanges(c,next)}}};
}

export function previewCustomClassChange(c:Character,targetId:string,input:CustomClass){const {pending,...preview}=buildCustomClassChange(c,targetId,input);return preview;}
export type CustomClassPreview=ReturnType<typeof previewCustomClassChange>;
/** Apply an uncalculated recipe: the normal sheet boundary recomputes exactly once. */
export function applyCustomClassChange(c:Character,preview:CustomClassPreview){
 if(JSON.stringify(c)!==preview.source)throw new Error('The character changed. Review the custom table again.');
 if(JSON.stringify(preview.profile)!==preview.profileKey)throw new Error('The table changed. Review it again before applying.');
 const checked=buildCustomClassChange(c,preview.targetId,preview.profile);
 Object.assign(c,checked.pending);
}
