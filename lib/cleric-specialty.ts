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
  c.clericSpecialty=specialty;
  if(specialty==='none')return; // Keep recorded spells and spent uses when changing a specialty.
  const level=c.classLevels.filter(x=>x.classId==='cleric').reduce((n,x)=>n+x.level,0);
  if(!level)throw new Error('Add a Cleric level before choosing this specialty.');
  c.deity='Clangeddin Silverbeard';
  let caster=c.casters.find(p=>p.casting?.classId==='cleric'&&!p.casting.domain);
  if(!caster){caster=makeCaster(findClass('cleric')!,level,effectiveScore(c,'WIS'));c.casters.push(caster);}
  if(!caster.spells.some(s=>s.spellId==='silverbeard'))caster.spells.push({id:crypto.randomUUID(),spellId:'silverbeard',level:1,slotLevel:1,prepared:0,spent:0,formula:'',notes:'Axe Brother specialty spell. Prepare using an ordinary cleric slot.',custom:structuredClone(silverbeard)});
}
export function activateSilverbeard(c:Character,casterLevel:number) {
  let effect=c.effects.find(e=>e.preset==='silverbeard');
  if(!effect){addEffect(c,'silverbeard');effect=c.effects.find(e=>e.preset==='silverbeard');}
  if(effect){effect.active=true;effect.casterLevel=casterLevel;effect.rounds=10*casterLevel;}
}
