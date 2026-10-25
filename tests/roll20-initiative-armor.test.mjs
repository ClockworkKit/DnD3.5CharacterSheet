import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {reviewRoll20Initiative,chooseInitiativeArmor,initiativeArmorPenalty} from '../lib/roll20-initiative.ts';
import {characterSchema} from '../lib/model.ts';
import {equippedArmor} from '../lib/equipment.ts';
import {recompute} from '../lib/automation.ts';
import {sheetTotals,makeInitiativeRoll,makeMacro} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-24',character:{id:'initiative-test',name:'Initiative test'},attributes:Object.entries({class1:'Cleric',level1:3,str:16,dex:14,hp:18,hp_max:24,shieldname:'Tower Shield',shieldbonus:4,shieldcheckpenalty:9,...extra}).map(([name,current])=>({name,current,max:''}))});
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const create=async extra=>load(importRoll20(raw(extra)).character);
const legacy=async extra=>{const c=await create(extra);delete c.roll20Import.initiativeArmor;return c;};
const oldTotal=c=>{const old=structuredClone(c);old.roll20Import.initiativeArmor={mode:'manual',includedPenalty:0};return sheetTotals(old).initiative;};

test('new imports without an included initiative penalty use equipped nonproficiency, never tower attack or load penalties',async()=>{
 const c=await create();assert.equal(equippedArmor(c).nonproficient,-9);assert.equal(initiativeArmorPenalty(c),-9);assert.equal(sheetTotals(c).initiative,-7);
 const roll=makeInitiativeRoll(c);assert.equal(roll.formula,'1d20-7');assert.equal(roll.initiative,true);assert.ok(makeMacro(roll,c.name).includes('[[1d20-7 &{tracker}]]'));
 c.gear[0].proficient=true;assert.equal(sheetTotals(c).initiative,2);
 c.gear.push({id:'load',name:'Supplies',qty:1,weight:200,carried:true,equipped:false,notes:''});recompute(c);assert.equal(sheetTotals(c).initiative,2);
});

test('numeric source totals retain their original value and only the original armor component is offset',async()=>{
 for(const init of [-7,0,2]){
  const data=raw({init}),c=await load(importRoll20(data).character);
  assert.equal(sheetTotals(c).initiative,init);assert.equal(c.roll20Import.initiativeArmor.includedPenalty,-9);assert.deepEqual(c.roll20Import.raw,data);
  c.gear[0].equipped=false;assert.equal(sheetTotals(c).initiative,init+9);
  c.gear[0].equipped=true;c.gear[0].masterwork=true;assert.equal(sheetTotals(c).initiative,init+1);
  c.scores.DEX+=2;assert.equal(sheetTotals(c).initiative,init+2);
 }
});

test('existing saves preserve later levels, notes, HP, preparations and expenditure without repeated adjustment',async()=>{
 const c=await legacy({init:-7});c.classLevels[0].level=5;recompute(c);c.hp-=3;c.notes='Later session';c.casters[0].slots[1].used=2;c.scores.DEX+=2;
 const before=saved(c),total=oldTotal(c),fixed=await load(c),after=saved(fixed);
 assert.equal(sheetTotals(fixed).initiative,total);after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
 assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('edited misc, changed proficiency/equipment and missing classes require review without changing current initiative',async()=>{
 for(const edit of [c=>{c.initiative-=9;},c=>{c.gear[0].proficient=true;},c=>{c.gear[0].masterwork=true;},c=>{c.gear=[];}]){
  const c=await legacy({init:-7});edit(c);const total=oldTotal(c),before=saved(c);await reviewRoll20Initiative(c);
  assert.equal(c.roll20Import.initiativeArmor.mode,'review');assert.equal(sheetTotals(c).initiative,total);
  const after=saved(c);after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
 }
 const missing=await create({class1:'cleric dwarf strength',level1:0,level:2,init:-7});
 assert.equal(missing.roll20Import.initiativeArmor.mode,'review');assert.equal(sheetTotals(missing).initiative,-7);
 const ambiguous=await create({init:'@{dex-mod}+@{initmiscmod}',initmiscmod:-9});
 assert.equal(ambiguous.roll20Import.initiativeArmor.mode,'review');assert.equal(sheetTotals(ambiguous).initiative,-7);
});

test('explicit included, separate and manual choices persist and never rewrite initiative misc',async()=>{
 const c=await create({initmiscmod:-9}),misc=c.initiative;
 assert.equal(c.roll20Import.initiativeArmor.mode,'review');chooseInitiativeArmor(c,-9);assert.equal(sheetTotals(c).initiative,-7);
 chooseInitiativeArmor(c,0);assert.equal(sheetTotals(c).initiative,-16);
 chooseInitiativeArmor(c,null);assert.equal(sheetTotals(c).initiative,-7);assert.equal(c.initiative,misc);
 assert.deepEqual(saved(await load(c)),saved(c));
 const before=saved(c);for(const value of [1,-201,NaN,Infinity])assert.throws(()=>chooseInitiativeArmor(c,value));assert.deepEqual(saved(c),before);
});

test('manual mode and monster sheets keep manual totals; native player sheets use live penalties',async()=>{
 const c=await create({init:-7});c.automation.enabled=false;assert.equal(initiativeArmorPenalty(c),0);assert.equal(sheetTotals(c).initiative,-7);
 c.automation.enabled=true;c.sheetKind='monster';assert.equal(initiativeArmorPenalty(c),0);
 c.sheetKind='pc';delete c.roll20Import;c.initiative=0;assert.equal(sheetTotals(c).initiative,-7);
});

test('Factotum, feat and effect bonuses remain separate and casting resources are never spent',async()=>{
 const c=await create({class1:'Factotum',level1:3,int:18,feats:'Improved Initiative'});c.factotum.spent=2;
 c.effects.push({id:'init-effect',name:'Initiative bonus',preset:'',active:true,permanent:false,casterLevel:3,rounds:0,notes:'',modifiers:[{target:'initiative',type:'competence',value:'2',when:''}]});
 assert.equal(sheetTotals(c).initiative,2+4+4+2-9);
 const before=saved(c);makeInitiativeRoll(c);assert.deepEqual(saved(c),before);
});

test('browser and native round trips preserve the decision and current state',async()=>{
 const c=await create({init:-7});chooseInitiativeArmor(c,-9);c.gear[0].equipped=false;recompute(c);c.hp-=2;
 const records=new Map(),api=createBrowserCharacterApi({scope:'initiative-armor',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),saved(c));assert.equal(sheetTotals(backup).initiative,2);
});

test('invalid original exports retain current initiative and offer manual review, never guessed reconciliation',async()=>{
 const c=await legacy();c.roll20Import.raw={invalid:true};const total=oldTotal(c);
 await reviewRoll20Initiative(c);assert.equal(c.roll20Import.initiativeArmor.mode,'review');assert.equal(sheetTotals(c).initiative,total);
});
