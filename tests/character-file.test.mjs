import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const character = createPlayerCharacter({name:'Backup hero',kind:'Wizard',level:1,raceId:'dwarf',method:'manual',scores:{STR:10,DEX:14,CON:12,INT:18,WIS:12,CHA:8}});
const envelope = {format:'barrow-ledger-character',version:1,data:character};

test('character files preserve current exports and legacy raw or wrapped characters', () => {
  for (const file of [envelope, character, {data:character}]) {
    assert.deepEqual(parseCharacterFile(JSON.stringify(file)), character);
  }
});

test('unsupported envelopes are rejected even when their character payload is valid', () => {
  assert.throws(() => parseCharacterFile(JSON.stringify({...envelope,format:'unrelated-app'})), /not a Barrow Ledger/);
  for (const version of [0,2,999,'1',null]) {
    assert.throws(() => parseCharacterFile(JSON.stringify({...envelope,version})), /version is not supported/);
  }
  assert.throws(() => parseCharacterFile(JSON.stringify({format:envelope.format,data:character})), /version is not supported/);
  assert.throws(() => parseCharacterFile(JSON.stringify({format:envelope.format,version:1})), /missing its character data/);
});

test('malformed imports report actionable errors and never fall back from invalid data', () => {
  assert.throws(() => parseCharacterFile('{broken'), /not valid JSON/);
  for (const file of [null, [], 42, 'text', {}, {...envelope,data:null}, {...envelope,data:{}}, {...character,data:null}]) {
    assert.throws(() => parseCharacterFile(JSON.stringify(file)), /not a valid Barrow Ledger/);
  }
});
