import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {featEligibility,featChoices,prestigeEligibility,addEligibleFeat} from '../lib/prerequisites.ts';
import {hasFeat} from '../lib/effects.ts';
import {classCatalog,findClass} from '../lib/classes.ts';
import {characterSchema} from '../lib/model.ts';
import {gainLevel,levelUpClasses} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';
const feats=JSON.parse(readFileSync(new URL('../public/data/feats.json',import.meta.url)));
const feat=id=>feats.find(f=>f.id===id);
const create=(kind='Fighter',level=1)=>createPlayerCharacter({name:'Eligibility QA',kind,level,raceId:'human',method:'manual',scores:{STR:14,DEX:14,CON:14,INT:14,WIS:14,CHA:14}});
const grant=(c,name,choice='')=>c.features.push({id:crypto.randomUUID(),name,choice,kind:'Feat',description:'',max:0,used:0,source:''});
const ranks=(c,name,n)=>{let s=c.skills.find(s=>s.name===name);if(!s){s={id:crypto.randomUUID(),name,ability:'INT',ranks:0,misc:0,trained:false,armor:0,classSkill:false};c.skills.push(s)}s.ranks=n;};
const qualify=(c,id)=>prestigeEligibility(c,findClass(id));

test('feat chains normalize imported category tags, punctuation, and weapon choices',()=>{
 const c=create();assert.equal(featEligibility(c,feat('cleave')).eligible,false);grant(c,'Power Attack [General]');assert.equal(hasFeat(c,'Power Attack'),true);assert.equal(featEligibility(c,feat('cleave')).eligible,true);
 grant(c,'Ride-By Attack [General]');assert.equal(hasFeat(c,'Ride-By Attack'),true);grant(c,'Weapon Focus (Longbow) [General]');assert.equal(hasFeat(c,'Weapon Focus','longbow'),true);
 c.scores.STR=12;c.temps.STR=4;assert.equal(featEligibility(c,feat('cleave')).eligible,false);
});
test('BAB and class levels use class progression, skills use ranks rather than total bonus',()=>{
 const c=create('Wizard',1);assert.equal(featEligibility(c,feat('quick-draw')).eligible,false);c.skills.find(s=>s.name==='Ride').misc=20;assert.equal(featEligibility(c,feat('mounted-combat')).eligible,false);ranks(c,'Ride',1);assert.equal(featEligibility(c,feat('mounted-combat')).eligible,true);
 const f=create('Fighter',4);grant(f,'Weapon Focus [General]','Longsword');assert.equal(featEligibility(f,feat('weapon-specialization'),'Longsword').eligible,true);assert.equal(featEligibility(f,feat('weapon-specialization'),'Longbow').eligible,false);
});
test('weapon proficiency, exotic strength restriction and Greater Spell Focus match the selection',()=>{
 const c=create('Wizard',4);assert.equal(featEligibility(c,feat('weapon-focus'),'Longsword').eligible,false);assert.equal(featEligibility(c,feat('weapon-focus'),'Dagger').eligible,true);
 assert.equal(featEligibility(c,feat('greater-spell-focus'),'Evocation').eligible,false);grant(c,'Spell Focus [General]','Conjuration');assert.equal(featEligibility(c,feat('greater-spell-focus'),'Evocation').eligible,false);assert.equal(featEligibility(c,feat('greater-spell-focus'),'Conjuration').eligible,true);
 c.scores.STR=12;assert.equal(featEligibility(c,feat('exotic-weapon-proficiency'),'Sword, bastard').eligible,false);
});
test('class-granted armor and feats count; repeatable feats and distinct choices remain available',()=>{
 const c=create('Wizard');addEligibleFeat(c,feat('feat-descriptions--armor-proficiency-light'));assert.equal(featEligibility(c,feat('armor-proficiency-medium')).eligible,true);assert.equal(featEligibility(c,feat('feat-descriptions--armor-proficiency-light')).eligible,false);
 const f=create();assert.equal(featEligibility(f,feat('feat-descriptions--armor-proficiency-heavy')).eligible,false);addEligibleFeat(f,feat('toughness'));assert.equal(featEligibility(f,feat('toughness')).eligible,true);
 addEligibleFeat(f,feat('weapon-focus'),'Longbow');assert.equal(featEligibility(f,feat('weapon-focus'),'Longbow').eligible,false);assert.equal(featEligibility(f,feat('weapon-focus'),'Longsword').eligible,true);
 const m=create('Monk');assert.equal(featEligibility(m,feat('deflect-arrows')).eligible,true);
});
test('invalid feat additions leave character intact and selected choices save canonically',()=>{
 const c=create();const before=structuredClone(c);assert.throws(()=>addEligibleFeat(c,feat('whirlwind-attack')));assert.deepEqual(c,before);
 addEligibleFeat(c,feat('weapon-focus'),'Longbow');assert.equal(c.features.at(-1).name,'Weapon Focus');assert.equal(c.features.at(-1).choice,'Longbow');assert.equal(hasFeat(c,'Weapon Focus','Longbow'),true);
});
test('prestige ranks, racial variants and abbreviated alignments are checked',()=>{
 const c=create('Fighter',7);c.ancestry.raceId='hill-dwarf';c.race='Dwarf';c.alignment='LG';for(const f of ['Dodge','Endurance','Toughness'])grant(c,f);assert.equal(qualify(c,'dwarven-defender').eligible,true);c.alignment='CG';assert.equal(qualify(c,'dwarven-defender').eligible,false);c.alignment='';assert.equal(qualify(c,'dwarven-defender').eligible,false);
 ranks(c,'Knowledge (geography)',7);c.skills.find(s=>s.name==='Knowledge (geography)').misc=30;assert.equal(qualify(c,'horizon-walker').eligible,false);ranks(c,'Knowledge (geography)',8);assert.equal(qualify(c,'horizon-walker').eligible,true);
});
test('story confirmations persist, can be cleared, and never override failed numeric prerequisites',()=>{
 const c=create('Rogue',5);c.alignment='NE';ranks(c,'Disguise',4);ranks(c,'Hide',8);ranks(c,'Move Silently',8);
 const p=qualify(c,'assassin');assert.equal(p.status,'Needs confirmation');const key=p.requirements.find(r=>r.state==='confirm').key;c.prerequisiteConfirmations[key]=true;assert.equal(qualify(c,'assassin').eligible,true);
 const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));assert.equal(qualify(saved,'assassin').eligible,true);ranks(saved,'Hide',7);assert.equal(qualify(saved,'assassin').eligible,false);delete c.prerequisiteConfirmations[key];assert.equal(qualify(c,'assassin').eligible,false);
 delete c.prerequisiteConfirmations;assert.deepEqual(characterSchema.parse(c).prerequisiteConfirmations,{});
});
test('multiclass prestige requires both spell traditions and does not depend on remaining slots',()=>{
 const c=create('Wizard',3),cleric=create('Cleric',3);c.classLevels.push(...cleric.classLevels);c.casters.push(...cleric.casters);recompute(c);ranks(c,'Knowledge (arcana)',6);ranks(c,'Knowledge (religion)',6);assert.equal(qualify(c,'mystic-theurge').eligible,true);
 for(const p of c.casters)for(const s of p.slots)s.used=s.max;assert.equal(qualify(c,'mystic-theurge').eligible,true);c.classLevels=c.classLevels.filter(e=>e.classId!=='cleric');c.casters=c.casters.filter(p=>p.name!=='Cleric');assert.equal(qualify(c,'mystic-theurge').eligible,false);
});
test('XP level-up filters and rechecks prestige entry before mutation, but preserves existing advancement',()=>{
 const c=create('Fighter',7);c.experience=100000;assert.equal(levelUpClasses(c).some(d=>d.id==='horizon-walker'),false);assert.equal(levelUpClasses(c,true).some(d=>d.id==='horizon-walker'),true);const before=structuredClone(c);assert.throws(()=>gainLevel(c,'horizon-walker'),/prerequisites/);assert.deepEqual(c,before);
 grant(c,'Endurance');ranks(c,'Knowledge (geography)',8);assert.equal(levelUpClasses(c).some(d=>d.id==='horizon-walker'),true);gainLevel(c,'horizon-walker');recompute(c);ranks(c,'Knowledge (geography)',0);gainLevel(c,'horizon-walker');assert.equal(c.classLevels.find(e=>e.classId==='horizon-walker').level,2);
});
test('metamagic categories and divine list availability qualify advanced casters',()=>{
 const c=create('Cleric',13);c.scores.WIS=20;recompute(c);ranks(c,'Knowledge (religion)',15);assert.equal(qualify(c,'hierophant').eligible,false);grant(c,'Extend Spell');assert.equal(qualify(c,'hierophant').eligible,true);
 grant(c,'Spell Focus','Conjuration');assert.equal(qualify(c,'thaumaturgist').eligible,true);
});
test('every catalog feat and prestige class returns a defined result and no mutations',()=>{
 const c=create('Wizard',20),before=structuredClone(c);
 for(const f of feats)for(const choice of featChoices(c,f).length?featChoices(c,f):[''])assert.ok(['Eligible','Missing prerequisites','Needs confirmation'].includes(featEligibility(c,f,choice).status));
 for(const d of classCatalog.filter(d=>d.kind==='Prestige'))assert.ok(prestigeEligibility(c,d).requirements.length>0,d.id);
 assert.deepEqual(c,before);
});

test('psionic entry uses power level and manifester level, not only a power point reserve',()=>{
 const c=create('Psion',3);ranks(c,'Concentration',8);grant(c,'Mobility');grant(c,'Spring Attack');assert.equal(qualify(c,'elocater').eligible,false);
 c.classLevels[0].level=6;recompute(c);ranks(c,'Concentration',8);assert.equal(qualify(c,'elocater').eligible,true);
 const s=create('Soulknife',6);ranks(s,'Concentration',8);grant(s,'Mobility');grant(s,'Spring Attack');assert.equal(qualify(s,'elocater').eligible,false);
});
test('feat tags retain their numeric effects and spell-like caster levels support crafting prerequisites',()=>{
 const c=create();grant(c,'Toughness [General]');const hp=c.maxHp;recompute(c);assert.equal(c.maxHp,hp+3);
 const w=create('Warlock',5);assert.equal(featEligibility(w,feat('craft-wondrous-item')).eligible,true);assert.equal(featEligibility(w,feat('forge-ring')).eligible,false);
});
test('catalog indices stay synchronized with feat categories and spell metadata',()=>{
 const index=JSON.parse(readFileSync(new URL('../lib/prerequisite-catalog.json',import.meta.url)));
 assert.deepEqual(index.feats,feats.map(({id,name})=>({id,name})));
 assert.equal(index.spells.length,867);
});
