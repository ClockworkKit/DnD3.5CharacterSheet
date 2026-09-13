import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,newWeapon,spellSchema} from '../lib/model.ts';
import {recompute,resourceNumbers} from '../lib/automation.ts';
import {systemLimits,systemWarnings,useSystemChoice,recoverManeuvers,choiceDailyUses,essentiaCapacity,settleDelayedDamage,supplementalResources,supplementalTerms,specialSpellFailure} from '../lib/class-systems.ts';
import {resetDaily,weaponDamage,weaponAttack,criticalConfirmation,sheetTotals} from '../lib/rules.ts';
import {equipmentCatalog} from '../lib/equipment.ts';
import {advancementChoices,recordAdvancementChoice} from '../lib/advancement-choices.ts';
import {expandSpellCatalog,learnClassList,unrecordedClassSpells} from '../lib/spell-catalog.ts';
const create=(kind,level=1)=>createPlayerCharacter({name:'Systems QA',kind,level,raceId:'human',scores:{STR:12,DEX:14,CON:18,INT:18,WIS:14,CHA:16},method:'manual'});
const choice=(c,classId,kind,level=1,more={})=>{const s={id:crypto.randomUUID(),classId,name:'QA ability',kind,level,readied:false,granted:false,spent:0,essentia:0,bound:false,totem:false,notes:'',...more};c.classSystems.choices.push(s);return s;};
const armor=(c,name,material)=>{const e=equipmentCatalog.find(x=>x.name===name);assert.ok(e);c.gear=[{id:crypto.randomUUID(),name,qty:1,weight:e.weight,carried:true,notes:'',catalogId:e.id,equipped:true,...(material?{material}:{})}];};
const terms=(c,target,ctx={})=>supplementalTerms(c,target,ctx).reduce((n,t)=>n+t.value,0);

test('granted feats are stable across recompute and do not spend advancement selections',()=>{
 const c=create('Artificer',14);const granted=c.features.filter(f=>f.ruleId?.startsWith('granted:'));assert.equal(granted.length,8);assert.ok(granted.some(f=>f.name==='Craft Wand'));
 recompute(c);assert.deepEqual(c.features.filter(f=>f.ruleId?.startsWith('granted:')),granted);
 const row=advancementChoices(c).find(r=>r.kind==='feat');assert.throws(()=>recordAdvancementChoice(c,row.key,granted[0].id),/Add the selected feat/);
 const d=create('Healer',2);assert.ok(d.features.some(f=>f.name==='Skill Focus'&&f.choice==='Heal'));
 c.classLevels[0].level=1;recompute(c);assert.equal(c.features.filter(f=>f.ruleId?.startsWith('granted:')).length,1);
});

test('managed uses survive changes and daily rests preserve craft reserve, weekly use and meld allocation',()=>{
 const c=create('Ninja',6),ki=c.features.find(f=>f.ruleId==='supp:ninja:Ki power');assert.equal(ki.max,5);ki.used=2;recompute(c);assert.equal(ki.used,2);
 choice(c,'ninja','invocation',1,{spent:2});c.classSystems.pools={'craft:6':50,'weekly:new-life':1,'infusion:1':2};c.classSystems.delayedDamage=4;
 const d=resetDaily(c);assert.equal(d.features.find(f=>f.id===ki.id).used,0);assert.deepEqual(d.classSystems.pools,{'craft:6':50,'weekly:new-life':1});assert.equal(d.classSystems.delayedDamage,4);assert.equal(c.classSystems.choices[0].spent,2);assert.equal(d.classSystems.choices[0].spent,0);
 const h=create('Healer',20);assert.ok(!h.features.some(f=>f.ruleId?.startsWith('supp:')&&/New life/i.test(f.name)));
});

test('maneuvers require readiness, recovery and crusader grants; multiclass levels advance initiator limits',()=>{
 const c=create('Crusader',1),s=choice(c,'crusader','maneuver');assert.throws(()=>useSystemChoice(c,s.id),/Ready/);s.readied=true;assert.throws(()=>useSystemChoice(c,s.id),/Ready/);s.granted=true;useSystemChoice(c,s.id);assert.equal(s.spent,1);assert.equal(s.granted,false);assert.throws(()=>useSystemChoice(c,s.id),/Ready/);recoverManeuvers(c,'crusader');assert.equal(s.spent,0);assert.equal(s.granted,false);
 c.classLevels.push({...create('Fighter',8).classLevels[0]});assert.equal(systemLimits(c,'crusader').initiator,5);assert.equal(systemLimits(c,'crusader').maxLevel,3);
 s.kind='mystery';assert.throws(()=>useSystemChoice(c,s.id),/level limit/);assert.ok(systemWarnings(c).some(w=>/different ability system/.test(w)));
});

test('Crusader counterstrike follows pool boundaries and settlement uses temporary HP first',()=>{
 const c=create('Crusader',20);for(const [pool,bonus] of [[0,0],[1,1],[9,1],[10,2],[14,2],[15,3],[30,6]]){c.classSystems.delayedDamage=pool;assert.equal(terms(c,'attack'),bonus);}
 c.automation.context.ownTurn=false;assert.equal(terms(c,'damage'),0);c.hp=20;c.tempHp=3;c.classSystems.delayedDamage=8;settleDelayedDamage(c);assert.equal(c.hp,15);assert.equal(c.tempHp,0);assert.equal(c.classSystems.delayedDamage,0);
});

test('mystery category transitions, Intelligence eligibility and at-will fundamentals are enforced',()=>{
 for(const [lv,uses] of [[6,1],[7,2],[13,3]]){const c=create('Shadowcaster',lv),s=choice(c,'shadowcaster','mystery',3);assert.equal(choiceDailyUses(c,s),uses);for(let i=0;i<uses;i++)useSystemChoice(c,s.id);assert.throws(()=>useSystemChoice(c,s.id),/No daily/);}
 const c=create('Shadowcaster',14),s=choice(c,'shadowcaster','fundamental',0,{spent:3});assert.equal(choiceDailyUses(c,s),Infinity);useSystemChoice(c,s.id);assert.equal(s.spent,3);const m=choice(c,'shadowcaster','mystery',7);c.scores.INT=16;assert.throws(()=>useSystemChoice(c,m.id),/Intelligence/);
});

test('incarnum limits use Constitution, combined HD, class increases and a shared pool',()=>{
 const c=create('Incarnate',3);const s=choice(c,'incarnate','soulmeld',0,{essentia:2});assert.equal(essentiaCapacity(c,s),2);c.classLevels.push({...create('Totemist',3).classLevels[0]});const t=choice(c,'totemist','soulmeld',0,{bound:true,totem:true,essentia:3});assert.equal(essentiaCapacity(c,s),3);assert.equal(essentiaCapacity(c,t),3);s.essentia=10;assert.ok(systemWarnings(c).some(w=>w.includes('combined class essentia')));assert.ok(systemWarnings(c).some(w=>w.includes('exceeds capacity')));c.scores.CON=11;assert.equal(systemLimits(c,'incarnate').known,1);
 const restored=characterSchema.parse(JSON.parse(JSON.stringify(resetDaily(c))));assert.equal(restored.classSystems.choices[1].essentia,3);assert.equal(restored.classSystems.choices[1].bound,true);
});

test('conditional passives honor armor, flat-footed state and ki depletion',()=>{
 const w=create('Warblade',1);assert.equal(terms(w,'save.ref'),1);w.classLevels[0].level=7;assert.equal(terms(w,'save.ref'),4);w.automation.context.flatFooted=true;assert.equal(terms(w,'save.ref'),0);
 const n=create('Ninja',6);assert.equal(terms(n,'save.will'),2);assert.equal(terms(n,'ac.misc'),3);assert.equal(terms(n,'skill.Jump'),6);n.features.find(f=>f.ruleId==='supp:ninja:Ki power').used=5;assert.equal(terms(n,'save.will'),0);armor(n,'Chain shirt');assert.equal(terms(n,'ac.misc'),0);assert.equal(terms(n,'skill.Jump'),2);
 const s=create('Swordsage',5);assert.equal(terms(s,'initiative'),2);assert.equal(terms(s,'ac.misc'),0);armor(s,'Chain shirt');assert.equal(terms(s,'ac.misc'),2);s.automation.context.helpless=true;assert.equal(terms(s,'ac.misc'),0);
 const sc=create('Scout',11);assert.equal(terms(sc,'save.fort'),2);assert.equal(terms(sc,'speed'),20);armor(sc,'Full plate');assert.equal(terms(sc,'save.fort'),0);assert.equal(terms(sc,'speed'),0);
});

test('precision dice are not multiplied on critical hits and Lurk starts at level two',()=>{
 const w=newWeapon();Object.assign(w,{damage:'1d6',damageAbility:'none',attackMode:'melee',proficiency:'yes'});
 const c=create('Scout',5);c.automation.context.skirmish=true;assert.equal(weaponDamage(c,w),'1d6+2d6');assert.equal(weaponDamage(c,w,true),'2d6+2d6');c.automation.context.ownTurn=false;assert.equal(weaponDamage(c,w),'1d6');c.automation.context.ownTurn=true;c.automation.context.precisionImmune=true;assert.equal(weaponDamage(c,w),'1d6');
 const n=create('Ninja',5);n.automation.context.flanking=true;assert.equal(weaponDamage(n,w),'1d6');n.automation.context.targetFlatFooted=true;assert.equal(weaponDamage(n,w),'1d6+3d6');w.attackMode='ranged';n.automation.context.distance=31;assert.equal(weaponDamage(n,w),'1d6');
 for(const [lv,dice] of [[1,0],[2,1],[6,1],[7,2],[17,4]]){const l=create('Lurk',lv);l.psionics[0].focused=true;assert.equal(resourceNumbers(l).sneakDice,dice);l.psionics[0].focused=false;assert.equal(resourceNumbers(l).sneakDice,0);}
});

test('Swashbuckler flanking and Warblade confirmation bonuses use the appropriate rolls',()=>{
 const c=create('Swashbuckler',8),w=newWeapon();w.proficiency='yes';const base=weaponAttack(c,w);c.automation.context.flanking=true;assert.equal(weaponAttack(c,w)-base,4);
 const wb=create('Warblade',3);assert.equal(criticalConfirmation(wb,w)-weaponAttack(wb,w),4);
});

test('armored casting exemptions apply per tradition and mithral effective category',()=>{
 const c=create('Duskblade',3);armor(c,'Breastplate');assert.equal(specialSpellFailure(c,'duskblade'),25);c.classLevels[0].level=4;assert.equal(specialSpellFailure(c,'duskblade'),0);assert.equal(specialSpellFailure(c,'wizard'),25);assert.equal(specialSpellFailure(c,'cleric'),0);
 const b=create('Beguiler');armor(b,'Breastplate','mithral');assert.equal(specialSpellFailure(b,'beguiler'),0);assert.equal(specialSpellFailure(b,'wizard'),15);
});

const read=name=>JSON.parse(readFileSync(new URL('../'+name,import.meta.url)));
const base=read('public/data/spells.json'),extensions=read('public/data/supplemental-spells.json'),catalog=expandSpellCatalog(base,extensions);
test('expanded catalog merges list facts without duplicating SRD spells or changing original levels',()=>{
 assert.equal(base.length,606);assert.equal(catalog.length,867);assert.equal(catalog.filter(s=>s.referenceOnly).length,261);assert.equal(new Set(catalog.map(s=>s.id)).size,867);
 for(const s of catalog)spellSchema.parse(s);
 for(const s of base){const merged=catalog.find(m=>m.id===s.id);for(const [list,level] of Object.entries(s.levels))assert.equal(merged.levels[list],level,s.name+' '+list);assert.equal(merged.description,s.description);}
 const detect=catalog.find(s=>s.id==='detect-magic');assert.equal(detect.levels['Dread Necromancer'],1);assert.equal(detect.levels['Sorcerer / Wizard'],0);
 assert.equal(catalog.find(s=>s.id==='restoration').levels.Healer,3);
 assert.equal(catalog.find(s=>s.id==='magic-missile').levels.Spellthief,undefined);
 assert.equal(catalog.find(s=>s.id==='charm-person').levels.Spellthief,1);
 assert.equal(catalog.find(s=>s.id==='cure-light-wounds').levels['Favored Soul'],1);
 assert.equal(catalog.find(s=>s.id==='entangle').levels['Spirit Shaman'],1);
});

test('fixed-list learning is eligible, idempotent, preserves usage and unlocks on advancement',()=>{
 const c=create('Beguiler'),p=c.casters[0];const missing=unrecordedClassSpells(c,p,catalog);assert.ok(missing.length>10);learnClassList(c,p,catalog);assert.equal(p.spells.length,missing.length);assert.equal(unrecordedClassSpells(c,p,catalog).length,0);p.slots[1].used=1;const ids=p.spells.map(s=>s.id);learnClassList(c,p,catalog);assert.deepEqual(p.spells.map(s=>s.id),ids);assert.equal(p.slots[1].used,1);assert.ok(p.spells.every(s=>s.level<=1));c.classLevels[0].level=4;recompute(c);assert.ok(unrecordedClassSpells(c,p,catalog).some(s=>s.levels.Beguiler===2));assert.equal(p.slots[1].used,1);assert.equal(unrecordedClassSpells(create('Wizard'),create('Wizard').casters[0],catalog).length,0);
 assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});

test('source index pagination is complete and old saves gain the new system defaults',()=>{
 const pages=read('lib/supplemental-spell-lists.json');assert.equal(pages.length,76);for(const p of pages)assert.equal(p.entries.length,p.total,p.id+' '+p.level);
 const c=create('Warlock');delete c.classSystems;const restored=characterSchema.parse(c);assert.deepEqual(restored.classSystems,{choices:[],pools:{},delayedDamage:0});
});

test('daily feature names do not create duplicate pools when milestone capitalization changes',()=>{
 for(const [kind,name,max] of [['Hexblade',"Hexblade's curse",5],['Soulborn','Smite opposition',5]]){const c=create(kind,20),resources=supplementalResources(c);assert.equal(resources.filter(r=>r.name.toLowerCase()===name.toLowerCase()).length,1);assert.equal(resources.find(r=>r.name===name).max,max);}
});
