import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {raceCatalog,raceReferenceCatalog,findRace,selectRace,raceProgression} from '../lib/ancestry.ts';
import {characterSchema} from '../lib/model.ts';
import {createPlayerCharacter,startingAbilityScores} from '../lib/character-creation.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {advancementNumbers,hitDieSequence} from '../lib/advancement.ts';
import {classSkillAt} from '../lib/skill-points.ts';
import {sheetTotals,attackRoutine,weaponAttack,weaponDamage} from '../lib/rules.ts';
import {bestiary,createBestiaryMonster} from '../lib/bestiary.ts';
import {creatureAbilityScore,creatureAbilityModifier,naturalAttackRoutine} from '../lib/creatures.ts';
const json=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8'));
const apply={abilities:true,traits:true,body:true,languages:true};
const scores={STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10};
const pc=(raceId,kind='Fighter',level=1)=>createPlayerCharacter({name:'Regression',kind,level,raceId,scores,method:'manual'});

test('every main Ultimate SRD race-index link resolves, with unique selectable IDs and explicit references',()=>{
 const coverage=json('../scripts/data/ultimate-race-coverage.json');
 assert.equal(coverage.length,363);assert.equal(raceCatalog.length,360);assert.equal(raceReferenceCatalog.length,9);
 const all=[...raceCatalog,...raceReferenceCatalog];assert.equal(new Set(all.map(r=>r.id)).size,all.length);
 for(const entry of coverage)assert.ok(all.some(r=>r.id===entry.id),entry.source);
 for(const r of all){assert.equal(new URL(r.source).hostname,'srd.dndtools.org',r.id);if(r.parentSource)assert.equal(new URL(r.parentSource).hostname,'srd.dndtools.org');if(r.rhd)assert.ok(raceProgression(r.id),r.id);}
});
test('templates and overviews cannot replace a base race or enter character creation',()=>{
 for(const reference of raceReferenceCatalog){const c=pc('elf'),before=structuredClone(c);assert.throws(()=>selectRace(c,reference.id,apply));assert.deepEqual(c,before);assert.throws(()=>pc(reference.id));assert.throws(()=>startingAbilityScores(scores,reference.id));}
});
test('variants inherit parent numbers and remove replaced skills, saves, and vision',()=>{
 const jungle=findRace('jungle-dwarf');assert.deepEqual(jungle.abilities,{CON:2,CHA:-2});assert.equal(jungle.speed,20);assert.match(jungle.vision,/low-light/i);assert.doesNotMatch(jungle.vision,/darkvision/i);assert.equal(jungle.skills['Knowledge (nature)'],2);
 const desert=findRace('desert-gnome');assert.equal(desert.size,'Small');assert.equal(desert.skills.Listen,undefined);assert.equal(desert.skills['Craft (alchemy)'],undefined);assert.equal(desert.skills.Diplomacy,2);
 assert.equal(findRace('jungle-halfling').saves.fort,undefined);assert.equal(findRace('arctic-half-elf').skills.Diplomacy,undefined);assert.equal(findRace('arctic-half-elf').skills['Gather Information'],2);
 assert.deepEqual(findRace('athasian-half-giant').abilities,{STR:2,CON:2,DEX:-2});assert.equal(findRace('athasian-half-giant').grapple,4);
 assert.equal(findRace('aquatic-half-elf').swim,15);assert.equal(findRace('aquatic-half-elf').skills.Diplomacy,undefined);
 assert.equal(findRace('forestlord-half-elf').skills['Gather Information'],undefined);assert.equal(findRace('deepwyrm-half-drow').skills.Bluff,2);
 const exiled=pc('exiled-dwarf');const base=sheetTotals(exiled).saves;exiled.automation.context.saveAgainst='poison';assert.deepEqual(sheetTotals(exiled).saves,base);assert.equal(findRace('exiled-dwarf').vision,'Normal vision');
 const imported=pc('jungle-halfling'),importedSaves=sheetTotals(imported).saves;imported.automation.context.saveAgainst='fear';assert.deepEqual(sheetTotals(imported).saves,importedSaves);
 const core=pc('halfling'),coreSaves=sheetTotals(core).saves;core.automation.context.saveAgainst='fear';assert.equal(sheetTotals(core).saves.will,coreSaves.will+2);
});
test('hellbred and mephling choices never combine mutually exclusive traits',()=>{
 assert.deepEqual(findRace('hellbred-body').abilities,{CON:2,INT:-2});assert.deepEqual(findRace('hellbred-spirit').abilities,{CHA:2,CON:-2});assert.equal(findRace('hellbred-body').skills['Sense Motive'],undefined);assert.equal(findRace('hellbred-spirit').skills['Sense Motive'],2);
 const air=findRace('mephling-air'),earth=findRace('mephling-earth'),water=findRace('mephling-water');assert.equal(air.fly,10);assert.equal(air.swim,undefined);assert.equal(earth.burrow,10);assert.equal(earth.fly,undefined);assert.equal(water.swim,30);
});
test('racial bonus feats and skill points are separate and never counted twice',()=>{
 const human=pc('human'),silver=pc('silverbrow-human'),complacent=pc('complacent-human');
 assert.equal(advancementNumbers(human).skillBudget,12);assert.equal(advancementNumbers(silver).skillBudget,8);assert.equal(advancementNumbers(human).feats,2);assert.equal(advancementNumbers(silver).feats,2);assert.equal(advancementNumbers(complacent).feats,1);
 const skill=silver.skills.find(s=>s.name==='Disguise');assert.equal(classSkillAt(silver,skill,hitDieSequence(silver)[0]),true);
 const before=structuredClone(silver);selectRace(silver,'silverbrow-human',apply);recompute(silver);assert.deepEqual(advancementNumbers(silver),advancementNumbers(before));
});
test('racial progression uses creature dice and saves, while LA never grants HD, feats or casting',()=>{
 const archon=pc('hound-archon','Wizard',3);assert.equal(archon.level,9);assert.equal(archon.bab,7);assert.deepEqual([archon.saves.fort.base,archon.saves.ref.base,archon.saves.will.base],[6,6,8]);assert.equal(archon.casters[0].level,3);assert.equal(hitDieSequence(archon).length,9);
 assert.equal(hitDieSequence(archon)[0].skillBase,8);assert.equal(advancementNumbers(archon).ecl,14);const before=advancementNumbers(archon);archon.ancestry.levelAdjustment+=5;const after=advancementNumbers(archon);assert.equal(after.feats,before.feats);assert.equal(after.skillBudget,before.skillBudget);assert.equal(after.abilityIncreases,before.abilityIncreases);
 const dragon=pc('dracotaur');assert.equal(hitDieSequence(dragon)[0].die,12);assert.match(dragon.hitDice,/3d12/);const fey=pc('domovoi');assert.equal(hitDieSequence(fey)[0].die,6);assert.equal(fey.bab,2);
});
test('absent racial abilities survive schema round trips and race changes; living constructs retain Constitution',()=>{
 const c=pc('unbodied');assert.equal(creatureAbilityScore(c,'STR'),null);assert.equal(creatureAbilityModifier(c,'STR'),0);const loaded=characterSchema.parse(JSON.parse(JSON.stringify(c)));recompute(loaded);assert.equal(creatureAbilityScore(loaded,'STR'),null);
 selectRace(loaded,'human',apply);assert.equal(loaded.creature,null);assert.equal(creatureAbilityScore(loaded,'STR'),10);assert.equal(creatureAbilityScore(pc('warforged-charger'),'CON'),20);
});
test('all 48 Libris Mortis presets retain source HP, BAB, saves, and absent abilities',()=>{
 const data=json('../lib/libris-mortis-data.json');assert.equal(data.length,48);assert.equal(bestiary.length,54);
 for(const entry of data){const c=createBestiaryMonster(entry.id),t=sheetTotals(c),s=entry.stats;assert.equal(c.maxHp,Number(s['Hit Dice'].match(/\((\d+) hp\)/)[1]),entry.id);if(Number.isFinite(parseInt(s['Base Attack/Grapple'])))assert.equal(c.bab,parseInt(s['Base Attack/Grapple']),entry.id);else assert.match(c.creature.notes,/base attack.*unspecified/);
 for(const key of ['fort','ref','will'])assert.equal(t.saves[key],Number(s.Saves.replace(/[−–]/g,'-').match(new RegExp(key+'\\s*([+-]?\\d+)','i'))[1]),entry.id+' '+key);
 if(c.creature.type==='Undead'){assert.equal(creatureAbilityScore(c,'CON'),null,entry.id);assert.equal(t.mods.CON,0,entry.id);}
 const copy=createBestiaryMonster(entry.id);c.creature.movement.fly+=10;assert.notDeepEqual(c.creature,copy.creature);const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));activateAutomation(saved);recompute(saved);assert.deepEqual(saved,c);
 }
});
test('Libris Mortis natural attacks retain primary/secondary roles and manufactured alternatives',()=>{
 const angel=createBestiaryMonster('lm-angel-of-decay');assert.deepEqual(naturalAttackRoutine(angel).map(a=>[a.role,a.attackBonus,a.damageFormula]),[['primary',21,'2d6+18'],['primary',21,'2d6+18'],['secondary',16,'1d6+11'],['secondary',16,'1d6+11']]);
 const half=createBestiaryMonster('lm-half-vampire');assert.equal(naturalAttackRoutine(half)[0].role,'primary');assert.equal(naturalAttackRoutine(half)[0].attackBonus,5);
 const ghoul=createBestiaryMonster('lm-gravetouched-ghoul');assert.deepEqual(naturalAttackRoutine(ghoul).map(a=>a.role),['primary','secondary','secondary']);assert.deepEqual(attackRoutine(ghoul,ghoul.weapons[0]).map(a=>weaponAttack(ghoul,ghoul.weapons[0],a.iteration)),[6,6]);
 const reaper=createBestiaryMonster('lm-entropic-reaper');assert.deepEqual(attackRoutine(reaper,reaper.weapons[0]).map(a=>weaponAttack(reaper,reaper.weapons[0],a.iteration)),[13,8]);assert.equal(weaponDamage(reaper,reaper.weapons[0]),'2d6+18');
 const wheep=createBestiaryMonster('lm-wheep');assert.equal(naturalAttackRoutine(wheep).at(-1).damageFormula,'1d6+5');
});
test('swarm and rider damage have no attack roll; ability damage and drain stay distinct',()=>{
 for(const id of ['lm-bloodmote-cloud','lm-bone-rat-swarm','lm-corpse-rat-swarm']){const c=createBestiaryMonster(id);assert.equal(c.creature.naturalAttacks.length,1);assert.equal(naturalAttackRoutine(c)[0].attackRoll,false);}
 const murk=naturalAttackRoutine(createBestiaryMonster('lm-murk'))[0];assert.equal(murk.damageKind,'ability-damage');assert.equal(murk.damageAbility,'WIS');
 const lyrist=naturalAttackRoutine(createBestiaryMonster('lm-spectral-lyrist'))[0];assert.equal(lyrist.damageKind,'ability-drain');assert.equal(lyrist.damageAbility,'CHA');
 const cinder=naturalAttackRoutine(createBestiaryMonster('lm-cinderspawn'));assert.equal(cinder[0].damageKind,'hit-points');assert.equal(cinder[1].damageKind,'ability-drain');assert.equal(cinder[1].attackRoll,false);
 const bleak=naturalAttackRoutine(createBestiaryMonster('lm-bleakborn'));assert.equal(bleak[1].damageFormula,'2d6');assert.equal(bleak[1].attackRoll,false);
});
