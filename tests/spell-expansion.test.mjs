import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {expandSpellCatalog,unrecordedClassSpells} from '../lib/spell-catalog.ts';
import {newCharacter,newCaster,spellSchema} from '../lib/model.ts';
import {spellFormula,makeSpellRoll,scaledSpellText} from '../lib/rules.ts';
const read = path => JSON.parse(readFileSync(new URL('../'+path,import.meta.url),'utf8'));
const base=read('public/data/spells.json');
const expanded=expandSpellCatalog(base,read('public/data/supplemental-spells.json'));
test('expanded index has unique valid spells and preserves SRD rules',()=>{
 assert.ok(expanded.length>4000);
 assert.equal(new Set(expanded.map(s=>s.id)).size,expanded.length);
 for(const s of expanded)assert.ok(spellSchema.safeParse(s).success,s.id);
 for(const s of base){const found=expanded.find(x=>x.id===s.id);assert.equal(found.description,s.description);assert.equal(found.source,s.source);for(const [cls,level] of Object.entries(s.levels))assert.equal(found.levels[cls],level,s.id+' '+cls);}
 assert.equal(expanded.filter(s=>s.name.includes("Kelgore's Fire")).length,1);
});
test('Fire Bolt is usable by Duskblade and Wizard, scales to 5d6, and retains SR and save guidance',()=>{
 const s=expanded.find(s=>s.id==='supp-kelgore-s-fire-bolt');
 assert.equal(s.referenceOnly,false);assert.equal(s.levels.Duskblade,1);assert.equal(s.levels['Sorcerer / Wizard'],1);
 for(const [level,expected] of [[1,'1d6'],[3,'3d6'],[5,'5d6'],[20,'5d6']])assert.equal(spellFormula(s,level),expected);
 assert.equal(scaledSpellText(s.range,5),'150 ft. (medium)');
 const c=newCharacter('Wizard'),p=c.casters[0];p.level=5;
 const k={id:'bolt',spellId:s.id,level:1,slotLevel:1,prepared:1,spent:0,notes:'',formula:'',custom:null};
 const card=makeSpellRoll(c,p,k,s);
 assert.ok(card.fields.some(([key,value])=>key==='Spell resistance'&&value.includes('1d6')));
 assert.match(s.save,/Reflex half/);assert.match(s.description,/ashes/);
});
test('unverified compendium entries never automatically expand known class lists',()=>{
 const c=newCharacter('Wizard'),p=newCaster('Warmage');p.level=20;p.slots.forEach(s=>s.max=4);c.scores.CHA=20;
 const candidate={...expanded.find(s=>s.catalogOrigin==='compendium'),id:'unverified-warmage',levels:{Warmage:1}};
 assert.deepEqual(unrecordedClassSpells(c,p,[candidate]),[]);
 assert.ok(expanded.filter(s=>s.catalogOrigin==='compendium').every(s=>s.referenceOnly));
 const fireball=expanded.find(s=>s.id==='fireball');assert.ok(unrecordedClassSpells(c,p,[fireball]).length===1);
});
