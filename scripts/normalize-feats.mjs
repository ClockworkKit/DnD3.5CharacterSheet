import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {buildPrerequisiteCatalog} from './build-prerequisite-catalog.mjs';

const root = new URL('..', import.meta.url);
const path = name => new URL(name, root);
const featsPath = path('public/data/feats.json');

const categoryNames = new Set(['General', 'Item Creation', 'Metamagic', 'Special']);
const repeatable = new Set(['toughness', 'extra-turning', 'spell-mastery']);
const tagRules = [
  ['combat', /combat|attack|weapon|shield|armor|grapple|bull rush|disarm|trip|sunder|overrun|initiative|mounted|two-weapon|spring attack|whirlwind/i],
  ['metamagic', /\[Metamagic\]/i],
  ['item-creation', /\[Item Creation\]/i],
  ['psionic', /psionic|power point|manifester/i],
  ['skill', /skill focus|skill check|\bskills?\b/i],
  ['spellcasting', /spell|caster level|spell-like/i],
  ['racial', /dwarf|elf|gnome|halfling|racial/i],
];

function category(name) {
  const match = name.match(/\[([^\]]+)\]/);
  return match && categoryNames.has(match[1]) ? match[1] : 'General';
}

function prerequisites(description) {
  const match = description.match(/Prerequisites?:\s*([\s\S]*?)(?=\n\s*\n|\b(?:Benefits?|Normal|Special):|$)/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

function specialConditions(description) {
  const match = description.match(/Special:\s*([\s\S]*?)(?=\n\s*(?:Prerequisites?|Benefits?|Normal):|$)/i);
  return match ? match[1].trim().replace(/\s+/g, ' ') : '';
}

function tags(feat) {
  const result = new Set([feat.category.toLowerCase().replace(/\s+/g, '-')]);
  for (const [tag, rule] of tagRules) if (rule.test(`${feat.name} ${feat.description}`)) result.add(tag);
  if (feat.repeatable) result.add('repeatable');
  if (feat.prerequisites) result.add('has-prerequisites');
  if (feat.specialConditions) result.add('has-special-conditions');
  return [...result].sort();
}

export function normalizeFeat(input) {
  const feat = {...input};
  feat.category = category(feat.name);
  feat.prerequisites = prerequisites(feat.description);
  feat.repeatable = repeatable.has(feat.id) || /(?:gain|take) (?:this|the) feat multiple times|each time you take (?:this|the) feat/i.test(feat.description);
  feat.specialConditions = specialConditions(feat.description);
  feat.tags = tags(feat);
  return feat;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const feats = JSON.parse(fs.readFileSync(featsPath, 'utf8')).map(normalizeFeat);
  fs.writeFileSync(featsPath, `${JSON.stringify(feats)}\n`);
  buildPrerequisiteCatalog();
  console.log(`Normalized ${feats.length} feat records.`);
}
