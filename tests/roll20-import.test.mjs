import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepeating,importRoll20} from '../lib/roll20-import.ts';
import {characterSchema} from '../lib/model.ts';
import {activateAutomation,migrateRoll20Automation} from '../lib/automation.ts';
const attrs=[{id:'a1',name:'character_name',current:'Illumian',max:''},{id:'a2',name:'strength',current:'8',max:'8'},{id:'a3',name:'repeating_weapon_ROW99_name',current:'Dagger',max:''},{id:'a4',name:'repeating_weapon_ROW99_damage',current:'1d4',max:'1d4'},{id:'a5',name:'repeating_mystery_ROW7_custom',current:'false',max:'0'},{id:'a6',name:'custom_homebrew',current:'0',max:'0'}];
const raw={format:'roll20-dnd35-export',version:1,exportedAt:new Date().toISOString(),character:{id:'-C1',name:'Illumian'},attributes:attrs,resolvedCoreValues:{class:'Wizard 3',race:'Illumian'}};
test('repeating parser groups by section and RowID without losing names or values',()=>{const p=parseRepeating(attrs);assert.equal(p.weapon.rows.ROW99.fields.name[0].originalName,'repeating_weapon_ROW99_name');assert.equal(p.mystery.rows.ROW7.fields.custom[0].current,'false');assert.equal(p.weapon.rows.ROW99.fields.damage[0].max,'1d4')});
test('import preserves raw custom data and creates a usable character',()=>{const r=importRoll20(raw);assert.equal(r.character.name,'Illumian');assert.equal(r.character.scores.STR,8);assert.equal(r.character.weapons[0].name,'Dagger');assert.deepEqual(r.character.roll20Import.raw,raw);assert.ok(r.report.unmapped.includes('custom_homebrew'))});
test('malformed and unsupported exports are rejected',()=>{assert.throws(()=>importRoll20({}),/required/i);assert.throws(()=>importRoll20({...raw,version:2}),/Unsupported Roll20 export version/)});
test('Roll20 free-text DR is preserved alongside an empty structured tracker',()=>{
  const text='5/silver and good; armor stacks per DM';
  const input={...raw,attributes:[...attrs,{id:'dr',name:'damagereduction',current:text,max:''}]};
  const {character}=importRoll20(input);
  assert.equal(character.defense.dr,text);
  assert.deepEqual(character.defense.drSources,[]);
  assert.deepEqual(character.roll20Import.raw,input);
  assert.equal(characterSchema.parse(JSON.parse(JSON.stringify(character))).defense.dr,text);
});
test('legacy top-level armor summary becomes visible equipment without rewriting custom AC fields',()=>{
 const input={...raw,attributes:[...attrs,
  {id:'armor',name:'acitem',current:'Studded Leather',max:''},
  {id:'armorbonus',name:'acitembonus',current:'2',max:''},
  {id:'armordex',name:'acitemdex',current:'20',max:''},
  {id:'armorcheck',name:'acitemcheckpenalty',current:'1',max:''},
  {id:'armorfailure',name:'acitemspellfailure',current:'15',max:''},
  {id:'armorweight',name:'acitemweight',current:'20',max:''},
 ]};
 const {character:c,report}=importRoll20(input);
 const armor=c.gear.find(g=>g.name.toLowerCase()==='studded leather');
 assert.ok(armor);assert.equal(armor.equipped,true);assert.equal(armor.carried,true);assert.equal(armor.catalogId,undefined);assert.equal(armor.importedManual,true);
 assert.equal(armor.armorStats.armor,2);assert.equal(armor.armorStats.dexCap,20);assert.ok(report.warnings.some(w=>w.includes('uses custom armor values')));
 assert.equal(c.defense.armor,2);assert.equal(c.defense.dexCap,20);assert.equal(c.defense.checkPenalty,-1);assert.equal(c.defense.spellFailure,15);
 const loaded=activateAutomation(migrateRoll20Automation(characterSchema.parse(JSON.parse(JSON.stringify(c)))));
 assert.equal(loaded.gear.find(g=>g.name.toLowerCase()==='studded leather').equipped,true);assert.equal(loaded.defense.armor,2);assert.equal(loaded.defense.dexCap,20);assert.equal(loaded.defense.checkPenalty,-1);assert.equal(loaded.defense.spellFailure,15);
});
test('standard top-level armor summary links to the equipment catalog',()=>{
 const input={...raw,attributes:[...attrs,
  {id:'armor',name:'acitem',current:'Leather',max:''},
  {id:'armorbonus',name:'acitembonus',current:'2',max:''},
  {id:'armordex',name:'acitemdex',current:'6',max:''},
  {id:'armorcheck',name:'acitemcheckpenalty',current:'0',max:''},
  {id:'armorfailure',name:'acitemspellfailure',current:'10',max:''},
 ]};
 const {character:c}=importRoll20(input);const armor=c.gear.find(g=>g.name==='Leather');
 assert.equal(armor.catalogId,'armor-leather');assert.equal(armor.equipped,true);
 assert.equal(activateAutomation(migrateRoll20Automation(characterSchema.parse(JSON.parse(JSON.stringify(c))))).defense.armor,2);
});
test('known ranged weapons use catalog range data when Roll20 omits their range field',()=>{
 const input={...raw,attributes:[...attrs,
  {id:'weapon',name:'weapon1name',current:'Hand Crossbow',max:''},
  {id:'weaponstat',name:'weapon1stat',current:'@{dex-mod}',max:''},
  {id:'weapondamage',name:'weapon1statdamage',current:'d4',max:''},
 ]};
 const weapon=importRoll20(input).character.weapons[0];
 assert.equal(weapon.range,'30 ft.');assert.equal(weapon.attackMode,'ranged');
});
