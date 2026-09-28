import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,newWeapon,characterSchema} from '../lib/model.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {configureAlternateFeature,selectAlternateFeature,alternateSettings,alternateResources,hasTurningAbility} from '../lib/alternate-features.ts';
import {alternateFeatureCatalog} from '../lib/alternate-feature-schema.ts';
import {alternateActions,alternateActionProblem,useAlternateAction,alternateActionRemaining} from '../lib/alternate-actions.ts';
import {selectAlternateBonusFeat,alternateFeatSelectionProblem} from '../lib/alternate-grants.ts';
import {hasFeat,advanceEffects,effectBonus} from '../lib/effects.ts';
import {sheetTotals,weaponAttack,weaponDamage,attackRoutine,resetDaily,skillBonus} from '../lib/rules.ts';
import {activeDamageReductions} from '../lib/damage-reduction.ts';
import {castingNumbers} from '../lib/advancement.ts';
import {equipmentCatalog} from '../lib/equipment.ts';
const make=(name,level=12)=>activateAutomation(newCharacter(name,level),false);
const choose=(c,id,choice='')=>{configureAlternateFeature(c,id,{choice,reviewed:true});selectAlternateFeature(c,id,true);recompute(c);};
const action=(c,id)=>alternateActions(c).find(a=>a.id===id);
const weapon=(name='Unarmed strike')=>({...newWeapon(),name,catalogId:equipmentCatalog.find(e=>e.name===name)?.id,damage:'1d6',damageAbility:'STR'});

test('monk style grants follow milestones, preserve personal feats and remove cleanly',()=>{
 const c=make('Monk',6);choose(c,'monk-fighting-styles','Cobra Strike');
 for(const feat of ['Dodge','Mobility','Spring Attack'])assert.ok(hasFeat(c,feat));
 const before=JSON.stringify(c);recompute(c);assert.equal(JSON.stringify(c),before);
 c.features.push({id:'personal',name:'Dodge',kind:'Feat',description:'mine',source:'',max:0,used:0});recompute(c);
 selectAlternateFeature(c,'monk-fighting-styles',false);recompute(c);assert.ok(hasFeat(c,'Dodge'));assert.equal(hasFeat(c,'Mobility'),false);assert.equal(c.features.find(f=>f.id==='personal').description,'mine');
});
test('style skill benefit applies immediately, sixth-level bonus requires historical qualification',()=>{
 const c=make('Monk',6);c.automation.context.dodgeTarget=true;choose(c,'monk-fighting-styles','Cobra Strike');
 assert.equal(effectBonus(c,'skill.Escape Artist'),2);const before=sheetTotals(c).ac;
 configureAlternateFeature(c,'monk-fighting-styles',{styleQualifiedAtSix:true});assert.equal(sheetTotals(c).ac,before+1);
 c.classLevels[0].level=5;recompute(c);assert.equal(effectBonus(c,'ac.dodge'),0);
});
test('ranger style feats cease functioning in medium armor and return without changing records',()=>{
 const c=make('Ranger',11);choose(c,'ranger-combat-styles','Strong-Arm');assert.ok(hasFeat(c,'Power Attack'));assert.ok(hasFeat(c,'Great Cleave'));
 c.gear.push({id:'armor',name:'Chainmail',catalogId:equipmentCatalog.find(e=>e.name==='Chainmail').id,qty:1,carried:true,equipped:true,weight:40,material:'normal'});
 assert.equal(hasFeat(c,'Power Attack'),false);c.gear[0].equipped=false;assert.ok(hasFeat(c,'Power Attack'));
});
test('Stalwart weapon choice grants two matching feats and updates without accumulating grants',()=>{
 const c=make('Sorcerer',4);c.skills.find(s=>s.name==='Knowledge (arcana)').ranks=1;choose(c,'sorcerer-stalwart-sorcerer');configureAlternateFeature(c,'sorcerer-stalwart-sorcerer',{rules:{weapon:'Longsword'}});recompute(c);
 assert.ok(hasFeat(c,'Weapon Focus','Longsword'));assert.ok(hasFeat(c,'Martial Weapon Proficiency','Longsword'));
 configureAlternateFeature(c,'sorcerer-stalwart-sorcerer',{rules:{weapon:'Battleaxe'}});recompute(c);assert.equal(hasFeat(c,'Weapon Focus','Longsword'),false);assert.ok(hasFeat(c,'Weapon Focus','Battleaxe'));
});
test('bonus feat choices enforce level, list, prerequisites and restore selections',()=>{
 const c=make('Paladin',8);choose(c,'paladin-holy-warrior');c.scores.STR=10;
 assert.ok(alternateFeatSelectionProblem(c,'paladin-holy-warrior','feat-4','power-attack'));c.scores.STR=16;
 selectAlternateBonusFeat(c,'paladin-holy-warrior','feat-4','power-attack');assert.ok(hasFeat(c,'Power Attack'));
 assert.throws(()=>selectAlternateBonusFeat(c,'paladin-holy-warrior','feat-11','cleave'),/level/);
 selectAlternateBonusFeat(c,'paladin-holy-warrior','feat-8','cleave');assert.ok(hasFeat(c,'Cleave'));
 selectAlternateFeature(c,'paladin-holy-warrior',false);recompute(c);assert.equal(hasFeat(c,'Power Attack'),false);
 selectAlternateFeature(c,'paladin-holy-warrior',true);recompute(c);assert.ok(hasFeat(c,'Power Attack'));
});
test('Invisible Fist shares cooldown, persists timers, expires, and restores at rest',()=>{
 let c=make('Monk',9);choose(c,'monk-invisible-fist');c.automation.context.unseen=true;
 const attack=weaponAttack(c,weapon());useAlternateAction(c,'monk-invisible-fist','invisible');assert.equal(weaponAttack(c,weapon()),attack+2);
 assert.match(alternateActionProblem(c,'monk-invisible-fist','blink'),/recharging/);c=characterSchema.parse(JSON.parse(JSON.stringify(c)));
 advanceEffects(c);assert.equal(weaponAttack(c,weapon()),attack);assert.throws(()=>useAlternateAction(c,'monk-invisible-fist','blink'),/recharging/);
 advanceEffects(c);advanceEffects(c);useAlternateAction(c,'monk-invisible-fist','blink');assert.ok(alternateSettings(c,'monk-invisible-fist').actions.blink.rounds);
 c=resetDaily(c);assert.deepEqual(alternateSettings(c,'monk-invisible-fist').actions,{});
});
test('Resolute changes attacks, iteratives, grapple and Will without mutating base BAB',()=>{
 const c=make('Fighter',12);choose(c,'fighter-resolute');const w=weapon(),before=sheetTotals(c),attack=weaponAttack(c,w);
 useAlternateAction(c,'fighter-resolute','resolute');assert.equal(c.bab,12);assert.equal(weaponAttack(c,w),attack-6);assert.equal(sheetTotals(c).grapple,before.grapple-6);assert.equal(sheetTotals(c).saves.will,before.saves.will+6);assert.equal(attackRoutine(c,w).length,2);
 advanceEffects(c);assert.equal(weaponAttack(c,w),attack);
});
test('Armor of God swaps base Will, expires, and does not alter other saves',()=>{
 const c=make('Fighter',8);choose(c,'fighter-armor-of-god');const before=sheetTotals(c),base=c.saves.will.base;
 useAlternateAction(c,'fighter-armor-of-god','armor');assert.equal(sheetTotals(c).ac,before.ac+base);assert.equal(sheetTotals(c).saves.will,before.saves.will-base);assert.equal(sheetTotals(c).saves.fort,before.saves.fort);
 advanceEffects(c);assert.equal(sheetTotals(c).ac,before.ac);
});
test('Decisive Strike doubles eligible damage, combines critical multipliers and leaves extra dice alone',()=>{
 const c=make('Monk',11);c.scores.STR=14;choose(c,'monk-decisive-strike');const w={...weapon(),extraDamage:'1d6'};
 useAlternateAction(c,'monk-decisive-strike','decisive');assert.equal(weaponDamage(c,w),'2d10+4+1d6');assert.equal(weaponDamage(c,w,true),'3d10+6+1d6');assert.equal(attackRoutine(c,w).length,2);assert.match(attackRoutine(c,w)[1].label,/different target/);
 c.automation.context.ownTurn=false;assert.equal(attackRoutine(c,w).length,2);advanceEffects(c);assert.equal(weaponDamage(c,w),'1d10+2+1d6');
});
test('variable healing spends exact points, rejects overdraw atomically and survives removal',()=>{
 const c=make('Monk',8);choose(c,'monk-wholeness-of-others');useAlternateAction(c,'monk-wholeness-of-others','heal',10);assert.equal(alternateActionRemaining(c,action(c,'heal')),6);
 const before=JSON.stringify(c);assert.throws(()=>useAlternateAction(c,'monk-wholeness-of-others','heal',7),/No uses/);assert.equal(JSON.stringify(c),before);
 selectAlternateFeature(c,'monk-wholeness-of-others',false);recompute(c);selectAlternateFeature(c,'monk-wholeness-of-others',true);recompute(c);assert.equal(alternateActionRemaining(c,action(c,'heal')),6);
});
test('Destroy Undead retains spent uses and turning eligibility, scales damage/DC and resets',()=>{
 let c=make('Cleric',8);c.scores.CHA=16;c.skills.find(s=>s.name==='Knowledge (religion)').ranks=5;c.features.find(f=>f.ruleId==='daily:Turn or rebuke undead').used=2;
 choose(c,'cleric-destroy-undead');c.skills.find(s=>s.name==='Knowledge (religion)').ranks=5;const a=action(c,'destroy');assert.ok(hasTurningAbility(c));assert.equal(a.formula,'8d6');assert.equal(a.dc,23);assert.equal(alternateActionRemaining(c,a),4);
 useAlternateAction(c,'cleric-destroy-undead','destroy');recompute(c);assert.equal(alternateActionRemaining(c,action(c,'destroy')),3);
 c=resetDaily(c);assert.equal(alternateActionRemaining(c,action(c,'destroy')),6);
});
test('ninja alternate actions consume the existing Ki pool and reject empty pools',()=>{
 const c=make('Ninja',8);choose(c,'ninja-blinding-flash');const ki=c.features.find(f=>f.ruleId==='supp:ninja:Ki power');assert.ok(ki);const before=ki.used;
 useAlternateAction(c,'ninja-blinding-flash','flash');assert.equal(ki.used,before+1);ki.used=ki.max;assert.throws(()=>useAlternateAction(c,'ninja-blinding-flash','flash'),/No uses/);
});
test('cleric paths grant the correct skill bonuses and Mystic moves its extra slot',()=>{
 const c=make('Cleric',5);choose(c,'cleric-no-turning','Sage');assert.equal(effectBonus(c,'skill.Knowledge (religion)'),2);assert.equal(effectBonus(c,'skill.Diplomacy'),0);
 const p=c.casters.find(p=>!p.casting?.domain),base=castingNumbers(c,p).slots;
 configureAlternateFeature(c,'cleric-no-turning',{choice:'Mystic'});assert.equal(castingNumbers(c,p).slots[2],base[2]+1);
 c.classLevels[0].level=7;recompute(c);const withMystic=castingNumbers(c,p).slots;configureAlternateFeature(c,'cleric-no-turning',{choice:'Sage'});assert.equal(withMystic[3],castingNumbers(c,p).slots[3]+1);assert.equal(withMystic[2],castingNumbers(c,p).slots[2]);
});
test('Bardic Knack increases effective ranks without altering ranks or training',()=>{
 const c=make('Bard',10);const skill=c.skills.find(s=>s.name==='Climb'),base=skillBonus(c,skill);choose(c,'bard-bardic-knack');assert.equal(skillBonus(c,skill),base+5);assert.equal(skill.ranks,0);
 const trained=c.skills.find(s=>s.name==='Disable Device');assert.equal(skillBonus(c,trained),Math.floor((c.scores.INT-10)/2));
});
test('Berserker Strength follows HP threshold, consciousness and helplessness',()=>{
 const c=make('Barbarian',11);choose(c,'barbarian-berserker-strength');c.hp=55;assert.equal(effectBonus(c,'STR'),0);c.hp=54;assert.equal(effectBonus(c,'STR'),6);assert.equal(effectBonus(c,'saves'),3);assert.equal(activeDamageReductions(c).find(r=>r.id==='acf-berserker').amount,3);
 c.automation.context.helpless=true;assert.equal(effectBonus(c,'STR'),0);c.automation.context.helpless=false;c.hp=0;assert.equal(effectBonus(c,'STR'),0);
});
test('legacy free-text style records remain loadable and offer no invented grants',()=>{
 const c=make('Monk',6);c.alternateFeatures={selected:['monk-fighting-styles'],uses:{},settings:{'monk-fighting-styles':{choice:'My old custom style',reviewed:true}}};
 const parsed=characterSchema.parse(c);recompute(parsed);assert.equal(parsed.features.some(f=>f.ruleId?.startsWith('acf-grant:')),false);
});
test('all supported action formulas and resource rows remain bounded at catalog minimum and level 20',()=>{
 for(const d of alternateFeatureCatalog.filter(d=>d.kind!=='reference'))for(const lv of [d.level,20]){
  const c=make(d.classId,lv);c.classLevels=[{id:'class',classId:d.classId,name:d.classId,level:lv,notes:''}];
  const choice=d.choices?.[0]|| (d.choiceRequired?'Recorded choice':'');configureAlternateFeature(c,d.id,{choice,reviewed:true});if(d.skill)c.skills.find(s=>s.name===d.skill.name).ranks=d.skill.ranks;
  selectAlternateFeature(c,d.id,true);
  for(const a of alternateActions(c)){assert.ok(!a.formula?.includes('undefined'),a.name);if(a.max!==undefined)assert.ok(a.max>=0,a.name);}
  const rows=alternateResources(c);assert.equal(new Set(rows.map(r=>r.key)).size,rows.length,d.id);
 }
});

test('changing style clears historical qualification and temporary effects do not qualify lasting scores',()=>{
 const c=make('Monk',6);choose(c,'monk-fighting-styles','Cobra Strike');configureAlternateFeature(c,'monk-fighting-styles',{styleQualifiedAtSix:true});configureAlternateFeature(c,'monk-fighting-styles',{choice:'Undying Way'});assert.equal(alternateSettings(c,'monk-fighting-styles').styleQualifiedAtSix,false);
 const b=make('Barbarian',11);choose(b,'barbarian-berserker-strength');b.hp=1;assert.equal(effectBonus(b,'STR',{},true),0);assert.equal(effectBonus(b,'STR'),6);b.nonlethal=2;assert.equal(effectBonus(b,'STR'),0);
});
test('Draconic Fist requires its energy choice and spends on the attempt',()=>{
 const c=make('Monk',5);choose(c,'monk-draconic-fist');assert.throws(()=>useAlternateAction(c,'monk-draconic-fist','energy'),/energy type/);
 configureAlternateFeature(c,'monk-draconic-fist',{rules:{energy:'fire'}});const a=action(c,'energy');assert.equal(a.formula,'2d6');assert.match(a.description,/fire/);useAlternateAction(c,'monk-draconic-fist','energy');assert.equal(alternateActionRemaining(c,a),4);
});
test('Stunning Fist keeps separate grant and daily resource identities without refreshing spent uses',()=>{
 const c=make('Ranger',11);choose(c,'ranger-combat-styles','Beast-Wrestling');assert.ok(c.features.some(f=>f.ruleId==='acf-grant:ranger-combat-styles:style-11'&&f.name==='Stunning Fist'));
 const pool=c.features.find(f=>f.ruleId==='daily:Stunning Fist');pool.used=1;recompute(c);const saved=structuredClone(c);recompute(c);assert.deepEqual(c,saved);assert.equal(c.features.find(f=>f.ruleId==='daily:Stunning Fist').used,1);
});
