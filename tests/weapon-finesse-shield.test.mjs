import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {addEquipment,matchEquipment,equippedArmor,gearEquipment} from '../lib/equipment.ts';
import {recompute} from '../lib/automation.ts';
import {weaponAttack,makeFullAttackRoll,criticalConfirmation,weaponDamage} from '../lib/rules.ts';
import {spellAttackBonus} from '../lib/spell-attacks.ts';
import {finesseShieldPenalty} from '../lib/weapon-finesse.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {reviewRoll20WeaponFinesse,chooseWeaponFinesse} from '../lib/roll20-weapon-finesse.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const feat=c=>c.features.push({id:'finesse',name:'Weapon Finesse',kind:'Feat',description:'',source:'',max:0,used:0});
const shield=c=>c.gear.find(g=>gearEquipment(g)?.kind==='shield');
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-25',character:{id:'finesse-test',name:'Finesse QA'},attributes:Object.entries({class1:'Factotum',level1:3,str:12,dex:18,hp:17,hp_max:22,feats:'Weapon Finesse',weapon1name:'Rapier',weapon1stat:'dex',weapon1range:'Melee',shieldname:'Heavy Steel Shield',shieldbonus:2,shieldcheckpenalty:2,...extra}).map(([name,current])=>({name,current,max:''}))});
const imported=async extra=>load(importRoll20(raw(extra)).character);
const legacy=async extra=>{const c=await imported(extra);delete c.roll20Import.weaponFinesse;return c;};
const review=c=>c.roll20Import.weaponFinesse[c.weapons[0].id];
function native(kind='Factotum',level=3){
 const c=createPlayerCharacter({name:'Finesse QA',kind,level,raceId:'human',scores:{STR:12,DEX:18,CON:12,INT:18,WIS:14,CHA:12},method:'manual'});
 feat(c);addEquipment(c,matchEquipment('Rapier','weapon'));addEquipment(c,matchEquipment('Shield, heavy steel','shield'));recompute(c);return c;
}

test('native finesse attacks include proficient shield ACP and automatically prefer Strength when it wins',()=>{
 const c=native(),w=c.weapons[0];assert.equal(finesseShieldPenalty(c),-2);assert.equal(weaponAttack(c,w),c.bab+2);
 c.scores.STR=16;assert.equal(weaponAttack(c,w),c.bab+3);
 w.ability='DEX';assert.equal(weaponAttack(c,w),c.bab+2,'explicit DEX remains explicit');
 w.ability='WIS';assert.equal(weaponAttack(c,w),c.bab+2,'custom ability is not finesse');
 c.features=[];w.ability='DEX';assert.equal(weaponAttack(c,w),c.bab+4,'no feat means manual DEX source');
});

test('ranged/thrown attacks and ineligible weapons do not acquire finesse ACP',()=>{
 const c=native(),w=c.weapons[0];w.ability='DEX';w.attackMode='ranged';assert.equal(weaponAttack(c,w),c.bab+4);
 for(const name of ['Longbow','Longsword']){addEquipment(c,matchEquipment(name,'weapon'));const next=c.weapons.at(-1);assert.equal(weaponAttack(c,next),c.bab+(name==='Longbow'?4:1));}
 for(const name of ['Dagger','Whip','Chain, spiked','Unarmed strike']){addEquipment(c,matchEquipment(name,'weapon'));const next=c.weapons.at(-1);next.proficiency='yes';next.attackMode='melee';assert.equal(weaponAttack(c,next),c.bab+2,name);}
});

test('materials, equipped flags and proficiency update once; armor and tower penalties stay separate',()=>{
 const c=native(),w=c.weapons[0],g=shield(c);w.ability='DEX';
 for(const props of [{masterwork:true},{masterwork:false,enhancement:1},{enhancement:0,material:'adamantine'}]){Object.assign(g,props);assert.equal(weaponAttack(c,w),c.bab+3);}
 g.material='mithral';assert.equal(weaponAttack(c,w),c.bab+4);
 g.material='standard';g.proficient=false;assert.equal(finesseShieldPenalty(c),0);assert.equal(weaponAttack(c,w),c.bab+2,'nonproficient ACP once');
 addEquipment(c,matchEquipment('Full plate','armor'));assert.equal(weaponAttack(c,w),c.bab+4-2-6);
 c.gear=c.gear.filter(g=>gearEquipment(g)?.kind!=='armor');g.proficient=true;
 for(const props of [{equipped:false},{equipped:true,carried:false},{carried:true,qty:0}]){Object.assign(g,props);assert.equal(weaponAttack(c,w),c.bab+4);}
 const tower=native('Fighter');addEquipment(tower,matchEquipment('Shield, tower','shield'));tower.weapons[0].ability='DEX';assert.equal(weaponAttack(tower,tower.weapons[0]),tower.bab+4-10-2);
});

test('full attacks, critical confirmations and touch spells share shield rules without mutating resources or damage',()=>{
 const c=native('Factotum',9),w=c.weapons[0];c.factotum.spent=2;c.hp-=3;const damage=weaponDamage(c,w),before=saved(c),first=c.bab+2;
 assert.equal(criticalConfirmation(c,w),first);
 assert.deepEqual(makeFullAttackRoll(c).rolls.filter(x=>x.formula.startsWith('1d20')).map(x=>x.formula),['1d20+'+first,'1d20+'+(first-5)]);
 const spell=JSON.parse(fs.readFileSync(new URL('../public/data/spells.json',import.meta.url))).find(s=>s.id==='shocking-grasp');
 assert.equal(spellAttackBonus(c,spell,9),first);assert.equal(weaponDamage(c,w),damage);assert.deepEqual(saved(c),before);
});

test('new formula imports apply a separate penalty; numeric DEX totals retain their included shield component',async()=>{
 const fresh=await imported(),fw=fresh.weapons[0];assert.equal(fw.ability,'DEX');assert.equal(review(fresh).mode,'automatic');assert.equal(weaponAttack(fresh,fw),fresh.bab+2);
 for(const total of [0,4,-2]){
  const c=await imported({weapon1attackcalc:total}),w=c.weapons[0];assert.equal(review(c).includedPenalty,-2);assert.equal(weaponAttack(c,w),total);
  shield(c).equipped=false;assert.equal(weaponAttack(c,w),total+2);
  shield(c).equipped=true;shield(c).masterwork=true;assert.equal(weaponAttack(c,w),total+1);
  c.scores.DEX+=2;assert.equal(weaponAttack(c,w),total+2);
 }
});

test('edited weapons, duplicate names, changed shield handling and numeric STR totals wait for a choice',async()=>{
 for(const change of [c=>{c.weapons[0].attack++;},c=>{c.weapons[0].name='Renamed rapier';},c=>{c.weapons.push({...c.weapons[0],id:'copy'});},c=>{shield(c).masterwork=true;},c=>{shield(c).equipped=false;},c=>{shield(c).proficient=false;}]){
  const c=await legacy({weapon1attackcalc:4});change(c);const before=saved(c),total=weaponAttack(c,c.weapons[0]);await reviewRoll20WeaponFinesse(c);
  assert.equal(review(c).mode,'review');assert.equal(weaponAttack(c,c.weapons[0]),total);const after=saved(c);after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
 }
 const str=await imported({weapon1stat:'str',weapon1attackcalc:4});assert.equal(review(str).mode,'review');
 const misc=await imported({weapon1enh:1});assert.equal(review(misc).mode,'review');
});

test('existing level-ups, equipment upgrades, HP and inspiration remain intact and the repair is idempotent',async()=>{
 const c=await legacy({weapon1attackcalc:4});c.classLevels[0].level=9;c.scores.DEX=20;recompute(c);c.hp-=3;c.factotum.spent=2;c.weapons[0].notes='Later session';c.notes='Do not reset';
 const before=saved(c),total=weaponAttack(c,c.weapons[0]),fixed=await load(c),after=saved(fixed);assert.equal(weaponAttack(fixed,fixed.weapons[0]),total);
 after.roll20Import=before.roll20Import;assert.deepEqual(after,before);assert.deepEqual(saved(await load(fixed)),saved(fixed));
});

test('included, separate and manual choices persist in native/browser saves; new weapons use live calculations',async()=>{
 const c=await imported({weapon1stat:'str',weapon1attackcalc:4}),w=c.weapons[0],misc=w.attack,old=weaponAttack(c,w);
 chooseWeaponFinesse(c,w.id,0);assert.equal(weaponAttack(c,w),old-2);
 chooseWeaponFinesse(c,w.id,-2);assert.equal(weaponAttack(c,w),old);
 chooseWeaponFinesse(c,w.id,null);assert.equal(weaponAttack(c,w),old);assert.equal(w.attack,misc);
 for(const value of [1,-101,NaN,Infinity])assert.throws(()=>chooseWeaponFinesse(c,w.id,value));
 const records=new Map(),api=createBrowserCharacterApi({scope:'finesse-shield',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})}),backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));
 assert.deepEqual(saved(await load(backup)),saved(c));addEquipment(c,matchEquipment('Dagger','weapon'));assert.equal(weaponAttack(c,c.weapons.at(-1)),c.bab+2);
});

test('manual mode, unreadable sources and missing class evidence do not silently alter saved attacks',async()=>{
 const c=await imported({weapon1attackcalc:4});c.automation.enabled=false;assert.equal(weaponAttack(c,c.weapons[0]),4);
 c.automation.enabled=true;delete c.roll20Import.weaponFinesse;c.roll20Import.raw={invalid:true};const before=weaponAttack(c,c.weapons[0]);await reviewRoll20WeaponFinesse(c);assert.equal(review(c).mode,'review');assert.equal(weaponAttack(c,c.weapons[0]),before);
 const missing=await legacy();missing.roll20Import.raw=raw({class1:'Unknown specialty',level1:0,level:3});await reviewRoll20WeaponFinesse(missing);assert.equal(review(missing).mode,'review');
 assert.equal(equippedArmor(c).nonproficient,0);
});
