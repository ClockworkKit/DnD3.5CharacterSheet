import type {Character} from './model.ts';
import {systemLimits} from './class-systems.ts';
export const magicalSystemIds=['warlock','dragonfire-adept','artificer','healer','binder','incarnate','soulborn','totemist','shadowcaster','truenamer'];
export const isSpellLikeFeature=(f:Character['features'][number])=>f.kind!=='Feat'&&(f.magic??(/spell[- ]like|— racial|\bAbundant step\b/i.test(f.description+' '+f.name)));
export function magicSections(c:Character){return {
 spells:c.casters.length>0,
 powers:c.psionics.length>0,
 factotum:c.classLevels.some(e=>e.classId==='factotum'&&e.level>0),
 systems:c.classLevels.some(e=>magicalSystemIds.includes(e.classId)&&(systemLimits(c,e.classId)||e.classId==='artificer'||e.classId==='healer'&&e.level>=20))||c.classSystems.choices.some(s=>magicalSystemIds.includes(s.classId)),
 abilities:c.features.some(isSpellLikeFeature),
};}

export const spellLikeUsesTracked=(f:Character['features'][number])=>f.max>0||!!f.formula||!!f.ruleId?.match(/^(daily|supp):/);
export const canUseSpellLike=(f:Character['features'][number])=>!spellLikeUsesTracked(f)||f.used<f.max;
export function spendSpellLike(c:Character,id:string){const f=c.features.find(f=>f.id===id);if(!f||!canUseSpellLike(f))throw new Error('No uses remain for this ability.');if(spellLikeUsesTracked(f))f.used++;}
