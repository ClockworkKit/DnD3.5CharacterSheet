import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {magicSections} from '../lib/magic.ts';
import {learnInvocation,invocationProblem} from '../lib/invocations.ts';
import {systemWarnings,useSystemChoice} from '../lib/class-systems.ts';
import {resetDaily} from '../lib/rules.ts';
const catalog=JSON.parse(readFileSync(new URL('../public/data/invocations.json',import.meta.url)));
const create=(kind,level=1,raceId='human')=>createPlayerCharacter({name:'Magic QA',kind,level,raceId,scores:{STR:12,DEX:14,CON:14,INT:18,WIS:14,CHA:16},method:'manual'});
test('Magic shows only applicable systems while retaining saved orphan choices',()=>{
 assert.deepEqual(magicSections(create('Fighter')),{spells:false,powers:false,factotum:false,systems:false,abilities:false});
 assert.equal(magicSections(create('Wizard')).spells,true);assert.equal(magicSections(create('Psion')).powers,true);
 assert.equal(magicSections(create('Factotum')).factotum,true);assert.equal(magicSections(create('Warlock')).systems,true);
 assert.equal(magicSections(create('Fighter',1,'drow')).abilities,true);
 const c=create('Warlock');learnInvocation(c,catalog.find(v=>v.classId==='warlock'&&v.grade==='least'));c.classLevels=[];assert.equal(magicSections(c).systems,true);
});
test('invocation catalog has unique memberships, verified grades, and source links',()=>{
 assert.equal(catalog.length,116);assert.equal(new Set(catalog.map(v=>v.id)).size,116);
 assert.equal(catalog.filter(v=>v.classId==='warlock').length,86);assert.equal(catalog.filter(v=>v.classId==='dragonfire-adept').length,30);
 for(const v of catalog){assert.ok(['least','lesser','greater','dark'].includes(v.grade));assert.ok(v.level>=1&&v.level<=9);assert.match(v.source,/^https:\/\/srd\.dndtools\.org\/.*#/);}
 assert.equal(catalog.find(v=>v.name==='Eldritch Line').category,'shape');assert.equal(catalog.find(v=>v.name==='Dragonward').category,'other');
});
test('invocation selection checks class, grade rather than equivalent level, duplicate and known limit',()=>{
 const c=create('Dragonfire Adept'),least=catalog.find(v=>v.name==='Endure Exposure'),greater=catalog.find(v=>v.name==='Hindering Blast');
 assert.equal(least.grade,'least');assert.equal(least.level,3);assert.equal(invocationProblem(c,least),'');learnInvocation(c,least);assert.deepEqual(systemWarnings(c),[]);useSystemChoice(c,c.classSystems.choices[0].id);assert.equal(c.classSystems.choices[0].spent,0);
 assert.match(invocationProblem(c,least),/Already/);assert.match(invocationProblem(c,catalog.find(v=>v.classId==='dragonfire-adept'&&v.name==='Darkness')),/filled/);
 assert.match(invocationProblem(c,greater),/matching/);assert.match(invocationProblem(create('Warlock',6),greater),/grade/);assert.equal(invocationProblem(create('Warlock',11),greater),'');
});
test('invocations survive saves and daily resets, and level loss flags grade access',()=>{
 const c=create('Warlock',16),v=catalog.find(v=>v.classId==='warlock'&&v.grade==='dark');learnInvocation(c,v);
 const restored=characterSchema.parse(JSON.parse(JSON.stringify(c)));resetDaily(restored);assert.deepEqual(restored.classSystems.choices,c.classSystems.choices);
 restored.classLevels[0].level=1;assert.ok(systemWarnings(restored).some(w=>w.includes('level limit')));assert.throws(()=>useSystemChoice(restored,restored.classSystems.choices[0].id),/level limit/);
});
test('custom spell-like placement survives save parsing and can be reversed',()=>{
 const c=create('Fighter');c.features.push({id:'custom-sla',name:'Custom ability',kind:'Other',description:'Campaign rules',source:'',max:2,used:1,magic:true});
 const saved=characterSchema.parse(c);assert.equal(magicSections(saved).abilities,true);assert.equal(saved.features.at(-1).used,1);
 saved.features.at(-1).magic=false;assert.equal(magicSections(saved).abilities,false);
});
