import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {sheetTotals,abilityCheck,skillBonus,resetDaily} from '../lib/rules.ts';
import {findClass,isClassSkill} from '../lib/classes.ts';
import {factotumNumbers,chooseDilettante,useDilettante,spendInspiration,dilettanteProblem} from '../lib/factotum.ts';
import {applyClericSpecialty,activateSilverbeard} from '../lib/cleric-specialty.ts';
import {readFileSync} from 'node:fs';
const create=(extra={})=>createPlayerCharacter({name:'Options QA',kind:'Factotum',level:3,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:10},method:'manual',...extra});
const spells=JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url)));
test('maximum HP applies every hit die and changing method preserves damage',()=>{
 const c=create({level:5,hpMethod:'maximum'});assert.equal(c.maxHp,45);assert.equal(c.hp,45);c.hp-=7;c.automation.hpMethod='average';recompute(c);assert.equal(c.maxHp-c.hp,7);assert.ok(c.maxHp<45);
});
test('Factotum progression, all class skills and passive bonuses are distinct from saves and attacks',()=>{
 const c=create();assert.deepEqual([c.bab,c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[2,1,3,1]);assert.ok(isClassSkill('Knowledge (anything)',[findClass('factotum')]));assert.equal(c.casters.length,0);assert.equal(abilityCheck(c,'STR'),5);assert.equal(sheetTotals(c).initiative,6);assert.equal(sheetTotals(c).saves.ref,5);const climb=c.skills.find(s=>s.name==='Climb');assert.equal(skillBonus(c,climb),5);
 c.classLevels[0].level=16;recompute(c);assert.equal(sheetTotals(c).ac,16);c.automation.context.flatFooted=true;assert.equal(sheetTotals(c).ac,10);
});
test('Arcane Dilettante enforces unique choices, top-level limit, daily use, and inspiration',()=>{
 const c=create({level:4});const spell=spells.find(s=>s.id==='magic-missile'),other=spells.find(s=>s.id==='shield'),cantrip=spells.find(s=>s.id==='detect-magic');chooseDilettante(c,spell);assert.throws(()=>chooseDilettante(c,spell));assert.throws(()=>chooseDilettante(c,other));chooseDilettante(c,cantrip);useDilettante(c,spell.id);assert.equal(c.factotum.spent,1);assert.throws(()=>useDilettante(c,spell.id));c.factotum.spent=0;assert.throws(()=>useDilettante(c,spell.id));spendInspiration(c,3);assert.throws(()=>useDilettante(c,cantrip.id));assert.equal(c.factotum.spells[1].spent,false);assert.match(dilettanteProblem(c,{...cantrip,components:'V, XP'}),/XP/);const reset=resetDaily(c);assert.equal(reset.factotum.spells.length,0);assert.equal(factotumNumbers(reset).remaining,3);
});
test('Axe Brother adds Silverbeard without changing ordinary cleric or domain progression',()=>{
 const c=create({kind:'Cleric',level:5});const before=structuredClone(c.casters.map(p=>p.slots));applyClericSpecialty(c,'axe-brother');applyClericSpecialty(c,'axe-brother');assert.deepEqual(c.casters.map(p=>p.slots),before);assert.equal(c.casters.flatMap(p=>p.spells).filter(s=>s.spellId==='silverbeard').length,1);const ac=sheetTotals(c).ac,dip=c.skills.find(s=>s.name==='Diplomacy'),bonus=skillBonus(c,dip);activateSilverbeard(c,5);assert.equal(sheetTotals(c).ac,ac+2);assert.equal(skillBonus(c,dip),bonus);c.automation.context.targetRace='dwarf';assert.equal(skillBonus(c,dip),bonus+2);assert.equal(c.effects.find(e=>e.preset==='silverbeard').rounds,50);assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});
test('new specialty and Factotum state persist, and old saves receive defaults',()=>{
 const c=create();c.factotum.spent=1;c.factotum.knowledgeUsed=['climb'];assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);delete c.factotum;delete c.clericSpecialty;const old=characterSchema.parse(c);assert.equal(old.clericSpecialty,'none');assert.equal(old.factotum.spent,0);assert.deepEqual(old.factotum.spells,[]);
});
