import type {Character} from './model.ts';
import type {AlternateResource} from './alternate-features.ts';
import {activeAlternateFeatures,alternateClassLevel,alternateSettings,configureAlternateFeature,alternateResourceUsed,setAlternateResourceUsed,hasAlternateFeature} from './alternate-features.ts';
import {effectiveScore} from './ancestry.ts';
import {effectBonus,featCount} from './effects.ts';
import {castingNumbers} from './advancement.ts';
import {equippedArmor} from './equipment.ts';
import {monkStyleBonus} from './alternate-grants.ts';
export type AlternateAction={id:string,featureId:string,name:string,action:string,description:string,formula?:string,dc?:number,save?:string,pool?:string,max?:number,cost?:number,duration?:number,cooldown?:number,variableCost?:boolean};
const mod=(c:Character,a:keyof Character['scores'])=>Math.floor((effectiveScore(c,a)-10)/2);
const signed=(n:number)=>n<0?String(n):'+'+n;
export function alternateActionActive(c:Character,id:string,action:string){return c.automation.enabled&&hasAlternateFeature(c,id)&&(alternateSettings(c,id).actions[action]?.rounds||0)>0;}
export function alternateActions(c:Character):AlternateAction[]{
 const out:AlternateAction[]=[],cha=mod(c,'CHA'),wis=mod(c,'WIS'),int=mod(c,'INT'),dex=mod(c,'DEX'),str=mod(c,'STR');
 for(const d of activeAlternateFeatures(c)){
  const lv=alternateClassLevel(c,d.classId),s=alternateSettings(c,d.id),id=d.id;
  const add=(key:string,name:string,action:string,description:string,extra:Partial<AlternateAction>={})=>out.push({id:key,featureId:id,name,action,description,...extra});
  const daily=(key:string,name:string,max:number,action:string,description:string,extra:Partial<AlternateAction>={})=>add(key,name,action,description,{pool:'daily:acf:'+id+':'+key,max:Math.max(0,max),cost:1,...extra});
  if(id==='fighter-dungeon-crasher')add('collision','Dungeon Crasher collision','Bull rush into an obstacle','Roll only after the bull rush forces the target into a wall or solid obstacle. Bludgeoning damage.',{formula:(lv>=6?'8d6':'4d6')+signed(Math.max(0,str)*(lv>=6?3:2))});
  if(id==='fighter-armor-of-god')add('armor','Armor of God','Immediate','Trade your current base Will save for AC until your next turn.',{duration:1});
  if(id==='fighter-resolute')add('resolute','Resolute','Immediate','Halve base attack bonus; add the amount surrendered to Will until the end of your next action.',{duration:1});
  if(id==='fighter-elusive-attack')add('elusive','Elusive Attack','Full-round','Make one attack at highest BAB and gain the level-scaled dodge bonus until your next turn.',{duration:1});
  if(id==='fighter-overpowering-attack')add('overpower','Overpowering Attack','Full-round','One attack at highest BAB. Double eligible weapon damage until your next turn; extra dice are not multiplied.',{duration:1});
  if(id==='fighter-fortification')add('fortification','Fortification','After a critical hit or sneak attack','While in heavy armor: negate the critical/precision damage on a roll of '+(lv>=18?100:lv>=14?75:25)+' or lower. Does not stack with other fortification.',{formula:'1d100'});
  if(id.startsWith('fighter-warrior-of-')&&lv>=6){const element=id.slice('fighter-warrior-of-'.length),first:Record<string,string>={air:'Feather fall',earth:'Magic stone',fire:'Burning hands',water:'Obscuring mist'},second:Record<string,string>={air:'Freedom of movement',earth:'Stone shape',fire:'Fire shield (fire)',water:'Water breathing'};
   daily('first',first[element],3,element==='air'?'Immediate':'Standard','Spell-like ability; caster level '+(element==='earth'?Math.floor(lv/2):lv)+'.',element==='fire'?{formula:Math.min(5,lv)+'d4',dc:11+cha,save:'Reflex half'}:{});
   if(lv>=12){const atWill=lv>=20&&['earth','water'].includes(element);add('second',second[element],'Standard','Spell-like ability; caster level '+lv+'.',atWill?{}:{pool:'daily:acf:'+id+':second',cost:1,max:['earth','water'].includes(element)||lv>=20?3:1});}
  }
  if(id==='monk-decisive-strike')add('decisive','Decisive Strike','Full-round','Use an unarmed strike or special monk weapon; at monk 11, two attacks must target different creatures. Damage doubles until your next turn.',{duration:1});
  if(id==='monk-invisible-fist'){add('invisible','Invisible Fist','Immediate','Become invisible for one round. This is not invisibility the spell; attacks do not end it.',{duration:1,cooldown:3});if(lv>=9)add('blink','Invisible Fist — blink','Immediate','Blink as the spell. Resolve miss chance, defenses, and ethereal movement from the source.',{duration:Math.max(1,wis),cooldown:3});}
  if(id==='monk-draconic-fist')daily('energy','Draconic Fist energy damage',lv,'Swift, before the attack','Add '+(s.rules.energy||'the chosen energy')+' damage to the next unarmed attack this round. A miss spends the attempt.',{formula:(1+Math.floor(lv/5))+'d6'});
  if(id==='monk-soulwarp-strike')daily('soulwarp','Soulwarp Strike',lv,'Declare before unarmed attack','Living target is nauseated for one round on failure, sickened on success; necromancy immunity applies. A miss spends the attempt.',{dc:10+Math.floor(c.level/2)+wis,save:'Fortitude',cooldown:1});
  if(id==='monk-wholeness-of-others')daily('heal','Wholeness of Others',2*lv,'Standard','Touch another creature to heal the selected number of hit points; cannot heal yourself.',{pool:'retained:daily:Wholeness of body — healing points',variableCost:true});
  if(id.endsWith('-spell-reflection'))daily('reflect','Spell Reflection',Math.max(1,1+dex),'Immediate','After a spell or SLA requiring an attack misses you, its caster rerolls the attack against themself at the original modifier.');
  if(id==='barbarian-view-the-spirit-world')daily('vision','View the Spirit World',1,'Swift','Darkvision 60 feet, see invisible, and +2 Search/Spot.',{duration:Math.floor(lv/2)});
  if(id==='barbarian-totem-manifestation'&&s.choice==='Lion')daily('roar','Lion Totem roar',1+Math.floor((lv-7)/3),'Standard','Creatures within 30 feet become shaken for '+lv+' rounds on a failed save.',{dc:10+Math.floor(lv/2)+str,save:'Will'});
  if(id==='bard-lore-song')daily('lore','Lore Song',Math.ceil(lv/2),'Immediate','Add +4 insight to one attack, check, or save. Include it once in the selected roll; do not add it to all sheet totals.');
  if(id==='cleric-blasphemous-incantation'){const cl=Math.max(lv,...c.casters.filter(p=>p.casting?.classId==='cleric').map(p=>castingNumbers(c,p).level));daily('incantation','Blasphemous Incantation',3+cha,'Standard','Good creatures within 30 feet become sickened for '+Math.max(1,cha)+' rounds on failure.',{dc:10+Math.floor(cl/2)+cha+((c.skills.find(k=>k.name==='Knowledge (religion)')?.ranks||0)>=5?2:0),save:'Fortitude'});}
  if(id==='cleric-destroy-undead')daily('destroy','Destroy Undead',3+cha+4*featCount(c,'Extra Turning'),'Standard','Damage all undead within 30 feet. Subtract each target’s turn resistance from its damage. Incorporeal miss chance does not apply.',{pool:'daily:acf:cleric-destroy-undead:destroy',formula:lv+'d6',dc:10+lv+cha+effectBonus(c,'turnCheck')+effectBonus(c,'check.CHA')+((c.skills.find(k=>k.name==='Knowledge (religion)')?.ranks||0)>=5?2:0),save:'Will half'});
  if(id==='cleric-pool-of-healing'){const cl=Math.max(lv,...c.casters.filter(p=>p.casting?.classId==='cleric').map(p=>castingNumbers(c,p).level));daily('healing','Pool of Healing',5*(1+cl),'Standard','Touch to heal the selected number of hit points, or make a melee touch attack to deal positive-energy damage.',{variableCost:true});}
  if(id==='cleric-no-turning'){
   if(s.choice==='Evangelist'){daily('languages','Comprehend languages',2,'Standard','Spell-like ability; caster level 1.');if(lv>=7)daily('tongues','Tongues',1,'Standard','Spell-like ability; caster level 7.');}
   if(s.choice==='Fanatic')daily('true-strike','True strike',1,'Standard','Spell-like ability; caster level 1. Add +20 insight to the next attack within one round, ignoring concealment miss chance.');
   if(s.choice==='Healer')add('healer','Healer protection','After healing another creature','After a conjuration (healing) spell on another creature: +2 sacred AC and defensive-casting Concentration until the end of your next turn.',{duration:1});
   if(s.choice==='Sage')daily('knowledge','Reroll Knowledge',1,'After a Knowledge check','Make the Knowledge check again and keep the second result.');
   if(s.choice==='Warrior Priest')daily('quicken','Warrior Priest quickening',1,'Swift','Cast a prepared spell on your weapon, shield, or armor without raising its level. Spend the prepared spell separately.');
  }
  if(id==='paladin-gaze-of-truth')daily('truth','Gaze of Truth',Math.max(1,1+cha),'Standard','Discern lies for '+lv+' rounds. A creature that saves is immune to your gaze for 24 hours.',{duration:lv,dc:10+Math.floor(lv/2)+cha,save:'Will'});
  if(id==='paladin-stand-fast'){const max=lv>=18?3:lv>=11?2:1;daily('allies','Stand Fast — allies',max,'Immediate','All allies within 20 feet add your divine-grace bonus ('+Math.max(0,cha)+') to the same chosen save for one round. You do not gain this bonus.');daily('self','Stand Fast — defense',max,'Immediate','Add divine grace ('+Math.max(0,cha)+') to one defensive bull rush, disarm, grapple, sunder, or trip roll.');}
  if(id==='paladin-sword-of-celestia')daily('summon','Call Sword of Celestia',Math.max(1,1+wis),'Free','Summon the named weapon: '+(lv>=20?'+2 holy lawful':lv>=15?'+2 holy':lv>=10?'+2':'+1')+'. Good-aligned for DR.');
  if(id==='wizard-immediate-magic'){
   const names:Record<string,string>={Abjuration:'Urgent Shield',Conjuration:'Abrupt Jaunt',Divination:'Glimpse Peril',Enchantment:'Instant Daze',Evocation:'Counterfire',Illusion:'Brief Figment',Necromancy:'Cursed Glance',Transmutation:'Sudden Shift'};
   const descriptions:Record<string,string>={Abjuration:'+2 shield AC until your next turn.',Conjuration:'Teleport up to 10 feet, alone.',Divination:'+2 insight on your next saving throw before your next turn; end the effect after that save.',Enchantment:'Daze a melee attacker whose HD do not exceed wizard level; mind-affecting compulsion.',Evocation:'Ranged touch against a visible foe within 60 feet who targets you. Resolve both attacks simultaneously.',Illusion:'One mirror-image-like duplicate until struck or your next turn.',Necromancy:'A visible attacker within 60 feet takes −2 AC and saves on a failed save.',Transmutation:'Climb, fly, or swim speed equal to land speed. Check the source for the turn boundary.'};
   if(names[s.choice])daily('immediate',names[s.choice],Math.max(1,int),'Immediate',descriptions[s.choice],{pool:'daily:wizard-immediate-magic',duration:['Abjuration','Divination','Illusion','Transmutation'].includes(s.choice)?1:undefined,...(['Enchantment','Necromancy'].includes(s.choice)?{dc:10+Math.floor(lv/2)+int,save:'Will'}:{}),...(s.choice==='Evocation'?{formula:lv>=3?Math.floor(lv/3)+'d6':'0'}:{})});
  }
  if(id.startsWith('ninja-')&&['ninja-blinding-flash','ninja-deceptive-mist','ninja-one-with-the-earth'].includes(id)){
   const pool='feature:supp:ninja:Ki power';
   if(id==='ninja-blinding-flash')add('flash','Blinding Flash','Swift','Creatures within 20 feet: blinded for one round on failure, dazzled on success. The source explicitly uses a base DC of 20.',{pool,cost:1,duration:1,dc:20+Math.floor(lv/2)+wis,save:'Reflex'});
   if(id==='ninja-deceptive-mist')add('mist','Deceptive Mist','Swift','Create a 20-foot-radius fog for one round; your vision is unaffected. At ninja 8, two doses of contact poison or one inhaled dose may be added. At ninja 10, solid fog is available.',{pool,cost:1,duration:1});
   if(id==='ninja-one-with-the-earth'){add('meld','Meld into stone','Swift','Meld into stone for one minute; spending another ki use maintains it.',{pool,cost:1,duration:10});if(lv>=8)add('burrow','Earth burrow','Swift','Burrow at land speed for one round, through earth or stone, not metal. The tunnel closes behind you.',{pool,cost:1,duration:1});}
  }
  if(id==='warlock-fiendish-flamewreath')daily('flamewreath','Fiendish Flamewreath',1,'Free','Contact attackers take '+(lv>=18?5:lv>=13?2:1)+'d6 fire damage. Reach attackers are exempt. Lasts two minutes.',{duration:20});
  if(id==='warlock-drow-warlock'&&lv>=18)daily('poison','Apply poisonous blood',3,'Move','Next weapon or eldritch blast attack before your next turn delivers poison: 1d6 Strength initial and secondary damage.',{dc:10+Math.floor(lv/2)+cha,save:'Fortitude'});
  if(id==='marshal-adrenaline-boost')daily('boost','Adrenaline Boost',Math.floor(lv/4),'Standard','Allies within 30 feet who understand you gain '+lv+' temporary HP, or '+2*lv+' if at half HP or less, for '+lv+' minutes. Does not affect you; temporary HP overlap.');
  if(id==='swashbuckler-shield-of-blades')add('blades','Shield of Blades','After attacking with two light weapons','Gain a level-scaled shield bonus until your next turn, while in light/no armor and carrying a light load.',{duration:1});
  if(id==='swashbuckler-arcane-stunt'){
   const choices=['Blur','Expeditious retreat','Feather fall','Jump','Spider climb'];const slots=lv>=20?3:lv>=11?2:1;
   for(const choice of [...new Set(Array.from({length:slots},(_,i)=>s.rules['stunt-'+i]).filter(v=>choices.includes(v)))])daily('stunt-'+choices.indexOf(choice),choice,Math.max(1,1+int),choice==='Feather fall'?'Immediate':'Swift','Arcane Stunt; caster level '+lv+'. All stunts share one daily pool.',{pool:'daily:acf:'+id+':stunts',duration:lv>=20?3:lv>=11?2:1});
  }
  if(id==='monk-fighting-styles'&&monkStyleBonus(c,'Franciscan Friar'))for(const [key,name] of [['cure','Cure light wounds'],['purify','Purify food and drink'],['disease','Remove disease']])daily(key,name,1,'Standard','Spell-like ability; caster level '+Math.floor(lv/2)+'.',key==='cure'?{formula:'1d8+'+Math.min(5,Math.floor(lv/2))}:{});
 }
 return out;
}
export function automatedAlternateResources(c:Character):AlternateResource[]{const pools=new Map<string,AlternateResource>();for(const a of alternateActions(c))if(a.pool&&!a.pool.startsWith('feature:')&&a.max!==undefined)pools.set(a.pool,{key:a.pool,name:a.name,max:a.max,period:'day',description:a.description});return [...pools.values()];}
export function alternateActionRemaining(c:Character,a:AlternateAction){if(!a.pool)return Infinity;if(a.pool.startsWith('feature:')){const f=c.features.find(f=>f.ruleId===a.pool!.slice(8));return f?Math.max(0,f.max-f.used):0;}return Math.max(0,(a.max||0)-alternateResourceUsed(c,a.pool));}
export function alternateActionProblem(c:Character,featureId:string,id:string,cost=1){
 if(!c.automation.enabled)return 'Enable automatic calculations to activate ability effects.';
 const a=alternateActions(c).find(a=>a.featureId===featureId&&a.id===id);if(!a)return 'This ability is not available.';
 if(!Number.isInteger(cost)||cost<1||cost>10000||!a.variableCost&&cost!==1)return 'Choose a valid ability cost.';
 if(featureId==='monk-draconic-fist'&&!['acid','cold','electricity','fire'].includes(alternateSettings(c,featureId).rules.energy))return 'Choose an energy type for Draconic Fist.';
 if(featureId==='fighter-fortification'&&equippedArmor(c).category!==3)return 'Fortification requires heavy armor.';
 const state=alternateSettings(c,featureId).actions;
 if((featureId==='monk-invisible-fist'?Math.max(0,...Object.values(state).map(s=>s.cooldown)):state[id]?.cooldown||0)>0)return 'This ability is still recharging.';
 if(a.pool&&alternateActionRemaining(c,a)<(a.variableCost?cost:a.cost||1))return 'No uses remain for this ability.';
 return '';
}
export function useAlternateAction(c:Character,featureId:string,id:string,cost=1){
 const problem=alternateActionProblem(c,featureId,id,cost);if(problem)throw new Error(problem);
 const a=alternateActions(c).find(a=>a.featureId===featureId&&a.id===id)!;
 if(a.pool){const spent=a.variableCost?cost:a.cost||1;if(a.pool.startsWith('feature:'))c.features.find(f=>f.ruleId===a.pool!.slice(8))!.used+=spent;else setAlternateResourceUsed(c,a.pool,alternateResourceUsed(c,a.pool)+spent);}
 if(a.duration||a.cooldown){const actions={...alternateSettings(c,featureId).actions};actions[id]={rounds:a.duration||0,cooldown:a.cooldown||0};configureAlternateFeature(c,featureId,{actions});}
}
export function endAlternateAction(c:Character,featureId:string,id:string){const s=alternateSettings(c,featureId),a=s.actions[id];if(a)configureAlternateFeature(c,featureId,{actions:{...s.actions,[id]:{...a,rounds:0}}});}
export function advanceAlternateRound(c:Character){for(const s of Object.values(c.alternateFeatures.settings))for(const a of Object.values(s.actions)){a.rounds=Math.max(0,a.rounds-1);a.cooldown=Math.max(0,a.cooldown-1);}}
