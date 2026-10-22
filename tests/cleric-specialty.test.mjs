import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {applyClericSpecialty} from '../lib/cleric-specialty.ts';
import {characterSchema} from '../lib/model.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';

const create=(kind='Cleric')=>createPlayerCharacter({name:'Specialty QA',kind,level:5,raceId:'human',scores:{STR:12,DEX:12,CON:12,INT:14,WIS:18,CHA:14},method:'manual'});
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('choosing a specialty without cleric levels fails without changing the character',()=>{
 const c=create('Factotum'),before=snapshot(c);
 assert.throws(()=>applyClericSpecialty(c,'axe-brother'),/Cleric level/);
 assert.deepEqual(snapshot(c),before);
});

test('Axe Brother reuses an unlinked legacy cleric book without refilling slots or replacing spells',()=>{
 const c=create(),p=c.casters[0];delete p.casting;p.name='My prayers';p.level=7;p.slots[1].used=2;p.notes='Existing notes';
 p.spells.push({id:'prayer',spellId:'bless',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Keep this',custom:null});
 const before=snapshot(p);applyClericSpecialty(c,'axe-brother');
 assert.equal(c.casters.length,1);assert.equal(c.casters[0].id,before.id);
 const after=snapshot(p);after.spells=after.spells.filter(s=>s.spellId!=='silverbeard');assert.deepEqual(after,before);
 assert.equal(p.spells.at(-1).prepared,0);assert.equal(p.spells.at(-1).spent,0);
 applyClericSpecialty(c,'none');applyClericSpecialty(c,'axe-brother');assert.equal(p.spells.length,2);
 assert.deepEqual(snapshot(characterSchema.parse(snapshot(c))),snapshot(c));
});

test('ambiguous cleric books require review rather than receiving an arbitrary spell or a new slot pool',()=>{
 const c=create();const second=structuredClone(c.casters[0]);second.id='second';c.casters.push(second);const before=snapshot(c);
 assert.throws(()=>applyClericSpecialty(c,'axe-brother'),/multiple|more than one/i);assert.deepEqual(snapshot(c),before);
});

test('domain books and explicitly different classes are not used as ordinary cleric books',()=>{
 const c=create(),other=c.casters[0];other.casting.classId='wizard';other.name='Cleric';
 const domain=structuredClone(other);domain.id='domain-only';domain.casting.classId='cleric';domain.casting.domain=true;c.casters.push(domain);
 const before=snapshot(c.casters);applyClericSpecialty(c,'axe-brother');
 assert.equal(c.casters.length,3);assert.deepEqual(snapshot(c.casters.slice(0,2)),before);
 assert.equal(c.casters[2].casting.classId,'cleric');assert.equal(c.casters[2].spells[0].spellId,'silverbeard');
});

test('an imported cleric keeps later progress, domain resources and spent Silverbeard when switching specialties',async()=>{
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-22',character:{id:'cleric-test',name:'Cleric test'},attributes:Object.entries({class1:'Cleric',level1:3,wis:18,hp:10,hp_max:20,divinespells1:4,divinespells1_used:1,repeating_spells11_BLESS_spellname11:'Bless',repeating_spells11_BLESS_spellprep11:2,repeating_spells11_BLESS_spellused11:1}).map(([name,current])=>({name,current,max:''}))};
 const c=await prepareCharacter(importRoll20(raw).character);c.classLevels[0].level=5;c.notes='Later progress';c.factotum.spent=2;
 applyClericSpecialty(c,'axe-brother');const p=c.casters.find(p=>!p.casting?.domain),s=p.spells.find(s=>s.spellId==='silverbeard');s.prepared=2;s.spent=1;
 const domain=structuredClone(p);domain.id='domain';domain.casting.domain=true;domain.spells=[];domain.slots[1].used=1;c.casters.push(domain);
 const before=snapshot(c);applyClericSpecialty(c,'none');applyClericSpecialty(c,'axe-brother');assert.deepEqual(snapshot(c),before);assert.deepEqual(c.roll20Import.raw,raw);
});
