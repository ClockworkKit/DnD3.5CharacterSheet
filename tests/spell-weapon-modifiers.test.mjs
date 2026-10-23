import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,newWeapon} from '../lib/model.ts';
import {spellAttackBonus,makeSpellAttackOnlyRoll} from '../lib/spell-attacks.ts';
import {makeSpellRoll,spendSpell,weaponAttack,weaponDamage} from '../lib/rules.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {chooseDilettante,castDilettante} from '../lib/factotum.ts';
import {addEffect} from '../lib/effects.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {recompute} from '../lib/automation.ts';

const spells=JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const spell=id=>structuredClone(spells.find(s=>s.id===id));
const create=(kind='Wizard',level=11)=>createPlayerCharacter({name:'Weapon-only modifiers QA',kind,level,raceId:'human',scores:{STR:12,DEX:16,CON:12,INT:18,WIS:18,CHA:14},method:'manual'});
const known=id=>({id:'known-'+id,spellId:id,level:3,slotLevel:3,prepared:2,spent:1,notes:'Keep me',formula:'',custom:null});
const saved=c=>JSON.parse(JSON.stringify(c));

test('weapon globals never change spell attacks in automatic or manual mode, for any delivery',()=>{
 for(const automatic of [true,false])for(const mode of ['melee-touch','ranged-touch','melee','ranged','spiritual-weapon']){
  const c=create();c.automation.enabled=automatic;const s=spell('scorching-ray'),settings={mode,bonus:2};
  const base=spellAttackBonus(c,s,11,settings),held=makeSpellAttackOnlyRoll(c,s,11,settings);
  for(const attack of [7,-3,0])for(const enabled of [true,false]){
   c.globalCombat={enabled,attack,damage:8,extraDamage:'1d6'};const before=saved(c);
   assert.equal(spellAttackBonus(c,s,11,settings),base,`${automatic}/${mode}/${enabled}/${attack}`);
   assert.deepEqual(makeSpellAttackOnlyRoll(c,s,11,settings),held);assert.deepEqual(saved(c),before);
  }
 }
});

test('general situational bonuses, effects and explicit spell adjustments still work; weapons keep globals',()=>{
 const c=create(),s=spell('scorching-ray'),w={...newWeapon(),name:'QA dagger',proficiency:'yes',damage:'1d4'};
 const base=spellAttackBonus(c,s,11),weaponBase=weaponAttack(c,w),damageBase=weaponDamage(c,w);
 c.globalCombat={enabled:true,attack:7,damage:8,extraDamage:'1d6'};
 assert.equal(weaponAttack(c,w),weaponBase+7);assert.notEqual(weaponDamage(c,w),damageBase);
 c.situational=2;addEffect(c,'bless');
 assert.equal(spellAttackBonus(c,s,11,{mode:'auto',bonus:3}),base+2+1+3);
 assert.equal(weaponAttack(c,w),weaponBase+7+2+1);
});

test('cleric and Factotum casts ignore weapon globals and spend the original resource only once',()=>{
 const c=create('Cleric'),s=spell('searing-light'),k=known(s.id),p=c.casters[0];p.spells=[k];
 const expected=makeSpellRoll(c,p,k,s,true);c.globalCombat={enabled:true,attack:9,damage:20,extraDamage:'2d6'};
 const before=saved(c);assert.deepEqual(makeSpellRoll(c,p,k,s,true),expected);assert.deepEqual(saved(c),before);
 Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,2);
 const f=create('Factotum',8),ray=spell('scorching-ray');chooseDilettante(f,ray);
 const daily=makeDilettanteRoll(f,ray);f.globalCombat={...c.globalCombat};
 assert.deepEqual(makeDilettanteRoll(f,ray),daily);assert.equal(f.factotum.spent,0);
 castDilettante(f,ray.id);assert.equal(f.factotum.spent,1);assert.equal(f.factotum.spells[0].spent,true);
});

test('existing Roll20 saves retain globals, later advancement, source data and spent resources',async()=>{
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-23',character:{id:'spell-global-qa',name:'Imported caster QA'},attributes:Object.entries({class1:'Cleric',level1:5,str:12,dex:16,wis:18,hp:30,hp_max:30,weapon1name:'Heavy mace',weapon1dicenumber:1,weapon1dicetype:8,globalAttackBonus:4,globalDamageBonus:3}).map(([name,current])=>({name,current,max:''}))};
 let c=await prepareCharacter(importRoll20(raw).character);c.classLevels[0].level=7;recompute(c);
 c.hp-=6;c.notes='Later session';c.factotum.spent=2;
 const s=spell('searing-light'),k=known(s.id);c.casters[0].spells=[k];c.casters[0].slots[1].used=1;
 c=await prepareCharacter(characterSchema.parse(saved(c)));const before=saved(c);
 const without={...c,globalCombat:undefined},expected=makeSpellRoll(without,without.casters[0],k,s,true);
 assert.deepEqual(makeSpellRoll(c,c.casters[0],k,s,true),expected);
 assert.equal(weaponAttack(c,c.weapons[0]),weaponAttack(without,c.weapons[0])+4);
 assert.deepEqual(saved(c),before);assert.deepEqual(c.roll20Import.raw,raw);
 assert.deepEqual(saved(await prepareCharacter(characterSchema.parse(saved(c)))),before);
});
