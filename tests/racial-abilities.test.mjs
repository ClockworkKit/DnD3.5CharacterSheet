import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute} from '../lib/automation.ts';
import {effectiveScore,selectRace,findRace} from '../lib/ancestry.ts';
import {characterSchema,newWeapon} from '../lib/model.ts';
import {abilityCheck,skillBonus,sheetTotals,weaponAttack,weaponDamage,spellDC,resetDaily,castingProblem,makeSpellRoll} from '../lib/rules.ts';
import {applyRacialFireDamage,setSigils,sigilLimit,illumianWord,krauBonus,reserveIllumianSlot,activateIllumianWord,swimSpeed,glyphStatus,illumianDC,illumianExtraDice,illumianSpellFormula,advanceRacialRound,wordNames} from '../lib/racial-abilities.ts';
import {effectBonus,advanceEffects} from '../lib/effects.ts';
import {classSkillAt} from '../lib/skill-points.ts';
import {hitDieSequence} from '../lib/level-history.ts';
const spells=JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const create=(race='illumian',kind='Wizard',level=3)=>createPlayerCharacter({name:'Racial QA',kind,level,raceId:race,method:'manual',scores:{STR:18,DEX:16,CON:14,INT:14,WIS:16,CHA:16}});
const sig=(c,a,b)=>{setSigils(c,[a,...(b?[b]:[])]);recompute(c);};
const known=(id='magic-missile',level=1,prepared=1)=>({id:crypto.randomUUID(),spellId:id,level,slotLevel:level,prepared,spent:0,formula:'',notes:'',custom:null});
const turner=()=>{const c=create('illumian','Cleric',3);return c;};
const turn=c=>c.features.find(f=>f.name==='Turn or rebuke undead');
const weapon=()=>({...newWeapon(),name:'Longsword',damage:'1d8',damageAbility:'none',proficiency:'yes',attackMode:'melee'});
const focus=c=>c.features.push({id:crypto.randomUUID(),name:'Weapon Focus',choice:'Longsword',kind:'Feat',description:'',source:'',max:0,used:0});

test('Illumian second sigil requires second level in one class, not total HD or LA',()=>{
 const c=create('illumian','Wizard',1);c.classLevels.push({...create('illumian','Fighter',1).classLevels[0]});c.ancestry.levelAdjustment=4;assert.equal(sigilLimit(c),1);assert.throws(()=>setSigils(c,['aesh','krau']));c.classLevels[0].level=2;assert.equal(sigilLimit(c),2);assert.throws(()=>setSigils(c,['aesh','aesh']));
 const words=new Set();for(const [pair,word] of Object.entries(wordNames)){sig(c,...pair.split('-'));assert.equal(illumianWord(c),word);words.add(word);}assert.equal(words.size,15);
});
test('sigils affect associated checks and initiative without changing scores, HP, saves or attacks',()=>{
 const c=create(),base=structuredClone(c),w=weapon();sig(c,'aesh','uur');assert.equal(effectiveScore(c,'STR'),effectiveScore(base,'STR'));assert.equal(abilityCheck(c,'STR')-abilityCheck(base,'STR'),2);assert.equal(abilityCheck(c,'DEX')-abilityCheck(base,'DEX'),2);assert.equal(sheetTotals(c).initiative-sheetTotals(base).initiative,2);assert.deepEqual(sheetTotals(c).saves,sheetTotals(base).saves);assert.equal(c.maxHp,base.maxHp);assert.equal(weaponAttack(c,w),weaponAttack(base,w));
 const skill=c.skills.find(s=>s.name==='Hide');assert.equal(skillBonus(c,skill)-skillBonus(base,base.skills.find(s=>s.name==='Hide')),2);c.racialState.suppressed=true;assert.equal(abilityCheck(c,'STR'),abilityCheck(base,'STR'));assert.equal(illumianWord(c),'');
});
test('Krau raises only caster level, caps at Hit Dice, and never creates new spell levels',()=>{
 const c=create();c.classLevels.push({...create('human','Fighter',2).classLevels[0]});sig(c,'naen','krau');const p=c.casters[0];assert.equal(p.level,5);assert.equal(p.slots[3].max,0);assert.equal(krauBonus(c,5),0);assert.equal(krauBonus(c,0),0);const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);c.racialState.suppressed=true;recompute(c);assert.equal(p.level,3);
});
test('Aeshkrau and Uurkrau replace bonus-slot ability without replacing casting eligibility or DC',()=>{
 const c=create();c.scores.STR=22;sig(c,'aesh','krau');const p=c.casters[0],baseDC=spellDC(c,p,{level:1}),slots=p.slots[1].max;c.racialState.bonusCasters=[p.id];recompute(c);assert.equal(p.slots[1].max,slots+1);assert.equal(p.slots[2].max,3);assert.equal(spellDC(c,p,{level:1}),baseDC);c.scores.INT=10;recompute(c);assert.equal(p.slots[1].max,0);assert.equal(p.slots[2].max,0);
});
test('Illumian literacy grants class skill access without human bonus feats or skill points',()=>{
 const c=create('illumian','Fighter',1),human=create('human','Fighter',1);const skill=c.skills.find(s=>s.name==='Speak Language');assert.equal(skill.classSkill,true);assert.equal(classSkillAt(c,skill,hitDieSequence(c)[0]),true);assert.equal(c.automation.history.length,human.automation.history.length);
});
test('glyphic resonance checks HD rather than LA and remains while sigils are suppressed',()=>{
 const c=create();c.ancestry.levelAdjustment=5;c.racialState.environment.glyph=true;c.racialState.environment.incomingCasterLevel=4;const plain=structuredClone(c);plain.racialState.environment.glyph=false;assert.equal(glyphStatus(c),'penalty');assert.equal(sheetTotals(c).saves.will-sheetTotals(plain).saves.will,-4);c.racialState.suppressed=true;c.racialState.environment.incomingCasterLevel=3;assert.equal(glyphStatus(c),'immune');c.racialState.environment.glyph=false;c.racialState.environment.shadow=true;assert.equal(sheetTotals(c).saves.will-sheetTotals(plain).saves.will,2);
});
test('reserved slots lower capacity, persist through suppression and restore only with preparation/reset',()=>{
 const c=create();sig(c,'naen','krau');const p=c.casters[0],max=p.slots[1].max;reserveIllumianSlot(c,p.id,1);recompute(c);assert.equal(p.slots[1].max,max-1);assert.equal(illumianDC(c,1),1);assert.throws(()=>reserveIllumianSlot(c,p.id,1));const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));assert.deepEqual(saved,c);c.racialState.suppressed=true;recompute(c);assert.equal(p.slots[1].max,max-1);assert.equal(illumianDC(c,1),0);Object.assign(c,resetDaily(c));recompute(c);assert.equal(c.casters[0].slots[1].max,max);assert.equal(c.racialState.sigils.length,2);
});
test('unprepared-slot words cannot consume prepared copies and failed activation is atomic',()=>{
 const c=create();sig(c,'vaul','krau');const p=c.casters[0];p.spells=[known('magic-missile',1,p.slots[1].max)];const before=structuredClone(c);assert.throws(()=>activateIllumianWord(c,{casterId:p.id,level:1}));assert.deepEqual(c,before);p.spells[0].prepared--;activateIllumianWord(c,{casterId:p.id,level:1});const q=c.casters[0];assert.equal(q.slots[1].used,1);assert.equal(c.racialState.uses.Vaulkrau,1);q.spells[0].prepared++;assert.match(castingProblem(q,q.spells[0],c),/Too many/);advanceEffects(c);assert.equal(c.racialState.active,null);assert.equal(q.slots[1].used,1);
});
test('turn-funded words spend the shared pool and enforce daily limits',()=>{
 const c=turner();sig(c,'aesh','hoon');focus(c);const w=weapon(),base=weaponDamage(c,w),pool=turn(c);activateIllumianWord(c,{turnId:pool.id});assert.equal(turn(c).used,1);assert.notEqual(weaponDamage(c,w),base);assert.equal(effectBonus(c,'damage',{weaponName:'longsword'}),3);activateIllumianWord(c,{turnId:pool.id});assert.throws(()=>activateIllumianWord(c,{turnId:pool.id}),/daily/);const restored=resetDaily(c);assert.equal(turn(restored).used,0);assert.deepEqual(restored.racialState.uses,{});
});
test('Naenhoon verifies known metamagic, a castable spell and sufficient turning attempts',()=>{
 const c=turner();sig(c,'naen','hoon');const p=c.casters[0],k=known('cure-light-wounds');p.spells=[k];c.features.push({id:crypto.randomUUID(),name:'Empower Spell [Metamagic]',kind:'Feat',description:'',source:'',max:0,used:0});const options={turnId:turn(c).id,targetCasterId:p.id,targetSpellId:k.id,metamagic:'Empower Spell'};activateIllumianWord(c,options);assert.equal(turn(c).used,2);assert.match(makeSpellRoll(c,c.casters[0],c.casters[0].spells[0],spells.find(s=>s.id==='cure-light-wounds')).details,/Empower Spell/);const before=structuredClone(c);assert.throws(()=>activateIllumianWord(c,{...options,metamagic:'Maximize Spell'}));assert.deepEqual(c,before);
});
test('Vaulnaen spends the donor slot without spending the original preparation',()=>{
 const c=create();sig(c,'vaul','naen');const p=c.casters[0],k=known();p.spells=[k];activateIllumianWord(c,{casterId:p.id,level:1,targetCasterId:p.id,targetSpellId:k.id});assert.equal(c.casters[0].slots[1].used,1);assert.equal(c.casters[0].spells[0].spent,0);assert.equal(c.racialState.uses.Vaulnaen,1);
});
test('word riders expire, use insight stacking, distinguish cure/inflict, and avoid multiplying extra dice',()=>{
 const c=turner();sig(c,'hoon','krau');activateIllumianWord(c,{turnId:turn(c).id,mode:'turn'});assert.equal(illumianSpellFormula(c,{id:'cure-light-wounds'},'1d8+3'),'1d8+3+1d8');assert.equal(illumianSpellFormula(c,{id:'inflict-light-wounds'},'1d8+3'),'1d8+3');advanceRacialRound(c);assert.equal(c.racialState.active.rounds,1);advanceRacialRound(c);assert.equal(c.racialState.active,null);
 sig(c,'vaul','uur');const p=c.casters[0];activateIllumianWord(c,{casterId:p.id,level:2});const w={...weapon(),name:'Unarmed strike'};assert.equal(illumianExtraDice(c,w),2);assert.ok(weaponDamage(c,w,true).endsWith('+2d6'));
});
test('aquatic kobolds retain kobold adjustments and gain swimming, not elemental defenses or air breathing',()=>{
 const c=create('aquatic-kobold','Fighter'),r=findRace('aquatic-kobold');assert.equal(r.waterBreathing,true);assert.equal(r.element,undefined);assert.equal(swimSpeed(c),40);assert.equal(effectiveScore(c,'STR'),14);assert.equal(effectiveScore(c,'DEX'),18);assert.equal(effectiveScore(c,'CON'),12);assert.equal(effectBonus(c,'skill.Swim'),8);assert.equal(r.la,0);assert.match(r.type,/aquatic/);assert.doesNotMatch(r.type,/elemental/i);
 c.ancestry.traitBonuses=false;assert.equal(swimSpeed(c),0);assert.equal(effectBonus(c,'skill.Swim'),0);
});
test('elemental exceptions preserve only their actual inherited traits',()=>{
 const fire=create('fire-half-elf'),water=create('water-half-orc');assert.equal(swimSpeed(water),0);fire.racialState.environment.magicElement='water';assert.equal(effectBonus(fire,'saves'),0);fire.racialState.environment.magicSource='water';assert.equal(effectBonus(fire,'saves'),-1);
 const g=create('air-gnome'),w=weapon();const attack=weaponAttack(g,w);g.automation.context.targetRace='kobold';assert.equal(weaponAttack(g,w),attack);g.racialState.environment.targetElement='earth';assert.equal(weaponAttack(g,w),attack+1);g.racialState.environment.targetLarge=true;assert.equal(effectBonus(g,'ac.dodge'),4);g.racialState.environment.magicElement='earth';assert.equal(effectBonus(g,'saves'),-2);
 const e=create('earth-dwarf');e.racialState.environment.resistTrip=true;assert.equal(effectBonus(e,'check.STR'),8);e.racialState.environment.grounded=false;assert.equal(effectBonus(e,'check.STR'),0);const normal=sheetTotals(e).saves;e.automation.context.saveAgainst='spell';assert.deepEqual(sheetTotals(e).saves,normal);e.automation.context.saveAgainst='poison';assert.equal(sheetTotals(e).saves.fort,normal.fort+2);
});
test('racial state survives exports, defaults on legacy saves, and clears when switching race',()=>{
 const c=create();sig(c,'uur','krau');c.racialState.environment.shadow=true;assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);delete c.racialState;assert.equal(characterSchema.parse(c).racialState.suppressed,false);c.racialState=characterSchema.parse(c).racialState;sig(c,'uur','krau');selectRace(c,'aquatic-kobold',{abilities:true,traits:true,body:true,languages:true});assert.deepEqual(c.racialState.sigils,[]);
});

test('fire resistance applies per event, takes the higher resistance, and spends temporary HP first',()=>{
 const c=create('fire-elf');c.hp=20;c.tempHp=3;assert.equal(applyRacialFireDamage(c,12),7);assert.equal(c.tempHp,0);assert.equal(c.hp,16);assert.equal(applyRacialFireDamage(c,12,10),2);assert.equal(c.hp,14);const before=structuredClone(c);assert.throws(()=>applyRacialFireDamage(c,-1));assert.deepEqual(c,before);
});
