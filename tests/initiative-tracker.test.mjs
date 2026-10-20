import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {newCharacter} from '../lib/model.ts';
import {makeInitiativeRoll,makeMacro,makeRequest,sheetTotals} from '../lib/rules.ts';
import {parseDiceFormula,rollFormula} from '../lib/dice.mjs';

test('initiative uses current sheet totals without changing an existing character',()=>{
 const c=newCharacter();c.scores.DEX=20;c.initiative=2;c.situational=-1;
 const before=structuredClone(c),r=makeInitiativeRoll(c);
 assert.equal(r.initiative,true);
 assert.equal(rollFormula(r.formula,()=>10).total,10+sheetTotals(c).initiative);
 assert.deepEqual(c,before);
 c.scores.DEX=22;
 assert.equal(rollFormula(makeInitiativeRoll(c).formula,()=>10).total,11+sheetTotals(before).initiative);
});

test('positive, zero and negative initiative use exactly one roll and one tracker directive',()=>{
 for(const bonus of [5,0,-3]){
  const c=newCharacter();c.automation.enabled=false;c.scores.DEX=10;c.initiative=bonus;c.situational=0;
  const r=makeInitiativeRoll(c),formula=bonus===0?'1d20':`1d20${bonus>0?'+':''}${bonus}`;
  assert.equal(r.formula,formula);
  for(const whisper of [false,true]){
   const request=makeRequest(r,c.name,'https://example.com/sheet?secret=1#notes',whisper);
   assert.equal(request.type,'chat-message');assert.equal(request.whisper,whisper?1:0);
   assert.equal(request.character.url,'https://example.com/sheet');
   assert.equal(request.message,makeMacro(r,c.name,whisper));
   assert.equal(request.message.startsWith('/w gm '),whisper);
   assert.ok(request.message.includes(`{{Roll=[[${formula} &{tracker}]]}}`));
   assert.equal(request.message.match(/\[\[/g).length,1);
   assert.equal(request.message.match(/&\{tracker\}/g).length,1);
  }
 }
});

test('practice initiative stays dice-only and ordinary rolls never opt into the tracker by name',()=>{
 const r=makeInitiativeRoll(newCharacter());let calls=0;
 assert.equal(parseDiceFormula(r.formula).formula,r.formula);
 rollFormula(r.formula,()=>{calls++;return 10;});assert.equal(calls,1);
 for(const title of ['Initiative','Attack','Spell','Connection test']){
  assert.ok(!makeMacro({title,formula:'1d20+5',details:''},'Buzzer').includes('&{tracker}'));
 }
 const bundled=makeMacro({...r,rolls:[{label:'Extra roll',formula:'1d6'}]},'Buzzer');
 assert.equal(bundled.match(/&\{tracker\}/g).length,1);
 assert.ok(bundled.includes('{{Extra roll=[[1d6]]}}'));
});

test('tracker metadata does not weaken macro injection protections',()=>{
 const r={...makeInitiativeRoll(newCharacter()),title:'Initiative &{tracker} }} {{bad=[[99]]}}',details:'@{secret} &{tracker}',fields:[['&{tracker}','[[99]]']]};
 const macro=makeMacro(r,'Buzzer &{tracker}');
 assert.equal(macro.match(/&\{tracker\}/g).length,1);
 assert.equal(macro.match(/\[\[/g).length,1);assert.ok(!macro.includes('@{'));
 assert.throws(()=>makeMacro({...r,formula:'1d20 &{tracker}'},'Buzzer'));
 assert.throws(()=>makeMacro({...r,rolls:[{label:'Injected',formula:'1d6 &{tracker}'}]},'Buzzer'));
});

test('Beyond20 bridge forwards the initiative tracker macro unchanged exactly once',()=>{
 const listeners=new Map(),dispatched=[];
 const document={addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent(event){dispatched.push(event);listeners.get(event.type)?.(event);return true;}};
 class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
 const window={};
 vm.runInNewContext(readFileSync(new URL('../public/bridge.js',import.meta.url),'utf8'),{document,window,CustomEvent});
 const r=makeInitiativeRoll(newCharacter()),request=makeRequest(r,'Buzzer','https://example.com/');
 assert.throws(()=>window.BarrowBeyond20.send(request));
 document.dispatchEvent(new CustomEvent('Beyond20_Loaded',{detail:[{}]}));
 window.BarrowBeyond20.send(request);
 const events=dispatched.filter(e=>e.type==='Beyond20_SendMessage');
 assert.equal(events.length,1);assert.equal(events[0].detail.length,1);
 assert.equal(events[0].detail[0],request);assert.ok(request.message.includes('&{tracker}]]'));
});

test('both sheet and combat initiative buttons use the shared tracker-aware roll',()=>{
 const source=readFileSync(new URL('../app/character-views.tsx',import.meta.url),'utf8');
 assert.equal(source.match(/roll\(makeInitiativeRoll\(c\)\)/g).length,2);
 assert.equal(source.match(/Roll20: select your token first to update the turn tracker\./g).length,2);
 assert.ok(!source.includes('Chat roll; add to the turn tracker'));
});
