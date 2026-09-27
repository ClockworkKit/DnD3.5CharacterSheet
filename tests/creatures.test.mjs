import test from 'node:test';
import assert from 'node:assert/strict';
import {characterSchema,newCharacter} from '../lib/model.ts';
import {createCreatureProfile,createMonsterSheet,createNpcSheet,creatureAbilityScore,creatureAbilityModifier,racialCreatureStatistics,naturalAttackRoutine} from '../lib/creatures.ts';
import {creatureTypes} from '../lib/creature-schema.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {applyClassTotals} from '../lib/classes.ts';
import {gainLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {sheetTotals} from '../lib/rules.ts';
const scores={STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10};
const monster=(creature={},options={})=>createMonsterSheet({name:'Test monster',scores,creature:{type:'Undead',racialHitDice:2,...creature},...options});

test('old files default to PC without changing statistics',()=>{
 const c=newCharacter(),totals=sheetTotals(c);delete c.sheetKind;delete c.creature;
 const loaded=parseCharacterFile(JSON.stringify(c));assert.equal(loaded.sheetKind,'pc');assert.equal(loaded.creature,null);assert.deepEqual(sheetTotals(loaded),totals);
});
test('NPC creation uses the existing character class automation and contains no starter possessions',()=>{
 const c=createNpcSheet({name:'Town guard',kind:'Fighter',level:3,raceId:'human',scores,method:'manual'});
 assert.equal(c.sheetKind,'npc');assert.equal(c.bab,3);assert.equal(c.automation.enabled,true);assert.equal(c.gear.length,0);assert.equal(c.weapons.length,0);assert.deepEqual(characterSchema.parse(c),c);
});
test('classless monsters have no phantom Fighter level, race adjustments, or starter equipment',()=>{
 const c=monster({type:'Giant',racialHitDice:4,challengeRating:3},{size:'Large',scores:{...scores,STR:21,CON:15}});
 assert.equal(c.level,4);assert.equal(c.hitDice,'4d8');assert.equal(c.bab,3);assert.equal(c.maxHp,26);assert.equal(c.saves.fort.base,4);assert.equal(c.saves.ref.base,1);
 assert.equal(c.creature.challengeRating,3);assert.equal(c.ancestry.racialHitDice,0);assert.deepEqual(c.classLevels,[]);assert.deepEqual(c.gear,[]);assert.deepEqual(c.features,[]);assert.equal(c.race,'');assert.equal(c.classes,'');assert.equal(c.creature.space,10);
});
test('undead and constructs have no Constitution modifier; mindless is distinct from Intelligence zero',()=>{
 const c=monster({}, {scores:{...scores,CON:null,INT:null}});c.temps.CON=8;
 assert.equal(creatureAbilityScore(c,'CON'),null);assert.equal(creatureAbilityScore(c,'INT'),null);assert.equal(creatureAbilityModifier(c,'CON'),0);assert.equal(sheetTotals(c).mods.CON,0);assert.equal(c.maxHp,13);
 const construct=monster({type:'Construct',racialHitDice:2},{size:'Large'});assert.equal(construct.maxHp,41);assert.equal(construct.hitDice,'2d10');assert.equal(construct.saves.will.base,0);
});
test('type progressions, entry exceptions, and elemental saves are explicit',()=>{
 for(const type of creatureTypes){const p=createCreatureProfile({type,subtypes:type==='Elemental'?['Fire']:[]});assert.ok(p.hitDie);}
 const dragon=monster({type:'Dragon',racialHitDice:7});assert.equal(dragon.bab,7);assert.deepEqual(racialCreatureStatistics(dragon).saves,{fort:5,ref:5,will:5});
 assert.deepEqual(createCreatureProfile({type:'Elemental',subtypes:['Water']}).goodSaves,['fort']);
 assert.throws(()=>createCreatureProfile({type:'Elemental'}),/subtype/);
 assert.deepEqual(createCreatureProfile({type:'Undead',goodSaves:['ref','will']}).goodSaves,['ref','will']);
});
test('fractional HD requires printed HP and CR never changes level or statistics',()=>{
 assert.throws(()=>monster({racialHitDice:.5}),/printed hit points/);
 const c=monster({racialHitDice:.5,challengeRating:.25},{maxHp:3});assert.equal(c.hitDice,'1/2d12');assert.equal(c.level,1);assert.equal(c.maxHp,3);assert.equal(c.bab,0);
 c.creature.challengeRating=20;assert.equal(racialCreatureStatistics(c).bab,0);
});
test('natural attacks use primary/secondary and Multiattack rules without BAB iteratives',()=>{
 const c=monster({type:'Dragon',racialHitDice:12,naturalAttacks:[{id:'bite',name:'Bite',damage:'2d6',strengthMultiplier:1.5},{id:'claw',name:'Claw',count:2,role:'secondary',damage:'1d8'}]}, {scores:{...scores,STR:21},size:'Large'});
 let attacks=naturalAttackRoutine(c);assert.equal(attacks.length,3);assert.equal(attacks[0].attackBonus,16);assert.equal(attacks[0].damageFormula,'2d6+7');assert.equal(attacks[1].attackBonus,11);assert.equal(attacks[1].damageFormula,'1d8+2');
 assert.equal(naturalAttackRoutine(c,{multiattack:true})[1].attackBonus,14);
 attacks=naturalAttackRoutine(c,{withManufacturedWeapon:true});assert.equal(attacks[0].attackBonus,11);assert.equal(attacks[0].damageFormula,'2d6+2');
 c.scores.STR=7;assert.equal(naturalAttackRoutine(c)[1].damageFormula,'1d8-2');
});
test('invalid creature fields and duplicate attacks fail validation',()=>{
 const c=monster();for(const profile of [{...c.creature,racialHitDice:-1},{...c.creature,racialHitDice:.3},{...c.creature,challengeRating:Infinity},{...c.creature,nonabilities:['CON','CON']},{...c.creature,naturalAttacks:[{id:'a',name:'Claw',damage:'0d6'}]},{...c.creature,naturalAttacks:[{id:'a',name:'Claw'},{id:'a',name:'Claw'}]}])assert.equal(characterSchema.safeParse({...c,creature:profile}).success,false);
 assert.equal(characterSchema.safeParse({...c,creature:null}).success,false);
 assert.equal(characterSchema.safeParse({...c,automation:{...c.automation,enabled:true}}).success,false);
 assert.throws(()=>monster({}, {scores:{...scores,STR:0}}));
});
test('load/recompute and explicit activation cannot rewrite a monster stat block',()=>{
 const c=monster();c.maxHp=57;c.hp=12;c.bab=9;c.defense.sr=18;c.defense.armor=7;
 const before=structuredClone(c);activateAutomation(c);recompute(c);assert.deepEqual(c,before);
 c.automation.enabled=true;recompute(c);assert.deepEqual(c,before);
 assert.throws(()=>applyClassTotals(c),/manually/);assert.throws(()=>gainLevel(c,'fighter'),/manually/);
});
test('creature profile and natural attacks survive export, browser save/update and fresh reload',async()=>{
 const data=monster({challengeRating:1/3,naturalAttacks:[{id:'claw',name:'Claw',count:2}],movement:{fly:40,maneuverability:'good'},specialQualities:['Darkvision 60 ft.']});
 data.defense.dr='5/bludgeoning';data.notes='Encounter notes';
 const imported=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data}));assert.deepEqual(imported,data);
 const values=new Map(),env={scope:'test',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(k,f)=>f(),id:()=> 'monster-1'};
 const api=createBrowserCharacterApi(env),row=await api('/api/characters',{method:'POST',body:JSON.stringify({data})});assert.equal(row.sheetKind,'monster');
 const reopened=createBrowserCharacterApi(env);assert.deepEqual((await reopened('/api/characters/'+row.id)).data,data);
 const updated={...data,hp:1};await reopened('/api/characters/'+row.id,{method:'PUT',body:JSON.stringify({data:updated,revision:row.revision})});
 assert.deepEqual((await api('/api/characters/'+row.id)).data,updated);
 await assert.rejects(api('/api/characters/'+row.id,{method:'PUT',body:JSON.stringify({data,revision:1})}),/newer revision/);
 assert.equal((await api('/api/characters')).characters[0].sheetKind,'monster');
});
