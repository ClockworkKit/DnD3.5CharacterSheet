import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,uid} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {chooseDilettante,castDilettante,factotumNumbers} from '../lib/factotum.ts';
import {makeDilettanteRoll} from '../lib/factotum-rolls.ts';
import {makeRequest} from '../lib/rules.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {applyClericSpecialty} from '../lib/cleric-specialty.ts';

const spells=JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url)));
const spell=id=>spells.find(s=>s.id===id);
const create=(level=4)=>createPlayerCharacter({name:'Dilettante QA',kind:'Factotum',level,raceId:'human',scores:{STR:12,DEX:14,CON:12,INT:18,WIS:16,CHA:10},method:'manual'});
const snapshot=c=>JSON.parse(JSON.stringify(c));

test('Dilettante cards roll supported effects at Factotum caster level and leave resources untouched until accepted',()=>{
 const c=create();chooseDilettante(c,spell('magic-missile'));const before=snapshot(c);
 const r=makeDilettanteRoll(c,spell('magic-missile')),fields=Object.fromEntries(r.fields);
 assert.equal(r.formula,'2d4+2');assert.equal(fields.Range,'140 ft. (medium)');assert.equal(fields.Save,'None');
 assert.equal(fields['Caster level'],'4');assert.deepEqual(snapshot(c),before);
 const request=makeRequest(r,c.name,'https://example.com/sheet');assert.match(request.message,/\[\[2d4\+2\]\]/);
 castDilettante(c,spell('magic-missile').id);assert.equal(c.factotum.spent,1);assert.equal(c.factotum.spells[0].spent,true);
 const spent=snapshot(c);assert.throws(()=>castDilettante(c,spell('magic-missile').id));assert.deepEqual(snapshot(c),spent);
});

test('Dilettante saves use Intelligence, non-damaging spells do not invent dice, and range/duration scale',()=>{
 const c=create(8),fireball=makeDilettanteRoll(c,spell('fireball'));assert.equal(fireball.formula,'8d6');
 assert.match(Object.fromEntries(fireball.fields).Save,/DC 17/);
 const shield=makeDilettanteRoll(c,spell('shield'));assert.equal(shield.formula,undefined);assert.equal(Object.fromEntries(shield.fields).Duration,'8 min. (D)');
 assert.throws(()=>makeDilettanteRoll(c,{...spell('shield'),levels:{Cleric:1}}),/sorcerer\/wizard/);
});

test('Factotum/Cleric Axe Brother multiclassing does not share slots or reset daily uses on load and advancement',async()=>{
 const c=create();chooseDilettante(c,spell('magic-missile'));chooseDilettante(c,spell('detect-magic'));
 castDilettante(c,'magic-missile');c.factotum.knowledgeUsed=['skill-1'];c.factotum.pietyUsed=1;c.factotum.dodgeUsed=true;
 c.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:3,notes:'Campaign specialty'});recompute(c);applyClericSpecialty(c,'axe-brother');
 const cleric=c.casters[0];cleric.slots[1].used=1;cleric.spells[0].prepared=2;cleric.spells[0].spent=1;c.hp-=5;
 const counters=snapshot(c.factotum),book=snapshot(cleric),damage=c.maxHp-c.hp;
 c.classLevels[0].level=5;recompute(c);const restored=await prepareCharacter(characterSchema.parse(snapshot(c)));
 assert.deepEqual(snapshot(restored.factotum),counters);assert.deepEqual(snapshot(restored.casters[0]),book);assert.equal(restored.maxHp-restored.hp,damage);
 assert.equal(makeDilettanteRoll(restored,spell('magic-missile')).formula,'3d4+3');assert.equal(restored.casters[0].level,3);
 restored.factotum.spent=0;assert.throws(()=>castDilettante(restored,'magic-missile')); // An encounter reset cannot restore a daily spell.
 const before=snapshot(restored.casters);castDilettante(restored,'detect-magic');assert.deepEqual(snapshot(restored.casters),before);
 assert.equal(factotumNumbers(restored).remaining,3);
});

test('insufficient inspiration cannot mark an unspent daily spell as used',()=>{
 const c=create();chooseDilettante(c,spell('magic-missile'));c.factotum.spent=factotumNumbers(c).inspiration;
 const before=snapshot(c);assert.throws(()=>castDilettante(c,'magic-missile'),/inspiration/);assert.deepEqual(snapshot(c),before);
});
