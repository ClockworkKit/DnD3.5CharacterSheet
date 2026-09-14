import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {baseClasses} from '../lib/classes.ts';
import {recompute} from '../lib/automation.ts';
import {resetDaily,castingProblem,spendSpell} from '../lib/rules.ts';
import {canUseSpellLike,spendSpellLike} from '../lib/magic.ts';
import {specialSpellFailure} from '../lib/class-systems.ts';
import {equipmentCatalog} from '../lib/equipment.ts';
import {featEligibility} from '../lib/prerequisites.ts';
import {setSigils} from '../lib/racial-abilities.ts';
const create=(kind='Wizard',level=5,raceId='human')=>createPlayerCharacter({kind,level,raceId,name:'Audit',method:'manual',scores:{STR:16,DEX:16,CON:16,INT:18,WIS:18,CHA:18}});
test('all base classes at five progression boundaries remain stable and saveable after recompute and rest',()=>{
 for(const d of baseClasses)for(const level of [1,4,8,12,20]){const c=create(d.name,level),before=structuredClone(c);recompute(c,c);assert.deepEqual(c,before,d.name+' '+level);assert.deepEqual(characterSchema.parse(c),c);const rested=resetDaily(c);assert.deepEqual(characterSchema.parse(rested),rested);}
});
test('automated casting cannot spend a lower-level slot for a higher-level spell',()=>{
 const c=create(),p=c.casters[0],s={id:'qa',spellId:'fireball',level:3,slotLevel:0,prepared:1,spent:0,formula:'',notes:'',custom:null};p.spells=[s];assert.match(castingProblem(p,s,c),/below/);assert.throws(()=>spendSpell(p,s,c),/below/);assert.equal(s.spent,0);s.slotLevel=3;assert.equal(castingProblem(p,s,c),'');assert.equal(spendSpell(p,s,c).spells[0].spent,1);
});
test('zero-capacity tracked abilities are exhausted rather than at will',()=>{
 const c=create();const f={id:'qa',name:'Ability',kind:'Other',description:'',source:'',max:0,used:0,formula:'0'};c.features=[f];assert.equal(canUseSpellLike(f),false);assert.throws(()=>spendSpellLike(c,f.id),/No uses/);delete f.formula;assert.equal(canUseSpellLike(f),true);spendSpellLike(c,f.id);assert.equal(f.used,0);f.ruleId='daily:Ability';assert.equal(canUseSpellLike(f),false);f.max=1;spendSpellLike(c,f.id);assert.equal(canUseSpellLike(f),false);assert.equal(canUseSpellLike(resetDaily(c).features[0]),true);
});
test('Dragonfire Adept invocations suffer armor failure while Warlock light armor is exempt',()=>{
 const e=equipmentCatalog.find(e=>e.name==='Chain shirt');for(const [kind,expected] of [['Dragonfire Adept',20],['Warlock',0],['Cleric',0]]){const c=create(kind);c.gear=[{id:'qa',catalogId:e.id,name:e.name,qty:1,weight:e.weight,carried:true,equipped:true,notes:''}];assert.equal(specialSpellFailure(c,c.classLevels[0].classId),expected);}
});
test('Krau does not create a spell-like caster level for a noncaster',()=>{
 const feats=JSON.parse(readFileSync(new URL('../public/data/feats.json',import.meta.url)));const c=create('Fighter',3,'illumian');setSigils(c,['naen','krau']);assert.equal(featEligibility(c,feats.find(f=>f.id==='scribe-scroll')).eligible,false);
});
test('shield proficiency matches the equipment catalog and unlocks shield feats',()=>{
 const feats=JSON.parse(readFileSync(new URL('../public/data/feats.json',import.meta.url))),c=create('Fighter');assert.equal(featEligibility(c,feats.find(f=>f.id==='shield-proficiency')).eligible,false);assert.equal(featEligibility(c,feats.find(f=>f.id==='improved-shield-bash')).eligible,true);
});
