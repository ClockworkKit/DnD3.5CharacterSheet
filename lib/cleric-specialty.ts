import type {Character,Spell} from './model.ts';
import {findClass,makeCaster} from './classes.ts';
import {effectiveScore} from './ancestry.ts';
import {addEffect} from './effects.ts';

export const silverbeard:Spell={
  id:'silverbeard',name:'Silverbeard',school:'Transmutation',levels:{Paladin:1,'Axe Brother of Clangeddin':1},
  levelText:'Paladin 1; Axe Brother cleric 1 (campaign specialty)',components:'V, S',castingTime:'1 standard action',
  range:'Personal',target:'You',duration:'1 minute/level',save:'None',resistance:'No',
  description:'Your beard becomes magically hardened silver, growing one if necessary. Gain +2 sacred AC and +2 circumstance on Diplomacy checks involving dwarves. Axe Brother access at cleric spell level 1 is a campaign rule; normal cleric progression and domain choices remain unchanged.',
  source:'https://dndtools.net/spells/spell-compendium--86/silverbeard--4170/'
};
export function applyClericSpecialty(c:Character,specialty:Character['clericSpecialty']) {
  if(specialty==='none'){c.clericSpecialty=specialty;return;} // Keep recorded spells and spent uses.
  const level=c.classLevels.filter(x=>x.classId==='cleric').reduce((n,x)=>n+x.level,0);
  if(!level)throw new Error('Add a Cleric level before choosing this specialty.');
  // Old native/manual books may identify their class only by name or list.
  // An explicit different class link or a domain book must never be repurposed.
  const candidates=c.casters.filter(p=>!p.casting?.domain&&(p.casting?.classId?p.casting.classId==='cleric':(findClass(p.name)||findClass(p.list))?.id==='cleric'));
  if(candidates.length>1)throw new Error('More than one ordinary Cleric spellbook is recorded. Review the casting traditions in Magic before choosing this specialty.');
  const caster=candidates[0]||makeCaster(findClass('cleric')!,level,effectiveScore(c,'WIS'));
  c.clericSpecialty=specialty;c.deity='Clangeddin Silverbeard';
  if(!candidates.length)c.casters.push(caster);
  if(!caster.spells.some(s=>s.spellId==='silverbeard'))caster.spells.push({id:crypto.randomUUID(),spellId:'silverbeard',level:1,slotLevel:1,prepared:0,spent:0,formula:'',notes:'Axe Brother specialty spell. Prepare using an ordinary cleric slot.',custom:structuredClone(silverbeard)});
}
export function activateSilverbeard(c:Character,casterLevel:number) {
  let effect=c.effects.find(e=>e.preset==='silverbeard');
  if(!effect){addEffect(c,'silverbeard');effect=c.effects.find(e=>e.preset==='silverbeard');}
  if(effect){effect.active=true;effect.casterLevel=casterLevel;effect.rounds=10*casterLevel;}
}
