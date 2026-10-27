import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {rogueCombatFeatures} from '../lib/combat-explanations.ts';
import {sheetTotals} from '../lib/rules.ts';
import {evasionFeatures,uncannyDodgeSources} from '../lib/defensive-class-features.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';
import {findClass,makePsionic} from '../lib/classes.ts';
import {addEffect} from '../lib/effects.ts';
import {recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {supplementalTerms} from '../lib/class-systems.ts';

const create=(kind,level)=>createPlayerCharacter({name:'Defensive features QA',kind,level,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:12,WIS:10,CHA:10},method:'manual'});
const paired=(left,right,level)=>createPlayerCharacter({name:'Paired defenses QA',kind:'Fighter',level,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:12,WIS:10,CHA:10},method:'manual',advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left,right}))});
const selected=(c,id)=>c.alternateFeatures.selected.push(id);

test('combat explains Evasion from a monk without requiring rogue levels',()=>{
 const c=create('Monk',2);
 assert.equal(rogueCombatFeatures(c).evasion,true);
});

test('Uncanny Dodge retains Dexterity in the flat-footed AC display',()=>{
 const c=create('Rogue',4);
 assert.equal(sheetTotals(c).flat,14);
});

test('Uncanny Dodge does not remove the flat-footed condition for Battle Clarity',()=>{
 const c=create('Warblade',3);assert.ok(supplementalTerms(c,'save.ref').some(t=>t.source==='battle-clarity'));
 c.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(c).ac,14);assert.equal(supplementalTerms(c,'save.ref').some(t=>t.source==='battle-clarity'),false);
});

test('all listed Evasion classes acquire it at their own class level, not total level',()=>{
 for(const [id,level] of [['rogue',2],['monk',2],['ranger',9],['shadowdancer',2],['swordsage',9],['ninja',12],['scout',5],['lurk',9],['psychic-rogue',2]]){
  const c=create('Fighter',1);c.classLevels=[{id:'test-class',classId:id,name:id,level:level-1,notes:''}];
  assert.equal(evasionFeatures(c).tier,0,id+' before grant');c.classLevels[0].level++;assert.equal(evasionFeatures(c).tier,1,id+' grant');
 }
});

test('duplicate gestalt Evasion never becomes Improved Evasion without an earned upgrade',()=>{
 const c=paired('monk','rogue',2);assert.equal(evasionFeatures(c).tier,1);assert.equal(evasionFeatures(c).sources.length,2);
 const advanced=paired('monk','rogue',9);assert.equal(evasionFeatures(advanced).tier,2);
 selected(advanced,'monk-invisible-fist');assert.equal(evasionFeatures(advanced).tier,1);assert.equal(evasionFeatures(advanced).sources[0].classId,'rogue');
 selected(advanced,'rogue-feign-death');assert.equal(evasionFeatures(advanced).tier,0);
});

test('each Evasion source keeps its own armor restriction and a second source can remain usable',()=>{
 const c=paired('ninja','rogue',12);addEquipment(c,matchEquipment('Leather'));recompute(c);
 let result=evasionFeatures(c);assert.equal(result.activeTier,1);assert.equal(result.sources.find(s=>s.classId==='ninja').blocked,'wearing armor');assert.equal(result.sources.find(s=>s.classId==='rogue').blocked,'');
 c.gear=[];addEquipment(c,matchEquipment('Chainmail'));recompute(c);assert.equal(evasionFeatures(c).activeTier,0);
 c.gear=[];c.automation.context.helpless=true;assert.ok(evasionFeatures(c).sources.every(s=>s.blocked==='being helpless'));
 c.automation.context.helpless=false;c.scores.STR=10;c.gear.push({id:'pack',name:'Pack',qty:1,weight:40,carried:true,equipped:false,notes:''});c.automation.encumbrance=true;
 assert.equal(evasionFeatures(c).activeTier,0);c.automation.encumbrance=false;assert.equal(evasionFeatures(c).activeTier,1);
});

test('Spell Reflection downgrades a later improved grant, while chosen rogue special abilities are not automatic',()=>{
 const c=create('Monk',9);selected(c,'monk-spell-reflection');assert.equal(evasionFeatures(c).tier,1);
 c.classLevels[0].level=8;assert.equal(evasionFeatures(c).tier,0);
 const rogue=create('Rogue',10);assert.equal(evasionFeatures(rogue).tier,1);
 rogue.features.push({id:'chosen-evasion',name:'Improved Evasion',kind:'Class feature',description:'Selected rogue special ability',source:'',max:0,used:0});assert.equal(evasionFeatures(rogue).tier,2);
 selected(rogue,'rogue-spell-reflection');assert.equal(evasionFeatures(rogue).tier,1);
 rogue.classLevels[0].level=9;assert.equal(evasionFeatures(rogue).tier,0);
});

test('Eldritch Grace stays magic-only and focused True Thief benefits suspend without spending focus',()=>{
 const fighter=create('Fighter',4);selected(fighter,'fighter-eldritch-grace');assert.equal(evasionFeatures(fighter).activeTier,0);assert.equal(evasionFeatures(fighter).magicTier,1);
 const lurk=create('Lurk',14);selected(lurk,'lurk-true-thief');lurk.psionics[0].focused=true;lurk.psionics[0].spent=3;
 assert.equal(evasionFeatures(lurk).tier,2);assert.equal(uncannyDodgeSources(lurk).length,1);assert.equal(lurk.psionics[0].spent,3);assert.equal(lurk.psionics[0].focused,true);
 lurk.psionics[0].focused=false;assert.equal(evasionFeatures(lurk).tier,1);assert.equal(uncannyDodgeSources(lurk).length,0);
});

test('Uncanny Dodge covers every listed grant and requires focus for Psychic Rogue',()=>{
 for(const [id,level] of [['barbarian',2],['rogue',4],['assassin',2],['shadowdancer',2],['warblade',2],['scout',2],['fist-of-the-forest',2],['psychic-rogue',7]]){
  const c=create('Fighter',1);c.classLevels=[{id:'class',classId:id,name:id,level:level-1,notes:''}];
  if(id==='psychic-rogue'){c.psionics=[makePsionic(findClass(id),level,12)];c.psionics[0].focused=true;}
  assert.equal(uncannyDodgeSources(c).length,0,id+' before grant');c.classLevels[0].level++;assert.equal(uncannyDodgeSources(c).length,1,id+' grant');
  if(id==='psychic-rogue'){c.psionics[0].focused=false;assert.equal(uncannyDodgeSources(c).length,0);}
 }
});

test('flat-footed protection respects caps, dodge, negative Dexterity, overrides, conditions and manual mode',()=>{
 const c=create('Rogue',4);c.defense.dodge=2;c.defense.dexCap=3;
 assert.equal(sheetTotals(c).flat,15);c.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(c).ac,15);assert.equal(sheetTotals(c).touch,15);
 c.automation.context.flatFooted=true;assert.equal(sheetTotals(c).ac,10);assert.equal(sheetTotals(c).flat,10);
 c.automation.context.flatFooted=false;c.automation.context.helpless=true;assert.equal(sheetTotals(c).ac,10);
 c.automation.context.helpless=false;addEffect(c,'stunned');assert.equal(sheetTotals(c).ac,8);assert.equal(sheetTotals(c).flat,8);
 c.effects=[];c.scores.DEX=8;c.defense.dodge=0;assert.equal(sheetTotals(c).flat,9);
 c.scores.DEX=18;c.automation.enabled=false;assert.equal(sheetTotals(c).ac,13);assert.equal(sheetTotals(c).flat,10);
 const fighter=create('Fighter',4);fighter.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(fighter).ac,10);
});

test('replacing one uncanny source does not remove another or change resources and saved combat overrides',async()=>{
 const c=paired('rogue','barbarian',4);selected(c,'rogue-disruptive-attack');assert.deepEqual(uncannyDodgeSources(c).map(s=>s.classId),['barbarian']);
 c.hp-=3;c.automation.context.flatFooted=true;c.automation.context.caughtFlatFooted=true;recompute(c);
 const before=structuredClone(c);sheetTotals(c);rogueCombatFeatures(c);assert.deepEqual(c,before);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));assert.deepEqual(loaded,c);assert.equal(loaded.maxHp-loaded.hp,3);assert.equal(sheetTotals(loaded).flat,10);
 const legacy=structuredClone(c);delete legacy.automation.context.caughtFlatFooted;const parsed=characterSchema.parse(legacy);assert.equal('caughtFlatFooted' in parsed.automation.context,false);assert.equal(parsed.automation.context.flatFooted,true);
});
