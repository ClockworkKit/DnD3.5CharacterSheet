import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute,resourceNumbers} from '../lib/automation.ts';
import {supplementalResources} from '../lib/class-systems.ts';
import {resourceGuidance} from '../lib/managed-resources.ts';
import {effectiveTurningLevel,turningDailyUses} from '../lib/turning-feats.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {selectAlternateBonusFeat} from '../lib/alternate-grants.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {resetDaily} from '../lib/rules.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {execFileSync} from 'node:child_process';
import {setSkillPoints,skillLedger} from '../lib/skill-points.ts';

const make=(kind='Dread Necromancer',level=4,paired=false)=>createPlayerCharacter({name:'Turning feat QA',kind,level,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:14,CHA:14},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left:kind.toLowerCase().replaceAll(' ','-'),right:'wizard'}))}:{})});
const feat=(c,name)=>c.features.push({id:crypto.randomUUID(),name,kind:'Feat',description:'Fixture selection',source:'',max:0,used:0});
const pool=(c,id)=>c.features.find(f=>f.ruleId===id);

test('Extra Turning adds four uses per selection to each supported supplemental rebuking resource',()=>{
 for(const paired of [false,true])for(const [name,id]of [['Dread Necromancer','dread-necromancer'],['Death Master','death-master']]){
  const c=make(name,4,paired),key='supp:'+id+':Rebuke undead';assert.equal(pool(c,key).max,5);
  feat(c,'Extra Turning');recompute(c);assert.equal(pool(c,key).max,9,name+' once');
  feat(c,'Extra Turning');recompute(c);assert.equal(pool(c,key).max,13,name+' twice');
 }
});

test('Improved Turning updates supplemental effective levels once without increasing class levels or uses',()=>{
 for(const name of ['Dread Necromancer','Death Master']){
  const c=make(name,4,true);feat(c,'Improved Turning');feat(c,'Improved Turning');recompute(c);
  const r=supplementalResources(c).find(r=>r.name==='Rebuke undead');assert.match(r.description,/turning level 5\b/);assert.equal(r.max,5);assert.equal(c.level,4);
  assert.equal(c.classLevels.find(e=>e.classId===r.classId).level,4);
 }
});

test('Blackguard Command Undead applies Improved Turning after the two-level offset',()=>{
 const c=make('Fighter',4);c.classLevels.push({id:'blackguard',classId:'blackguard',name:'Blackguard',level:3,notes:''});recompute(c);
 feat(c,'Improved Turning');feat(c,'Extra Turning');recompute(c);
 const f=pool(c,'daily:Command undead');assert.equal(f.max,9);assert.match(resourceGuidance(f)?.description??f.description,/Effective turning level 2\b/);
 assert.equal(resourceNumbers(c).turnLevel,0,'blackguard does not become a cleric or paladin source');
});

test('turning feats never grant early access or restore a replaced turning ability',()=>{
 const c=make('Paladin',3);feat(c,'Improved Turning');feat(c,'Extra Turning');recompute(c);
 assert.equal(resourceNumbers(c).turnLevel,0);assert.equal(pool(c,'daily:Turn or rebuke undead'),undefined);assert.equal(effectiveTurningLevel(c,0),0);assert.equal(effectiveTurningLevel(c,-1),0);
 c.classLevels.push({id:'blackguard',classId:'blackguard',name:'Blackguard',level:2,notes:''});recompute(c);assert.equal(pool(c,'daily:Command undead'),undefined);
 const cleric=make('Cleric',4,true);setSkillPoints(cleric,skillLedger(cleric).levels[0].key,cleric.skills.find(s=>s.name==='Knowledge (arcana)').id,1);feat(cleric,'Improved Turning');feat(cleric,'Extra Turning');recompute(cleric);
 const f=pool(cleric,'daily:Turn or rebuke undead');f.used=4;const id=f.id;
 configureAlternateFeature(cleric,'cleric-divine-counterspell',{reviewed:true});selectAlternateFeature(cleric,'cleric-divine-counterspell',true);recompute(cleric);
 assert.equal(resourceNumbers(cleric).turnLevel,0);assert.equal(pool(cleric,'daily:Turn or rebuke undead'),undefined);assert.equal(cleric.retiredResources.find(f=>f.id===id).used,4);
 selectAlternateFeature(cleric,'cleric-divine-counterspell',false);recompute(cleric);assert.equal(pool(cleric,'daily:Turn or rebuke undead').id,id);assert.equal(pool(cleric,'daily:Turn or rebuke undead').max,9);assert.equal(pool(cleric,'daily:Turn or rebuke undead').used,4);
});

test('effective Charisma changes limits without refunding expenditure, including a zero-use boundary',()=>{
 const c=make(),key='supp:dread-necromancer:Rebuke undead';pool(c,key).used=5;
 c.temps.CHA=4;recompute(c);assert.equal(pool(c,key).max,7);assert.equal(pool(c,key).used,5);
 c.temps.CHA=0;c.scores.CHA=2;recompute(c);assert.equal(pool(c,key).max,0);assert.equal(pool(c,key).used,5);
 feat(c,'Extra Turning');recompute(c);assert.equal(pool(c,key).max,3);assert.equal(pool(c,key).used,5);
});

test('an earned Extra Turning grant keeps its identity after renaming and legacy duplicates count only once',()=>{
 const c=make('Paladin',4,true);configureAlternateFeature(c,'paladin-holy-warrior',{reviewed:true});selectAlternateFeature(c,'paladin-holy-warrior',true);recompute(c);
 selectAlternateBonusFeat(c,'paladin-holy-warrior','feat-4','extra-turning');recompute(c);
 const granted=c.features.find(f=>f.ruleId==='acf-grant:paladin-holy-warrior:feat-4');assert.ok(granted);granted.name='My sacred training';
 c.features.push({...structuredClone(granted),id:crypto.randomUUID()});assert.equal(turningDailyUses(c),9);
 feat(c,'Extra Turning');assert.equal(turningDailyUses(c),13);recompute(c);assert.equal(pool(c,'daily:Turn or rebuke undead').max,13);
 selectAlternateFeature(c,'paladin-holy-warrior',false);recompute(c);assert.equal(pool(c,'daily:Turn or rebuke undead').max,9,'the independent selected feat remains');
});

test('personal resource text, identity, old guidance and spent uses survive a legacy load and feat removal',async()=>{
 const c=make('Death Master'),key='supp:death-master:Rebuke undead';feat(c,'Extra Turning');feat(c,'Improved Turning');
 c.automation.hpMethod='maximum';c.automation.encumbrance=false;recompute(c);c.hp-=3;
 const f=pool(c,key);f.name='My servants';f.description='Original player notes and older turning guidance.';f.source='Campaign source';f.used=8;f.max=5;delete f.generatedSummary;
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c)))),after=pool(loaded,key);
 assert.equal(after.id,f.id);assert.equal(after.name,f.name);assert.equal(after.description,f.description);assert.equal(after.source,f.source);assert.equal(after.used,8);assert.equal(after.max,9);
 assert.match(resourceGuidance(after).description,/turning level 5/);assert.equal(loaded.maxHp-loaded.hp,3);assert.equal(loaded.automation.hpMethod,'maximum');assert.equal(loaded.automation.encumbrance,false);
 loaded.features=loaded.features.filter(f=>!['Extra Turning','Improved Turning'].includes(f.name));recompute(loaded);
 assert.equal(pool(loaded,key).max,5);assert.equal(pool(loaded,key).used,8);assert.match(resourceGuidance(pool(loaded,key)).description,/turning level 4/);
});

test('manual resource limits remain untouched until automatic calculations are explicitly used',()=>{
 const c=make('Death Master');feat(c,'Extra Turning');feat(c,'Improved Turning');c.automation.enabled=false;
 const f=pool(c,'supp:death-master:Rebuke undead');f.max=42;f.used=12;const before=structuredClone(f);recompute(c);
 assert.deepEqual(pool(c,'supp:death-master:Rebuke undead'),before);assert.equal(c.automation.enabled,false);
});

test('standard and paired advancement preserve source levels, history, injuries, preparations and spent attempts',()=>{
 for(const paired of [false,true])for(const [kind,id]of [['Dread Necromancer','dread-necromancer'],['Death Master','death-master']]){
  const c=make(kind,4,paired),key='supp:'+id+':Rebuke undead';feat(c,'Extra Turning');feat(c,'Improved Turning');recompute(c);
  const f=pool(c,key);f.name='Personal rebuking';f.description='Keep my tactics.\n'+f.description;f.source='My reference';f.used=7;c.hp-=3;c.experience=10000;
  const caster=c.casters.find(p=>p.casting?.classId===id);caster.slots[1].used=1;caster.spells.push({id:'kept-spell',spellId:'chill-touch',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Keep prepared choices',custom:null});
  const before=structuredClone(c),history=structuredClone(c.automation.history);
  if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:id,right:'wizard'}));else gainLevel(c,id);recompute(c,before);
  const after=pool(c,key);assert.equal(c.level,5);assert.equal(c.classLevels.find(e=>e.classId===id).level,5);assert.equal(after.id,f.id);assert.equal(after.name,f.name);assert.equal(after.source,f.source);assert.equal(after.used,7);assert.equal(after.max,9);
  assert.match(after.description,/Keep my tactics/);assert.match(after.description,/turning level 6/);assert.equal(c.maxHp-c.hp,3);assert.deepEqual(c.automation.history.slice(0,history.length),history);
  assert.equal(c.casters.find(p=>p.id===caster.id).slots[1].used,1);assert.deepEqual(c.casters.find(p=>p.id===caster.id).spells,caster.spells);
 }
});

test('native export and a fresh storage client retain corrected limits and only an explicit rest resets use',async()=>{
 const c=make('Death Master',4,true),key='supp:death-master:Rebuke undead';feat(c,'Extra Turning');feat(c,'Improved Turning');recompute(c);pool(c,key).used=7;c.hp-=3;c.casters[0].slots[1].used=1;c.notes='Player campaign notes';
 const native=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(native,c);
 const values=new Map(),options={scope:'/turning-feat-qa/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_name,fn)=>fn()};
 const saved=await createBrowserCharacterApi(options)('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await prepareCharacter((await createBrowserCharacterApi(options)('/api/characters/'+saved.id)).data);assert.deepEqual(loaded,c);assert.equal(pool(loaded,key).max,9);assert.equal(pool(loaded,key).used,7);
 const rested=resetDaily(loaded);assert.equal(pool(rested,key).max,9);assert.equal(pool(rested,key).used,0);assert.equal(rested.maxHp-rested.hp,3);assert.equal(rested.notes,c.notes);
});

test('turning helpers initialize from both schema-first and calculation-first imports',()=>{
 for(const first of ['./lib/model.ts','./lib/turning-feats.ts']){
  execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify(first)});const {createPlayerCharacter}=await import('./lib/character-creation.ts');const {turningDailyUses}=await import('./lib/turning-feats.ts');const c=createPlayerCharacter({name:'Cold import QA',kind:'Dread Necromancer',level:1,raceId:'human',scores:{STR:10,DEX:10,CON:10,INT:14,WIS:10,CHA:14},method:'manual'});if(turningDailyUses(c)!==5)throw Error('Incorrect turning count');`],{cwd:new URL('..',import.meta.url),stdio:'pipe'});
 }
});
