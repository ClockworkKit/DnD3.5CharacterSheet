import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spellSchema} from '../lib/model.ts';
import {normalizeFeat} from '../scripts/normalize-feats.mjs';
import {expandSpellCatalog} from '../lib/spell-catalog.ts';

const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const unique = (rows, field) => rows.map(row => row[field]).filter((value, index, all) => all.indexOf(value) !== index);

test('reference catalogs have unique identities and complete structured rows', () => {
  const catalogs = [
    ['public/data/feats.json', ['id', 'name', 'description', 'source', 'category', 'prerequisites', 'repeatable', 'specialConditions', 'tags']],
    ['public/data/spells.json', ['id', 'name', 'school', 'levels', 'levelText', 'components', 'castingTime', 'range', 'target', 'duration', 'save', 'resistance', 'description', 'source']],
    ['public/data/powers.json', ['id', 'name', 'school', 'levels', 'levelText', 'cost', 'display', 'manifesting', 'range', 'target', 'duration', 'save', 'resistance', 'description', 'source']],
    ['public/data/invocations.json', ['id', 'name', 'classId', 'grade', 'level', 'category', 'source']],
    ['public/data/races.json', ['id', 'name', 'group', 'source']],
    ['lib/equipment-data.json', ['id', 'name', 'kind', 'category', 'source']],
  ];
  for (const [file, fields] of catalogs) {
    const rows = read(file);
    assert.deepEqual(unique(rows, 'id'), [], `${file} has duplicate IDs`);
    for (const row of rows) for (const field of fields) assert.ok(row[field] !== undefined && row[field] !== null, `${file}: ${row.id} lacks ${field}`);
  }
});

test('feat metadata is reproducible and retains every special-condition paragraph', () => {
  const feats = read('public/data/feats.json');
  assert.deepEqual(feats.map(normalizeFeat), feats);
  const martial = feats.find(f => f.id === 'martial-weapon-proficiency');
  assert.match(martial.specialConditions, /cleric/i);
  assert.match(martial.specialConditions, /multiple times/i);
});

test('expanded spells validate and reference catalogs retain distinct class-specific invocations', () => {
  const spells = expandSpellCatalog(read('public/data/spells.json'), read('public/data/supplemental-spells.json'));
  assert.deepEqual(unique(spells, 'id'), []);
  for (const spell of spells) assert.equal(spellSchema.safeParse(spell).success, true, spell.id);
  const classes = new Set(read('public/data/classes.json').map(c => c.id));
  const invocations = read('public/data/invocations.json');
  const identities = new Set();
  for (const row of invocations) {
    assert.ok(classes.has(row.classId), row.id);
    const key = row.classId + ':' + row.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    assert.ok(!identities.has(key), row.id);
    identities.add(key);
  }
  assert.equal(invocations.filter(row => row.name.toLowerCase() === 'beguiling influence').length, 2);
});

test('feat prerequisite index matches the enriched feat catalog', () => {
  const feats = read('public/data/feats.json');
  const index = read('lib/prerequisite-catalog.json').feats;
  assert.deepEqual(index.map(f => f.id), feats.map(f => f.id));
  assert.deepEqual(index.map(f => f.tags), feats.map(f => f.tags));
  assert.deepEqual(index.map(f => f.prerequisites), feats.map(f => f.prerequisites));
  assert.deepEqual(index.map(f => ({category: f.category, repeatable: f.repeatable, specialConditions: f.specialConditions})), feats.map(f => ({category: f.category, repeatable: f.repeatable, specialConditions: f.specialConditions})));
});

test('supplemental class tables contain no known transcription errors', () => {
  const classes = read('lib/supplemental-class-data.json');
  const text = classes.flatMap(c => c.levels.map(row => row.special)).join('\n');
  assert.doesNotMatch(text, /relisience|Aura of unlucky|Sustaining Shadow\(/);
  assert.match(text, /Fiendish resilience/);
});
