import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import type {BonusTerm} from './effects.ts';
import {activeAlternateFeatures,alternateClassLevel,alternateSettings,hasAlternateFeature} from './alternate-features.ts';

/** Ability-score branches must not call effectiveScore recursively. */
export function alternateTerms(c:Character,target:string,context:Record<string,string|number|boolean>={},lasting=false):BonusTerm[]{
 const out:BonusTerm[]=[];const x:Record<string,string|number|boolean>={...c.automation.context,...context};
 const add=(source:string,value:number,type='untyped')=>out.push({source,value,type});
 const rage=c.effects.some(e=>e.preset==='rage'&&e.active&&(!lasting||e.permanent)),barb=alternateClassLevel(c,'barbarian');
 if(rage&&hasAlternateFeature(c,'barbarian-whirling-frenzy')){
  if(target==='STR')add('Whirling frenzy',barb>=20?8:barb>=11?6:4);
  if(target==='ac.dodge'||target==='save.ref')add('Whirling frenzy',barb>=20?4:barb>=11?3:2,target==='ac.dodge'?'dodge':'untyped');
  if(target==='attack'&&alternateSettings(c,'barbarian-whirling-frenzy').active)add('Whirling frenzy',-2);
 }
 if(rage&&hasAlternateFeature(c,'barbarian-ferocity')){
  if(target==='STR'||target==='DEX')add('Ferocity',barb>=20?8:barb>=11?6:4);
  if(target==='attack'&&x.weapon==='ranged'&&Number(x.distance)>30)add('Ferocity',-2);
  if(['ac.dodge','save.ref'].includes(target)&&barb>=14)add('Ferocity',barb>=17?2:1,'dodge');
 }
 if(hasAlternateFeature(c,'barbarian-spiritual-totem')){
  const totem=alternateSettings(c,'barbarian-spiritual-totem').choice;
  if(totem==='Eagle'&&['skill.Search','skill.Spot'].includes(target))add('Eagle totem',4);
  if(totem==='Fox'&&['skill.Hide','skill.Move Silently'].includes(target))add('Fox totem',4);
  if(totem==='Wolf'&&target==='attack'&&x.flanking)add('Wolf totem',2);
 }
 if(hasAlternateFeature(c,'barbarian-devils-luck')&&target==='saves')add('Devil’s luck',Math.floor((barb-4)/3),'luck');
 if(hasAlternateFeature(c,'fighter-drow-fighter')){
  if(target==='initiative')add('Hit and run tactics',2);
  if(target==='damage'&&x.targetFlatFooted&&Number(x.distance)<=30)add('Hit and run tactics',Math.max(0,Math.floor((effectiveScore(c,'DEX')-10)/2)),'competence');
 }
 if(hasAlternateFeature(c,'paladin-underdark-knight')&&alternateSettings(c,'paladin-underdark-knight').active){
  if(target==='speed')add('Underdark knight',10);
  if(['skill.Balance','skill.Climb','skill.Jump'].includes(target))add('Underdark knight',2,'circumstance');
 }
 if(hasAlternateFeature(c,'cleric-no-turning')){const choice=alternateSettings(c,'cleric-no-turning').choice;if(target===(choice==='Cultist'?'skill.Bluff':'skill.Diplomacy'))add(choice,2);}
 return out;
}

export function alternateClassSkill(c:Character,classId:string,name:string,ordinary:boolean){
 let result=ordinary;
 for(const d of activeAlternateFeatures(c).filter(d=>d.classId===classId&&d.id.includes('-skilled-city-dweller-'))){const [lost,gained]=alternateSettings(c,d.id).choice.split(' → ');if(name===lost)result=false;if(name===gained)result=true;}
 if(classId==='spellthief'&&hasAlternateFeature(c,'spellthief-trickster')&&['Appraise','Bluff','Disable Device','Escape Artist','Hide','Jump','Move Silently','Open Lock','Search','Swim','Tumble'].includes(name))result=false;
 if(classId==='fighter'&&hasAlternateFeature(c,'fighter-golarion-fighter')&&['Diplomacy','Gather Information','Knowledge (architecture and engineering)','Knowledge (geography)','Knowledge (nobility and royalty)','Sense Motive'].includes(name))result=true;
 if(classId==='paladin'&&hasAlternateFeature(c,'paladin-hunter-of-fiends')&&name==='Knowledge (nobility and royalty)')result=false;
 if(classId==='sorcerer'){
  const blood=['eberron','khyber','siberys'].find(b=>hasAlternateFeature(c,'sorcerer-blood-of-'+b));
  if(blood){const extra:Record<string,string[]>={eberron:['Diplomacy','Handle Animal','Heal','Knowledge (nature)'],khyber:['Bluff','Intimidate','Knowledge (dungeoneering)'],siberys:['Bluff','Diplomacy','Knowledge (the planes)']};result=['Concentration','Craft','Knowledge (arcana)','Profession','Spellcraft',...extra[blood]].some(s=>name===s||name.startsWith(s+' ('));}
 }
 return result;
}
