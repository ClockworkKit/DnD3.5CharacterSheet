import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {addEligibleFeat, featEligibility, prestigeEligibility} from '../lib/prerequisites.ts';
import {classCatalog, findClass, makeCaster, makePsionic} from '../lib/classes.ts';
import {recompute} from '../lib/automation.ts';

const feats = JSON.parse(readFileSync(new URL('../public/data/feats.json', import.meta.url)));
const feat = id => feats.find(row => row.id === id);
const create = (kind = 'Fighter', level = 1, raceId = 'human', scores = {}) => createPlayerCharacter({
  name: 'Prerequisite Boundary', kind, level, raceId, method: 'manual',
  scores: {STR: 14, DEX: 14, CON: 14, INT: 14, WIS: 14, CHA: 14, ...scores},
});
const grant = (c, name, choice = '') => c.features.push({id: crypto.randomUUID(), name, choice, kind: 'Feat', description: '', max: 0, used: 0, source: ''});
const ranks = (c, name, value) => {
  let skill = c.skills.find(row => row.name === name);
  if (!skill) {
    skill = {id: crypto.randomUUID(), name, ability: 'INT', ranks: 0, misc: 0, trained: false, armor: 0, classSkill: false};
    c.skills.push(skill);
  }
  skill.ranks = value;
};
const addClass = (c, id, level) => {
  const definition = findClass(id);
  c.classLevels.push({id: crypto.randomUUID(), classId: definition.id, name: definition.name, level, notes: ''});
  if (definition.casting || definition.levels.some(row => row.slots)) c.casters.push(makeCaster(definition, level, c.scores[definition.casting?.ability || 'WIS']));
  if (definition.manifesting || definition.kind === 'Psionic') c.psionics.push(makePsionic(definition, level, c.scores[definition.manifesting?.ability || (id === 'psion' ? 'INT' : id === 'wilder' ? 'CHA' : 'WIS')]));
  recompute(c);
};
const qualify = (c, id) => prestigeEligibility(c, findClass(id));
const hasMissing = (result, text) => assert.ok(result.requirements.some(row => row.state === 'missing' && row.label.includes(text)), `${text} should be missing`);

test('ability prerequisites fail one point below, pass exactly, and retain higher scores', () => {
  const cases = [[12, false], [13, true], [18, true]];
  for (const [score, expected] of cases) {
    const c = create('Fighter', 1, 'human', {DEX: score});
    assert.equal(featEligibility(c, feat('dodge')).eligible, expected, `Dodge at Dex ${score}`);
  }
  const int13 = create('Fighter', 1, 'human', {INT: 13});
  assert.equal(featEligibility(int13, feat('combat-expertise')).eligible, true);
  int13.scores.INT = 12;
  assert.equal(featEligibility(int13, feat('combat-expertise')).eligible, false);
});

test('BAB prerequisites use exact totals, multiclass totals, and overrides', () => {
  const below = create('Wizard', 1);
  assert.equal(featEligibility(below, feat('quick-draw')).eligible, false);
  const exact = create('Fighter', 1);
  assert.equal(featEligibility(exact, feat('quick-draw')).eligible, true);
  const multiclass = create('Wizard', 1);
  addClass(multiclass, 'Fighter', 2);
  multiclass.automation.enabled = true;
  multiclass.automation.overrides.bab = 1;
  assert.equal(featEligibility(multiclass, feat('quick-draw')).eligible, true);
  multiclass.automation.overrides.bab = 0;
  assert.equal(featEligibility(multiclass, feat('quick-draw')).eligible, false);
});

test('skill prerequisites use ranks at the boundary and ignore misc bonus inflation', () => {
  const c = create('Rogue', 1);
  ranks(c, 'Hide', 7);
  c.skills.find(row => row.name === 'Hide').misc = 50;
  const below = qualify(c, 'assassin');
  hasMissing(below, 'Hide 8');
  ranks(c, 'Hide', 8);
  ranks(c, 'Move Silently', 8);
  ranks(c, 'Disguise', 4);
  c.alignment = 'NE';
  const exact = qualify(c, 'assassin');
  assert.equal(exact.status, 'Needs confirmation');
});

test('feat chains require every AND prerequisite and accept normalized imported names and choices', () => {
  const c = create('Fighter', 8, 'human', {STR: 13});
  grant(c, 'Power Attack [General]');
  assert.equal(featEligibility(c, feat('cleave')).eligible, true);
  grant(c, 'Improved Sunder [General]');
  assert.equal(qualify(c, 'blackguard').eligible, false);
  grant(c, 'Cleave [General]');
  ranks(c, 'Hide', 5);
  ranks(c, 'Knowledge (religion)', 2);
  c.alignment = 'LE';
  assert.equal(qualify(c, 'blackguard').status, 'Needs confirmation');
  grant(c, 'Weapon Focus (Longbow) [General]', '');
  assert.equal(featEligibility(c, feat('greater-weapon-focus'), 'Longbow').eligible, true);
});

test('non-repeatable feats remain unavailable while explicitly repeatable feats remain selectable', () => {
  const c = create('Fighter', 1);
  grant(c, 'Dodge');
  assert.equal(featEligibility(c, feat('dodge')).eligible, false);
  grant(c, 'Toughness');
  assert.equal(featEligibility(c, feat('toughness')).eligible, true);
  addEligibleFeat(c, feat('skill-focus'), 'Spot');
  assert.equal(featEligibility(c, feat('skill-focus'), 'Listen').eligible, true);
  assert.equal(featEligibility(c, feat('skill-focus'), 'Spot').eligible, false);
  assert.equal(feat('skill-focus').repeatable, true);
  assert.equal(feat('rapid-reload').repeatable, true);
});

test('race and subtype requirements distinguish qualifying elves, half-elves, and other humanoids', () => {
  const required = create('Fighter', 6, 'elf', {DEX: 14});
  grant(required, 'Point Blank Shot');
  grant(required, 'Precise Shot');
  grant(required, 'Weapon Focus', 'Longbow');
  addClass(required, 'Wizard', 1);
  required.casters[0].spells.push({id: crypto.randomUUID(), spellId: 'mage-hand', level: 0, slotLevel: 0, prepared: 1, spent: 0, formula: '', notes: '', custom: null});
  recompute(required);
  assert.equal(qualify(required, 'arcane-archer').eligible, true);
  const halfElf = structuredClone(required);
  halfElf.ancestry.raceId = 'half-elf'; halfElf.race = 'Half-Elf';
  assert.equal(qualify(halfElf, 'arcane-archer').eligible, true);
  const wrongRace = create('Fighter', 6, 'human');
  wrongRace.classLevels = structuredClone(required.classLevels);
  wrongRace.casters = structuredClone(required.casters);
  wrongRace.features = structuredClone(required.features);
  wrongRace.race = 'Human';
  assert.equal(qualify(wrongRace, 'arcane-archer').eligible, false);
});

test('alignment checks cover ethical, moral, prohibited, and non-aligned families', () => {
  const c = create('Fighter', 7, 'dwarf');
  for (const name of ['Dodge', 'Endurance', 'Toughness']) grant(c, name);
  for (const [alignment, expected] of [['LG', true], ['LN', true], ['NG', false], ['CG', false]]) {
    c.alignment = alignment;
    assert.equal(qualify(c, 'dwarven-defender').eligible, expected, `Dwarven Defender at ${alignment}`);
  }
  const pyromancer = create('Psion', 4, 'human');
  ranks(pyromancer, 'Concentration', 8); ranks(pyromancer, 'Craft (alchemy)', 1); ranks(pyromancer, 'Knowledge (psionics)', 2);
  pyromancer.alignment = 'CN';
  assert.equal(qualify(pyromancer, 'pyrokineticist').status, 'Needs confirmation');
  pyromancer.alignment = 'LN';
  assert.equal(qualify(pyromancer, 'pyrokineticist').eligible, false);
});

test('arcane and divine spellcasting are distinct, with exact spell-level boundaries', () => {
  const arcane = create('Wizard', 3);
  addClass(arcane, 'Cleric', 3);
  ranks(arcane, 'Knowledge (arcana)', 6); ranks(arcane, 'Knowledge (religion)', 6);
  assert.equal(qualify(arcane, 'mystic-theurge').eligible, true);
  const divineOnly = create('Cleric', 3);
  ranks(divineOnly, 'Knowledge (arcana)', 6); ranks(divineOnly, 'Knowledge (religion)', 6);
  hasMissing(qualify(divineOnly, 'mystic-theurge'), '2nd-level arcane');
  const low = create('Wizard', 4);
  low.scores.INT = 16;
  addClass(low, 'Fighter', 1);
  hasMissing(qualify(low, 'eldritch-knight'), '3rd-level arcane');
  low.classLevels[0].level = 5; recompute(low);
  assert.equal(qualify(low, 'eldritch-knight').eligible, true);
});

test('specific spell requirements and prepared-versus-spontaneous restrictions are exercised', () => {
  const c = create('Wizard', 5);
  addClass(c, 'Rogue', 3);
  c.casters[0].spells.push({id: crypto.randomUUID(), spellId: 'mage-hand', level: 0, slotLevel: 0, prepared: 1, spent: 0, formula: '', notes: '', custom: null});
  ranks(c, 'Decipher Script', 7); ranks(c, 'Disable Device', 7); ranks(c, 'Escape Artist', 7); ranks(c, 'Knowledge (arcana)', 4);
  c.alignment = 'NG';
  const result = qualify(c, 'arcane-trickster');
  assert.equal(result.eligible, true);
  c.casters[0].spells = [];
  hasMissing(qualify(c, 'arcane-trickster'), 'mage hand');
  ranks(c, 'Knowledge (arcana)', 8); c.languages = 'Draconic';
  hasMissing(qualify(c, 'dragon-disciple'), 'without preparation');
  c.casters[0].mode = 'spontaneous';
  assert.equal(qualify(c, 'dragon-disciple').status, 'Needs confirmation');
});

test('psionic qualification requires BAB, available power levels, and a reserve', () => {
  const c = create('Psion', 5);
  ranks(c, 'Concentration', 8); grant(c, 'Mobility'); grant(c, 'Spring Attack');
  assert.equal(qualify(c, 'elocater').eligible, false);
  c.classLevels[0].level = 6; recompute(c); ranks(c, 'Concentration', 8);
  assert.equal(qualify(c, 'elocater').eligible, true);
  const noReserve = create('Fighter', 4);
  ranks(noReserve, 'Knowledge (dungeoneering)', 4); grant(noReserve, 'Track');
  hasMissing(qualify(noReserve, 'slayer'), 'power point reserve');
  grant(noReserve, 'Wild Talent');
  assert.equal(qualify(noReserve, 'slayer').eligible, true);
});

test('structured special-ability prerequisites stay manual rather than granting false qualification', () => {
  const c = create('Rogue', 5);
  ranks(c, 'Disguise', 4); ranks(c, 'Hide', 8); ranks(c, 'Move Silently', 8); c.alignment = 'NE';
  assert.equal(qualify(c, 'assassin').status, 'Needs confirmation');
  const monk = create('Monk', 6);
  ranks(monk, 'Concentration', 9);
  grant(monk, 'Wild Talent');
  assert.equal(qualify(monk, 'psionic-fist').eligible, true);
  const lowMonk = create('Monk', 2);
  ranks(lowMonk, 'Concentration', 9); grant(lowMonk, 'Wild Talent');
  assert.equal(qualify(lowMonk, 'psionic-fist').eligible, false);
});

test('every prestige class exposes a stable qualification result without mutating the candidate', () => {
  const c = create('Wizard', 20);
  const prestige = classCatalog.filter(d => d.kind === 'Prestige');
  assert.ok(prestige.length >= 24);
  const before = structuredClone(c);
  for (const {id} of prestige) {
    const result = qualify(c, id);
    assert.ok(['Eligible', 'Missing prerequisites', 'Needs confirmation'].includes(result.status), id);
    assert.ok(result.requirements.length > 0, id);
  }
  assert.deepEqual(c, before);
});
