import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {repairRoll20MonkDefense} from '../lib/roll20-monk-defense.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {sheetTotals} from '../lib/rules.ts';
import {classLevel} from '../lib/effects.ts';
import {effectiveScore} from '../lib/ancestry.ts';
import {movement} from '../lib/equipment.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'monk-defense-test',name:'Monk defense test'},attributes:Object.entries({class1:'Monk',level1:3,str:10,dex:14,wis:16,hp:14,hp_max:18,acitem:'Leather',acitembonus:2,acitemcheckpenalty:0,armorclass:14,...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const legacy=async(extra={})=>{const source=importRoll20(raw(extra)).character,oldMisc=source.defense.misc-Math.floor((effectiveScore(source,'WIS')-10)/2)-Math.floor(classLevel(source,'monk')/5);const c=await load(source);c.defense.misc=oldMisc;delete c.roll20Import.monkDefenseMigration;return c;};

test('adopting armored, shielded or encumbered monks no longer subtracts an unavailable AC bonus',async()=>{
 const cases=[{},
  {acitem:'none',acitembonus:0,shieldname:'Buckler',shieldbonus:1,shieldcheckpenalty:1,armorclass:13},
  {acitem:'none',acitembonus:0,shieldname:'Training shield',shieldbonus:0,shieldcheckpenalty:0,armorclass:12},
  {acitem:'none',acitembonus:0,repeating_equipment_ROW_equipmentname:'Supplies',repeating_equipment_ROW_equipmentweight:50,armorclass:12},
  {wis:8},{level1:6,wis:18},
 ];
 for(const extra of cases){const data=raw(extra),manual=importRoll20(data).character,total=sheetTotals(manual).ac,c=await load(manual);assert.equal(movement(c).free,false);assert.equal(sheetTotals(c).ac,total);assert.deepEqual(c.roll20Import.raw,data);}
});

test('unarmored monks still preserve recorded totals without double-counting their AC bonus',async()=>{
 const c=await load(importRoll20(raw({acitem:'none',acitembonus:0,armorclass:15})).character);
 assert.equal(movement(c).free,true);assert.equal(sheetTotals(c).ac,15);assert.equal(c.defense.misc,0);
 const old=await legacy({acitem:'none',acitembonus:0,armorclass:15}),before=saved(old);
 await repairRoll20MonkDefense(old);assert.equal(old.defense.misc,before.defense.misc);
});

test('existing bad offsets are repaired using original levels, not later advancement or current gear',async()=>{
 const c=await legacy({level1:6,wis:18});assert.equal(c.defense.misc,-5);
 c.classLevels[0].level=10;c.scores.WIS=20;c.gear[0].equipped=false;recompute(c);c.hp-=4;c.notes='After advancement';
 const resource=c.features.find(f=>f.max>0);if(resource)resource.used=1;
 const before=saved(c),fixed=await load(c),after=saved(fixed);
 assert.equal(after.defense.misc,0);assert.equal(sheetTotals(fixed).ac,sheetTotals(c).ac+5);
 after.defense.misc=before.defense.misc;after.roll20Import=before.roll20Import;
 assert.deepEqual(after,before);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('edited miscellaneous AC, explicit overrides, and already-corrected sheets remain untouched',async()=>{
 for(const edit of [c=>{c.defense.misc=7;},c=>{c.automation.overrides['defense.misc']=0;},c=>{c.defense.misc=0;}]){
  const c=await legacy();edit(c);const before=saved(c);await repairRoll20MonkDefense(c);
  const after=saved(c);after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
 }
});

test('old manual imports adopt the fixed calculation directly, without a second repair',async()=>{
 const c=importRoll20(raw()).character;delete c.roll20Import.monkDefenseMigration;
 const fixed=await load(c);assert.equal(fixed.defense.misc,0);assert.equal(sheetTotals(fixed).ac,14);assert.equal(fixed.roll20Import.monkDefenseMigration,1);
});

test('one-time recovery survives browser storage and native backups without reverting later misc edits',async()=>{
 const c=await load(await legacy());c.defense.misc=-3;
 const records=new Map(),api=createBrowserCharacterApi({scope:'monk-defense',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('invalid source exports do not change defenses or claim completion',async()=>{
 const c=await legacy();c.roll20Import.raw={invalid:true};const before=saved(c.defense);
 await repairRoll20MonkDefense(c);assert.deepEqual(saved(c.defense),before);assert.equal(c.roll20Import.monkDefenseMigration,undefined);
});
