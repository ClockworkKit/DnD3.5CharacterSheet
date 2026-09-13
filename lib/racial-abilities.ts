import type {Character,Caster,KnownSpell,Weapon,Spell} from './model.ts';
import {findRace,effectiveScore} from './ancestry.ts';
import {hasFeat,type BonusTerm} from './effects.ts';
import {sigils,emptyRacialState} from './racial-state.ts';
export {sigils};
export const racialHD=(c:Character)=>c.classLevels.reduce((n,e)=>n+e.level,0)+c.ancestry.racialHitDice||c.level;
export const racialEnabled=(c:Character)=>c.automation.enabled&&c.ancestry.traitBonuses;
export const isIllumian=(c:Character)=>racialEnabled(c)&&c.ancestry.raceId==='illumian';
export function sigilLimit(c:Character){return c.classLevels.some(e=>e.level>=2)?2:1;}
export function activeSigils(c:Character){return isIllumian(c)&&!c.racialState.suppressed?[...new Set(c.racialState.sigils)].slice(0,sigilLimit(c)):[];}
export function sigilBonus(c:Character){return sigilLimit(c);}
export const wordNames:Record<string,string>={'aesh-krau':'Aeshkrau','aesh-hoon':'Aeshoon','aesh-uur':'Aeshuur','hoon-krau':'Hoonkrau','hoon-vaul':'Hoonvaul','aesh-naen':'Naenaesh','hoon-naen':'Naenhoon','krau-naen':'Naenkrau','hoon-uur':'Uurhoon','krau-uur':'Uurkrau','naen-uur':'Uurnaen','aesh-vaul':'Vaulaesh','krau-vaul':'Vaulkrau','naen-vaul':'Vaulnaen','uur-vaul':'Vauluur'};
export function illumianWord(c:Character){const s=activeSigils(c);return s.length===2?wordNames[s.sort().join('-')]||'':'';}
export function setSigils(c:Character,values:string[]){if(values.length>sigilLimit(c)||new Set(values).size!==values.length||values.some(s=>!sigils.includes(s as typeof sigils[number])))throw new Error('Select distinct sigils within the class-level limit.');c.racialState.sigils=values as typeof c.racialState.sigils;c.racialState.active=null;}
export function krauBonus(c:Character,base:number){return activeSigils(c).includes('krau')&&base>0?Math.max(0,Math.min(sigilBonus(c),racialHD(c)-base)):0;}
export function racialBonusAbility(c:Character,p:Caster,normal:keyof Character['scores']){const w=illumianWord(c);return c.racialState.bonusCasters.includes(p.id)?w==='Aeshkrau'?'STR':w==='Uurkrau'?'DEX':normal:normal;}
export function reservedSlots(c:Character,p:Caster,level:number){return c.racialState.reservations.filter(r=>r.casterId===p.id&&r.level===level).length;}
const hasWord=(c:Character,w:string)=>illumianWord(c)===w;
const wordActive=(c:Character,w:string)=>hasWord(c,w)&&c.racialState.active?.word===w&&c.racialState.active.rounds>0;
const mod=(c:Character,a:keyof Character['scores'])=>Math.max(0,Math.floor((effectiveScore(c,a)-10)/2));
export function glyphStatus(c:Character){if(!isIllumian(c)||!c.racialState.environment.glyph)return 'none';return racialHD(c)>=c.racialState.environment.incomingCasterLevel?'immune':'penalty';}
export function swimSpeed(c:Character){if(!racialEnabled(c))return 0;const r=findRace(c.ancestry.raceId);return r?.swim|| (r?.id==='aquatic-elf'?40:0)|| (r?.element==='water'?c.automation.baseSpeed:0);}
export function racialResistances(c:Character):Partial<Record<string,number>>{if(!racialEnabled(c))return {};const r=findRace(c.ancestry.raceId);return r?.element==='fire'?{fire:5}:{};}
export function racialTerms(c:Character,target:string,context:Record<string,string|number|boolean>={}):BonusTerm[]{
 if(!racialEnabled(c)||!(/^(check\.|skill\.)/.test(target)||['attack','damage','initiative','saves','save.ref','ac.misc','ac.dodge','penetration','turnCheck','turnDamage'].includes(target)))return [];
 const r=findRace(c.ancestry.raceId),env=c.racialState.environment,rows:BonusTerm[]=[];
 const add=(value:number,type='racial',source='racial traits')=>{if(value)rows.push({value,type,source})};
 const active=activeSigils(c),skill=target.startsWith('skill.')?c.skills.find(s=>s.name===target.slice(6)):undefined;
 const a=target.startsWith('check.')?target.slice(6):skill?.ability;
 const map:Record<string,string[]>={aesh:['STR'],hoon:['WIS','CON'],naen:['INT'],uur:['DEX'],vaul:['CHA']};
 if(a&&active.some(s=>map[s]?.includes(a)))add(sigilBonus(c),'untyped','Illumian sigil');
 if(target==='initiative'&&active.includes('uur'))add(sigilBonus(c),'untyped','Uur');
 if(target==='skill.Swim'&&swimSpeed(c))add(8);
 if(target==='saves'&&isIllumian(c)){if(env.shadow)add(2);if(glyphStatus(c)==='penalty')add(-4,'racial','Glyphic resonance');}
 const opposed:Record<string,string>={air:'earth',earth:'air',fire:'water',water:'fire','fire-half':'water','water-half':'fire'};
 const element=r?.element||'',enemy=opposed[element];
 if(target==='attack'&&enemy===env.targetElement)add(1,'racial','Elemental affinity');
 if(target==='saves'&&enemy){const source=env.magicSource===enemy||element==='fire'&&env.magicSource==='cold',descriptor=!element.endsWith('-half')&&(env.magicElement===enemy||element==='fire'&&env.magicElement==='cold');if(source||descriptor)add(element.endsWith('-half')?-1:-2,'racial','Elemental vulnerability');}
 if(target==='ac.dodge'&&r?.id==='air-gnome'&&env.targetElement==='earth'&&env.targetLarge)add(4,'dodge','Air gnome');
 if(target.startsWith('check.')&&env.grounded&&env.resistTrip&&['STR','DEX'].includes(target.slice(6)))add((element==='earth'?4:0)+(r?.type.includes('dwarf')?4:0),'untyped','Stability');
 if(env.stonework&&r?.id==='earth-dwarf'&&(/^skill\.(Search|Appraise)$/.test(target)||target.startsWith('skill.Craft')))add(4,'racial','Earth dwarf stonework');
 if(env.stonework&&r?.id==='earth-kobold'&&target==='skill.Craft (trapmaking)')add(2,'racial','Earth kobold stonework increment');
 const sensitive=['kobold','earth-kobold','aquatic-kobold','orc','water-orc','duergar','deep-dwarf'].includes(r?.id||'');
 if(env.brightLight&&sensitive&&!c.effects.some(e=>e.active&&e.preset==='dazzled')&&['attack','skill.Search','skill.Spot'].includes(target))add(-1,'untyped','Light sensitivity');
 const weapon=String(context.weaponName||''),focused=weapon&&hasFeat(c,'Weapon Focus',weapon),precision=!c.automation.context.precisionImmune;
 if(target==='damage'&&focused&&wordActive(c,'Aeshoon'))add(mod(c,'WIS'),'untyped','Aeshoon');
 if(target==='ac.dodge'&&env.wordTarget&&wordActive(c,'Aeshuur'))add(2,'dodge','Aeshuur');
 const level=c.racialState.active?.level||0;
 if(wordActive(c,'Hoonvaul')&&(['turnCheck','turnDamage'].includes(target)||c.automation.context.smite&&['attack','damage'].includes(target)))add(level,'untyped','Hoonvaul');
 if(wordActive(c,'Uurhoon')){if(target==='save.ref')add(mod(c,'WIS'),'insight','Uurhoon');if(target==='penetration')add(mod(c,'DEX'),'untyped','Uurhoon');}
 if(wordActive(c,'Vaulaesh')&&(target==='ac.misc'||target==='damage'&&focused))add(level,'insight','Vaulaesh');
 if(wordActive(c,'Vaulkrau')&&target==='saves')add(level,'insight','Vaulkrau');
 if(hasWord(c,'Uurnaen')&&target==='attack'&&(weapon==='unarmed strike'||c.automation.context.sneakAttack&&precision&&(context.weapon!=='ranged'||c.automation.context.distance<=30))){const n=Math.max(0,...c.racialState.reservations.filter(r=>r.word==='Uurnaen').map(r=>r.level));add(n,'insight','Uurnaen');}
 return rows;
}
export function illumianDC(c:Character,level:number){return hasWord(c,'Naenkrau')&&c.racialState.reservations.some(r=>r.word==='Naenkrau'&&r.level===level)?1:0;}
export function illumianExtraDice(c:Character,w:Weapon){const melee=w.attackMode==='melee'||w.attackMode!=='ranged'&&w.range==='Melee';return wordActive(c,'Vauluur')&&(w.name.toLowerCase()==='unarmed strike'||c.automation.context.sneakAttack&&!c.automation.context.precisionImmune&&(melee||c.automation.context.distance<=30))?(c.racialState.active!.level||0):0;}
export function illumianSpellFormula(c:Character,s:Spell,formula:string){if(wordActive(c,'Hoonkrau')&&formula&&((c.racialState.active?.mode==='turn'&&/^cure-/i.test(s.id))||(c.racialState.active?.mode==='rebuke'&&/^inflict-/i.test(s.id))))return formula+'+1d8';return formula;}
export function illumianSpellNotes(c:Character,p:Caster,k:KnownSpell){const notes:string[]=[];if(hasWord(c,'Naenaesh')&&p.mode==='prepared'&&c.racialState.reservations.some(r=>r.word==='Naenaesh'&&r.level===k.slotLevel))notes.push('Naenaesh: Still Spell available without raising this prepared spell’s slot level.');if(wordActive(c,'Naenhoon')&&c.racialState.active?.targetId===k.id)notes.push('Naenhoon: '+c.racialState.active.mode+' paid with turning attempts; apply the metamagic effect.');return notes.join(' ');}
export function racialWarnings(c:Character){const warnings:string[]=[];if(c.ancestry.raceId==='illumian'&&c.racialState.sigils.length<sigilLimit(c))warnings.push('Choose '+sigilLimit(c)+' Illumian power sigil(s) in Race.');if(glyphStatus(c)==='immune')warnings.push('Glyphic resonance: immune to this symbol-based effect. Do not roll a saving throw.');const r=findRace(c.ancestry.raceId);if(r?.waterBreathing&&!c.racialState.environment.underwater)warnings.push('Water breathing only: out-of-water breath limit '+(2*effectiveScore(c,'CON'))+' rounds.');return warnings;}
export function spendFreeSlot(c:Character,casterId:string,level:number){const p=c.casters.find(p=>p.id===casterId);if(!p||!Number.isInteger(level)||level<0||level>9)throw new Error('Choose a valid spell slot.');const s=p.slots[level],prepared=p.mode==='prepared'?p.spells.filter(k=>k.slotLevel===level).reduce((n,k)=>n+k.prepared,0):0;if(effectiveScore(c,p.ability)<10+level||s.max-s.used-prepared<=0)throw new Error('No unprepared, unspent slot remains at this level.');s.used++;}
export function reserveIllumianSlot(c:Character,casterId:string,level:number){const word=illumianWord(c),p=c.casters.find(p=>p.id===casterId);if(!['Naenaesh','Naenkrau','Uurnaen'].includes(word)||!p||p.mode!=='prepared')throw new Error('This word requires a prepared spellcasting tradition.');if(c.racialState.reservations.some(r=>r.word!==word))throw new Error('Begin a new preparation before changing reserved word slots.');const n=c.racialState.reservations.length;if(n>=(word==='Uurnaen'?1:2)||word==='Uurnaen'&&![1,2].includes(level)||word==='Naenkrau'&&c.racialState.reservations.some(r=>r.level===level))throw new Error('This slot does not meet the power word’s reservation rules.');spendFreeSlot(c,casterId,level);p.slots[level].used--;p.slots[level].max--;c.racialState.reservations.push({casterId,level,word});}
export const metamagicCosts:Record<string,number>={'Empower Spell':2,'Enlarge Spell':1,'Extend Spell':1,'Heighten Spell':1,'Maximize Spell':3,'Quicken Spell':4,'Silent Spell':1,'Still Spell':1,'Widen Spell':3};
export type WordOptions={casterId?:string,level?:number,turnId?:string,mode?:string,metamagic?:string,targetCasterId?:string,targetSpellId?:string};
export function useIllumianWord(c:Character,options:WordOptions={}){
 const word=illumianWord(c),level=options.level??1;if(!Number.isInteger(level)||level<0||level>9)throw new Error('Choose a spell level from 0 to 9.');if(!word||['Aeshkrau','Uurkrau','Naenaesh','Naenkrau','Uurnaen'].includes(word))throw new Error('Choose an active power word with a triggered use.');
 if(word!=='Aeshuur'&&(c.racialState.uses[word]||0)>=2)throw new Error('Both daily uses are already spent.');
 // Validate in a clone so no failed combination can spend a slot or turning attempt.
 const draft=structuredClone(c);let mode=options.mode||'',targetId='',rounds=word==='Hoonkrau'?2:1;
 if(['Aeshoon','Hoonkrau','Naenhoon'].includes(word)){
  const turn=draft.features.find(f=>f.id===options.turnId&&/^(?:turn(?: or rebuke)?|rebuke|command) undead/i.test(f.name));if(!turn)throw new Error('Choose a turning or rebuking resource.');let cost=1;
  if(word==='Naenhoon'){const meta=options.metamagic||'',p=draft.casters.find(p=>p.id===options.targetCasterId),k=p?.spells.find(k=>k.id===options.targetSpellId);if(!k||!hasFeat(draft,meta)||metamagicCosts[meta]===undefined)throw new Error('Choose a known metamagic feat and the spell being cast.');if(!p||effectiveScore(draft,p.ability)<10+k.level||p.slots[k.slotLevel].max<=0||(p.mode==='prepared'?k.spent>=k.prepared||p.spells.filter(s=>s.slotLevel===k.slotLevel).reduce((n,s)=>n+s.prepared,0)+p.slots[k.slotLevel].used>p.slots[k.slotLevel].max:p.slots[k.slotLevel].used>=p.slots[k.slotLevel].max))throw new Error('The chosen spell must currently be castable.');cost=meta==='Heighten Spell'?level:metamagicCosts[meta];if(!Number.isInteger(cost)||cost<1||meta==='Heighten Spell'&&k.level+cost>9)throw new Error('Heightening cannot exceed spell level 9.');mode=meta+(meta==='Heighten Spell'?' to level '+(k.level+cost):'');targetId=k.id;}
  if(turn.used+cost>turn.max)throw new Error('Not enough turning or rebuking attempts remain.');if(word==='Hoonkrau'&&mode==='turn'&&/^(rebuke|command) undead/i.test(turn.name))throw new Error('A rebuking pool cannot fuel the cure version.');if(word==='Hoonkrau'&&mode==='rebuke'&&/^turn undead/i.test(turn.name))throw new Error('A turning pool cannot fuel the inflict version.');if(word==='Hoonkrau'&&!['turn','rebuke'].includes(mode))throw new Error('Select turning for cure or rebuking for inflict.');turn.used+=cost;
 }else if(word!=='Aeshuur'){
  if(word==='Vaulnaen'){const p=draft.casters.find(p=>p.id===options.targetCasterId),k=p?.spells.find(k=>k.id===options.targetSpellId);if(!p||p.mode!=='prepared'||!k||k.prepared<=k.spent||k.slotLevel!==level||effectiveScore(draft,p.ability)<10+k.level)throw new Error('Choose an unspent prepared spell matching the donor slot level.');targetId=k.id;}
  spendFreeSlot(draft,options.casterId||'',level);if(word==='Uurhoon')rounds=level*10;
 }
 if(word!=='Aeshuur')draft.racialState.uses[word]=(draft.racialState.uses[word]||0)+1;
 draft.racialState.active=word==='Vaulnaen'?null:{word,level,rounds,mode,targetId};Object.assign(c,draft);
}
export function advanceRacialRound(c:Character){const a=c.racialState.active;if(a&&a.rounds>0){a.rounds--;if(!a.rounds)c.racialState.active=null;}}
export function resetRacialDaily(c:Character){const state=structuredClone(c.racialState);state.uses={};state.active=null;state.reservations=[];return state;}
export function clearRacialState(c:Character){c.racialState=emptyRacialState();}

export function applyRacialFireDamage(c:Character,damage:number,otherResistance=0){
 if(!Number.isInteger(damage)||damage<0||!Number.isInteger(otherResistance)||otherResistance<0)throw new Error('Damage and resistance must be nonnegative whole numbers.');
 const resistance=Math.max(racialResistances(c).fire||0,otherResistance),loss=Math.max(0,damage-resistance),absorbed=Math.min(c.tempHp,loss);c.tempHp-=absorbed;c.hp-=loss-absorbed;return loss;
}
