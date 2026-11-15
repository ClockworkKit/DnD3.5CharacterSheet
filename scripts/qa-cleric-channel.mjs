import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute} from '../lib/automation.ts';
const {chromium}=await import(process.env.LEDGER_QA_PLAYWRIGHT||'playwright-core');
const browser=await chromium.launch({headless:true,...(process.env.LEDGER_QA_BROWSER?{executablePath:process.env.LEDGER_QA_BROWSER}:{})});
const root=fileURLToPath(new URL('../',import.meta.url)),base='https://clockworkkit.github.io/DnD3.5CharacterSheet/';
let p;
try{
 const ctx=await browser.newContext();p=await ctx.newPage();p.setDefaultTimeout(20000);
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(!process.argv.includes('--live'))await ctx.route(base+'**',route=>route.fulfill({path:path.join(root,'dist-pages',new URL(route.request().url()).pathname.slice(new URL(base).pathname.length)||'index.html')}));
 await p.goto(base);
 if(process.env.LEDGER_QA_ASSET)assert.ok((await p.locator('script[src][type=module]').first().getAttribute('src')).endsWith(process.env.LEDGER_QA_ASSET));
 const choose=async(label,value)=>{await p.getByRole('combobox',{name:label,exact:true}).click();await p.getByRole('option',{name:value,exact:typeof value==='string'}).click()};
 const saved=()=>p.getByText('Saved in this browser',{exact:true}).waitFor();
 const exported=async()=>{const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Export character',exact:true}).click();const chunks=[];for await(const chunk of await(await pending).createReadStream())chunks.push(chunk);return JSON.parse(Buffer.concat(chunks)).data};
 for(const [label,patron,stored,effective] of [['good','LG','inflict','cure'],['evil','LE','cure','inflict'],['neutral','LN','inflict','inflict'],['renamed','LG','inflict','inflict']]){
  const c=createPlayerCharacter({name:'Channel QA '+label,kind:'Cleric',level:3,raceId:'human',method:'manual',hpMethod:'average',scores:{STR:12,DEX:12,CON:12,INT:16,WIS:16,CHA:14},advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'cleric',right:'wizard'}))});
  c.alignment='LN';c.deity='Recorded patron';c.deityAlignment={deity:c.deity,alignment:patron};c.clericChannel=stored;if(label==='renamed')c.deity='Changed patron';
  const book=c.casters.find(b=>b.casting.classId==='cleric'&&!b.casting.domain),wizard=c.casters.find(b=>b.casting.classId==='wizard');
  book.spells.push({id:'qa-preparation',spellId:'bulls-strength',level:2,slotLevel:2,prepared:2,spent:1,formula:'',notes:'Keep my preparation',custom:null});book.slots[1].used=1;wizard.slots[1].used=1;
  recompute(c);c.hp-=3;
  await p.locator('input[aria-label="Import a Barrow Ledger character"]').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))});
  await p.waitForFunction(name=>document.querySelector('.character-name input')?.value===name,c.name);await saved();assert.deepEqual(await exported(),c);
  await p.getByRole('tab',{name:'Magic',exact:true}).click();
  await choose('Casting class / tradition',book.name);
  const panel=p.locator('details').filter({has:p.getByText('Spontaneous Cleric casting',{exact:true})});
  if(await panel.getAttribute('open')===null)await panel.locator('summary').click();
  const fixed=['good','evil'].includes(label);
  assert.equal(await panel.getByRole('combobox',{name:'Cleric channel',exact:true}).count(),fixed?0:1);
  if(fixed){assert.match(await panel.innerText(),new RegExp('deity alignment requires spontaneous '+effective));assert.match(await panel.innerText(),/saved .* choice is retained/);}
  await choose('Preparation to spend',/Bull.s Strength .*1 left/i);
  await p.getByRole('combobox',{name:'Spontaneous '+effective+' spell',exact:true}).click();
  const option=p.getByRole('option',{name:new RegExp('^'+effective+' Light Wounds \\(level 1\\)$','i')});await option.waitFor();
  assert.equal((await p.getByRole('option').allTextContents()).some(t=>new RegExp(effective==='cure'?'inflict':'cure','i').test(t)),false);
  await option.click();
  await choose('Roll destination','Practice on this sheet');
  await panel.getByRole('button',{name:new RegExp('^Cast '+effective+' Light Wounds using this preparation$','i')}).click();
  await saved();await p.reload();const out=await exported(),expected=structuredClone(c),eb=expected.casters.find(b=>b.id===book.id);
  eb.spells[0].spent++;
  assert.deepEqual(out,expected);assert.equal(out.clericChannel,stored);assert.equal(out.maxHp-out.hp,3);
  console.log('PASS '+label+' deity: correct channel/options; cast spends only selected preparation; reload preserves saved choice, other book and damage');
 }
 assert.deepEqual(errors,[]);console.log('PASS cleric channel browser regression');
}catch(e){if(p)console.error((await p.locator('body').innerText()).slice(-1800));throw e}finally{await browser.close()}
