import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {setPsionDiscipline,setSkillPoints,skillLedger} from '../lib/skill-points.ts';
import {powerLibraryEntry} from '../lib/psionics.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';

import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {recompute} from '../lib/automation.ts';

const options={name:'Discipline QA',kind:'Psion',level:1,raceId:'human',method:'manual',hpMethod:'average',
 scores:{STR:10,DEX:12,CON:12,INT:16,WIS:14,CHA:10}};
const skillsByDiscipline={
 Seer:['Gather Information','Listen','Spot'],Shaper:['Bluff','Disguise','Use Psionic Device'],
 Kineticist:['Autohypnosis','Disable Device','Intimidate'],Egoist:['Autohypnosis','Balance','Heal'],
 Nomad:['Climb','Jump','Ride','Survival','Swim'],Telepath:['Bluff','Diplomacy','Gather Information','Sense Motive'],
};
for(const [discipline,skills] of Object.entries(skillsByDiscipline)){
 test(discipline+' grants its own additional skills to a standard Psion',()=>{
  const c=createPlayerCharacter({...options,psionDiscipline:discipline});
  const row=skillLedger(c).levels[0];
  for(const name of new Set(Object.values(skillsByDiscipline).flat())){
   const s=c.skills.find(s=>s.name===name);
   assert.equal(row.costs[s.id],skills.includes(name)?1:2,name);
   assert.equal(s.classSkill,skills.includes(name),name);
  }
 });
}

test('recording a discipline preserves earlier prices and resources across a native reload',async()=>{
 const c=createPlayerCharacter({...options,advancementMode:'gestalt',level:4,gestaltPairs:[
  {left:'fighter',right:'wizard'},{left:'fighter',right:'psion'},
  {left:'psion',right:'wizard'},{left:'wizard',right:'fighter'}]});
 const s=c.skills.find(s=>s.name==='Use Psionic Device');
 const initial=skillLedger(c);
 setSkillPoints(c,initial.levels[1].key,s.id,2);
 c.hp-=3;c.psionics[0].spent=2;c.psionics[0].notes='Old player notes';
 const before={hp:c.hp,psionics:structuredClone(c.psionics),pairs:structuredClone(c.gestaltProgression)};
 setPsionDiscipline(c,'Shaper');
 const ledger=skillLedger(c);
 assert.deepEqual(ledger.levels.map(r=>r.costs[s.id]),[2,2,1,2]);
 assert.equal(ledger.spent,2);
 assert.equal(ledger.levels[3].limits[s.id],7);
 setSkillPoints(c,ledger.levels[2].key,s.id,1);
 setPsionDiscipline(c,'Nomad');
 const saved=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));
 assert.equal(saved.psionDiscipline,'Nomad');
 assert.equal(saved.skills.find(row=>row.id===s.id).ranks,2);
 assert.equal(skillLedger(saved).spent,3);
 assert.deepEqual({hp:saved.hp,psionics:saved.psionics,pairs:saved.gestaltProgression},before);
});

test('a later starting pair can grant discipline skills on either side',()=>{
 const c=createPlayerCharacter({...options,advancementMode:'gestalt',level:3,psionDiscipline:'Shaper',
  gestaltPairs:[{left:'fighter',right:'wizard'},{left:'fighter',right:'psion'},{left:'psion',right:'wizard'}]});
 const s=c.skills.find(s=>s.name==='Use Psionic Device');
 assert.deepEqual(skillLedger(c).levels.map(r=>r.costs[s.id]),[2,1,1]);
 assert.throws(()=>createPlayerCharacter({...options,kind:'Wilder',psionDiscipline:'Shaper'}),/Psion level/);
});

for(const mode of ['standard','gestalt']){
 test(mode+' level-up records a first Psion discipline and preserves earlier purchases',async()=>{
  const paired=mode==='gestalt';
  const c=createPlayerCharacter({...options,kind:'Wizard',advancementMode:mode,
   ...(paired?{gestaltPairs:[{left:'wizard',right:'fighter'}]}:{})});
  c.experience=3000;c.hp-=2;c.casters[0].slots[0].used=1;
  const id=c.skills.find(row=>row.name==='Use Psionic Device').id;
  setSkillPoints(c,skillLedger(c).levels[0].key,id,2);
  const before=structuredClone(c);
  const pair={left:'psion',right:'wizard'};
  for(const invalid of [undefined,'unknown']){
   assert.throws(()=>paired?previewGestaltLevel(c,{...pair,psionDiscipline:invalid}):gainLevel(c,'psion',undefined,[],invalid),/Choose a discipline/);
   assert.deepEqual(c,before);
  }
  if(paired){
   const review=previewGestaltLevel(c,{...pair,psionDiscipline:'Shaper'});
   assert.equal(review.character.psionDiscipline,'Shaper');
   assert.deepEqual(c,before);
   review.selection.psionDiscipline='Telepath';
   assert.throws(()=>applyGestaltLevel(c,review),/choices changed/);
   assert.deepEqual(c,before);
   applyGestaltLevel(c,previewGestaltLevel(c,{...pair,psionDiscipline:'Shaper'}));
  }else gainLevel(c,'psion',undefined,[],'Shaper');
  recompute(c,before);
  const saved=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));
  assert.equal(saved.psionDiscipline,'Shaper');
  assert.equal(saved.level,2);
  assert.equal(saved.maxHp-saved.hp,2);
  assert.equal(saved.casters[0].slots[0].used,1);
  assert.deepEqual(skillLedger(saved).levels.map(r=>r.costs[id]),[2,1]);
  assert.equal(skillLedger(saved).spent,2);
  assert.throws(()=>paired?previewGestaltLevel(saved,{...pair,psionDiscipline:'Telepath'}):gainLevel(saved,'psion',undefined,[],'Telepath'),/only be selected when entering/);
 });
}

test('the power library uses the chosen list for eligibility, level and base cost',()=>{
 const refs=JSON.parse(readFileSync(new URL('../public/data/powers.json',import.meta.url),'utf8'));
 const construct=refs.find(r=>r.name==='Astral Construct'),biofeedback=refs.find(r=>r.name==='Biofeedback');
 assert.deepEqual(powerLibraryEntry(construct,'class-list','psion','Shaper'),{level:1,cost:1});
 for(const [id,choice] of [['psion','Nomad'],['psion',undefined],['wilder','Shaper'],['custom-psion','Shaper']]){
  assert.equal(powerLibraryEntry(construct,'class-list',id,choice),undefined);
 }
 assert.deepEqual(powerLibraryEntry(biofeedback,'class-list','psion','Nomad'),{level:2,cost:3});
 assert.deepEqual(powerLibraryEntry(biofeedback,'class-list','psychic-warrior'),{level:1,cost:1});
 assert.deepEqual(powerLibraryEntry(biofeedback,'Psychic Warrior','psion','Shaper'),{level:1,cost:1});
 assert.deepEqual(powerLibraryEntry(construct,'all','psion','Nomad'),{level:1,cost:1});
});
