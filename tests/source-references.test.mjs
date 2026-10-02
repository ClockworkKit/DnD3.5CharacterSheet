import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {syncSourceReferences,characterSourceReferences} from '../lib/source-references.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
const make=(kind='Factotum',raceId='kenku')=>createPlayerCharacter({name:'Source check',kind,level:3,raceId,scores:{STR:12,DEX:14,CON:12,INT:18,WIS:14,CHA:16},method:'manual'});

test('requested class and race rules are embedded and portable, not just links',()=>{
 for(const kind of ['Factotum','Rogue','Sorcerer','Cleric','Bard'])for(const raceId of ['kenku','illumian','aquatic-kobold','mountain-dwarf','elf','gray-elf','wood-elf']){
  const c=make(kind,raceId),refs=c.sourceReferences;
  assert.equal(refs.length,2,kind+' '+raceId);
  for(const ref of refs){assert.ok(ref.text.length>500,ref.id);assert.ok(ref.book,ref.id);assert.equal(new URL(ref.url).hostname,'srd.dndtools.org');}
  const loaded=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}));
  assert.deepEqual(loaded.sourceReferences,refs);recompute(loaded);assert.deepEqual(loaded.sourceReferences,refs);
 }
 assert.match(make().sourceReferences[0].text,/Cunning Knowledge/);
 assert.match(make().sourceReferences[1].text,/\+3 rather than \+2/);
 assert.match(make('Rogue','illumian').sourceReferences[1].text,/single class/);
});

test('legacy characters gain references without changing manual values, notes, or spent uses',()=>{
 const old=make();delete old.sourceReferences;old.automation.enabled=false;old.notes='Keep my story';old.classLevels[0].notes='Personal choices';old.factotum.spent=2;old.hp=1;
 const c=characterSchema.parse(old),before=structuredClone(c);activateAutomation(c);
 const {sourceReferences,...rest}=c;const {sourceReferences:unused,...previous}=before;
 assert.equal(unused.length,0);assert.equal(sourceReferences.length,2);assert.deepEqual(rest,previous);
 syncSourceReferences(c);assert.deepEqual(characterSourceReferences(c),sourceReferences);
});

test('changing identities removes stale references without applying racial or class mechanics',()=>{
 const c=make();c.classLevels=[];c.classes='Bard 3 / Sorcerer 1';c.ancestry.raceId='';c.race='Mountain Dwarf';
 const before=structuredClone(c);syncSourceReferences(c);
 assert.deepEqual(c.sourceReferences.map(r=>r.id),['class:bard','class:sorcerer','race:mountain-dwarf']);
 const {sourceReferences,...rest}=c;delete before.sourceReferences;assert.deepEqual(rest,before);
 c.classes='Unknown 3';c.race='Unknown';syncSourceReferences(c);assert.deepEqual(c.sourceReferences,[]);
 c.race='Moon Elf';syncSourceReferences(c);assert.equal(c.sourceReferences[0].id,'race:moon-elf');assert.equal(c.ancestry.raceId,'');
 assert.equal(sourceReferences.length,3);
});
