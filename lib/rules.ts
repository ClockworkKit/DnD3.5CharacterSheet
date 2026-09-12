import type {Character,Caster,KnownSpell,Skill,Weapon,Spell} from './model.ts';
import {abilityKeys} from './model.ts';
import {effectiveScore,racialTraits,racialSkill} from './ancestry.ts';
import {modifier,signed,withBonus,parseDiceFormula,macroLabel} from './dice.mjs';
import {effectBonus,effectTerms,stackBonuses,effectActive,classLevel,hasFeat} from './effects.ts';
import {equipmentById,equippedArmor,weaponProficient,carriedWeight,movement,scaleDice} from './equipment.ts';
import {brainsOverBrawn,factotumLevel,factotumNumbers} from './factotum.ts';
import {skillExtras} from './advancement.ts';
import {diceFormula,resourceNumbers} from './automation.ts';
export {modifier,signed,withBonus};
export type Roll={title:string,formula?:string,details:string,fields?:Array<[string,string]>};
const sizes={Fine:[8,-16],Diminutive:[4,-12],Tiny:[2,-8],Small:[1,-4],Medium:[0,0],Large:[-1,4],Huge:[-2,8],Gargantuan:[-4,12],Colossal:[-8,16]};
function combined(c:Character,targets:string[],context:Record<string,string|number|boolean>={}){return stackBonuses(targets.flatMap(t=>effectTerms(c,t,context)));}
export function abilityCheck(c:Character,a:typeof abilityKeys[number]){return modifier(effectiveScore(c,a))+c.situational+combined(c,['checks','check.'+a])+brainsOverBrawn(c,a);}
function racialSave(c:Character,k:string){const r=racialTraits(c),ctx=c.automation.context.saveAgainst;if(!r||!c.automation.enabled)return 0;let n=0;if(r.type.includes('dwarf')&&['poison','spell','spell-like'].includes(ctx)&&!(r.id==='duergar'&&ctx==='poison'))n+=r.id==='deep-dwarf'?3:2;if(r.type.includes('elf')&&ctx==='enchantment')n+=2;if(r.id==='drow'&&k==='will'&&['spell','spell-like'].includes(ctx))n+=2;if(r.id.includes('gnome')&&r.id!=='deep-gnome'&&ctx==='illusion')n+=2;return n;}
export function sheetTotals(c:Character){const mods=Object.fromEntries(abilityKeys.map(a=>[a,modifier(effectiveScore(c,a))])) as Record<typeof abilityKeys[number],number>;const r=racialTraits(c),d=c.defense,size=sizes[c.size][0],auto=c.automation.enabled,ctx=c.automation.context;const free=auto&&movement(c).free,monk=classLevel(c,'monk')+classLevel(c,'psionic-fist'),duelist=classLevel(c,'duelist'),dd=classLevel(c,'dragon-disciple');const denied=auto&&(ctx.flatFooted||['blinded','stunned'].some(id=>effectActive(c,id)));const dex=Math.min(mods.DEX,d.dexCap,denied?0:100);const acComponent=(value:number,target:string,type:string)=>stackBonuses([{value,type,source:'sheet'},...effectTerms(c,target)]);
 const armor=acComponent(d.armor,'ac.armor','armor'),shield=acComponent(d.shield,'ac.shield','shield'),natural=acComponent(d.natural+(r?.natural||0)+(auto?(dd>=10?4:dd>=7?3:dd>=4?2:dd>=1?1:0):0),'ac.natural','natural')+effectBonus(c,'ac.naturalEnhancement'),deflection=acComponent(d.deflection,'ac.deflection','deflection');const tumble=(c.skills.find(s=>s.name==='Tumble')?.ranks||0)>=5;const defensive=auto?(ctx.defensive==='fighting'?(tumble?3:2):ctx.defensive==='total'?(tumble?6:4):0)+(hasFeat(c,'Combat Expertise')?Math.min(5,c.bab,ctx.combatExpertise):0):0;const dodge=(auto&&factotumLevel(c)>=16&&equippedArmor(c).category<=1?Math.max(0,factotumNumbers(c).intelligence):0)+d.dodge+(r?.dodge||0)+effectBonus(c,'ac.dodge')+(auto?defensive+(hasFeat(c,'Dodge')&&ctx.dodgeTarget?1:0)+(r&&ctx.targetType==='giant'&&(r.type.includes('dwarf')||r.id.includes('gnome'))&&r.id!=='deep-gnome'?4:0)+(classLevel(c,'dwarven-defender')?1+Math.floor((classLevel(c,'dwarven-defender')-1)/3):0):0);const misc=d.misc+effectBonus(c,'ac.misc')+(auto?(ctx.charge?-2:0)+(free&&monk?mods.WIS+Math.floor(monk/5):0)+(free&&duelist?Math.min(duelist,Math.max(0,mods.INT)):0):0);
 const saves=Object.fromEntries((['fort','ref','will'] as const).map((s,i)=>[s,c.saves[s].base+[mods.CON,mods.DEX,mods.WIS][i]+c.saves[s].misc+(r?.saves[s]||0)+c.situational+(auto?(hasFeat(c,['Great Fortitude','Lightning Reflexes','Iron Will'][i])?2:0)+(classLevel(c,'paladin')>=2?Math.max(0,mods.CHA):0)+(classLevel(c,'blackguard')>=2?Math.max(0,mods.CHA):0)+racialSave(c,s)+(s==='ref'&&free&&duelist>=4?2:0)+(s==='fort'&&ctx.saveAgainst==='poison'?Math.floor(classLevel(c,'assassin')/2):0)+stackBonuses([...effectTerms(c,'saves'),...effectTerms(c,'save.'+s),...(r?.id==='halfling'&&ctx.saveAgainst==='fear'?[{value:2,type:'morale',source:'halfling'}]:[])]):0)])) as {fort:number,ref:number,will:number};
 return {mods,size,ac:10+armor+shield+natural+deflection+(denied?0:dodge)+misc+dex+size,touch:10+deflection+(denied?0:dodge)+misc+dex+size,flat:10+armor+shield+natural+deflection+misc+Math.min(0,dex)+size,initiative:mods.DEX+brainsOverBrawn(c,'DEX')+c.initiative+c.situational+(auto?(hasFeat(c,'Improved Initiative')?4:0)+(duelist>=8?4:duelist>=2?2:0)+effectBonus(c,'initiative'):0),grapple:c.bab+mods.STR+sizes[c.size][1]+c.grapple+(c.size==='Colossal'?0:(r?.grapple||0))+c.situational+(auto?(hasFeat(c,'Improved Grapple')?4:0)+effectBonus(c,'grapple'):0),saves,weight:carriedWeight(c)};}
export function skillBonus(c:Character,s:Skill){let total=Math.floor(s.ranks)+modifier(effectiveScore(c,s.ability))+s.misc+racialSkill(c,s)+s.armor*c.defense.checkPenalty+c.situational+skillExtras(c,s.name)+combined(c,['skills','skill.'+s.name])+brainsOverBrawn(c,s.ability);if(c.automation.enabled&&s.armor===0&&['STR','DEX'].includes(s.ability))total+=equippedArmor(c).nonproficient;return total;}
export function canRollSkill(s:Skill){return !s.trained||s.ranks>=1||s.name.startsWith('Knowledge');}
export function weaponContext(c:Character,w:Weapon){const e=equipmentById(w.catalogId);return {weapon:w.attackMode&&w.attackMode!=='auto'?w.attackMode:e?.ranged||w.range!=='Melee'&&w.ability==='DEX'?'ranged':'melee',weaponName:w.name.toLowerCase()};}
function usingFlurry(c:Character,w:Weapon){return c.automation.enabled&&c.automation.context.flurry&&classLevel(c,'monk')>0&&movement(c).free&&['Unarmed strike','Kama','Nunchaku','Quarterstaff','Sai','Shuriken (5)','Siangham'].includes(equipmentById(w.catalogId)?.name||w.name);}
function rangerStyle(c:Character,style:string){return c.automation.rangerStyle===style&&equippedArmor(c).category<=1?classLevel(c,'ranger'):0;}
export function weaponAttack(c:Character,w:Weapon,iteration=0){const t=sheetTotals(c),e=equipmentById(w.catalogId),ctx=c.automation.context,auto=c.automation.enabled,ranged=weaponContext(c,w).weapon==='ranged';let ability=w.ability;if(auto&&!ranged&&hasFeat(c,'Weapon Finesse')&&(e?.hands==='light'||['Rapier','Whip','Chain, spiked','Unarmed strike'].includes(e?.name||''))&&t.mods.DEX>t.mods.STR)ability='DEX';let bonus=c.bab+t.mods[ability]+t.size+w.attack+c.situational-5*iteration;if(!auto)return bonus;const enhancement=Math.max(w.enhancement||0,/bow/i.test(w.name)&&classLevel(c,'arcane-archer')?Math.ceil(classLevel(c,'arcane-archer')/2):0);bonus+=stackBonuses([{value:Math.max(enhancement,w.masterwork?1:0),type:'enhancement',source:'weapon'},...effectTerms(c,'attack',weaponContext(c,w))]);if(!weaponProficient(c,w))bonus-=4;bonus+=equippedArmor(c).nonproficient+equippedArmor(c).tower;if(hasFeat(c,'Weapon Focus',w.name))bonus++;if(hasFeat(c,'Greater Weapon Focus',w.name))bonus++;if(ctx.flanking&&!ranged)bonus+=2;if(ctx.charge&&!ranged&&!['fatigued','exhausted','entangled','blinded'].some(id=>effectActive(c,id)))bonus+=2;if(ctx.defensive==='fighting')bonus-=4;if(hasFeat(c,'Combat Expertise'))bonus-=Math.min(c.bab,5,ctx.combatExpertise);if(hasFeat(c,'Power Attack')&&!ranged)bonus-=Math.min(c.bab,ctx.powerAttack);
 if(ctx.twoWeapon){const feat=hasFeat(c,'Two-Weapon Fighting')||(c.automation.rangerStyle==='two-weapon'&&classLevel(c,'ranger')>=2&&equippedArmor(c).category<=1);bonus+=w.strength==='off'?(feat?-4:-10):(feat?-4:-6);if(ctx.offhandLight)bonus+=2;}
 if(ctx.flurry&&classLevel(c,'monk')&&['Unarmed strike','Kama','Nunchaku','Quarterstaff','Sai','Shuriken (5)','Siangham'].includes(e?.name||w.name)&&movement(c).free)bonus-=classLevel(c,'monk')<5?2:classLevel(c,'monk')<9?1:0;
 if(ranged){if(ctx.distance>0&&ctx.distance<=30&&hasFeat(c,'Point Blank Shot'))bonus++;if(ctx.targetInMelee&&!hasFeat(c,'Precise Shot'))bonus-=4;if(ctx.rapidShot&&(hasFeat(c,'Rapid Shot')||c.automation.rangerStyle==='archery'&&classLevel(c,'ranger')>=2&&equippedArmor(c).category<=1))bonus-=2;const range=weaponRange(c,w);if(range&&ctx.distance>range)bonus-=2*Math.max(0,Math.ceil(ctx.distance/range)-1);if(e?.name.includes('composite')&&t.mods.STR<(w.bowStrength||0))bonus-=2;}
 const race=racialTraits(c);if(race?.id.includes('halfling')&&(e?.thrown||e?.name==='Sling'))bonus++;if(race?.type.includes('dwarf')&&['orc','goblinoid'].includes(ctx.targetRace))bonus++;if(race?.id.includes('gnome')&&race.id!=='deep-gnome'&&['kobold','goblinoid'].includes(ctx.targetRace))bonus++;if(ctx.smite&&(classLevel(c,'paladin')&&ctx.targetType==='evil'||classLevel(c,'blackguard')>=2&&ctx.targetType==='good'))bonus+=Math.max(0,t.mods.CHA);return bonus;}
export function weaponRange(c:Character,w:Weapon){const e=equipmentById(w.catalogId);const range=Number(w.range.match(/\d+/)?.[0]||0)||e?.range||0;return range*(c.automation.enabled&&hasFeat(c,'Far Shot')?(e?.thrown?2:1.5):1);}
export function weaponDice(c:Character,w:Weapon){if(!c.automation.enabled)return w.damage;const e=equipmentById(w.catalogId),monk=classLevel(c,'monk')+classLevel(c,'psionic-fist');if((e?.name==='Unarmed strike'||w.name==='Unarmed strike')&&monk){const dice=monk<4?'1d6':monk<8?'1d8':monk<12?'1d10':monk<16?'2d6':monk<20?'2d8':'2d10';return scaleDice(dice,'Medium',c.size)}if(e?.damage){if(c.size==='Small')return e.small!;return scaleDice(e.damage,'Medium',c.size)}return diceFormula(c,scaleDice(w.damage,w.diceSize||c.automation.baseSize,c.size));}
export function weaponCritical(c:Character,w:Weapon){const e=equipmentById(w.catalogId);const multiplier=w.criticalMultiplier||Number(w.crit.match(/[×x]\s*(\d+)/)?.[1]||e?.multiplier||2),base=w.criticalRange||Number(w.crit.match(/\d+/)?.[0]||e?.threat||20);const range=(21-base)*(c.automation.enabled&&(w.keen||hasFeat(c,'Improved Critical',w.name))?2:1);return {threat:Math.max(2,21-range),multiplier,label:(range===1?'20':Math.max(2,21-range)+'–20')+' / ×'+multiplier};}
export function weaponDamage(c:Character,w:Weapon,critical=false){let mod=w.damageAbility==='none'?0:modifier(effectiveScore(c,w.damageAbility));const e=equipmentById(w.catalogId),auto=c.automation.enabled,ctx=c.automation.context;if(auto&&e?.ranged&&!e.thrown&&/bow/i.test(e.name)&&!e.name.includes('Crossbow'))mod=Math.min(modifier(effectiveScore(c,'STR')),e.name.includes('composite')?w.bowStrength||0:0);if(w.damageAbility==='STR'&&mod>0)mod=Math.floor(mod*(usingFlurry(c,w)?1:w.strength==='two'?1.5:w.strength==='off'?.5:1));let bonus=mod+w.damageExtra;
 if(auto){bonus+=stackBonuses([{value:Math.max(w.enhancement||0,/bow/i.test(w.name)&&classLevel(c,'arcane-archer')?Math.ceil(classLevel(c,'arcane-archer')/2):0),type:'enhancement',source:'weapon'},...effectTerms(c,'damage',weaponContext(c,w))]);if(hasFeat(c,'Weapon Specialization',w.name))bonus+=2;if(hasFeat(c,'Greater Weapon Specialization',w.name))bonus+=2;if(hasFeat(c,'Power Attack')&&weaponContext(c,w).weapon==='melee'&&(e?.hands!=='light'||e?.name==='Unarmed strike'))bonus+=Math.min(c.bab,ctx.powerAttack)*(w.strength==='two'?2:1);if(hasFeat(c,'Point Blank Shot')&&weaponContext(c,w).weapon==='ranged'&&ctx.distance>0&&ctx.distance<=30)bonus++;if(ctx.smite&&classLevel(c,'paladin')&&ctx.targetType==='evil')bonus+=classLevel(c,'paladin');if(ctx.smite&&classLevel(c,'blackguard')>=2&&ctx.targetType==='good')bonus+=classLevel(c,'blackguard');}
 let normal=withBonus(parseDiceFormula(weaponDice(c,w)).formula,bonus);if(critical){const n=weaponCritical(c,w).multiplier;normal=parseDiceFormula(normal).terms.map((t:any,i:number)=>`${t.sign<0?'-':i?'+':''}${t.kind==='dice'?t.count*n+'d'+t.sides:t.value*n}`).join('');}if(w.extraDamage)normal+='+'+diceFormula(c,w.extraDamage);if(auto&&ctx.sneakAttack&&(weaponContext(c,w).weapon!=='ranged'||ctx.distance<=30)&&resourceNumbers(c).sneakDice)normal+='+'+resourceNumbers(c).sneakDice+'d6';return parseDiceFormula(normal).formula;}
export function attackCount(c:Character){return Math.max(1,Math.min(4,Math.ceil(c.bab/5)));}
export function attackRoutine(c:Character,w:Weapon){const ctx=c.automation.context,ranged=weaponContext(c,w).weapon==='ranged';if(c.automation.enabled&&(effectActive(c,'slow')||ctx.defensive==='total'||effectActive(c,'stunned')))return ctx.defensive==='total'||effectActive(c,'stunned')?[]:[{label:'Attack',iteration:0}];const off=c.automation.enabled&&ctx.twoWeapon&&w.strength==='off';let n=off?1:attackCount(c);if(off&&(hasFeat(c,'Improved Two-Weapon Fighting')||rangerStyle(c,'two-weapon')>=6))n++;if(off&&(hasFeat(c,'Greater Two-Weapon Fighting')||rangerStyle(c,'two-weapon')>=11))n++;const routine=Array.from({length:n},(_,i)=>({label:i===0?'Attack':'Attack '+(i+1),iteration:i}));if(c.automation.enabled&&!off){if(effectActive(c,'haste'))routine.push({label:'Haste',iteration:0});if(ctx.rapidShot&&ranged&&(hasFeat(c,'Rapid Shot')||c.automation.rangerStyle==='archery'&&classLevel(c,'ranger')>=2&&equippedArmor(c).category<=1))routine.push({label:'Rapid shot',iteration:0});if(ctx.flurry&&movement(c).free&&classLevel(c,'monk')&&['Unarmed strike','Kama','Nunchaku','Quarterstaff','Sai','Shuriken (5)','Siangham'].includes(equipmentById(w.catalogId)?.name||w.name)){routine.push({label:'Flurry',iteration:0});if(classLevel(c,'monk')>=11)routine.push({label:'Greater flurry',iteration:0})}}return routine;}
export function spellDC(c:Character,p:Caster,s:KnownSpell,reference?:Spell){const school=(reference||s.custom)?.school.split(/[ (]/)[0]||'';return 10+s.level+modifier(effectiveScore(c,p.ability))+p.dcExtra+(c.automation.enabled?(hasFeat(c,'Spell Focus',school)?1:0)+(hasFeat(c,'Greater Spell Focus',school)?1:0)+(school==='Illusion'&&racialTraits(c)?.id.includes('gnome')&&racialTraits(c)?.id!=='whisper-gnome'?1:0)+combined(c,['spellDC','spellDC.'+school]):0);}
export function spellPenetration(c:Character,p:Caster){return p.level+p.penetration+(c.automation.enabled?(hasFeat(c,'Spell Penetration')?2:0)+(hasFeat(c,'Greater Spell Penetration')?2:0)+effectBonus(c,'penetration'):0);}
export function preparedAt(p:Caster,level:number){return p.spells.filter(s=>s.slotLevel===level).reduce((a,s)=>a+s.prepared,0);}
export function castingProblem(p:Caster,s:KnownSpell,c?:Character){
 if(c?.automation.enabled&&effectiveScore(c,p.ability)<10+s.level)return p.ability+' must be at least '+(10+s.level)+' to cast this spell.';
 const slot=p.slots[s.slotLevel];
 if(!slot||slot.max<=0)return 'No daily slots are available at this level.';
 if(p.mode==='prepared'){
  if(preparedAt(p,s.slotLevel)>slot.max)return 'Too many spells are prepared at this level. Adjust preparation to the current slot limit.';
  if(s.spent>=s.prepared)return 'Prepare an unspent copy of this spell first.';
 }else if(slot.used>=slot.max)return 'No daily slots remain at this level.';
 return '';
}
export function canCast(p:Caster,s:KnownSpell,c?:Character){return !castingProblem(p,s,c);}
export function spendSpell(p:Caster,s:KnownSpell,c?:Character):Caster {
 const problem=castingProblem(p,s,c);if(problem)throw new Error(problem);
 if(p.mode==='prepared')return {...p,spells:p.spells.map(x=>x.id===s.id?{...x,spent:x.spent+1}:x)};
 return {...p,slots:p.slots.map((x,i)=>i===s.slotLevel?{...x,used:x.used+1}:x)};
}
export function resetDaily(c:Character):Character{return {...c,factotum:{...c.factotum,spent:0,knowledgeUsed:[],pietyUsed:0,dodgeUsed:false,spells:[]},ancestry:{...c.ancestry,powerPointsSpent:0},psionics:c.psionics.map(p=>({...p,spent:0,focused:false})),casters:c.casters.map(p=>({...p,slots:p.slots.map(x=>({...x,used:0})),spells:p.spells.map(s=>({...s,spent:0}))})),features:c.features.map(f=>({...f,used:0}))};}
export function spellFormula(s:Spell,cl:number):string {
 const cure:Record<string,[number,number]>={'cure-light-wounds':[1,5],'cure-moderate-wounds':[2,10],'cure-serious-wounds':[3,15],'cure-critical-wounds':[4,20],'inflict-light-wounds':[1,5],'inflict-moderate-wounds':[2,10],'inflict-serious-wounds':[3,15],'inflict-critical-wounds':[4,20]};
 if(cure[s.id])return `${cure[s.id][0]}d8+${Math.min(cl,cure[s.id][1])}`;
 const fixed:Record<string,string>={'acid-splash':'1d3','ray-of-frost':'1d3','acid-arrow':'2d4','acid-fog':'2d6','cure-minor-wounds':'1','inflict-minor-wounds':'1'};
 if(fixed[s.id])return fixed[s.id];
 if(s.id==='magic-missile'){const n=Math.min(5,1+Math.floor((cl-1)/2));return `${n}d4+${n}`;}
 if(s.id==='burning-hands')return `${Math.min(5,cl)}d4`;
 if(['fireball','lightning-bolt','cone-of-cold'].includes(s.id))return `${Math.min(s.id==='cone-of-cold'?15:10,cl)}d6`;
 if(['heal','harm'].includes(s.id))return String(Math.min(150,cl*10));
 if(['mass-cure-light-wounds','mass-inflict-light-wounds'].includes(s.id))return `1d8+${Math.min(cl,25)}`;
 if(['mass-cure-moderate-wounds','mass-inflict-moderate-wounds'].includes(s.id))return `2d8+${Math.min(cl,30)}`;
 if(['mass-cure-serious-wounds','mass-inflict-serious-wounds'].includes(s.id))return `3d8+${Math.min(cl,35)}`;
 if(['mass-cure-critical-wounds','mass-inflict-critical-wounds'].includes(s.id))return `4d8+${Math.min(cl,40)}`;
 const caps:Record<string,[number,number]>={'shocking-grasp':[6,5],'snowball-swarm':[6,5],'vampiric-touch':[6,10],'searing-light':[8,5],'sound-burst':[8,1],'shout':[6,5],'greater-shout':[6,10],'delayed-blast-fireball':[6,20],'chain-lightning':[6,20],'prismatic-spray':[6,0],'horrid-wilting':[6,20],'polar-ray':[6,25],'flame-strike':[6,15],'sunbeam':[6,4],'sunburst':[6,6],'fire-storm':[6,20],'cone-of-cold':[6,15],'burning-hands':[4,5],'chill-touch':[6,1]};
 if(s.id==='vampiric-touch')return `${Math.max(1,Math.min(10,Math.floor(cl/2)))}d6`;
 if(s.id==='searing-light')return `${Math.max(1,Math.min(5,Math.floor(cl/2)))}d8`;
 if(s.id==='disintegrate')return `${Math.min(40,cl*2)}d6`;
 if(s.id==='scorching-ray')return '4d6';
 if(s.id==='enervation')return '1d4';
 if(s.id==='energy-drain')return '2d4';
 if(s.id==='ray-of-enfeeblement')return `1d6+${Math.min(5,Math.floor(cl/2))}`;
 if(s.id==='spiritual-weapon')return `1d8+${Math.min(5,Math.floor(cl/3))}`;
 if(s.id==='flaming-sphere')return '2d6';
 if(s.id==='produce-flame')return `1d6+${Math.min(5,cl)}`;
 if(s.id==='call-lightning')return '3d6';
 if(s.id==='call-lightning-storm')return '5d6';
 if(s.id==='inflict-minor-wounds')return '1';
 if(s.id==='ice-storm')return '3d6+2d6';
 if(s.id==='meteor-swarm')return '2d6+6d6';
 if(s.id==='aid')return `1d8+${Math.min(10,cl)}`;
 if(s.id==='false-life')return `1d10+${Math.min(10,cl)}`;
 if(s.id==='mass-heal')return String(Math.min(250,10*cl));
 if(s.id==='regenerate')return `4d8+${cl}`;
 if(s.id==='wall-of-fire')return `2d6+${Math.min(20,cl)}`;
 if(s.id==='wall-of-ice')return `1d6+${cl}`;
 if(caps[s.id]?.[1])return `${Math.max(1,Math.min(caps[s.id][1],cl))}d${caps[s.id][0]}`;
 return '';
}
export function scaledSpellText(value:string,cl:number){if(/^Close\b/i.test(value))return `${25+5*Math.floor(cl/2)} ft. (close)`;if(/^Medium\b/i.test(value))return `${100+10*cl} ft. (medium)`;if(/^Long\b/i.test(value))return `${400+40*cl} ft. (long)`;return value.replace(/(\d+)\s*(rounds?|minutes?|min\.?|hours?|days?|ft\.?)\s*\/\s*level\b/gi,(_,n:string,unit:string)=>`${Number(n)*cl} ${unit}`);}
export function makeSpellRoll(c:Character,p:Caster,k:KnownSpell,s:Spell):Roll {
 const dc=/^none\b/i.test(s.save)?s.save:`${s.save} (DC ${spellDC(c,p,k,s)})`;
 return {title:s.name,details:k.notes,fields:[['Tradition',p.name],['Spell level',String(k.level)],['Caster level',String(p.level)],['Casting time',s.castingTime],['Components',s.components],['Range',scaledSpellText(s.range,p.level)],['Target / area',s.target],['Duration',scaledSpellText(s.duration,p.level)],['Save',dc],['Spell resistance',s.resistance],['Summary',s.description.slice(0,1600)]]};
}
export function makeMacro(roll:Roll,name:string,whisper=false){
 const fields:Array<[string,string]>=[['name',roll.title],['Character',name],...(roll.fields||[])];
 let m=`${whisper?'/w gm ':''}&{template:default} `+fields.map(([k,v])=>`{{${macroLabel(k)}=${macroLabel(v)}}}`).join(' ');
 if(roll.formula)m+=` {{Roll=[[${parseDiceFormula(roll.formula).formula}]]}}`;
 if(roll.details)m+=` {{Details=${macroLabel(roll.details)}}}`;
 return m;
}
export function makeRequest(roll:Roll,name:string,url:string,whisper=false){const u=new URL(url);return {action:'roll',type:'chat-message',roll:'0',advantage:0,whisper:whisper?1:0,character:{name:macroLabel(name),type:'BarrowSheet',source:'Barrow Ledger',url:u.origin+u.pathname},name:macroLabel(roll.title),message:makeMacro(roll,name,whisper)};}
