import test from 'node:test';
import assert from 'node:assert/strict';
import {bestiary,createBestiaryMonster,challengeRatingLabel} from '../lib/bestiary.ts';
import {sheetTotals,weaponAttack,weaponDamage,skillBonus} from '../lib/rules.ts';
import {naturalAttackRoutine} from '../lib/creatures.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {recompute,activateAutomation} from '../lib/automation.ts';
const printed={
 'human-skeleton':{hp:6,ac:15,touch:11,flat:14,initiative:5,grapple:1,saves:{fort:0,ref:1,will:2},natural:[[1,'1d4+1'],[1,'1d4+1']]},
 'wolf-skeleton':{hp:13,ac:15,touch:13,flat:12,initiative:7,grapple:2,saves:{fort:0,ref:3,will:3},natural:[[2,'1d6+1']]},
 'owlbear-skeleton':{hp:32,ac:13,touch:11,flat:11,initiative:6,grapple:11,saves:{fort:1,ref:3,will:4},natural:[[6,'1d6+5'],[6,'1d6+5'],[1,'1d8+2']]},
 ghoul:{hp:13,ac:14,touch:12,flat:12,initiative:2,grapple:2,saves:{fort:0,ref:2,will:5},natural:[[2,'1d6+1'],[0,'1d3'],[0,'1d3']]},
 wolf:{hp:13,ac:14,touch:12,flat:12,initiative:2,grapple:2,saves:{fort:5,ref:5,will:1},natural:[[3,'1d6+1']]},
 ogre:{hp:29,ac:16,touch:8,flat:16,initiative:-1,grapple:12,saves:{fort:6,ref:0,will:1},natural:[]},
};
test('all starter stat blocks reproduce published HP, defenses, saves and natural attacks',()=>{
 for(const entry of bestiary.filter(e=>printed[e.id])){const c=createBestiaryMonster(entry.id),t=sheetTotals(c),expected=printed[entry.id];
  assert.equal(c.hp,expected.hp,entry.id);for(const key of ['ac','touch','flat','initiative','grapple','saves'])assert.deepEqual(t[key],expected[key],entry.id+' '+key);
  assert.deepEqual(naturalAttackRoutine(c).map(a=>[a.attackBonus,a.damageFormula]),expected.natural,entry.id);assert.equal(c.creature.source,entry.source);assert.equal(new URL(entry.source).hostname,'srd.dndtools.org');
 }
});
test('manufactured attacks retain printed bonuses and damage',()=>{
 const ogre=createBestiaryMonster('ogre');assert.deepEqual(ogre.weapons.map(w=>[weaponAttack(ogre,w),weaponDamage(ogre,w)]),[[8,'2d8+7'],[1,'1d8+5']]);
 const skeleton=createBestiaryMonster('human-skeleton');assert.equal(weaponAttack(skeleton,skeleton.weapons[0]),1);assert.equal(weaponDamage(skeleton,skeleton.weapons[0]),'1d6+1');
});
test('published skills include fixed adjustments once',()=>{
 for(const [id,expected] of [['wolf',{Hide:2,Listen:3,'Move Silently':3,Spot:3,Survival:1}],['ghoul',{Balance:6,Climb:5,Hide:6,Jump:5,'Move Silently':6,Spot:7}],['ogre',{Climb:5,Listen:2,Spot:2}]]){const c=createBestiaryMonster(id);for(const [name,value] of Object.entries(expected))assert.equal(skillBonus(c,c.skills.find(s=>s.name===name)),value,id+' '+name);}
});
test('each preset creates an independent sheet that retains edits through import and recompute',()=>{
 for(const e of bestiary){const c=createBestiaryMonster(e.id,'Encounter copy');c.hp=1;c.creature.notes+=' Saved note';const restored=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}));activateAutomation(restored);recompute(restored);assert.deepEqual(restored,c);assert.notEqual(createBestiaryMonster(e.id).creature.notes,c.creature.notes);assert.equal(createBestiaryMonster(e.id).name,e.name);}
});
test('CR fractions are readable and unknown preset IDs fail',()=>{assert.equal(challengeRatingLabel(1/3),'1/3');assert.equal(challengeRatingLabel(null),'—');assert.throws(()=>createBestiaryMonster('missing'));});

test('undead Concentration checks use Charisma despite absent Constitution',()=>{const c=createBestiaryMonster('ghoul');const s=c.skills.find(s=>s.name==='Concentration');assert.equal(skillBonus(c,s),1);});
