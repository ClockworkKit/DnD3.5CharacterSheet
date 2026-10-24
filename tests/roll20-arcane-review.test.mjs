import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20,roll20SpellCatalog} from '../lib/roll20-import.ts';
import {arcaneImportEvidence,repairSorcererImport,repairFactotumImport} from '../lib/roll20-arcane-review.ts';
import {characterSchema,uid} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';
import {castingNumbers} from '../lib/advancement.ts';
import {castDilettante,factotumNumbers} from '../lib/factotum.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {resetDaily} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

// Synthetic reproduction only; never commit private player exports.
const raw=(kind='factotum',extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-24',character:{id:'arcane-review-'+kind,name:'Arcane review QA'},attributes:Object.entries({
 class1:kind,level1:kind==='factotum'?1:2,arcanecasterlevel:kind==='factotum'?2:1,
 int:16,cha:16,con:8,hp:7,hp_max:10,bab:1,arcanespells0:kind==='factotum'?3:6,arcanespells1:kind==='factotum'?0:4,
 repeating_spells02_FROST_spellname02:'Ray of frost',repeating_spells02_FROST_spellprep02:3,repeating_spells02_FROST_spellused02:3,
 ...extra}).map(([name,current])=>({name,current,max:''}))});
const save=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(save(c)));
const catalog=roll20SpellCatalog();
const factRepair=(c,status='spent')=>repairFactotumImport(c,catalog,Object.fromEntries(c.casters.flatMap(p=>p.spells.map(k=>[k.id,status]))));

test('source evidence is narrow and does not depend on private character names',()=>{
 assert.equal(arcaneImportEvidence(importRoll20(raw()).character),'factotum');
 assert.equal(arcaneImportEvidence(importRoll20(raw('sorcerer')).character),'sorcerer');
 for(const extra of [{class1:'Wizard'},{level1:3},{class2:'Cleric',level2:1},{repeating_classes_OTHER_name:'Wizard'},{arcanecasterlevel:1}])assert.equal(arcaneImportEvidence(importRoll20(raw('factotum',extra)).character),null);
 const conflicting=raw();conflicting.attributes.push({name:'class2',current:'Wizard'},{name:'class2',current:'Cleric'});
 assert.equal(arcaneImportEvidence(importRoll20(conflicting).character),null);
});

test('normal Sorcerer review removes source offsets but not spells, notes, use counts or later progression',async()=>{
 let c=await load(importRoll20(raw('sorcerer')).character);
 assert.equal(c.casters[0].level,1);
 c.classLevels[0].level=5;recompute(c);c.hp-=2;c.notes='Later session';c.casters[0].slots[1].used=4;
 c.casters[0].spells[0].notes='Later spell notes';c.casters[0].dcExtra=2;c.casters[0].penetration=3;
 const before=save(c);const fixed=repairSorcererImport(c),p=fixed.casters[0];
 assert.deepEqual(save(c),before);assert.equal(p.level,5);assert.equal(p.slots[1].used,4);
 assert.deepEqual(p.slots.map(s=>s.max),castingNumbers(fixed,p).slots);
 assert.deepEqual(save(p.spells),before.casters[0].spells);assert.equal(p.dcExtra,2);assert.equal(p.penetration,3);
 for(const key of ['classLevels','scores','hp','maxHp','notes','gear','skills'])assert.deepEqual(save(fixed[key]),before[key],key);
 assert.deepEqual(save(fixed.automation.history),before.automation.history);
 assert.deepEqual(save(await load(fixed)),save(fixed));assert.equal(repairSorcererImport(fixed),fixed);
 fixed.classLevels[0].level=6;recompute(fixed);assert.equal(fixed.casters[0].level,6);assert.equal(fixed.casters[0].slots[1].used,4);
});

test('fresh Sorcerer review remains corrected after normal save adoption',async()=>{
 const c=importRoll20(raw('sorcerer')).character,before=save(c),fixed=await load(repairSorcererImport(c));
 assert.equal(fixed.casters[0].level,2);assert.deepEqual(fixed.casters[0].slots.slice(0,2).map(s=>s.max),[6,5]);
 assert.deepEqual(save(fixed.casters[0].spells),before.casters[0].spells);
 assert.equal(fixed.hp,7);assert.equal(fixed.maxHp,10);assert.deepEqual(fixed.roll20Import.raw,raw('sorcerer'));
});

test('Factotum repair archives the entire current book and requires an explicit daily-use decision',async()=>{
 const c=importRoll20(raw()).character,before=save(c);
 assert.throws(()=>repairFactotumImport(c,catalog,{}),/Confirm today's status/);assert.deepEqual(save(c),before);
 const fixed=await load(factRepair(c));
 assert.equal(fixed.classLevels[0].level,2);assert.equal(fixed.level,2);assert.equal(fixed.casters.length,0);
 assert.equal(fixed.hp,7);assert.equal(fixed.maxHp,10);assert.equal(fixed.bab,before.bab);
 assert.deepEqual(save(fixed.roll20Import.factotumArchivedCasting),before.casters);
 assert.equal(fixed.factotum.spells.length,1);assert.equal(fixed.factotum.spells[0].spent,true);
 assert.equal(fixed.factotum.spent,0);assert.equal(factotumNumbers(fixed).inspiration,3);
 assert.deepEqual(save(await load(fixed)),save(fixed));assert.equal(factRepair(fixed,'unused'),fixed);
 assert.deepEqual(fixed.roll20Import.raw,raw());
});

test('a confirmed unused choice casts once for one inspiration, even across encounter reset',async()=>{
 const c=await load(factRepair(importRoll20(raw()).character,'unused'));
 assert.equal(c.factotum.spells[0].spent,false);assert.equal(c.factotum.spent,0);
 const spell=c.factotum.spells[0].spell,roll=makeDilettanteRoll(c,spell);
 assert.deepEqual(roll.rolls.map(r=>r.formula),['1d20+1','1d3']);castDilettante(c,spell.id);assert.equal(c.factotum.spent,1);
 assert.throws(()=>castDilettante(c,spell.id),/already been used/);
 c.factotum.spent=0;assert.throws(()=>castDilettante(c,spell.id),/already been used/);
 assert.equal(c.roll20Import.factotumArchivedCasting[0].spells[0].spent,3);
 const rested=await load(resetDaily(c));assert.equal(rested.factotum.spells.length,0);assert.equal(rested.casters.length,0);
 assert.deepEqual(rested.roll20Import.factotumArchivedCasting,c.roll20Import.factotumArchivedCasting);
});

test('reference-only decisions do not invent current daily choices or inspiration expenditure',async()=>{
 const c=await load(importRoll20(raw()).character);c.factotum.spent=2;
 const fixed=factRepair(c,'reference');assert.deepEqual(fixed.factotum,c.factotum);
 assert.equal(fixed.roll20Import.factotumArchivedCasting[0].spells.length,1);assert.equal(fixed.casters.length,0);
});

test('later Factotum levels, daily choices, histories, ranks, counters and full spell edits survive',async()=>{
 const c=await load(importRoll20(raw()).character);c.classLevels[0].level=6;recompute(c);
 c.hp-=2;c.notes='Later notes';c.factotum={...c.factotum,spent:3,pietyUsed:1,knowledgeUsed:[c.skills[0].id],dodgeUsed:true,spells:[{spell:catalog.find(s=>s.id==='ray-of-frost'),spent:true}]};
 c.casters[0].spells[0].formula='2d3';c.casters[0].spells[0].notes='Later damage override';c.casters[0].slots[0].used=2;
 const before=save(c),fixed=repairFactotumImport(c,catalog,{});
 for(const key of ['classLevels','factotum','hp','maxHp','skills','notes','gear','weapons','scores','tempHp'])assert.deepEqual(save(fixed[key]),before[key],key);
 assert.deepEqual(save(fixed.automation.history),before.automation.history);
 assert.deepEqual(save(fixed.roll20Import.factotumArchivedCasting),before.casters);
 assert.deepEqual(save(await load(fixed)),save(fixed));
});

test('a later manual character level is not lowered to the erroneous original class level',()=>{
 const c=importRoll20(raw()).character;c.level=5;
 const fixed=factRepair(c,'reference');assert.equal(fixed.classLevels[0].level,5);assert.equal(fixed.level,5);
});

test('ambiguous current books/classes and invalid daily choices fail atomically',async()=>{
 const mutations=[c=>c.casters.push({...structuredClone(c.casters[0]),id:uid()}),c=>{c.casters[0].name='Renamed book';},c=>{c.classLevels[0].classId='wizard';},c=>{c.ancestry.racialHitDice=1;},c=>c.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:2,notes:''}),c=>c.casters[0].spells.push({...structuredClone(c.casters[0].spells[0]),id:uid()})];
 for(const mutate of mutations){const c=await load(importRoll20(raw()).character);mutate(c);const before=save(c);assert.throws(()=>factRepair(c,'unused'));assert.deepEqual(save(c),before);}
 const sorc=await load(importRoll20(raw('sorcerer')).character);sorc.casters.push({...structuredClone(sorc.casters[0]),id:uid()});
 const before=save(sorc);assert.throws(()=>repairSorcererImport(sorc));assert.deepEqual(save(sorc),before);
});

test('unsupported spells can be archived without guessing rules or losing their data',()=>{
 const c=importRoll20(raw('factotum',{repeating_spells02_FROST_spellname02:'Personal unknown cantrip'})).character;
 const before=save(c);assert.throws(()=>factRepair(c,'unused'));assert.deepEqual(save(c),before);
 const fixed=factRepair(c,'reference');assert.deepEqual(save(fixed.roll20Import.factotumArchivedCasting),before.casters);
});

test('browser and native backups retain archival records and do not resurrect a wizard pool',async()=>{
 const c=await load(factRepair(importRoll20(raw()).character)),records=new Map();
 const api=createBrowserCharacterApi({scope:'arcane-review',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const reloaded=await load((await api('/api/characters/'+saved.id)).data);
 assert.deepEqual(save(reloaded),save(c));assert.equal(reloaded.casters.length,0);
});
