import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {effectSchema} from '../lib/automation-schema.ts';
import {equippedArmor,movement,gearEquipment} from '../lib/equipment.ts';
import {sheetTotals,attackRoutine,makeFullAttackRoll} from '../lib/rules.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'shield-presence-test',name:'Shield presence test'},attributes:Object.entries({class1:'Monk',level1:3,str:14,dex:14,wis:16,hp:14,hp_max:18,weapon1name:'Unarmed strike',shieldname:'Training buckler',shieldbonus:0,shieldcheckpenalty:0,...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const create=async extra=>load(importRoll20(raw(extra)).character);
const shield=c=>c.gear.find(g=>gearEquipment(g)?.kind==='shield');

test('a worn custom shield with zero AC still prevents monk flurry and fast movement',async()=>{
 const c=await create();c.automation.context.flurry=true;
 assert.equal(shield(c).armorStats.armor,0);assert.equal(equippedArmor(c).shield,0);assert.equal(equippedArmor(c).hasShield,true);
 assert.equal(movement(c).free,false);assert.equal(attackRoutine(c,c.weapons[0]).length,1);assert.equal(makeFullAttackRoll(c).rolls.length,2);
 const ac=sheetTotals(c).ac,speed=movement(c).speed;
 shield(c).equipped=false;recompute(c);
 assert.equal(equippedArmor(c).hasShield,false);assert.equal(movement(c).free,true);
 assert.equal(sheetTotals(c).ac,ac+3);assert.equal(movement(c).speed,speed+10);assert.equal(attackRoutine(c,c.weapons[0]).length,2);
});

test('quantity, carried and equipped flags govern shield presence, independently of AC or proficiency',async()=>{
 const c=await create(),g=shield(c);
 for(const armor of [0,-1,2]){
  g.armorStats.armor=armor;g.proficient=true;assert.equal(equippedArmor(c).hasShield,true);
  for(const flag of ['carried','equipped']){g[flag]=false;assert.equal(equippedArmor(c).hasShield,false);g[flag]=true;}
  g.qty=0;assert.equal(equippedArmor(c).hasShield,false);g.qty=1;
 }
});

test('a shield effect without physical shield gear does not disable unarmored abilities',async()=>{
 const c=await create();shield(c).equipped=false;
 recompute(c);const ac=sheetTotals(c).ac;
 c.effects.push(effectSchema.parse({id:'shield-spell',name:'Shield spell',modifiers:[{target:'ac.shield',value:'4',type:'shield'}]}));
 assert.equal(sheetTotals(c).ac,ac+4);
 // A manual shield bonus also does not prove physical shield use.
 c.defense.shield=4;
 assert.equal(equippedArmor(c).hasShield,false);assert.equal(movement(c).free,true);
});

test('existing imported saves preserve progress, custom stats and notes while the runtime check follows their current gear',async()=>{
 const c=await create();c.classLevels[0].level=6;recompute(c);c.hp-=3;c.notes='After level-up';shield(c).notes='Keep this custom item';
 c.automation.context.flurry=true;const before=saved(c),fixed=await load(c);
 assert.deepEqual(saved(fixed),before);assert.equal(equippedArmor(fixed).hasShield,true);assert.equal(attackRoutine(fixed,fixed.weapons[0]).some(a=>a.label==='Flurry'),false);
 assert.deepEqual(fixed.roll20Import.raw,raw());
});
