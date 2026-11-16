import {customClassDraft,customClassTable} from '../lib/custom-class-editor.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute} from '../lib/automation.ts';
import {advancementNumbers} from '../lib/advancement.ts';
import {optionalRuleSettings} from '../lib/character-rules.ts';
import {skillLedger} from '../lib/skill-points.ts';
const {chromium}=await import(process.env.LEDGER_QA_PLAYWRIGHT||'playwright-core');
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=await chromium.launch({headless:true,...(process.env.LEDGER_QA_BROWSER?{executablePath:process.env.LEDGER_QA_BROWSER}:{})});
const base='https://clockworkkit.github.io/DnD3.5CharacterSheet/';
let p;
try {
 const ctx=await browser.newContext();p=await ctx.newPage();p.setDefaultTimeout(20000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(!process.argv.includes('--live'))await ctx.route(base+'**',route=>{
  const name=new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)||'index.html';
  return route.fulfill({path:path.join(root,'dist-pages',name)});
 });
 await p.goto(base);
 if(process.env.LEDGER_QA_ASSET)assert.ok((await p.locator('script[src][type=module]').first().getAttribute('src')).endsWith(process.env.LEDGER_QA_ASSET));
 const choose=async(root,label,value)=>{await root.getByLabel(label,{exact:true}).click();await p.getByRole('option',{name:value,exact:typeof value==='string'}).click()};
 const saved=()=>p.getByText('Saved in this browser',{exact:true}).waitFor();
 const tab=name=>p.getByRole('tab',{name,exact:true}).click();
 const exported=async()=>{
  const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export character',exact:true}).click();
  const stream=await(await pending).createReadStream(),parts=[];for await(const part of stream)parts.push(part);
  return JSON.parse(Buffer.concat(parts)).data;
 };
 const roundTrip=async()=>{
  await saved();const c=await exported();await p.reload();await saved();assert.deepEqual(await exported(),c);return c;
 };
 const importSheet=async c=>{
  await p.locator('input[aria-label="Import a Barrow Ledger character"]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))});
  await p.waitForFunction(name=>document.querySelector('.character-name input')?.value===name,c.name);
  await saved();
 };

 const makeProfile=()=>{
  const seed=createPlayerCharacter({name:'Seed',kind:'Wizard',level:1,raceId:'human',method:'manual',hpMethod:'average',scores:{STR:14,DEX:12,CON:14,INT:18,WIS:16,CHA:14}});
  const d=customClassDraft(seed);Object.assign(d.definition,{id:'custom-browser-scholar',name:'Browser Scholar',kind:'Prestige',source:'Synthetic browser configuration; not a published class',requirements:'Synthetic source review.'});
  d.policy.family=d.definition.id;d.definition.levels=[];return customClassTable(d,3);
 };
 const configure=async()=>{
  await p.locator('summary').filter({hasText:'Create or review a custom class table'}).click();
  await p.getByRole('button',{name:'Edit Browser Scholar',exact:true}).click();
  await p.locator('summary').filter({hasText:'Prestige advancement of existing traditions'}).click();
  await p.getByRole('checkbox',{name:'This prestige class advances existing traditions',exact:true}).click();
  await choose(p,'Spellcasting tradition to advance','Any existing spellcasting tradition');
  for(let level=1;level<=3;level++){
   await choose(p,'Prestige grant class level','Class level '+level);
   await p.getByRole('checkbox',{name:'At this class level: +1 spellcasting progression',exact:true}).click();
  }
 };
 const checkSource=()=>p.getByRole('checkbox',{name:'I checked this table, its family and requirements against the complete source',exact:true}).check();
 const openClasses=async()=>{await tab('Classes');};
 for(const paired of [false,true]){
  const profile=makeProfile(),c=createPlayerCharacter({name:'Custom browser '+(paired?'paired':'standard'),kind:'Wizard',level:3,raceId:'human',method:'manual',hpMethod:'average',scores:{STR:14,DEX:12,CON:14,INT:18,WIS:16,CHA:14},customClasses:[profile],...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'wizard',right:'cleric'}))}:{})});
  c.alignment='Neutral';c.experience=1000000;
  if(!paired)for(let i=0;i<3;i++){const old=structuredClone(c);gainLevel(c,'cleric');recompute(c,old);}
  for(const r of prestigeEligibility(c,profile.definition).requirements)c.prerequisiteConfirmations[r.key]=true;
  for(let i=0;i<2;i++){const old=structuredClone(c);if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:'fighter',right:profile.definition.id}));else gainLevel(c,profile.definition.id);recompute(c,old);}
  for(const b of c.casters){b.slots[1].used=1;b.spells=[{id:'qa-'+b.id,spellId:'bless',level:1,slotLevel:1,prepared:1,spent:1,formula:'',notes:'Retain exact preparation',custom:null}];}
  c.hp-=3;c.advancementChoices['personal-note']='Keep my advancement';recompute(c);
  await importSheet(c);assert.deepEqual(await exported(),c);await openClasses();await configure();
  await checkSource();await p.getByRole('button',{name:'Review changes',exact:true}).click();
  await p.getByText(/Choose Class level 1: spellcasting before reviewing/).waitFor();assert.deepEqual(await exported(),c);
  const wizard=c.casters.find(b=>b.casting.classId==='wizard'),cleric=c.casters.find(b=>b.casting.classId==='cleric'&&!b.casting.domain);
  await choose(p,'Class level 1: spellcasting',wizard.name);await choose(p,'Class level 2: spellcasting',cleric.name);
  await checkSource();await p.getByRole('button',{name:'Review changes',exact:true}).click();assert.deepEqual(await exported(),c);
  await p.getByRole('button',{name:'Cancel draft',exact:true}).click();assert.deepEqual(await exported(),c);
  // Reopen without toggling the outer panel, which remains open after cancellation.
  await p.getByRole('button',{name:'Edit Browser Scholar',exact:true}).click();
  await p.locator('summary').filter({hasText:'Prestige advancement of existing traditions'}).click();
  await p.getByRole('checkbox',{name:'This prestige class advances existing traditions',exact:true}).click();
  await choose(p,'Spellcasting tradition to advance','Any existing spellcasting tradition');
  for(let level=1;level<=3;level++){await choose(p,'Prestige grant class level','Class level '+level);await p.getByRole('checkbox',{name:'At this class level: +1 spellcasting progression',exact:true}).click();}
  await choose(p,'Class level 1: spellcasting',wizard.name);await choose(p,'Class level 2: spellcasting',cleric.name);await checkSource();
  await p.getByRole('button',{name:'Review changes',exact:true}).click();
  await p.getByLabel('Character name',{exact:true}).fill(c.name+' reviewed');c.name+=' reviewed';
  assert.equal(await p.getByRole('button',{name:'Apply reviewed table',exact:true}).isDisabled(),true);
  await p.getByRole('button',{name:'Review changes',exact:true}).click();
  await p.getByRole('button',{name:'Apply reviewed table',exact:true}).click();
  const updated=await roundTrip();
  assert.deepEqual(updated.casters.map(b=>b.level),[4,4,4]);
  assert.deepEqual(updated.casters.map(b=>b.spells),c.casters.map(b=>b.spells));
  assert.ok(updated.casters.every(b=>b.slots[1].used===1));assert.equal(updated.maxHp-updated.hp,3);
  assert.deepEqual(updated.automation.history,c.automation.history);assert.deepEqual(updated.advancementChoices,c.advancementChoices);
  assert.deepEqual(updated.features,c.features);assert.deepEqual(updated.skills,c.skills);
  const targets=paired?updated.gestaltProgression.levels.slice(-2).map(r=>r.castingTargets[0].traditionId):updated.classLevels.find(e=>e.classId===profile.definition.id).castingAdvances.map(t=>t.traditionId);
  assert.deepEqual(targets,[wizard.id,cleric.id]);
  await openClasses();
  if(paired){
   await choose(p,'Left class to advance','Wizard 4');await choose(p,'Right class to advance','Browser Scholar 3');
   await choose(p,'Browser Scholar: advance spell tradition',wizard.name);
   await p.getByRole('button',{name:'Review paired level',exact:true}).click();
   await p.getByRole('button',{name:'Confirm paired level 6',exact:true}).click();
  }else{
   await choose(p,'Class to advance',/^Browser Scholar .*next level$/);
   await choose(p,'Browser Scholar: advance spell tradition',cleric.name);
   await p.getByRole('button',{name:'Gain level 9 in Browser Scholar',exact:true}).click();
  }
  const advanced=await roundTrip();assert.equal(advanced.level,paired?6:9);
  assert.deepEqual(advanced.casters.map(b=>b.level),paired?[5,4,4]:[4,5,5]);
  assert.deepEqual(advanced.casters.map(b=>b.spells),c.casters.map(b=>b.spells));assert.ok(advanced.casters.every(b=>b.slots[1].used===1));
  assert.deepEqual(advanced.automation.history.slice(0,c.automation.history.length),c.automation.history);assert.equal(advanced.maxHp-advanced.hp,3);
  const afterTargets=paired?advanced.gestaltProgression.levels.slice(-3).map(r=>r.castingTargets[0].traditionId):advanced.classLevels.find(e=>e.classId===profile.definition.id).castingAdvances.map(t=>t.traditionId);
  assert.deepEqual(afterTargets,[wizard.id,cleric.id,paired?wizard.id:cleric.id]);
  console.log('PASS '+(paired?'gestalt':'standard')+' custom prestige: required targets, cancel/stale review, independent earned grants, prospective target, cap, complete reload and expenditure preservation');
 }
 assert.deepEqual(errors,[]);console.log('PASS custom prestige browser acceptance');
}catch(e){if(p){console.error(await p.getByRole('alert').allTextContents());console.error((await p.locator('body').innerText()).slice(-2500));}throw e;}finally{await browser.close();}
