import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {repairRoll20CastingProgression} from '../lib/roll20-casting-progression.ts';
import {characterSchema} from '../lib/model.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'casting-test',name:'Casting test'},attributes:Object.entries({class1:'Wizard',level1:3,int:16,hp:12,hp_max:16,...extra}).map(([name,current])=>({name,current,max:''}))});
const legacy=extra=>activateAutomation(migrateRoll20Automation(importRoll20(raw(extra)).character));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));

test('imported caster advancement no longer freezes while source totals and spent slots remain intact',async()=>{
 const data=raw({arcanecasterlevel:4,arcanespells1:5,arcanespells2:0,arcanespells1_used:2,repeating_spells12_ROW_spellname12:'Magic Missile',repeating_spells12_ROW_spellprep12:3,repeating_spells12_ROW_spellused12:1});
 const c=await load(importRoll20(data).character),p=c.casters[0];
 assert.equal(p.casting.automatic,true);assert.equal(p.level,4);assert.equal(p.slots[1].max,5);assert.equal(p.slots[2].max,0);assert.equal(p.slots[1].used,2);
 assert.equal(p.spells[0].prepared,3);assert.equal(p.spells[0].spent,1);
 c.classLevels[0].level=5;recompute(c);assert.equal(p.level,6);assert.equal(p.slots[1].max,6);assert.ok(p.slots[3].max>0);
 assert.equal(p.slots[1].used,2);assert.equal(p.spells[0].spent,1);assert.deepEqual(c.roll20Import.raw,data);
});

test('existing saves catch up later levels and ability gains without freezing them into import offsets',async()=>{
 const c=legacy({arcanecasterlevel:4,arcanespells1:5,arcanespells1_used:2});
 c.classLevels[0].level=5;c.scores.INT=20;recompute(c);c.hp-=3;c.notes='Later notes';
 c.casters[0].slots[1].used=4;c.casters[0].name='Personal spellbook';c.casters[0].dcExtra=2;
 const before=saved(c),fixed=await load(c),p=fixed.casters[0];
 assert.equal(p.casting.automatic,true);assert.equal(p.level,6);assert.equal(p.slots[1].max,7);assert.equal(p.slots[1].used,4);assert.equal(p.dcExtra,2);assert.equal(p.name,'Personal spellbook');
 for(const key of ['classLevels','scores','skills','automation','features','hp','maxHp','notes','gear','weapons'])assert.deepEqual(saved(fixed[key]),before[key],key);
 assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('missing and formula totals do not become offsets canceling prestige advancement',async()=>{
 for(const extra of [{},{arcanecasterlevel:'@{level1}+@{level2}',arcanespells3:'@{slots}'}]){
  const c=await load(importRoll20(raw({class2:'Loremaster',level2:2,...extra})).character),p=c.casters[0];
  assert.equal(p.level,5);assert.ok(p.slots[3].max>0);assert.equal(p.casting.levelAdjustment,0);assert.deepEqual(p.casting.slotAdjustments,Array(10).fill(0));
 }
});

test('divine and arcane pools advance independently and spent spontaneous uses stay spent',async()=>{
 const c=legacy({class1:'Sorcerer',cha:16,class2:'Cleric',level2:3,wis:16,arcanespells1_used:3,divinespells1_used:2});
 c.classLevels[0].level=4;c.classLevels[1].level=5;recompute(c);
 const fixed=await load(c),arc=fixed.casters.find(p=>p.name==='Sorcerer'),div=fixed.casters.find(p=>p.name==='Cleric');
 assert.equal(arc.level,4);assert.equal(div.level,5);assert.equal(arc.mode,'spontaneous');assert.equal(arc.slots[1].used,3);assert.equal(div.slots[1].used,2);assert.ok(div.slots[3].max>0);
});

test('psionic progression keeps numeric reserve/level adjustments and current spent points',async()=>{
 const c=legacy({class1:'Psion',level1:3,manifesterlevel:4,powerpoints_max:20,powerpoints:13});
 c.classLevels[0].level=5;c.scores.INT=18;recompute(c);c.psionics[0].spent=12;c.psionics[0].focused=true;
 const p=(await load(c)).psionics[0];
 assert.equal(p.manifesting.automatic,true);assert.equal(p.level,6);assert.equal(p.max,40);assert.equal(p.spent,12);assert.equal(p.focused,true);
 const fresh=await load(importRoll20(raw({class1:'Psion',powerpoints_max:20,powerpoints:13,manifesterlevel:4})).character);
 assert.equal(fresh.psionics[0].max,20);assert.equal(fresh.psionics[0].spent,7);
});

test('non-numeric point maxima use class progression, but source reserves raised to current points remain intact',async()=>{
 const c=await load(importRoll20(raw({class1:'Psion',powerpoints_max:'@{pool}',powerpoints:5})).character);
 assert.equal(c.psionics[0].max,15);assert.equal(c.psionics[0].spent,10);
 const raised=await load(importRoll20(raw({class1:'Psion',powerpoints:30})).character);
 assert.equal(raised.psionics[0].max,30);assert.equal(raised.psionics[0].spent,0);
});

test('edited levels, maxima, abilities, modes and adjustments are not overwritten',async()=>{
 for(const change of [p=>{p.level=7;},p=>{p.slots[1].max=9;},p=>{p.ability='WIS';},p=>{p.mode='spontaneous';},p=>{p.casting.slotAdjustments[1]=1;},p=>{p.casting.progression=8;}]){
  const c=legacy();change(c.casters[0]);const before=saved(c.casters),fixed=await load(c);
  assert.deepEqual(fixed.casters,before);assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('edited, removed, or ambiguous')));
 }
 const psi=legacy({class1:'Psion'});psi.psionics[0].max=50;const before=saved(psi.psionics);assert.deepEqual((await load(psi)).psionics,before);
});

test('removed, duplicate and generic/domain traditions require review, not automatic reassignment',async()=>{
 for(const change of [c=>{c.casters=[];},c=>{c.casters.push({...structuredClone(c.casters[0]),id:'duplicate'});},c=>{c.classLevels=[];}]){
  const c=legacy();change(c);const before=saved(c.casters),fixed=await load(c);assert.deepEqual(fixed.casters,before);
 }
 const c=await load(importRoll20(raw({class2:'Sorcerer',level2:3,cha:16,arcanecasterlevel:6,arcanespells1:9})).character);
 assert.equal(c.casters.find(p=>!p.casting.classId).casting.automatic,false);
 const domain=await load(importRoll20(raw({class1:'Cleric',wis:16,repeating_spells11_ROW_spellname11:'Bless',repeating_spells11_ROW_domain:1})).character);
 const pool=domain.casters.find(p=>p.casting.domain);assert.ok(pool);assert.equal(pool.casting.automatic,false);
});

test('migration is one-time and manual choices survive browser/native backups',async()=>{
 const c=await load(legacy());c.casters[0].casting.automatic=false;c.casters[0].slots[1].max=8;
 const records=new Map(),api=createBrowserCharacterApi({scope:'casting-progression',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=(await api('/api/characters/'+record.id)).data;
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:loaded}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('invalid source and manual overall mode do not change casting or mark a repair complete',async()=>{
 const c=legacy();c.roll20Import.raw={invalid:true};const before=saved(c.casters);
 await repairRoll20CastingProgression(c);assert.deepEqual(saved(c.casters),before);assert.equal(c.roll20Import.castingProgressionMigration,undefined);
 const manual=importRoll20(raw()).character;await repairRoll20CastingProgression(manual);assert.equal(manual.casters[0].casting.automatic,false);assert.equal(manual.roll20Import.castingProgressionMigration,undefined);
});

test('late spellcasting and split casting abilities gain their correct class slots',async()=>{
 const ranger=legacy({class1:'Ranger',level1:3,wis:14});ranger.classLevels[0].level=4;recompute(ranger);
 const r=(await load(ranger)).casters[0];assert.equal(r.level,2);assert.equal(r.slots[1].max,1);
 const favored=await load(importRoll20(raw({class1:'Favored Soul',cha:18,wis:12})).character);
 assert.equal(favored.casters[0].casting.automatic,true);assert.equal(favored.casters[0].slots[1].max,6);
});

test('temporary score changes do not grant slots and exhausted pools are not clamped down',async()=>{
 const c=legacy();c.temps.INT=8;c.casters[0].slots[1].used=10;
 const fixed=await load(c),p=fixed.casters[0];assert.equal(p.slots[1].max,3);assert.equal(p.slots[1].used,10);
 const psionic=legacy({class1:'Psion'});psionic.psionics[0].spent=30;
 assert.equal((await load(psionic)).psionics[0].spent,30);
});

test('multiple psionic profiles keep distinct spent resources and explicit zero source maxima',async()=>{
 const c=legacy({class1:'Psion',class2:'Psychic Warrior',level2:2,wis:16});
 c.psionics[0].spent=9;c.psionics[1].spent=2;c.classLevels[0].level=4;c.classLevels[1].level=3;recompute(c);
 const fixed=await load(c);assert.deepEqual(fixed.psionics.map(p=>p.spent),[9,2]);assert.deepEqual(fixed.psionics.map(p=>p.level),[4,3]);
 const zero=await load(importRoll20(raw({class1:'Psion',powerpoints_max:0,powerpoints:0})).character);
 assert.equal(zero.psionics[0].max,0);assert.equal(zero.psionics[0].manifesting.pointsAdjustment,-15);
});
