import type {Spell} from './model.ts';

export const axeBrotherDomainList='Dwarf / Strength';
// Spell Compendium p.273. Elemental Swarm is restricted to earth elementals.
const dwarfSpells=['magic-weapon','bears-endurance','glyph-of-warding','magic-weapon-greater','fabricate','stone-tell','dictum','protection-from-spells','elemental-swarm'];
export function addClericDomainLists(spells:Spell[]){
 for(const s of spells){
  const dwarf=dwarfSpells.indexOf(s.id);
  if(dwarf>=0)s.levels.Dwarf=dwarf+1;
  const levels=[s.levels.Dwarf,s.levels.Strength].filter((n):n is number=>n!==undefined);
  if(levels.length)s.levels[axeBrotherDomainList]=Math.min(...levels);
 }
}
