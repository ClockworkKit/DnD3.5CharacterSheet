import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {useAlternateAction} from '../lib/alternate-actions.ts';
import {combatExpertiseAmount} from '../lib/combat-options.ts';
import {recompute} from '../lib/automation.ts';
import {activeDamageReductions} from '../lib/damage-reduction.ts';
import {effectBonus} from '../lib/effects.ts';
import {sheetTotals,weaponAttack} from '../lib/rules.ts';
import {newWeapon,characterSchema} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';

function monk(style='Undying Way',paired=false){
 const c=createPlayerCharacter({name:'Conditional style QA',kind:'Monk',level:6,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:14,WIS:14,CHA:10},method:'manual',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:6},()=>({left:'monk',right:'fighter'}))}:{})});
 configureAlternateFeature(c,'monk-fighting-styles',{choice:style,reviewed:true});
 selectAlternateFeature(c,'monk-fighting-styles',true);
 configureAlternateFeature(c,'monk-fighting-styles',{styleQualifiedAtSix:true});
 recompute(c);return c;
}
const expertise=c=>c.features.push({id:'expertise',name:'Combat Expertise',kind:'Feat',description:'Player feat',source:'',max:0,used:0});
const undying=c=>activeDamageReductions(c).find(s=>s.id==='acf-undying')?.amount||0;

test('stale Expertise selection cannot grant Undying Way DR without the feat or usable BAB',()=>{
 const c=monk();c.automation.context.combatExpertise=5;
 assert.equal(undying(c),0);
 expertise(c);assert.equal(undying(c),2);
 c.bab=0;assert.equal(undying(c),0);
 c.bab=-1;assert.equal(undying(c),0);
 c.bab=4;c.automation.context.combatExpertise=0;assert.equal(undying(c),0);
});

test('Denying Stance requires real Expertise or fighting defensively, not total defense alone',()=>{
 const c=monk('Denying Stance');c.automation.context.combatExpertise=5;
 assert.equal(effectBonus(c,'grapple'),0);
 expertise(c);assert.equal(effectBonus(c,'grapple'),2);
 c.bab=0;assert.equal(effectBonus(c,'grapple'),0);
 c.automation.context.defensive='fighting';assert.equal(effectBonus(c,'grapple'),2);
 c.automation.context.combatExpertise=0;c.automation.context.defensive='total';assert.equal(effectBonus(c,'grapple'),0);
});

test('Undying Way retains separate defensive actions and requires earned historical qualification',()=>{
 const c=monk();
 for(const defensive of ['fighting','total']){
  c.automation.context.defensive=defensive;assert.equal(undying(c),2);
  configureAlternateFeature(c,'monk-fighting-styles',{styleQualifiedAtSix:false});assert.equal(undying(c),0);
  configureAlternateFeature(c,'monk-fighting-styles',{styleQualifiedAtSix:true});assert.equal(undying(c),2);
  c.automation.enabled=false;assert.equal(undying(c),0);c.automation.enabled=true;
 }
 c.classLevels[0].level=5;assert.equal(undying(c),0);
 c.classLevels[0].level=6;selectAlternateFeature(c,'monk-fighting-styles',false);assert.equal(undying(c),0);
});

test('Expertise attack, AC and style benefit agree at the BAB and five-point caps',()=>{
 const c=monk();expertise(c);const w={...newWeapon(),name:'Unarmed strike',damage:'1d6'};
 for(const bab of [0,1,4,6,-1]){
  c.bab=bab;c.automation.context.combatExpertise=0;
  const ac=sheetTotals(c).ac,attack=weaponAttack(c,w);
  c.automation.context.combatExpertise=5;const amount=Math.max(0,Math.min(bab,5));
  assert.equal(sheetTotals(c).ac,ac+amount);assert.equal(weaponAttack(c,w),attack-amount);
  assert.equal(undying(c),amount?2:0);
 }
});

test('gestalt conditional defenses remain read-only and preserve native saves with stale selections',async()=>{
 for(const style of ['Undying Way','Denying Stance']){
  const c=monk(style,true);c.hp-=3;c.automation.context.combatExpertise=5;
  c.features.push({id:'personal',name:'Personal resource',kind:'Class feature',description:'Keep this note',source:'',max:3,used:2});
  c.defense.drSources=[{id:'manual',source:'Custom protection',amount:1,bypass:'magic',active:true,gearId:'',notes:'Keep this too'}];
  const before=structuredClone(c);
  assert.equal(undying(c),0);assert.equal(effectBonus(c,'grapple'),0);sheetTotals(c);
  assert.deepEqual(c,before);
  const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
  assert.deepEqual(loaded,c);assert.equal(loaded.automation.context.combatExpertise,5);
  assert.equal(loaded.maxHp-loaded.hp,3);assert.equal(loaded.features.find(f=>f.id==='personal').used,2);
  expertise(loaded);
  assert.equal(undying(loaded),style==='Undying Way'?2:0);
  assert.equal(effectBonus(loaded,'grapple'),style==='Denying Stance'?2:0);
 }
});

test('Expertise shares Resolute BAB changes and does not activate an unavailable alternate feat grant',()=>{
 const c=monk('Undying Way',true);expertise(c);c.automation.context.combatExpertise=5;
 configureAlternateFeature(c,'fighter-resolute',{reviewed:true});selectAlternateFeature(c,'fighter-resolute',true);
 assert.equal(combatExpertiseAmount(c),5);useAlternateAction(c,'fighter-resolute','resolute');
 assert.equal(combatExpertiseAmount(c),3);assert.equal(undying(c),2);
 c.automation.enabled=false;assert.equal(combatExpertiseAmount(c),0);assert.equal(undying(c),0);
 c.automation.enabled=true;c.features.find(f=>f.id==='expertise').ruleId='acf-grant:monk-disabled-source:style-1';
 assert.equal(combatExpertiseAmount(c),0);assert.equal(undying(c),0);
});
