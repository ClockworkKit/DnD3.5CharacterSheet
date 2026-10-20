import test from 'node:test';
import assert from 'node:assert/strict';
import {importRoll20} from '../lib/roll20-import.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from '../lib/automation.ts';
import {prepareCharacter,chooseImportedSkillBonus} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';
import {skillBonus} from '../lib/rules.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {parseCharacterFile} from '../lib/character-file.ts';

const raw=values=>({format:'roll20-dnd35-export',version:1,exportedAt:'2026-10-18',character:{id:'skill-review',name:'Skill review'},attributes:Object.entries({class1:'Rogue',level1:2,dex:20,cha:18,hp:16,hp_max:16,feats:'Stealthy',hideranks:5,hidemiscmod:4,movesilentranks:0,movesilentmiscmod:4,bluffranks:5,intimidateranks:5,armorcheckpenalty:1,...values}).map(([name,current])=>({name,current,max:''}))});
const skill=(c,name)=>c.skills.find(s=>s.name===name);
const saved=c=>JSON.parse(JSON.stringify(c));
const load=c=>prepareCharacter(characterSchema.parse(saved(c)));
const legacy=values=>activateAutomation(migrateRoll20Automation(importRoll20(raw(values)).character));
function feat(c,name,choice){c.features.push({id:'added-'+name,name,choice,kind:'Feat',description:'',source:'',max:0,used:0});}

test('ambiguous source misc is reviewed, not silently subtracted; confirmed overlap repairs only original feat',async()=>{
 const data=raw({}),original=saved(data),c=await load(importRoll20(data).character);
 assert.equal(skill(c,'Hide').roll20Bonus.status,'review');assert.equal(skillBonus(c,skill(c,'Hide')),15);
 assert.equal(skill(c,'Move Silently').roll20Bonus.automatic,2);
 chooseImportedSkillBonus(skill(c,'Hide'),true);chooseImportedSkillBonus(skill(c,'Move Silently'),true);
 assert.equal(skillBonus(c,skill(c,'Hide')),13);assert.equal(skillBonus(c,skill(c,'Move Silently')),8);
 assert.equal(skill(c,'Hide').misc,4);assert.equal(skill(c,'Intimidate').roll20Bonus,undefined);
 assert.equal(skillBonus(c,skill(c,'Intimidate')),11); // Legitimate Bluff synergy is not a duplicate.
 assert.deepEqual(data,original);assert.deepEqual(c.roll20Import.raw,original);
 assert.deepEqual(saved(await load(c)),saved(c));
});

test('separate bonus and custom correction choices persist without changing misc',async()=>{
 const c=await load(importRoll20(raw({})).character),s=skill(c,'Hide');
 chooseImportedSkillBonus(s,false);assert.equal(skillBonus(c,s),15);
 s.roll20Bonus.adjustment=-1;s.roll20Bonus.status='custom';
 const loaded=await load(c);assert.equal(skillBonus(loaded,skill(loaded,'Hide')),14);
 assert.equal(skill(loaded,'Hide').misc,4);assert.deepEqual(saved(loaded),saved(c));
});

test('explicit numeric total is preserved automatically and is not treated as proof of correct source rules',async()=>{
 const c=await load(importRoll20(raw({hide:13,intimidate:9})).character);
 assert.equal(skillBonus(c,skill(c,'Hide')),13);assert.equal(skillBonus(c,skill(c,'Intimidate')),9);
 assert.equal(skill(c,'Hide').roll20Bonus.status,'total');assert.equal(skill(c,'Intimidate').roll20Bonus.adjustment,-2);
 chooseImportedSkillBonus(skill(c,'Intimidate'),false);assert.equal(skillBonus(c,skill(c,'Intimidate')),11);
});

test('resolved numeric totals count, but unevaluated formula text is never executed or mistaken for a total',async()=>{
 for(const value of ['@{hideranks}+@{dex-mod}+@{hidemiscmod}', 'globalThis.__importExecuted=true']){
  const data=raw({hide:value}),c=await load(importRoll20(data).character);
  assert.equal(skill(c,'Hide').roll20Bonus.status,'review');assert.equal(globalThis.__importExecuted,undefined);
 }
 const data=raw({});data.resolvedCoreValues={hide:13};const c=await load(importRoll20(data).character);
 assert.equal(skill(c,'Hide').roll20Bonus.status,'total');assert.equal(skillBonus(c,skill(c,'Hide')),13);
});

test('existing advanced saves keep ranks, history, new feats, resources, and other edits',async()=>{
 const c=legacy({}),s=skill(c,'Hide');
 c.classLevels[0].level=3;recompute(c);c.automation.skillTraining.unassigned[s.id]+=1;recompute(c);
 feat(c,'Skill Focus','Hide');c.notes='Player advanced';c.hp-=3;c.features[0].used=1;
 const before=saved(c),loaded=await load(c),review=skill(loaded,'Hide');
 assert.equal(review.roll20Bonus.automatic,2);chooseImportedSkillBonus(review,true);
 assert.equal(skillBonus(loaded,review),17); // 6 ranks +5 Dex -1 ACP +4 misc +5 feats -2 overlap.
 for(const key of ['automation','classLevels','hp','maxHp','features','notes','gear','weapons','casters'])assert.deepEqual(saved(loaded[key]),before[key],key);
 assert.deepEqual(loaded.skills.map(({roll20Bonus,...s})=>s),before.skills.map(({roll20Bonus,...s})=>s));
 assert.deepEqual(loaded.roll20Import.raw,before.roll20Import.raw);
});

test('old feat removed and new ability/ranks do not replace the original reconciliation baseline',async()=>{
 const c=legacy({hide:13});c.features=c.features.filter(f=>!f.name.startsWith('Stealthy'));c.scores.DEX=22;
 const loaded=await load(c),s=skill(loaded,'Hide');
 assert.equal(s.roll20Bonus.adjustment,-2);assert.equal(skillBonus(loaded,s),12);
});

test('later multiclass advancement and spent magic survive migration and subsequent loads',async()=>{
 const c=legacy({class2:'Wizard',level2:1,int:16});
 const wizard=c.classLevels.find(e=>e.classId==='wizard');wizard.level=3;recompute(c);
 const p=c.casters.find(p=>p.casting?.classId==='wizard');
 assert.ok(p);p.slots[1].used=1;
 p.spells.push({id:'later-spell',spellId:'magic-missile',level:1,slotLevel:1,prepared:2,spent:1,formula:'2d4+2',notes:'Added after levelling',custom:null});
 c.advancementChoices['earned-choice']='new feat';
 c.features.push({id:'later-resource',name:'Custom daily ability',kind:'Other',description:'Keep this',source:'',max:3,used:2});
 c.automation.history[0].intScore=14;c.hp-=4;c.tempHp=3;c.experience=15000;
 const before=saved(c),loaded=await load(c);
 chooseImportedSkillBonus(skill(loaded,'Hide'),true);
 const again=await load(loaded);
 for(const key of ['classLevels','automation','advancementChoices','features','casters','psionics','hp','maxHp','tempHp','experience'])assert.deepEqual(saved(again[key]),before[key],key);
 assert.deepEqual(again.roll20Import.raw,before.roll20Import.raw);
 assert.deepEqual(saved(await load(again)),saved(again));
});

test('edited misc and armor interpretation block automatic total reconciliation, leaving a review',async()=>{
 for(const change of [s=>{s.misc=2;},s=>{s.armor=0;}]){
  const c=legacy({hide:13});change(skill(c,'Hide'));const before=skillBonus(c,skill(c,'Hide'));
  const loaded=await load(c);assert.equal(skillBonus(loaded,skill(loaded,'Hide')),before);
  assert.equal(skill(loaded,'Hide').roll20Bonus.status,'review');assert.equal(skill(loaded,'Hide').roll20Bonus.adjustment,0);
 }
});

test('zero numeric totals, negative misc, and custom/repeating skills preserve explicit totals',async()=>{
 const c=await load(importRoll20(raw({hide:0,hidemiscmod:-9,repeating_skills_ROW_otherskillname:'Move Silently',repeating_skills_ROW_otherskill:3,repeating_skills_ROW_otherskillmiscmod:7})).character);
 assert.equal(skillBonus(c,skill(c,'Hide')),0);assert.equal(skillBonus(c,skill(c,'Move Silently')),3);
 assert.equal(skill(c,'Hide').roll20Bonus.sourceTotal,0);
});

test('missing, renamed, or duplicate skill identities are not guessed or recreated',async()=>{
 for(const change of [
  c=>{skill(c,'Hide').name='My custom skill';},
  c=>{c.skills=c.skills.filter(s=>s.name!=='Hide');},
  c=>{c.skills.push({...skill(c,'Hide'),id:'duplicate'});}
 ]){
  const c=legacy({});change(c);recompute(c);const before=saved(c.skills);
  const loaded=await load(c);
  assert.deepEqual(loaded.skills.filter(s=>s.name!=='Move Silently'),before.filter(s=>s.name!=='Move Silently'));
 }
});

test('manual mode disables import offsets; re-enabling never reapplies the repair',async()=>{
 const c=await load(importRoll20(raw({})).character),s=skill(c,'Hide');chooseImportedSkillBonus(s,true);
 c.automation.enabled=false;assert.equal(skillBonus(c,s),13);
 c.automation.enabled=true;assert.equal(skillBonus(c,s),13);
 assert.deepEqual(saved(await load(c)),saved(c));
});

test('malformed original export is nonfatal, unmodified, and gets one warning',async()=>{
 const c=legacy({});c.roll20Import.raw={format:'invalid'};const before=saved(c.skills);
 const loaded=await load(c);assert.deepEqual(loaded.skills,before);
 const again=await load(loaded);assert.deepEqual(again.roll20Import.report,loaded.roll20Import.report);
 assert.equal(again.roll20Import.skillBonusMigration,undefined);
});

test('review choices round-trip through browser storage and native backups',async()=>{
 const values=new Map(),api=createBrowserCharacterApi({scope:'skill-review',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()});
 const c=await load(legacy({}));chooseImportedSkillBonus(skill(c,'Hide'),true);
 const record=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const restored=await load((await api('/api/characters/'+record.id)).data);
 const backup=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:restored}));
 assert.deepEqual(saved(await load(backup)),saved(c));assert.equal(skillBonus(restored,skill(restored,'Hide')),13);
});
