import {clericChannelState} from './cleric-channel.ts';
export {alignmentChannel} from './cleric-channel.ts';
import type {Caster,Character,KnownSpell,Spell} from './model.ts';
import {castingDefinition} from './advancement.ts';
import {featureReplaced} from './alternate-features.ts';
import {castingProblem,makeSpellRoll,spellFormula,spendSpell} from './rules.ts';
import {illumianSpellFormula} from './racial-abilities.ts';

export function hasClericConversion(c:Character,p:Caster){
 return p.mode==='prepared'&&!p.casting?.domain&&castingDefinition(p,c)?.id==='cleric'
  &&!featureReplaced(c,'cleric','spontaneous-casting')&&!featureReplaced(c,'cleric','spellcasting');
}

export function eligibleConversionSpell(c:Character,donor:KnownSpell,spell:Spell){
 const {channel}=clericChannelState(c);
 const level=spell.levels.Cleric;
 return !!channel&&level!==undefined&&level<=Math.min(donor.level,donor.slotLevel)
  &&spell.name.toLowerCase().split(/\W+/).includes(channel);
}

/** Resolve and validate the specific preparation again at the edit boundary. */
function conversionSource(c:Character,casterId:string,donorId:string,spell:Spell){
 const caster=c.casters.find(p=>p.id===casterId);
 const donor=caster?.spells.find(k=>k.id===donorId);
 if(!caster||!donor||!hasClericConversion(c,caster)||!eligibleConversionSpell(c,donor,spell))
  throw new Error('Choose an ordinary Cleric preparation and an eligible cure or inflict spell.');
 const problem=castingProblem(caster,donor,c);
 if(problem)throw new Error(problem);
 return {caster,donor};
}

export function clericConversionRoll(c:Character,casterId:string,donorId:string,spell:Spell,hostileTouch:boolean){
 const {caster,donor}=conversionSource(c,casterId,donorId,spell);
 const level=spell.levels.Cleric;
 const converted:KnownSpell={id:'converted-'+spell.id,spellId:spell.id,level,slotLevel:donor.slotLevel,prepared:1,spent:0,
  formula:'',notes:'Spontaneous Cleric casting.',custom:null,
  ...(/^touch\b/i.test(spell.range)?{attack:{mode:hostileTouch?'melee-touch':'none',bonus:0} as const}:{})};
 const formula=illumianSpellFormula(c,spell,spellFormula(spell,caster.level));
 return makeSpellRoll(c,caster,converted,spell,true,formula);
}

export function spendClericConversion(c:Character,casterId:string,donorId:string,spell:Spell){
 const {caster,donor}=conversionSource(c,casterId,donorId,spell);
 Object.assign(caster,spendSpell(caster,donor,c));
 if(c.racialState.active?.word==='Naenhoon'&&c.racialState.active.targetId===donor.id)c.racialState.active=null;
}
