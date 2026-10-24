import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20,roll20SpellCatalog} from '../lib/roll20-import.ts';
import {axeBrotherImportEvidence,repairAxeBrotherImport} from '../lib/roll20-cleric-review.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema,uid} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {axeBrotherDomainList} from '../lib/cleric-domains.ts';
import {castingNumbers} from '../lib/advancement.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

// Synthetic reproduction, never a player's private export.
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-23',character:{id:'cleric-review-test',name:'Cleric review QA'},attributes:Object.entries({
 class1:'cleric dwarf strength',level1:0,level:2,race:'Dwarf',deity:' Clangeddin Silverbeard',wis:17,cha:15,con:13,hp:15,hp_max:18,bab:1,
 divinecasterlevel:1,divinespells0:4,divinespells1:3,feats:'Great Fortitude',healranks:4,
 repeating_doains_DWARF_domainName:'dwarf',repeating_doains_DWARF_domainGrantedPower:'Great Fortitude bonus feat',
 repeating_doains_STRENGTH_domainName:'strength',repeating_doains_STRENGTH_domainGrantedPower:'Supernatural feat of strength',
 repeating_spells11_BEARD_spellname11:'Silverbeard',repeating_spells11_BEARD_domain11:1,repeating_spells11_BEARD_spellprep11:3,repeating_spells11_BEARD_spellused11:3,
 repeating_spells11_ENLARGE_spellname11:'Enlarge Person',repeating_spells11_ENLARGE_domain11:1,repeating_spells11_ENLARGE_spellprep11:1,repeating_spells11_ENLARGE_spellused11:1,
 repeating_spells01_GUIDANCE_spellname01:'Guidance',repeating_spells01_GUIDANCE_domain01:1,repeating_spells01_GUIDANCE_spellprep01:2,repeating_spells01_GUIDANCE_spellused01:2,
 ...extra}).map(([name,current])=>({name,current,max:''}))});
const save=c=>JSON.parse(JSON.stringify(c));
const repair=c=>repairAxeBrotherImport(c,roll20SpellCatalog());
const load=c=>prepareCharacter(characterSchema.parse(save(c)));

test('domain rows including Roll20 doains typo become visible feature cards without duplicate feat grants',()=>{
 const c=importRoll20(raw()).character;
 assert.equal(c.features.filter(f=>/domain$/i.test(f.name)).length,2);
 assert.equal(c.features.filter(f=>/^Great Fortitude\b/.test(f.name)).length,1);
 assert.equal(c.clericSpecialty,'none');assert.equal(c.classLevels.length,0);
 assert.ok(axeBrotherImportEvidence(c));
});

test('confirmed fresh review restores Cleric and full casting, moving rather than recreating spent spells',async()=>{
 const original=importRoll20(raw()).character,before=save(original),fixed=await load(repair(original));
 assert.deepEqual(save(original),before);assert.equal(fixed.clericSpecialty,'axe-brother');assert.equal(fixed.classLevels[0].level,2);
 assert.equal(fixed.hp,15);assert.equal(fixed.maxHp,18);
 const normal=fixed.casters.find(p=>!p.casting.domain),domain=fixed.casters.find(p=>p.casting.domain);
 assert.equal(normal.level,2);assert.equal(domain.level,2);assert.equal(normal.list,'Cleric');assert.equal(domain.list,axeBrotherDomainList);
 assert.deepEqual(normal.slots.slice(0,3).map(s=>s.max),[4,3,0]);assert.deepEqual(domain.slots.slice(0,3).map(s=>s.max),[0,1,0]);
 assert.deepEqual(domain.spells.map(s=>s.spellId),['enlarge-person']);
 const beard=normal.spells.find(s=>s.spellId==='supp-silverbeard');assert.equal(beard.prepared,3);assert.equal(beard.spent,3);
 assert.equal(normal.spells.find(s=>s.spellId==='guidance').spent,2);
 assert.deepEqual(fixed.casters.flatMap(p=>p.spells).map(s=>s.id).sort(),before.casters.flatMap(p=>p.spells).map(s=>s.id).sort());
 assert.deepEqual(fixed.roll20Import.raw,raw());assert.deepEqual(save(repair(fixed)),save(fixed));
});

test('existing classless saves retain later level, HP, ranks, equipment, notes and spent resources',async()=>{
 const c=await load(importRoll20(raw()).character);c.level=4;c.scores.WIS=19;c.hp-=2;c.notes='Later session';
 c.casters[0].slots[1].used=1;c.casters[1].slots[1].used=2;c.casters[0].spells.push({id:'later-spell',spellId:'bless',level:1,slotLevel:1,prepared:1,spent:1,formula:'',notes:'Later prayer',custom:null});
 c.features.push({id:'spent-feature',name:'Personal ability',kind:'Other',description:'',source:'',max:3,used:2});
 const before=save(c),fixed=await load(repair(c));assert.equal(fixed.classLevels[0].level,4);
 for(const key of ['hp','maxHp','scores','notes','gear','weapons','coins','tempHp'])assert.deepEqual(save(fixed[key]),before[key],key);
 assert.deepEqual(fixed.skills.map(s=>[s.id,s.ranks,s.misc]),c.skills.map(s=>[s.id,s.ranks,s.misc]));
 assert.deepEqual(fixed.casters.map(p=>p.slots.map(s=>s.used)),c.casters.map(p=>p.slots.map(s=>s.used)));
 assert.equal(fixed.features.find(f=>f.id==='spent-feature').used,2);
 assert.equal(fixed.casters[0].spells.find(s=>s.id==='later-spell').spent,1);
 const after=save(fixed);assert.deepEqual(save(await load(fixed)),after);
});

test('already corrected class levels and histories survive review, then normal progression advances',async()=>{
 let c=await load(importRoll20(raw({class1:'Cleric',level1:2})).character);
 c.classLevels[0].level=5;recompute(c);c.hp-=4;c.casters[0].slots[1].used=2;c.notes='Levelled up';
 const before=save(c);c=repair(c);
 assert.deepEqual(save(c.classLevels),before.classLevels);assert.deepEqual(save(c.automation.history),before.automation.history);
 assert.equal(c.maxHp-c.hp,before.maxHp-before.hp);assert.equal(c.casters[0].level,5);assert.equal(c.casters[0].slots[1].used,2);
 assert.equal(c.features.filter(f=>/^Great Fortitude\b/.test(f.name)).length,1);
 c.classLevels[0].level=7;recompute(c);assert.equal(c.casters[0].level,7);assert.equal(c.casters[1].slots[4].max,1);assert.equal(c.casters[0].slots[1].used,2);
});

test('ambiguous, unrelated or unsupported imports are rejected atomically',async()=>{
 for(const extra of [{deity:'Moradin'},{class2:'Fighter',level2:1},{repeating_doains_STRENGTH_domainName:'War'},{class1:'Cleric wizard'},{level:21}])assert.equal(axeBrotherImportEvidence(importRoll20(raw(extra)).character),null);
 for(const mutate of [c=>c.casters.push({...structuredClone(c.casters[0]),id:uid()}),c=>c.classLevels.push({id:uid(),classId:'fighter',name:'Fighter',level:4,notes:''}),c=>{c.ancestry.racialHitDice=2;}]){
  const c=await load(importRoll20(raw()).character);mutate(c);const before=save(c);assert.throws(()=>repair(c));assert.deepEqual(save(c),before);
 }
});

test('unknown domain spells and overlapping preparations are retained for review, never deleted or refunded',async()=>{
 const c=await load(importRoll20(raw({repeating_spells11_CUSTOM_spellname11:'My custom prayer',repeating_spells11_CUSTOM_domain11:1,repeating_spells11_CUSTOM_spellprep11:2,repeating_spells11_CUSTOM_spellused11:1})).character);
 const custom=save(c.casters[1].spells.find(s=>s.custom)),fixed=repair(c);
 assert.deepEqual(save(fixed.casters[1].spells.find(s=>s.id===custom.id)),custom);
 assert.ok(fixed.casters[1].spells.reduce((n,s)=>n+s.prepared,0)>fixed.casters[1].slots[1].max);
});

test('Dwarf and Strength share one progressing domain pool and expose both spell lists',()=>{
 const spells=roll20SpellCatalog(),dwarf=spells.filter(s=>s.levels.Dwarf!==undefined);
 assert.deepEqual(dwarf.map(s=>s.levels.Dwarf).sort((a,b)=>a-b),[1,2,3,4,5,6,7,8,9]);
 assert.equal(spells.find(s=>s.id==='magic-weapon').levels[axeBrotherDomainList],1);
 assert.equal(spells.find(s=>s.id==='enlarge-person').levels[axeBrotherDomainList],1);
 assert.equal(spells.find(s=>s.id==='guidance').levels[axeBrotherDomainList],undefined);
 const c=repair(importRoll20(raw()).character),p=c.casters.find(p=>p.casting.domain);
 assert.deepEqual(p.slots.map(s=>s.max),castingNumbers(c,p).slots);assert.equal(p.slots[1].max,1);
});

test('browser save and native reload preserve the completed repair and all counters',async()=>{
 const c=repair(await load(importRoll20(raw()).character)),records=new Map();
 const api=createBrowserCharacterApi({scope:'cleric-review',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const reloaded=await load((await api('/api/characters/'+record.id)).data);
 assert.deepEqual(save(reloaded),save(c));assert.deepEqual(save(repair(reloaded)),save(c));
});
