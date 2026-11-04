import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {customClassDraft,customClassTable,previewCustomClassChange,applyCustomClassChange} from '../lib/custom-class-editor.ts';
import {customClassSchema} from '../lib/custom-class-schema.ts';
import {characterSchema} from '../lib/model.ts';
import {findClass,makeCaster,makePsionic} from '../lib/classes.ts';
import {castingDefinition,manifestDefinition,castingNumbers,casterProgression,psionicProgression,advanceTargets,customResourceProblems} from '../lib/advancement.ts';
import {recompute,calculationWarnings} from '../lib/automation.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {gestaltCastingChoices} from '../lib/gestalt-casting.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {manifestingProblem,powerReserve} from '../lib/psionics.ts';
import {spellDC,castingProblem} from '../lib/rules.ts';
import {specialSpellFailure} from '../lib/class-systems.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const options={name:'Custom resource QA',kind:'Fighter',level:3,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:14,CHA:12},method:'manual',hpRolls:[3,2]};
// Synthetic source configurations reuse published tables; names never confer mechanics.
function profile(kind='wizard',id='custom-'+kind){
 const p=customClassDraft(createPlayerCharacter(options)),source=findClass(kind);
 Object.assign(p.definition,{id,name:source.name,hitDie:source.hitDie,skillPoints:source.skillPoints,skills:'Knowledge (all), Spellcraft, Concentration',source:source.source,levels:structuredClone(source.levels)});
 p.policy.family=id;p.policy.bonusProfile={bab:kind==='paladin'?'full':'poor',fort:kind==='paladin'?'good':'poor',ref:'poor',will:kind==='paladin'?'poor':'good'};
 if(kind==='psion')p.definition.manifesting={ability:'INT',startLevel:1,levelOffset:0,bonusPoints:0};
 else p.definition.casting={ability:kind==='paladin'?'WIS':'INT',mode:'prepared',type:kind==='paladin'?'divine':'arcane',list:kind==='paladin'?'Paladin':'Sorcerer / Wizard',startLevel:kind==='paladin'?4:1,halfLevel:kind==='paladin'};
 return customClassSchema.parse(p);
}
function create(profiles,pairs){return createPlayerCharacter({...options,kind:profiles[0].definition.id,customClasses:profiles,...(pairs?{level:pairs.length,advancementMode:'gestalt',gestaltPairs:pairs.map(([left,right])=>({left,right})),hpRolls:Array(pairs.length-1).fill(3)}:{})});}
const repeat=(a,b,n=3)=>Array.from({length:n},()=>[a,b]);
function apply(c,review){const old=structuredClone(c);applyGestaltLevel(c,review);recompute(c,old);}
function edit(c,p){const before=structuredClone(c),review=previewCustomClassChange(c,p.definition.id,p);applyCustomClassChange(c,review);recompute(c,before);return review;}
function annotate(c){
 c.hp-=2;
 for(const p of c.casters){p.name='Personal '+p.name;p.notes='Keep spellbook notes';p.slots[1].used=2;p.spells=[{id:'known-'+p.id,spellId:'magic-missile',level:1,slotLevel:1,prepared:2,spent:1,formula:'',notes:'Prepared choice',custom:null}];}
 for(const p of c.psionics){p.name='Personal '+p.name;p.notes='Keep power notes';p.spent=4;p.focused=true;p.powers=[{id:'power-'+p.id,powerId:'vigor',name:'Vigor',level:1,cost:3,formula:'',notes:'Chosen power'}];}
}

test('explicit custom casting creates a vanilla character using base slots, ability bonuses and separate identity',()=>{
 const p=profile(),c=create([p]);
 assert.equal(c.advancementMode,'standard');assert.equal(c.automation.hpMethod,'rolled');assert.equal(c.maxHp,15);
 assert.equal(c.casters.length,1);assert.equal(c.casters[0].casting.classId,p.definition.id);assert.equal(c.casters[0].level,3);
 assert.deepEqual(c.casters[0].slots.map(s=>s.max),[4,3,2,0,0,0,0,0,0,0]);
 assert.equal(castingDefinition(c.casters[0],c).id,p.definition.id);assert.equal(findClass(p.definition.id),undefined);
 assert.deepEqual(characterSchema.parse(c),c);
});

test('custom spell and power traditions remain independent through paired creation, side changes and advancement',()=>{
 const spell=profile(),psi=profile('psion');
 const c=create([spell,psi],repeat(spell.definition.id,psi.definition.id));annotate(c);
 assert.equal(c.level,3);assert.equal(c.psionics[0].max,15);assert.equal(c.psionics[0].level,3);assert.equal(manifestDefinition(c.psionics[0],c).id,psi.definition.id);
 const before=structuredClone(c);c.experience=6000;
 apply(c,previewGestaltLevel(c,{left:psi.definition.id,right:spell.definition.id,hitDieRoll:3}));
 assert.equal(c.level,4);assert.equal(c.casters.length,1);assert.equal(c.psionics.length,1);
 assert.equal(c.casters[0].level,4);assert.deepEqual(c.casters[0].slots.map(s=>s.max),[4,4,3,0,0,0,0,0,0,0]);assert.equal(c.psionics[0].max,23);
 assert.equal(c.casters[0].id,before.casters[0].id);assert.deepEqual(c.casters[0].spells,before.casters[0].spells);assert.equal(c.casters[0].slots[1].used,2);
 assert.deepEqual(c.psionics[0].powers,before.psionics[0].powers);assert.equal(c.psionics[0].spent,4);assert.equal(c.maxHp-c.hp,2);
 c.experience=10000;apply(c,previewGestaltLevel(c,{left:'rogue',right:spell.definition.id,hitDieRoll:4}));
 assert.equal(c.level,5);assert.equal(c.casters[0].level,5);assert.equal(c.psionics[0].level,4);
 assert.match(manifestingProblem(c,c.psionics[0],{level:3,cost:5}),/cannot manifest that power level/);
});

test('standard custom advancement preserves identities, manual pools and resource expenditure',()=>{
 for(const automatic of [true,false]){
  const p=profile(),c=create([p]);annotate(c);c.casters[0].casting.automatic=automatic;
  if(!automatic){c.casters[0].level=7;c.casters[0].slots[1].max=13;}
  const before=structuredClone(c);c.experience=6000;gainLevel(c,p.definition.id,3);recompute(c,before);
  assert.equal(c.casters.length,1);assert.equal(c.casters[0].id,before.casters[0].id);assert.deepEqual(c.casters[0].spells,before.casters[0].spells);
  assert.equal(c.casters[0].slots[1].used,2);assert.equal(c.casters[0].level,automatic?4:7);assert.equal(c.casters[0].slots[1].max,automatic?4:13);
 }
});

test('custom typed traditions qualify for source prerequisites and prestige targets, capped to one advance per pair',()=>{
 const arcane=profile(),divine=profile('wizard','custom-divine');Object.assign(divine.definition.casting,{ability:'WIS',type:'divine',list:'Cleric'});
 const c=create([arcane,divine],repeat(arcane.definition.id,divine.definition.id));
 for(const name of ['Knowledge (arcana)','Knowledge (religion)']){const skill=c.skills.find(s=>s.name===name);c.automation.history.forEach((h,i)=>{h.skillRanks[skill.id]=i===0?4:1;});}
 recompute(c);const mt=findClass('mystic-theurge');assert.equal(prestigeEligibility(c,mt).eligible,true);
 assert.deepEqual(gestaltCastingChoices(c,[arcane.definition.id,mt.id]).map(x=>x.candidates.map(p=>p.id)),[[c.casters[0].id],[c.casters[1].id]]);
 c.experience=6000;apply(c,previewGestaltLevel(c,{left:arcane.definition.id,right:mt.id,hitDieRoll:3,approvals:[{classId:mt.id,gm:'Test GM',reason:'Synthetic fixture approval'}]}));
 assert.equal(c.level,4);assert.equal(casterProgression(c,c.casters[0]).progression,4);assert.equal(casterProgression(c,c.casters[1]).progression,4);
 assert.deepEqual(c.gestaltProgression.levels.at(-1).castingTargets.map(t=>t.traditionId),c.casters.map(p=>p.id));
});

test('custom manifesters join the shared reserve while keeping class-specific levels and powers',()=>{
 const a=profile('psion'),b=profile('psion','custom-second');b.definition.manifesting.ability='WIS';
 const c=create([a,b],repeat(a.definition.id,b.definition.id));
 assert.deepEqual(c.psionics.map(p=>p.max),[15,14]);assert.equal(powerReserve(c).max,29);
 c.psionics[0].spent=4;c.psionics[1].spent=3;assert.equal(powerReserve(c).remaining,22);
 assert.equal(psionicProgression(c,c.psionics[0]).progression,3);
});

test('delayed casting, zero base slots, split abilities and divine spell failure obey explicit source metadata',()=>{
 const paladin=profile('paladin'),c=create([paladin]);assert.equal(c.casters.length,0);
 c.experience=6000;const old=structuredClone(c);gainLevel(c,paladin.definition.id,5);recompute(c,old);
 assert.equal(c.casters[0].level,2);assert.equal(c.casters[0].slots[1].max,1);assert.equal(c.casters[0].slots[2].max,0);
 addEquipment(c,matchEquipment('Full plate'));assert.equal(specialSpellFailure(c,paladin.definition.id),0);
 const split=profile();Object.assign(split.definition.casting,{bonusAbility:'CHA',dcAbility:'WIS'});
 const s=create([split]);assert.deepEqual(s.casters[0].slots.map(v=>v.max).slice(0,4),[4,3,1,0]);assert.equal(spellDC(s,s.casters[0],{level:1}),13);
 s.scores.INT=11;recompute(s);assert.equal(s.casters[0].slots[2].max,0);
});

test('explicit known-spell tables expose limits without deleting spells or inferring another class by name',()=>{
 const p=profile();p.definition.casting.mode='spontaneous';p.definition.levels.forEach(r=>{r.spellsKnown=[4,1,0,0,0,0,0,0,0,0]});
 const c=create([p]);annotate(c);c.casters[0].spells.push({...c.casters[0].spells[0],id:'additional'});
 assert.deepEqual(castingNumbers(c,c.casters[0]).known,[4,1,0,0,0,0,0,0,0,0]);assert.match(calculationWarnings(c).join('\n'),/more level 1 spells/);
 recompute(c);assert.equal(c.casters[0].spells.length,2);
});

test('reviewed resource-table edits preserve all preparations, expenditure and manual overrides, including removal',()=>{
 const spell=profile(),psi=profile('psion'),c=create([spell,psi],repeat(spell.definition.id,psi.definition.id));annotate(c);
 const before=structuredClone(c),changed=structuredClone(spell);changed.definition.levels[2].slots[1]=0;
 const preview=previewCustomClassChange(c,changed.definition.id,changed);assert.deepEqual(c,before);assert.equal(preview.summary.resources.length,1);
 edit(c,changed);assert.equal(c.casters[0].slots[1].max,1);assert.equal(c.casters[0].slots[1].used,2);assert.deepEqual(c.casters[0].spells,before.casters[0].spells);assert.deepEqual(c.automation.history,before.automation.history);
 const noPsi=structuredClone(psi);delete noPsi.definition.manifesting;noPsi.definition.levels.forEach(r=>{delete r.powerPoints;delete r.powersKnown;delete r.powerLevel});
 edit(c,noPsi);assert.deepEqual(c.psionics,before.psionics);assert.match(calculationWarnings(c).join('\n'),/no supported manifesting table/);
 const stale=previewCustomClassChange(c,changed.definition.id,changed);c.psionics[0].spent++;const current=structuredClone(c);assert.throws(()=>applyCustomClassChange(c,stale),/character changed/);assert.deepEqual(c,current);
});

test('adding source metadata to an earned class never adopts unrelated names or enables manual pools',()=>{
 for(const automatic of [true,false]){
  const full=profile(),basic=structuredClone(full);delete basic.definition.casting;basic.definition.levels.forEach(r=>{delete r.slots});
  const c=create([basic]);const pool=makeCaster(full.definition,3,16);pool.casting.automatic=automatic;pool.slots[1]={max:12,used:4};pool.notes='Unchanged';c.casters.push(pool);
  const unrelated=makeCaster(findClass('wizard'),3,16);unrelated.casting.classId='custom-unknown';c.casters.push(unrelated);const old=structuredClone(c);
  edit(c,full);assert.equal(c.casters.length,2);assert.deepEqual(c.casters[1],old.casters[1]);assert.equal(c.casters[0].slots[1].used,4);assert.equal(c.casters[0].slots[1].max,automatic?3:12);assert.equal(c.casters[0].casting.automatic,automatic);
 }
});

test('new custom traditions preserve previously automatic prestige targets in standard and gestalt histories',()=>{
 for(const paired of [false,true]){
  const full=profile(),basic=structuredClone(full);delete basic.definition.casting;basic.definition.levels.forEach(r=>{delete r.slots});
  const c=paired?create([basic],repeat('wizard',basic.definition.id)):createPlayerCharacter({...options,kind:'Wizard',customClasses:[basic]});
  c.automation.hpMethod='average';
  if(!paired)c.classLevels.push({id:'custom-entry',classId:basic.definition.id,name:basic.definition.name,level:1,notes:''});
  c.classLevels.push({id:'lore-entry',classId:'loremaster',name:'Loremaster',level:1,notes:''});
  if(paired){c.classLevels.push({id:'fighter-entry',classId:'fighter',name:'Fighter',level:1,notes:''});c.gestaltProgression.levels.push({id:'prestige-pair',left:'fighter-entry',right:'lore-entry',approvals:[]});}
  recompute(c);const wizard=c.casters[0];assert.equal(wizard.level,4);annotate(c);
  const before=structuredClone(c);edit(c,full);
  assert.equal(c.casters.length,2);assert.equal(c.casters.find(p=>p.id===wizard.id).level,4);assert.deepEqual(c.casters.find(p=>p.id===wizard.id).spells,before.casters[0].spells);
  if(paired)assert.equal(c.gestaltProgression.levels.at(-1).castingTargets[0].traditionId,wizard.id);
  else assert.equal(c.classLevels.find(e=>e.id==='lore-entry').castingTarget,wizard.id);
 }
 const full=profile(),c=createPlayerCharacter({...options,kind:'Wizard',customClasses:[full]});c.automation.hpMethod='average';
 c.classLevels.push({id:'lore',classId:'loremaster',name:'Loremaster',level:1,notes:''});recompute(c);c.experience=10000;
 const old=structuredClone(c);gainLevel(c,full.definition.id);recompute(c,old);
 assert.equal(c.casters.length,2);assert.equal(c.casters[0].level,4);assert.equal(c.classLevels.find(e=>e.id==='lore').castingTarget,c.casters[0].id);
});

test('custom links match exact saved IDs; display labels cannot adopt unlinked spell or power pools',()=>{
 const spell=profile(),psi=profile('psion');spell.definition.name='Unknown spell source';psi.definition.name='Unknown power source';
 const c=create([spell,psi],repeat(spell.definition.id,psi.definition.id));
 const p=makeCaster(findClass('wizard'),3,16),q=makePsionic(findClass('psion'),3,16);
 p.casting.classId=spell.definition.name;q.manifesting.classId=psi.definition.name;
 c.casters.push(p);c.psionics.push(q);const before=structuredClone({p,q});recompute(c);
 assert.equal(castingDefinition(p,c),undefined);assert.equal(manifestDefinition(q,c),undefined);assert.deepEqual({p,q},before);
});

test('delayed manifesting and fixed points begin at the declared class level, including progression overrides',()=>{
 const p=profile('psion');p.definition.manifesting={ability:'INT',startLevel:4,levelOffset:-3,bonusPoints:2};
 p.definition.levels.slice(0,3).forEach(r=>{r.powerPoints=0;r.powersKnown=0;r.powerLevel=0});
 const c=create([p]);assert.equal(c.psionics.length,0);c.experience=6000;const before=structuredClone(c);gainLevel(c,p.definition.id,3);recompute(c,before);
 assert.equal(c.psionics[0].level,1);assert.equal(c.psionics[0].max,20);c.psionics[0].spent=3;
 c.psionics[0].manifesting.progression=3;recompute(c);assert.equal(c.psionics[0].level,0);assert.equal(c.psionics[0].max,0);assert.equal(c.psionics[0].spent,3);
});

test('resource tables validate completely and regenerate without erasing source rows',()=>{
 const p=profile(),psi=profile('psion');
 for(const change of [d=>d.definition.levels[0].slots.pop(),d=>d.definition.levels[0].slots[0]=-1,d=>delete d.definition.casting,d=>d.definition.casting.unknown=true,d=>d.definition.casting.startLevel=4,d=>d.definition.levels[0].spellsKnown=Array(10).fill(0)]){
  const bad=structuredClone(p);change(bad);assert.equal(customClassSchema.safeParse(bad).success,false);
 }
 const bad=structuredClone(psi);delete bad.definition.levels[1].powerLevel;assert.equal(customClassSchema.safeParse(bad).success,false);
 const excessive=structuredClone(psi);excessive.definition.manifesting.levelOffset=100;assert.equal(customClassSchema.safeParse(excessive).success,false);
 const grown=customClassTable(p,21);assert.deepEqual(grown.definition.levels.slice(0,20),p.definition.levels);assert.deepEqual(grown.definition.levels[20].slots,Array(10).fill(null));
 assert.throws(()=>customClassTable(p,19),/remove recorded/);
 const prestige=profile();prestige.definition.kind='Prestige';prestige.definition.levels[0].extra=['+1 level of existing arcane spellcasting class'];
 const c=create([p]);c.customClasses.push({...prestige,definition:{...prestige.definition,id:'custom-prestige'}});
 assert.equal(advanceTargets(c,{classId:'custom-prestige',level:1}).spell,false);
});

test('unsupported custom progression retains recorded capacities and blocks new advancement without clamping',()=>{
 const p=profile();p.definition.levels=p.definition.levels.slice(0,3);const c=create([p]);annotate(c);
 c.casters[0].casting.progression=4;const before=structuredClone(c.casters);recompute(c);assert.deepEqual(c.casters,before);assert.equal(castingNumbers(c,c.casters[0]).tableAvailable,false);
 assert.match(customResourceProblems(c).join('\n'),/progression level 4/);assert.match(castingProblem(c.casters[0],c.casters[0].spells[0],c),/Supply this progression level/);
 const psi=profile('psion');psi.definition.levels=psi.definition.levels.slice(0,3);const ps=create([psi]);annotate(ps);ps.psionics[0].manifesting.progression=4;const oldPower=structuredClone(ps.psionics);recompute(ps);assert.deepEqual(ps.psionics,oldPower);assert.match(manifestingProblem(ps,ps.psionics[0],ps.psionics[0].powers[0]),/Supply this progression level/);
 c.experience=6000;const current=structuredClone(c);assert.throws(()=>gainLevel(c,'fighter',4),/supply the source table/);assert.deepEqual(c,current);
});

test('native export, preparation and fresh storage clients preserve custom tables and both resource traditions',async()=>{
 const a=profile(),b=profile('psion'),c=create([a,b],repeat(a.definition.id,b.definition.id));annotate(c);
 const imported=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(imported,c);
 const values=new Map();let sequence=0;
 const store={scope:'/custom-resources/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:(_name,fn)=>fn(),id:()=>String(++sequence),now:()=> '2026-11-02T00:00:00.000Z'};
 const api=createBrowserCharacterApi(store),saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const fresh=createBrowserCharacterApi(store);assert.deepEqual((await fresh('/api/characters/'+saved.id)).data,c);
});
