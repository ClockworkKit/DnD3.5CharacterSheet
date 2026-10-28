import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {trapSense} from '../lib/trap-sense.ts';
import {isTrapSave,isTrapAttack} from '../lib/trap-context.ts';
import {sheetTotals} from '../lib/rules.ts';
import {configureAlternateFeature} from '../lib/alternate-features.ts';
import {recompute} from '../lib/automation.ts';
import {characterSchema} from '../lib/model.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {gestaltFeatureLedger} from '../lib/gestalt-progression.ts';

const create=(kind='Rogue',level=6)=>createPlayerCharacter({name:'Trap defense QA',kind,level,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:12,WIS:16,CHA:10},method:'manual'});
const pairs=rows=>createPlayerCharacter({name:'Shared trap QA',kind:'Fighter',level:rows.length,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:12,WIS:16,CHA:10},method:'manual',advancementMode:'gestalt',gestaltPairs:rows});
const paired=(left,right,level)=>pairs(Array.from({length:level},()=>({left,right})));
const select=(c,id)=>c.alternateFeatures.selected.push(id);

test('Trap Sense honors each published class boundary and remains separate from Trapfinding',()=>{
 for(const id of ['rogue','barbarian','dwarven-defender'])for(let level=1;level<=(id==='dwarven-defender'?10:20);level++){
  const c=create('Fighter',1);c.classLevels=[{id:'source',classId:id,name:id,level,notes:''}];
  assert.equal(trapSense(c).bonus,Math.floor(level/(id==='dwarven-defender'?4:3)),id+' '+level);
 }
 assert.equal(trapSense(create('Rogue',1)).bonus,0);assert.equal(trapSense(create('Factotum',20)).bonus,0);
});

test('trap attack and save contexts are independent; Trap Sense affects only Reflex and dodge AC',()=>{
 const c=create(),base=sheetTotals(c);assert.equal(base.ac,14);
 c.automation.context.saveAgainst='trap';let t=sheetTotals(c);
 assert.equal(t.ac,base.ac);assert.equal(t.saves.ref,base.saves.ref+2);assert.equal(t.saves.fort,base.saves.fort);assert.equal(t.saves.will,base.saves.will);
 c.automation.context.trapAttack=true;c.automation.context.saveAgainst='poison';t=sheetTotals(c);
 assert.equal(t.ac,16);assert.equal(t.touch,16);assert.equal(t.flat,16);assert.equal(t.saves.ref,base.saves.ref);
 c.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(c).ac,16,'Uncanny Dodge retains dodge');
 c.automation.context.flatFooted=true;assert.equal(sheetTotals(c).ac,10);
 c.automation.context.flatFooted=false;c.automation.context.helpless=true;assert.equal(sheetTotals(c).ac,10);
 const early=create('Rogue',3);early.automation.context.trapAttack=true;assert.equal(sheetTotals(early).flat,10,'no Uncanny Dodge yet');
 c.automation.enabled=false;c.automation.context.helpless=false;assert.equal(sheetTotals(c).ac,14);
});

test('ordinary Trap Sense sources stack but parallel gestalt selects one progression and replacements remove only their own source',()=>{
 const c=create();c.classLevels.push({id:'barb',classId:'barbarian',name:'Barbarian',level:6,notes:''});assert.equal(trapSense(c).bonus,4);
 for(let level=1;level<=20;level++)for(const pair of [['rogue','barbarian'],['barbarian','rogue']])assert.equal(trapSense(paired(...pair,level)).bonus,Math.floor(level/3));
 const g=paired('rogue','barbarian',9);select(g,'rogue-deaths-ruin');assert.equal(trapSense(g).bonus,3);assert.deepEqual(trapSense(g).sources.map(s=>s.classId),['barbarian']);
 select(g,'barbarian-trapkiller');assert.equal(trapSense(g).bonus,0);
});

test('nonoverlapping and staggered gestalt grants use the existing discrete feature convention',()=>{
 const serial=pairs([...Array.from({length:3},()=>({left:'rogue',right:'fighter'})),...Array.from({length:3},()=>({left:'barbarian',right:'fighter'}))]);
 assert.equal(trapSense(serial).bonus,2);
 const offset=pairs([{left:'rogue',right:'fighter'},...Array.from({length:8},()=>({left:'rogue',right:'barbarian'}))]);
 assert.equal(trapSense(offset).bonus,3,'do not alternate rounded grants into a faster progression');
 offset.gestaltProgression.bonusMethod='fractional-v1';assert.equal(trapSense(offset).bonus,3);
});

test('slower Dwarven Defender Trap Sense does not add an overlapping grant to the rogue progression',()=>{
 const g=paired('rogue','fighter',11),fighter=g.classLevels.find(e=>e.classId==='fighter');fighter.level=7;
 g.classLevels.push({id:'defender',classId:'dwarven-defender',name:'Dwarven Defender',level:4,notes:''});
 for(const row of g.gestaltProgression.levels.slice(7))row.right='defender';
 assert.equal(trapSense(g).bonus,3);assert.deepEqual(trapSense(g).sources.map(s=>s.amount),[3,1]);
 const standard=structuredClone(g);standard.advancementMode='standard';assert.equal(trapSense(standard).bonus,4);
});

test('True Thief requires focus and caps at +3; capped progression cannot suppress a still-advancing source',()=>{
 const c=create('Lurk',20);select(c,'lurk-true-thief');c.psionics[0].spent=3;
 assert.equal(trapSense(c).bonus,0);assert.equal(trapSense(c).focusRequired,true);c.psionics[0].focused=true;
 for(const [level,bonus] of [[4,0],[5,1],[7,1],[8,2],[10,2],[11,3],[20,3]]){c.classLevels[0].level=level;assert.equal(trapSense(c).bonus,bonus);}
 assert.equal(c.psionics[0].spent,3);
 const g=pairs([...Array.from({length:6},()=>({left:'lurk',right:'fighter'})),...Array.from({length:8},()=>({left:'lurk',right:'rogue'}))]);
 select(g,'lurk-true-thief');g.psionics[0].focused=true;
 assert.equal(trapSense(g).bonus,4,'Lurk reaches +3, then rogue contributes at its sixth class level');
 assert.throws(()=>gestaltFeatureLedger(g,{lurk:{rate:()=>NaN,cumulative:l=>l}}),/progression policy/);
});

test('Dungeon Crasher uses the visible trap selector, affects all saves, and is a nonstacking competence bonus',()=>{
 for(const [level,bonus] of [[2,2],[6,4]]){
  const c=create('Fighter',level);select(c,'fighter-dungeon-crasher');const base=sheetTotals(c);
  c.automation.context.saveAgainst='trap';let t=sheetTotals(c);for(const k of ['fort','ref','will'])assert.equal(t.saves[k],base.saves[k]+bonus);assert.equal(t.ac,base.ac);
  c.automation.context.trapAttack=true;c.automation.context.saveAgainst='';t=sheetTotals(c);assert.equal(t.ac,base.ac+bonus);assert.deepEqual(t.saves,base.saves);
  c.automation.context.flatFooted=true;assert.equal(sheetTotals(c).ac,10+bonus,'competence AC remains when dodge is denied');
  c.automation.context.saveAgainst='trap';c.effects.push({id:'other',name:'Other competence',preset:'',active:true,permanent:false,casterLevel:0,rounds:0,notes:'',modifiers:[{target:'saves',type:'competence',value:'5',when:''},{target:'ac.misc',type:'competence',value:'5',when:''}]});
  assert.equal(sheetTotals(c).saves.ref,base.saves.ref+5);assert.equal(sheetTotals(c).ac,15);
 }
});

test('Relic Hunter stacks its separate Reflex bonus with Trap Sense, never AC or other saves',()=>{
 const c=paired('cleric','rogue',6);configureAlternateFeature(c,'cleric-no-turning',{choice:'Relic Hunter'});select(c,'cleric-no-turning');
 const base=sheetTotals(c);c.automation.context.saveAgainst='trap';const t=sheetTotals(c);
 assert.equal(t.saves.ref,base.saves.ref+6);assert.equal(t.saves.fort,base.saves.fort);assert.equal(t.saves.will,base.saves.will);assert.equal(t.ac,base.ac);
});

test('legacy plural context remains readable, explicit controls override it, and save/load preserves injuries and expenditure',async()=>{
 const c=paired('rogue','barbarian',6);c.hp-=4;c.factotum.spent=2;c.automation.context.saveAgainst='traps';recompute(c);
 assert.equal(isTrapSave('trap'),true);assert.equal(isTrapSave('traps'),true);assert.equal(isTrapAttack(c),true);
 assert.equal('trapAttack' in characterSchema.parse(c).automation.context,false);
 const before=structuredClone(c);trapSense(c);sheetTotals(c);assert.deepEqual(c,before);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));assert.deepEqual(loaded,c);assert.equal(loaded.maxHp-loaded.hp,4);assert.equal(loaded.factotum.spent,2);
 loaded.automation.context.trapAttack=false;assert.equal(isTrapAttack(loaded),false);assert.equal(sheetTotals(loaded).ac,14);assert.equal(sheetTotals(loaded).saves.ref,sheetTotals({...loaded,automation:{...loaded.automation,context:{...loaded.automation.context,saveAgainst:''}}}).saves.ref+2);
 assert.deepEqual(await prepareCharacter(characterSchema.parse(loaded)),loaded);
});
