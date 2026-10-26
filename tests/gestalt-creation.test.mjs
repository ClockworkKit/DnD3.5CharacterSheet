import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {createNpcSheet} from '../lib/creatures.ts';
import {baseClasses,findClass} from '../lib/classes.ts';
import {raceCatalog} from '../lib/ancestry.ts';
import {recompute} from '../lib/automation.ts';
import {advancementNumbers} from '../lib/advancement.ts';
import {advancementChoices} from '../lib/advancement-choices.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {skillLedger,setSkillPoints} from '../lib/skill-points.ts';
import {characterSchema} from '../lib/model.ts';
import {optionalRuleSettings} from '../lib/character-rules.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';

const options={name:'Fresh paired QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:14,CHA:12},method:'manual'};
const pairs=(left,right,n)=>Array.from({length:n},()=>({left,right}));
const create=(plan=pairs('fighter','wizard',1),extra={})=>createPlayerCharacter({...options,advancementMode:'gestalt',level:plan.length,gestaltPairs:plan,...extra});

test('new paired Fighter/Wizard uses actual levels and standard defaults without sample possessions',()=>{
 const c=create(pairs('fighter','wizard',5),{hpRolls:[1,4,7,10]}),n=advancementNumbers(c);
 assert.equal(c.advancementMode,'gestalt');assert.equal(c.gestaltProgression.bonusMethod,'printed-table-v1');assert.equal(c.level,5);assert.equal(c.experience,10000);
 assert.deepEqual(c.classLevels.map(e=>[e.classId,e.level]),[['fighter',5],['wizard',5]]);
 assert.equal(c.maxHp,42);assert.equal(c.hp,42);assert.equal(c.bab,5);assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[4,1,4]);
 assert.equal(n.skillBudget,48);assert.equal(n.feats,3);assert.equal(n.abilityIncreases,1);assert.equal(n.fighterFeats,3);assert.equal(n.wizardFeats,1);
 assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),[10,1,4,7,10]);assert.equal(c.automation.history.length,5);
 assert.deepEqual(optionalRuleSettings(c),[]);assert.deepEqual(c.weapons,[]);assert.deepEqual(c.gear,[]);assert.equal(c.defense.armor,0);assert.deepEqual(c.coins,{cp:0,sp:0,gp:0,pp:0});
 assert.ok(c.features.some(f=>f.name==='Fighter class features'));assert.ok(c.features.some(f=>f.name==='Wizard class features'));
 assert.equal(c.casters.length,1);assert.equal(c.casters[0].level,5);assert.deepEqual(c.casters[0].spells,[]);assert.ok(c.skills.every(s=>s.ranks===0));
 assert.equal(c.notes.match(/maximum first Hit Die/g).length,1);assert.ok(c.notes.includes('Starting paired Hit Dice'));assert.deepEqual(characterSchema.parse(c),c);
});

test('Ranger/Rogue creation unions class skills and uses one first-level multiplier',()=>{
 const c=create(pairs('ranger','rogue',3),{hpRolls:[4,4]});assert.equal(advancementNumbers(c).skillBudget,72);
 for(const name of ['Survival','Use Magic Device','Search']){
  const skill=c.skills.find(s=>s.name===name);assert.ok(skill.classSkill,name);setSkillPoints(c,c.automation.history[0].key,skill.id,4);
 }
 assert.equal(skillLedger(c).spent,12);assert.ok(c.features.some(f=>f.name==='Ranger class features'));assert.ok(c.features.some(f=>f.name==='Rogue class features'));
});

test('fresh Wizard/Cleric and psionic pairs retain independent traditions',()=>{
 const divine=create(pairs('wizard','cleric',5),{hpMethod:'average'});
 assert.deepEqual(divine.casters.map(p=>[p.casting.classId,p.level]),[['wizard',5],['cleric',5]]);assert.equal(divine.psionics.length,0);
 assert.equal(divine.casters[0].ability,'INT');assert.equal(divine.casters[1].ability,'WIS');assert.ok(divine.casters.every(p=>p.spells.length===0&&p.slots.every(s=>s.used===0)));
 const psychic=create(pairs('psion','wilder',2),{hpRolls:[4]});assert.equal(psychic.psionics.length,2);assert.ok(psychic.psionics.every(p=>p.level===2&&p.spent===0&&p.powers.length===0));
});

test('either starting side may change classes, retaining order and actual-level choices',()=>{
 const plan=[...pairs('fighter','wizard',2),{left:'cleric',right:'rogue'},{left:'wizard',right:'cleric'}];
 const c=create(plan,{hpRolls:[3,4,5]});
 assert.deepEqual(c.classLevels.map(e=>[e.classId,e.level]),[['fighter',2],['wizard',3],['cleric',2],['rogue',1]]);
 assert.deepEqual(hitDieSequence(c).map(r=>r.classIds),plan.map(p=>[p.left,p.right]));assert.equal(c.level,4);
 assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,1);assert.equal(c.casters.length,2);
 const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);
});

test('invalid starting plans fail without mutating supplied choices or silently changing modes',()=>{
 const plan=pairs('fighter','wizard',2),before=structuredClone(plan);
 for(const extra of [{level:1},{level:0},{gestaltPairs:undefined},{gestaltBonusMethod:'unknown'},{hpRolls:[11]},{hpRolls:[]},{hpMethod:'average',hpRolls:[3]}])assert.throws(()=>create(plan,extra));
 for(const pair of [{left:'fighter',right:'fighter'},{left:'missing',right:'wizard'},{left:'Fighter',right:'wizard'},{left:'fighter',right:'eldritch-knight'}])assert.throws(()=>create([pair]));
 const racial=raceCatalog.find(r=>r.rhd>0);assert.throws(()=>create(plan,{raceId:racial.id}),/racial Hit Dice/);
 assert.throws(()=>createPlayerCharacter({...options,gestaltPairs:plan}),/explicit gestalt/);
 assert.throws(()=>createPlayerCharacter({...options,gestaltBonusMethod:'fractional-v1'}),/explicit gestalt/);
 assert.throws(()=>create(plan,{clericSpecialty:'axe-brother'}),/requires cleric/);assert.deepEqual(plan,before);
});

test('optional HP, fractional bonuses, level adjustment and cleric specialty remain independent',()=>{
 const plan=[{left:'rogue',right:'wizard'},{left:'bard',right:'sorcerer'}];
 const normal=create(plan,{hpRolls:[1]}),fractional=create(plan,{hpRolls:[1],gestaltBonusMethod:'fractional-v1'});
 assert.equal(normal.bab,0);assert.equal(fractional.bab,1);assert.equal(normal.maxHp,fractional.maxHp);
 const maximum=create(pairs('fighter','wizard',3),{hpMethod:'maximum'}),average=create(pairs('fighter','wizard',3),{hpMethod:'average'});
 assert.equal(maximum.maxHp,36);assert.equal(average.maxHp,27);assert.equal(maximum.automation.encumbrance,true);assert.equal(average.gestaltProgression.bonusMethod,'printed-table-v1');
 const drow=create(pairs('fighter','wizard',5),{raceId:'drow',hpMethod:'maximum'});assert.equal(drow.level,5);assert.equal(advancementNumbers(drow).ecl,7);assert.equal(drow.experience,21000);
 const axe=create(pairs('wizard','cleric',2),{raceId:'dwarf',clericSpecialty:'axe-brother',hpRolls:[4]});assert.equal(axe.clericSpecialty,'axe-brother');assert.equal(axe.classLevels.find(e=>e.classId==='cleric').level,2);assert.equal(axe.casters.find(p=>p.casting.classId==='cleric'&&!p.casting.domain).level,2);
 assert.equal(createPlayerCharacter(options).advancementMode,'standard');assert.equal(createPlayerCharacter(options).gestaltProgression,undefined);
});

test('every selectable base class can occupy either starting side without duplicated profiles or unstable data',()=>{
 for(const def of baseClasses){
  const other=def.id==='fighter'?'wizard':'fighter';
  for(const pair of [{left:def.id,right:other},{left:other,right:def.id}]){
   const c=create([pair]),before=structuredClone(c);assert.equal(c.level,1,def.name);assert.equal(c.maxHp,Math.max(def.hitDie,findClass(other).hitDie)+2,def.name);
   assert.equal(new Set(c.casters.map(p=>p.casting.classId)).size,c.casters.length);assert.equal(new Set(c.psionics.map(p=>p.manifesting.classId)).size,c.psionics.length);
   recompute(c);assert.deepEqual(c,before,def.name);
  }
 }
});

test('created paired NPCs save/load/export and advance without losing damage, training or expenditures',async()=>{
 const c=createNpcSheet({...options,advancementMode:'gestalt',level:2,gestaltPairs:pairs('wizard','cleric',2),hpRolls:[3]});assert.equal(c.sheetKind,'npc');
 c.hp-=2;c.casters.forEach(p=>p.slots[1].used=1);const skill=c.skills.find(s=>s.name==='Concentration');setSkillPoints(c,c.automation.history[0].key,skill.id,4);
 c.experience=3000;const before=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left:'wizard',right:'cleric',hitDieRoll:5}));recompute(c,before);
 assert.equal(c.level,3);assert.equal(c.maxHp-c.hp,2);assert.equal(skillLedger(c).spent,4);assert.deepEqual(c.casters.map(p=>p.slots[1].used),[1,1]);
 const values=new Map(),api=createBrowserCharacterApi({scope:'paired-creation',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})}),saved=(await api('/api/characters/'+record.id)).data;
 const restored=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:saved})));assert.deepEqual(restored,c);
 const random=create(pairs('fighter','wizard',5));const rolls=random.automation.history.map(h=>h.hitDieRoll);assert.equal(rolls[0],10);assert.ok(rolls.every(n=>n>=1&&n<=10));await prepareCharacter(random);assert.deepEqual(random.automation.history.map(h=>h.hitDieRoll),rolls);
});
