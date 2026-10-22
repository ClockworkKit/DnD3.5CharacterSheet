import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter,chooseImportedSkillBonus} from '../lib/roll20-skill-bonuses.ts';
import {repairRoll20SkillAliases} from '../lib/roll20-skill-aliases.ts';
import {characterSchema} from '../lib/model.ts';
import {recompute} from '../lib/automation.ts';
import {assignExistingSkillRanks,setSkillPoints,skillLedger} from '../lib/skill-points.ts';
import {skillBonus} from '../lib/rules.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const saved=c=>JSON.parse(JSON.stringify(c));
const raw=(extra={})=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-21',character:{id:'skill-alias-test',name:'Skill alias test'},attributes:Object.entries({class1:'Rogue',level1:3,dex:16,hp:16,hp_max:20,movesilentlyranks:6,movesilentlymiscmod:4,movesilentmiscmod:4,...extra}).map(([name,current])=>({name,current,max:''}))});
const skill=c=>c.skills.find(s=>s.name==='Move Silently');
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const legacy=async extra=>{const c=await load(importRoll20(raw(extra)).character);skill(c).misc=8;if(skill(c).roll20Bonus)skill(c).roll20Bonus.sourceMisc=8;delete c.roll20Import.skillAliasesMigration;return c;};

test('equivalent modern and legacy skill aliases count once, while separate modifier categories still add',()=>{
 const data=raw({movesilentlytempmod:2,movesilenttempmod:2,movesilentlyactionmod:1,movesilentactionmod:1}),c=importRoll20(data).character;
 assert.equal(skill(c).misc,7);assert.equal(skillBonus(c,skill(c)),16);assert.deepEqual(c.roll20Import.raw,data);
 assert.ok(c.roll20Import.report.warnings.some(s=>s.includes('modifier aliases overlap')));
});

test('primary numeric zero wins, legacy-only and formula-primary fields fall back without execution',()=>{
 for(const [extra,expected] of [[{movesilentlymiscmod:0},0],[{movesilentlymiscmod:''},4],[{movesilentlymiscmod:'@{unknown}'},4],[{movesilentmiscmod:''},4]]){
  const c=importRoll20(raw(extra)).character;assert.equal(skill(c).misc,expected);
 }
});

test('numeric source totals and repeating overrides retain their original totals rather than losing a second bonus',async()=>{
 const c=await load(importRoll20(raw({movesilently:18})).character);delete c.roll20Import.skillAliasesMigration;
 const before=saved(c);await repairRoll20SkillAliases(c);assert.equal(skillBonus(c,skill(c)),18);assert.equal(skill(c).misc,skill(before).misc);
 const repeated=await load(importRoll20(raw({repeating_skills_ROW_name:'Move Silently',repeating_skills_ROW_ranks:5,repeating_skills_ROW_misc:8})).character);
 delete repeated.roll20Import.skillAliasesMigration;await repairRoll20SkillAliases(repeated);assert.equal(skill(repeated).misc,8);
});

test('old saves lose only the duplicate source component and preserve later ranks and bonus-review choices',async()=>{
 const c=await legacy({feats:'Stealthy'});chooseImportedSkillBonus(skill(c),true);
 assignExistingSkillRanks(c);c.classLevels[0].level=5;recompute(c);
 setSkillPoints(c,skillLedger(c).levels[4].key,skill(c).id,2);
 assert.equal(skill(c).ranks,8);c.scores.DEX=18;c.hp-=3;c.notes='After level-up';
 const before=saved(c),oldTotal=skillBonus(c,skill(c)),fixed=await load(c),after=saved(fixed);
 assert.equal(skill(fixed).misc,4);assert.equal(skillBonus(fixed,skill(fixed)),oldTotal-4);
 assert.equal(skill(fixed).roll20Bonus.adjustment,skill(before).roll20Bonus.adjustment);assert.equal(skill(fixed).roll20Bonus.status,'included');
 skill(after).misc=8;skill(after).roll20Bonus.sourceMisc=8;after.roll20Import=before.roll20Import;assert.deepEqual(after,before);
});

test('edited modifiers, conflicting duplicates, deleted skills and changed bonus provenance are not overwritten',async()=>{
 for(const edit of [c=>{skill(c).misc=3;},c=>{skill(c).ability='INT';},c=>{c.skills=c.skills.filter(s=>s.name!=='Move Silently');},c=>{c.skills.push({...structuredClone(skill(c)),id:'duplicate'});},c=>{skill(c).roll20Bonus={sourceMisc:7,automatic:2,adjustment:-1,status:'custom'};}]){
  const c=await legacy();edit(c);const before=saved(c.skills);await repairRoll20SkillAliases(c);assert.deepEqual(saved(c.skills),before);
 }
 const c=await legacy();c.roll20Import.raw.attributes.push({name:'movesilentlymiscmod',current:5});const before=saved(c.skills);await repairRoll20SkillAliases(c);assert.deepEqual(saved(c.skills),before);
});

test('one-time correction survives native and browser backups without undoing later deliberate misc changes',async()=>{
 const c=await load(await legacy());skill(c).misc=8;
 const records=new Map(),api=createBrowserCharacterApi({scope:'skill-aliases',storage:()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)}),lock:async(_,fn)=>fn()});
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:(await api('/api/characters/'+record.id)).data}));assert.deepEqual(saved(await load(backup)),saved(c));
});

test('invalid raw exports preserve skills and do not claim a completed repair',async()=>{
 const c=await legacy();c.roll20Import.raw={invalid:true};const before=saved(c.skills);await repairRoll20SkillAliases(c);
 assert.deepEqual(saved(c.skills),before);assert.equal(c.roll20Import.skillAliasesMigration,undefined);
});
