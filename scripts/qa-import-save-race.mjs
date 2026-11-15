import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {importRoll20} from '../lib/roll20-import.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const {chromium}=await import(process.env.LEDGER_QA_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({headless:true,...(process.env.LEDGER_QA_BROWSER?{executablePath:process.env.LEDGER_QA_BROWSER}:{})});
const base=process.env.LEDGER_QA_URL||'https://clockworkkit.github.io/DnD3.5CharacterSheet/';
const live=process.argv.includes('--live');
try {
 const context=await browser.newContext();
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let releaseImport,importRequested;
 const importGate=new Promise(resolve=>{releaseImport=resolve});
 const importSeen=new Promise(resolve=>{importRequested=resolve});
 await context.route(base+'**',async route=>{
  const name=new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)||'index.html';
  if(/^assets\/roll20-import-[^/]+\.js$/.test(name)){importRequested();await importGate;}
  if(live)return route.continue();
  return route.fulfill({path:path.join(root,'dist-pages',name)});
 });
 // Delay a save if the UI incorrectly permits it during the import.
 await context.addInitScript(()=>{
  const request=navigator.locks.request.bind(navigator.locks);
  window.qaSaveRequests=0;window.qaHoldSaves=false;
  navigator.locks.request=(...args)=>{
   if(!window.qaHoldSaves)return request(...args);
   window.qaSaveRequests++;
   return new Promise(resolve=>{window.qaReleaseSave=()=>resolve(request(...args))});
  };
 });
 await page.goto(base);
 if(process.env.LEDGER_QA_ASSET)assert.ok((await page.locator('script[src][type=module]').first().getAttribute('src')).endsWith(process.env.LEDGER_QA_ASSET));
 const importSheet=async c=>page.locator('input[aria-label="Import a Barrow Ledger character"]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))});
 const exported=async()=>{
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export character',exact:true}).click();
  const parts=[];for await(const part of await(await download).createReadStream())parts.push(part);
  return JSON.parse(Buffer.concat(parts)).data;
 };
 const a=createPlayerCharacter({name:'Save race original',kind:'Wizard',level:4,raceId:'human',method:'manual',scores:{STR:12,DEX:14,CON:14,INT:18,WIS:12,CHA:10},hpRolls:[2,3,4]});
 a.hp-=3;a.casters[0].slots[1].used=1;
 await importSheet(a);await page.getByText('Saved in this browser',{exact:true}).waitFor();
 const original=await exported();
 const raw={format:'roll20-dnd35-export',version:1,exportedAt:'2026-11-14',character:{id:'synthetic',name:'Save race incoming'},attributes:Object.entries({class1:'Psion',level1:2,level:2,psicraftranks:3}).map(([name,current])=>({name,current,max:''}))};
 const b=await prepareCharacter(importRoll20(raw).character);
 b.skills=b.skills.filter(s=>s.name!=='Psicraft');delete b.roll20Import.psionicSkillsMigration;
 await page.evaluate(()=>{window.qaHoldSaves=true});
 await importSheet(b);await Promise.race([importSeen,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Migration import was not requested')),15000);timer.unref()})]);
 await page.keyboard.press('Control+s');
 // Allow the asynchronous storage-module lookup to settle while migration remains blocked.
 await page.waitForTimeout(150);
 const attempted=await page.evaluate(()=>window.qaSaveRequests);
 releaseImport();
 await page.waitForFunction(()=>document.querySelector('.character-name input')?.value==='Save race incoming');
 await page.evaluate(()=>{window.qaHoldSaves=false;window.qaReleaseSave?.()});
 await page.getByText('Saved in this browser',{exact:true}).waitFor();
 const ledger=await page.evaluate(()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('barrow-ledger:characters:v1:'));
  return JSON.parse(localStorage.getItem(key));
 });
 assert.equal(attempted,0,'Ctrl+S must not begin saving the previous character during import');
 assert.equal(ledger.characters.length,2,'Import must create a separate record');
 assert.deepEqual(ledger.characters.find(row=>row.data.name===original.name).data,original);
 const incoming=await exported();assert.equal(incoming.name,b.name);
 assert.equal(incoming.skills.find(s=>s.name==='Psicraft').ranks,3);
 await page.reload();assert.deepEqual(await exported(),incoming);
 // Switching must still flush unsaved edits before replacing the active sheet.
 await page.getByRole('textbox',{name:'Character name',exact:true}).fill('Save race incoming edited');
 const edited=await exported();
 await importSheet({...a,name:'Save race third'});
 await page.getByText('Saved in this browser',{exact:true}).waitFor();
 const savedEdited=await page.evaluate(()=>{
  const key=Object.keys(localStorage).find(k=>k.startsWith('barrow-ledger:characters:v1:'));
  return JSON.parse(localStorage.getItem(key)).characters.find(row=>row.data.name==='Save race incoming edited')?.data;
 });
 assert.deepEqual(savedEdited,edited,'Switch flush must save the outgoing edits');
 assert.deepEqual(errors,[]);
 console.log('PASS: Ctrl+S during delayed migration cannot overwrite the previous sheet; separate saves, original damage/spent slots, recovered ranks and reload preserved.');
} finally {await browser.close();}
