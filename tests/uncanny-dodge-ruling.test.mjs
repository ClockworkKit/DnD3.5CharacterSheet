import {withFixtureAlignment} from './alignment-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {uncannyDodgeFeatures,uncannyDodgeSources} from '../lib/defensive-class-features.ts';
import {previewUncannyDodgeRuling,applyUncannyDodgeRuling} from '../lib/uncanny-dodge-ruling.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {sheetTotals,resetDaily} from '../lib/rules.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const repeat=(left,right,n)=>Array.from({length:n},()=>({left,right}));
const make=pairs=>createPlayerCharacter({name:'Uncanny ruling QA',kind:'Fighter',level:pairs.length,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:14,WIS:10,CHA:12},method:'manual',hpMethod:'average',advancementMode:'gestalt',gestaltPairs:pairs});
const mixed=(barbarian=3)=>make([...repeat('rogue','wizard',4),...repeat('barbarian','wizard',barbarian)]);
const decision={improved:true,minimumRogueLevel:11,gm:'Fixture GM',reason:'Explicit test table ruling for this mixed progression; not a standard formula.'};
const record=(c,d=decision)=>applyUncannyDodgeRuling(c,previewUncannyDodgeRuling(c,d));

test('default and ordinary multiclass characters acquire no ruling; parallel gestalt keeps faster listed improvement',()=>{
 const standard=createPlayerCharacter({name:'Ordinary QA',kind:'Rogue',level:4,raceId:'human',scores:{STR:14,DEX:18,CON:14,INT:14,WIS:10,CHA:12},method:'manual'});
 assert.equal('uncannyDodgeRuling' in standard.classSystems,false);
 const legacy=structuredClone(standard);delete legacy.classSystems;
 assert.equal('uncannyDodgeRuling' in characterSchema.parse(legacy).classSystems,false);
 standard.classLevels.push({id:'barbarian',classId:'barbarian',name:'Barbarian',level:2,notes:''});
 assert.equal(uncannyDodgeFeatures(standard).minimumRogueLevel,10);
 assert.throws(()=>record(standard),/only for mixed or staggered/);
 for(const [level,improved,threshold] of [[4,false,null],[5,true,9]]){
  const c=make(repeat('rogue','barbarian',level)),f=uncannyDodgeFeatures(c);
  assert.equal(f.improved,improved);assert.equal(f.minimumRogueLevel,threshold);assert.equal(f.rulingEligible,false);
  assert.throws(()=>record(c),/only for mixed or staggered/);
 }
});

test('review is read-only, explicit confirmation applies only the named mixed-progression decision',()=>{
 const c=mixed();c.automation.context.flanking=true;c.hp-=4;const before=structuredClone(c),flat=sheetTotals(c).flat;
 const f=uncannyDodgeFeatures(c);assert.equal(f.improved,false);assert.equal(f.minimumRogueLevel,null);assert.match(f.review,/DM review/);
 const preview=previewUncannyDodgeRuling(c,{...decision,gm:' Fixture GM ',reason:' Reviewed with sources. '});
 assert.deepEqual(c,before,'review or cancellation never changes the character');
 assert.deepEqual(preview.before,{improved:false,minimumRogueLevel:null});
 applyUncannyDodgeRuling(c,preview);
 assert.deepEqual(c,{...before,classSystems:{...before.classSystems,uncannyDodgeRuling:preview.ruling}});
 const applied=uncannyDodgeFeatures(c);assert.equal(applied.rulingApplied,true);assert.equal(applied.improved,true);assert.equal(applied.minimumRogueLevel,11);assert.equal(applied.review,'');
 assert.equal(c.classSystems.uncannyDodgeRuling.decision.gm,'Fixture GM');assert.equal(sheetTotals(c).flat,flat);
 assert.deepEqual(uncannyDodgeSources(c),uncannyDodgeSources(before));assert.equal(c.automation.context.flanking,true);
});

test('a reviewed not-yet-granted decision resolves the ambiguity without a fabricated threshold',()=>{
 const c=mixed();record(c,{...decision,improved:false,minimumRogueLevel:null});
 const f=uncannyDodgeFeatures(c);assert.equal(f.rulingApplied,true);assert.equal(f.improved,false);assert.equal(f.minimumRogueLevel,null);assert.equal(f.review,'');
});

test('rulings cannot remove listed improvements or restore all surrendered improvements',()=>{
 const c=make([...repeat('rogue','wizard',8),...repeat('barbarian','wizard',5)]),before=structuredClone(c);
 assert.equal(uncannyDodgeFeatures(c).listedImprovement,true);
 assert.throws(()=>record(c,{...decision,improved:false,minimumRogueLevel:null}),/listed Improved Uncanny Dodge grant/);assert.deepEqual(c,before);
 record(c,{...decision,minimumRogueLevel:13});assert.equal(uncannyDodgeFeatures(c).minimumRogueLevel,13);
 c.alternateFeatures.selected.push('barbarian-uncanny-bravery','rogue-uncanny-bravery');
 const replaced=structuredClone(c);assert.equal(uncannyDodgeFeatures(c).improved,false);assert.equal(uncannyDodgeFeatures(c).staleRuling,true);
 assert.throws(()=>record(c),/cannot restore a surrendered feature/);assert.deepEqual(c,replaced);
 record(c,{...decision,improved:false,minimumRogueLevel:null});assert.equal(uncannyDodgeFeatures(c).rulingApplied,true);
});

test('malformed decisions and future saved versions fail without mutating a character',()=>{
 const c=mixed(),before=structuredClone(c);
 for(const delta of [{gm:''},{reason:'  '},{minimumRogueLevel:0},{minimumRogueLevel:1.5},{minimumRogueLevel:10001},{minimumRogueLevel:null},{improved:false},{extra:true}]){
  assert.throws(()=>record(c,{...decision,...delta}));assert.deepEqual(c,before);
 }
 record(c);const raw=structuredClone(c);raw.classSystems.uncannyDodgeRuling.version=2;
 assert.equal(characterSchema.safeParse(raw).success,false);
});

test('imported incompatible decisions remain visible but cannot suppress or restore listed benefits',()=>{
 const c=mixed(5);record(c);c.classSystems.uncannyDodgeRuling.decision={...decision,improved:false,minimumRogueLevel:null};
 const loaded=characterSchema.parse(c),f=uncannyDodgeFeatures(loaded);
 assert.equal(f.incompatibleRuling,true);assert.equal(f.rulingApplied,false);assert.equal(f.improved,true);assert.equal(f.minimumRogueLevel,null);assert.match(f.review,/conflicts with a listed class/);
 assert.deepEqual(loaded.classSystems.uncannyDodgeRuling,c.classSystems.uncannyDodgeRuling);
 const replaced=make([...repeat('rogue','wizard',8),...repeat('barbarian','wizard',5)]);replaced.alternateFeatures.selected.push('barbarian-uncanny-bravery','rogue-uncanny-bravery');
 record(replaced,{...decision,improved:false,minimumRogueLevel:null});replaced.classSystems.uncannyDodgeRuling.decision=decision;
 assert.equal(uncannyDodgeFeatures(characterSchema.parse(replaced)).improved,false);
});

test('confirmation rejects changed choices, progression and intervening saved rulings atomically',()=>{
 const c=mixed(),tampered=previewUncannyDodgeRuling(c,decision);tampered.ruling.decision.minimumRogueLevel=99;
 let before=structuredClone(c);assert.throws(()=>applyUncannyDodgeRuling(c,tampered),/choices changed/);assert.deepEqual(c,before);
 const old=previewUncannyDodgeRuling(c,decision);record(c,{...decision,minimumRogueLevel:12});before=structuredClone(c);
 assert.throws(()=>applyUncannyDodgeRuling(c,old),/saved ruling changed/);assert.deepEqual(c,before);
 const replaced=previewUncannyDodgeRuling(c,decision);c.alternateFeatures.selected.push('rogue-disruptive-attack');before=structuredClone(c);
 assert.throws(()=>applyUncannyDodgeRuling(c,replaced),/progression or saved ruling changed/);assert.deepEqual(c,before);
});

test('injury and resource edits during review are preserved rather than overwritten by confirmation',()=>{
 const c=mixed(),review=previewUncannyDodgeRuling(c,decision);c.hp-=4;c.factotum.spent=2;c.casters[0].slots[1].used=1;c.notes='Updated after review';
 const before=structuredClone(c);applyUncannyDodgeRuling(c,review);
 assert.deepEqual(c,{...before,classSystems:{...before.classSystems,uncannyDodgeRuling:review.ruling}});
});

test('paired level-up retains the decision and old training but requires a fresh progression review',()=>{
 const c=withFixtureAlignment(mixed());record(c);c.hp-=4;c.casters[0].slots[1].used=1;c.experience=28000;
 const saved=structuredClone(c.classSystems.uncannyDodgeRuling),history=structuredClone(c.automation.history),oldReview=previewUncannyDodgeRuling(c,decision),before=structuredClone(c);
 applyGestaltLevel(c,previewGestaltLevel(c,{left:'barbarian',right:'wizard'}));recompute(c,before);
 assert.deepEqual(c.classSystems.uncannyDodgeRuling,saved);assert.equal(uncannyDodgeFeatures(c).staleRuling,true);assert.equal(uncannyDodgeFeatures(c).improved,false);
 assert.deepEqual(c.automation.history.slice(0,history.length),history);assert.equal(c.maxHp-c.hp,4);assert.equal(c.casters[0].slots[1].used,1);
 const advanced=structuredClone(c);assert.throws(()=>applyUncannyDodgeRuling(c,oldReview),/progression or saved ruling changed/);assert.deepEqual(c,advanced);
 record(c,{...decision,minimumRogueLevel:12});assert.equal(uncannyDodgeFeatures(c).minimumRogueLevel,12);
});

test('side swaps, entry ordering, personal labels and optional BAB method do not invalidate the reviewed class history',()=>{
 const c=mixed();record(c);const fingerprint=c.classSystems.uncannyDodgeRuling.progression;
 c.classLevels.reverse();c.classLevels.forEach(e=>{e.name='Personal label';e.notes='Keep my notes';});
 for(const row of c.gestaltProgression.levels){[row.left,row.right]=[row.right,row.left];row.id=crypto.randomUUID();}
 c.gestaltProgression.bonusMethod='fractional-v1';
 const f=uncannyDodgeFeatures(c);assert.equal(f.progression,fingerprint);assert.equal(f.staleRuling,false);assert.equal(f.rulingApplied,true);
});

test('focus loss suspends a dependent ruling, retains its record and never suppresses an independent listed improvement',()=>{
 const c=make([...repeat('psychic-rogue','wizard',7),...repeat('rogue','wizard',4)]),psi=c.psionics[0];
 psi.focused=true;psi.spent=3;record(c,{...decision,minimumRogueLevel:15});const saved=structuredClone(c.classSystems.uncannyDodgeRuling);
 assert.equal(uncannyDodgeFeatures(c).improved,true);psi.focused=false;
 let f=uncannyDodgeFeatures(c);assert.equal(f.improved,false);assert.equal(f.rulingApplied,false);assert.equal(f.staleRuling,false);assert.deepEqual(f.suspendedSources,['psychic-rogue']);assert.match(f.review,/temporarily inactive/);
 assert.equal(psi.spent,3);assert.deepEqual(c.classSystems.uncannyDodgeRuling,saved);psi.focused=true;assert.equal(uncannyDodgeFeatures(c).minimumRogueLevel,15);
 const rested=resetDaily(c);assert.deepEqual(rested.classSystems.uncannyDodgeRuling,saved);assert.equal(rested.psionics[0].focused,false);assert.equal(uncannyDodgeFeatures(rested).rulingApplied,false);
 const independent=make([...repeat('psychic-rogue','wizard',7),...repeat('barbarian','wizard',5)]);independent.psionics[0].focused=true;record(independent,{...decision,minimumRogueLevel:16});independent.psionics[0].focused=false;
 f=uncannyDodgeFeatures(independent);assert.equal(f.rulingApplied,false);assert.equal(f.improved,true);assert.equal(f.minimumRogueLevel,9,'the active barbarian still supplies its own listed benefit');
});

test('reviewing while unfocused saves a suspended decision and refocusing restores it without a refund',()=>{
 const c=make([...repeat('psychic-rogue','wizard',7),...repeat('rogue','wizard',4)]);c.psionics[0].focused=false;c.psionics[0].spent=3;
 const review=previewUncannyDodgeRuling(c,decision);assert.equal(review.suspended,true);applyUncannyDodgeRuling(c,review);
 assert.equal(uncannyDodgeFeatures(c).rulingApplied,false);c.psionics[0].focused=true;
 assert.equal(uncannyDodgeFeatures(c).rulingApplied,true);assert.equal(c.psionics[0].spent,3);
});

test('removed sources or a changed advancement mode retain but cannot apply the saved ruling',()=>{
 for(const change of [c=>{c.advancementMode='standard';delete c.gestaltProgression;},c=>{for(const entry of c.classLevels){if(entry.classId==='rogue')entry.classId='fighter';if(entry.classId==='barbarian')entry.classId='ranger';}}]){
  const c=mixed();record(c);const saved=structuredClone(c.classSystems.uncannyDodgeRuling);change(c);
  const f=uncannyDodgeFeatures(c);assert.equal(f.staleRuling,true);assert.equal(f.rulingApplied,false);assert.equal(f.rulingEligible,false);assert.deepEqual(c.classSystems.uncannyDodgeRuling,saved);
 }
});

test('native files and fresh browser storage preserve the ruling, paired history, preparations and expenditure',async()=>{
 const c=mixed();record(c);c.hp-=4;c.factotum.spent=2;c.notes='Keep this player note';
 c.casters[0].slots[1].used=1;c.casters[0].spells.push({id:'known-magic',spellId:'magic-missile',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Prepared before review',custom:null});recompute(c);
 const native=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(native,c);
 const values=new Map(),options={scope:'/uncanny-ruling-qa/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_name,fn)=>fn()};
 const saved=await createBrowserCharacterApi(options)('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await prepareCharacter((await createBrowserCharacterApi(options)('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);assert.equal(uncannyDodgeFeatures(loaded).rulingApplied,true);
 const before=structuredClone(loaded);delete loaded.classSystems.uncannyDodgeRuling;delete before.classSystems.uncannyDodgeRuling;recompute(loaded);
 assert.deepEqual(loaded,before);assert.equal(uncannyDodgeFeatures(loaded).improved,false);assert.match(uncannyDodgeFeatures(loaded).review,/DM review/);
});
