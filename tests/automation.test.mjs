import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,characterSchema,uid} from '../lib/model.ts';
import {activateAutomation,recompute,calculationFields,resourceNumbers,formulaPreview} from '../lib/automation.ts';
import {baseClasses,findClass,makeCaster,makePsionic} from '../lib/classes.ts';
import {raceCatalog,effectiveScore} from '../lib/ancestry.ts';
import {castingNumbers,advancementNumbers,hitDieSequence,hitPoints} from '../lib/advancement.ts';
import {addEffect,setEffectActive,advanceEffects,stackBonuses} from '../lib/effects.ts';
import {addEquipment,matchEquipment,carrying,movement,equippedArmor} from '../lib/equipment.ts';
import {sheetTotals,weaponAttack,weaponDamage,weaponRange,weaponCritical,attackRoutine,skillBonus,spellDC,canCast,spendSpell,resetDaily} from '../lib/rules.ts';
import {powerReserve,canManifest,spendPower} from '../lib/psionics.ts';
import {expression} from '../lib/formulas.ts';

const automatic=(name='Fighter',level=3,race='human')=>activateAutomation(newCharacter(name,level,race),false);
const entry=(name,level)=>({id:uid(),classId:findClass(name).id,name,level,notes:''});
const edit=(c,recipe)=>{const before=structuredClone(c);recipe(c);return recompute(c,before);};
const feat=(c,name,choice)=>c.features.push({id:uid(),name,choice,kind:'Feat',description:'',max:0,used:0,source:''});
const effect=(c,id)=>{addEffect(c,id);return c.effects.find(e=>e.preset===id);};
const known=(level=1)=>({id:uid(),spellId:'custom',level,slotLevel:level,prepared:1,spent:0,formula:'',notes:'',custom:null});

test('all 560 base-class/race combinations remain valid and stable with automation enabled',()=>{
 for(const race of raceCatalog)for(const def of baseClasses){
  const c=automatic(def.name,3,race.id);
  assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c,def.name+' '+race.name);
  const before=structuredClone(c);recompute(c);recompute(c);
  assert.deepEqual(c,before,def.name+' '+race.name+' changed on repeated calculation');
 }
});

test('Constitution, rage, level changes, and timed expiry preserve damage already taken',()=>{
 const c=automatic('Barbarian');c.hp-=7;const hp=c.maxHp;
 edit(c,c=>effect(c,'rage'));assert.equal(c.maxHp,hp+6);assert.equal(c.maxHp-c.hp,7);
 const rage=c.effects.find(e=>e.preset==='rage');rage.rounds=1;
 edit(c,advanceEffects);assert.equal(rage.active,false);assert.equal(c.maxHp,hp);assert.equal(c.maxHp-c.hp,7);
 edit(c,c=>c.classLevels[0].level=4);assert.equal(c.level,4);assert.equal(c.maxHp-c.hp,7);
 edit(c,c=>c.scores.CON+=2);assert.equal(c.maxHp-c.hp,7);
 c.automation.overrides.maxHp=55;edit(c,c=>c.scores.CON+=2);assert.equal(c.maxHp,55);assert.equal(c.maxHp-c.hp,7);
});

test('legacy migration preserves entered totals, spell resources, and notes across reloads',()=>{
 for(const kind of ['Fighter','Wizard','Paladin','Monk','Psion']){
  const c=newCharacter(kind);c.hp=3;c.notes='Existing campaign record';
  const before=structuredClone(c),totals=sheetTotals(c);activateAutomation(c,true);
  for(const [path] of calculationFields){const get=x=>path.split('.').reduce((v,k)=>v[k],x);assert.equal(get(c),get(before),kind+' '+path);}
  assert.equal(c.hp,3);assert.equal(c.notes,before.notes);assert.deepEqual(sheetTotals(c).saves,totals.saves);assert.equal(sheetTotals(c).ac,totals.ac);
  for(let i=0;i<c.casters.length;i++){assert.equal(c.casters[i].level,before.casters[i].level);assert.deepEqual(c.casters[i].slots,before.casters[i].slots);}
  const once=structuredClone(c);activateAutomation(c,true);assert.deepEqual(c,once);
 }
});

test('recorded Hit Die rolls and Intelligence stay attached to their original levels',()=>{
 const c=automatic('Fighter',2);c.automation.hpMethod='rolled';
 const key=hitDieSequence(c)[1].key;c.automation.history.find(h=>h.key===key).hitDieRoll=2;
 const oldBudget=advancementNumbers(c).skillBudget;edit(c,c=>c.scores.INT+=4);
 assert.equal(advancementNumbers(c).skillBudget,oldBudget);
 edit(c,c=>{const rogue=entry('Rogue',1);c.classLevels.push(rogue);c.automation.firstClassId=rogue.id;});
 assert.equal(c.automation.history.find(h=>h.key===key).hitDieRoll,2);
 assert.equal(hitPoints(c),20); // Rogue 6, Fighter 6 and recorded 2, plus CON +2 per HD.
 const s=c.skills.find(s=>s.name==='Use Magic Device');s.classSkillOverride=false;recompute(c);assert.equal(s.classSkill,false);
});

test('typed buffs select the strongest while independent dodge and untyped sources stack',()=>{
 assert.equal(stackBonuses([{value:1,type:'morale',source:'bless'},{value:2,type:'morale',source:'heroism'},{value:-2,type:'morale',source:'fear'},{value:-1,type:'morale',source:'bane'}]),0);
 assert.equal(stackBonuses([{value:1,type:'dodge',source:'one'},{value:2,type:'dodge',source:'two'},{value:2,type:'dodge',source:'two'}]),3);
 const c=automatic();const w=c.weapons[0],base=weaponAttack(c,w);effect(c,'bless');effect(c,'heroism');recompute(c);assert.equal(weaponAttack(c,w),base+2);
 const before=c.maxHp;effect(c,'ability-CON');recompute(c);assert.equal(c.maxHp,before+6);
 const lizard=automatic('Fighter',3,'lizardfolk'),ac=sheetTotals(lizard).ac;
 lizard.effects.push({id:uid(),name:'Natural armor',preset:'',active:true,permanent:false,casterLevel:3,rounds:0,notes:'',modifiers:[{target:'ac.natural',type:'natural',value:'3',when:''}]});
 assert.equal(sheetTotals(lizard).ac,ac);effect(lizard,'barkskin');assert.equal(sheetTotals(lizard).ac,ac+2);
});

test('re-enabling stored effects excludes opposites and expiry does not change untimed effects',()=>{
 const c=automatic();const haste=effect(c,'haste'),slow=effect(c,'slow');assert.equal(haste.active,false);
 setEffectActive(c,haste.id,true);assert.equal(slow.active,false);assert.equal(haste.active,true);
 effect(c,'exhausted');const fatigue=effect(c,'fatigued');assert.equal(c.effects.find(e=>e.preset==='exhausted').active,false);
 setEffectActive(c,c.effects.find(e=>e.preset==='exhausted').id,true);assert.equal(fatigue.active,false);
 haste.rounds=0;advanceEffects(c);assert.equal(haste.active,true);
});

test('equipped armor, shields, mithral, encumbrance, and force armor use separate limits',()=>{
 const c=automatic('Fighter',3);addEquipment(c,matchEquipment('Full plate'));addEquipment(c,matchEquipment('Heavy steel shield'));recompute(c);
 assert.deepEqual([c.defense.armor,c.defense.shield,c.defense.dexCap,c.defense.checkPenalty,c.speed],[8,2,1,-8,20]);
 const armor=c.gear.find(g=>g.name==='Full plate');edit(c,c=>{armor.material='mithral';armor.enhancement=1;});
 assert.deepEqual([c.defense.armor,c.defense.dexCap,c.defense.checkPenalty,c.defense.spellFailure],[9,3,-5,40]);
 effect(c,'mage-armor');effect(c,'shield');recompute(c);assert.equal(sheetTotals(c).ac,24);
 edit(c,c=>{for(const g of c.gear)g.equipped=false;});assert.equal(c.defense.armor,0);assert.equal(sheetTotals(c).ac,19);
 c.scores.STR=10;c.gear=[{id:uid(),name:'Load',qty:1,weight:70,carried:true,equipped:false,notes:''}];recompute(c);
 assert.equal(carrying(c).category,'Heavy');assert.equal(c.defense.checkPenalty,-6);assert.equal(c.speed,20);
 const dwarf=automatic('Fighter',3,'dwarf');addEquipment(dwarf,matchEquipment('Full plate'));recompute(dwarf);assert.equal(dwarf.speed,20);
 c.automation.overrides.speed=50;recompute(c);assert.equal(c.speed,50);assert.equal(movement(c).run,150);
 effect(c,'stunned');recompute(c);assert.equal(c.speed,0);assert.equal(movement(c).run,0);
});

test('masterwork and magical enhancement never double-count on attacks',()=>{
 const c=automatic();const w=c.weapons[0],base=weaponAttack(c,w);w.masterwork=true;
 c.effects.push({id:uid(),name:'Magic weapon',preset:'',active:true,permanent:false,casterLevel:3,rounds:0,notes:'',modifiers:[{target:'attack',type:'enhancement',value:'2',when:''}]});
 assert.equal(weaponAttack(c,w),base+2);w.enhancement=3;assert.equal(weaponAttack(c,w),base+3);
});

test('iteratives, Rapid Shot, haste, ranger off-hand attacks, and flurry use correct bonuses',()=>{
 const c=automatic('Ranger',11);c.automation.rangerStyle='two-weapon';c.automation.context.twoWeapon=true;
 const w=c.weapons[0];w.strength='off';assert.equal(attackRoutine(c,w).length,3);
 c.automation.context.twoWeapon=false;c.automation.rangerStyle='archery';c.automation.context.rapidShot=true;effect(c,'haste');
 assert.deepEqual(attackRoutine(c,w).map(a=>a.iteration),[0,1,2,0,0]);
 const monk=automatic('Monk',11);monk.automation.context.flurry=true;monk.weapons[0].strength='two';
 assert.deepEqual(attackRoutine(monk,monk.weapons[0]).map(a=>a.iteration),[0,1,0,0]);
 assert.equal(weaponDamage(monk,monk.weapons[0]),'1d10+2');
 effect(monk,'slow');assert.equal(attackRoutine(monk,monk.weapons[0]).length,1);
});

test('critical multipliers omit extra and sneak dice, while threat overrides and thrown ranges work',()=>{
 const c=automatic('Rogue',5);addEquipment(c,matchEquipment('Longsword'));const w=c.weapons.at(-1);w.proficiency='yes';w.extraDamage='1d6';c.automation.context.sneakAttack=true;
 assert.equal(weaponDamage(c,w,true),'2d8+1d6+3d6');
 w.crit='18–20 / ×3';w.keen=true;feat(c,'Improved Critical',w.name);assert.equal(weaponCritical(c,w).label,'15–20 / ×3');
 addEquipment(c,matchEquipment('Dagger'));const dagger=c.weapons.at(-1);dagger.attackMode='ranged';feat(c,'Far Shot');assert.equal(weaponRange(c,dagger),20);
 c.automation.context.distance=35;assert.ok(!weaponDamage(c,dagger).includes('3d6'));
});

test('caster progression updates slots without clearing preparations or spent uses',()=>{
 const c=automatic('Wizard',3),p=c.casters[0],k=known();p.spells=[k];k.spent=1;p.slots[1].used=2;
 edit(c,c=>c.classLevels[0].level=5);assert.equal(p.level,5);assert.equal(p.slots[3].max,2);assert.equal(k.spent,1);assert.equal(p.slots[1].used,2);
 const before=p.slots.map(s=>s.max);edit(c,c=>effect(c,'ability-INT'));assert.deepEqual(p.slots.map(s=>s.max),before);assert.equal(spellDC(c,p,k),16);
 edit(c,c=>c.effects.find(e=>e.preset==='ability-INT').permanent=true);assert.equal(p.slots[1].max,before[1]+1);
 edit(c,c=>c.classLevels=[]);assert.equal(p.level,0);assert.ok(p.slots.every(s=>s.max===0));assert.equal(k.spent,1);
});

test('dual prestige progression, domain slots, and caster-level-only advancement remain distinct',()=>{
 const c=automatic('Wizard',3);const wizard=c.casters[0];c.classLevels.push(entry('Cleric',3),entry('Mystic Theurge',2));
 const cleric=makeCaster(findClass('Cleric'),3,16);c.scores.WIS=16;c.casters.push(cleric);recompute(c);
 assert.equal(wizard.level,5);assert.equal(cleric.level,5);
 const domain=structuredClone(cleric);domain.id=uid();domain.name='Domain';domain.casting.domain=true;domain.spells=[];c.casters.push(domain);recompute(c);
 assert.deepEqual(domain.slots.map(s=>s.max),[0,1,1,1,0,0,0,0,0,0]);
 c.classLevels.push(entry('Hierophant',2));recompute(c);assert.equal(cleric.level,7);assert.equal(castingNumbers(c,cleric).progression,5);assert.equal(domain.level,7);
 const theurge=c.classLevels.find(e=>e.classId==='mystic-theurge');theurge.divineTarget=wizard.id;recompute(c);assert.equal(wizard.level,5);assert.equal(castingNumbers(c,cleric).progression,3);
});

test('prepared capacity, cantrips, and current casting ability prevent invalid casts',()=>{
 const c=automatic('Wizard',3),p=c.casters[0],k=known();p.spells=[k];k.prepared=p.slots[1].max+1;assert.equal(canCast(p,k,c),false);
 k.prepared=1;assert.equal(canCast(p,k,c),true);c.temps.INT=-6;assert.equal(canCast(p,k,c),false);assert.throws(()=>spendSpell(p,k,c));
 const sorcerer=automatic('Sorcerer',3),s=sorcerer.casters[0],cantrip=known(0);s.slots[0].used=s.slots[0].max;assert.equal(canCast(s,cantrip,sorcerer),false);
 const restored=resetDaily(sorcerer);assert.equal(canCast(restored.casters[0],cantrip,restored),true);
});

test('psionic progression preserves the shared spent pool and enforces power-level requirements',()=>{
 const c=automatic('Psion',3),p=c.psionics[0];const k={id:uid(),name:'Vigor',powerId:'vigor',level:1,cost:3,formula:'',notes:''};p.powers=[k];spendPower(c,p.id,k.id);
 const reserve=powerReserve(c);edit(c,c=>c.classLevels[0].level=5);assert.equal(p.level,5);assert.equal(p.spent,3);assert.ok(powerReserve(c).max>reserve.max);
 const before=p.max;edit(c,c=>effect(c,'ability-INT'));assert.equal(p.max,before);
 k.level=3;k.cost=1;assert.equal(canManifest(c,p,k),false);k.cost=5;assert.equal(canManifest(c,p,k),true);
 c.temps.INT=-10;assert.equal(canManifest(c,p,k),false);c.temps.INT=0;
 edit(c,c=>c.classLevels=[]);assert.equal(p.level,0);assert.equal(p.max,0);assert.equal(p.spent,3);assert.equal(powerReserve(c).remaining,0);
});

test('class daily resources change their limits without refunding uses',()=>{
 const c=automatic('Paladin',5);const lay=c.features.find(f=>f.name.startsWith('Lay on hands'));lay.used=4;
 edit(c,c=>c.scores.CHA+=2);assert.equal(lay.max,15);assert.equal(lay.used,4);
 const smite=c.features.find(f=>f.name==='Smite evil');smite.used=1;edit(c,c=>c.classLevels[0].level=10);assert.equal(smite.max,3);assert.equal(smite.used,1);
 const wizard=automatic('Psychic Warrior',3);assert.equal(advancementNumbers(wizard).psionicFeats,2);
 const cleric=automatic('Cleric',3);feat(cleric,'Improved Turning');assert.equal(resourceNumbers(cleric).turnLevel,4);
 const guard=automatic();guard.classLevels.push(entry('Blackguard',5));guard.scores.CHA=14;recompute(guard);
 const w=guard.weapons[0],attack=weaponAttack(guard,w);guard.automation.context.smite=true;guard.automation.context.targetType='good';
 assert.equal(weaponAttack(guard,w),attack+2);assert.equal(weaponDamage(guard,w),'1d8+8');
});

test('custom arithmetic is bounded, rejects executable syntax, and scales dice from live values',()=>{
 assert.equal(expression('min(10, floor(CL/2)) + WIS_MOD',{CL:15,WIS_MOD:3}),10);
 for(const input of ['process.exit()','constructor(1)','1/0','2**3','1;2','abs(1,2)'])assert.throws(()=>expression(input));
 const c=automatic('Wizard',5);assert.deepEqual(formulaPreview(c,'{min(CL,10)}d6+{INT_MOD}',{CL:5}),{formula:'5d6+3',error:''});
 assert.ok(formulaPreview(c,'{UNKNOWN}d6').error);
});
