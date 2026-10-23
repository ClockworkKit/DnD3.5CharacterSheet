import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,newWeapon} from '../lib/model.ts';
import {eldritchBlastAttackBonus,eldritchBlastAttackNote} from '../lib/eldritch-blast.ts';
import {weaponAttack} from '../lib/rules.ts';
import {addEffect} from '../lib/effects.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';

const create=()=>createPlayerCharacter({name:'Blast QA',kind:'Warlock',level:8,raceId:'human',scores:{STR:12,DEX:16,CON:12,INT:12,WIS:10,CHA:18},method:'manual'});
const feat=(c,name,choice)=>c.features.push({id:crypto.randomUUID(),name,choice,kind:'Feat',description:'',source:'',used:0,max:0});
const saved=c=>JSON.parse(JSON.stringify(c));

test('eldritch blast does not inherit weapon globals or full-attack toggles',()=>{
 for(const automatic of [true,false]){
  const c=create();c.automation.enabled=automatic;const base=eldritchBlastAttackBonus(c);
  assert.equal(base,c.bab+3);
  feat(c,'Rapid Shot');Object.assign(c.automation.context,{twoWeapon:true,offhandLight:false,rapidShot:true,flurry:true,charge:true,smite:true});
  for(const attack of [7,-3,0]){
   c.globalCombat={enabled:true,attack,damage:9,extraDamage:'2d6'};const before=saved(c);
   assert.equal(eldritchBlastAttackBonus(c),base);assert.deepEqual(saved(c),before);
  }
 }
});

test('eldritch blast retains its own Weapon Focus, ranged feats, effects and situational adjustments',()=>{
 const c=create(),base=eldritchBlastAttackBonus(c);c.automation.context.targetInMelee=true;c.automation.context.distance=20;
 assert.equal(eldritchBlastAttackBonus(c),base-4);
 feat(c,'Precise Shot');feat(c,'Point Blank Shot');feat(c,'Weapon Focus','Eldritch blast');
 c.situational=2;addEffect(c,'bless');assert.equal(eldritchBlastAttackBonus(c),base+1+1+2+1);
 c.automation.context.distance=40;assert.equal(eldritchBlastAttackBonus(c),base+1+2+1);
});

test('blast range is not converted into a weapon range increment or extended by Far Shot',()=>{
 const c=create(),base=eldritchBlastAttackBonus(c);
 c.automation.context.distance=120;assert.equal(eldritchBlastAttackBonus(c),base);
 feat(c,'Far Shot');assert.equal(eldritchBlastAttackBonus(c),base);
 assert.match(eldritchBlastAttackNote,/60 ft. maximum \(not a range increment\)/);
 assert.match(eldritchBlastAttackNote,/Choose a legal target/);
});

test('calculation and reload preserve later levels, saved weapon settings and spent resources',async()=>{
 let c=create();c.globalCombat={enabled:true,attack:4,damage:3,extraDamage:'1d6'};
 c.weapons=[{...newWeapon(),name:'QA dagger',proficiency:'yes'}];
 c.classSystems.pools['custom-daily']=2;c.factotum.spent=1;c.notes='Keep current progress';c.hp-=5;
 c.classLevels[0].level=9;recompute(c);c=await prepareCharacter(characterSchema.parse(saved(c)));
 const before=saved(c),base=weaponAttack({...c,globalCombat:undefined},c.weapons[0]);
 eldritchBlastAttackBonus(c);assert.equal(weaponAttack(c,c.weapons[0]),base+4);assert.deepEqual(saved(c),before);
 assert.deepEqual(saved(await prepareCharacter(characterSchema.parse(saved(c)))),before);
 assert.equal(c.classLevels[0].level,9);assert.equal(c.maxHp-c.hp,5);assert.equal(c.classSystems.pools['custom-daily'],2);
});
