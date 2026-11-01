import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {sheetTotals} from '../lib/rules.ts';
import {recompute} from '../lib/automation.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const create=(kind,level=5,other)=>createPlayerCharacter({name:'Class AC QA',kind,level,raceId:'human',scores:{STR:10,DEX:10,CON:14,INT:12,WIS:14,CHA:10},method:'manual',hpMethod:'average',...(other?{advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left:kind,right:other}))}:{})});

test('monk and ninja AC bonuses never stack in either ordinary multiclass or gestalt',()=>{
 for(let level=1;level<=20;level++)for(const [left,right]of [['monk','ninja'],['ninja','monk']]){
  const c=create(left,level,right),expected=12+Math.floor(level/5);
  const totals=sheetTotals(c);assert.equal(totals.ac,expected);assert.equal(totals.touch,expected);assert.equal(totals.flat,expected);
 }
 const c=create('monk',5);c.classLevels.push({id:'ninja',classId:'ninja',name:'Ninja',level:10,notes:''});recompute(c);
 assert.equal(sheetTotals(c).ac,14,'use the better complete source, not their sum');
});

test('negative Wisdom is not an AC penalty, and helpless or immobilized characters lose both class bonuses',()=>{
 for(const [kind,other]of [['monk'],['ninja'],['monk','ninja']]){
  const c=create(kind,5,other);c.scores.WIS=8;assert.equal(sheetTotals(c).ac,11);
  c.scores.WIS=14;c.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(c).ac,13,'flat-footedness alone keeps the class bonus');
  c.automation.context.helpless=true;assert.equal(sheetTotals(c).ac,10);assert.equal(sheetTotals(c).touch,10);assert.equal(sheetTotals(c).flat,10);
 }
});

test('armor, shields and load suppress these sources while manual and unrelated bonuses remain intact',()=>{
 const c=create('monk',5,'ninja');c.defense.misc=4;
 assert.equal(sheetTotals(c).ac,17);
 addEquipment(c,matchEquipment('Leather','armor'),true);recompute(c);assert.equal(sheetTotals(c).ac,16);
 c.gear=[];addEquipment(c,matchEquipment('Buckler','shield'),true);recompute(c);assert.equal(sheetTotals(c).ac,15);
 c.gear=[{id:'pack',name:'Pack',qty:1,weight:40,carried:true,equipped:false,notes:''}];recompute(c);assert.equal(sheetTotals(c).ac,14);
 c.automation.encumbrance=false;recompute(c);assert.equal(sheetTotals(c).ac,17);
 c.automation.enabled=false;c.defense.armor=0;c.defense.shield=0;assert.equal(sheetTotals(c).ac,14);
});

test('class AC corrections are read-only and preserve native progression, injuries and resource expenditure',async()=>{
 const c=create('monk',7,'ninja');c.hp-=3;const resource=c.features.find(f=>f.ruleId==='supp:ninja:Ki power');resource.used=2;
 const before=structuredClone(c);sheetTotals(c);assert.deepEqual(c,before);
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));
 assert.deepEqual(loaded,c);assert.equal(loaded.maxHp-loaded.hp,3);assert.equal(loaded.features.find(f=>f.id===resource.id).used,2);
 assert.equal(sheetTotals(loaded).ac,13);
});
