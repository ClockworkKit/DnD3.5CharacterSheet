import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterGestaltRows,gestaltBonusLedger} from '../lib/gestalt-progression.ts';
import {characterHitDice} from '../lib/character-level.ts';
import {recompute} from '../lib/automation.ts';
import {advancementNumbers} from '../lib/advancement.ts';
import {recordAdvancementChoice} from '../lib/advancement-choices.ts';
import {skillLedger,setSkillPoints} from '../lib/skill-points.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {levelUpStatus,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {raceCatalog,raceProgression,selectRace} from '../lib/ancestry.ts';

const options={name:'Racial HD QA',kind:'Fighter',level:1,raceId:'gnoll',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:12},method:'manual',advancementMode:'gestalt',gestaltPairs:[{left:'fighter',right:'wizard'}]};
const create=(extra={})=>createPlayerCharacter({...options,hpRolls:[4,5],...extra});
const envelope=c=>JSON.stringify({format:'barrow-ledger-character',version:1,data:c});
const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};

test('retained racial dice precede pairs, with one first-HD multiplier and independent class casting',()=>{
 const c=create(),n=advancementNumbers(c),history=hitDieSequence(c);
 assert.equal(c.level,3);assert.equal(characterHitDice(c),3);assert.equal(n.ecl,4);assert.equal(c.experience,6000);
 assert.equal(n.feats,2);assert.equal(n.abilityIncreases,0);assert.equal(n.skillBudget,24);
 assert.equal(c.hitDice,'2d8 + 1d10');assert.equal(c.maxHp,26);assert.equal(c.bab,2);
 assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[5,0,2]);
 assert.deepEqual(history.map(r=>r.classId),['racial','racial','gestalt']);
 assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),[8,4,5]);
 assert.deepEqual(skillLedger(c).levels.map(r=>r.granted),[16,4,4]);
 assert.equal(characterGestaltRows(c).length,1);assert.equal(c.casters[0].level,1);
 const climb=c.skills.find(s=>s.name==='Climb'),spellcraft=c.skills.find(s=>s.name==='Spellcraft');
 assert.deepEqual(skillLedger(c).levels.map(r=>r.costs[climb.id]),[1,1,1]);
 assert.deepEqual(skillLedger(c).levels.map(r=>r.costs[spellcraft.id]),[2,2,1]);
 const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);
});

test('paired advancement uses total HD for choices and ECL for XP without repeating racial grants',()=>{
 const c=create();assert.equal(levelUpStatus(c).available,0);c.experience=10000;
 c.hp-=3;c.casters[0].slots[1].used=1;
 const skill=c.skills.find(s=>s.name==='Spellcraft');setSkillPoints(c,c.automation.history[2].key,skill.id,2);
 const before=structuredClone(c),preview=previewGestaltLevel(c,{left:'fighter',right:'wizard',hitDieRoll:6});
 assert.deepEqual(c,before);assert.equal(preview.summary.level,4);assert.equal(preview.summary.hpGain,9);assert.equal(preview.summary.skillPoints,4);
 assert.equal(preview.summary.bonusDecision.bonuses.fort.total,6);
 assert.equal(preview.summary.choices.filter(r=>r.kind==='ability').length,1);
 applyGestaltLevel(c,preview);recompute(c,before);
 assert.equal(c.level,4);assert.equal(c.maxHp,35);assert.equal(c.maxHp-c.hp,3);assert.equal(c.casters[0].level,2);assert.equal(c.casters[0].slots[1].used,1);
 assert.deepEqual(c.automation.history.slice(0,3),before.automation.history);
 assert.equal(c.skills.find(s=>s.id===skill.id).ranks,2);
 assert.equal(c.gestaltProgression.levels.length,2);
});

test('first save after importing a leveled racial-HD sheet retains choices, purchases, injury and expenditure',async()=>{
 const c=create();c.experience=10000;
 const before=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,{left:'fighter',right:'wizard',hitDieRoll:6}));recompute(c,before);
 recordAdvancementChoice(c,'ability-1','DEX',true);
 c.features.push({id:'chosen-feat',name:'Stealthy',kind:'Feat',description:'Chosen at third Hit Die',source:'',max:0,used:0});
 recordAdvancementChoice(c,'general-1','chosen-feat');
 setSkillPoints(c,c.automation.history[2].key,c.skills.find(s=>s.name==='Spellcraft').id,2);
 c.hp-=3;c.casters[0].slots[1].used=1;recompute(c);
 const expected=structuredClone(c),imported=await prepareCharacter(parseCharacterFile(envelope(c)));
 assert.deepEqual(imported,expected);
 const store=storage(),makeApi=()=>createBrowserCharacterApi({scope:'racial-hd',storage:()=>store,lock:async(_,fn)=>fn()});
 const api=makeApi(),record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:imported})});
 const saved=(await makeApi()('/api/characters/'+record.id)).data;
 assert.deepEqual(await prepareCharacter(parseCharacterFile(envelope(saved))),expected);
});

test('fractional racial progression carries into paired bonuses and review; printed tables remain the default',()=>{
 const extra={gestaltPairs:[{left:'rogue',right:'wizard'}],hpRolls:[4,5]};
 const printed=create(extra),fractional=create({...extra,gestaltBonusMethod:'fractional-v1'});
 assert.equal(printed.bab,1);assert.equal(fractional.bab,2);
 assert.deepEqual([printed.saves.fort.base,printed.saves.ref.base,printed.saves.will.base],[3,2,2]);
 assert.deepEqual([fractional.saves.fort.base,fractional.saves.ref.base,fractional.saves.will.base],[3,3,3]);
 const ledger=gestaltBonusLedger(characterGestaltRows(fractional),fractional.ancestry);
 assert.equal(ledger[0].bonuses.bab.total,fractional.bab);
 fractional.experience=10000;const preview=previewGestaltLevel(fractional,{left:'rogue',right:'wizard',hitDieRoll:4});
 assert.equal(preview.character.bab,3);assert.equal(preview.summary.bonusDecision.bonuses.bab.total,3);
 assert.equal(printed.gestaltProgression.bonusMethod,'printed-table-v1');
});

test('unsupported and single retained racial dice reject explicitly, and old histories cannot be silently converted',()=>{
 const c=create(),before=structuredClone(c);
 const changed=structuredClone(c);changed.ancestry.racialHitDice=1;
 assert.throws(()=>recompute(changed,c),/single racial Hit Die/);
 const unsupported=structuredClone(c);unsupported.ancestry.raceId='unrecorded';
 assert.throws(()=>recompute(unsupported),/supported racial progression/);
 const altered=structuredClone(c);selectRace(altered,'lizardfolk',{abilities:true,traits:true,body:true,languages:true});
 assert.throws(()=>recompute(altered,c),/reviewed history conversion/);
 const human=create({raceId:'human',hpRolls:[]}),converted=structuredClone(human);selectRace(converted,'gnoll',{abilities:true,traits:true,body:true,languages:true});
 assert.throws(()=>recompute(converted,human),/reviewed history conversion/);
 assert.deepEqual(c,before);assert.equal(human.ancestry.racialHitDice,0);
});

test('all catalog retained racial-HD profiles keep dice and history stable in paired creation',()=>{
 for(const race of raceCatalog.filter(r=>r.rhd>1&&raceProgression(r.id))){
  const c=create({raceId:race.id,hpMethod:'average',hpRolls:undefined}),before=structuredClone(c);
  assert.equal(c.level,race.rhd+1,race.id);assert.equal(c.automation.history.length,race.rhd+1,race.id);
  assert.equal(c.casters[0].level,1,race.id);assert.equal(characterGestaltRows(c).length,1,race.id);
  recompute(c);assert.deepEqual(c,before,race.id);
 }
});

test('one-HD racial replacement races and standard racial-HD characters retain their existing behavior',()=>{
 const elf=create({raceId:'elf',hpRolls:[]});assert.equal(elf.ancestry.racialHitDice,0);assert.equal(elf.level,1);assert.deepEqual(elf.automation.history.map(h=>h.hitDieRoll),[10]);
 const standard=createPlayerCharacter({...options,advancementMode:'standard',gestaltPairs:undefined,hpRolls:[4,5]});
 assert.equal(standard.level,3);assert.equal(standard.bab,2);assert.equal(standard.saves.will.base,0);
 assert.equal(standard.maxHp,26);assert.equal(standard.casters.length,0);
});
