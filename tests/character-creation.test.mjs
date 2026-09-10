import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityKeys,characterSchema} from '../lib/model.ts';
import {rollAbilityScores,assignedScores,assignAbilityRoll,startingAssignment,startingAbilityScores,createPlayerCharacter} from '../lib/character-creation.ts';
import {raceCatalog,effectiveScore} from '../lib/ancestry.ts';
import {baseClasses} from '../lib/classes.ts';
import {recompute} from '../lib/automation.ts';
import {skillLedger} from '../lib/skill-points.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const scores={STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:10};
const create=(extra={})=>createPlayerCharacter({name:'New hero',kind:'Wizard',level:1,raceId:'human',scores,method:'manual',...extra});
const diceFrom=values=>{let i=0;return sides=>{assert.equal(sides,6);return values[i++%values.length]}};

test('4d6 drops exactly one lowest die, including ties, and keeps the evidence',()=>{
  const rolls=rollAbilityScores('4d6-drop-lowest',diceFrom([6,6,2,1,1,1,4,5]));
  assert.equal(rolls.length,6);assert.deepEqual(rolls[0],{dice:[6,6,2,1],droppedIndex:3,total:14});
  assert.deepEqual(rolls[1],{dice:[1,1,4,5],droppedIndex:0,total:10});
  assert.ok(rollAbilityScores('4d6-drop-lowest',()=>1).every(r=>r.total===3));
  assert.ok(rollAbilityScores('4d6-drop-lowest',()=>6).every(r=>r.total===18));
});

test('3d6 keeps all dice and both methods reject an invalid dice source',()=>{
  const rolls=rollAbilityScores('3d6',diceFrom([1,3,6]));
  assert.ok(rolls.every(r=>r.total===10&&r.droppedIndex===null&&r.dice.length===3));
  for(const method of ['3d6','4d6-drop-lowest'])for(const invalid of [0,7,NaN,2.5])assert.throws(()=>rollAbilityScores(method,()=>invalid),/invalid d6/);
});

test('assigning scores swaps rolls without duplicating them, even when totals match',()=>{
  const rolls=rollAbilityScores('4d6-drop-lowest',diceFrom([6,6,6,1,2,2,2,1]));
  const original=startingAssignment(),next=assignAbilityRoll(original,3,0);
  assert.deepEqual(original,[0,1,2,3,4,5]);assert.deepEqual(next,[3,1,2,0,4,5]);
  const assigned=assignedScores(rolls,next);assert.equal(assigned.INT,18);assert.equal(assigned.STR,6);
  assert.equal(new Set(next).size,6);
  assert.throws(()=>assignedScores(rolls,[0,0,2,3,4,5]),/assign each one once/);
  assert.throws(()=>assignedScores(rolls.slice(1),next),/Roll six scores/);
});

test('a new adventurer has chosen scores and rules without the demo identity, gear, money, or spell choices',()=>{
  const c=create({name:'  ',kind:'Fighter',raceId:'dwarf',scores:{...scores,CON:14}});
  assert.equal(c.name,'Unnamed adventurer');assert.equal(c.level,1);
  assert.deepEqual(c.scores,{...scores,CON:14});assert.equal(effectiveScore(c,'CON'),16);
  assert.equal(c.maxHp,13);assert.equal(c.hp,13);assert.equal(c.defense.armor,0);assert.equal(c.defense.shield,0);
  assert.deepEqual(c.weapons,[]);assert.deepEqual(c.gear,[]);assert.deepEqual(c.coins,{cp:0,sp:0,gp:0,pp:0});
  assert.ok(c.skills.every(s=>s.ranks===0));assert.ok(c.features.some(f=>f.kind==='Racial trait'));
  assert.throws(()=>create({scores:{...scores,STR:2.5}}),/whole ability scores/);
});

test('chosen Intelligence and racial Constitution determine first-level skills, HP, slots, and roll notes',()=>{
  const rolls=rollAbilityScores('4d6-drop-lowest',()=>6),assignment=startingAssignment();
  const c=create({raceId:'elf',scores:assignedScores(rolls,assignment),method:'4d6-drop-lowest',rolls,assignment});
  assert.equal(c.scores.CON,18);assert.equal(effectiveScore(c,'CON'),16);assert.equal(c.maxHp,7);assert.equal(c.hp,7);
  assert.equal(skillLedger(c).granted,24);assert.equal(c.automation.history[0].intScore,18);
  assert.equal(c.casters[0].slots[1].max,2);assert.deepEqual(c.casters[0].spells,[]);
  assert.ok(c.notes.includes('INT: 18'));assert.equal(c.notes.match(/\[dropped\]/g).length,6);
  const psion=create({kind:'Psion'});assert.equal(psion.psionics[0].max,4);assert.deepEqual(psion.psionics[0].powers,[]);
  assert.throws(()=>create({method:'4d6-drop-lowest',rolls,assignment}),/do not match the rolls/);
});

test('every base class and race starts valid, with race previews matching its saved scores',()=>{
  for(const kind of baseClasses)for(const race of raceCatalog){
    const c=create({kind:kind.name,raceId:race.id}),preview=startingAbilityScores(scores,race.id);
    assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c,kind.name+' / '+race.name);
    for(const ability of abilityKeys)assert.equal(preview[ability],effectiveScore(c,ability),kind.name+' / '+race.name+' '+ability);
    const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);assert.equal(c.hp,c.maxHp);
  }
  assert.equal(startingAbilityScores({...scores,INT:3},'half-orc').INT,3);
});

test('an empty browser stays empty until creation; rolled scores survive save, import, and final deletion',async()=>{
  const values=new Map();let writes=0;
  const api=createBrowserCharacterApi({scope:'/creation-test/',storage:()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>{writes++;values.set(key,value)}}),lock:async(name,operation)=>operation()});
  assert.deepEqual((await api('/api/characters')).characters,[]);assert.equal(writes,0);
  const rolls=rollAbilityScores('3d6',diceFrom([4,5,6])),assignment=startingAssignment(),c=create({scores:assignedScores(rolls,assignment),method:'3d6',rolls,assignment});
  const row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
  const loaded=await api('/api/characters/'+row.id);assert.deepEqual(loaded.data,c);
  const imported=characterSchema.parse(JSON.parse(JSON.stringify({format:'barrow-ledger-character',version:1,data:loaded.data})).data);
  assert.deepEqual(recompute(imported),c);
  await api('/api/characters/'+row.id,{method:'DELETE',body:JSON.stringify({revision:row.revision})});
  assert.deepEqual((await api('/api/characters')).characters,[]);assert.equal(writes,2);
});
