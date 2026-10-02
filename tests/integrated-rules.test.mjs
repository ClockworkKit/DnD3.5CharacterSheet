import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findRace,racialSummary} from '../lib/ancestry.ts';
import {recompute} from '../lib/automation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
const make=(kind='Factotum',raceId='kenku')=>createPlayerCharacter({name:'Integrated rules',kind,level:3,raceId,scores:{STR:12,DEX:14,CON:12,INT:18,WIS:14,CHA:16},method:'manual'});
const oldRaces=['race-data','ultimate-race-data'].flatMap(file=>JSON.parse(readFileSync(new URL('../lib/'+file+'.json',import.meta.url),'utf8')));

test('the visible trait catalog and saved racial card contain usable rules',()=>{
 for(const [id,rule] of [['kenku',/Flanking attacks gain \+4/],['illumian',/otherwise −4 racial saves/],['aquatic-kobold',/Swim speed 40 ft/],['mountain-dwarf',/\+4 against bull rush\/trip/]]){
  const c=make('Rogue',id),text=findRace(id).traits.join('\n');
  assert.match(text,rule);assert.doesNotMatch(text,/use the source rules/);
  const f=c.features.find(f=>f.id==='race-reference');
  assert.match(f.description,rule);assert.equal(f.description,racialSummary(c));
 }
 const kenku=findRace('kenku').traits.join('\n');
 assert.match(kenku,/Bluff opposed.*Sense Motive/);assert.match(kenku,/two claws, 1d3/);
});

test('opening old racial cards replaces generated placeholders and keeps player changes',()=>{
 for(const id of ['kenku','illumian','aquatic-kobold','mountain-dwarf']){
  const c=make('Rogue',id);c.automation.enabled=false;
  const f=c.features.find(f=>f.id==='race-reference'),old=oldRaces.find(r=>r.id===id);
  f.description='My preface\n\n'+old.traits.join('\n\n')+'\n\nMy campaign notes';f.max=3;f.used=2;
  const before=structuredClone(c);recompute(c);
  assert.match(f.description,/^My preface/);assert.match(f.description,/My campaign notes$/);
  assert.ok(f.description.includes(findRace(id).traits[0]));assert.doesNotMatch(f.description,/use the source rules/);
  before.features.find(f=>f.id==='race-reference').description=f.description;
  assert.deepEqual(c,before);recompute(c);assert.deepEqual(c,before);
  assert.deepEqual(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})),c);
 }
});

test('all requested classes carry rules in their feature card and legacy cards gain them once',()=>{
 for(const [kind,rule] of [['Factotum',/Cunning Insight: 1 point/],['Rogue',/Sneak Attack/],['Sorcerer',/Familiar/],['Cleric',/Spontaneous Casting/],['Bard',/Countersong/]]){
  const c=make(kind);c.automation.enabled=false;
  const f=c.features.find(f=>f.id==='class-summary-'+c.classLevels[0].id);
  assert.match(f.description,rule);assert.ok(f.description.length<=20000);
  f.description='Level 1: My existing choices\nFull class reference: '+f.source+'\nMy campaign note';f.max=4;f.used=3;
  const before=structuredClone(c);recompute(c);
  assert.match(f.description,rule);assert.ok(f.description.startsWith(before.features.find(x=>x.id===f.id).description));
  before.features.find(x=>x.id===f.id).description=f.description;
  assert.deepEqual(c,before);recompute(c);assert.deepEqual(c,before);
 }
});

test('custom feature text is not mistaken for a generated card',()=>{
 const c=make();c.automation.enabled=false;
 const f=c.features.find(f=>f.id==='race-reference');f.description='My rewritten kenku rules';
 const g=c.features.find(f=>f.id.startsWith('class-summary-'));g.description='My rewritten class rules';
 const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);
});

test('enrichment never makes a nearly full personal description unsaveable',()=>{
 const c=make();c.automation.enabled=false;
 const f=c.features.find(f=>f.id==='race-reference'),g=c.features.find(f=>f.id.startsWith('class-summary-'));
 f.description=oldRaces.find(r=>r.id==='kenku').traits.join('\n\n').padEnd(19990,'x');
 g.description=('Full class reference: '+g.source).padEnd(19990,'x');
 const before=structuredClone(c);recompute(c);assert.deepEqual(c,before);
 assert.deepEqual(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})),c);
});
