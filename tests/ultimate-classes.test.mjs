import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classCatalog,findClass,copyClassFeatures,makeCaster} from '../lib/classes.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute,resourceNumbers} from '../lib/automation.ts';
import {gainLevel} from '../lib/level-up.ts';
import {casterProgression,advancementCandidates} from '../lib/advancement.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {equipmentCatalog,armorProficient,weaponProficient} from '../lib/equipment.ts';
import {expandSpellCatalog} from '../lib/spell-catalog.ts';
const read=p=>JSON.parse(readFileSync(new URL('../'+p,import.meta.url)));
const added=read('lib/ultimate-class-data.json');
const create=(kind,level=1)=>createPlayerCharacter({name:'Ultimate QA',kind,level,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:18,WIS:12,CHA:16},method:'manual'});
const entry=(id,level)=>({id:crypto.randomUUID(),classId:id,name:findClass(id).name,level,notes:''});
const feat=(c,name,choice)=>c.features.push({id:crypto.randomUUID(),name,choice,kind:'Feat',description:'',source:'',max:0,used:0});

test('all class references use Ultimate SRD and new tables match both application editions',()=>{
 const browser=read('public/data/classes.json');assert.equal(classCatalog.length,90);assert.equal(browser.length,90);
 assert.equal(new Set(classCatalog.map(c=>c.id)).size,90);
 for(const c of classCatalog){assert.equal(new URL(c.source).hostname,'srd.dndtools.org');assert.match(new URL(c.source).pathname,/^\/srd\/classes\//);assert.equal(browser.find(d=>d.id===c.id).source,c.source);}
 for(const d of added){assert.deepEqual(browser.find(c=>c.id===d.id),d);assert.deepEqual(d.levels.map(r=>r.level),Array.from({length:d.levels.length},(_,i)=>i+1));for(const r of d.levels)assert.equal(r.extra.length,d.headers.length);}
 assert.match(findClass('warshaper').requirements,/alternate form.*insufficient/);
 assert.equal(findClass('dervish').levels[0].extra[0],'+1');assert.match(findClass('dervish').levels[0].special,/dance/);
});

test('eight new base classes create, level up, and round trip without losing resource use',()=>{
 for(const d of added.filter(c=>c.kind!=='Prestige')){
  for(const level of [1,5,10,20]){const c=create(d.name,level);assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);assert.equal(c.bab,d.levels[level-1].bab);assert.equal(c.saves.will.base,d.levels[level-1].will);assert.ok(c.features.some(f=>f.name===d.name+' class features'));}
  const c=create(d.name,1);if(c.casters[0])c.casters[0].slots[0].used=1;if(c.psionics[0])c.psionics[0].spent=1;c.experience=1000;gainLevel(c,d.id);recompute(c);assert.equal(c.level,2);if(c.casters[0])assert.equal(c.casters[0].slots[0].used,1);if(c.psionics[0])assert.equal(c.psionics[0].spent,1);
 }
});

test('new casting and psionic progressions use their actual abilities and source limits',()=>{
 const dm=create('Death Master',3);assert.equal(dm.bab,2);assert.equal(dm.casters[0].ability,'INT');assert.equal(dm.casters[0].slots[2].max,2);
 const urban=create('Urban Druid');assert.equal(urban.casters[0].ability,'CHA');assert.equal(urban.casters[0].slots[1].max,2);
 const shair=create("Sha'ir");assert.equal(shair.casters.length,1);assert.equal(shair.casters[0].mode,'prepared');assert.equal(shair.casters[0].list,'Sorcerer / Wizard');
 const rogue=create('Psychic Rogue');assert.equal(rogue.psionics[0].max,2);assert.equal(resourceNumbers(create('Psychic Rogue',4)).sneakDice,2);
 const erudite=create('Erudite',20);assert.equal(erudite.psionics[0].max,383);assert.equal(findClass('Erudite').levels[19].uniquePowers,11);assert.equal(findClass('Erudite').levels[19].powersKnown,undefined);
});

test('specific equipment proficiencies do not grant all light armor or shields',()=>{
 const urban=create('Urban Druid');const equipment=name=>{const e=equipmentCatalog.find(e=>e.name===name);assert.ok(e,name);return e;};
 assert.equal(armorProficient(urban,equipment('Leather')),true);assert.equal(armorProficient(urban,equipment('Chain shirt')),false);
 assert.equal(armorProficient(urban,equipment('Buckler')),true);assert.equal(armorProficient(urban,equipment('Shield, heavy wooden')),false);
 const dm=create('Death Master');for(const name of ['Scythe','Scimitar'])assert.equal(weaponProficient(dm,{catalogId:equipment(name).id,name,proficiency:'auto'}),true);
 assert.equal(weaponProficient(dm,{catalogId:equipment('Longsword').id,name:'Longsword',proficiency:'auto'}),false);
});

test('Master Specialist advances only Wizard; other caster prestige levels link normally',()=>{
 const c=create('Wizard',5);c.classLevels.push(entry('sorcerer',2),entry('master-specialist',3));c.casters.push(makeCaster(findClass('sorcerer'),2,16));
 assert.deepEqual(advancementCandidates(c,c.classLevels[2],'spell').map(p=>p.name),['Wizard']);assert.equal(casterProgression(c,c.casters[0]).progression,8);assert.equal(casterProgression(c,c.casters[1]).progression,2);
 c.classLevels[2].castingTarget=c.casters[1].id;assert.equal(casterProgression(c,c.casters[1]).progression,2);delete c.classLevels[2].castingTarget;
 const d=create('Wizard',5);d.classLevels.push(entry('abjurant-champion',5));assert.equal(casterProgression(d,d.casters[0]).progression,10);
});

test('prestige eligibility does not ignore required schools, any-weapon feats, or race Any',()=>{
 const c=create('Wizard',10);feat(c,'Combat Casting');c.classLevels.push(entry('fighter',1));recompute(c);
 const abj=findClass('abjurant-champion');assert.equal(prestigeEligibility(c,abj).eligible,false);
 c.casters[0].spells.push({id:'shield',spellId:'shield',level:1,slotLevel:1,prepared:1,spent:0,notes:'',formula:'',custom:null});assert.equal(prestigeEligibility(c,abj).eligible,true);
 const warrior=create('Fighter',5);feat(warrior,'Improved Initiative');feat(warrior,'Weapon Focus','Longsword');warrior.skills.find(s=>s.name==='Knowledge (arcana)').ranks=4;warrior.skills.find(s=>s.name==='Spellcraft').ranks=3;
 assert.equal(prestigeEligibility(warrior,findClass('occult-slayer')).eligible,true);
 const shapeshifter=prestigeEligibility(warrior,findClass('warshaper'));assert.equal(shapeshifter.eligible,false);assert.ok(shapeshifter.requirements.some(r=>/Race: Any/.test(r.label)&&r.state==='met'));
});

test('legacy generated class links refresh while personal notes, spell sources and spent uses survive',()=>{
 const c=create('Wizard',3);copyClassFeatures(c);const f=c.features.find(f=>f.name==='Wizard class features');f.source='https://olimot.github.io/srd-v3.5/basic-rules-and-legal/character-classes-ii.html#wizard';f.description='My note. Full class reference: '+f.source;f.used=2;
 c.features.push({id:'personal',name:'Personal',kind:'Feat',source:'https://example.org/my-rules',description:'Keep',max:0,used:0});c.automation.enabled=false;recompute(c);
 assert.equal(f.source,findClass('Wizard').source);assert.match(f.description,/My note/);assert.equal(f.used,2);assert.equal(c.features.find(f=>f.id==='personal').source,'https://example.org/my-rules');
});

test('class spell lists include Death Master Animate Dead and preserve ambiguous source entries for DM review',()=>{
 const spells=expandSpellCatalog(read('public/data/spells.json'),read('public/data/supplemental-spells.json'));
 assert.equal(spells.find(s=>s.id==='animate-dead').levels['Death Master'],2);
 assert.equal(spells.find(s=>s.id==='bestow-curse').levels.Jester,undefined);assert.match(findClass('Jester').description,/both 3rd and 4th/);
 assert.ok(spells.filter(s=>s.levels['Urban Druid']!==undefined).length>150);
 const powers=read('public/data/powers.json');assert.equal(powers.find(p=>p.id==='compression').levels['Psychic Rogue'],1);
});
