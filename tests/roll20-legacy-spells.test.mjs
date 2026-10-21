import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {canCast,spendSpell} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const raw=extra=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'legacy-spells-test',name:'Legacy spell test'},attributes:Object.entries({class1:'Cleric',level1:3,wis:16,hp:20,hp_max:20,repeating_spells_ROW_spellname11:'Bless',repeating_spells_ROW_spellprep11:2,repeating_spells_ROW_spellused11:1,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
function legacy(extra={}){
 const c=importRoll20(raw(extra)).character;delete c.roll20Import.legacySpellsMigration;
 for(const p of c.casters){p.spells=p.spells.filter(s=>!s.roll20LegacyRow);}
 return activateAutomation(migrateRoll20Automation(c));
}

test('retired divine rows import with original preparation and usage, without becoming arcane spells',async()=>{
 const data=raw({class2:'Wizard',level2:2,int:16}),before=saved(data),c=await load(importRoll20(data).character);
 const divine=c.casters.find(p=>p.name==='Cleric'),arcane=c.casters.find(p=>p.name==='Wizard'),s=divine.spells[0];
 assert.equal(arcane.spells.length,0);assert.equal(s.spellId,'bless');assert.equal(s.level,1);
 assert.equal(s.prepared,2);assert.equal(s.spent,1);assert.equal(s.roll20LegacyRow,'ROW');
 assert.equal(canCast(divine,s,c),true);const spent=spendSpell(divine,s,c);assert.equal(canCast(spent,spent.spells[0],c),false);
 assert.deepEqual(data,before);assert.deepEqual(c.roll20Import.raw,before);
});

test('modern migrated row wins over retained legacy row, including case-insensitive RowID matching',async()=>{
 const c=await load(importRoll20(raw({repeating_spells11_row_spellname11:'Bless',repeating_spells11_row_spellprep11:3,repeating_spells11_row_spellused11:2})).character);
 const p=c.casters[0];assert.equal(p.spells.length,1);assert.equal(p.spells[0].prepared,3);assert.equal(p.spells[0].spent,2);
 assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('only the modern entry')));
 delete c.roll20Import.legacySpellsMigration;
 assert.deepEqual((await load(c)).casters,c.casters);
});

test('generic unnumbered spell rows still work even with an empty hidden legacy field',()=>{
 const c=importRoll20(raw({repeating_spells_ROW_spellname11:'',repeating_spells_ROW_name:'Bless',repeating_spells_ROW_level:1,repeating_spells_ROW_prepared:3,repeating_spells_ROW_used:2})).character;
 const s=c.casters[0].spells[0];assert.equal(s.roll20LegacyRow,undefined);assert.equal(s.prepared,3);assert.equal(s.spent,2);
});

test('old saves recover missing spells without resetting advancement, preparations or spent pools',async()=>{
 const c=legacy({repeating_spells12_ARC_spellname12:'Magic Missile',repeating_spells12_ARC_spellprep12:2,repeating_spells12_ARC_spellused12:1,class2:'Wizard',level2:2,int:16});
 c.classLevels[0].level=5;c.scores.WIS=18;recompute(c);c.hp-=4;c.notes='Advanced after importing';
 const p=c.casters.find(p=>p.name==='Cleric');p.slots[1].used=2;
 p.spells.push({id:'later',spellId:'shield-of-faith',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Added after import',custom:null});
 const before=saved(c),fixed=await load(c),restored=fixed.casters.find(q=>q.id===p.id),s=restored.spells.find(s=>s.roll20LegacyRow);
 assert.equal(s.spellId,'bless');assert.equal(s.prepared,0);assert.equal(s.spent,0);assert.equal(canCast(restored,s,fixed),false);
 assert.match(s.notes,/Original prepared: 2; used: 1/);
 assert.deepEqual(restored.spells.filter(s=>!s.roll20LegacyRow),before.casters.find(q=>q.id===p.id).spells);
 assert.deepEqual(restored.slots.map(s=>s.used),p.slots.map(s=>s.used));
 assert.equal(restored.level,5);assert.equal(restored.casting.automatic,true);assert.equal(restored.notes,p.notes);
 assert.deepEqual(restored.slots.map(s=>s.max),[5,4,3,2,0,0,0,0,0,0]);
 for(const key of ['classLevels','scores','skills','automation','features','hp','maxHp','notes','gear','weapons'])assert.deepEqual(saved(fixed[key]),before[key],key);
 const wizard=fixed.casters.find(q=>q.name==='Wizard'),oldWizard=before.casters.find(q=>q.name==='Wizard');
 assert.deepEqual({...wizard,casting:oldWizard.casting},oldWizard);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('manual re-additions and source-tagged edits are not duplicated or overwritten',async()=>{
 const original=importRoll20(raw({})).character.casters[0].spells[0];
 for(const change of [s=>{delete s.roll20LegacyRow;s.slotLevel=2;},s=>{s.roll20LegacyRow='row';s.spellId='shield-of-faith';}]){
  const c=legacy(),s={...original,id:'manual',prepared:5,spent:4,notes:'Player changes'};change(s);c.casters[0].spells.push(s);
  const before=saved(c.casters[0].spells);assert.deepEqual((await load(c)).casters[0].spells,before);
 }
 const c=await load(legacy());c.casters[0].spells=[];
 assert.equal((await load(c)).casters[0].spells.length,0,'deliberate deletion after repair must not resurrect the spell');
 const custom=legacy();custom.casters[0].spells.push({...original,id:'custom',roll20LegacyRow:undefined,custom:{id:'manual-bless',name:'Bless',school:'',levels:{},levelText:'1',components:'',castingTime:'',range:'',target:'',duration:'',save:'',resistance:'',description:'Player wording',source:''}});
 const before=saved(custom.casters[0].spells);assert.deepEqual(saved((await load(custom)).casters[0].spells),before);
});

test('distinct legacy rows remain distinct and unknown spells survive native backup and browser storage',async()=>{
 const extra={repeating_spells_ROW_spellname11:'Custom legacy prayer',repeating_spells_ROW_description:'Personal rules',repeating_spells_SECOND_spellname11:'Custom legacy prayer',repeating_spells_SECOND_spellprep11:1,repeating_spells_SECOND_spellused11:1};
 const fresh=importRoll20(raw(extra)).character;assert.equal(fresh.casters[0].spells.length,2);
 const c=await load(legacy(extra));assert.equal(c.casters[0].spells.length,2);
 assert.equal(c.casters[0].spells[0].custom.description,'Personal rules');
 const records=new Map(),api=createBrowserCharacterApi({scope:'legacy-spells',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=await load((await api('/api/characters/'+record.id)).data);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:restored}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('changed, removed or ambiguous casting traditions remain untouched with a review warning',async()=>{
 for(const change of [c=>{c.casters=[];},c=>{c.casters.push({...structuredClone(c.casters[0]),id:'other'});},c=>{c.casters[0].list='Different domain';},c=>{c.casters[0].mode='spontaneous';}]){
  const c=legacy();change(c);const before=saved(c.casters),fixed=await load(c);
  assert.deepEqual(fixed.casters,before);assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('could not be assigned')));
 }
});

test('spontaneous divine recovery preserves current spent slots rather than replaying historical use',async()=>{
 const extra={class1:'Favored Soul',cha:16},c=legacy(extra),p=c.casters[0];
 assert.equal(p.mode,'spontaneous');p.slots[1].used=3;const before=saved(p.slots);
 const fixed=await load(c),s=fixed.casters[0].spells[0];assert.equal(s.spent,0);assert.deepEqual(fixed.casters[0].slots,before);
});

test('invalid source data cannot change current spells or mark the repair complete',async()=>{
 const c=legacy();c.roll20Import.raw={invalid:true};const before=saved(c.casters),fixed=await load(c);
 assert.deepEqual(fixed.casters,before);assert.equal(fixed.roll20Import.legacySpellsMigration,undefined);
 assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('Legacy Roll20 spells could not be checked')));
});

test('conflicting legacy row names remain reviewable instead of silently disappearing during recovery',async()=>{
 const c=legacy(),data=c.roll20Import.raw;
 data.attributes.push({name:'repeating_spells_ROW_spellname11',current:'Shield of Faith',max:''});
 const fixed=await load(c);assert.equal(fixed.casters[0].spells.length,0);
 assert.ok(fixed.roll20Import.report.warnings.some(s=>s.includes('Conflicting attributes named repeating_spells_ROW_spellname11')));
});
