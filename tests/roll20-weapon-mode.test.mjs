import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {weaponAttack} from '../lib/rules.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {reviewRoll20WeaponModes} from '../lib/roll20-weapon-mode.ts';
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-24',character:{id:'mode-test',name:'Weapon mode QA'},attributes:Object.entries({class1:'Rogue',level1:3,str:12,dex:18,weapon1name:'Rapier',weapon1stat:'@{dex-mod}',weapon1range:'-',weapon1statdamage:'1d6',...extra}).map(([name,current])=>({name,current,max:''}))});
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('a dash does not turn a Dexterity-based rapier into a ranged attack',async()=>{
 const c=await prepareCharacter(importRoll20(raw()).character),w=c.weapons[0];
 assert.equal(w.ability,'DEX');assert.equal(w.attackMode,'melee');
 const base=weaponAttack(c,w);c.automation.context.targetInMelee=true;assert.equal(weaponAttack(c,w),base);
 c.automation.context.flanking=true;assert.equal(weaponAttack(c,w),base+2);
 assert.deepEqual(c.roll20Import.raw,raw());
});

test('ranged catalog weapons remain ranged with non-Dexterity selectors; thrown/custom fallback and explicit ranges remain intact',()=>{
 for(const [name,ability,range,mode] of [['Hand Crossbow','STR','-','ranged'],['Dagger','DEX','-','ranged'],['Dagger','STR','-','melee'],['Custom ray','DEX','-','ranged'],['Rapier','DEX','10 ft.','ranged'],['Rapier','DEX','Melee','melee']]){
  const w=importRoll20(raw({weapon1name:name,weapon1stat:ability,weapon1range:range})).character.weapons[0];assert.equal(w.attackMode,mode,name+': '+range);assert.equal(w.ability,ability);
 }
 const c=importRoll20(raw({weapon1name:'',repeating_weapons_ROW_weaponname:'Rapier',repeating_weapons_ROW_weaponstat:'DEX',repeating_weapons_ROW_weaponrange:'-',repeating_weapons_ROW_weaponstatdamage:'1d6'})).character;
 assert.equal(c.weapons[0].attackMode,'melee');
});

test('existing saves get a one-time review without overwriting later progress, modes or resources',async()=>{
 const c=await prepareCharacter(importRoll20(raw()).character);delete c.roll20Import.weaponModeReview;c.weapons[0].attackMode='ranged';
 c.classLevels[0].level=5;recompute(c);c.hp-=3;c.weapons[0].ammo=7;c.weapons[0].attack=4;c.notes='Later session';
 const before=snapshot(c);reviewRoll20WeaponModes(c);
 assert.match(c.roll20Import.report.warnings.at(-1),/Dexterity-based melee/);
 const expected=structuredClone(before);expected.roll20Import=snapshot(c.roll20Import);assert.deepEqual(snapshot(c),expected);
 const saved=snapshot(c);assert.deepEqual(snapshot(await prepareCharacter(characterSchema.parse(saved))),saved);
 reviewRoll20WeaponModes(c);assert.deepEqual(snapshot(c),saved);
});

test('corrected, explicitly ranged, removed and newly imported weapons do not get the legacy warning',async()=>{
 for(const mutate of [c=>{},c=>{c.weapons=[];},c=>{c.weapons[0].range='10 ft.';c.weapons[0].attackMode='ranged';},c=>{c.weapons[0].name='Replacement';c.weapons[0].attackMode='ranged';}]){
  const c=await prepareCharacter(importRoll20(raw()).character);delete c.roll20Import.weaponModeReview;mutate(c);reviewRoll20WeaponModes(c);
  assert.equal(c.roll20Import.report.warnings.some(w=>/Dexterity-based melee/.test(w)),false);
 }
 const c=await prepareCharacter(importRoll20(raw()).character);c.weapons[0].attackMode='ranged';reviewRoll20WeaponModes(c);
 assert.equal(c.roll20Import.report.warnings.some(w=>/Dexterity-based melee/.test(w)),false);
});

test('legacy projectile weapons using alternate abilities are flagged without changing their chosen ability or mode',async()=>{
 const c=await prepareCharacter(importRoll20(raw({weapon1name:'Hand Crossbow',weapon1stat:'INT'})).character);
 delete c.roll20Import.weaponModeReview;c.weapons[0].attackMode='melee';const before=snapshot(c.weapons);
 reviewRoll20WeaponModes(c);assert.match(c.roll20Import.report.warnings.at(-1),/non-Dexterity ranged weapon/);
 assert.deepEqual(snapshot(c.weapons),before);
});
