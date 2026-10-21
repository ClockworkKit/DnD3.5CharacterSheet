import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {armorProficient,equippedArmor,gearEquipment} from '../lib/equipment.ts';
import {weaponAttack,skillBonus,makeFullAttackRoll,criticalConfirmation} from '../lib/rules.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'shield-case-test',name:'Shield case test'},attributes:Object.entries({class1:'Cleric',level1:3,str:16,dex:14,hp:20,hp_max:24,weapon1name:'Morningstar',shieldname:'Tower Shield',shieldbonus:4,shieldcheckpenalty:9,...extra}).map(([name,current])=>({name,current,max:''}))});
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const create=async extra=>load(importRoll20(raw(extra)).character);
const shield=c=>c.gear.find(g=>gearEquipment(g)?.kind==='shield');
const feat=(c,name)=>c.features.push({id:name,name,kind:'Feat',description:'Player choice',source:'',max:0,used:0});

test('custom tower shields use the same proficiency and attack penalties regardless of label casing',async()=>{
 for(const name of ['Tower Shield','tower shield','TOWER SHIELD','Shield, Tower']){
  const c=await create({shieldname:name}),g=shield(c),w=c.weapons[0];
  assert.ok(g.armorStats);assert.equal(g.name,name);assert.equal(g.armorStats.checkPenalty,-9);
  assert.equal(armorProficient(c,gearEquipment(g)),false);assert.equal(equippedArmor(c).nonproficient,-9);assert.equal(equippedArmor(c).tower,-2);
  assert.equal(weaponAttack(c,w),-6);assert.equal(criticalConfirmation(c,w),-6);assert.equal(makeFullAttackRoll(c).rolls[0].formula,'1d20-6');
  assert.equal(skillBonus(c,c.skills.find(s=>s.name==='Ride')),-7);assert.deepEqual(c.roll20Import.raw,raw({shieldname:name}));
 }
});

test('fighter, crusader and Tower Shield Proficiency retain training but not immunity to tower encumbrance',async()=>{
 for(const extra of [{class1:'Fighter'},{class1:'Crusader'},{feats:'Tower Shield Proficiency'}]){
  const c=await create(extra);assert.equal(armorProficient(c,gearEquipment(shield(c))),true);
  assert.equal(equippedArmor(c).nonproficient,0);assert.equal(equippedArmor(c).tower,-2);
  assert.equal(weaponAttack(c,c.weapons[0]),c.bab+3-2);
 }
 const ordinary=await create({feats:'Shield Proficiency'});assert.equal(armorProficient(ordinary,gearEquipment(shield(ordinary))),false);
});

test('buckler-only and light-shield class training recognize custom mixed-case bucklers without granting tower shields',async()=>{
 for(const class1 of ['Urban Druid','Warmage'])for(const shieldname of ['buckler','BUCKLER',' Buckler ']){
  const c=await create({class1,shieldname,shieldbonus:1,shieldcheckpenalty:2});assert.equal(armorProficient(c,gearEquipment(shield(c))),true);
  assert.equal(equippedArmor(c).nonproficient,0);assert.equal(equippedArmor(c).tower,0);
 }
 for(const class1 of ['Urban Druid','Warmage']){const c=await create({class1});assert.equal(armorProficient(c,gearEquipment(shield(c))),false);}
});

test('Hit-and-Run removes tower training across classes until the player takes the proficiency feat',async()=>{
 const c=await create({class1:'Fighter',class2:'Crusader',level2:1});
 configureAlternateFeature(c,'fighter-drow-fighter',{reviewed:true});selectAlternateFeature(c,'fighter-drow-fighter',true);recompute(c);
 assert.equal(armorProficient(c,gearEquipment(shield(c))),false);assert.equal(equippedArmor(c).nonproficient,-9);
 feat(c,'Tower Shield Proficiency');recompute(c);assert.equal(armorProficient(c,gearEquipment(shield(c))),true);
 assert.equal(equippedArmor(c).nonproficient,0);
});

test('Krabi-Krabong shield training excludes custom tower shields independent of capitalization',async()=>{
 const c=await create({class1:'Monk'});
 configureAlternateFeature(c,'monk-weapon-proficiencies',{reviewed:true,choice:'Krabi-Krabong'});selectAlternateFeature(c,'monk-weapon-proficiencies',true);recompute(c);
 assert.equal(armorProficient(c,gearEquipment(shield(c))),false);
 shield(c).name='Heavy Steel Shield';assert.equal(armorProficient(c,gearEquipment(shield(c))),true);
});

test('explicit proficiency choices, equipment flags and material adjustments remain authoritative',async()=>{
 const c=await create(),g=shield(c);g.proficient=true;assert.equal(equippedArmor(c).nonproficient,0);
 g.proficient=false;g.masterwork=true;assert.equal(equippedArmor(c).nonproficient,-8);
 g.material='mithral';assert.equal(equippedArmor(c).nonproficient,-6);assert.equal(g.armorStats.checkPenalty,-9);
 for(const flag of ['equipped','carried']){g[flag]=false;assert.equal(equippedArmor(c).nonproficient,0);assert.equal(equippedArmor(c).tower,0);g[flag]=true;}
 g.qty=0;assert.equal(equippedArmor(c).nonproficient,0);assert.equal(equippedArmor(c).tower,0);
});

test('existing imported equipment, level-ups and spent resources survive normal load and native/browser round trips',async()=>{
 const c=await create();c.classLevels[0].level=5;recompute(c);c.hp-=3;c.notes='Later notes';
 c.casters[0].slots[1].used=2;shield(c).notes='Player annotation';shield(c).proficient=false;
 const before=saved(c),fixed=await load(c);assert.deepEqual(saved(fixed),before);
 assert.equal(weaponAttack(fixed,fixed.weapons[0]),fixed.bab+3-9-2);
 const records=new Map(),api=createBrowserCharacterApi({scope:'shield-casing',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:fixed})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),before);
});
