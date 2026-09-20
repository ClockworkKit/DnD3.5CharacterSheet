import test from 'node:test';
import assert from 'node:assert/strict';
import {characterSchema,newCharacter,maxDamageReductionSources} from '../lib/model.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {sheetTotals,resetDaily} from '../lib/rules.ts';
import {activeDamageReductions,damageReductionStatus,formatDamageReduction,newDamageReductionSource} from '../lib/damage-reduction.ts';

const source=(patch={})=>({...newDamageReductionSource(),source:'Metal armor',amount:3,...patch});

test('old saves retain free-text DR and get independent empty source lists',()=>{
  const legacy=newCharacter();
  legacy.defense.dr='10/silver or magic; special campaign exception';
  delete legacy.defense.drSources;
  const a=characterSchema.parse(legacy),b=characterSchema.parse(legacy);
  assert.equal(a.defense.dr,legacy.defense.dr);
  assert.deepEqual(a.defense.drSources,[]);
  a.defense.drSources.push(source());
  assert.deepEqual(b.defense.drSources,[]);
});

test('armor DR follows equipment, quantity, carrying and the source toggle in both calculation modes',()=>{
  for(const enabled of [false,true]){
    const c=newCharacter();c.automation.enabled=enabled;
    const armor=c.gear[0],dr=source({gearId:armor.id});c.defense.drSources=[dr];
    assert.deepEqual(activeDamageReductions(c),[dr]);
    for(const [key,value] of [['equipped',false],['carried',false],['qty',0]]){
      const previous=armor[key];armor[key]=value;
      assert.equal(damageReductionStatus(c,dr),'Linked item not equipped');
      assert.deepEqual(activeDamageReductions(c),[]);
      armor[key]=previous;
      assert.deepEqual(activeDamageReductions(c),[dr]);
    }
    dr.active=false;
    assert.deepEqual(activeDamageReductions(c),[]);
    dr.active=true;dr.amount=0;
    assert.deepEqual(activeDamageReductions(c),[]);
  }
});

test('removing linked gear suppresses DR without losing the source or turning it into manual DR',()=>{
  const c=newCharacter(),dr=source({gearId:c.gear[0].id,notes:'Stacks only as the campaign permits.'});
  c.defense.drSources=[dr];c.gear=[];
  const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(saved.defense.drSources,[dr]);
  assert.equal(damageReductionStatus(saved,dr),'Linked item removed');
  assert.deepEqual(activeDamageReductions(saved),[]);
  saved.defense.drSources[0].gearId='';
  assert.equal(activeDamageReductions(saved).length,1);
});

test('sources with different or identical bypasses remain distinct and are never summed',()=>{
  const c=newCharacter();
  c.defense.drSources=[source(),source({source:'Barbarian',amount:1}),source({source:'Stoneskin',amount:10,bypass:'adamantine'}),source({source:'Expired spell',amount:20,active:false})];
  const active=activeDamageReductions(c);
  assert.deepEqual(active.map(formatDamageReduction),['DR 3/—','DR 1/—','DR 10/adamantine']);
  assert.equal(formatDamageReduction(source({bypass:' silver and good '})),'DR 3/silver and good');
});

test('DR survives recalculation, daily reset and JSON round trips without changing HP or AC',()=>{
  const c=activateAutomation(newCharacter(),false);
  c.hp-=5;c.tempHp=4;
  const totals=sheetTotals(c),hp=c.hp;
  c.defense.dr='Original Roll20 DR note';
  c.defense.drSources=[source({gearId:c.gear[0].id,notes:'Campaign metal armor rule.'}),source({active:false,bypass:'magic',amount:5})];
  const defense=structuredClone(c.defense);
  recompute(c);recompute(c);
  assert.deepEqual(c.defense,defense);
  assert.equal(c.hp,hp);assert.equal(c.tempHp,4);
  assert.deepEqual(sheetTotals(c),totals);
  const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));
  assert.deepEqual(saved,c);
  const rested=resetDaily(saved);
  assert.deepEqual(rested.defense.drSources,c.defense.drSources);
  assert.equal(rested.defense.dr,c.defense.dr);
});

test('DR schema rejects invalid amounts, duplicate IDs and oversized lists',()=>{
  const c=newCharacter();
  for(const amount of [-1,.5,NaN,Infinity,10001]){
    c.defense.drSources=[source({amount})];
    assert.equal(characterSchema.safeParse(c).success,false);
  }
  const dr=source();c.defense.drSources=[dr,{...dr}];
  assert.equal(characterSchema.safeParse(c).success,false);
  c.defense.drSources=Array.from({length:maxDamageReductionSources},()=>source());
  assert.equal(characterSchema.safeParse(c).success,true);
  c.defense.drSources.push(source());
  assert.equal(characterSchema.safeParse(c).success,false);
});
