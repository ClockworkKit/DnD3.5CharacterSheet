import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceCatalog,findRace} from '../lib/ancestry.ts';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
const read=name=>JSON.parse(readFileSync(new URL('../lib/'+name+'.json',import.meta.url),'utf8'));
const summaries=read('race-rule-summaries'),legacy=read('ultimate-race-data');
const make=id=>createPlayerCharacter({name:'Race reference check',kind:'Rogue',level:3,raceId:id,scores:{STR:12,DEX:14,CON:12,INT:14,WIS:12,CHA:14},method:'manual'});

test('every legacy placeholder race has integrated, portable rules',()=>{
 const remaining=legacy.filter(r=>r.id!=='kenku'&&r.traits.some(t=>t.includes('use the source rules')));
 assert.equal(remaining.length,274);
 assert.deepEqual(Object.keys(summaries).sort(),remaining.map(r=>r.id).sort());
 for(const r of raceCatalog)assert.doesNotMatch(r.traits.join(' '),/use the source rules for conditions and choices/i,r.id);
 for(const r of remaining){
  const c=make(r.id),card=c.features.find(f=>f.id==='race-reference'),ref=c.sourceReferences.find(r=>r.id==='race:'+c.ancestry.raceId);
  assert.ok(card.description.includes(summaries[r.id][0]),r.id);
  assert.ok(ref.text.includes(summaries[r.id][0]),r.id);
  assert.equal(ref.url,r.source,r.id);assert.ok(ref.book,r.id);
  assert.ok(card.description.length<=20000,r.id);
  const restored=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}));
  assert.deepEqual(restored.sourceReferences,c.sourceReferences,r.id);
  assert.equal(restored.features.find(f=>f.id==='race-reference').description,card.description,r.id);
 }
});

test('all legacy generated cards upgrade once without changing player state',()=>{
 for(const r of legacy.filter(r=>summaries[r.id])){
  const c=make(r.id);c.automation.enabled=false;c.hp=1;c.notes='Personal campaign note';
  const card=c.features.find(f=>f.id==='race-reference');card.max=4;card.used=3;
  card.description=['Personal preface',...r.traits,...(r.manualHandling||[]),'Personal epilogue'].join('\n\n');
  const before=structuredClone(c);recompute(c);
  assert.doesNotMatch(card.description,/use the source rules/,r.id);
  assert.ok(card.description.startsWith('Personal preface'),r.id);assert.ok(card.description.endsWith('Personal epilogue'),r.id);
  assert.ok(card.description.includes(summaries[r.id][0]),r.id);
  for(const note of r.manualHandling||[])if(!note.startsWith('Inherits ')&&!note.startsWith('Automatic:'))assert.ok(card.description.includes(note),r.id);
  before.features.find(f=>f.id==='race-reference').description=card.description;
  assert.deepEqual(c,before,r.id);recompute(c);assert.deepEqual(c,before,r.id);
 }
});

test('star elf includes its nighttime limits, senses, and weapon exception',()=>{
 const text=findRace('star-elf').traits.join(' ');
 for(const pattern of [/sunset until sunrise/,/held melee weapons and worn armor gain ghost touch/,/weapon leaves your hand/,/Sildëyuir/,/Magic sleep immunity/,/enchantments/,/within 5 ft/,/No racial weapon proficiencies/])assert.match(text,pattern);
});

test('choice lists and retained parent rules do not grant incompatible alternatives',()=>{
 assert.match(summaries.shifter.join(' '),/Choose one permanent trait/);
 assert.match(summaries.shifter.join(' '),/Swiftwing:.*no medium[/]heavy armor or load/);
 assert.match(summaries.spellscale.join(' '),/1 hour.*24 hours/);
 assert.match(summaries.hengeyokai.join(' '),/Sparrow: Fine/);
 assert.doesNotMatch(summaries['forestlord-elf'].join(' '),/Proficient with longsword/);
 assert.doesNotMatch(summaries['declining-elf'].join(' '),/Immune to magical sleep/);
 assert.doesNotMatch(summaries['complacent-human'].join(' '),/Bonus feat at first level/);
 assert.match(summaries['desert-kobold'].join(' '),/Lose light sensitivity/);
 assert.doesNotMatch(summaries['desert-kobold'].join(' '),/causes dazzled/);
 assert.match(summaries['mephling-air'].join(' '),/1d8 piercing damage/);
 assert.doesNotMatch(summaries['mephling-air'].join(' '),/1d8 fire damage/);
 assert.match(summaries['bamboo-spirit-folk'].join(' '),/Trackless Step/);
 assert.doesNotMatch(summaries['bamboo-spirit-folk'].join(' '),/swim speed|Water Breathing/);
});
