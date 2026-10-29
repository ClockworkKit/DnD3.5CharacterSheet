import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {createNpcSheet} from '../lib/creatures.ts';
import {customClassDraft,customClassTable} from '../lib/custom-class-editor.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {skillLedger} from '../lib/skill-points.ts';
import {optionalRuleSettings} from '../lib/character-rules.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const options={name:'Custom creation QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual'};
function profile(){
 const d=customClassDraft(createPlayerCharacter(options));
 Object.assign(d.definition,{id:'custom-test',name:'Test guardian',source:'Synthetic regression table',hitDie:8,skillPoints:6,skills:'Hide, Survival'});
 d.policy.family=d.definition.id;d.policy.bonusProfile={bab:'full',fort:'good',ref:'poor',will:'poor'};
 d.definition.levels[0].special='Source milestone, not an automatic power';
 return customClassTable(d,20);
}
const pairOptions=(p,n=3,swap=false)=>({...options,customClasses:[p],level:n,advancementMode:'gestalt',gestaltPairs:Array.from({length:n},()=>({left:swap?'wizard':p.definition.id,right:swap?p.definition.id:'wizard'})),hpRolls:Array(n-1).fill(5)});

test('fresh standard custom classes use their saved table and standard defaults, without sample gear or invented casting',()=>{
 const p=profile(),before=structuredClone(p);
 const c=createPlayerCharacter({...options,kind:p.definition.id,customClasses:[p],level:3,hpRolls:[5,6]});
 assert.deepEqual(p,before);assert.equal(c.level,3);assert.equal(c.bab,3);assert.equal(c.maxHp,25);assert.equal(c.hp,c.maxHp);
 assert.equal(c.experience,3000);assert.equal(c.advancementMode,'standard');assert.deepEqual(optionalRuleSettings(c),[]);
 assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),[8,5,6]);assert.equal(skillLedger(c).granted,48);
 assert.deepEqual(c.casters,[]);assert.deepEqual(c.psionics,[]);assert.deepEqual(c.gear,[]);assert.deepEqual(c.weapons,[]);
 assert.ok(c.features.some(f=>f.description.includes('Source milestone')));assert.ok(c.skills.find(s=>s.name==='Hide').classSkill);assert.ok(c.skills.every(s=>s.ranks===0));
 assert.deepEqual(characterSchema.parse(c),c);assert.deepEqual(recompute(structuredClone(c)),c);
 const npc=createNpcSheet({...options,kind:p.definition.id,customClasses:[p]});assert.equal(npc.sheetKind,'npc');assert.equal(npc.maxHp,10);
});

test('custom starting pairs work on either side, retain catalog casting and count each actual level once',()=>{
 const p=profile();
 for(const swap of [false,true]){
  const c=createPlayerCharacter(pairOptions(p,3,swap));
  assert.equal(c.level,3);assert.equal(c.experience,3000);assert.equal(c.bab,3);assert.equal(c.maxHp,24);assert.equal(skillLedger(c).granted,48);
  assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[3,1,3]);assert.equal(c.automation.history.length,3);
  assert.deepEqual(c.casters.map(p=>[p.casting.classId,p.level]),[['wizard',3]]);assert.deepEqual(c.casters[0].spells,[]);
  assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),[8,5,5]);assert.deepEqual(characterSchema.parse(c),c);
 }
 const mixed=createPlayerCharacter({...pairOptions(p),gestaltPairs:[{left:p.definition.id,right:'wizard'},{left:'fighter',right:p.definition.id},{left:p.definition.id,right:'cleric'}],hpRolls:[9,6]});
 assert.equal(mixed.level,3);assert.deepEqual(hitDieSequence(mixed).map(row=>row.die),[8,10,8]);
 assert.deepEqual(mixed.classLevels.map(e=>[e.classId,e.level]),[[p.definition.id,3],['wizard',1],['fighter',1],['cleric',1]]);
 assert.deepEqual(mixed.casters.map(c=>[c.casting.classId,c.level]),[['wizard',1],['cleric',1]]);
});

test('starting custom profiles reject unsupported data, missing levels, prestige entry and same-family pairs atomically',()=>{
 const p=profile(),before=structuredClone(p);
 const shortened=structuredClone(p);shortened.definition.levels=shortened.definition.levels.slice(0,2);
 assert.throws(()=>createPlayerCharacter({...options,kind:p.definition.id,customClasses:[shortened],level:3}),/no level 3/);
 assert.throws(()=>createPlayerCharacter(pairOptions(shortened)),/no complete table/);
 const prestige=structuredClone(p);prestige.definition.kind='Prestige';
 assert.throws(()=>createPlayerCharacter({...options,kind:p.definition.id,customClasses:[prestige]}),/base class/);
 assert.throws(()=>createPlayerCharacter(pairOptions(prestige)),/base-class levels first/);
 const variant=structuredClone(p);variant.policy.family='rogue';
 assert.throws(()=>createPlayerCharacter({...pairOptions(variant,1),gestaltPairs:[{left:p.definition.id,right:'psychic-rogue'}]}),/versions of the same class/);
 const unknown=structuredClone(p);unknown.definition.casting={};
 assert.throws(()=>createPlayerCharacter({...options,customClasses:[unknown]}));
 assert.throws(()=>createPlayerCharacter({...options,customClasses:[p,p]}));
 assert.deepEqual(p,before);assert.equal('customClasses' in createPlayerCharacter(options),false);
});

test('custom names cannot impersonate catalog grants and character libraries remain independent',()=>{
 const p=profile();p.definition.name='Wizard';
 const first=createPlayerCharacter({...options,kind:p.definition.id,customClasses:[p]}),second=createPlayerCharacter({...options,kind:p.definition.id,customClasses:[p]});
 assert.equal(first.classLevels[0].classId,p.definition.id);assert.deepEqual(first.casters,[]);assert.deepEqual(second.casters,[]);
 first.customClasses[0].definition.name='Edited';assert.equal(second.customClasses[0].definition.name,'Wizard');assert.equal(p.definition.name,'Wizard');
 const catalog=createPlayerCharacter({...options,kind:'Wizard',customClasses:[p]});assert.equal(catalog.classLevels[0].classId,'wizard');assert.equal(catalog.casters.length,1);
 assert.equal('customClasses' in createPlayerCharacter(options),false);
});

test('new custom standard and paired sheets advance and round-trip with damage, training and expenditures intact',async()=>{
 const p=profile();
 for(const paired of [false,true]){
  const c=createPlayerCharacter(paired?pairOptions(p):{...options,kind:p.definition.id,customClasses:[p],level:3,hpRolls:[5,5]});
  c.hp-=3;c.experience=6000;c.notes+='\nKeep this note';
  const hide=c.skills.find(s=>s.name==='Hide');c.automation.history[0].skillRanks[hide.id]=2;recompute(c);
  if(paired)c.casters[0].slots[1].used=1;
  const before=structuredClone(c);
  if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:p.definition.id,right:'wizard',hitDieRoll:6}));else gainLevel(c,p.definition.id,6);
  recompute(c,before);assert.equal(c.level,4);assert.equal(c.maxHp-c.hp,3);assert.deepEqual(c.automation.history.slice(0,3),before.automation.history);assert.equal(c.skills.find(s=>s.id===hide.id).ranks,2);
  if(paired)assert.equal(c.casters[0].slots[1].used,1);
  assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),c);
  const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();
  const api=createBrowserCharacterApi({scope:'/custom-creation/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
  const fresh=createBrowserCharacterApi({scope:'/custom-creation/',storage,lock});assert.deepEqual((await fresh('/api/characters/'+saved.id)).data,c);
 }
});
