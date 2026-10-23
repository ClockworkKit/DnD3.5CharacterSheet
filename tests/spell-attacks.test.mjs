import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {spellAttackProfile,spellAttackBonus,makeSpellAttackOnlyRoll} from '../lib/spell-attacks.ts';
import {makeSpellRoll,makeRequest,spendSpell,sheetTotals} from '../lib/rules.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {castDilettante,chooseDilettante} from '../lib/factotum.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const spells=JSON.parse(fs.readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const extras=JSON.parse(fs.readFileSync(new URL('../public/data/supplemental-spells.json',import.meta.url))).flatMap(x=>x.spell?[x.spell]:[]);
const spell=id=>structuredClone([...spells,...extras].find(s=>s.id===id));
const create=(kind='Wizard',level=11)=>createPlayerCharacter({name:'Spell attacks QA',kind,level,raceId:'human',scores:{STR:12,DEX:16,CON:12,INT:18,WIS:18,CHA:14},method:'manual'});
const known=id=>({id:'known-'+id,spellId:id,level:2,slotLevel:2,prepared:2,spent:0,notes:'',formula:'',custom:null});
const feat=(c,name)=>c.features.push({id:crypto.randomUUID(),name,kind:'Feat',description:'',source:'',used:0,max:0});
const save=c=>JSON.parse(JSON.stringify(c));

test('ray casts use BAB + Dexterity, not casting ability, and multi-rays each roll at full bonus',()=>{
 const c=create(),p=c.casters[0],s=spell('scorching-ray'),k=known(s.id),before=save(c);
 for(const [cl,count] of [[3,1],[6,1],[7,2],[10,2],[11,3],[20,3]]){
  const r=makeSpellRoll(c,{...p,level:cl},k,s,true);assert.equal(r.formula,undefined);assert.equal(r.rolls.length,count*2);
  assert.deepEqual(r.rolls.filter((_,i)=>i%2===0).map(x=>x.formula),Array(count).fill('1d20+'+(c.bab+3)));
  assert.deepEqual(r.rolls.filter((_,i)=>i%2).map(x=>x.formula),Array(count).fill('4d6'));
  assert.equal((makeRequest(r,c.name,'https://example.com/').message.match(/\[\[1d20/g)||[]).length,count);
 }
 assert.deepEqual(save(c),before);assert.equal(makeSpellRoll(c,p,k,s).rolls,undefined,'Post card must not roll');
});

test('hostile touch spells and inherited inflict descriptions use melee attacks; buffs and save-only spells do not',()=>{
 for(const id of ['shocking-grasp','vampiric-touch','touch-of-fatigue','bestow-curse','inflict-minor-wounds','inflict-moderate-wounds','inflict-critical-wounds','harm'])assert.equal(spellAttackProfile(spell(id),11).mode,'melee-touch',id);
 for(const id of ['fireball','magic-missile','shield','sanctuary','bless-water','gentle-repose','shillelagh','spellstaff','cure-light-wounds','cure-critical-wounds','inflict-light-wounds-mass','produce-flame','spectral-hand','dispel-evil'])assert.equal(spellAttackProfile(spell(id),11).mode,'none',id);
 const c=create(),s=spell('shocking-grasp');assert.equal(spellAttackBonus(c,s,11),c.bab+1);
 feat(c,'Weapon Finesse');assert.equal(spellAttackBonus(c,s,11),c.bab+3);
 assert.equal(spellAttackProfile(spell('cure-light-wounds'),11,{mode:'melee-touch',bonus:0}).mode,'melee-touch');
 assert.equal(spellAttackProfile(spell('inflict-light-wounds'),11,{mode:'none',bonus:0}).mode,'none');
});

test('spell attacks honor applicable ranged feats and conditions without weapon full-attack penalties',()=>{
 const c=create(),s=spell('scorching-ray'),base=spellAttackBonus(c,s,11);
 Object.assign(c.automation.context,{distance:20,targetInMelee:true,twoWeapon:true,offhandLight:false,rapidShot:true,flurry:true,charge:true,smite:true});
 feat(c,'Rapid Shot');assert.equal(spellAttackBonus(c,s,11),base-4);
 feat(c,'Point Blank Shot');feat(c,'Precise Shot');feat(c,'Weapon Focus (Ray)');assert.equal(spellAttackBonus(c,s,11),base+2);
 c.situational=-2;assert.equal(spellAttackBonus(c,s,11),base);
 assert.equal(spellAttackBonus(c,s,11,{mode:'auto',bonus:3}),base+3);
});

test('Spiritual Weapon uses BAB + Wisdom and only one normal-AC attack on casting',()=>{
 const c=create('Cleric'),p=c.casters[0],s=spell('spiritual-weapon'),k=known(s.id);
 c.size='Small';c.situational=5;c.globalCombat={enabled:true,attack:7,damage:8,extraDamage:''};
 Object.assign(c.automation.context,{flanking:true,charge:true,twoWeapon:true,powerAttack:5,combatExpertise:5});feat(c,'Power Attack');feat(c,'Combat Expertise');
 const r=makeSpellRoll(c,p,k,s,true);assert.equal(r.rolls.length,2);assert.equal(r.rolls[0].formula,'1d20+'+(c.bab+sheetTotals(c).mods.WIS));assert.equal(r.rolls[1].formula,'1d8+3');
});

test('compendium and custom spell attacks use the same route, including non-touch Splinterbolt',()=>{
 const c=create(),p=c.casters[0],s=spell('supp-splinterbolt'),k=known(s.id);
 const r=makeSpellRoll(c,p,k,s,true,'4d6');assert.equal(r.rolls.length,6);assert.match(r.rolls[0].label,/normal AC/);
 assert.equal(spellAttackProfile(spell('supp-shivering-touch'),11).mode,'melee-touch');
 assert.equal(spellAttackProfile(spell('supp-avasculate'),11).mode,'ranged-touch');
 const spittle=spell('supp-blinding-spittle');assert.equal(spellAttackProfile(spittle,11).mode,'ranged-touch');assert.equal(spellAttackBonus(c,spittle,11),c.bab+3-4);
 const custom={...spell('shield'),id:'custom',name:'Custom orb',description:'You must make a ranged touch attack to hit.'};
 assert.equal(spellAttackProfile(custom,11).mode,'ranged-touch');
 const override={mode:'ranged',count:2,bonus:-2};assert.equal(makeSpellRoll(c,p,{...k,attack:override},custom,true,'2d6').rolls.length,4);
 assert.throws(()=>spellAttackProfile(custom,11,{mode:'auto',count:999,bonus:0}));
});

test('Meteor Swarm separates four impact rolls from fire explosions and non-damaging rays still attack',()=>{
 const c=create(),p=c.casters[0],s=spell('meteor-swarm'),r=makeSpellRoll(c,p,known(s.id),s,true);
 assert.equal(r.rolls.length,12);assert.deepEqual(r.rolls.slice(1,3).map(x=>x.formula),['2d6','6d6']);
 const anchor=spell('dimensional-anchor'),a=makeSpellRoll(c,p,known(anchor.id),anchor,true);assert.equal(a.rolls.length,1);assert.match(a.rolls[0].formula,/1d20/);
 const drain=spell('energy-drain'),d=makeSpellRoll(c,p,known(drain.id),drain,true);assert.equal(d.rolls.length,2);assert.equal(d.rolls[1].formula,'2d4');
});

test('attack generation does not spend preparations; accepted casts spend once, not once per projectile',()=>{
 const c=create(),p=c.casters[0],s=spell('scorching-ray'),k=known(s.id);p.spells=[k];const before=save(c);
 makeSpellRoll(c,p,k,s,true);makeSpellAttackOnlyRoll(c,s,11);assert.deepEqual(save(c),before);
 Object.assign(p,spendSpell(p,k,c));assert.equal(p.spells[0].spent,1);
 const f=create('Factotum',8),ray=spell('scorching-ray');chooseDilettante(f,ray);const daily=save(f);
 assert.equal(makeDilettanteRoll(f,ray).rolls.length,4);assert.deepEqual(save(f),daily);
 castDilettante(f,ray.id);assert.equal(f.factotum.spent,1);assert.equal(f.factotum.spells[0].spent,true);
});

test('attack settings survive native/browser saves while old characters remain unchanged and resources stay spent',async()=>{
 const c=create(),p=c.casters[0],k=known('scorching-ray');k.attack={mode:'auto',count:2,bonus:3};k.spent=1;p.spells=[k];c.hp-=3;c.notes='Level-ups retained';
 const before=save(c),records=new Map(),api=createBrowserCharacterApi({scope:'attack-qa',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(save(await prepareCharacter(characterSchema.parse(backup))),before);
 const old=create();assert.deepEqual(save(characterSchema.parse(old)),save(old));
});
