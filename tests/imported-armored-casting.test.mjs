import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {specialSpellFailure,specialSpellFailureWarnings} from '../lib/class-systems.ts';
import {recompute,activateAutomation} from '../lib/automation.ts';
import {equipmentCatalog,addEquipment,matchEquipment,gearEquipment,shieldType,equippedArmor,armorProficient} from '../lib/equipment.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';

const make=(kind='Wizard',level=3,right)=>createPlayerCharacter({name:'Imported armored casting QA',kind,level,raceId:'human',scores:{STR:16,DEX:14,CON:14,INT:18,WIS:14,CHA:16},method:'manual',hpMethod:'average',...(right?{advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left:kind.toLowerCase().replaceAll(' ','-'),right}))}:{})});
const armor=(category='light',spellFailure=20)=>({id:'custom-armor',name:'Imported armor',qty:1,weight:10,carried:true,equipped:true,notes:'Keep the custom armor record',armorStats:{kind:'armor',category,armor:4,dexCap:5,checkPenalty:-2,spellFailure}});
const shield=(name='Heavy steel shield',spellFailure=15)=>({id:'custom-shield',name,qty:1,weight:5,carried:true,equipped:true,notes:'Keep the custom shield record',armorStats:{kind:'shield',category:'shields',armor:2,dexCap:100,checkPenalty:-2,spellFailure}});

test('custom armor spell failure uses saved stats, including when a catalog reference is also present',()=>{
 const c=make();c.gear=[armor('light',17)];const before=structuredClone(c);assert.equal(specialSpellFailure(c,'wizard'),17);assert.deepEqual(c,before);
 c.gear[0].catalogId=matchEquipment('Full plate').id;assert.equal(specialSpellFailure(c,'wizard'),17,'saved custom values take precedence over the catalog');
 c.gear[0].armorStats.spellFailure=0;assert.equal(specialSpellFailure(c,'wizard'),0);delete c.gear[0].armorStats;assert.equal(specialSpellFailure(c,'wizard'),35,'removing custom stats restores the catalog values');
});

test('custom armor and shields add once and honor carried, worn and quantity state',()=>{
 const c=make();c.gear=[armor('medium',25),shield()];assert.equal(specialSpellFailure(c,'wizard'),40);
 for(const patch of [{carried:false},{equipped:false},{qty:0}]){c.gear=[armor('medium',25),{...shield(),...patch}];assert.equal(specialSpellFailure(c,'wizard'),25);}
 c.gear=[{...armor(),equipped:false},shield()];assert.equal(specialSpellFailure(c,'wizard'),15);
 c.gear=[armor('heavy',90),shield('Tower shield',50)];assert.equal(specialSpellFailure(c,'wizard'),100);
});

test('bard and wizard traditions retain independent armor exemptions in standard multiclass and gestalt sheets',()=>{
 for(const paired of [false,true]){
  const c=make('Bard',3,paired?'wizard':undefined);if(!paired){c.classLevels.push(...make('Wizard').classLevels);recompute(c);}
  c.gear=[armor(),shield()];assert.equal(specialSpellFailure(c,'bard'),15);assert.equal(specialSpellFailure(c,'wizard'),35);
  c.gear[0].armorStats.category='medium';assert.equal(specialSpellFailure(c,'bard'),35);assert.equal(specialSpellFailure(c,'wizard'),35);
 }
});

test('duskblade armor and shield milestones use its own class level and never waive wizard failure',()=>{
 for(const [level,armorFailure,shieldFailure] of [[3,25,15],[4,0,15],[6,0,15],[7,0,0]]){
  const c=make('Duskblade',level,'wizard');c.gear=[armor('medium',25),shield()];assert.equal(specialSpellFailure(c,'duskblade'),armorFailure+shieldFailure);assert.equal(specialSpellFailure(c,'wizard'),40);
 }
 const c=make('Duskblade',7,'wizard');c.gear=[shield('Tower Shield',50)];assert.equal(specialSpellFailure(c,'duskblade'),50,'capitalized imported tower shields remain restricted');
});

test('warmage medium armor unlocks at warmage eight while heavy shields still cause failure',()=>{
 for(const level of [7,8]){
  const c=make('Warmage',level,'wizard');c.gear=[armor('medium',25),shield('Light steel shield',5)];assert.equal(specialSpellFailure(c,'warmage'),level===8?0:25);assert.equal(specialSpellFailure(c,'wizard'),30);
  c.gear[1]=shield();assert.equal(specialSpellFailure(c,'warmage'),level===8?15:40);
 }
});

test('mithral custom armor uses its effective category and material failure reduction once',()=>{
 const c=make('Bard',3,'wizard');c.gear=[{...armor('medium',25),material:'mithral'}];assert.equal(specialSpellFailure(c,'bard'),0);assert.equal(specialSpellFailure(c,'wizard'),15);
 c.gear[0].armorStats.category='heavy';assert.equal(specialSpellFailure(c,'bard'),15);c.gear[0].armorStats.spellFailure=5;assert.equal(specialSpellFailure(c,'wizard'),0);
});

test('warlock and dragonfire invocations and divine casting retain their separate source rules',()=>{
 const c=make('Warlock',3,'dragonfire-adept');c.gear=[armor(),shield()];assert.equal(specialSpellFailure(c,'warlock'),15);assert.equal(specialSpellFailure(c,'dragonfire-adept'),35);
 const divine=make('Cleric',3,'wizard');divine.gear=[armor('heavy',35),shield('Tower Shield',50)];assert.equal(specialSpellFailure(divine,'cleric'),0);assert.equal(specialSpellFailure(divine,'wizard'),85);
});

test('actual Roll20 custom armor imports calculate without rewriting equipment or source data',async()=>{
 const values={class1:'Wizard',level1:3,race:'Human',str:16,dex:14,con:14,int:18,wis:14,cha:16,hp:12,hp_max:15,acitem:'Custom engraved armor',acitemtype:'Light',acitembonus:4,acitemdex:5,acitemcheckpenalty:2,acitemspellfailure:17,acitemweight:10,shieldname:'Custom heavy shield',shieldbonus:2,shielddex:100,shieldcheckpenalty:2,shieldspellfailure:13,shieldweight:5,arcanespellfailure:30};
 const source={format:'roll20-dnd35-export',version:1,exportedAt:'2026-11-04',character:{id:'synthetic-armor',name:'Import QA'},attributes:Object.entries(values).map(([name,current])=>({name,current,max:''}))};
 const c=activateAutomation(importRoll20(source).character);c.gear.find(g=>g.armorStats.kind==='shield').armorStats.shieldType='heavy';const before=structuredClone(c);assert.ok(c.gear.every(g=>g.armorStats&&!g.catalogId));assert.equal(specialSpellFailure(c,'wizard'),30);assert.deepEqual(c,before);
 const restored=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));assert.equal(specialSpellFailure(restored,'wizard'),30);assert.deepEqual(restored.gear,JSON.parse(JSON.stringify(c.gear)));assert.deepEqual(restored.roll20Import.raw,source);
});

test('native and browser saves retain armor, preparations, notes and expenditure through paired advancement',async()=>{
 const c=make('Duskblade',3,'wizard');c.gear=[armor('medium',25),shield()];c.gear[1].armorStats.shieldType='heavy';recompute(c);c.hp-=3;c.notes='Keep campaign notes';c.experience=6000;
 const wizard=c.casters.find(p=>p.casting?.classId==='wizard');wizard.slots[1].used=1;wizard.notes='Wizard book notes';wizard.spells.push({id:'known-magic',spellId:'magic-missile',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Prepared before advancement',custom:null});
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(loaded,c);assert.equal(specialSpellFailure(loaded,'duskblade'),40);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();const api=createBrowserCharacterApi({scope:'/armored-casting-qa/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/armored-casting-qa/',storage,lock});const restored=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(restored,c);
 const history=structuredClone(restored.automation.history),gear=structuredClone(restored.gear);applyGestaltLevel(restored,previewGestaltLevel(restored,{left:'duskblade',right:'wizard'}));recompute(restored);
 assert.equal(restored.level,4);assert.equal(specialSpellFailure(restored,'duskblade'),15);assert.equal(specialSpellFailure(restored,'wizard'),40);assert.deepEqual(restored.gear,gear);assert.equal(restored.maxHp-restored.hp,3);assert.equal(restored.notes,c.notes);
 const book=restored.casters.find(p=>p.id===wizard.id);assert.equal(book.slots[1].used,1);assert.equal(book.notes,wizard.notes);assert.deepEqual(book.spells,wizard.spells);for(const [key,value] of Object.entries(history))assert.deepEqual(restored.automation.history[key],value);
});

test('catalog equipment retains the same independent casting results',()=>{
 const c=make('Bard',3,'wizard');addEquipment(c,matchEquipment('Chain shirt'));addEquipment(c,equipmentCatalog.find(e=>e.kind==='shield'&&/heavy/i.test(e.name)));assert.equal(specialSpellFailure(c,'bard'),15);assert.equal(specialSpellFailure(c,'wizard'),35);
});

test('unidentified imported shields require review instead of granting an exemption from arbitrary names',()=>{
 for(const kind of ['Warmage','Duskblade']){
  const c=make(kind,8);c.gear=[shield('Moonlight Bulwark',15)];const before=structuredClone(c);
  assert.equal(specialSpellFailure(c,kind.toLowerCase()),15);assert.match(specialSpellFailureWarnings(c,kind.toLowerCase())[0],/shield type.*Gear/i);assert.deepEqual(c,before);
  assert.deepEqual(specialSpellFailureWarnings(c,'wizard'),[],'wizard has no shield exemption to resolve');
  c.gear[0].equipped=false;assert.deepEqual(specialSpellFailureWarnings(c,kind.toLowerCase()),[]);
 }
});

test('explicit imported shield type survives renaming and overrides a conflicting catalog identity',async()=>{
 const c=make('Duskblade',7);c.gear=[{...shield('Moonlight Bulwark',15),catalogId:matchEquipment('Buckler').id}];c.gear[0].armorStats.shieldType='tower';
 assert.equal(shieldType(gearEquipment(c.gear[0])),'tower');assert.equal(equippedArmor(c).tower,-2);assert.equal(armorProficient(c,gearEquipment(c.gear[0])),false);assert.equal(specialSpellFailure(c,'duskblade'),15);assert.deepEqual(specialSpellFailureWarnings(c,'duskblade'),[]);
 c.gear[0].name='My renamed shield';recompute(c);const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(loaded,c);assert.equal(specialSpellFailure(loaded,'duskblade'),15);
 loaded.gear[0].armorStats.shieldType='light';assert.equal(specialSpellFailure(loaded,'duskblade'),0);loaded.gear[0].armorStats.shieldType='heavy';assert.equal(specialSpellFailure(loaded,'duskblade'),0);loaded.classLevels[0].level=6;assert.equal(specialSpellFailure(loaded,'duskblade'),15);
 loaded.gear[0].armorStats.shieldType='invented';assert.equal(characterSchema.safeParse(loaded).success,false);
});

test('legacy catalog shield names resolve regardless of capitalization without adding saved fields',()=>{
 const c=make('Duskblade',7);c.gear=[shield('TOWER SHIELD',50)];const before=structuredClone(c);assert.equal(specialSpellFailure(c,'duskblade'),50);assert.deepEqual(specialSpellFailureWarnings(c,'duskblade'),[]);assert.deepEqual(c,before);
 c.gear=[shield('STEEL SHIELD, LIGHT',5)];assert.equal(specialSpellFailure(c,'duskblade'),0);assert.equal(shieldType(gearEquipment(c.gear[0])),'light');assert.equal(Object.hasOwn(characterSchema.parse(c).gear[0].armorStats,'shieldType'),false);
});
