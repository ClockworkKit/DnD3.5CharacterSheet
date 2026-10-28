import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findClass,copyClassFeatures} from '../lib/classes.ts';
import {uncannyDodgeFeatures} from '../lib/defensive-class-features.ts';
import {sheetTotals} from '../lib/rules.ts';
import {recompute} from '../lib/automation.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {characterSchema} from '../lib/model.ts';

function candidate(gestalt=false){
 const c=createPlayerCharacter({name:'Defender regression QA',kind:'Fighter',level:7,raceId:'hill-dwarf',scores:{STR:14,DEX:18,CON:14,INT:12,WIS:10,CHA:10},method:'manual',...(gestalt?{advancementMode:'gestalt',gestaltPairs:Array.from({length:7},()=>({left:'fighter',right:'rogue'}))}:{})});
 c.alignment='LG';
 for(const name of ['Dodge','Endurance','Toughness'])c.features.push({id:name,name,kind:'Feat',description:'',source:'',max:0,used:0});
 c.experience=500000;recompute(c);return c;
}
function advance(c){
 const previous=structuredClone(c);
 if(c.advancementMode==='gestalt')applyGestaltLevel(c,previewGestaltLevel(c,{left:'dwarven-defender',right:'rogue',hitDieRoll:6}));
 else gainLevel(c,'dwarven-defender',6);
 recompute(c,previous);
}

test('Dwarven Defender catalog and browser reference retain features instead of mistaking AC for Special',()=>{
 const publicDef=JSON.parse(readFileSync(new URL('../public/data/classes.json',import.meta.url),'utf8')).find(d=>d.id==='dwarven-defender');
 for(const d of [findClass('dwarven-defender'),publicDef]){
  assert.match(d.levels[1].special,/Uncanny dodge/i);
  assert.match(d.levels[5].special,/Improved uncanny dodge/i);
  assert.match(d.levels[7].special,/Mobile defense/i);
  for(const r of d.levels)assert.match(r.special,new RegExp('AC dodge bonus \\+'+(1+Math.floor((r.level-1)/3))));
 }
});

test('Dwarven Defender grants basic and improved defenses at levels two and six through ordinary advancement',()=>{
 const c=candidate();c.hp-=3;
 advance(c);assert.equal(uncannyDodgeFeatures(c).sources.length,0);assert.equal(sheetTotals(c).flat,10);
 advance(c);assert.equal(sheetTotals(c).flat,15);assert.equal(uncannyDodgeFeatures(c).improved,false);
 c.automation.context.caughtFlatFooted=true;assert.equal(sheetTotals(c).ac,15);
 c.automation.context.helpless=true;assert.equal(sheetTotals(c).ac,10);c.automation.context.helpless=false;
 for(let i=3;i<=6;i++)advance(c);
 const defense=uncannyDodgeFeatures(c);assert.equal(defense.improved,true);assert.equal(defense.minimumRogueLevel,10);
 assert.deepEqual(defense.earned.map(s=>s.classId),['dwarven-defender']);assert.equal(sheetTotals(c).flat,16);
 assert.equal(c.maxHp-c.hp,3);copyClassFeatures(c);
 assert.match(c.features.find(f=>f.name==='Dwarven Defender class features').description,/Level 2:.*Uncanny dodge/);
});

test('ordinary second-source upgrade works but staggered gestalt keeps its existing explicit review policy',()=>{
 const ordinary=candidate();advance(ordinary);advance(ordinary);
 ordinary.classLevels.push({id:'rogue',classId:'rogue',name:'Rogue',level:4,notes:''});
 assert.equal(uncannyDodgeFeatures(ordinary).duplicateUpgrade,true);assert.equal(uncannyDodgeFeatures(ordinary).minimumRogueLevel,10);
 const paired=candidate(true);advance(paired);advance(paired);
 const defense=uncannyDodgeFeatures(paired);assert.equal(defense.duplicateUpgrade,false);assert.equal(defense.improved,true,'Rogue 9 already earned the listed improvement');
 assert.match(defense.review,/DM review/);assert.equal(defense.minimumRogueLevel,null);
 assert.deepEqual(defense.sources.map(s=>s.classId).sort(),['dwarven-defender','rogue']);
 assert.equal(sheetTotals(paired).flat,15);assert.equal(paired.level,9);
});

test('existing defender saves gain the explanation without losing history, injuries, or spent stance uses',async()=>{
 const c=candidate(true);for(let i=0;i<6;i++)advance(c);
 c.hp-=4;const stance=c.features.find(f=>f.name==='Defensive stance');assert.ok(stance);stance.used=2;
 c.automation.context.caughtFlatFooted=true;recompute(c);
 const snapshot=structuredClone(c);uncannyDodgeFeatures(c);sheetTotals(c);assert.deepEqual(c,snapshot);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
 assert.deepEqual(loaded,c);assert.equal(loaded.maxHp-loaded.hp,4);assert.equal(loaded.features.find(f=>f.name==='Defensive stance').used,2);
 assert.ok(uncannyDodgeFeatures(loaded).earned.some(s=>s.classId==='dwarven-defender'));
 assert.deepEqual(await prepareCharacter(characterSchema.parse(loaded)),loaded);
});

test('legacy numeric-only generated summaries repair narrowly and preserve player additions and counters',async()=>{
 const c=candidate();advance(c);advance(c);
 const entry=c.classLevels.find(e=>e.classId==='dwarven-defender'),card=c.features.find(f=>f.id==='class-summary-'+entry.id);
 const corrected=card.description+'\n\nPlayer note: hold the bridge.';
 card.description=corrected.replace(/^Level 1:.*\nLevel 2:.*\n/, 'Level 1: +1\nLevel 2: +1\n');
 assert.notEqual(card.description,corrected);card.max=3;card.used=2;c.hp-=2;
 const expected=structuredClone(c);expected.features.find(f=>f.id===card.id).description=corrected;
 const loaded=await prepareCharacter(characterSchema.parse(c));assert.deepEqual(loaded,expected);
 assert.deepEqual(await prepareCharacter(characterSchema.parse(loaded)),loaded);
 const edited=structuredClone(c);edited.features.find(f=>f.id===card.id).description='My custom defense notes.';
 const retained=await prepareCharacter(characterSchema.parse(edited));assert.equal(retained.features.find(f=>f.id===card.id).description,'My custom defense notes.');
 const full=structuredClone(c),fullCard=full.features.find(f=>f.id===card.id);fullCard.description=fullCard.description.padEnd(20000,'x');
 const preserved=await prepareCharacter(characterSchema.parse(full));assert.equal(preserved.features.find(f=>f.id===card.id).description,fullCard.description,'repair must not overflow the saved text limit');
});
