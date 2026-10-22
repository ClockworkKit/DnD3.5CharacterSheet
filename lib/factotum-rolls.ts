import type {Character,Spell} from './model.ts';
import {factotumNumbers} from './factotum.ts';
import {spellFormula,scaledSpellText,type Roll} from './rules.ts';

/** A Dilettante use is a spell-like ability, not a spend from a wizard slot pool. */
export function makeDilettanteRoll(c:Character,s:Spell):Roll {
 const n=factotumNumbers(c),level=s.levels['Sorcerer / Wizard'];
 if(level===undefined)throw new Error('Arcane Dilettante requires a sorcerer/wizard spell.');
 const formula=spellFormula(s,n.casterLevel);
 return {title:s.name+' — Arcane Dilettante',...(formula?{formula}:{}),
  details:'Spell-like ability; costs 1 inspiration and this daily spell choice. Resolve targets, saves and any attack separately.',
  fields:[['Spell level',String(level)],['Caster level',String(n.casterLevel)],['Casting time',s.castingTime],
   ['Components',s.components],['Range',scaledSpellText(s.range,n.casterLevel)],['Target / area',s.target],
   ['Duration',scaledSpellText(s.duration,n.casterLevel)],['Save',/^none\b/i.test(s.save)?s.save:`${s.save} (DC ${10+level+n.intelligence})`],
   ['Spell resistance',s.resistance],...(formula?[['Effect roll',formula] as [string,string]]:[]),['Summary',s.description.slice(0,1600)]]};
}
