import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20,roll20SpellCatalog} from '../lib/roll20-import.ts';
import {repairRoll20SpellNames,matchRoll20AnnotatedSpell,roll20SpellNameNote} from '../lib/roll20-spell-names.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {makeSpellRoll} from '../lib/rules.ts';

const names=[
 'Detect Magic: Detects spells and magic items within 60 ft.',
 'Lullaby: Makes subject drowsy; -5 on Spot and Listen checks, -2 on Will saves against sleep.',
 'Message: Whispered conversation at distance.',
 'Prestidigitation: Performs minor tricks.',
];
const ids=['detect-magic','lullaby','message','prestidigitation'];
const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-24',character:{id:'annotated-spells-test',name:'Annotated spells test'},attributes:Object.entries({class1:'Bard',level1:2,cha:16,hp:12,hp_max:16,arcanecasterlevel:2,arcanespells0:3,arcanespells0_used:1,...Object.fromEntries(names.map((name,i)=>['repeating_spells02_ROW'+i+'_spellname02',name])),...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const blank=(name,id)=>({id,name,school:'',levels:{},levelText:'0',components:'',castingTime:'',range:'',target:'',duration:'',save:'',resistance:'',description:'',source:'Roll20 import'});
async function legacy(){
 const c=await load(importRoll20(raw()).character);
 delete c.roll20Import.spellNamesMigration;
 c.casters[0].spells.forEach((s,i)=>{s.spellId='roll20-original-'+i;s.custom=blank(names[i],s.spellId);s.notes='';delete s.roll20OriginalName;});
 return c;
}

test('verified name/summary imports link to full library spells and retain original text and expenditure',async()=>{
 const data=raw({repeating_spells02_ROW0_spellprep02:2,repeating_spells02_ROW0_spellused02:1,repeating_spells02_ROW0_notes:'Player note'}),c=await load(importRoll20(data).character),p=c.casters[0];
 assert.deepEqual(p.spells.map(s=>s.spellId),ids);
 for(const [i,s] of p.spells.entries()){
  assert.equal(s.custom,null);assert.equal(s.roll20OriginalName,names[i]);assert.ok(s.notes.includes(roll20SpellNameNote(names[i])));
  const spell=roll20SpellCatalog().find(x=>x.id===s.spellId);assert.ok(spell.description.length>100);assert.ok(spell.range);
  const roll=makeSpellRoll(c,p,s,spell);assert.equal(roll.fields.find(([label])=>label==='Summary')[1],spell.description.slice(0,1600));
 }
 assert.ok(p.spells[0].notes.startsWith('Player note'));assert.equal(p.spells[0].prepared,2);assert.equal(p.spells[0].spent,1);assert.equal(p.slots[0].used,1);
 assert.deepEqual(c.roll20Import.raw,data);assert.equal(c.roll20Import.spellNamesMigration,1);
});

test('only verified empty definitions at the matching list/level qualify, never arbitrary colon names or modified rules',()=>{
 for(const name of ['Detect Magic: homebrew variant',names[0].replace('60','120'),names[1].replace('-5','+5'),'Message: Whispered conversation at distance. Ignore the rules.']){
  const c=importRoll20(raw({repeating_spells02_ROW0_spellname02:name})).character;
  assert.equal(c.casters[0].spells[0].custom.name,name);
 }
 for(const extra of [{repeating_spells02_ROW0_spellrange02:'120 ft.'},{repeating_spells02_ROW0_description:'Custom effect'},{repeating_spells02_ROW0_spelllevel02:1},{class1:'Cleric',arcanecasterlevel:''}]){
  const c=importRoll20(raw(extra)).character;
  assert.ok(c.casters.flatMap(p=>p.spells).find(s=>s.custom?.name===names[0]));
 }
 const c=importRoll20(raw({repeating_spells02_ROW0_spellname02:'  Detect Magic:  Detects spells and magic items within 60 ft.  '})).character;
 assert.equal(c.casters[0].spells[0].spellId,'detect-magic');
 const s=roll20SpellCatalog().find(s=>s.id==='detect-magic'),custom=blank(names[0],'roll20-test');
 assert.equal(matchRoll20AnnotatedSpell(custom,'Bard',[s,s]),undefined);
 assert.equal(matchRoll20AnnotatedSpell(custom,'Sorcerer / Wizard',[s]),s);
});

test('existing saves gain descriptions without replacing advancement, notes, spell settings or spent resources',async()=>{
 const c=await legacy();c.classLevels[0].level=5;c.scores.CHA=18;c.automation.skillTraining.unassigned[c.skills[0].id]=5;recompute(c);c.hp-=3;c.notes='Later session';
 const p=c.casters[0];p.name='Personal spellbook';p.slots[0].used=2;
 p.spells.forEach((s,i)=>{s.notes='Later spell notes '+i;s.prepared=3;s.spent=2;s.slotLevel=1;s.formula='1d4';s.attack={mode:'none',bonus:0};});
 const before=saved(c),fixed=await load(c),after=saved(fixed);
 assert.deepEqual(fixed.casters[0].spells.map(s=>s.spellId),ids);
 for(const [i,s] of after.casters[0].spells.entries()){
  assert.equal(s.custom,null);assert.ok(s.notes.startsWith('Later spell notes '+i));
  s.spellId=before.casters[0].spells[i].spellId;s.custom=before.casters[0].spells[i].custom;s.notes=before.casters[0].spells[i].notes;delete s.roll20OriginalName;
 }
 after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
 assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('edited definitions, ambiguous identities and deleted spells are left untouched with review guidance',async()=>{
 for(const edit of [
  p=>{p.spells[0].custom.description='Later custom text';},
  p=>{p.spells[0].custom.range='120 ft.';},
  p=>{p.spells[0].custom.attack={mode:'ranged-touch'};},
  p=>{p.spells[0].custom.referenceOnly=false;},
  p=>{p.spells[0].custom.levels={Bard:0};},
  p=>{p.spells[0].custom.name='Renamed cantrip';},
  p=>{p.spells[0].spellId='different';},
  p=>{p.spells[0].level=1;},
  p=>{p.spells[0].notes='x'.repeat(2000);},
  p=>{p.spells.push({...structuredClone(p.spells[0]),id:'duplicate'});},
  p=>{p.spells.push({...structuredClone(p.spells[0]),id:'manual-library-copy',spellId:'detect-magic',custom:null});},
  p=>{p.spells.splice(0,1);},
 ]){
  const c=await legacy(),p=c.casters[0];edit(p);const kept=saved(p.spells.filter(s=>s.custom?.name===names[0]||s.spellId=== 'different'||s.custom?.name==='Renamed cantrip'||s.spellId==='detect-magic'));
  await repairRoll20SpellNames(c);
  assert.deepEqual(saved(c.casters[0].spells.filter(s=>s.custom?.name===names[0]||s.spellId==='different'||s.custom?.name==='Renamed cantrip'||s.spellId==='detect-magic')),kept);
  assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('edited, removed, duplicated or ambiguous')));
 }
 for(const edit of [c=>{c.casters=[];},c=>{c.casters.push({...structuredClone(c.casters[0]),id:'duplicate'});},c=>{c.casters[0].list='Wizard';}]){
  const c=await legacy();edit(c);const before=saved(c.casters);await repairRoll20SpellNames(c);assert.deepEqual(saved(c.casters),before);
 }
});

test('duplicate source rows do not cause guessed merges',async()=>{
 const c=await legacy();c.roll20Import.raw.attributes.push({name:'repeating_spells02_OTHER_spellname02',current:names[0]});
 const before=saved(c.casters[0].spells[0]);await repairRoll20SpellNames(c);assert.deepEqual(saved(c.casters[0].spells[0]),before);
});

test('migration survives browser/native round trips and does not restore later intentional deletion',async()=>{
 const c=await load(await legacy());c.casters[0].spells.splice(0,1);c.casters[0].spells[0].notes='';
 const records=new Map(),api=createBrowserCharacterApi({scope:'spell-names',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),saved(c));
});

test('invalid source leaves current spells intact without claiming repair',async()=>{
 const c=await legacy();c.roll20Import.raw={invalid:true};const before=saved(c.casters);
 await repairRoll20SpellNames(c);assert.deepEqual(saved(c.casters),before);assert.equal(c.roll20Import.spellNamesMigration,undefined);
});

test('name recovery never truncates notes or exceeds save limits',async()=>{
 const fresh=importRoll20(raw({repeating_spells02_ROW0_notes:'x'.repeat(1980)})).character;
 assert.ok(fresh.casters[0].spells[0].custom);assert.equal(fresh.casters[0].spells[0].notes.length,1980);
 const c=await legacy();
 // Relinking removes empty custom definitions, so it can legitimately shrink a
 // near-limit save. Keep this fixture oversized even after those are removed.
 c.roll20Import.report.unmapped.push(...Array(1960).fill('x'.repeat(500)));
 const before=saved(c.casters);
 await repairRoll20SpellNames(c);assert.deepEqual(saved(c.casters),before);assert.equal(c.roll20Import.spellNamesMigration,undefined);
 assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('save limits')));
});
