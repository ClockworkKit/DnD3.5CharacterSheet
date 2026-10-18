import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';

const raw=values=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-18',character:{id:'spell-failure-test',name:'Armor test'},attributes:Object.entries(values).map(([name,current])=>({name,current,max:''}))});
// Buzzer's relevant armor fields, without identifying metadata.
const values={class1:'Rogue',level1:2,str:10,dex:20,con:14,int:12,wis:10,cha:18,hp:16,hp_max:16,acitem:'Studded Leather',acitemtype:'Light',acitembonus:2,acitemdex:20,acitemcheckpenalty:1,acitemspellfailure:15,acitemweight:20,arcanespellfailure:15};
const load=c=>activateAutomation(migrateRoll20Automation(characterSchema.parse(JSON.parse(JSON.stringify(c)))));
const saved=c=>JSON.parse(JSON.stringify(c));
function oldSave({automatic=true,missingGear=false}={}){
 const c=importRoll20(raw(values)).character;
 delete c.roll20Import.spellFailureMigration;c.defense.spellFailure=30;
 if(missingGear){c.gear=[];delete c.roll20Import.equipmentMigration;}
 if(automatic){c.automation.version=0;activateAutomation(c);}
 return c;
}

test('spell failure total wins over components, including explicit zero and alias precedence',()=>{
 for(const [fields,total] of [[{arcanespellfailure:15},15],[{arcanespellfailure:0},0],[{arcane_spell_failure:10,arcanespellfailure:15},10],[{arcanespellfailure:'@{total}'},20],[{arcanespellfailure:''},20]]){
  const source=raw({acitemspellfailure:15,shieldspellfailure:5,...fields}),before=structuredClone(source),c=importRoll20(source).character;
  assert.equal(c.defense.spellFailure,total);assert.deepEqual(source,before);assert.deepEqual(c.roll20Import.raw,before);
 }
 const resolved=raw({arcanespellfailure:'@{total}',acitemspellfailure:15});resolved.resolvedCoreValues={arcanespellfailure:12};
 assert.equal(importRoll20(resolved).character.defense.spellFailure,12);
});

test('fallback sums only worn component penalties, without inventing a missing total',()=>{
 for(const [fields,total] of [[{},20],[{armorworn:0},5],[{shieldworn:0},15],[{armorworn:0,shieldworn:0},0]])assert.equal(importRoll20(raw({acitemspellfailure:15,shieldspellfailure:5,...fields})).character.defense.spellFailure,total);
});

test('new Buzzer-style imports remain 15 percent through automatic adoption and reload',()=>{
 const c=importRoll20(raw(values)).character;assert.equal(c.defense.spellFailure,15);
 const first=load(c);assert.equal(first.defense.spellFailure,15);assert.equal(first.automation.adjustments['defense.spellFailure']||0,0);
 assert.deepEqual(load(first),first);
 first.gear[0].equipped=false;recompute(first);assert.equal(first.defense.spellFailure,0);
});

test('old manual and automated imports repair once, including saves with missing armor',()=>{
 for(const automatic of [false,true])for(const missingGear of [false,true]){
  const c=oldSave({automatic,missingGear}),before=structuredClone(c),fixed=load(c);
  assert.equal(fixed.defense.spellFailure,15,JSON.stringify({automatic,missingGear}));
  assert.equal(fixed.automation.adjustments['defense.spellFailure']||0,0);
  assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);
  assert.deepEqual(saved(load(fixed)),saved(fixed));
  fixed.gear[0].equipped=false;recompute(fixed);assert.equal(fixed.defense.spellFailure,0);
 }
});

test('repair retains advancement, skills, HP, notes, feats, equipment replacements and other overrides',()=>{
 const c=oldSave();c.classLevels[0].level=3;recompute(c);c.automation.history[2].skillRanks['skill-15']=1;recompute(c);
 c.hp-=3;c.notes='Levelled up last session';c.coins.gp=80;c.automation.overrides['defense.armor']=6;
 addEquipment(c,matchEquipment('Chain shirt'));recompute(c);
 const before=structuredClone(c),fixed=load(c);
 assert.equal(before.defense.spellFailure,35);assert.equal(fixed.defense.spellFailure,20);
 for(const key of ['classLevels','skills','hp','maxHp','notes','coins','features','gear','weapons','casters'])assert.deepEqual(saved(fixed[key]),saved(before[key]),key);
 assert.deepEqual(fixed.automation.history,before.automation.history);assert.deepEqual(fixed.automation.overrides,before.automation.overrides);
});

test('user-modified totals, offsets and explicit overrides are not silently replaced',()=>{
 const overridden=oldSave();overridden.automation.overrides['defense.spellFailure']=8;recompute(overridden);
 assert.equal(load(overridden).defense.spellFailure,8);
 const adjusted=oldSave();adjusted.automation.adjustments['defense.spellFailure']=3;recompute(adjusted);
 const fixed=load(adjusted);assert.equal(fixed.defense.spellFailure,18);assert.ok(fixed.roll20Import.report.warnings.some(w=>w.includes('Current values or overrides differ')));
 const manual=oldSave({automatic:false});manual.defense.spellFailure=7;assert.equal(load(manual).defense.spellFailure,7);
});
