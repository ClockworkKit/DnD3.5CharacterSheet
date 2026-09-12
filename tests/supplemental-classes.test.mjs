import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classCatalog,findClass,isClassSkill,spellSlots} from '../lib/classes.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {spellDC,castingProblem,spendSpell} from '../lib/rules.ts';
import {canManifest} from '../lib/psionics.ts';
import {gainLevel} from '../lib/level-up.ts';
import {advancementChoices} from '../lib/advancement-choices.ts';
import {equipmentCatalog,weaponProficient,armorProficient} from '../lib/equipment.ts';
const create=(kind,level=1)=>createPlayerCharacter({name:'Supplement QA',kind,level,raceId:'human',scores:{STR:12,DEX:14,CON:14,INT:18,WIS:14,CHA:16},method:'manual'});
const spell=(level=1)=>({id:'test',spellId:'test',level,slotLevel:level,prepared:1,spent:0,notes:'',formula:'',custom:null});

test('34 supplemental tables are complete and browser reference data matches calculation data',()=>{
 const defs=classCatalog.filter(d=>d.book);assert.equal(defs.length,34);
 const publicData=JSON.parse(readFileSync(new URL('../public/data/classes.json',import.meta.url)));
 for(const d of defs){assert.deepEqual(publicData.find(x=>x.id===d.id),d);assert.equal(d.levels.length,20);assert.ok(d.skills&&d.source&&d.description);
  for(const [i,r] of d.levels.entries()){assert.equal(r.level,i+1);assert.equal(r.bab,Math.floor(r.level*d.levels[19].bab/20),d.id+' BAB '+r.level);for(const save of ['fort','ref','will'])assert.equal(r[save],d.levels[0][save]===2?2+Math.floor(r.level/2):Math.floor(r.level/3),d.id+' '+save+' '+r.level);assert.equal(r.extra.length,d.headers.length,d.id+' columns '+r.level);if(r.slots)assert.ok(r.slots.length===10&&r.slots.every(v=>v===null||Number.isInteger(v)&&v>=0));}
 }
 assert.equal(findClass('Duskblade').levels[19].slots[5],6);
 assert.equal(findClass('Ninja').levels[0].special,'Ki power, sudden strike +1d6, trapfinding');
});

test('split casting abilities control eligibility, bonus slots and DC independently',()=>{
 const a=create('Archivist');assert.equal(a.casters[0].ability,'INT');assert.equal(a.casters[0].slots[1].max,3);
 a.scores.WIS=20;recompute(a);assert.equal(a.casters[0].slots[1].max,4);assert.equal(spellDC(a,a.casters[0],spell()),15);
 a.scores.INT=10;recompute(a);assert.equal(a.casters[0].slots[1].max,0);assert.match(castingProblem(a.casters[0],spell(),a),/INT/);
 const f=create('Favored Soul');assert.equal(f.casters[0].ability,'CHA');assert.equal(spellDC(f,f.casters[0],spell()),13);assert.equal(f.casters[0].slots[1].max,4);
 const s=create('Spirit Shaman');assert.equal(s.casters[0].ability,'WIS');assert.equal(spellDC(s,s.casters[0],spell()),14);
});

test('late spellcasting retains zero-base bonus slots and half caster levels',()=>{
 for(const kind of ['Hexblade','Spellthief']){const c=create(kind,3);assert.equal(c.casters[0].slots[1].max,0);assert.equal(c.casters[0].level,0);c.experience=6000;gainLevel(c,findClass(kind).id);recompute(c);assert.equal(c.casters[0].level,2);assert.equal(c.casters[0].slots[1].max,1);assert.equal(spellSlots(findClass(kind),4,10)[1].max,0);}
 const dn=create('Dread Necromancer');assert.equal(dn.casters[0].slots[0].max,0);assert.equal(dn.casters[0].slots[1].max,4);
});

test('new psionic classes use the right ability, Wild Talent and manifester limits',()=>{
 const a=create('Ardent');assert.equal(a.psionics[0].ability,'WIS');assert.equal(a.psionics[0].max,3);const power={id:'x',powerId:'x',name:'Test power',level:1,cost:1,formula:'',notes:''};assert.equal(canManifest(a,a.psionics[0],power),true);
 const d=create('Divine Mind');assert.equal(d.psionics[0].max,2);assert.equal(d.psionics[0].level,0);assert.equal(canManifest(d,d.psionics[0],power),false);
 const d5=create('Divine Mind',5);assert.equal(d5.psionics[0].level,1);assert.equal(d5.psionics[0].max,7);assert.equal(canManifest(d5,d5.psionics[0],power),true);
 const l=create('Lurk');assert.equal(l.psionics[0].ability,'INT');assert.equal(l.psionics[0].max,3);assert.equal(canManifest(l,l.psionics[0],power),true);
});

test('supplemental proficiencies respect melee restrictions, shields and armor progression',()=>{
 const w=(c,name)=>{const e=equipmentCatalog.find(e=>e.name===name);assert.ok(e,name);return weaponProficient(c,{catalogId:e.id,name,proficiency:'auto'});};
 const armor=(c,name)=>{const e=equipmentCatalog.find(e=>e.name===name);assert.ok(e,name);return armorProficient(c,e);};
 const wb=create('Warblade');assert.equal(w(wb,'Longsword'),true);assert.equal(w(wb,'Dagger'),true);assert.equal(w(wb,'Javelin'),false);assert.equal(w(wb,'Longbow'),false);
 assert.equal(w(create('Beguiler'),'Rapier'),true);assert.equal(w(create('Beguiler'),'Longsword'),false);
 assert.equal(w(create('Ninja'),'Shuriken (5)'),true);
 assert.equal(armor(create('Crusader'),'Shield, tower'),true);assert.equal(armor(wb,'Shield, tower'),false);
 assert.equal(armor(create('Warmage',7),'Breastplate'),false);assert.equal(armor(create('Warmage',8),'Breastplate'),true);
 assert.equal(armor(create('Warlock'),'Chain shirt'),true);assert.equal(armor(create('Warlock'),'Full plate'),false);
});

test('supplemental skills and earned bonus feats remain available after level-up and import',()=>{
 assert.equal(isClassSkill('Martial Lore',[findClass('Warblade')]),true);assert.equal(isClassSkill('Truespeak',[findClass('Truenamer')]),true);assert.equal(isClassSkill('Knowledge (arcana)',[findClass('Marshal')]),true);
 const c=create('Warblade',4);c.experience=10000;gainLevel(c,'warblade');recompute(c);
 assert.ok(advancementChoices(c).some(r=>r.label==='Warblade level 5 bonus feat'));
 assert.ok(c.skills.some(s=>s.name==='Martial Lore'&&s.classSkill));assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});

test('special systems do not receive ordinary spell slots, and new casters retain spent slots through advancement',()=>{
 for(const kind of ['Warlock','Artificer','Binder','Shadowcaster','Truenamer','Incarnate','Totemist','Dragonfire Adept','Swordsage']){const c=create(kind,20);assert.equal(c.casters.length,0,kind);assert.ok(c.features.some(f=>f.description.includes('manual')),kind);}
 const c=create('Beguiler');const p=c.casters[0];p.spells=[spell()];Object.assign(p,spendSpell(p,p.spells[0],c));c.experience=1000;gainLevel(c,'beguiler');recompute(c);assert.equal(p.slots[1].used,1);assert.equal(p.level,2);assert.equal(p.spells.length,1);assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});
