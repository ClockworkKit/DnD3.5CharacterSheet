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
 const scores={Strength:14,Dexterity:12,Constitution:14,Intelligence:16,Wisdom:14,Charisma:12};
 const create=async(name,left='Fighter',right='',level=1,scoreOverrides={},race='Human')=>{
  await p.getByRole('button',{name:await p.getByRole('button',{name:'New',exact:true}).count()?'New':'Create character',exact:true}).click();
  const d=p.getByRole('dialog');
  assert.match(await d.getByLabel('Advancement mode',{exact:true}).innerText(),/^Standard/);
  assert.match(await d.getByLabel('Hit points',{exact:true}).innerText(),/^Standard/);
  await d.getByLabel('Character name',{exact:true}).fill(name);
  await choose(d,'Race',race);
  await choose(d,'Generation method','Enter scores manually');
  await d.getByRole('textbox',{name:'Starting alignment',exact:true}).fill('Neutral Good');
  for(const [ability,value] of Object.entries({...scores,...scoreOverrides}))await d.getByLabel(ability+' base',{exact:true}).fill(String(value));
  if(right){
   await choose(d,'Advancement mode','Gestalt D&D 3.5e');
   await d.getByLabel('Starting paired class levels',{exact:true}).fill(String(level));
   for(let n=1;n<=level;n++){await choose(d,'Level '+n+' left class',left);await choose(d,'Level '+n+' right class',right);}
  }else {
   await choose(d,'Starting class',left);await d.getByLabel('Starting class level',{exact:true}).fill(String(level));
  }
  await d.getByRole('button',{name:'Create character',exact:true}).click();await saved();return exported();
 };
 const classes=c=>Object.fromEntries(c.classLevels.map(e=>[e.classId,e.level]));
 const checkNumbers=(c,expected)=>{const a=advancementNumbers(c);for(const [key,value]of Object.entries(expected))assert.equal(a[key],value,key)};

 let c=await create('Acceptance standard Fighter','Fighter','',1,{Intelligence:12,Wisdom:10,Charisma:10});
 assert.equal(c.advancementMode,'standard');assert.equal(c.automation.hpMethod,'rolled');
 assert.equal(c.maxHp,12);assert.equal(c.hp,12);assert.equal(c.bab,1);assert.equal(c.experience,0);
 assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[2,0,0]);
 checkNumbers(c,{skillBudget:16,feats:2,fighterFeats:1,abilityIncreases:0,nextXp:1000});
 assert.deepEqual(optionalRuleSettings(c),[]);assert.deepEqual(c.defense.drSources,[]);
 await tab('Gear');await p.getByRole('button',{name:'Choose equipment',exact:true}).click();
 const gear=p.getByRole('dialog');await gear.getByLabel('Find equipment',{exact:true}).fill('Chainmail');
 await gear.locator('.catalog-row').filter({has:p.getByText('Chainmail',{exact:true})}).getByRole('button',{name:'+ Add',exact:true}).click();
 c=await exported();assert.equal(c.defense.armor,5);assert.equal(await p.locator('.character-seal strong').innerText(),'16');assert.deepEqual(c.defense.drSources,[]);
 await tab('Sheet');await p.getByLabel('Current HP',{exact:true}).fill('9');await p.getByLabel('Experience',{exact:true}).fill('1000');
 await p.getByLabel('New Hit Die roll (d10)',{exact:true}).fill('2');
 await p.getByRole('button',{name:'Gain level 2 in Fighter',exact:true}).click();
 c=await roundTrip();assert.equal(c.level,2);assert.equal(c.maxHp,16);assert.equal(c.hp,13);assert.equal(c.automation.history[1].hitDieRoll,2);
 const recorded=c.automation.history.map(h=>h.hitDieRoll);
 await tab('Calculations');
 for(const [label,max] of [['Maximum each die',24],['Average (round total up)',20],['Recorded die rolls',16]]){
  await choose(p,'HP method',label);c=await exported();assert.equal(c.maxHp,max);assert.equal(c.maxHp-c.hp,3);assert.deepEqual(c.automation.history.map(h=>h.hitDieRoll),recorded);
 }
 await roundTrip();console.log('PASS standard Fighter: defaults, armor AC, recorded advancement, independent HP options, damage and reload');

 const legacy=createPlayerCharacter({name:'Acceptance old house rules',kind:'Cleric',level:3,raceId:'human',method:'manual',hpMethod:'maximum',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:16,CHA:10}});
 legacy.ancestry.ignoreLevelAdjustment=true;legacy.automation.encumbrance=false;
 legacy.automation.adjustments.maxHp=5;legacy.automation.overrides['defense.armor']=1;
 legacy.automation.history[0].skillPoints=42;legacy.automation.history[0].skillClassOverrides[legacy.skills[0].id]=true;
 legacy.defense.drSources.push({id:'house-dr',source:'Campaign armor rule',amount:3,bypass:'',active:true,gearId:'',notes:'Keep this'});
 legacy.casters[0].slots[1].used=1;recompute(legacy);legacy.hp-=4;
 await importSheet(legacy);assert.deepEqual(await roundTrip(),legacy);assert.equal(optionalRuleSettings(await exported()).length,5);
 console.log('PASS legacy homebrew: exact native import/save/reload preserves independent settings, training, injury and expenditure');

 c=await create('Acceptance Fighter Wizard 5','Fighter','Wizard',5);
 assert.equal(c.level,5);assert.equal(c.experience,10000);assert.deepEqual(classes(c),{fighter:5,wizard:5});
 assert.equal(c.bab,5);assert.deepEqual([c.saves.fort.base,c.saves.ref.base,c.saves.will.base],[4,1,4]);
 checkNumbers(c,{skillBudget:48,feats:3,fighterFeats:3,wizardFeats:1,abilityIncreases:1});
 assert.equal(c.automation.history.length,5);assert.equal(c.automation.history[0].hitDieRoll,10);
 assert.ok(c.automation.history.slice(1).every(h=>h.hitDieRoll>=1&&h.hitDieRoll<=10));
 assert.equal(c.maxHp,c.automation.history.reduce((n,h)=>n+h.hitDieRoll,10));assert.equal(c.casters[0].level,5);
 assert.deepEqual(optionalRuleSettings(c),[]);
 await p.locator('.advancement-reminders > summary').click();
 await choose(p,'Level 4 ability increase ability','Dexterity');
 await p.getByRole('button',{name:'Apply +1 to base score',exact:true}).click();
 c=await roundTrip();assert.equal(c.scores.DEX,13);assert.equal(Object.keys(c.advancementChoices).length,1);
 await importSheet(c);assert.deepEqual(await roundTrip(),c);
 console.log('PASS Fighter5/Wizard5: five actual levels, better bonuses, HP/skills once, one ability increase, both tracks round-trip');

 c=await create('Acceptance Ranger Rogue','Ranger','Rogue',3);
 checkNumbers(c,{skillBudget:72});await tab('Skills');
 await choose(p,'Spend points at',/^Level 1 /);
 for(const name of ['Survival','Use Magic Device','Search']){
  await p.getByLabel('Find a skill',{exact:true}).fill(name);
  await p.getByLabel(name+' points at this level',{exact:true}).fill('4');
 }
 c=await roundTrip();assert.equal(skillLedger(c).spent,12);
 for(const name of ['Survival','Use Magic Device','Search']){const s=c.skills.find(s=>s.name===name);assert.equal(s.ranks,4);assert.equal(s.classSkill,true);}
 assert.ok(c.features.some(f=>f.name==='Ranger class features'));assert.ok(c.features.some(f=>f.name==='Rogue class features'));
 console.log('PASS Ranger/Rogue: both class-skill lists, 72 points, recorded purchases and both feature sets');

 c=await create('Acceptance Wizard Cleric','Wizard','Cleric',5);
 assert.equal(c.casters.length,3);assert.ok(c.casters.every(book=>book.level===5));
 const wiz=c.casters.find(b=>b.casting.classId==='wizard'),cleric=c.casters.find(b=>b.casting.classId==='cleric'&&!b.casting.domain),domain=c.casters.find(b=>b.casting.domain);
 assert.equal(wiz.ability,'INT');assert.equal(cleric.ability,'WIS');
 assert.deepEqual(domain.slots.map(s=>s.max),[0,1,1,1,0,0,0,0,0,0]);
 // A synthetic native fixture represents resources spent before this player levels up.
 c.hp-=3;wiz.slots[1].used=2;cleric.slots[1].used=1;domain.slots[1].used=1;c.experience=15000;c.name+=' spent';
 await importSheet(c);
 await p.getByLabel('One new Hit Die roll (d8)',{exact:true}).fill('4');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByRole('button',{name:'Confirm paired level 6',exact:true}).click();
 const advanced=await roundTrip();assert.equal(advanced.level,6);assert.equal(advanced.maxHp-advanced.hp,3);
 for(const book of c.casters){const next=advanced.casters.find(b=>b.id===book.id);assert.equal(next.level,6);assert.equal(next.slots[1].used,book.slots[1].used);assert.equal(next.ability,book.ability);}
 console.log('PASS Wizard/Cleric: independent books/domain slots and advancement retain each expenditure and injury');

 c=await create('Acceptance side changes','Fighter','Wizard',2);
 await p.getByLabel('Experience',{exact:true}).fill('6000');
 await choose(p,'Left class to advance','Cleric 1');await choose(p,'Right class to advance','Rogue 1');
 await p.getByLabel('One new Hit Die roll (d8)',{exact:true}).fill('4');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByRole('button',{name:'Cancel level review',exact:true}).click();assert.equal((await exported()).level,2);
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByLabel('Character name',{exact:true}).fill('Acceptance side changes renamed');
 await p.getByText('The character changed. Refresh the paired level review before confirming.',{exact:true}).waitFor();
 assert.equal(await p.getByRole('button',{name:'Confirm paired level 3',exact:true}).count(),0);
 await p.getByRole('button',{name:'Refresh paired level review',exact:true}).click();
 await p.getByRole('button',{name:'Confirm paired level 3',exact:true}).click();
 await choose(p,'Left class to advance','Wizard 3');await choose(p,'Right class to advance','Cleric 2');
 await p.getByLabel('One new Hit Die roll (d8)',{exact:true}).fill('5');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();await p.getByRole('button',{name:'Confirm paired level 4',exact:true}).click();
 c=await roundTrip();assert.deepEqual(classes(c),{fighter:2,wizard:3,cleric:2,rogue:1});checkNumbers(c,{feats:3,abilityIncreases:1});
 console.log('PASS side changes: independent classes, cancel/stale reviews, one level/feat/ability schedule');

 c=await create('Acceptance prestige boundary','Wizard','Fighter',4,{},'Elf');
 await p.getByLabel('Experience',{exact:true}).fill('21000');
 await choose(p,'Right class to advance','Eldritch Knight 1');
 await p.getByLabel('Approving GM for Eldritch Knight',{exact:true}).fill('Synthetic QA GM');
 await p.getByLabel('Approval reason for Eldritch Knight',{exact:true}).fill('Explicit test-only combination exception');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByRole('alert').filter({hasText:'before gaining this level'}).waitFor();assert.equal((await exported()).level,4);
 await choose(p,'Right class to advance','Fighter 5');
 await p.getByLabel('One new Hit Die roll (d10)',{exact:true}).fill('4');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();await p.getByRole('button',{name:'Confirm paired level 5',exact:true}).click();
 await choose(p,'Right class to advance','Eldritch Knight 1');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();await p.getByRole('alert').filter({hasText:'Record the approving GM'}).waitFor();
 await p.getByLabel('Approving GM for Eldritch Knight',{exact:true}).fill('Synthetic QA GM');
 await p.getByLabel('Approval reason for Eldritch Knight',{exact:true}).fill('Explicit test-only combination exception');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();await p.getByRole('button',{name:'Confirm paired level 6',exact:true}).click();
 c=await roundTrip();assert.equal(c.level,6);assert.deepEqual(classes(c),{wizard:6,fighter:5,'eldritch-knight':1});assert.equal(c.casters[0].level,6);
 assert.equal(c.gestaltProgression.levels.at(-1).approvals.length,1);
 // Both choices independently qualify, so rejection must come from the pair rule.
 for(const name of ['Point Blank Shot','Precise Shot','Weapon Focus'])c.features.push({id:'qa-'+name,name,choice:name==='Weapon Focus'?'Longbow':'',kind:'Feat',description:'Synthetic eligibility fixture',source:'',max:0,used:0});
 c.name+=' qualified archer';recompute(c);await importSheet(c);c=await exported();
 await choose(p,'Left class to advance','Arcane Archer 1');await choose(p,'Right class to advance','Eldritch Knight 2');
 await p.getByLabel('Approving GM for Eldritch Knight',{exact:true}).fill('Synthetic QA GM');
 await p.getByLabel('Approval reason for Eldritch Knight',{exact:true}).fill('Does not waive pair restrictions');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByRole('alert').filter({hasText:/two prestige|one prestige/i}).waitFor();assert.deepEqual(await exported(),c);
 await choose(p,'Left class to advance','Wizard 7');await choose(p,'Right class to advance','Wizard 7');
 await p.getByRole('button',{name:'Review paired level',exact:true}).click();
 await p.getByRole('alert').filter({hasText:/same class|two different classes/i}).waitFor();assert.deepEqual(await exported(),c);
 console.log('PASS prestige: qualification before level, per-level GM exception, legal entry, two-prestige/same-class rejection');
 assert.deepEqual(errors,[]);console.log('PASS all original named browser acceptance scenarios');
}catch(e){if(p){console.error(await p.getByRole('alert').allTextContents());console.error((await p.locator('body').innerText()).slice(-2500));}throw e;}finally{await browser.close();}
