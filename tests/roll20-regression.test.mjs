import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importRoll20,parseRepeating} from '../lib/roll20-import.ts';
import {roll20Number} from '../lib/roll20-attributes.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {sheetTotals,skillBonus,weaponAttack,weaponDamage} from '../lib/rules.ts';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/roll20/multiclass.json',import.meta.url)));
const raw=(attributes=[],extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-09-19',character:{id:'source-id',name:'Import'},attributes,...extra});
const attrs=values=>Object.entries(values).map(([name,current])=>({name,current,max:''}));

test('official 3.5 field names import multiclass, current/max HP, ranks, totals, possessions, and preparations',()=>{
 const {character:c,report}=importRoll20(fixture);
 assert.equal(c.hp,0);assert.equal(c.maxHp,24);assert.equal(c.tempHp,5);assert.equal(c.experience,15000);
 assert.equal(c.ancestry.raceId,'illumian');assert.equal(c.ancestry.abilityAdjustments,false);assert.equal(c.ancestry.traitBonuses,false);
 assert.deepEqual(c.classLevels.map(e=>[e.classId,e.level]),[['wizard',3],['cleric',3]]);
 assert.equal(c.scores.INT,16);assert.equal(c.temps.INT,2);assert.equal(c.coins.gp,0);assert.equal(c.coins.sp,12);
 const totals=sheetTotals(c);assert.equal(totals.ac,17);assert.equal(totals.initiative,6);assert.equal(totals.grapple,1);assert.deepEqual(totals.saves,{fort:5,ref:4,will:8});
 const spot=c.skills.find(s=>s.name==='Spot');assert.equal(spot.ranks,4.5);assert.equal(skillBonus(c,spot),9);
 assert.equal(c.skills.find(s=>s.name==='Craft (alchemy)').ranks,3);
 assert.deepEqual(c.weapons.map(w=>w.name),['Dagger']);assert.equal(weaponAttack(c,c.weapons[0]),5);assert.equal(weaponDamage(c,c.weapons[0]),'1d4-1');
 assert.deepEqual(c.gear.map(g=>[g.name,g.qty,g.weight]),[['Rope',2,5]]);
 const wizard=c.casters.find(p=>p.name==='Wizard'),cleric=c.casters.find(p=>p.name==='Cleric');
 assert.equal(wizard.spells.length,2);assert.equal(cleric.spells.length,1);
 assert.equal(wizard.spells[0].spellId,'magic-missile');assert.equal(wizard.spells[0].prepared,2);assert.equal(wizard.spells[0].spent,1);assert.equal(wizard.spells[0].slotLevel,1);
 assert.equal(cleric.spells[0].spellId,'cure-light-wounds');assert.equal(wizard.spells[1].custom.school,'Abjuration');
 assert.equal(c.features.length,2);assert.ok(c.features.some(f=>f.name==='Combat Casting [General]'));
 assert.equal(report.mapped+report.unmapped.length,fixture.attributes.length);
 assert.ok(report.unmapped.includes('custom_formula'));assert.ok(!report.unmapped.includes('str'));assert.ok(!report.unmapped.includes('hitpoints'));
 assert.equal(c.automation.enabled,false);assert.deepEqual(activateAutomation(structuredClone(c)),c);assert.deepEqual(recompute(structuredClone(c)),c);
});

test('empty and custom-class imports never gain demo data or a fabricated Fighter class',()=>{
 const c=importRoll20(raw()).character;
 assert.deepEqual(c.classLevels,[]);assert.equal(c.classes,'');assert.deepEqual(c.weapons,[]);assert.deepEqual(c.features,[]);assert.deepEqual(c.gear,[]);
 assert.deepEqual(c.coins,{cp:0,sp:0,gp:0,pp:0});assert.equal(c.notes,'');assert.equal(c.background,'');assert.ok(c.skills.every(s=>s.ranks===0&&s.misc===0));
 const custom=importRoll20(raw(attrs({class1:'My Custom Class',level1:'4',name:'Not a weapon',hp:'-3',hp_max:'0'}))).character;
 assert.equal(custom.classLevels[0].classId,'');assert.equal(custom.classLevels[0].name,'My Custom Class');assert.equal(custom.hp,-3);assert.equal(custom.maxHp,0);assert.equal(custom.weapons.length,0);
});

test('official weapon selectors preserve handedness and modifiers without doubling complete damage formulas',()=>{
 const selections=['(@{str-mod} +floor(@{str-mod}/2))','(floor(@{str-mod}/2))','(@{str-mod} + @{int-mod})','@{wis-mod}','0','@{unknown}'];
 const values={str:16,int:14,wis:12};
 selections.forEach((selector,i)=>Object.assign(values,{['weapon'+(i+1)+'name']:'Weapon '+i,['weapon'+(i+1)+'damagestat']:selector,['weapon'+(i+1)+'dicenumber']:1,['weapon'+(i+1)+'dicetype']:6,['weapon'+(i+1)+'enh']:1}));
 Object.assign(values,{'repeating_weapons_FULL_name':'Complete formula','repeating_weapons_FULL_damage':'1d8+5','repeating_weapons_FULL_weapondamagestat':'@{str-mod}',weapon7name:'Invalid dice',weapon7dicenumber:1000,weapon7dicetype:6});
 const {character:c,report}=importRoll20(raw(attrs(values)));
 assert.deepEqual(c.weapons.map(w=>weaponDamage(c,w)),['1d6+5','1d6+2','1d6+6','1d6+2','1d6+1','1d6+1','0','1d8+5']);
 assert.equal(c.weapons[0].strength,'two');assert.equal(c.weapons[1].strength,'off');
 assert.ok(report.warnings.some(w=>w.includes('unrecognized damage ability')));assert.ok(report.warnings.some(w=>w.includes('fixed adjustment')));
 const weak=importRoll20(raw(attrs({...values,str:4}))).character;
 assert.equal(weaponDamage(weak,weak.weapons[0]),'1d6-4');assert.equal(weaponDamage(weak,weak.weapons[1]),'1d6-1');
});

test('raw values and future metadata survive schema, native export, browser save/load, and repeated imports',async()=>{
 const source=structuredClone(fixture),before=structuredClone(source),c=importRoll20(source).character;
 assert.deepEqual(source,before);source.extension.value.push('mutated');assert.deepEqual(c.roll20Import.raw,before);
 const parsed=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:characterSchema.parse(c)}));
 assert.deepEqual(parsed.roll20Import.raw,before);
 const values=new Map(),api=createBrowserCharacterApi({scope:'import-test',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const first=await api('/api/characters',{method:'POST',body:JSON.stringify({data:parsed})});
 const second=await api('/api/characters',{method:'POST',body:JSON.stringify({data:importRoll20(before).character})});
 assert.notEqual(first.id,second.id);assert.equal((await api('/api/characters')).characters.length,2);
 assert.deepEqual((await api('/api/characters/'+first.id)).data.roll20Import.raw,before);
});

test('repeating parsing preserves duplicate fields, RowIDs containing underscores, order, and prototype-like keys',()=>{
 const source=attrs({'_reporder_repeating_custom_section':'ROW_B,ROW_A','repeating_custom_section_ROW_A_name':'A','repeating_custom_section_ROW_B_name':'B','repeating_weapon_-abcdefghijklmnopq_r_name':'Dagger','_reporder_repeating___proto__':'row','repeating___proto___row_constructor':'safe'});
 source.push({name:'repeating_custom_section_ROW_A_name',current:'duplicate',max:0});
 const grouped=parseRepeating(source);
 assert.deepEqual(Object.keys(grouped.custom_section.rows),['ROW_B','ROW_A']);assert.equal(grouped.custom_section.rows.ROW_A.fields.name.length,2);
 assert.equal(grouped.weapon.rows['-abcdefghijklmnopq_r'].fields.name[0].current,'Dagger');
 assert.equal(grouped.__proto__.rows.row.fields.constructor[0].current,'safe');assert.equal({}.row,undefined);
});

test('conflicting duplicate attributes and formulas are reported instead of coerced to zero or executed',()=>{
 for(const value of ['', ' ',false,null,'1,2','@{str}','[[1d20]]','3+4','Infinity'])assert.equal(roll20Number(value),undefined,String(value));
 assert.equal(roll20Number('0'),0);assert.equal(roll20Number('1,000'),1000);assert.equal(roll20Number('-2.5'),-2.5);
 const source=raw([...attrs({str:'18',dex:'@{other}',class:'Wizard 1'}),{name:'str',current:'8',max:''}]);
 const {character:c,report}=importRoll20(source);assert.equal(c.scores.STR,10);assert.equal(c.scores.DEX,10);
 assert.ok(report.warnings.some(w=>w.includes('Conflicting attributes named str')));assert.equal(report.unmapped.filter(n=>n==='str').length,2);assert.deepEqual(c.roll20Import.raw,source);
 const resolved=importRoll20(raw(attrs({str:'@{other}'}),{resolvedCoreValues:{str:14}}));assert.equal(resolved.character.scores.STR,14);assert.ok(resolved.report.unmapped.includes('str'));
});

test('psionic powers and remaining points map to a single manual reserve',()=>{
 const source=raw(attrs({class1:'Psion',level1:'3',int:'16',powerpoints:'4',powerpoints_max:'14',manifesterlevel:'3','repeating_spells13_P1_powername13':'Mind Thrust'}));
 const c=importRoll20(source).character,p=c.psionics[0];assert.equal(p.max,14);assert.equal(p.spent,10);assert.equal(p.level,3);assert.equal(p.powers[0].name,'Mind Thrust');assert.equal(p.powers[0].cost,1);assert.ok(p.powers[0].powerId);
});

test('ambiguous arcane traditions, domain spells, boolean preparations, and distinct unknown names remain separate',()=>{
 const source=raw(attrs({classes:'Wizard 3 / Sorcerer 3 / Cleric 3',int:16,cha:16,wis:16,arcanecasterlevel:3,
  'repeating_spells12_A_spellname12':'Magic Missile','repeating_spells12_A_spellprep12':'1',
  'repeating_spells11_B_spellname11':'Bless','repeating_spells11_B_domain11':'1','repeating_spells11_B_spellprep11':'1',
  'repeating_spell_C_name':'???','repeating_spell_C_level':1,'repeating_spell_C_prepared':true,
  'repeating_spell_D_name':'!!!','repeating_spell_D_level':1,'repeating_spell_D_prepared':false}));
 const {character:c,report}=importRoll20(source);
 assert.equal(c.casters.find(p=>p.name==='Wizard').spells.length,0);assert.equal(c.casters.find(p=>p.name==='Sorcerer').spells.length,0);
 assert.ok(c.casters.find(p=>p.name==='Imported arcane casting').spells.some(s=>s.spellId==='magic-missile'));
 const domain=c.casters.find(p=>p.casting?.domain);assert.equal(domain.spells[0].spellId,'bless');
 const customs=c.casters.flatMap(p=>p.spells).filter(s=>s.custom);assert.equal(new Set(customs.map(s=>s.spellId)).size,2);assert.deepEqual(customs.map(s=>s.prepared),[1,0]);
 assert.ok(report.warnings.some(w=>w.includes('Could not uniquely match arcane')));
});

test('malformed input, invalid numeric bounds, missing current, and oversized imports leave the source untouched',()=>{
 for(const source of [raw([{name:'missing'}]),raw(attrs({class1:'Wizard',level1:1,hp_max:-1})),raw(attrs({str:999999})),raw([],{version:2}),raw([],{padding:'a'.repeat(1000001)})]){
  const before=structuredClone(source);assert.throws(()=>importRoll20(source));assert.deepEqual(source,before);
 }
});
