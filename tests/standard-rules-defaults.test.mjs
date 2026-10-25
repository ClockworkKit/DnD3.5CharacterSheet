import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {createNpcSheet} from '../lib/creatures.ts';
import {characterSchema} from '../lib/model.ts';
import {recordStartingHitDice,optionalRuleSettings} from '../lib/character-rules.ts';
import {recompute} from '../lib/automation.ts';
import {advancementNumbers} from '../lib/advancement.ts';
import {gainLevel} from '../lib/level-up.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';
import {sheetTotals} from '../lib/rules.ts';
import {activeDamageReductions} from '../lib/damage-reduction.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const options={name:'Standard fighter',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:10,CHA:10},method:'manual'};
const create=(extra={})=>createPlayerCharacter({...options,...extra});
const saved=c=>JSON.parse(JSON.stringify(c));

test('fresh Fighter defaults to standard HP, BAB, saves, skills, feats, XP and armor AC',()=>{
 const c=create(),a=advancementNumbers(c);
 assert.equal(c.automation.hpMethod,'rolled');assert.equal(c.maxHp,12);assert.equal(c.hp,12);assert.equal(c.bab,1);
 assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[2,0,0]);
 assert.equal(a.skillBudget,16);assert.equal(a.feats,2);assert.equal(a.fighterFeats,1);assert.equal(a.abilityIncreases,0);assert.equal(a.nextXp,1000);assert.equal(c.experience,0);
 assert.equal(c.ancestry.ignoreLevelAdjustment,false);assert.equal(c.automation.encumbrance,true);assert.equal(c.clericSpecialty,'none');assert.deepEqual(c.alternateFeatures.selected,[]);assert.deepEqual(c.effects,[]);
 assert.deepEqual(optionalRuleSettings(c),[]);assert.deepEqual(activeDamageReductions(c),[]);
 addEquipment(c,matchEquipment('Chainmail','armor'));recompute(c);assert.equal(c.defense.armor,5);assert.equal(sheetTotals(c).ac,16);assert.deepEqual(activeDamageReductions(c),[]);
});

test('higher-level creation records actual rolls once, applies CON once per HD and never rerolls on recompute',async()=>{
 const c=create({level:5,hpRolls:[1,4,7,10]});assert.equal(c.maxHp,42);assert.equal(c.hp,42);
 assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),[10,1,4,7,10]);assert.ok(c.notes.includes('d10 = 7'));
 const before=saved(c);recompute(c);assert.deepEqual(saved(c),before);await prepareCharacter(c);assert.deepEqual(saved(c),before);
 const random=create({level:5});assert.equal(random.automation.history.length,5);assert.ok(random.automation.history.slice(1).every(h=>Number.isInteger(h.hitDieRoll)&&h.hitDieRoll>=1&&h.hitDieRoll<=10));const stored=saved(random);recompute(random);assert.deepEqual(saved(random),stored);
});

test('HP rolls validate atomically and low Constitution cannot reduce a level grant below one',()=>{
 const c=create({level:3,hpRolls:[2,3]}),before=saved(c);
 for(const rolls of [[1],[0,3],[11,3],[2.5,3],[NaN,3]]){assert.throws(()=>recordStartingHitDice(c,rolls));assert.deepEqual(saved(c),before);}
 assert.throws(()=>create({hpMethod:'average',hpRolls:[]}));
 const low=create({level:3,hpRolls:[1,1],scores:{...options.scores,CON:1}});assert.equal(low.maxHp,7);
});

test('standard level-up requires a recorded die, preserves injuries and does not maximize later levels',()=>{
 const c=create();c.experience=1000;c.hp-=3;const before=structuredClone(c);
 assert.throws(()=>gainLevel(c,'fighter'),/valid roll/);assert.deepEqual(c,before);
 gainLevel(c,'fighter',2);recompute(c,before);assert.equal(c.maxHp,16);assert.equal(c.hp,13);assert.equal(c.automation.history[1].hitDieRoll,2);
});

test('legacy homebrew saves retain independent settings, history and spent resources through normal load',async()=>{
 const c=create({kind:'Cleric',level:3,hpMethod:'maximum'});c.ancestry.ignoreLevelAdjustment=true;c.automation.encumbrance=false;c.automation.adjustments.maxHp=5;c.automation.overrides['defense.armor']=1;
 c.automation.history[0].skillPoints=42;c.automation.history[0].skillClassOverrides[c.skills[0].id]=true;
 c.defense.drSources.push({id:'house-dr',source:'Campaign armor rule',amount:3,bypass:'',active:true,gearId:'',notes:'Keep this'});c.casters[0].slots[1].used=1;recompute(c);c.hp-=4;
 const before=saved(c),restored=await prepareCharacter(characterSchema.parse(before));assert.deepEqual(saved(restored),before);assert.equal(optionalRuleSettings(restored).length,5);
 const oldWithoutMethod=saved(c);delete oldWithoutMethod.automation.hpMethod;assert.equal(characterSchema.parse(oldWithoutMethod).automation.hpMethod,'average','legacy schema default stays unchanged');
});

test('optional HP methods can change independently and returning to rolled restores the original dice without healing damage',()=>{
 const c=create({level:3,hpRolls:[1,2]});c.hp-=4;const rolls=c.automation.history.map(h=>h.hitDieRoll);
 for(const [method,max] of [['maximum',36],['average',27],['rolled',19]]){const before=structuredClone(c);c.automation.hpMethod=method;recompute(c,before);assert.equal(c.maxHp,max);assert.equal(c.maxHp-c.hp,4);assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),rolls);assert.equal(c.ancestry.ignoreLevelAdjustment,false);assert.equal(c.automation.encumbrance,true);}
});

test('new NPCs and browser/native round trips preserve standard defaults and recorded rolls',async()=>{
 const c=createNpcSheet({...options,level:2,hpRolls:[3]});assert.equal(c.automation.hpMethod,'rolled');assert.equal(c.maxHp,17);
 const records=new Map(),api=createBrowserCharacterApi({scope:'standard-rules',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})}),loaded=(await api('/api/characters/'+record.id)).data;
 const restored=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:loaded}));await prepareCharacter(restored);assert.deepEqual(saved(restored),saved(c));
});
