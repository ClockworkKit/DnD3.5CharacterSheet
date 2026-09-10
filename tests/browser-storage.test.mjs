import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {newCharacter,characterSchema} from '../lib/model.ts';
import {activateAutomation} from '../lib/automation.ts';

function environment() {
  const values = new Map(), tails = new Map();
  let sequence = 0, failWrite = false;
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => {
      if (failWrite) throw new Error('QuotaExceededError');
      values.set(key, value);
    },
  };
  const options = {
    scope: '/DnD3.5CharacterSheet/',
    storage: () => storage,
    lock: (name, operation) => {
      const result = (tails.get(name) ?? Promise.resolve()).then(operation);
      tails.set(name, result.catch(() => {}));
      return result;
    },
    id: () => 'character-' + ++sequence,
    now: () => '2026-09-10T00:00:00.000Z',
  };
  return {options, values, setFailWrite: value => {failWrite = value;}, api: createBrowserCharacterApi(options)};
}
const route = '/api/characters';
const character = () => activateAutomation(newCharacter('Wizard', 5, 'elf'), false);
const body = (method, data, revision) => ({method, body: JSON.stringify({data, revision})});

test('browser characters survive a fresh client, preserve calculated resources, and export/import', async () => {
  const env = environment(), data = character();
  data.hp -= 8; data.casters[0].slots[1].used = 2;
  const row = await env.api(route, body('POST', data));
  const reopened = createBrowserCharacterApi(env.options);
  assert.deepEqual((await reopened(route)).characters, [row]);
  const saved = await reopened(route + '/' + row.id);
  assert.deepEqual(saved.data, data);
  const imported = characterSchema.parse(JSON.parse(JSON.stringify({data: saved.data})).data);
  const copy = await reopened(route, body('POST', imported));
  assert.notEqual(copy.id, row.id);
  assert.deepEqual((await reopened(route + '/' + copy.id)).data, data);
});

test('simultaneous tab updates serialize and reject the stale revision', async () => {
  const env = environment(), tab = createBrowserCharacterApi(env.options), data = character();
  const row = await env.api(route, body('POST', data));
  const results = await Promise.allSettled([
    env.api(route + '/' + row.id, body('PUT', {...data, name: 'First edit'}, row.revision)),
    tab(route + '/' + row.id, body('PUT', {...data, name: 'Stale edit'}, row.revision)),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].status, 'rejected');
  assert.match(results[1].reason.message, /newer revision/);
  assert.equal((await tab(route + '/' + row.id)).data.name, 'First edit');
  await assert.rejects(tab(route + '/' + row.id, body('DELETE', undefined, 1)), /newer revision/);
});

test('concurrent new characters are retained and deletion targets only the current revision', async () => {
  const env = environment(), tab = createBrowserCharacterApi(env.options), data = character();
  const rows = await Promise.all([env.api(route, body('POST', data)), tab(route, body('POST', {...data, name: 'Second character'}))]);
  assert.equal((await env.api(route)).characters.length, 2);
  await env.api(route + '/' + rows[0].id, body('DELETE', undefined, 1));
  assert.deepEqual((await tab(route)).characters, [rows[1]]);
  await assert.rejects(tab(route + '/' + rows[0].id, body('PUT', data, 1)), /deleted/);
  assert.equal((await tab(route)).characters.length, 1);
});

test('blocked, full, malformed, and newer-format browser storage never report a successful save', async () => {
  const env = environment(), data = character(), row = await env.api(route, body('POST', data));
  const before = new Map(env.values);
  env.setFailWrite(true);
  await assert.rejects(env.api(route + '/' + row.id, body('PUT', {...data, name: 'Unsaved'}, 1)), /could not save/);
  assert.deepEqual(env.values, before);
  env.setFailWrite(false);
  const key = [...env.values.keys()][0];
  for (const raw of ['broken json', JSON.stringify({format: 'barrow-ledger-browser', version: 99, characters: []})]) {
    env.values.set(key, raw);
    await assert.rejects(env.api(route), /has not been changed/);
    await assert.rejects(env.api(route, body('POST', data)), /has not been changed/);
    assert.equal(env.values.get(key), raw);
  }
  const blocked = createBrowserCharacterApi({...env.options, storage: () => {throw new Error('Denied');}});
  await assert.rejects(blocked(route), /storage is unavailable/);
});

test('validation, unsupported requests, and project scoping protect existing browser records', async () => {
  const env = environment(), data = character(), row = await env.api(route, body('POST', data));
  const before = new Map(env.values);
  await assert.rejects(env.api(route, body('POST', {...data, name: 'x'.repeat(10000)})), /character fields/);
  await assert.rejects(env.api(route + '/' + row.id, body('PUT', data)), /revision/);
  await assert.rejects(env.api(route, {method: 'POST', body: 'null'}), /valid JSON/);
  await assert.rejects(env.api('/api/not-characters'), /Unknown/);
  await assert.rejects(env.api(route, {method: 'DELETE', body: '{}'}), /Unsupported/);
  assert.deepEqual(env.values, before);
  const other = createBrowserCharacterApi({...env.options, scope: '/another-project/'});
  assert.deepEqual((await other(route)).characters, []);
  await other(route, body('POST', data));
  assert.equal((await env.api(route)).characters.length, 1);
});
