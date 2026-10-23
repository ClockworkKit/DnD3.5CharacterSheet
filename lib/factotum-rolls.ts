import type {Character,Spell} from './model.ts';
import {withSpellAttacks} from './spell-attacks.ts';
import {factotumNumbers,cunningKnowledgeProblem} from './factotum.ts';
import {spellFormula,scaledSpellText,skillBonus,withBonus,type Roll} from './rules.ts';

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
