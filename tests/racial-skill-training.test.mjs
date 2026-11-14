import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {racialClassSkill} from '../lib/ancestry.ts';
import {recompute} from '../lib/automation.ts';
import {skillLedger,setSkillPoints,skillRankLimit} from '../lib/skill-points.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
const create=(raceId='hound-archon',paired=true)=>createPlayerCharacter({
 name:'Racial skill QA',kind:'Fighter',level:1,raceId,scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:12},
 method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:[{left:'fighter',right:'wizard'}]}:{})
});
const skill=(c,name)=>c.skills.find(s=>s.name===name);
const envelope=c=>JSON.stringify({format:'barrow-ledger-character',version:1,data:c});

test('racial-HD summary includes the whole racial list, while each level keeps its own prices and caps',()=>{
 for(const paired of [false,true]){
  const c=create('hound-archon',paired),listen=skill(c,'Listen'),ledger=skillLedger(c);
  assert.equal(listen.classSkill,true);assert.equal(skill(c,'Hide').classSkill,true);
  assert.equal(skill(c,'Disable Device').classSkill,false);
  assert.deepEqual(ledger.levels.map(r=>r.costs[listen.id]),[1,1,1,1,1,1,2]);
  assert.equal(skillRankLimit(c,listen,6),10);
  setSkillPoints(c,ledger.levels[0].key,listen.id,4);setSkillPoints(c,ledger.levels[6].key,listen.id,2);
  recompute(c);assert.equal(listen.ranks,5);assert.equal(skillLedger(c).spent,6);
  assert.equal(skillLedger(c).levels[6].costs[listen.id],2);
 }
});

test('always-class racial grants agree in the summary and every standard or paired training level',()=>{
 for(const [raceId,name] of [['silverbrow-human','Disguise'],['forestlord-elf','Hide'],['forestlord-half-elf','Hide'],['illumian','Speak Language']]){
  for(const paired of [false,true]){
   const c=create(raceId,paired),s=skill(c,name);
   assert.equal(c.ancestry.racialHitDice,0);assert.equal(s.classSkill,true,raceId);
   assert.equal(skillLedger(c).levels[0].costs[s.id],1,raceId);
   setSkillPoints(c,c.automation.history[0].key,s.id,4);recompute(c);
   assert.equal(s.ranks,4);assert.equal(skillLedger(c).spent,4);
  }
 }
});

test('specialty grants stay restricted and removing retained dice does not invent a racial class list',()=>{
 const stone=create('stonechildren'),jann=create('jann');
 assert.equal(racialClassSkill(stone,'Craft (stoneworking)',true),true);
 assert.equal(racialClassSkill(stone,'Craft (alchemy)',true),false);
 assert.equal(racialClassSkill(stone,'Knowledge (history)',true),true);
 assert.equal(racialClassSkill(stone,'Knowledge (arcana)',true),false);
 assert.equal(racialClassSkill(jann,'Craft (alchemy)',true),true);
 assert.equal(racialClassSkill(jann,'Knowledge (arcana)',true),false);
 stone.ancestry.racialHitDice=0;
 assert.equal(racialClassSkill(stone,'Craft (stoneworking)',true),false);
 assert.equal(racialClassSkill(create('human'),'Listen',true),false);
});

test('explicit character and historical training overrides take precedence without being rewritten',()=>{
 const c=create(),listen=skill(c,'Listen');
 listen.classSkillOverride=false;recompute(c);
 assert.equal(listen.classSkill,false);assert.ok(skillLedger(c).levels.every(r=>r.costs[listen.id]===2));
 c.automation.history[0].skillClassOverrides[listen.id]=true;
 setSkillPoints(c,c.automation.history[0].key,listen.id,4);
 recompute(c);assert.equal(listen.classSkill,false);assert.equal(skillLedger(c).levels[0].costs[listen.id],1);assert.equal(listen.ranks,4);
 const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);
 const manual=structuredClone(c);manual.automation.enabled=false;manual.skills.find(s=>s.id===listen.id).classSkill=true;
 const manualBefore=structuredClone(manual);recompute(manual);assert.deepEqual(manual,manualBefore);
});

test('repairing old summary flags preserves later levels, history, ranks, overrides, injury and spent casting through storage',async()=>{
 const c=create();c.experience=78000;
 c.hp-=3;c.casters[0].slots[1].used=1;
 const listen=skill(c,'Listen');setSkillPoints(c,c.automation.history[0].key,listen.id,4);
 c.automation.history[1].skillClassOverrides[listen.id]=false;
 setSkillPoints(c,c.automation.history[1].key,listen.id,2);
 const before=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left:'fighter',right:'wizard'}));recompute(c,before);
 const expected=structuredClone(c);
 for(const name of ['Hide','Listen','Move Silently','Sense Motive','Spot','Survival'])skill(c,name).classSkill=false;
 const imported=await prepareCharacter(parseCharacterFile(envelope(c)));
 assert.deepEqual(imported,expected);assert.equal(imported.level,8);assert.equal(skillLedger(imported).spent,6);
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
 const api=()=>createBrowserCharacterApi({scope:'racial-skill',storage:()=>storage,lock:async(_,fn)=>fn()});
 const record=await api()('/api/characters',{method:'POST',body:JSON.stringify({data:imported})});
 const saved=(await api()('/api/characters/'+record.id)).data;
 assert.deepEqual(await prepareCharacter(parseCharacterFile(envelope(saved))),expected);
});
