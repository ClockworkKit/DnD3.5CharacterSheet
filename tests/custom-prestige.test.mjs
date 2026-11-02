import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {customClassDraft,customClassTable,previewCustomClassChange,applyCustomClassChange} from '../lib/custom-class-editor.ts';
import {customClassSchema} from '../lib/custom-class-schema.ts';
import {characterSchema} from '../lib/model.ts';
import {findClass,makeCaster} from '../lib/classes.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {gestaltCastingChoices,standardCastingChoices} from '../lib/gestalt-casting.ts';
import {customPrestigeChoices} from '../lib/custom-prestige.ts';
import {advancementNumbers,advanceTargets,casterProgression,psionicProgression} from '../lib/advancement.ts';
import {recompute,calculationWarnings} from '../lib/automation.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const options={name:'Custom prestige QA',kind:'Wizard',level:3,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:18,WIS:16,CHA:16},method:'manual',hpMethod:'average'};
const grants=(spell=false,divine=false,psi=false)=>({spell,divine,psi});
function profile(config={spell:'any',divine:false,psi:false},rows=[grants(true),grants(),grants(true)]){
 const p=customClassDraft(createPlayerCharacter(options));
 Object.assign(p.definition,{id:'custom-scholar',name:'Synthetic prestige scholar',kind:'Prestige',source:'Synthetic configuration of SRD existing-class advancement; not a published class',requirements:'Review the complete synthetic source before entry.',advances:config});
 p.policy.family=p.definition.id;p.policy.combinationPrestige=Number(config.spell!=='none')+Number(config.divine)+Number(config.psi)>1;
 p.definition.levels=[];const table=customClassTable(p,rows.length);table.definition.levels.forEach((r,i)=>{r.advances=rows[i]});return customClassSchema.parse(table);
}
function base(p,other='cleric',paired=true){
 const c=createPlayerCharacter({...options,customClasses:[p],...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:3},()=>({left:'wizard',right:other}))}:{})});
 c.experience=1000000;
 if(!paired&&other)for(let i=0;i<3;i++){const before=structuredClone(c);gainLevel(c,other);recompute(c,before);}
 return c;
}
function qualify(c,p){for(const r of prestigeEligibility(c,p.definition).requirements)c.prerequisiteConfirmations[r.key]=true;}
function standard(c,p,kind,traditionId){const old=structuredClone(c);gainLevel(c,p.definition.id,undefined,kind?[{classId:p.definition.id,kind,traditionId}]:[]);recompute(c,old);}
function paired(c,p,left='fighter',targets){const old=structuredClone(c);const selection={left,right:p.definition.id,approvals:p.policy.combinationPrestige?[{classId:p.definition.id,gm:'Fixture GM',reason:'Explicit combination approval for this level'}]:[],...(targets?{castingTargets:targets.map(([kind,traditionId])=>({classId:p.definition.id,kind,traditionId}))}:{})};const review=previewGestaltLevel(c,selection);applyGestaltLevel(c,review);recompute(c,old);return review;}
function note(c){c.hp-=3;for(const p of c.casters){p.slots[1].used=2;p.notes='Preserved note';p.spells=[{id:'known-'+p.id,spellId:'bless',level:1,slotLevel:1,prepared:2,spent:1,notes:'Preserved preparation',formula:'',custom:null}];}for(const p of c.psionics){p.spent=4;p.focused=true;p.notes='Preserved powers';}}

test('explicit prestige metadata validates schedules, target separation, combination restrictions and regeneration',()=>{
 const p=profile();
 for(const mutate of [p=>p.definition.kind='Core',p=>delete p.definition.levels[0].advances,p=>p.definition.levels[0].advances.psi=true,p=>p.definition.advances.casterOnly=true,p=>p.definition.advances.divine=true,p=>{p.definition.advances.spell='arcane';p.definition.advances.psi=true;}]){
  const bad=structuredClone(p);mutate(bad);assert.equal(customClassSchema.safeParse(bad).success,false);
 }
 const grown=customClassTable(p,4);assert.deepEqual(grown.definition.levels.slice(0,3),p.definition.levels);assert.deepEqual(grown.definition.levels[3].advances,grants());assert.throws(()=>customClassTable(p,2),/remove recorded/);
 const dual=profile({spell:'arcane',divine:true,psi:false},[grants(true),grants(false,true)]);assert.equal(dual.policy.combinationPrestige,true);
 const c=base(dual);assert.deepEqual(advanceTargets(c,{classId:dual.definition.id,level:1}).divineLevels,0);assert.equal(advanceTargets(c,{classId:dual.definition.id,level:2}).divineLevels,1);
});

test('standard prestige choices are scoped to each earned level and dead levels grant nothing',()=>{
 const p=profile(),c=base(p,'sorcerer',false);qualify(c,p);note(c);
 const wizard=c.casters.find(p=>p.casting.classId==='wizard').id,sorcerer=c.casters.find(p=>p.casting.classId==='sorcerer').id;
 const before=structuredClone(c);assert.throws(()=>gainLevel(c,p.definition.id),/Choose/);assert.deepEqual(c,before);
 standard(c,p,'spell',wizard);assert.deepEqual(c.casters.map(p=>p.level),[4,3]);
 assert.equal(standardCastingChoices(c,p.definition.id).length,0);standard(c,p);assert.deepEqual(c.casters.map(p=>p.level),[4,3]);
 const inactive=structuredClone(c);inactive.gestaltProgression={version:1,bonusMethod:'printed-table-v1',levels:[{id:'inactive',left:c.classLevels.at(-1).id,right:c.classLevels[0].id,approvals:[]}]};
 assert.deepEqual(standardCastingChoices(inactive,p.definition.id),standardCastingChoices(c,p.definition.id));
 standard(c,p,'spell',sorcerer);assert.deepEqual(c.casters.map(p=>p.level),[4,4]);assert.equal(c.level,9);
 const entry=c.classLevels.find(e=>e.classId===p.definition.id);assert.deepEqual(entry.castingAdvances,[{level:1,kind:'spell',traditionId:wizard},{level:3,kind:'spell',traditionId:sorcerer}]);
 entry.castingTarget=sorcerer;recompute(c);assert.deepEqual(c.casters.map(p=>p.level),[4,4]);assert.equal(c.maxHp-c.hp,3);
 assert.deepEqual(c.casters.map(p=>p.spells),before.casters.map(p=>p.spells));assert.ok(c.casters.every(p=>p.slots[1].used===2));
 assert.equal(c.classLevels.find(e=>e.classId==='wizard').level,3);assert.equal(advancementNumbers(c).wizardFeats,0);
 assert.ok(!calculationWarnings(c).some(w=>w.includes(p.definition.name)));
});

test('gestalt arcane and divine schedules remain independent, with source prerequisites and scoped GM approvals',()=>{
 const p=profile({spell:'arcane',divine:true,psi:false},[grants(true),grants(false,true),grants(true,true)]),c=base(p);note(c);
 const initial=structuredClone(c),selection={left:'fighter',right:p.definition.id,approvals:[{classId:p.definition.id,gm:'Fixture GM',reason:'Explicit approval'}]};
 assert.throws(()=>previewGestaltLevel(c,selection),/prerequisites/);assert.deepEqual(c,initial);qualify(c,p);
 assert.throws(()=>previewGestaltLevel(c,{...selection,approvals:[]}),/approval/);
 const first=paired(c,p);assert.deepEqual(c.casters.map(p=>p.level),[4,3]);assert.deepEqual(first.summary.castingTargets.map(t=>t.kind),['spell']);
 assert.deepEqual(gestaltCastingChoices(c,['fighter',p.definition.id]).map(q=>q.kind),['divine']);
 paired(c,p);assert.deepEqual(c.casters.map(p=>p.level),[4,4]);
 paired(c,p);assert.deepEqual(c.casters.map(p=>p.level),[5,5]);assert.equal(c.level,6);assert.equal(advancementNumbers(c).feats,4);
 assert.deepEqual(c.gestaltProgression.levels.slice(-3).map(r=>r.castingTargets.map(t=>t.kind)),[['spell'],['divine'],['spell','divine']]);
 assert.deepEqual(c.casters.map(p=>p.spells),initial.casters.map(p=>p.spells));assert.equal(c.maxHp-c.hp,3);
});

test('simultaneous base and custom prestige grants advance one tradition only once per pair',()=>{
 for(const swap of [false,true]){
  const p=profile({spell:'arcane',divine:false,psi:true},[grants(true,false,true)]),c=base(p,'psion');qualify(c,p);note(c);
  const selection={left:swap?p.definition.id:'wizard',right:swap?'wizard':p.definition.id,approvals:[{classId:p.definition.id,gm:'GM',reason:'Combination fixture'}]};
  const before=structuredClone(c);applyGestaltLevel(c,previewGestaltLevel(c,selection));recompute(c,before);
  assert.equal(c.level,4);assert.equal(casterProgression(c,c.casters[0]).progression,4);assert.equal(psionicProgression(c,c.psionics[0]).progression,4);assert.equal(c.psionics[0].max,25);assert.equal(c.psionics[0].spent,4);assert.ok(c.psionics[0].focused);
 }
});

test('divine-only custom progression follows the primary cleric and preserves restricted domain preparation',()=>{
 const p=profile({spell:'none',divine:true,psi:false},[grants(false,true)]),c=base(p);qualify(c,p);
 const domain=makeCaster(findClass('cleric'),3,16);domain.name='Domain';domain.casting.domain=true;c.casters.push(domain);recompute(c);note(c);
 const before=structuredClone(c);assert.deepEqual(gestaltCastingChoices(c,['cleric',p.definition.id])[0].candidates.map(q=>q.id),[c.casters[1].id]);
 paired(c,p,'cleric');assert.equal(c.casters[1].level,4);assert.equal(c.casters[2].level,4);assert.equal(c.casters[2].slots[2].max,1);assert.equal(c.casters[2].slots[3].max,0);
 assert.deepEqual(c.casters[2].spells,before.casters[2].spells);assert.equal(c.casters[2].slots[1].used,2);
});

test('custom targets require an eligible tradition held before entry, excluding same-level and later classes',()=>{
 const p=profile({spell:'any',divine:false,psi:false},[grants(true),grants(true)]),c=base(p,'fighter');qualify(c,p);
 const future=makeCaster(findClass('sorcerer'),1,16);c.casters.push(future);
 const before=structuredClone(c);assert.throws(()=>paired(c,p,'sorcerer',[['spell',future.id]]),/eligible existing tradition/);assert.deepEqual(c,before);
 paired(c,p,'sorcerer');assert.equal(c.casters[0].level,4);assert.equal(c.casters[1].level,1);
 const choices=gestaltCastingChoices(c,['fighter',p.definition.id]);assert.deepEqual(choices[0].candidates.map(p=>p.id),[c.casters[0].id]);
 assert.throws(()=>paired(c,p,'fighter',[['spell',future.id]]),/eligible existing tradition/);
});

test('standard history excludes traditions gained after prestige entry and does not reassign missing targets',()=>{
 const p=profile({spell:'any',divine:false,psi:false},[grants(true),grants(true)]),c=base(p,'',false);qualify(c,p);standard(c,p,'spell',c.casters[0].id);
 const old=structuredClone(c);gainLevel(c,'sorcerer');recompute(c,old);
 assert.deepEqual(standardCastingChoices(c,p.definition.id)[0].candidates.map(p=>p.id),[c.casters[0].id]);
 const removed=c.casters.shift();recompute(c);assert.equal(c.casters[0].level,1);assert.equal(c.classLevels.find(e=>e.classId===p.definition.id).castingAdvances[0].traditionId,removed.id);
 assert.match(calculationWarnings(c).join('\n'),/review the saved prestige target/);
 const before=structuredClone(c);assert.throws(()=>standard(c,p,'spell',c.casters[0].id),/eligible/);assert.deepEqual(c,before);
 standard(c,p,'spell','none');assert.equal(c.casters[0].level,1);
});

test('earned custom grants require a reviewed target for every applicable level and preserve player state',()=>{
 for(const isPaired of [false,true]){
  const full=profile({spell:'any',divine:false,psi:false},[grants(true),grants(true)]),legacy=structuredClone(full);delete legacy.definition.advances;legacy.definition.levels.forEach(r=>{delete r.advances});
  const c=base(legacy,'cleric',isPaired);qualify(c,legacy);
  for(let n=0;n<2;n++)isPaired?paired(c,legacy):standard(c,legacy);
  note(c);const before=structuredClone(c);assert.equal(customPrestigeChoices(c,full).length,2);
  assert.throws(()=>previewCustomClassChange(c,full.definition.id,full),/Choose/);assert.deepEqual(c,before);
  const targets=c.casters.map((p,i)=>({level:i+1,kind:'spell',traditionId:p.id}));
  const review=previewCustomClassChange(c,full.definition.id,full,targets);assert.deepEqual(c,before);assert.deepEqual(review.character.casters.map(p=>p.level),[4,4]);
  review.character.casters[0].slots[1].used=0;applyCustomClassChange(c,review);recompute(c,before);
  assert.deepEqual(c.automation.history,before.automation.history);assert.deepEqual(c.casters.map(p=>p.spells),before.casters.map(p=>p.spells));assert.ok(c.casters.every(p=>p.slots[1].used===2));assert.equal(c.maxHp-c.hp,3);
  if(isPaired)assert.deepEqual(c.gestaltProgression.levels.slice(-2).map(r=>r.castingTargets[0].traditionId),c.casters.map(p=>p.id));
  else assert.deepEqual(c.classLevels.find(e=>e.classId===full.definition.id).castingAdvances,targets);
  const stale=previewCustomClassChange(c,full.definition.id,full,targets);c.casters[0].slots[1].used++;assert.throws(()=>applyCustomClassChange(c,stale),/character changed/);
  const changed=previewCustomClassChange(c,full.definition.id,full,targets);changed.castingTargets[0].traditionId='none';const current=structuredClone(c);assert.throws(()=>applyCustomClassChange(c,changed),/targets changed/);assert.deepEqual(c,current);
 }
});

test('removing configured grants retains chosen targets and expenditure without inventing source progression',()=>{
 const p=profile({spell:'arcane',divine:false,psi:false},[grants(true)]),c=base(p,'',false);qualify(c,p);standard(c,p);note(c);
 const before=structuredClone(c),removed=structuredClone(p);delete removed.definition.advances;removed.definition.levels.forEach(r=>{delete r.advances});
 const preview=previewCustomClassChange(c,p.definition.id,removed);assert.equal(preview.character.casters[0].level,3);applyCustomClassChange(c,preview);recompute(c,before);
 assert.deepEqual(c.classLevels.find(e=>e.classId===p.definition.id).castingAdvances,before.classLevels.find(e=>e.classId===p.definition.id).castingAdvances);assert.equal(c.casters[0].slots[1].used,2);assert.deepEqual(c.casters[0].spells,before.casters[0].spells);
 const invalid=structuredClone(c);invalid.classLevels.at(-1).castingAdvances.push({...invalid.classLevels.at(-1).castingAdvances[0]});assert.equal(characterSchema.safeParse(invalid).success,false);
});

test('standard and gestalt prestige targets, profiles and expenditure survive native and fresh browser storage',async()=>{
 const values=new Map();let id=0;const storage={scope:'/custom-prestige/',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:(_n,fn)=>fn(),id:()=>String(++id),now:()=> '2026-11-02T00:00:00.000Z'};
 for(const isPaired of [false,true]){
  const p=profile({spell:'arcane',divine:false,psi:false},[grants(true)]),c=base(p,'cleric',isPaired);qualify(c,p);isPaired?paired(c,p):standard(c,p);note(c);
  const imported=await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c})));assert.deepEqual(imported,c);
  const saved=await createBrowserCharacterApi(storage)('/api/characters',{method:'POST',body:JSON.stringify({data:imported})});
  assert.deepEqual((await createBrowserCharacterApi(storage)('/api/characters/'+saved.id)).data,c);
 }
});
