import {uid,type Character} from './model.ts';
import {classCatalog,classTotals,findClass,copyClassFeatures,makeCaster,makePsionic} from './classes.ts';
import {advancementNumbers} from './advancement.ts';
import {effectiveScore} from './ancestry.ts';
import {skillIntelligence} from './level-history.ts';
export function levelUpStatus(c:Character){
 const n=advancementNumbers(c);let eligible=n.ecl;
 while(eligible<100&&c.experience>=eligible*(eligible+1)*500)eligible++;
 return {...n,eligible,available:Math.max(0,eligible-n.ecl)};
}
export function levelUpClasses(c:Character){return classCatalog.filter(d=>{
 const level=c.classLevels.filter(e=>e.classId===d.id).reduce((n,e)=>n+e.level,0);
 return d.levels.some(r=>r.level===level+1);
});}
export function gainLevel(c:Character,classId:string,hitDieRoll?:number){
 if(!c.automation.enabled)throw new Error('Enable automatic calculations before using guided level-up.');
 if(!c.classLevels.length||classTotals(c.classLevels,c.ancestry).missing.length)throw new Error('Record supported class levels before using guided level-up.');
 if(levelUpStatus(c).available<1)throw new Error('Not enough XP for another level.');
 const def=findClass(classId);if(!def||!levelUpClasses(c).some(d=>d.id===classId))throw new Error('No further supported levels in this class.');
 if(c.automation.hpMethod==='rolled'&&(!Number.isInteger(hitDieRoll)||hitDieRoll!<1||hitDieRoll!>def.hitDie))throw new Error('Record a valid roll for the new Hit Die.');
 let entry=c.classLevels.find(e=>e.classId===classId);
 if(entry)entry.level++;else{entry={id:uid(),classId:def.id,name:def.name,level:1,notes:''};c.classLevels.push(entry);}
 if(c.automation.hpMethod==='rolled')c.automation.history.push({key:entry.id+'-'+entry.level,intScore:skillIntelligence(c),skillRanks:{},skillClassOverrides:{},hitDieRoll});
 if(def.levels.some(r=>r.slots)&&(!['paladin','ranger'].includes(def.id)||entry.level>=4)&&!c.casters.some(p=>p.casting?.classId===def.id||p.name===def.name)){
  const ability=['wizard','assassin'].includes(def.id)?'INT':['bard','sorcerer'].includes(def.id)?'CHA':'WIS';c.casters.push(makeCaster(def,entry.level,effectiveScore(c,ability)));
 }
 if(def.kind==='Psionic'&&!c.psionics.some(p=>p.manifesting?.classId===def.id||p.name===def.name))c.psionics.push(makePsionic(def,entry.level,effectiveScore(c,def.id==='psion'?'INT':def.id==='wilder'?'CHA':'WIS')));
 copyClassFeatures(c);
}
