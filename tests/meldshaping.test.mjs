import {withFixtureAlignment} from './alignment-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {systemLimits,systemWarnings,essentiaCapacity} from '../lib/class-systems.ts';
import {meldshapingSummary,recordEssentiaRuling} from '../lib/meldshaping.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {resetDaily} from '../lib/rules.ts';
import {magicSections} from '../lib/magic.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const repeat=(left,right,n)=>Array.from({length:n},()=>({left,right}));
const make=(pairs=null,level=6)=>createPlayerCharacter({name:'Meldshaping QA',kind:'Incarnate',level:pairs?.length??level,raceId:'human',scores:{STR:12,DEX:14,CON:18,INT:14,WIS:16,CHA:12},method:'manual',hpMethod:'average',...(pairs?{advancementMode:'gestalt',gestaltPairs:pairs}:{})});
const standard=()=>{const c=make();c.classLevels.push({...make(repeat('totemist','fighter',6)).classLevels.find(e=>e.classId==='totemist')});recompute(c);return c;};
const meld=(c,classId,essentia=0,more={})=>{const s={id:crypto.randomUUID(),classId,name:'My soulmeld',kind:'soulmeld',level:0,readied:false,granted:false,spent:0,essentia,bound:false,totem:false,notes:'Keep my bind notes',...more};c.classSystems.choices.push(s);return s;};
const mixed=()=>make([...repeat('incarnate','fighter',3),...repeat('incarnate','totemist',3)]);

test('class-system entry modules load without relying on the Character module initializing first',()=>{
 execFileSync(process.execPath,['--input-type=module','-e',"await import('./lib/class-systems.ts'); await import('./lib/model.ts');"],{cwd:fileURLToPath(new URL('..',import.meta.url)),stdio:'pipe'});
});

test('ordinary multiclass meldshapers use the published combined pool and one Constitution ceiling',()=>{
 const c=standard();for(const id of ['incarnate','totemist'])for(let i=0;i<4;i++)meld(c,id);
 let m=meldshapingSummary(c);assert.equal(m.essentia,10);assert.equal(m.shaped,8);assert.equal(m.soulmeldLimit,8);assert.deepEqual(systemWarnings(c),[]);
 c.scores.CON=17;m=meldshapingSummary(c);assert.equal(m.constitutionLimit,7);assert.equal(m.soulmeldLimit,7);
 assert.ok(systemWarnings(c).some(w=>/8 shaped.*Constitution limit of 7/.test(w)));
 assert.equal(systemLimits(c,'incarnate').known,4);assert.equal(systemLimits(c,'totemist').known,4,'independent class limits remain');
 assert.equal(c.classSystems.choices.length,8,'the warning never removes a recorded meld');
});

test('uninterrupted gestalt essentia takes the consistently better table, independent of side and bonus method',()=>{
 for(const [left,right]of [['incarnate','totemist'],['totemist','soulborn'],['soulborn','incarnate']])for(let level=1;level<=20;level++){
  const c=make(repeat(left,right,level)),m=meldshapingSummary(c);
  assert.equal(m.essentia,Math.max(systemLimits(c,left).essentia,systemLimits(c,right).essentia),left+' // '+right+' '+level);
  assert.equal(m.review,'');
  for(const row of c.gestaltProgression.levels)[row.left,row.right]=[row.right,row.left];
  c.gestaltProgression.bonusMethod='fractional-v1';
  assert.equal(meldshapingSummary(c).essentia,m.essentia);assert.equal(meldshapingSummary(c).progression,m.progression);
 }
});

test('gestalt shared limits retain separate class capacities, meld choices and binds',()=>{
 const c=make(repeat('incarnate','totemist',6));c.scores.CON=17;
 for(const id of ['incarnate','totemist'])for(let i=0;i<4;i++)meld(c,id,1,{bound:i===0,totem:id==='totemist'&&i===0});
 assert.equal(meldshapingSummary(c).essentia,6);assert.equal(meldshapingSummary(c).shaped,8);
 assert.equal(essentiaCapacity(c,c.classSystems.choices[0]),3);assert.equal(essentiaCapacity(c,c.classSystems.choices[4]),3);assert.equal(essentiaCapacity(c,c.classSystems.choices[5]),2);
 const warnings=systemWarnings(c);assert.ok(warnings.some(w=>/Constitution limit of 7/.test(w)));assert.ok(warnings.some(w=>/shared gestalt class essentia pool of 6/.test(w)));
 assert.equal(warnings.some(w=>/too many chakra binds/.test(w)),false);
});

test('sequential gestalt sources add earned essentia without stacking an overlapping level',()=>{
 const c=make([...repeat('incarnate','fighter',6),...repeat('fighter','totemist',6)]),m=meldshapingSummary(c);
 assert.equal(m.essentia,10);assert.equal(m.review,'');assert.deepEqual(m.overlapLevels,[]);
 const delayed=make(repeat('soulborn','fighter',5));assert.equal(meldshapingSummary(delayed).essentia,0);assert.equal(meldshapingSummary(delayed).sources[0].soulmelds,1);
});

test('staggered gestalt histories require review instead of alternating or adding printed grants',()=>{
 const c=mixed(),m=meldshapingSummary(c);meld(c,'incarnate',2);meld(c,'totemist',2);
 assert.equal(m.classEssentia,8);assert.equal(m.automaticEssentia,null);assert.equal(m.essentia,null);assert.deepEqual(m.overlapLevels,[4,5,6]);
 assert.match(m.review,/mixed or staggered/);assert.ok(systemWarnings(c).some(w=>w.startsWith('Essentia:')));
 assert.equal(systemWarnings(c).some(w=>/exceed.*essentia pool/.test(w)),false,'an unknown total is not treated as zero');
 const before=structuredClone(c);meldshapingSummary(c);systemWarnings(c);assert.deepEqual(c,before);
});

test('explicit essentia rulings validate before mutation and keep their GM/source explanation',()=>{
 const c=mixed(),before=structuredClone(c);
 for(const input of [{total:6,gm:'',reason:'Source review'},{total:-1,gm:'GM',reason:'Source review'},{total:1.5,gm:'GM',reason:'Source review'},{total:6,gm:'GM',reason:' '}]){
  assert.throws(()=>recordEssentiaRuling(c,input));assert.deepEqual(c,before);
 }
 recordEssentiaRuling(c,{total:6,gm:'  Table GM  ',reason:'Use the continuing incarnate progression for these overlapping levels.'});
 assert.equal(meldshapingSummary(c).essentia,6);assert.equal(meldshapingSummary(c).review,'');assert.equal(c.classSystems.essentiaRuling.gm,'Table GM');
 meld(c,'incarnate',4);meld(c,'totemist',3);assert.ok(systemWarnings(c).some(w=>/GM-reviewed essentia pool of 6/.test(w)));
});

test('advancement retains a saved ruling but requires renewal for the changed progression',()=>{
 const c=withFixtureAlignment(mixed());recordEssentiaRuling(c,{total:6,gm:'Table GM',reason:'Reviewed existing progression.'});const saved=structuredClone(c.classSystems.essentiaRuling);
 c.experience=21000;const preview=previewGestaltLevel(c,{left:'incarnate',right:'totemist'});applyGestaltLevel(c,preview);recompute(c);
 assert.deepEqual(c.classSystems.essentiaRuling,saved);assert.equal(meldshapingSummary(c).staleRuling,true);assert.equal(meldshapingSummary(c).essentia,null);assert.match(meldshapingSummary(c).review,/needs review after progression changed/);
 recordEssentiaRuling(c,{total:7,gm:'Table GM',reason:'Reviewed the new level.'});assert.equal(meldshapingSummary(c).essentia,7);
});

test('independent manual essentia additions are explicit and fresh or legacy sheets gain no ruling',()=>{
 const c=make();assert.equal('essentiaRuling' in characterSchema.parse(c).classSystems,false);assert.equal(meldshapingSummary(c).essentia,6);
 recordEssentiaRuling(c,{total:8,gm:'Table GM',reason:'Two additional points from a source checked at the table.'});assert.equal(meldshapingSummary(c).essentia,8);
 const old=make();delete old.classSystems;assert.equal('essentiaRuling' in characterSchema.parse(old).classSystems,false);
 const stale=structuredClone(c);stale.classSystems.essentiaRuling.progression='old progression';assert.equal(meldshapingSummary(stale).essentia,null);
});

test('a removed class cannot hide or silently apply its saved essentia ruling',()=>{
 const c=make();recordEssentiaRuling(c,{total:6,gm:'Table GM',reason:'Original incarnate source.'});const saved=structuredClone(c.classSystems.essentiaRuling);
 c.classLevels=make(repeat('fighter','rogue',6)).classLevels.filter(e=>e.classId==='fighter');c.classSystems.choices=[];
 assert.equal(magicSections(c).systems,true);assert.equal(meldshapingSummary(c).staleRuling,true);assert.equal(meldshapingSummary(c).essentia,null);assert.deepEqual(c.classSystems.essentiaRuling,saved);
});

test('levels outside a supported meldshaping table require review instead of copying its last row',()=>{
 const c=make();c.classLevels[0].level=21;const m=meldshapingSummary(c);
 assert.equal(m.tableMissing,true);assert.equal(m.essentia,null);assert.equal(m.soulmeldLimit,null);assert.match(m.review,/no total is extrapolated/);
 recordEssentiaRuling(c,{total:28,gm:'Table GM',reason:'Reviewed epic source at class level 21.'});assert.equal(meldshapingSummary(c).essentia,28);assert.equal(meldshapingSummary(c).soulmeldLimit,null,'the ruling does not invent a meld count');
});

test('native files and a fresh storage client preserve rulings, over-limit melds, injuries and other expenditure',async()=>{
 const c=mixed();recordEssentiaRuling(c,{total:6,gm:'Table GM',reason:'Reviewed this exact paired history.'});c.scores.CON=12;
 for(let i=0;i<4;i++)meld(c,i%2?'totemist':'incarnate',2,{bound:i===0,spent:1});c.hp-=4;c.factotum.spent=2;recompute(c);
 const native=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(native,c);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();
 const api=createBrowserCharacterApi({scope:'/meldshaping-qa/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/meldshaping-qa/',storage,lock});const loaded=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);
 assert.equal(loaded.maxHp-loaded.hp,4);assert.equal(loaded.factotum.spent,2);assert.equal(loaded.classSystems.choices.length,4);assert.equal(meldshapingSummary(loaded).allocated,8);
 const rested=resetDaily(loaded);assert.deepEqual(rested.classSystems.essentiaRuling,c.classSystems.essentiaRuling);assert.equal(meldshapingSummary(rested).allocated,8);assert.equal(rested.classSystems.choices[0].bound,true);
});
