import type {Character,Spell} from './model.ts';
import {withSpellAttacks} from './spell-attacks.ts';
import {factotumNumbers,cunningKnowledgeProblem,opportunisticPietyProblem} from './factotum.ts';
import {effectiveScore} from './ancestry.ts';
import {effectBonus,hasFeat} from './effects.ts';
import {resourceNumbers} from './automation.ts';
import {spellFormula,scaledSpellText,skillBonus,withBonus,type Roll} from './rules.ts';

export type PietyAction='heal'|'harm-undead'|'turn-undead';
export const pietyActions:Array<[PietyAction,string]>=[['heal','Heal a living creature'],['harm-undead','Harm an undead creature'],['turn-undead','Turn undead']];

export function makeOpportunisticPietyRoll(c:Character,action:PietyAction):Roll{
 const problem=opportunisticPietyProblem(c);if(problem)throw new Error(problem);
 const label=pietyActions.find(([id])=>id===action)?.[1];if(!label)throw new Error('Choose a supported Piety action.');
 const n=factotumNumbers(c),amount=2*n.level+n.intelligence;
 const roll:Roll={title:'Opportunistic Piety - '+label,details:'Standard action; costs 1 inspiration and 1 daily Piety use. Resolve the target at the table; this does not automatically change HP.',fields:[['Type','Supernatural ability'],['Factotum level',String(n.level)]]};
 if(action!=='turn-undead'){
  roll.fields!.push([action==='heal'?'Healing':'Positive energy damage',String(amount)]);
  roll.details+=' '+(action==='heal'?`Heal a living creature for ${amount} HP.`:`Deal ${amount} positive energy damage to an undead creature. Confirm targeting and any required touch attack with your DM.`);
  return roll;
 }
 const level=n.level+(hasFeat(c,'Improved Turning')?1:0),cha=Math.floor((effectiveScore(c,'CHA')-10)/2);
 roll.fields!.push(['Effective turning level',String(level)]);
 roll.rolls=[{label:'Turning check',formula:withBonus('1d20',resourceNumbers(c).turnCheck)},{label:'Total undead HD affected',formula:withBonus('2d6',level+cha+effectBonus(c,'turnDamage'))}];
 roll.details+=' Use the turning table and effective turning level for the strongest undead affected. Resolve range, turn resistance and destruction normally. Piety cannot rebuke or control undead; this does not spend a separate cleric turning use.';
 return roll;
}

export function makeCunningKnowledgeRoll(c:Character,skillId:string):Roll {
 const problem=cunningKnowledgeProblem(c,skillId);if(problem)throw new Error(problem);
 const skill=c.skills.find(s=>s.id===skillId)!,level=factotumNumbers(c).level;
 return {title:skill.name+' — Cunning Knowledge',formula:withBonus('1d20',skillBonus(c,skill)+level),details:`Includes +${level} Cunning Knowledge. Costs 1 inspiration; once per day for this skill.`};
}

/** A Dilettante use is a spell-like ability, not a spend from a wizard slot pool. */
export function makeDilettanteRoll(c:Character,s:Spell):Roll {
 const n=factotumNumbers(c),level=s.levels['Sorcerer / Wizard'];
 if(level===undefined)throw new Error('Arcane Dilettante requires a sorcerer/wizard spell.');
 const formula=spellFormula(s,n.casterLevel);
 return withSpellAttacks(c,s,n.casterLevel,{title:s.name+' — Arcane Dilettante',...(formula?{formula}:{}),
  details:'Spell-like ability; costs 1 inspiration and this daily spell choice. Resolve targets, saves and resistance separately.',
  fields:[['Spell level',String(level)],['Caster level',String(n.casterLevel)],['Casting time',s.castingTime],
   ['Components',s.components],['Range',scaledSpellText(s.range,n.casterLevel)],['Target / area',s.target],
   ['Duration',scaledSpellText(s.duration,n.casterLevel)],['Save',/^none\b/i.test(s.save)?s.save:`${s.save} (DC ${10+level+n.intelligence})`],
   ['Spell resistance',s.resistance],...(formula?[['Effect roll',formula] as [string,string]]:[]),['Summary',s.description.slice(0,1600)]]});
}
