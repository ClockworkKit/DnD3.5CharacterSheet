import type {Character,Spell,Weapon} from './model.ts';
import type {SpellAttackSettings} from './spell-attack-schema.ts';
import {spellAttackSchema} from './spell-attack-schema.ts';
import {spellEffectTargetNote} from './spell-effect-targets.ts';
import {weaponAttack,sheetTotals,withBonus,type Roll} from './rules.ts';
import {hasFeat} from './effects.ts';
import {armorProficient,equippedArmor,gearEquipment} from './equipment.ts';

export const spellAttackModes:Array<[SpellAttackSettings['mode'],string]>=[['auto','Automatic from spell'],['none','No attack / willing target'],['melee-touch','Melee touch vs touch AC'],['ranged-touch','Ranged touch vs touch AC'],['melee','Melee vs normal AC'],['ranged','Ranged vs normal AC'],['spiritual-weapon','Spiritual Weapon (BAB + Wisdom)']];
const key=(s:Spell)=>s.name.toLowerCase().replace(/[’']/g,'').trim();
const rays=(cl:number)=>Math.max(1,Math.min(3,1+Math.floor((cl-3)/4)));

/** Only infer delivery, never execute text or treat a mention of attack bonuses as an attack. */
export function spellAttackProfile(s:Spell,cl:number,settings=s.attack){
 const name=key(s),text=s.description.replace(/\s+/g,' '),touch=/^touch\b/i.test(s.range);
 let mode:SpellAttackSettings['mode']='none',count=1,note='No automatic attack detected. Choose a delivery below for a hostile touch, a conditional attack, or an unrecognized spell.';
 // These spells create equipment, buffs, or conditional/delayed attacks, not a cast-time strike.
 const deferred=['animate rope','fire seeds','fireball','delayed blast fireball','spectral hand','flame blade','produce flame','blistering radiance','waterball','darkfire','spiritual guardian','wraithstrike','find the gap','darts of life','dispel evil','dispel good','dispel law','dispel chaos','dispel cold','blackstaff','undying aura','prismatic eye','light of lunia','light of mercuria','light of venya','nimbus of light','stars of arvandor','stars of mystra'];
 if(name==='spiritual weapon'){mode='spiritual-weapon';note='One attack on casting or retargeting, against normal AC. Later uninterrupted rounds may use BAB iteratives; feats and combat actions do not modify this weapon.';}
 else if(s.id==='supp-fiery-vision'){mode='ranged-touch';count=2;note='Two rays against one or two opponents, each with its own ranged touch attack and 4d6 fire damage. Choose No attack if not firing on completion. Later rounds require a standard action to concentrate and fire; use attack-only rolls without casting or spending another preparation, and resolve damage separately.';}
 else if(name==='scorching ray'||name==='splinterbolt'){mode=name==='scorching ray'?'ranged-touch':'ranged';count=rays(cl);note='Each projectile has its own attack and effect roll. Choose targets within 30 feet of each other.';}
 else if(name==='shocking spark'){mode='ranged-touch';count=cl>=10?3:cl>=6?2:1;note='Each spark rolls a separate ranged touch attack and 4d6 electricity damage. Against a qualifying metal target, enter +3 in Conditional attack adjustment; resolve its x3 critical damage separately.';}
 else if(name==='scourge of force'){mode='melee-touch';count=Math.max(1,Math.min(4,1+Math.floor(cl/3)));note='Each tendril uses your highest melee touch attack bonus, not iterative penalties. Choose targets within 30 feet of each other; multiple tendrils may hit one target.';}
 else if(name==='flesh ripper'&&/ranged touch attack/i.test(text)){mode='ranged-touch';note='Resolve one ranged touch against a living target. A confirmed critical doubles damage and causes 1 damage per round until magically healed; resolve that bleeding separately. Check the spell\'s Undead and Fiend components.';}
 else if(name==='meteor swarm'){mode='ranged-touch';count=4;note='Each meteor may target a creature or a point. Ignore its attack and impact damage when targeting a point; fire still explodes on a miss. Resolve each area save separately.';}
 else if(!deferred.includes(name)){
  // A ray effect or an explicit caster instruction is stronger evidence than a generic mention.
  if(name==='energy drain'||/^(?:one or more |one |a )?rays?\b/i.test(s.target)||/you (?:must )?(?:(?:make|succeed (?:on|at)) (?:a |on a )?(?:successful )?)ranged touch attack/i.test(text)||/^(?:Make a ranged touch attack|.*?You spit .*?with a successful ranged touch attack)/i.test(text))mode='ranged-touch';
  else if(/you must make a (?:successful )?ranged attack to hit/i.test(text))mode='ranged';
  else if(/^(?:inflict (?:minor|light|moderate|serious|critical) wounds|harm|contagion|bestow curse|blight|death knell|imprisonment)$/.test(name)||touch&&!/harmless|willing/i.test(s.save+' '+s.target)&&/(?:melee )?touch attack/i.test(text)&&!/\b(?:weapon|staff|ally)\b/i.test(s.target))mode='melee-touch';
  if(mode!=='none')note='Apply effects only on a hit, then resolve saves, resistance and critical threats. Multi-projectile or special delivery rules may require adjustments below.';
 }
 const chosen=settings?spellAttackSchema.parse(settings):undefined;
 const targetNote=spellEffectTargetNote(s,chosen);if(targetNote)note+=' '+targetNote;
 if(chosen?.mode&&chosen.mode!=='auto')mode=chosen.mode;
 count=mode==='spiritual-weapon'?1:chosen?.count??count;
 const fixedPenalty=name==='blinding spittle'?-4:0;
 if(fixedPenalty)note+=' Includes Blinding Spittle\'s -4 attack penalty.';
 return {mode,count,bonus:(chosen?.bonus??0)+fixedPenalty,note,ray:/\brays?\b/i.test(s.target)||name==='scorching ray'};
}

/** A read-only calculation view shared by spells and weaponlike spell-like abilities. */
export function spellAttackCharacter(c:Character):Character{
 // Casting is not a weapon full attack: never inherit TWF, Rapid Shot, flurry, charge or smite.
 const context={...c.automation.context,twoWeapon:false,rapidShot:false,flurry:false,charge:false,smite:false};
 // Reuse general attack rules without inheriting weapon-only global adjustments.
 // This is a calculation view, not an edit to the player's saved weapon settings.
 return {...c,globalCombat:undefined,automation:{...c.automation,context}};
}

export function spellAttackBonus(c:Character,s:Spell,cl:number,settings?:SpellAttackSettings){
 const profile=spellAttackProfile(s,cl,settings),t=sheetTotals(c);
 if(profile.mode==='spiritual-weapon')return c.bab+t.mods.WIS+profile.bonus;
 const ranged=profile.mode.startsWith('ranged'),touch=profile.mode==='melee-touch';
 const attackCharacter=spellAttackCharacter(c);
 let ability:Weapon['ability']=ranged?'DEX':'STR',finessePenalty=0;
 if(touch&&c.automation.enabled&&hasFeat(c,'Weapon Finesse')){
  for(const g of equippedArmor(c).selected){const e=gearEquipment(g)!;if(e.kind==='shield'&&(g.proficient??armorProficient(c,e)))finessePenalty+=Math.min(0,e.checkPenalty!+(g.material==='mithral'?3:g.masterwork||g.enhancement||g.material==='adamantine'?1:0));}
  if(t.mods.DEX+finessePenalty>t.mods.STR)ability='DEX';else finessePenalty=0;
 }
 const w:Weapon={id:'spell-attack',name:profile.ray?'Ray':touch?'Touch spell':s.name,ability,attack:0,damage:'0',damageAbility:'none',strength:'one',damageExtra:0,crit:'20 / x2',range:ranged?'Ranged':'Melee',attackMode:ranged?'ranged':'melee',proficiency:'yes',ammo:0,notes:''};
 return weaponAttack(attackCharacter,w)+finessePenalty+profile.bonus;
}

/** Add attack/effect pairs to the same request; generating a roll never spends a resource. */
export function withSpellAttacks(c:Character,s:Spell,cl:number,roll:Roll,settings?:SpellAttackSettings):Roll{
 const p=spellAttackProfile(s,cl,settings);if(p.mode==='none')return roll;
 const bonus=spellAttackBonus(c,s,cl,settings),label=spellAttackModes.find(([id])=>id===p.mode)![1],rows:NonNullable<Roll['rolls']>=[];
 for(let i=0;i<p.count;i++){
  const prefix=p.count>1?`${i+1}. `:'';
  rows.push({label:prefix+label,formula:withBonus('1d20',bonus)});
  if(key(s)==='meteor swarm'&&roll.formula==='2d6+6d6')rows.push({label:prefix+'Impact on hit (bludgeoning)',formula:'2d6'},{label:prefix+'Explosion (fire; check save)',formula:'6d6'});
  else if(roll.formula)rows.push({label:prefix+'Effect on hit',formula:roll.formula});
 }
 return {...roll,formula:undefined,rolls:rows,details:[roll.details,p.note].filter(Boolean).join(' ')};
}

export function makeSpellAttackOnlyRoll(c:Character,s:Spell,cl:number,settings?:SpellAttackSettings):Roll{
 return withSpellAttacks(c,s,cl,{title:s.name+' - attack only',details:'No spell slot, preparation or inspiration spent. Use only for a valid held charge or ongoing spell; this does not cast the spell again.'},settings);
}
