import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {findClass,makeCaster,makePsionic} from '../lib/classes.ts';
import {castingDefinition,manifestDefinition} from '../lib/advancement.ts';
import {recompute,calculationWarnings} from '../lib/automation.ts';
import {initializeClassResources,gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {spellDC} from '../lib/rules.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {applyClericSpecialty} from '../lib/cleric-specialty.ts';

const options={name:'Casting identity QA',kind:'Fighter',level:3,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:14},method:'manual',hpMethod:'average'};
const create=(paired=false)=>createPlayerCharacter({...options,...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'fighter',right:'rogue'}))}:{})});
function customCaster(id='custom-unknown'){
 const p=makeCaster(findClass('wizard'),3,16);p.id='custom-caster';p.name='Wizard';p.list='Cleric';p.casting.classId=id;p.level=7;p.slots[1]={max:11,used:4};p.notes='Keep this custom preparation';
 p.spells=[{id:'custom-known',spellId:'bless',level:1,slotLevel:1,prepared:5,spent:3,formula:'',notes:'My choices',custom:null}];return p;
}
function customPsionic(id='custom-unknown'){
 const p=makePsionic(findClass('psion'),3,16);p.id='custom-psi';p.name='Psion';p.manifesting.classId=id;p.level=7;p.max=45;p.spent=12;p.focused=true;p.notes='My pool';
 p.powers=[{id:'power-choice',powerId:'vigor',name:'Vigor',level:1,cost:3,formula:'',notes:'Keep this power'}];return p;
}

test('explicit unsupported or unlinked class metadata cannot fall back to a familiar name or spell list',()=>{
 for(const id of ['custom-unknown','missing-class','']){
  assert.equal(castingDefinition(customCaster(id)),undefined);
  assert.equal(manifestDefinition(customPsionic(id)),undefined);
 }
 const legacy=customCaster();delete legacy.casting;assert.equal(castingDefinition(legacy).id,'wizard');
 legacy.name='Personal spellbook';assert.equal(castingDefinition(legacy).id,'cleric');
 const psi=customPsionic();delete psi.manifesting;assert.equal(manifestDefinition(psi).id,'psion');
 const linked=customCaster('wizard');linked.name='Renamed book';assert.equal(castingDefinition(linked).id,'wizard');
});

test('recomputation preserves unknown automatic and explicit manual pools, preparations and spent resources',()=>{
 for(const id of ['custom-unknown',''])for(const automatic of [true,false]){
  const c=createPlayerCharacter({...options,advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'cleric',right:'psion'}))});
  const caster=customCaster(id),psi=customPsionic(id);caster.casting.automatic=automatic;psi.manifesting.automatic=automatic;
  c.casters.push(caster);c.psionics.push(psi);const before=structuredClone({caster,psi});c.hp-=3;
  recompute(c);assert.deepEqual(c.casters.find(p=>p.id===caster.id),before.caster);assert.deepEqual(c.psionics.find(p=>p.id===psi.id),before.psi);assert.equal(c.maxHp-c.hp,3);
  if(automatic){const warnings=calculationWarnings(c).join('\n');assert.match(warnings,/Wizard.*supported casting table/);assert.match(warnings,/Psion.*supported manifesting table/);}
 }
});

test('same-named unrelated traditions cannot suppress real class resources, and renamed linked traditions are not duplicated',()=>{
 const c=create();c.casters=[customCaster()];c.psionics=[customPsionic()];const before=structuredClone({casters:c.casters,psionics:c.psionics});
 initializeClassResources(c,findClass('wizard'),1);initializeClassResources(c,findClass('psion'),1);
 assert.equal(c.casters.length,2);assert.equal(c.psionics.length,2);assert.deepEqual(c.casters[0],before.casters[0]);assert.deepEqual(c.psionics[0],before.psionics[0]);
 c.casters[1].name='My real book';c.psionics[1].name='Real mental powers';
 initializeClassResources(c,findClass('wizard'),2);initializeClassResources(c,findClass('psion'),2);
 assert.equal(c.casters.length,2);assert.equal(c.psionics.length,2);
 const legacy=create();legacy.casters=[makeCaster(findClass('wizard'),1)];legacy.psionics=[makePsionic(findClass('psion'),1)];delete legacy.casters[0].casting;delete legacy.psionics[0].manifesting;
 initializeClassResources(legacy,findClass('wizard'),1);initializeClassResources(legacy,findClass('psion'),1);assert.equal(legacy.casters.length,1);assert.equal(legacy.psionics.length,1);
});

test('a domain pool does not substitute for the primary cleric tradition',()=>{
 const c=create(),domain=makeCaster(findClass('cleric'),3,16);domain.casting.domain=true;domain.slots[1].used=1;c.casters=[domain];
 const before=structuredClone(domain);initializeClassResources(c,findClass('cleric'),1);
 assert.equal(c.casters.length,2);assert.deepEqual(c.casters[0],before);assert.equal(c.casters[1].casting.domain,false);
 initializeClassResources(c,findClass('cleric'),1);assert.equal(c.casters.length,2);
});

test('standard and paired advancement gain the correct real casting pool while retaining custom resources',()=>{
 for(const paired of [false,true]){
  const c=create(paired);c.casters=[customCaster()];c.experience=6000;c.hp-=3;const before=structuredClone(c);
  if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:'wizard',right:'rogue'}));else gainLevel(c,'wizard');
  recompute(c,before);assert.equal(c.level,4);assert.equal(c.maxHp-c.hp,3);assert.deepEqual(c.casters[0],before.casters[0]);
  const real=c.casters.find(p=>p.casting.classId==='wizard');assert.ok(real);assert.equal(real.level,1);assert.equal(real.slots[1].max,2);assert.equal(real.slots[1].used,0);
  assert.deepEqual(c.automation.history.slice(0,3),before.automation.history);
 }
});

test('explicit unlinked pools survive native and browser persistence without being adopted by name',async()=>{
 const c=create();c.casters=[customCaster('')];c.psionics=[customPsionic('')];c.notes='Keep this sheet';c.hp-=4;
 const before=structuredClone(c),loaded=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));
 assert.deepEqual(loaded,before);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn();
 const api=createBrowserCharacterApi({scope:'/casting-identity/',storage,lock});const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi({scope:'/casting-identity/',storage,lock});assert.deepEqual((await fresh('/api/characters/'+saved.id)).data,c);
});

test('unlinked labels cannot borrow split save abilities or certify typed casting prerequisites',()=>{
 const c=create(),p=customCaster('');p.name='Favored Soul';p.ability='INT';c.scores.INT=18;c.scores.WIS=10;
 assert.equal(spellDC(c,p,p.spells[0]),15,'use the recorded ability, not a same-named catalog class');
 p.casting.classId='favored-soul';assert.equal(spellDC(c,p,p.spells[0]),11,'real linked split-ability casting is retained');
 p.casting.classId='';p.casting.automatic=false;p.name='Wizard';p.slots[2].max=2;c.casters=[p];
 const eligibility=prestigeEligibility(c,findClass('mystic-theurge'));
 const arcane=eligibility.requirements.find(r=>/arcane spells/i.test(r.label));assert.ok(arcane);assert.equal(arcane.state,'missing');
});

test('Axe Brother selection leaves an explicitly unlinked same-named book untouched',()=>{
 const c=createPlayerCharacter({...options,kind:'Cleric'}),p=customCaster('');p.name='Cleric';p.casting.automatic=false;c.casters=[p];
 const before=structuredClone(p);applyClericSpecialty(c,'axe-brother');assert.equal(c.casters.length,2);assert.deepEqual(c.casters[0],before);
 const cleric=c.casters[1];assert.equal(cleric.casting.classId,'cleric');assert.ok(cleric.spells.some(k=>k.spellId==='silverbeard'));
 applyClericSpecialty(c,'axe-brother');assert.equal(c.casters.length,2);assert.deepEqual(c.casters[0],before);
});
