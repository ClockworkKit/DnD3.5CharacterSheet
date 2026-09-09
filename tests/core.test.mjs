import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {readFileSync} from "node:fs";
import {modifier, totals, makeRoll, parseDiceFormula, rollFormula, buildMacro, buildBeyond20Request} from "../lib/dice.mjs";

function adventurer() {
  return {name: "Borin Stoneward", scores: {STR:16, DEX:12, CON:14, INT:10, WIS:10, CHA:8}, bab:3, size:0, attackExtra:0, damageExtra:0, situational:0, weaponName:"Battleaxe", weaponDice:"1d8", saves:{fort:{base:3,extra:0},ref:{base:1,extra:0},will:{base:1,extra:0}}, skill:{name:"Spot",ability:"WIS",ranks:0,extra:0},customFormula:"2d6+3"};
}
test("3.5 odd scores round down, including negative modifiers", () => {
  assert.equal(modifier(9), -1);
  assert.equal(modifier(1), -5);
  assert.equal(modifier(17), 3);
});
test("sample fighter has the expected attack, damage, saves, and initiative", () => {
  const state=adventurer();
  assert.equal(makeRoll("attack",state).formula,"1d20+6");
  assert.equal(makeRoll("damage",state).formula,"1d8+3");
  assert.equal(makeRoll("save:fort",state).formula,"1d20+5");
  assert.equal(makeRoll("save:ref",state).formula,"1d20+2");
  assert.equal(makeRoll("save:will",state).formula,"1d20+1");
  assert.equal(makeRoll("initiative",state).formula,"1d20+1");
});
test("edits, penalties, and critical confirmation use the current numbers", () => {
  const state=adventurer();
  state.scores.STR=9; state.attackExtra=2;state.situational=-3;
  assert.equal(makeRoll("attack",state).formula,"1d20+1");
  assert.equal(makeRoll("confirm",state).formula,"1d20+1");
  assert.equal(makeRoll("damage",state).formula,"1d8-1");
  assert.equal(makeRoll("ability:CHA",state).formula,"1d20-4");
  assert.equal(makeRoll("test",state).formula,"1d20");
  assert.equal(makeRoll("custom",state).formula,"2d6+3");
});
test("half ranks are recorded but do not improve a 3.5 skill check", () => {
  const state=adventurer();state.skill.ranks=1.5;state.skill.extra=2;
  assert.equal(totals(state).skill,3);
  state.skill.ranks=2;
  assert.equal(totals(state).skill,4);
});
test("practice roller shows the exact dice used, handles subtraction, and canonicalizes formulas", () => {
  const values=[2,5,3];
  const result=rollFormula("2D6 + 3 - d4",()=>values.shift());
  assert.equal(result.total,7);
  assert.equal(result.formula,"2d6+3-1d4");
  assert.match(result.detail,/2d6 \(2, 5\)/);
  assert.equal(rollFormula("1d20-5",()=>1).total,-4);
});
test("malformed, executable, and excessive formulas are rejected", () => {
  for(const invalid of ["", "1d20+", "1d20++5", "1d20;alert(1)", "[[1d20]]", "@{STR}", "101d6", "1d1001", "1d1", "0d6", "2**3", "1e9", "0/0"]){
    assert.throws(()=>parseDiceFormula(invalid),invalid);
  }
});
test("Roll20 macro keeps labels from injecting fields or commands", () => {
  const roll={title:"Attack }} {{Injected=[[100]]}}\n/w gm",formula:"1d20+6",details:"normal"};
  const macro=buildMacro(roll,"Borin @{other|secret}",true);
  assert.ok(macro.startsWith("/w gm &{template:default}"));
  assert.equal((macro.match(/\[\[/g)||[]).length,1);
  assert.equal((macro.match(/\{\{/g)||[]).length,5);
  assert.ok(!macro.includes("\n"));
  assert.ok(!macro.includes("@{"));
});
test("Beyond20 receives a generic chat message with the 3.5 formula and no URL query data", () => {
  const state=adventurer();
  const request=buildBeyond20Request(makeRoll("attack",state),state.name,"https://example.com/sheet?token=private#notes",true);
  assert.equal(request.action,"roll");assert.equal(request.type,"chat-message");
  assert.equal(request.character.type,"BarrowSheet");
  assert.equal(request.character.url,"https://example.com/sheet");
  assert.match(request.message,/\[\[1d20\+6\]\]/);
  assert.ok(request.message.startsWith("/w gm "));
  assert.equal(request.advantage,0);
});
test("connection refuses requests until detected, then uses the documented one-element event array", () => {
  const listeners=new Map();const dispatched=[];
  const document={addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent(event){dispatched.push(event);listeners.get(event.type)?.(event);return true;}};
  class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
  const window={};
  vm.runInNewContext(readFileSync(new URL("../public/bridge.js",import.meta.url),"utf8"),{document,window,CustomEvent});
  const request=buildBeyond20Request(makeRoll("test",adventurer()),"Borin","https://example.com/");
  assert.equal(window.BarrowBeyond20.detected,false);
  assert.throws(()=>window.BarrowBeyond20.send(request));
  assert.equal(dispatched.length,0);
  document.dispatchEvent(new CustomEvent("Beyond20_Loaded",{detail:[{}]}));
  assert.equal(window.BarrowBeyond20.detected,true);
  window.BarrowBeyond20.send(request);
  const event=dispatched.find(e=>e.type==="Beyond20_SendMessage");
  assert.equal(event.detail.length,1);
  assert.equal(event.detail[0],request);
});
