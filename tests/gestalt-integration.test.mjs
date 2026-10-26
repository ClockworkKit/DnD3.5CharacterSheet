import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {classTotals,findClass,makeCaster,makePsionic,copyClassFeatures} from '../lib/classes.ts';
import {gestaltProgressionSchema} from '../lib/gestalt-schema.ts';
import {recompute} from '../lib/automation.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {advancementNumbers,casterProgression,psionicProgression} from '../lib/advancement.ts';
import {advancementChoices} from '../lib/advancement-choices.ts';
import {skillLedger,setSkillPoints,moveSkillLevel} from '../lib/skill-points.ts';
import {gainLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {characterHitDice} from '../lib/character-level.ts';
import {racialHD} from '../lib/racial-abilities.ts';
import {systemLimits} from '../lib/class-systems.ts';

const standard=()=>createPlayerCharacter({name:'Paired integration QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual'});
const repeat=(a,b,n)=>Array.from({length:n},()=>[a,b]);
// Construct explicit synthetic progression; this is not a player-save conversion API.
function paired(pairs){
 const c=standard(),counts=new Map();
 for(const pair of pairs)for(const id of pair)counts.set(id,(counts.get(id)??0)+1);
 c.classLevels=[...counts].map(([classId,level])=>({id:'entry-'+classId,classId,name:findClass(classId).name,level,notes:'Retain notes'}));
 c.advancementMode='gestalt';
 c.gestaltProgression=gestaltProgressionSchema.parse({version:1,levels:pairs.map(([left,right],i)=>({id:'pair-'+i,left:'entry-'+left,right:'entry-'+right,approvals:[left,right].filter(id=>['arcane-trickster','eldritch-knight','mystic-theurge','cerebremancer'].includes(id)).map(classId=>({classId,gm:'Test GM',reason:'Explicit fixture approval; prerequisite tests belong to advancement'}))}))});
 c.automation.history=[];c.automation.levelOrder=[];c.automation.hpRolls=[];c.automation.firstClassId='';c.features=[];c.casters=[];
 for(const row of hitDieSequence(c))c.automation.history.push({key:row.key,intScore:12,hitDieRoll:4,skillRanks:{},skillClassOverrides:{}});
 for(const e of c.classLevels){const d=findClass(e.classId);if(d.levels[0].slots)c.casters.push(makeCaster(d,e.level,c.scores[d.casting?.ability??(d.id==='wizard'?'INT':'WIS')]));}
 copyClassFeatures(c);recompute(c);c.hp=c.maxHp;
 return c;
}

test('full sheet uses five actual levels for Fighter 5 // Wizard 5, while keeping each class at five',()=>{
 const c=paired(repeat('fighter','wizard',5)),n=advancementNumbers(c);
 assert.deepEqual(classTotals(c.classLevels,c.ancestry,c),{level:5,bab:5,fort:4,ref:1,will:4,hitDice:'5d10',missing:[]});
 assert.equal(c.level,5);assert.equal(c.bab,5);assert.equal(c.maxHp,36);assert.equal(c.hitDice,'5d10');
 assert.equal(n.skillBudget,32);assert.equal(n.classMax,8);assert.equal(n.crossMax,4);assert.equal(n.nextXp,15000);assert.equal(n.feats,3);assert.equal(n.abilityIncreases,1);
 assert.equal(n.fighterFeats,3);assert.equal(n.wizardFeats,1);assert.equal(c.casters[0].level,5);
 assert.equal(c.automation.history.length,5);assert.equal(hitDieSequence(c).length,5);
 assert.equal(advancementChoices(c).filter(r=>r.key.startsWith('general-')).length,2);assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,1);
 assert.deepEqual(c.classLevels.map(e=>e.level),[5,5]);assert.equal(c.features.filter(f=>f.id.startsWith('class-summary-')).length,2);
 assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});

test('Ranger // Rogue uses both class skill lists and one historical skill allowance per actual level',()=>{
 const c=paired(repeat('ranger','rogue',3)),survival=c.skills.find(s=>s.name==='Survival'),disable=c.skills.find(s=>s.name==='Disable Device'),spellcraft=c.skills.find(s=>s.name==='Spellcraft');
 let ledger=skillLedger(c);assert.equal(ledger.granted,60);assert.equal(ledger.levels[0].costs[survival.id],1);assert.equal(ledger.levels[0].costs[disable.id],1);assert.equal(ledger.levels[0].costs[spellcraft.id],2);
 assert.equal(survival.classSkill,true);assert.equal(disable.classSkill,true);
 setSkillPoints(c,ledger.levels[0].key,survival.id,4);setSkillPoints(c,ledger.levels[0].key,disable.id,4);
 setSkillPoints(c,ledger.levels[1].key,survival.id,1);setSkillPoints(c,ledger.levels[2].key,survival.id,1);
 const before=structuredClone(c);c.scores.INT=18;recompute(c,before);ledger=skillLedger(c);
 assert.equal(ledger.granted,60);assert.equal(survival.ranks,6);assert.equal(disable.ranks,4);assert.equal(ledger.levels[2].limits[survival.id],6);assert.equal(ledger.levels[2].limits[spellcraft.id],3);
 assert.deepEqual(c.automation.history,before.automation.history);
});

test('native files, browser reload and the real prepare path retain paired levels, injuries, ranks and spent casting',async()=>{
 const c=paired(repeat('wizard','cleric',5));c.hp-=7;c.tempHp=2;c.factotum.spent=1;c.casters[0].slots[1].used=1;c.casters[1].slots[1].used=2;
 const skill=c.skills.find(s=>s.name==='Concentration');setSkillPoints(c,c.automation.history[0].key,skill.id,3);
 c.advancementChoices['ability-1']='WIS';c.features.push({id:'personal',name:'Personal tracker',kind:'Other',description:'Keep me',max:3,used:2,source:''});
 const imported=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}));assert.deepEqual(imported,c);
 assert.deepEqual(await prepareCharacter(imported),c);
 const values=new Map(),options={scope:'/gestalt-qa/',storage:()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}),lock:async(name,work)=>work(),id:()=> 'paired-save',now:()=> '2026-10-26T00:00:00Z'};
 const api=createBrowserCharacterApi(options),row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await createBrowserCharacterApi(options)('/api/characters/'+row.id);assert.deepEqual(loaded.data,c);
 const again=await prepareCharacter(characterSchema.parse(loaded.data));assert.deepEqual(again,c);assert.deepEqual(again.casters.map(p=>p.level),[5,5]);
});

test('old saves remain standard, including manual gestalt-like notes and old homebrew settings',async()=>{
 const c=standard();c.automation.hpMethod='maximum';c.automation.encumbrance=false;c.notes='Gestalt Fighter // Wizard (manual campaign note)';c.hp-=3;
 delete c.advancementMode;const expected=structuredClone(c),loaded=characterSchema.parse(c);
 assert.equal(loaded.advancementMode,'standard');assert.equal(loaded.gestaltProgression,undefined);
 const prepared=await prepareCharacter(loaded);assert.equal(prepared.automation.hpMethod,'maximum');assert.equal(prepared.automation.encumbrance,false);assert.equal(prepared.maxHp-prepared.hp,3);assert.equal(prepared.notes,expected.notes);assert.deepEqual(c,expected);
});

test('invalid plans fail schema validation and recomputation before altering any character data',()=>{
 const c=paired(repeat('fighter','wizard',2));
 for(const change of [d=>delete d.gestaltProgression,d=>d.gestaltProgression.levels.pop(),d=>d.gestaltProgression.levels[0].right='missing',d=>d.classLevels[0].level++,d=>d.ancestry.racialHitDice=1,d=>d.gestaltProgression.bonusMethod='future-method']){
  const broken=structuredClone(c);change(broken);const before=structuredClone(broken);
  assert.equal(characterSchema.safeParse(broken).success,false);assert.throws(()=>recompute(broken));assert.deepEqual(broken,before);
 }
});

test('mode changes and old single-class editing paths cannot silently discard paired history',()=>{
 const c=paired(repeat('fighter','wizard',2));c.experience=30000;const before=structuredClone(c);
 assert.throws(()=>gainLevel(c,'fighter',4),/pair/);assert.throws(()=>moveSkillLevel(c,c.automation.history[0].key,1),/Paired/);assert.deepEqual(c,before);
 const switched=structuredClone(c);switched.advancementMode='standard';const changed=structuredClone(switched);assert.throws(()=>recompute(switched,c),/reviewed progression conversion/);assert.deepEqual(switched,changed);
 const previous=standard();assert.throws(()=>recompute(c,previous),/reviewed progression conversion/);assert.deepEqual(c,before);
});

test('actual HD, racial scaling, initiator limits and essentia capacity never add both sides',()=>{
 const c=paired(repeat('warblade','wizard',5));assert.equal(characterHitDice(c),5);assert.equal(racialHD(c),5);assert.equal(systemLimits(c,'warblade').initiator,5);
 c.ancestry.levelAdjustment=2;assert.equal(advancementNumbers(c).ecl,7);assert.equal(advancementNumbers(c).nextXp,28000);assert.equal(characterHitDice(c),5);
 const incarnate=paired(repeat('incarnate','fighter',5));assert.equal(systemLimits(incarnate,'incarnate').capacity,1);
 const drow=paired(repeat('fighter','wizard',5));drow.ancestry.raceId='drow';drow.ancestry.traitBonuses=true;recompute(drow);assert.equal(drow.defense.sr,16);
});

test('manual base statistics do not turn paired class levels into extra character levels',()=>{
 const c=paired(repeat('fighter','wizard',3));c.automation.enabled=false;c.level=6;c.bab=9;c.maxHp=99;c.hp=77;
 recompute(c);assert.equal(c.level,3);assert.equal(c.bab,9);assert.equal(c.maxHp,99);assert.equal(c.hp,77);assert.equal(advancementNumbers(c).hd,3);
});

test('prestige advancement of the same spellcasting tradition is granted once per pair',()=>{
 const simultaneous=paired([...repeat('wizard','fighter',5),['wizard','loremaster']]);
 assert.equal(casterProgression(simultaneous,simultaneous.casters[0]).progression,6);assert.equal(simultaneous.casters[0].level,6);
 const separate=paired([...repeat('wizard','fighter',5),['fighter','loremaster']]);assert.equal(separate.casters[0].level,6);
 const dual=paired([...repeat('wizard','cleric',5),['wizard','mystic-theurge']]);
 const wizard=dual.casters.find(p=>p.casting.classId==='wizard'),cleric=dual.casters.find(p=>p.casting.classId==='cleric');
 assert.equal(wizard.level,6);assert.equal(cleric.level,6);
 const domain=makeCaster(findClass('cleric'),5,14);domain.id='domain';domain.name='Domains';domain.casting.domain=true;dual.casters.push(domain);wizard.slots[1].used=1;cleric.slots[1].used=2;domain.slots[1].used=1;
 const previous=structuredClone(dual);recompute(dual,previous);assert.equal(domain.level,6);assert.equal(domain.slots[1].max,1);assert.deepEqual(dual.casters.map(p=>p.slots[1].used),[1,2,1]);
 wizard.casting.progression=8;recompute(dual);assert.equal(wizard.level,8,'explicit custom progression overrides remain independent');assert.equal(cleric.level,6);
});

test('Cerebremancer keeps independent spell and psionic traditions without double advancing either',()=>{
 for(const advancing of ['wizard','psion']){
  const c=paired([...repeat('wizard','psion',5),[advancing,'cerebremancer']]);
  const psychic=makePsionic(findClass('psion'),5,16);psychic.spent=3;c.psionics.push(psychic);recompute(c);
  assert.equal(c.casters[0].level,6);assert.equal(psionicProgression(c,psychic).progression,6);assert.equal(psychic.level,6);assert.equal(psychic.spent,3);
  psychic.manifesting.progression=8;recompute(c);assert.equal(psychic.level,8);assert.equal(c.casters[0].level,6);assert.equal(psychic.spent,3);
 }
});

test('Hierophant caster-level-only advancement never adds slots or duplicates simultaneous caster-level gains',()=>{
 const simultaneous=paired([...repeat('cleric','wizard',13),['cleric','hierophant']]);
 const cleric=simultaneous.casters.find(p=>p.casting.classId==='cleric');assert.equal(casterProgression(simultaneous,cleric).progression,14);assert.equal(cleric.level,14);
 const separate=paired([...repeat('cleric','wizard',13),['wizard','hierophant']]);
 const other=separate.casters.find(p=>p.casting.classId==='cleric');assert.equal(casterProgression(separate,other).progression,13);assert.equal(other.level,14);
 assert.equal(other.slots[7].max,makeCaster(findClass('cleric'),13,14).slots[7].max);
 const half=paired([...repeat('ranger','wizard',14),['ranger','hierophant']]);
 const ranger=half.casters.find(p=>p.casting.classId==='ranger');
 assert.equal(casterProgression(half,ranger).progression,15);assert.equal(ranger.level,8,'CL-only grant survives a half-caster level that does not itself increase CL');
});
