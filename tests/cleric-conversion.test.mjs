import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {makeRequest} from '../lib/rules.ts';
import {clericConversionRoll,spendClericConversion} from '../lib/cleric-conversion.ts';

import {expandSpellCatalog} from '../lib/spell-catalog.ts';
const refs=expandSpellCatalog(JSON.parse(readFileSync(new URL('../public/data/spells.json',import.meta.url))),[]);
const spell=id=>refs.find(s=>s.id===id);
function paired(){
 const c=createPlayerCharacter({name:'Cleric conversion',kind:'Wizard',level:5,raceId:'human',method:'manual',hpMethod:'average',
  scores:{STR:12,DEX:10,CON:12,INT:14,WIS:18,CHA:10},advancementMode:'gestalt',
  gestaltPairs:Array.from({length:5},(_,i)=>({left:'wizard',right:i<3?'cleric':'fighter'}))});
 c.alignment='LG';c.hp-=3;
 const book=c.casters.find(p=>p.casting.classId==='cleric'),wizard=c.casters.find(p=>p.casting.classId==='wizard');
 const donor={id:'prepared',spellId:'bulls-strength',level:2,slotLevel:2,prepared:1,spent:0,formula:'9d10',notes:'Keep these notes',custom:null};
 book.spells.push(donor);wizard.slots[1].used=1;
 const domain=structuredClone(book);domain.id='domain';domain.casting.domain=true;c.casters.push(domain);
 return {c,book,donor,wizard,domain};
}

test('spontaneous cure rolls at Cleric CL, spends one selected ordinary preparation and survives reload',async()=>{
 const {c,book,donor,domain,wizard}=paired(),before=structuredClone(c);
 const cure=spell('cure-light-wounds');
 const roll=clericConversionRoll(c,book.id,donor.id,cure,false);
 assert.equal(roll.formula,'1d8+3');assert.equal(roll.title,cure.name);
 assert.match(makeRequest(roll,c.name,'https://example.com/').message,/1d8\+3/);
 assert.match(roll.fields.find(([k])=>k==='Save')[1],/DC 15/);
 assert.deepEqual(c,before);
 assert.equal(clericConversionRoll(c,book.id,donor.id,cure,true).rolls.length,2);
 spendClericConversion(c,book.id,donor.id,cure);
 const saved=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));
 assert.equal(saved.casters.find(p=>p.id===book.id).spells[0].spent,1);
 assert.equal(saved.casters.find(p=>p.id===book.id).spells[0].formula,'9d10');
 assert.deepEqual(saved.casters.find(p=>p.id===domain.id).spells,domain.spells);
 assert.equal(saved.casters.find(p=>p.id===wizard.id).slots[1].used,1);
 assert.equal(saved.maxHp-saved.hp,3);
 assert.throws(()=>spendClericConversion(c,book.id,donor.id,cure),/unspent/);
});

test('an ineligible channel, source, level or replacement cannot consume a preparation',()=>{
 const {c,book,donor,domain,wizard}=paired(),cure=spell('cure-light-wounds'),inflict=spell('inflict-light-wounds');
 for(const [id,s] of [[domain.id,cure],[wizard.id,cure],[book.id,inflict],[book.id,spell('cure-serious-wounds')],[book.id,spell('obscure-object')]]){
  const before=structuredClone(c);assert.throws(()=>spendClericConversion(c,id,donor.id,s));assert.deepEqual(c,before);
 }
 c.alternateFeatures.selected.push('cleric-spontaneous-domain-casting');
 assert.throws(()=>spendClericConversion(c,book.id,donor.id,cure));assert.equal(book.spells[0].spent,0);
});

test('neutral clerics record a channel once and evil clerics can deliver inflict with a touch attack',async()=>{
 const {c,book,donor}=paired(),inflict=spell('inflict-light-wounds');
 c.alignment='Neutral';assert.throws(()=>clericConversionRoll(c,book.id,donor.id,inflict,true));
 c.clericChannel='inflict';
 const saved=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));
 const roll=clericConversionRoll(saved,book.id,donor.id,inflict,true);
 assert.match(roll.rolls[0].label,/Melee touch/);assert.equal(roll.rolls[1].formula,'1d8+3');
 c.alignment='Lawful evil';delete c.clericChannel;
 assert.equal(clericConversionRoll(c,book.id,donor.id,inflict,false).formula,'1d8+3');
 assert.equal(spell('cure-serious-wounds-mass').range,spell('cure-light-wounds-mass').range);
 assert.equal(spell('inflict-minor-wounds').save,'Will negates');
 donor.level=0;donor.slotLevel=0;
 assert.equal(clericConversionRoll(c,book.id,donor.id,spell('inflict-minor-wounds'),false).formula,'1');
});
