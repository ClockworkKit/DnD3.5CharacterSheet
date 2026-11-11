import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {casterLibraryList, expandSpellCatalog, spellListLevel} from '../lib/spell-catalog.ts';
import {findClass, makeCaster} from '../lib/classes.ts';

const spells=JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url),'utf8'));
test('linked default books find their class entries as well as shared spells', () => {
  const extensions = JSON.parse(readFileSync(new URL('../public/data/supplemental-spells.json', import.meta.url)));
  const catalog = expandSpellCatalog(spells, extensions);
  const wizard = makeCaster(findClass('wizard'));
  const sorcerer = makeCaster(findClass('sorcerer'));
  const fusion = catalog.find(spell => spell.name === 'Arcane Fusion');
  const backlash = catalog.find(spell => spell.name === 'Backlash');
  assert.equal(wizard.list, 'Sorcerer / Wizard');
  assert.equal(sorcerer.list, wizard.list);
  assert.equal(spellListLevel(fusion, casterLibraryList(sorcerer)), 5);
  assert.equal(spellListLevel(fusion, casterLibraryList(wizard)), undefined);
  assert.equal(spellListLevel(backlash, casterLibraryList(wizard)), 2);
  assert.equal(spellListLevel(backlash, casterLibraryList(sorcerer)), 4);
});

test('list lookup uses recorded class identity and respects domain, custom and manual lists', () => {
  const book = makeCaster(findClass('wizard'));
  book.name = 'Personal grimoire';
  assert.equal(casterLibraryList(book), 'Wizard');
  for (const list of ['Strength', 'Sorcerer', 'Campaign list']) {
    assert.equal(casterLibraryList({...book, list}), list);
  }
  const shared = 'Sorcerer / Wizard';
  assert.equal(casterLibraryList({...book, casting: undefined, name: 'Wizard'}), shared);
  assert.equal(casterLibraryList({...book, casting: {...book.casting, domain: true}}), shared);
  assert.equal(casterLibraryList({...book, casting: {...book.casting, classId: 'custom-wizard'}}), shared);
});
test('Wizard and Sorcerer filters include shared SRD spells at their recorded levels',()=>{
 const missile=spells.find(s=>s.id==='magic-missile'),light=spells.find(s=>s.id==='light');
 for(const list of ['Wizard','Sorcerer','Sorcerer / Wizard']){
  assert.equal(spellListLevel(missile,list),1);
  assert.equal(spellListLevel(light,list),0);
  const shared=spells.filter(s=>s.levels['Sorcerer / Wizard']!==undefined);
  assert.ok(shared.length>100);
  for(const s of shared)assert.equal(spellListLevel(s,list),s.levels[list]??s.levels['Sorcerer / Wizard'],s.name);
 }
});
test('specific list levels override shared entries without widening exclusive access',()=>{
 const entries={levels:{Wizard:2,'Sorcerer / Wizard':4,Bard:1}};
 assert.equal(spellListLevel(entries,'Wizard'),2);
 assert.equal(spellListLevel(entries,'Sorcerer'),4);
 assert.equal(spellListLevel(entries,'Sorcerer / Wizard'),4);
 assert.equal(spellListLevel(entries,'Bard'),1);
 const wizardOnly={levels:{Wizard:0}},sorcererOnly={levels:{Sorcerer:1}};
 assert.equal(spellListLevel(wizardOnly,'Wizard'),0);
 assert.equal(spellListLevel(wizardOnly,'Sorcerer'),undefined);
 assert.equal(spellListLevel(wizardOnly,'Sorcerer / Wizard'),undefined);
 assert.equal(spellListLevel(sorcererOnly,'Wizard'),undefined);
 assert.equal(spellListLevel(sorcererOnly,'Sorcerer / Wizard'),undefined);
});
test('unrelated classes, domains and custom list names retain exact lookup and catalog data is not rewritten',()=>{
 const s=spells.find(s=>s.id==='scrying'),before=structuredClone(s);
 for(const list of ['Cleric','Druid','Bard'])assert.equal(spellListLevel(s,list),s.levels[list]);
 for(const list of ['Evocation','Arcane','Domain','My Wizard','custom-wizard',''])assert.equal(spellListLevel(s,list),undefined);
 const custom={levels:{'My Wizard':0,'Sorcerer / Wizard':2}};
 assert.equal(spellListLevel(custom,'My Wizard'),0);
 assert.deepEqual(s,before);
});
