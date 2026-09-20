import test from 'node:test';
import assert from 'node:assert/strict';
import {parseRepeating,importRoll20} from '../lib/roll20-import.ts';
import {characterSchema} from '../lib/model.ts';
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
