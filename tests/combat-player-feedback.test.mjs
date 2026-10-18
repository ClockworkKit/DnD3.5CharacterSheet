import test from 'node:test';
import assert from 'node:assert/strict';
import {newCharacter,newWeapon,uid} from '../lib/model.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {addEquipment,matchEquipment} from '../lib/equipment.ts';
import {addEffect} from '../lib/effects.ts';
import {selectAlternateFeature} from '../lib/alternate-features.ts';
import {fullAttackRoutine,fullAttackContext,makeFullAttackRoll,makeRequest,weaponDamage} from '../lib/rules.ts';
import {armorBreakdown,rogueCombatFeatures,setDeathsRuin} from '../lib/combat-explanations.ts';

const create=(kind='Rogue',level=3)=>activateAutomation(newCharacter(kind,level),false);
const feat=(c,name,choice)=>c.features.push({id:uid(),name,choice,kind:'Feat',description:'',source:'',max:0,used:0});

test('armor penalty and carrying penalty are distinguished without changing saved adjustments',()=>{
 const c=create();c.scores.STR=10;c.gear=[];c.coinWeight=false;
 addEquipment(c,matchEquipment('Studded leather'));
 c.gear.push({id:uid(),name:'Pack',qty:1,weight:25.14,carried:true,equipped:false,notes:''});
 c.automation.encumbrance=true;recompute(c);
 const values=armorBreakdown(c);
 assert.equal(values.armor.checkPenalty,-1);assert.equal(values.load.category,'Medium');
 assert.equal(values.basePenalty,-3);assert.equal(values.baseDexCap,3);assert.equal(c.defense.checkPenalty,-3);
 c.automation.adjustments['defense.checkPenalty']=2;recompute(c);
 assert.equal(armorBreakdown(c).basePenalty,-3);assert.equal(c.defense.checkPenalty,-1);
 c.gear[1].carried=false;recompute(c);assert.equal(armorBreakdown(c).basePenalty,-1);
});

test('rogue Evasion is automatic and explains load, armor, helplessness, and replacement restrictions',()=>{
 const c=create();c.gear=[];c.coinWeight=false;c.automation.encumbrance=true;recompute(c);
 assert.equal(rogueCombatFeatures(c).evasion,true);assert.equal(rogueCombatFeatures(c).evasionBlocked,'');
 c.automation.context.helpless=true;assert.equal(rogueCombatFeatures(c).evasionBlocked,'being helpless');
 c.automation.context.helpless=false;c.scores.STR=10;
 c.gear.push({id:uid(),name:'Pack',qty:1,weight:40,carried:true,equipped:false,notes:''});
 assert.equal(rogueCombatFeatures(c).evasionBlocked,'a medium or heavier load');
 c.automation.encumbrance=false;assert.equal(rogueCombatFeatures(c).evasionBlocked,'');
 addEquipment(c,matchEquipment('Chainmail'));assert.equal(rogueCombatFeatures(c).evasionBlocked,'medium or heavy armor');
 c.classLevels[0].level=1;recompute(c);assert.equal(rogueCombatFeatures(c).evasion,false);
});

test('rogue 3 has one normal attack; Death\'s Ruin adds half sneak dice to actual damage rolls',()=>{
 const c=create();const w={...newWeapon(),name:'Short sword',damage:'1d6'};c.weapons=[w];c.scores.STR=10;
 assert.equal(fullAttackRoutine(c).length,1);assert.equal(rogueCombatFeatures(c).deathsRuin,false);
 c.alternateFeatures.settings['rogue-deaths-ruin']={reviewed:true};
 selectAlternateFeature(c,'rogue-deaths-ruin',true);recompute(c);setDeathsRuin(c,true);
 assert.equal(c.automation.context.targetType,'undead');assert.equal(rogueCombatFeatures(c).deathsRuinDice,1);
 const card=makeFullAttackRoll(c);assert.equal(card.rolls.length,2);assert.equal(card.rolls[1].formula,'1d6+1d6');
 const request=makeRequest(card,'Buzzer','https://example.com/sheet?secret=1',true);
 assert.equal(request.type,'chat-message');assert.equal(request.character.url,'https://example.com/sheet');
 assert.match(request.message,/^\/w gm /);assert.equal(request.message.match(/\[\[/g).length,2);
 assert.equal(makeFullAttackRoll(c,undefined,false).rolls.length,1);
 setDeathsRuin(c,false);c.automation.context.sneakAttack=true;assert.equal(weaponDamage(c,w),'1d6');
 c.automation.context.targetType='';assert.equal(weaponDamage(c,w),'1d6+2d6');
 setDeathsRuin(c,true);w.attackMode='ranged';c.automation.context.distance=35;assert.equal(weaponDamage(c,w),'1d6');
});

test('one main-hand routine and one off-hand routine, not an iterative routine per selected weapon',()=>{
 const c=create('Fighter',11);c.weapons=[];c.gear=[];
 addEquipment(c,matchEquipment('Longsword'));addEquipment(c,matchEquipment('Sword, short'));addEquipment(c,matchEquipment('Dagger'));
 const original=structuredClone(c.weapons);
 assert.equal(fullAttackRoutine(c,c.weapons).length,3);
 c.automation.context.twoWeapon=true;
 assert.equal(fullAttackRoutine(c,c.weapons).length,4);
 const off=fullAttackRoutine(c,c.weapons).at(-1).weapon;assert.equal(off.strength,'off');
 assert.deepEqual(c.weapons,original);assert.equal(fullAttackContext(c,c.weapons).automation.context.offhandLight,true);
 feat(c,'Improved Two-Weapon Fighting');feat(c,'Greater Two-Weapon Fighting');
 assert.equal(fullAttackRoutine(c).length,6);
 addEffect(c,'haste');assert.equal(fullAttackRoutine(c).length,7);
 addEffect(c,'slow');assert.equal(fullAttackRoutine(c).length,1);
 c.automation.context.defensive='total';assert.equal(fullAttackRoutine(c).length,0);
});

test('two-handed weapons cannot gain an off-hand attack and standard charge does not grant a full routine',()=>{
 const c=create('Fighter',11);c.weapons=[];addEquipment(c,matchEquipment('Greatsword'));addEquipment(c,matchEquipment('Dagger'));
 c.automation.context.twoWeapon=true;assert.equal(fullAttackRoutine(c).length,3);
 assert.equal(fullAttackContext(c).automation.context.twoWeapon,false);
 c.automation.context.charge=true;assert.equal(fullAttackRoutine(c).length,1);
});

test('hand crossbows respect loading and Rapid Reload rather than granting free repeated shots',()=>{
 const c=create('Rogue',12);c.weapons=[];addEquipment(c,matchEquipment('Crossbow, hand'));
 assert.equal(fullAttackRoutine(c).length,1);
 feat(c,'Rapid Reload','Crossbow, hand');assert.equal(fullAttackRoutine(c).length,2);
 feat(c,'Rapid Shot');c.automation.context.rapidShot=true;assert.equal(fullAttackRoutine(c).length,3);
 addEquipment(c,matchEquipment('Dagger'));c.automation.context.twoWeapon=true;
 assert.equal(fullAttackRoutine(c).filter(e=>e.weapon.name==='Crossbow, hand').length,1);
});

test('multi-roll labels cannot inject macros; invalid formulas are rejected before handoff',()=>{
 const card={title:'Full attack',details:'',rolls:[{label:'x}} {{bad=[[999]]}}',formula:'1d20+2'},{label:'damage',formula:'1d6'}]};
 const request=makeRequest(card,'A','https://example.com');
 assert.equal(request.message.match(/\[\[/g).length,2);assert.doesNotMatch(request.message,/\[\[999/);
 card.rolls[1].formula='@{secret}';assert.throws(()=>makeRequest(card,'A','https://example.com'));
});
