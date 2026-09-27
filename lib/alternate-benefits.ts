import {equippedArmor,carrying} from './equipment.ts';
import {alternateActionActive} from './alternate-actions.ts';
import {selectedMonkStyle,monkStyleBonus} from './alternate-grants.ts';
import type {Character} from './model.ts';
import {effectiveScore} from './ancestry.ts';
import type {BonusTerm} from './effects.ts';
import {activeAlternateFeatures,alternateClassLevel,alternateSettings,hasAlternateFeature} from './alternate-features.ts';

export function berserkerStrengthActive(c:Character){return c.automation.enabled&&hasAlternateFeature(c,'barbarian-berserker-strength')&&c.hp>0&&c.nonlethal<=c.hp&&c.hp<5*alternateClassLevel(c,'barbarian')&&!c.automation.context.helpless&&!c.effects.some(e=>e.active&&['unconscious','dead'].includes(e.preset));}

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
  if(totem==='Eagle'&&['skill.Search','skill.Spot'].includes(target))add('Eagle totem',4+(hasAlternateFeature(c,'barbarian-totem-manifestation')?Math.max(0,Math.floor((barb-7)/3)):0));
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
 if(!lasting&&berserkerStrengthActive(c)){
  const tier=barb>=20?3:barb>=11?2:1;
  if(target==='STR')add('Berserker strength',2+2*tier);
  if(target==='saves')add('Berserker strength',1+tier);
  if(target==='ac.misc')add('Berserker strength',-2);
 }
 if(hasAlternateFeature(c,'fighter-dungeon-crasher')&&x.saveAgainst==='traps'&&['saves','ac.misc'].includes(target))add('Dungeon Crasher',alternateClassLevel(c,'fighter')>=6?4:2);
 if(hasAlternateFeature(c,'fighter-dungeon-crasher')&&target==='check.STR'&&x.skillUse==='break object')add('Dungeon Crasher',alternateClassLevel(c,'fighter')>=6?10:5);
 const style=selectedMonkStyle(c);
 if(style&&target==='skill.'+style.skill)add(style.name,2);
 if(monkStyleBonus(c,'Sacred Path of Wee Jas')&&target==='skill.Use Magic Device')add('Sacred Path of Wee Jas',Math.floor(alternateClassLevel(c,'monk')/2));
 if(monkStyleBonus(c,'Cobra Strike')&&target==='ac.dodge'&&x.dodgeTarget)add('Cobra Strike',1,'dodge');
 if(monkStyleBonus(c,'Denying Stance')&&target==='grapple'&&(x.defensive==='fighting'||Number(x.combatExpertise)>0))add('Denying Stance',2);
 if(monkStyleBonus(c,'Wushu')&&target==='skill.Bluff'&&x.skillUse==='feint')add('Wushu',Math.floor(alternateClassLevel(c,'monk')/2));
 if(hasAlternateFeature(c,'cleric-no-turning')){
  const choice=alternateSettings(c,'cleric-no-turning').choice,skills:Record<string,string>={Cultist:'Bluff',Evangelist:'Diplomacy',Fanatic:'Intimidate',Healer:'Heal',Justicar:'Sense Motive',Sage:'Knowledge (religion)',Theologian:'Knowledge (religion)',Weaponmaster:'Craft (weaponsmith)'};
  if(target==='skill.'+skills[choice])add(choice,2);
  if(choice==='Relic Hunter'&&target==='save.ref'&&x.saveAgainst==='traps')add(choice,Math.max(1,1+Math.floor((effectiveScore(c,'WIS')-10)/2)));
 }
 if(!lasting){
  if(alternateActionActive(c,'swashbuckler-shield-of-blades','blades')&&target==='ac.shield'&&equippedArmor(c).category<=1&&carrying(c).category==='Light')add('Shield of Blades',1+Math.floor(alternateClassLevel(c,'swashbuckler')/5),'shield');
  if(alternateActionActive(c,'fighter-armor-of-god','armor')){if(target==='save.will')add('Armor of God',-c.saves.will.base);if(target==='ac.misc')add('Armor of God',c.saves.will.base);}
  if(alternateActionActive(c,'fighter-resolute','resolute')&&target==='save.will')add('Resolute',Math.floor(c.bab/2));
  if(alternateActionActive(c,'fighter-elusive-attack','elusive')&&target==='ac.dodge')add('Elusive Attack',alternateClassLevel(c,'fighter')>=16?6:alternateClassLevel(c,'fighter')>=11?4:2,'dodge');
  if(alternateActionActive(c,'wizard-immediate-magic','immediate')){const choice=alternateSettings(c,'wizard-immediate-magic').choice;if(choice==='Abjuration'&&target==='ac.shield')add('Urgent Shield',2,'shield');if(choice==='Divination'&&target==='saves')add('Glimpse Peril',2,'insight');}
  if(alternateActionActive(c,'monk-invisible-fist','invisible')&&target==='attack'&&x.unseen&&!c.effects.some(e=>e.active&&e.preset==='invisible'))add('Invisible Fist',2);
  if(alternateActionActive(c,'barbarian-view-the-spirit-world','vision')&&['skill.Search','skill.Spot'].includes(target))add('View the Spirit World',2);
  if(alternateActionActive(c,'cleric-no-turning','healer')&&alternateSettings(c,'cleric-no-turning').choice==='Healer'&&(target==='ac.misc'||target==='skill.Concentration'&&x.skillUse==='defensive casting'))add('Healer',2,'sacred');
  if(alternateActionActive(c,'swashbuckler-arcane-stunt','stunt-1')&&target==='speed')add('Expeditious retreat',30,'enhancement');
  if(alternateActionActive(c,'swashbuckler-arcane-stunt','stunt-3')&&target==='skill.Jump')add('Jump',alternateClassLevel(c,'swashbuckler')>=9?30:alternateClassLevel(c,'swashbuckler')>=5?20:10,'enhancement');
 }
 return out;
}

export function alternateClassSkill(c:Character,classId:string,name:string,ordinary:boolean){
 let result=ordinary;
 for(const d of activeAlternateFeatures(c).filter(d=>d.classId===classId&&d.id.includes('-skilled-city-dweller-'))){const [lost,gained]=alternateSettings(c,d.id).choice.split(' → ');if(name===lost)result=false;if(name===gained)result=true;}
 if(classId==='spellthief'&&hasAlternateFeature(c,'spellthief-trickster')&&['Appraise','Bluff','Disable Device','Escape Artist','Hide','Jump','Move Silently','Open Lock','Search','Swim','Tumble'].includes(name))result=false;
 if(classId==='fighter'&&hasAlternateFeature(c,'fighter-golarion-fighter')&&['Diplomacy','Gather Information','Knowledge (architecture and engineering)','Knowledge (geography)','Knowledge (nobility and royalty)','Sense Motive'].includes(name))result=true;
 if(classId==='paladin'&&hasAlternateFeature(c,'paladin-hunter-of-fiends')&&name==='Knowledge (nobility and royalty)')result=false;
 if(classId==='ranger'&&hasAlternateFeature(c,'ranger-trap-expert')&&name==='Disable Device')result=true;
 if(classId==='cleric'&&hasAlternateFeature(c,'cleric-no-turning')){const choice=alternateSettings(c,'cleric-no-turning').choice;if(choice==='Relic Hunter'&&['Knowledge (dungeoneering)','Search'].includes(name)||choice==='Wanderer'&&['Knowledge (geography)','Knowledge (local)','Speak Language','Survival'].includes(name))result=true;}
 if(classId==='sorcerer'){
  const blood=['eberron','khyber','siberys'].find(b=>hasAlternateFeature(c,'sorcerer-blood-of-'+b));
  if(blood){const extra:Record<string,string[]>={eberron:['Diplomacy','Handle Animal','Heal','Knowledge (nature)'],khyber:['Bluff','Intimidate','Knowledge (dungeoneering)'],siberys:['Bluff','Diplomacy','Knowledge (the planes)']};result=['Concentration','Craft','Knowledge (arcana)','Profession','Spellcraft',...extra[blood]].some(s=>name===s||name.startsWith(s+' ('));}
 }
 return result;
}
