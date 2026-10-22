import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {canCast,spendSpell} from '../lib/rules.ts';
import {reviewRoll20SpellPreparation} from '../lib/roll20-spell-preparation.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const raw=(value,kind='Cleric',extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-22',character:{id:'preparation-test',name:'Preparation test'},attributes:Object.entries({class1:kind,level1:3,wis:16,int:16,[`repeating_spells1${kind==='Cleric'?1:2}_ROW_spellname1${kind==='Cleric'?1:2}`]:kind==='Cleric'?'Bless':'Shield',[`repeating_spells1${kind==='Cleric'?1:2}_ROW_spellprep1${kind==='Cleric'?1:2}`]:value,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));

test('numbered divine and arcane preparation fields accept checkbox values as one prepared copy',async()=>{
 for(const kind of ['Cleric','Wizard'])for(const value of [true,'true','on','yes','x',1,'1']){
  const data=raw(value,kind),c=await prepareCharacter(importRoll20(data).character),p=c.casters[0],s=p.spells[0];
  assert.equal(s.prepared,1,kind+': '+value);assert.equal(canCast(p,s,c),true);
  const cast=spendSpell(p,s,c);assert.equal(cast.spells[0].spent,1);assert.equal(canCast(cast,cast.spells[0],c),false);assert.deepEqual(c.roll20Import.raw,data);
 }
});

test('unchecked, explicit zero, unresolved formulas and numeric counts retain their meaning',()=>{
 for(const [value,expected] of [[false,0],['off',0],['false',0],[0,0],['0',0],['@{prepared}',0],[3,3],['2',2]]){
  const c=importRoll20(raw(value)).character;assert.equal(c.casters[0].spells[0].prepared,expected);
 }
 const used=importRoll20(raw(true,'Cleric',{repeating_spells11_ROW_spellused11:1})).character;
 assert.equal(used.casters[0].spells[0].spent,1);assert.equal(canCast(used.casters[0],used.casters[0].spells[0],used),false);
});

test('used checkboxes cannot become free casts, including spontaneous slot bookkeeping',()=>{
 for(const value of [true,'true','on','yes','x',1,'1']){
  const c=importRoll20(raw(true,'Cleric',{repeating_spells11_ROW_spellused11:value})).character,p=c.casters[0],s=p.spells[0];
  assert.equal(s.spent,1);assert.equal(canCast(p,s,c),false);
 }
 const data=raw(true,'Cleric',{repeating_spells11_ROW_spellused11:true});data.attributes.find(a=>a.name==='class1').current='Favored Soul';data.attributes.push({name:'cha',current:16});
 const p=importRoll20(data).character.casters[0];assert.equal(p.mode,'spontaneous');assert.equal(p.slots[1].used,1);assert.equal(p.spells[0].spent,1);
 for(const value of [false,'off',0,'0','@{used}'])assert.equal(importRoll20(raw(true,'Cleric',{repeating_spells11_ROW_spellused11:value})).character.casters[0].spells[0].spent,0);
 const c=importRoll20(raw(2,'Cleric',{repeating_spells11_ROW_spellused11:true})).character;delete c.roll20Import.spellPreparationReview;c.casters[0].spells[0].spent=0;
 reviewRoll20SpellPreparation(c);assert.equal(c.casters[0].spells[0].spent,0);assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('checkbox-style')));
});

test('legacy divine rows and unnumbered generic rows accept the same checkbox encodings',()=>{
 const legacy=raw('on');legacy.attributes=legacy.attributes.map(a=>({...a,name:a.name.replace('repeating_spells11_','repeating_spells_')}));
 assert.equal(importRoll20(legacy).character.casters[0].spells[0].prepared,1);
 const generic=raw('on');generic.attributes=generic.attributes.map(a=>({...a,name:a.name.replace('repeating_spells11_','repeating_spell_').replace('spellname11','name').replace('spellprep11','spellprep')}));generic.attributes.push({name:'repeating_spell_ROW_level',current:1});
 assert.equal(importRoll20(generic).character.casters[0].spells[0].prepared,1);
});

test('old saves are warned once but later levels, prepared/spent resources and player edits are never replayed from raw export',async()=>{
 for(const prepared of [0,2]){
  const c=await prepareCharacter(importRoll20(raw(true)).character);delete c.roll20Import.spellPreparationReview;
  c.classLevels[0].level=5;c.scores.WIS=18;recompute(c);c.hp-=3;c.notes='Later choices';
  const p=c.casters[0];p.spells[0].prepared=prepared;p.spells[0].spent=prepared;p.slots[1].used=1;
  const before=saved(c);reviewRoll20SpellPreparation(c);assert.equal(c.roll20Import.spellPreparationReview,1);
  assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('checkbox-style')));
  const after=saved(c);after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
  const fixed=saved(c);reviewRoll20SpellPreparation(c);assert.deepEqual(saved(c),fixed);
  const records=new Map(),api=createBrowserCharacterApi({scope:'spell-preparation',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
  const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
  const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
  assert.deepEqual(saved(await prepareCharacter(characterSchema.parse(backup))),fixed);
 }
});

test('ordinary numeric and generic boolean imports do not acquire spurious review warnings',()=>{
 for(const data of [raw(2),raw(false),raw(true,'Cleric',{repeating_spells11_ROW_prepared:3}),raw(true,'Cleric',{repeating_spells11_ROW_prepared:true})]){
  const c=importRoll20(data).character;delete c.roll20Import.spellPreparationReview;reviewRoll20SpellPreparation(c);
  assert.equal(c.roll20Import.report.warnings.some(s=>s.includes('checkbox-style')),false);
 }
});

test('conflicting source checkbox values remain unresolved and invalid sources never claim a completed review',()=>{
 const data=raw(true);data.attributes.push({name:'repeating_spells11_ROW_spellprep11',current:false});
 const c=importRoll20(data).character;assert.equal(c.casters[0].spells[0].prepared,0);assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('Conflicting attributes')));
 delete c.roll20Import.spellPreparationReview;c.roll20Import.raw={invalid:true};const before=saved(c.casters);reviewRoll20SpellPreparation(c);
 assert.equal(c.roll20Import.spellPreparationReview,undefined);assert.deepEqual(saved(c.casters),before);
});
