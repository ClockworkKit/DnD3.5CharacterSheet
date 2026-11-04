import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {recompute} from '../lib/automation.ts';
import {advancementChoices,recordAdvancementChoice,advancementChoiceWarnings} from '../lib/advancement-choices.ts';
import {featCount,hasFeat} from '../lib/effects.ts';
import {selectAlternateBonusFeat} from '../lib/alternate-grants.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {resetDaily} from '../lib/rules.ts';
import {characterSchema} from '../lib/model.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const make=(kind='Barbarian',level=3,paired=false)=>createPlayerCharacter({name:'Feat preservation QA',kind,level,raceId:'human',scores:{STR:16,DEX:16,CON:14,INT:14,WIS:14,CHA:14},method:'manual',hpMethod:'average',...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:level},()=>({left:kind.toLowerCase(),right:'wizard'}))}:{})});
const choose=(c,id,choice='')=>{configureAlternateFeature(c,id,{reviewed:true,choice});selectAlternateFeature(c,id,true);recompute(c);};
const brawler='acf-grant:barbarian-city-brawler:unarmed';
const personalized=f=>{f.description='My training notes\n'+f.description;f.source='My campaign notes';f.max=5;f.used=2;};

test('alternate-granted feat records retain personal text and counters on standard and paired sheets',()=>{
 for(const paired of [false,true]){const c=make('Barbarian',3,paired);choose(c,'barbarian-city-brawler');const f=c.features.find(f=>f.ruleId===brawler);personalized(f);const before=structuredClone(f);recompute(c);assert.deepEqual(c.features.find(x=>x.id===f.id),before);}
});

test('renaming a catalog-granted feat cannot create a second copy or lose its mechanical identity',()=>{
 const c=make('Swashbuckler'),f=c.features.find(f=>f.ruleId==='granted:swashbuckler:1:Weapon Finesse');personalized(f);f.name='My dueling training';const id=f.id;recompute(c);
 assert.equal(c.features.filter(f=>f.ruleId==='granted:swashbuckler:1:Weapon Finesse').length,1);assert.equal(c.features.find(f=>f.id===id).name,'My dueling training');assert.equal(hasFeat(c,'Weapon Finesse'),true);assert.equal(featCount(c,'Weapon Finesse'),1);
});

test('changing and restoring a style restores the original feat card rather than reusing its ID for another feat',()=>{
 const c=make('Monk',2);choose(c,'monk-fighting-styles','Cobra Strike');const f=c.features.find(f=>f.ruleId==='acf-grant:monk-fighting-styles:style-1');personalized(f);const original=structuredClone(f);
 configureAlternateFeature(c,'monk-fighting-styles',{choice:'Undying Way'});recompute(c);assert.equal(c.features.some(f=>f.id===original.id),false);assert.ok(c.retiredResources?.some(f=>f.id===original.id));
 configureAlternateFeature(c,'monk-fighting-styles',{choice:'Cobra Strike'});recompute(c);assert.deepEqual(c.features.find(f=>f.id===original.id),original);
});

test('class-granted and alternate-granted feats cannot spend an ordinary advancement selection',()=>{
 const c=make();choose(c,'barbarian-city-brawler');const f=c.features.find(f=>f.ruleId===brawler);
 assert.throws(()=>recordAdvancementChoice(c,'general-0',f.id),/selected feat|class.granted/i);
 c.advancementChoices['general-0']=f.id;const before=structuredClone(c.advancementChoices);assert.equal(advancementChoices(c).find(r=>r.key==='general-0').choice,'');assert.deepEqual(c.advancementChoices,before,'old assignments remain saved for review');
 assert.match(advancementChoiceWarnings(c)[0],/class-granted feat.*retained/);
});

test('choice-specific weapon grants retain separate identities and restore their original notes',()=>{
 const c=make('Sorcerer',4);c.skills.find(s=>s.name==='Knowledge (arcana)').ranks=1;choose(c,'sorcerer-stalwart-sorcerer');configureAlternateFeature(c,'sorcerer-stalwart-sorcerer',{rules:{weapon:'Longsword'}});recompute(c);
 const f=c.features.find(f=>f.ruleId==='acf-grant:sorcerer-stalwart-sorcerer:focus');personalized(f);f.name='My sword training';const original=structuredClone(f);
 for(const weapon of ['Battleaxe','Warhammer','Longsword']){configureAlternateFeature(c,'sorcerer-stalwart-sorcerer',{rules:{weapon}});recompute(c);assert.equal(hasFeat(c,'Weapon Focus',weapon),true);assert.equal(featCount(c,'Weapon Focus'),1);}
 assert.deepEqual(c.features.find(f=>f.id===original.id),original);
 assert.equal(c.retiredResources.filter(f=>f.ruleId==='acf-grant:sorcerer-stalwart-sorcerer:focus').length,2);characterSchema.parse(c);
});

test('separate repeatable bonus selections stack with a personal feat without merging their cards',()=>{
 const c=make('Soulknife',7);c.features.push({id:'personal-toughness',name:'Toughness',kind:'Feat',description:'Personal general feat',source:'My book',max:0,used:0});choose(c,'soulknife-bonus-feats');
 selectAlternateBonusFeat(c,'soulknife-bonus-feats','feat-3','toughness');selectAlternateBonusFeat(c,'soulknife-bonus-feats','feat-7','toughness');recompute(c);
 assert.equal(featCount(c,'Toughness'),3);assert.equal(c.features.find(f=>f.id==='personal-toughness').description,'Personal general feat');
 selectAlternateBonusFeat(c,'soulknife-bonus-feats','feat-3','');assert.equal(featCount(c,'Toughness'),2);selectAlternateBonusFeat(c,'soulknife-bonus-feats','feat-3','toughness');assert.equal(featCount(c,'Toughness'),3);
});

test('overlapping fixed class grants keep one existing source and ordinary personal feats remain independent',()=>{
 const c=make('Artificer',4),f=c.features.find(f=>f.ruleId==='granted:artificer:1:Scribe Scroll');personalized(f);const original=structuredClone(f);
 c.classLevels.push(...make('Archivist',1).classLevels);recompute(c);assert.equal(featCount(c,'Scribe Scroll'),1);assert.deepEqual(c.features.find(f=>f.id===original.id),original);
 c.classLevels=c.classLevels.filter(e=>e.classId!=='artificer');recompute(c);assert.equal(featCount(c,'Scribe Scroll'),1);assert.ok(c.retiredResources.some(f=>f.id===original.id));
 const b=make();choose(b,'barbarian-city-brawler');const granted=b.features.find(f=>f.ruleId===brawler);personalized(granted);const saved=structuredClone(granted);
 const personal={id:'personal-unarmed',name:'Improved Unarmed Strike',kind:'Feat',description:'My selected feat',source:'My book',max:0,used:0};b.features.push(personal);recompute(b);assert.equal(featCount(b,'Improved Unarmed Strike'),1);assert.deepEqual(b.features.find(f=>f.id===personal.id),personal);assert.deepEqual(b.retiredResources.find(f=>f.id===saved.id),saved);
 b.features=b.features.filter(f=>f.id!==personal.id);recompute(b);assert.deepEqual(b.features.find(f=>f.id===saved.id),saved);
});

test('catalog level changes and paired advancement preserve grant records, damage and spell expenditure',()=>{
 const c=make('Artificer',6),f=c.features.find(f=>f.ruleId==='granted:artificer:6:Craft Wand');personalized(f);const original=structuredClone(f);
 c.classLevels[0].level=4;recompute(c);assert.ok(c.retiredResources.some(f=>f.id===original.id));c.classLevels[0].level=6;recompute(c);assert.deepEqual(c.features.find(f=>f.id===original.id),original);
 const g=make('Barbarian',3,true);choose(g,'barbarian-city-brawler');const feat=g.features.find(f=>f.ruleId===brawler);personalized(feat);const before=structuredClone(feat);g.hp-=3;g.casters[0].slots[1].used=1;g.experience=6000;
 applyGestaltLevel(g,previewGestaltLevel(g,{left:'barbarian',right:'wizard'}));recompute(g);assert.deepEqual(g.features.find(f=>f.id===feat.id),before);assert.equal(g.maxHp-g.hp,3);assert.equal(g.casters[0].slots[1].used,1);
});

test('legacy generated and duplicate cards remain readable without duplicate benefits or lost notes',()=>{
 const c=make();choose(c,'barbarian-city-brawler');const f=c.features.find(f=>f.ruleId===brawler);delete f.grantedFeat;delete f.generatedSummary;personalized(f);
 const duplicate={...structuredClone(f),id:'legacy-duplicate',description:'Other legacy notes'};c.features.push(duplicate);recompute(c);assert.equal(featCount(c,'Improved Unarmed Strike'),1);assert.equal(c.features.find(f=>f.id===duplicate.id).description,'Other legacy notes');assert.match(c.features.find(x=>x.id===f.id).description,/My training notes/);
 selectAlternateFeature(c,'barbarian-city-brawler',false);recompute(c);assert.equal(c.retiredResources.filter(f=>f.ruleId===brawler).length,2);characterSchema.parse(c);
 selectAlternateFeature(c,'barbarian-city-brawler',true);recompute(c);assert.equal(featCount(c,'Improved Unarmed Strike'),1);assert.equal(c.features.find(x=>x.id===f.id).used,2);assert.equal(c.retiredResources.find(f=>f.id===duplicate.id).description,'Other legacy notes');
});

test('native and fresh storage loads retain active/inactive feat choices and invalid old advancement assignments',async()=>{
 const c=make('Monk',2,true);choose(c,'monk-fighting-styles','Cobra Strike');const f=c.features.find(f=>f.ruleId==='acf-grant:monk-fighting-styles:style-1');personalized(f);c.advancementChoices['general-0']=f.id;
 configureAlternateFeature(c,'monk-fighting-styles',{choice:'Undying Way'});recompute(c);c.hp-=3;c.casters[0].slots[1].used=1;const ranks=structuredClone(c.automation.history);
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(loaded,c);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();const api=createBrowserCharacterApi({scope:'/feat-grant-qa/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/feat-grant-qa/',storage,lock});const restored=await prepareCharacter((await fresh('/api/characters/'+saved.id)).data);assert.deepEqual(restored,c);
 configureAlternateFeature(restored,'monk-fighting-styles',{choice:'Cobra Strike'});recompute(restored);assert.equal(restored.features.find(x=>x.id===f.id).used,2);assert.equal(restored.maxHp-restored.hp,3);assert.equal(restored.casters[0].slots[1].used,1);assert.deepEqual(restored.automation.history,ranks);assert.equal(restored.advancementChoices['general-0'],f.id);assert.equal(advancementChoices(restored).find(r=>r.key==='general-0').choice,'');
 configureAlternateFeature(restored,'monk-fighting-styles',{choice:'Undying Way'});recompute(restored);const rested=resetDaily(restored);configureAlternateFeature(rested,'monk-fighting-styles',{choice:'Cobra Strike'});recompute(rested);assert.equal(rested.features.find(x=>x.id===f.id).used,0);assert.match(rested.features.find(x=>x.id===f.id).description,/My training notes/);
});
