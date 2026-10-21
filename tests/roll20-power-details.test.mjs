import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {repairRoll20PowerDetails} from '../lib/roll20-power-details.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {powerCard} from '../lib/psionics.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'power-details-test',name:'Power details test'},attributes:Object.entries({class1:'Psion',level1:3,int:16,hp:14,hp_max:18,powerpoints_max:15,powerpoints:8,repeating_spells13_ROW_powername13:'Custom pulse',repeating_spells13_ROW_notes:'Player note',repeating_spells13_ROW_powerschool13:'Telepathy',repeating_spells13_ROW_powerdescriptor13:'Mind-affecting',repeating_spells13_ROW_powerdisplay13:'Auditory',repeating_spells13_ROW_powercastingtime13:'1 standard action',repeating_spells13_ROW_powerrange1:'30 ft.',repeating_spells13_ROW_powertea13:'One creature',repeating_spells13_ROW_powerduration13:'1 round',repeating_spells13_ROW_powerst13:'Will negates',repeating_spells13_ROW_powerpr13:'Yes',repeating_spells13_ROW_poweraugment13:'1',...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const legacy=async(extra={})=>{const c=await load(importRoll20(raw(extra)).character);delete c.roll20Import.powerDetailsMigration;c.psionics[0].powers[0].notes='Player note';return c;};

test('power details survive fresh import and appear in posted power cards without executing source macros',async()=>{
 const data=raw({repeating_spells13_ROW_powermacro13:'globalThis.unsafeImportWasRun=true'}),c=await load(importRoll20(data).character),p=c.psionics[0],k=p.powers[0];
 for(const text of ['Player note','Discipline: Telepathy','Descriptor: Mind-affecting','Display: Auditory','Manifesting time: 1 standard action','Range: 30 ft.','Target / area: One creature','Duration: 1 round','Saving throw: Will negates','Power resistance: Yes','Augmentable (source checkbox): Yes'])assert.ok(k.notes.includes(text),text);
 assert.equal(k.formula,'');assert.equal(globalThis.unsafeImportWasRun,undefined);assert.ok(!k.notes.includes('globalThis'));
 assert.ok(powerCard(c,p,k).details.includes('Range: 30 ft.'));assert.equal(p.spent,7);assert.deepEqual(c.roll20Import.raw,data);
 assert.equal(c.roll20Import.powerDetailsMigration,1);
});

test('generic powers, false checkboxes and the upstream all-level range alias map without guessed data',()=>{
 const data=raw({repeating_powers_GENERIC_name:'Generic power',repeating_powers_GENERIC_level:2,repeating_powers_GENERIC_range:'Touch',repeating_powers_GENERIC_duration:'Instantaneous',repeating_powers_GENERIC_augment:'0',repeating_spells23_SECOND_powername23:'Second-level pulse',repeating_spells23_SECOND_powerrange1:'60 ft.'});
 const powers=importRoll20(data).character.psionics[0].powers;
 assert.ok(powers.find(k=>k.name==='Generic power').notes.includes('Augmentable (source checkbox): No'));
 assert.ok(powers.find(k=>k.name==='Second-level pulse').notes.includes('Range: 60 ft.'));
 assert.ok(!powers.find(k=>k.name==='Second-level pulse').notes.includes('Saving throw:'));
 const noDetails=importRoll20({...data,attributes:data.attributes.filter(a=>!a.name.startsWith('repeating_')).concat([{name:'repeating_powers_ROW_name',current:'Plain power'},{name:'repeating_powers_ROW_level',current:1}])});
 assert.equal(noDetails.character.psionics[0].powers[0].notes,'');
});

test('existing saves recover notes without losing later levels, ability gains, augmentation, focus or spent points',async()=>{
 const c=await legacy();c.classLevels[0].level=5;c.scores.INT=18;recompute(c);c.hp-=3;c.notes='After level-up';
 const p=c.psionics[0];p.spent=12;p.focused=true;p.name='Personal discipline';p.powers[0].cost=5;p.powers[0].formula='{PP}d6';
 const before=saved(c),fixed=await load(c),after=saved(fixed);
 assert.ok(after.psionics[0].powers[0].notes.includes('Range: 30 ft.'));
 after.psionics[0].powers[0].notes=before.psionics[0].powers[0].notes;after.roll20Import=before.roll20Import;
 assert.deepEqual(after,before);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('edited or removed powers and ambiguous names/traditions are not overwritten or resurrected',async()=>{
 for(const edit of [c=>{c.psionics[0].powers[0].notes='Later notes';},c=>{c.psionics[0].powers=[];},c=>{c.psionics[0].powers[0].name='Renamed';},c=>{c.psionics[0].powers[0].level=2;},c=>{c.psionics[0].powers.push({...structuredClone(c.psionics[0].powers[0]),id:'duplicate'});},c=>{c.psionics.push({...structuredClone(c.psionics[0]),id:'duplicate'});},c=>{c.psionics=[];}]){
  const c=await legacy();edit(c);const before=saved(c.psionics);await repairRoll20PowerDetails(c);assert.deepEqual(saved(c.psionics),before);
  assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('edited, removed, ambiguous')));
 }
 const duplicate=await legacy({repeating_spells13_OTHER_powername13:'Custom pulse',repeating_spells13_OTHER_powerduration13:'2 rounds'});
 const before=saved(duplicate.psionics);await repairRoll20PowerDetails(duplicate);assert.deepEqual(saved(duplicate.psionics),before);
});

test('catalog powers retain their identity and user cost while recovering recorded source details',async()=>{
 const c=await legacy({repeating_spells13_ROW_powername13:'Mind Thrust'}),p=c.psionics[0];assert.ok(p.powers[0].powerId);
 const originalId=p.powers[0].powerId;p.powers[0].cost=3;await repairRoll20PowerDetails(c);
 assert.equal(c.psionics[0].powers[0].powerId,originalId);assert.equal(c.psionics[0].powers[0].cost,3);assert.ok(c.psionics[0].powers[0].notes.includes('Saving throw: Will negates'));
});

test('recovery is one-time across browser storage and native backups, including later intentional deletion',async()=>{
 const c=await load(await legacy());c.psionics[0].powers[0].notes='';
 const records=new Map(),api=createBrowserCharacterApi({scope:'power-details',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('invalid exports preserve current data without claiming a completed repair',async()=>{
 const c=await legacy();c.roll20Import.raw={invalid:true};const before=saved(c.psionics);
 await repairRoll20PowerDetails(c);assert.deepEqual(saved(c.psionics),before);assert.equal(c.roll20Import.powerDetailsMigration,undefined);
});

test('oversized details are bounded with full source preserved and an explicit warning',()=>{
 const data=raw({repeating_spells13_ROW_powertea13:'x'.repeat(15000)}),{character:c,report}=importRoll20(data);
 assert.equal(c.psionics[0].powers[0].notes.length,10000);assert.ok(report.warnings.some(s=>s.includes('complete text remains')));assert.deepEqual(c.roll20Import.raw,data);
});
