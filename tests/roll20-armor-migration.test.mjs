import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {characterSchema} from '../lib/model.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {addEquipment,matchEquipment,gearEquipment} from '../lib/equipment.ts';
import {sheetTotals} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

// The problematic armor fields from Buzzer's export, without private character metadata.
const source={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-18',character:{id:'armor-regression',name:'Armor regression'},attributes:Object.entries({class1:'Rogue',level1:2,str:12,dex:18,con:14,int:12,wis:10,cha:10,hp:16,hp_max:16,acitem:'Studded Leather',acitemtype:'Light',acitembonus:2,acitemdex:20,acitemcheckpenalty:1,acitemspellfailure:15,acitemweight:20,acitemproperties:'DR 1/-',hideranks:5}).map(([name,current])=>({name,current,max:''}))};
const load=c=>activateAutomation(migrateRoll20Automation(characterSchema.parse(JSON.parse(JSON.stringify(c)))));
function legacy(automatic=true){
 const c=importRoll20(source).character;
 c.gear=[];delete c.roll20Import.equipmentMigration;
 if(automatic){c.automation.version=0;activateAutomation(c);}
 return c;
}
const armor=c=>c.gear.find(g=>gearEquipment(g)?.kind==='armor');

test('saved automated imports recover armor and keep subsequent advancement, HP, skills and notes',()=>{
 const c=legacy();c.classLevels[0].level=3;recompute(c);
 c.automation.history[2].skillRanks['skill-15']=1;recompute(c);
 c.hp-=4;c.coins.gp=63;c.notes='Notes from last session';c.alternateFeatures.uses['player-counter']=2;
 const before=structuredClone(c),totals=sheetTotals(c),fixed=load(c);
 assert.equal(armor(fixed).name,'Studded Leather');assert.equal(armor(fixed).equipped,true);
 assert.equal(armor(fixed).armorStats.armor,2);assert.match(armor(fixed).notes,/DR 1\/-/);
 for(const key of ['classLevels','hp','maxHp','skills','notes','coins','alternateFeatures','weapons','casters','features'])assert.deepEqual(fixed[key],before[key],key);
 assert.deepEqual(fixed.automation.history,before.automation.history);
 assert.deepEqual(fixed.defense,before.defense);
 assert.equal(sheetTotals(fixed).ac,totals.ac);assert.equal(fixed.speed,before.speed);
 assert.deepEqual(fixed.roll20Import.raw,before.roll20Import.raw);
 armor(fixed).equipped=false;recompute(fixed);
 assert.equal(fixed.defense.armor,0);assert.equal(sheetTotals(fixed).ac,totals.ac-2);
 assert.equal(fixed.defense.spellFailure,0);
});

test('repair runs once across browser save/load; later removals stay removed',async()=>{
 const values=new Map(),api=createBrowserCharacterApi({scope:'/test/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:(_name,operation)=>operation(),id:()=> 'saved-armor',now:()=> '2026-10-18T00:00:00Z'});
 const row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:legacy()})});
 const saved=await api('/api/characters/'+row.id),fixed=load(saved.data);
 assert.equal(fixed.gear.length,1);assert.deepEqual(load(fixed),JSON.parse(JSON.stringify(fixed)));
 fixed.gear=[];recompute(fixed);
 await api('/api/characters/'+row.id,{method:'PUT',body:JSON.stringify({data:fixed,revision:saved.revision})});
 const reopened=load((await api('/api/characters/'+row.id)).data);
 assert.equal(reopened.gear.length,0);assert.equal(reopened.defense.armor,0);
});

test('manual saves and new imports get functioning custom armor without a permanent armor offset',()=>{
 for(const c of [legacy(false),importRoll20(source).character]){
  const fixed=load(c);assert.equal(fixed.defense.armor,2);assert.equal(fixed.automation.adjustments['defense.armor']||0,0);
  armor(fixed).carried=false;recompute(fixed);assert.equal(fixed.defense.armor,0);
 }
});

test('previous importer manual gear entries are connected without duplicating or resetting edited flags',()=>{
 const c=legacy();
 c.gear.push({id:'old-armor',name:'Studded leather',qty:1,weight:20,carried:true,equipped:true,notes:'Imported Roll20 armor summary',importedManual:true});
 const fixed=load(c);assert.equal(fixed.gear.length,1);assert.equal(armor(fixed).id,'old-armor');assert.equal(fixed.defense.armor,2);
 armor(fixed).qty=0;recompute(fixed);assert.equal(fixed.defense.armor,0);
 const unequipped=legacy();unequipped.gear.push({...c.gear[0],equipped:false,notes:'Kept in my chest'});
 assert.equal(armor(load(unequipped)).equipped,false);
});

test('repair respects existing replacement gear, overrides and absent armor',()=>{
 const replacement=legacy();addEquipment(replacement,matchEquipment('Chain shirt'));recompute(replacement);
 const fixed=load(replacement);assert.equal(fixed.gear.length,1);assert.equal(armor(fixed).name,'Chain shirt');assert.deepEqual(fixed.defense,replacement.defense);
 const edited=legacy();edited.automation.overrides['defense.armor']=7;recompute(edited);
 assert.equal(load(edited).defense.armor,7);
 const removed=legacy();removed.defense.armor=0;delete removed.automation.adjustments['defense.armor'];assert.equal(load(removed).gear.length,0);
 const disabled=legacy();disabled.roll20Import.raw.attributes.push({name:'armorworn',current:'0',max:''});assert.equal(load(disabled).gear.length,0);
 const invalid=legacy();invalid.roll20Import.raw={};assert.equal(load(invalid).gear.length,0);
});

test('changing equipment replaces restored custom armor and keeps save data valid',()=>{
 const c=load(legacy());addEquipment(c,matchEquipment('Leather'));recompute(c);
 assert.equal(c.gear.find(g=>g.armorStats).equipped,false);
 assert.equal(c.defense.armor,2);assert.equal(characterSchema.safeParse(c).success,true);
});

test('restoring weight across an encumbrance boundary preserves current combat totals',()=>{
 const c=legacy();c.gear.push({id:'pack',name:'Loaded pack',qty:1,weight:35,carried:true,equipped:false,notes:''});recompute(c);
 const before=structuredClone(c),fixed=load(c);
 assert.deepEqual(fixed.defense,before.defense);assert.equal(fixed.speed,before.speed);assert.equal(sheetTotals(fixed).ac,sheetTotals(before).ac);
});

test('shields restore with armor and removing each removes only its own bonus',()=>{
 const raw=structuredClone(source);raw.attributes.push(...Object.entries({shieldname:'Buckler',shieldbonus:1,shieldcheckpenalty:1,shieldspellfailure:5,shieldweight:5}).map(([name,current])=>({name,current,max:''})));
 const c=importRoll20(raw).character;c.gear=[];delete c.roll20Import.equipmentMigration;c.automation.version=0;activateAutomation(c);
 const fixed=load(c);assert.equal(fixed.gear.length,2);assert.equal(fixed.defense.armor,2);assert.equal(fixed.defense.shield,1);
 fixed.gear.find(g=>gearEquipment(g)?.kind==='shield').equipped=false;recompute(fixed);
 assert.equal(fixed.defense.shield,0);assert.equal(fixed.defense.armor,2);
});
