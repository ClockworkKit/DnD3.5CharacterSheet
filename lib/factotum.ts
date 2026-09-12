import type {Character, Spell} from './model.ts';
import {effectiveScore} from './ancestry.ts';

export const factotumLevel = (c:Character) => c.classLevels.filter(x=>x.classId==='factotum').reduce((n,x)=>n+x.level,0);
export function factotumNumbers(c:Character) {
  const level=factotumLevel(c), index=Math.min(20,level)-1;
  const inspiration=([2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,10][index]||0)+(level?c.factotum.inspirationExtra:0);
  const maxSpellLevel=[-1,0,1,1,2,2,2,3,3,4,4,4,5,5,6,6,6,7,7,7][index]??-1;
  const spells=[2,4,7,9,12,14,17,20].filter(n=>level>=n).length;
  return {level,inspiration,remaining:Math.max(0,inspiration-c.factotum.spent),maxSpellLevel,spells,
    intelligence:Math.floor((effectiveScore(c,'INT')-10)/2),
    piety:level<5?0:3+Math.max(0,Math.floor((effectiveScore(c,'WIS')-10)/2))+Math.floor(level/5)-1};
}
export function spendInspiration(c:Character,cost:number) {
  if(!Number.isInteger(cost)||cost<1||cost>factotumNumbers(c).remaining)throw new Error('Not enough inspiration points.');
  c.factotum.spent+=cost;
}
export function brainsOverBrawn(c:Character,ability:string) {
  return c.automation.enabled&&factotumLevel(c)>=3&&['STR','DEX'].includes(ability)?Math.max(0,factotumNumbers(c).intelligence):0;
}
export function dilettanteProblem(c:Character,spell:Spell,others=c.factotum.spells.map(x=>x.spell)):string {
  const n=factotumNumbers(c),level=spell.levels['Sorcerer / Wizard'];
  if(n.level<2||level===undefined||level>n.maxSpellLevel||effectiveScore(c,'INT')<10+level)return 'This spell is above your available Arcane Dilettante level or Intelligence.';
  if(/\bXP\b/i.test(spell.components))return 'Arcane Dilettante cannot use spells with an XP cost.';
  if(others.some(s=>s.id===spell.id))return 'Choose each spell only once per day.';
  if(others.length>=n.spells)return 'All daily Arcane Dilettante choices are filled.';
  if(level===n.maxSpellLevel&&others.some(s=>s.levels['Sorcerer / Wizard']===level))return 'Only one daily choice can be at your maximum spell level.';
  return '';
}
export function chooseDilettante(c:Character,spell:Spell) {
  const problem=dilettanteProblem(c,spell);if(problem)throw new Error(problem);
  c.factotum.spells.push({spell:structuredClone(spell),spent:false});
}
export function useDilettante(c:Character,id:string) {
  const choice=c.factotum.spells.find(s=>s.spell.id===id);if(!choice||choice.spent)throw new Error('That spell has already been used or is not selected.');
  const problem=dilettanteProblem(c,choice.spell,c.factotum.spells.filter(s=>s!==choice).map(s=>s.spell));if(problem)throw new Error(problem);
  spendInspiration(c,1);choice.spent=true;
}
