import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {gestaltVariantPairProblem,gestaltVariantWarnings,gestaltVariantParents} from '../lib/gestalt-class-families.ts';
import {gestaltLevelSequence,characterGestaltRows} from '../lib/gestalt-progression.ts';
import {findClass,makePsionic,copyClassFeatures} from '../lib/classes.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {previewGestaltLevel,applyGestaltLevel,gainLevel} from '../lib/level-up.ts';

const options={name:'Variant family QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:12,CHA:10},method:'manual'};
const create=(left,right,level=1)=>createPlayerCharacter({...options,advancementMode:'gestalt',level,gestaltPairs:Array.from({length:level},()=>({left,right}))});
// Reproduce a saved sheet made before family validation existed, without using
// a bypass in the player-facing creation or advancement APIs.
function legacy(){
 const c=create('psion','fighter',2),entry=c.classLevels.find(e=>e.classId==='fighter');
 entry.classId='erudite';entry.name='Erudite';
 c.psionics.push(makePsionic(findClass('erudite'),2,16));copyClassFeatures(c);recompute(c);
 c.hp-=3;c.psionics.forEach((p,i)=>{p.spent=i+1;p.focused=true;});
 c.notes='Preserve this old sheet, including later training and expenditures.';
 c.automation.history[0].skillRanks['Concentration']=2;
 recompute(c);return c;
}

test('catalog variant families are source-specific and symmetric, not name heuristics',()=>{
 for(const [variant,parent] of Object.entries(gestaltVariantParents)){
  assert.ok(findClass(variant));assert.ok(findClass(parent));
  assert.match(gestaltVariantPairProblem(variant,parent),/versions of the same class/);
  assert.match(gestaltVariantPairProblem(parent,variant),/versions of the same class/);
 }
 for(const [a,b] of [['psion','psychic-warrior'],['rogue','ninja'],['rogue','lurk'],['sorcerer','wizard'],['cleric','favored-soul'],['fighter','psychic-warrior']])assert.equal(gestaltVariantPairProblem(a,b),'');
});

test('new creation rejects either ordering of a prohibited variant pair at any starting level',()=>{
 for(const [variant,parent] of Object.entries(gestaltVariantParents))for(const [left,right] of [[variant,parent],[parent,variant]]){
  assert.throws(()=>create(left,right),/versions of the same class/);
  assert.throws(()=>createPlayerCharacter({...options,advancementMode:'gestalt',level:2,gestaltPairs:[{left:'fighter',right:'wizard'},{left,right}]}),/Starting level 2/);
  assert.doesNotThrow(()=>create(variant,'fighter'));
 }
});

test('strict compiler rejects built-in families even if custom metadata tries to rename them',()=>{
 const c=legacy(),before=structuredClone(c);
 assert.throws(()=>gestaltLevelSequence(c,c.gestaltProgression),/versions of the same class/);
 assert.throws(()=>gestaltLevelSequence(c,c.gestaltProgression,{policies:{psion:{family:'one'},erudite:{family:'two'}}}),/versions of the same class/);
 assert.equal(characterGestaltRows(c).length,2);assert.deepEqual(c,before);
 const identical=structuredClone(c);identical.gestaltProgression.levels[0].right=identical.gestaltProgression.levels[0].left;
 assert.throws(()=>characterGestaltRows(identical),/different classes/,'legacy compatibility cannot accept structurally corrupt pairs');
});

test('old conflicting saves load and export unchanged, preserving classes, damage, training and spent resources',async()=>{
 const c=legacy(),before=structuredClone(c);
 assert.equal(gestaltVariantWarnings(c).length,2);assert.deepEqual(gestaltVariantWarnings(c).map(w=>w.level),[1,2]);assert.deepEqual(c,before);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));assert.deepEqual(loaded,c);
 const imported=await prepareCharacter(parseCharacterFile(JSON.stringify(c)));assert.deepEqual(imported,c);
 assert.equal(imported.maxHp-imported.hp,3);assert.deepEqual(imported.psionics.map(p=>p.spent),[1,2]);assert.equal(imported.automation.history[0].skillRanks.Concentration,2);
});

test('new paired advancement rejects family conflicts atomically while old sheets may advance a valid pair',()=>{
 const c=legacy();c.experience=3000;const before=structuredClone(c);
 assert.throws(()=>previewGestaltLevel(c,{left:'psion',right:'erudite',hitDieRoll:4}),/versions of the same class/);assert.deepEqual(c,before);
 const review=previewGestaltLevel(c,{left:'psion',right:'fighter',hitDieRoll:6});assert.deepEqual(c,before);
 const previous=structuredClone(c);applyGestaltLevel(c,review);recompute(c,previous);
 assert.equal(c.level,3);assert.equal(gestaltVariantWarnings(c).length,2);assert.equal(c.classLevels.find(e=>e.classId==='erudite').level,2);
 assert.deepEqual(c.psionics.map(p=>p.spent),[1,2]);assert.equal(c.maxHp-c.hp,3);
});

test('standard progression and inactive paired records do not acquire gestalt restrictions',()=>{
 const c=createPlayerCharacter(options);c.experience=1000;
 assert.doesNotThrow(()=>gainLevel(c,'fighter',6));assert.deepEqual(gestaltVariantWarnings(c),[]);
 const old=legacy();old.advancementMode='standard';assert.deepEqual(gestaltVariantWarnings(old),[]);
});
