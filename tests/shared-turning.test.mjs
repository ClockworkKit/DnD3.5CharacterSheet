import {optionalRuleSettings} from '../lib/character-rules.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {recompute,resourceNumbers} from '../lib/automation.ts';
import {sharedTurningPools,featureUseNumbers,spendTrackedFeature,sharedTurningWarnings,sharedTurningBaseLevel,coreTurningId,turningResourceKind} from '../lib/shared-turning.ts';
import {attemptTurning,attemptSharedTurning} from '../lib/turn-undead.ts';
import {configureAlternateFeature,selectAlternateFeature} from '../lib/alternate-features.ts';
import {resetDaily} from '../lib/rules.ts';
import {canUseSpellLike,spendSpellLike} from '../lib/magic.ts';
import {setSigils,activateIllumianWord} from '../lib/racial-abilities.ts';
import {previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';

const dn='supp:dread-necromancer:Rebuke undead',dm='supp:death-master:Rebuke undead',bg='daily:Command undead';
const repeat=(a,b,n)=>Array.from({length:n},()=>[a,b]);
function make(rows=repeat('dread-necromancer','death-master',3),raceId='human'){
 // Blackguard rows are calculation fixtures, not claims that entry prerequisites were met.
 const c=createPlayerCharacter({name:'Shared turning QA',kind:'Wizard',level:rows.length,raceId,method:'manual',hpMethod:'average',scores:{STR:14,DEX:12,CON:14,INT:16,WIS:16,CHA:14},advancementMode:'gestalt',gestaltPairs:rows.map(([left,right])=>({left:left==='blackguard'?'fighter':left,right:right==='blackguard'?'fighter':right}))});
 if(rows.some(r=>r.includes('blackguard'))){const e=c.classLevels.find(e=>e.classId==='fighter');e.classId='blackguard';e.name='Blackguard';}
 c.alignment='NE';c.clericChannel='inflict';c.experience=100000;recompute(c);c.hp=c.maxHp;return c;
}
const card=(c,id)=>c.features.find(f=>f.ruleId===id);
const pool=c=>sharedTurningPools(c)[0];
const feat=(c,name)=>c.features.push({id:crypto.randomUUID(),name,kind:'Feat',description:'',source:'',max:0,used:0});

test('parallel rebuking grants share one daily limit and retain all spent source records',async()=>{
 const c=make(),a=card(c,dn),b=card(c,dm);a.used=2;b.used=1;a.name='My personal rebuking';a.description='Player tactics';a.source='My book';const before=structuredClone(c);
 assert.equal(pool(c).max,5);assert.equal(pool(c).used,3);assert.equal(pool(c).remaining,2);assert.equal(pool(c).baseLevel,3);
 assert.equal(attemptSharedTurning(c,'rebuke',()=>false),false);assert.deepEqual(c,before);assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify(c))),before);
 spendTrackedFeature(c,a.id);spendTrackedFeature(c,b.id);
 assert.equal(a.used,3);assert.equal(b.used,2);
 assert.equal(featureUseNumbers(c,a).remaining,0);assert.equal(featureUseNumbers(c,b).remaining,0);
 const exhausted=structuredClone(c);assert.throws(()=>spendTrackedFeature(c,a.id),/Not enough/);assert.deepEqual(c,exhausted);
 assert.equal(a.name,'My personal rebuking');assert.equal(a.description,'Player tactics');
});

test('nonoverlapping grants accrue once per actual level, independent of side placement',()=>{
 const rows=[...repeat('dread-necromancer','wizard',2),['death-master','dread-necromancer'],['wizard','death-master']];
 for(const r of [rows,rows.map(([a,b])=>[b,a])]){
  const c=make(r);assert.equal(pool(c).baseLevel,4);
  assert.match(card(c,dn).generatedSummary.description,/turning level 4/);assert.match(card(c,dm).generatedSummary.description,/turning level 4/);
  feat(c,'Extra Turning');feat(c,'Improved Turning');recompute(c);
  assert.equal(pool(c).max,9);let roll;assert.equal(attemptSharedTurning(c,'rebuke',r=>{roll=r;return true}),true);
  assert.equal(Object.fromEntries(roll.fields)['Effective turning level'],'5');
  assert.equal(roll.rolls[1].formula,'2d6+7');
 }
});

test('blackguard contributes only after its delayed entry and simultaneous rebuking counts once',()=>{
 const early=make(repeat('dread-necromancer','blackguard',2));assert.equal(card(early,bg),undefined);assert.equal(sharedTurningPools(early).length,0);
 const c=make([...repeat('dread-necromancer','blackguard',3),['wizard','blackguard']]);
 assert.equal(pool(c).baseLevel,4);assert.equal(sharedTurningBaseLevel(c,bg,2),4);assert.match(card(c,bg).generatedSummary.description,/turning level 4/);
});

test('core cleric rebuking joins matching sources; failed handoff never spends attempts',()=>{
 const c=make(repeat('cleric','dread-necromancer',3)),a=card(c,coreTurningId),b=card(c,dn);a.used=2;b.used=2;
 const before=structuredClone(c);assert.equal(attemptTurning(c,()=>false),false);assert.deepEqual(c,before);
 assert.equal(attemptTurning(c,()=>true),true);assert.equal(pool(c).remaining,0);
 const exhausted=structuredClone(c);assert.equal(attemptTurning(c,()=>true),false);assert.equal(attemptSharedTurning(c,'rebuke',()=>true),false);assert.deepEqual(c,exhausted);
 assert.equal(resourceNumbers(c).turnLevel,3);
});

test('replacing and restoring one source never refunds shared expenditure, and rest clears it explicitly',()=>{
 const c=make(repeat('cleric','dread-necromancer',3));const a=card(c,coreTurningId);a.used=2;card(c,dn).used=1;
 c.skills.find(s=>s.name==='Knowledge (arcana)').ranks=1;
 configureAlternateFeature(c,'cleric-divine-counterspell',{reviewed:true});selectAlternateFeature(c,'cleric-divine-counterspell',true);recompute(c);
 assert.equal(card(c,coreTurningId),undefined);assert.equal(pool(c).remaining,2);assert.equal(pool(c).baseLevel,3);
 spendTrackedFeature(c,card(c,dn).id);assert.equal(pool(c).remaining,1);
 selectAlternateFeature(c,'cleric-divine-counterspell',false);recompute(c);
 assert.equal(card(c,coreTurningId).id,a.id);assert.equal(card(c,coreTurningId).used,2);assert.equal(pool(c).remaining,1);
 const rested=resetDaily(c);assert.equal(pool(rested).remaining,5);assert.equal(pool(c).remaining,1);
});

test('opposite energy and unresolved core channels are never silently merged',()=>{
 const c=make(repeat('cleric','dread-necromancer',3));c.alignment='LG';recompute(c);
 assert.equal(sharedTurningPools(c).length,0);assert.equal(sharedTurningWarnings(c).length,0);
 c.alignment='Neutral';delete c.clericChannel;recompute(c);
 assert.equal(sharedTurningPools(c).length,0);assert.match(sharedTurningWarnings(c)[0],/record the Cleric channel/);
 c.deity='Patron';c.deityAlignment={deity:'Patron',alignment:'NE'};recompute(c);assert.equal(pool(c).kind,'rebuke');
 c.deity='Changed';recompute(c);assert.equal(sharedTurningPools(c).length,0);
});

test('standard characters, explicit independent-pool house rules and manual limits are preserved',async()=>{
 const c=make();card(c,dn).used=4;card(c,dm).used=2;c.gestaltTurningPools='independent';recompute(c);
 assert.equal(sharedTurningPools(c).length,0);assert.equal(featureUseNumbers(c,card(c,dm)).remaining,3);assert.ok(optionalRuleSettings(c).includes('Independent class turning / rebuking pools (house rule)'));
 assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify(c))),c);
 delete c.gestaltTurningPools;c.automation.enabled=false;card(c,dn).max=42;const before=structuredClone(c);
 recompute(c);assert.deepEqual(c,before);assert.equal(sharedTurningPools(c).length,0);
 c.advancementMode='standard';delete c.gestaltProgression;assert.equal(sharedTurningPools(c).length,0);
});

test('spell-like and Illumian spending use shared limits and retained rule identities',()=>{
 const c=make(undefined,'illumian'),a=card(c,dn),b=card(c,dm);a.used=3;b.used=1;b.magic=true;b.name='Renamed rebuke';setSigils(c,['hoon','krau']);
 assert.equal(turningResourceKind(c,b),'rebuke');
 const before=structuredClone(c);assert.throws(()=>activateIllumianWord(c,{turnId:b.id,mode:'turn'}),/rebuking pool/);assert.deepEqual(c,before);
 activateIllumianWord(c,{turnId:b.id,mode:'rebuke'});
 assert.equal(pool(c).remaining,0);assert.equal(canUseSpellLike(card(c,dm),c),false);
 const exhausted=structuredClone(c);assert.throws(()=>spendSpellLike(c,b.id),/No uses/);assert.throws(()=>activateIllumianWord(c,{turnId:b.id,mode:'rebuke'}),/Not enough/);assert.deepEqual(c,exhausted);
});

test('lower limits keep overspent records and explicit source formulas use the best limit once',()=>{
 const c=make();card(c,dn).used=4;card(c,dm).used=3;c.scores.CHA=8;recompute(c);
 assert.equal(pool(c).max,2);assert.equal(pool(c).used,7);assert.equal(pool(c).remaining,0);
 card(c,dn).formula='12';recompute(c);assert.equal(pool(c).max,12);assert.equal(pool(c).remaining,5);
});

test('advancement and fresh storage retain both sources, injuries, spell expenditure and historical choices',async()=>{
 const c=make();card(c,dn).used=2;card(c,dm).used=1;c.hp-=3;c.casters[0].slots[1].used=1;c.advancementChoices['personal-choice']='keep';const before=structuredClone(c);
 applyGestaltLevel(c,previewGestaltLevel(c,{left:'dread-necromancer',right:'death-master'}));recompute(c,before);
 assert.equal(c.level,4);assert.equal(pool(c).baseLevel,4);assert.equal(pool(c).used,3);assert.equal(c.maxHp-c.hp,3);assert.equal(c.casters[0].slots[1].used,1);
 assert.deepEqual(c.automation.history.slice(0,3),before.automation.history);assert.deepEqual(c.advancementChoices,before.advancementChoices);
 const values=new Map(),options={scope:'shared-turning',storage:()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock:async(_,fn)=>fn()};
 const stored=await createBrowserCharacterApi(options)('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await prepareCharacter(parseCharacterFile(JSON.stringify((await createBrowserCharacterApi(options)('/api/characters/'+stored.id)).data)));
 assert.deepEqual(loaded,c);assert.equal(pool(loaded).used,3);
});
