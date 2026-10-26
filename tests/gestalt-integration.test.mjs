import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {characterSchema,newWeapon} from '../lib/model.ts';
import {classTotals,findClass,makeCaster,makePsionic,copyClassFeatures} from '../lib/classes.ts';
import {gestaltProgressionSchema} from '../lib/gestalt-schema.ts';
import {recompute,resourceNumbers} from '../lib/automation.ts';
import {sheetTotals,weaponDice,weaponDamage,attackRoutine} from '../lib/rules.ts';
import {movement,addEquipment,matchEquipment} from '../lib/equipment.ts';
import {configureAlternateFeature,selectAlternateFeature,turningClassLevel,hasTurningAbility} from '../lib/alternate-features.ts';
import {monkAbilityLevel,sneakAttackProgressions} from '../lib/shared-class-features.ts';
import {gestaltFeatureLedger} from '../lib/gestalt-progression.ts';
import {hitDieSequence} from '../lib/level-history.ts';
import {advancementNumbers,casterProgression,psionicProgression} from '../lib/advancement.ts';
import {advancementChoices} from '../lib/advancement-choices.ts';
import {skillLedger,setSkillPoints,moveSkillLevel} from '../lib/skill-points.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel,levelUpStatus} from '../lib/level-up.ts';
import {prestigeEligibility} from '../lib/prerequisites.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {characterHitDice} from '../lib/character-level.ts';
import {racialHD} from '../lib/racial-abilities.ts';
import {systemLimits} from '../lib/class-systems.ts';

const standard=()=>createPlayerCharacter({name:'Paired integration QA',kind:'Fighter',level:1,raceId:'human',scores:{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10},method:'manual'});
const repeat=(a,b,n)=>Array.from({length:n},()=>[a,b]);
const unarmed=()=>({...newWeapon(),name:'Unarmed strike'});
// Mirror CharacterSheet.edit: apply the recipe, then recalculate exactly once.
const applyReview=(c,preview)=>{const previous=structuredClone(c);applyGestaltLevel(c,preview);recompute(c,previous);};
// Construct explicit synthetic progression; this is not a player-save conversion API.
function paired(pairs){
 const c=standard(),counts=new Map();
 for(const pair of pairs)for(const id of pair)counts.set(id,(counts.get(id)??0)+1);
 c.classLevels=[...counts].map(([classId,level])=>({id:'entry-'+classId,classId,name:findClass(classId).name,level,notes:'Retain notes'}));
 c.advancementMode='gestalt';
 c.gestaltProgression=gestaltProgressionSchema.parse({version:1,levels:pairs.map(([left,right],i)=>({id:'pair-'+i,left:'entry-'+left,right:'entry-'+right,approvals:[left,right].filter(id=>['arcane-trickster','eldritch-knight','mystic-theurge','cerebremancer'].includes(id)).map(classId=>({classId,gm:'Test GM',reason:'Explicit fixture approval; prerequisite tests belong to advancement'}))}))});
 c.automation.history=[];c.automation.levelOrder=[];c.automation.hpRolls=[];c.automation.firstClassId='';c.features=[];c.casters=[];
 for(const row of hitDieSequence(c))c.automation.history.push({key:row.key,intScore:12,hitDieRoll:4,skillRanks:{},skillClassOverrides:{}});
 for(const e of c.classLevels){const d=findClass(e.classId);if(d.levels[0].slots)c.casters.push(makeCaster(d,e.level,c.scores[d.casting?.ability??(d.id==='wizard'?'INT':'WIS')]));}
 copyClassFeatures(c);recompute(c);c.hp=c.maxHp;
 return c;
}

test('paired advancement previews one real level without mutation, then preserves existing history and expenditure',async()=>{
 const c=paired(repeat('fighter','wizard',2));c.experience=3000;c.hp-=3;c.casters[0].slots[1].used=1;c.casters[0].notes='Keep spellbook notes';
 const history=structuredClone(c.automation.history),before=structuredClone(c),preview=previewGestaltLevel(c,{left:'fighter',right:'wizard',hitDieRoll:9});
 assert.deepEqual(c,before);assert.equal(preview.summary.level,3);assert.equal(preview.summary.die,10);assert.equal(preview.summary.hpGain,11);assert.equal(preview.summary.skillPoints,4);
 assert.deepEqual(preview.summary.bab,{before:2,after:3});assert.equal(preview.summary.choices.filter(r=>r.key.startsWith('general-')).length,1);assert.equal(preview.summary.choices.filter(r=>r.kind==='ability').length,0);
 assert.equal(preview.summary.casting[0].level,3);assert.equal(preview.summary.milestones.length,2);
 applyReview(c,preview);assert.equal(c.level,3);assert.equal(c.maxHp-c.hp,3);assert.equal(c.casters[0].slots[1].used,1);assert.equal(c.casters[0].notes,'Keep spellbook notes');
 assert.deepEqual(c.automation.history.slice(0,2),history);assert.equal(c.automation.history[2].hitDieRoll,9);assert.equal(c.experience,3000);assert.equal(levelUpStatus(c).available,0);
 const previous=structuredClone(c);recompute(c,previous);assert.deepEqual(c,previous,'subsequent recomputation is idempotent');
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));assert.deepEqual(loaded.gestaltProgression,c.gestaltProgression);assert.deepEqual(loaded.automation.history,c.automation.history);assert.equal(loaded.maxHp-loaded.hp,3);
});

test('paired fourth level offers one ability increase and independent class milestones',()=>{
 const c=paired(repeat('fighter','wizard',3));c.experience=6000;
 const p=previewGestaltLevel(c,{left:'wizard',right:'fighter',hitDieRoll:5});
 assert.equal(p.summary.choices.filter(r=>r.kind==='ability').length,1);assert.equal(p.summary.choices.filter(r=>r.key.startsWith('fighter-')).length,1);
 assert.equal(p.summary.choices.filter(r=>r.key.startsWith('general-')).length,0);
 applyReview(c,p);assert.deepEqual(c.scores,{STR:14,DEX:12,CON:14,INT:12,WIS:14,CHA:10});assert.deepEqual(c.classLevels.map(e=>e.level),[4,4]);
});

test('both sides can change classes and initialize independent casting and manifesting once',()=>{
 const c=paired(repeat('fighter','rogue',1));c.experience=3000;
 applyReview(c,previewGestaltLevel(c,{left:'cleric',right:'psion',hitDieRoll:6}));
 assert.equal(c.level,2);assert.equal(c.casters.length,1);assert.equal(c.psionics.length,1);assert.equal(c.casters[0].casting.classId,'cleric');assert.equal(c.psionics[0].manifesting.classId,'psion');
 c.psionics[0].spent=1;c.psionics[0].focused=true;c.casters[0].slots[1].used=1;
 applyReview(c,previewGestaltLevel(c,{left:'psion',right:'cleric',hitDieRoll:5}));
 assert.equal(c.casters.length,1);assert.equal(c.psionics.length,1);assert.equal(c.psionics[0].spent,1);assert.equal(c.psionics[0].focused,true);assert.equal(c.casters[0].slots[1].used,1);
 assert.deepEqual(c.classLevels.map(e=>e.level),[1,1,2,2]);assert.equal(c.automation.history.length,3);
});

test('invalid paired choices, dice, XP and mode leave the complete character unchanged',()=>{
 const base=paired(repeat('fighter','wizard',2));base.experience=3000;
 const invalid=[{left:'fighter',right:'fighter',hitDieRoll:3},{left:'fighter',right:'missing',hitDieRoll:3},{left:'Fighter',right:'wizard',hitDieRoll:3},
  {left:'fighter',right:'wizard'},{left:'fighter',right:'wizard',hitDieRoll:11},{left:'fighter',right:'wizard',hitDieRoll:0},{left:'fighter',right:'wizard',hitDieRoll:2.5},
  {left:'fighter',right:'wizard',hitDieRoll:3,approvals:[{classId:'fighter',gm:'GM',reason:'Not a combination class'}]}];
 for(const selection of invalid){const c=structuredClone(base),before=structuredClone(c);assert.throws(()=>previewGestaltLevel(c,selection));assert.deepEqual(c,before);}
 for(const change of [c=>c.experience=2999,c=>c.automation.enabled=false,c=>c.advancementMode='standard',c=>delete c.gestaltProgression]){
  const c=structuredClone(base);change(c);const before=structuredClone(c);assert.throws(()=>previewGestaltLevel(c,{left:'fighter',right:'wizard',hitDieRoll:3}));assert.deepEqual(c,before);
 }
 const cap=paired(repeat('fighter','wizard',20));cap.experience=1000000;const before=structuredClone(cap);assert.throws(()=>previewGestaltLevel(cap,{left:'fighter',right:'wizard',hitDieRoll:5}));assert.deepEqual(cap,before);
});

test('paired confirmation rejects stale reviews and changed selections, and never trusts edited after-state',()=>{
 const c=paired(repeat('fighter','wizard',2));c.experience=3000;
 const p=previewGestaltLevel(c,{left:'fighter',right:'wizard',hitDieRoll:5});c.hp--;const before=structuredClone(c);
 assert.throws(()=>applyReview(c,p),/character changed/);assert.deepEqual(c,before);
 const changed=previewGestaltLevel(c,p.selection);changed.selection.right='cleric';assert.throws(()=>applyReview(c,changed),/choices changed/);assert.deepEqual(c,before);
 const fresh=previewGestaltLevel(c,p.selection);fresh.character.hp=999;fresh.character.classLevels=[];applyReview(c,fresh);
 assert.equal(c.level,3);assert.equal(c.maxHp-c.hp,1);assert.equal(c.classLevels.length,2);
 const applied=structuredClone(c);assert.throws(()=>applyReview(c,fresh),/character changed/);assert.deepEqual(c,applied);
});

test('prestige entry cannot borrow the other side of the new level, even with GM combination approval',()=>{
 const c=paired(repeat('wizard','fighter',4));c.experience=100000;c.scores.INT=18;recompute(c);
 const approvals=[{classId:'eldritch-knight',gm:'Test GM',reason:'Allow this combination prestige class'}],selection={left:'wizard',right:'eldritch-knight',hitDieRoll:4,approvals};
 const before=structuredClone(c);assert.throws(()=>previewGestaltLevel(c,selection),/before gaining this level/);assert.deepEqual(c,before,'Wizard 5 spells are not available for entry at level 5');
 applyReview(c,previewGestaltLevel(c,{left:'wizard',right:'fighter',hitDieRoll:4}));
 assert.throws(()=>previewGestaltLevel(c,{...selection,approvals:[]}),/named GM approval/);
 const p=previewGestaltLevel(c,selection);applyReview(c,p);
 assert.equal(c.level,6);assert.equal(c.classLevels.find(e=>e.classId==='eldritch-knight').level,1);assert.deepEqual(c.gestaltProgression.levels.at(-1).approvals,approvals);
 assert.equal(c.casters.length,1);assert.equal(c.casters[0].level,6);
 assert.throws(()=>previewGestaltLevel(c,{...selection,approvals:[]}),/named GM approval/,'each combination-class pair needs its own approval');
});

test('two prestige classes remain prohibited and ordinary existing prestige continuation does not recheck entry',()=>{
 const c=paired([...repeat('wizard','fighter',10),['fighter','loremaster'],['wizard','archmage']]);c.experience=1000000;
 const before=structuredClone(c);assert.throws(()=>previewGestaltLevel(c,{left:'loremaster',right:'archmage',hitDieRoll:4}),/two prestige/);assert.deepEqual(c,before);
 const p=previewGestaltLevel(c,{left:'wizard',right:'loremaster',hitDieRoll:4});assert.equal(p.character.classLevels.find(e=>e.classId==='loremaster').level,2);
});

test('paired advancement respects LA, optional HP methods, variant dice and historical Intelligence',()=>{
 const c=paired(repeat('cleric','wizard',2));c.ancestry.levelAdjustment=2;c.ancestry.ignoreLevelAdjustment=false;c.experience=9999;
 assert.throws(()=>previewGestaltLevel(c,{left:'cleric',right:'wizard',hitDieRoll:5}),/XP/);c.experience=10000;
 configureAlternateFeature(c,'cleric-golarion-cleric',{reviewed:true});selectAlternateFeature(c,'cleric-golarion-cleric',true);recompute(c);
 c.scores.INT=18;const oldHistory=structuredClone(c.automation.history);
 const p=previewGestaltLevel(c,{left:'cleric',right:'wizard',hitDieRoll:10});assert.equal(p.summary.die,10);assert.equal(p.summary.hpGain,12);assert.equal(p.character.automation.history.at(-1).intScore,18);
 assert.deepEqual(p.character.automation.history.slice(0,2),oldHistory);
 for(const method of ['average','maximum']){c.automation.hpMethod=method;recompute(c);c.hp=c.maxHp-2;const other=previewGestaltLevel(c,{left:'wizard',right:'cleric'});applyReview(c,other);assert.equal(c.maxHp-c.hp,2);assert.equal(c.automation.hpMethod,method);c.experience=100000;}
});

test('prestige sneak-attack eligibility agrees with shared dice and alternate feature replacements',()=>{
 const c=paired(repeat('rogue','spellthief',2)),def=findClass('arcane-trickster');
 const sneak=d=>prestigeEligibility(d,def).requirements.find(r=>/sneak attack/i.test(r.label));
 assert.equal(sneak(c).state,'missing');c.advancementMode='standard';assert.equal(sneak(c).state,'met');
 const trickster=paired(repeat('spellthief','fighter',9));configureAlternateFeature(trickster,'spellthief-trickster',{reviewed:true});selectAlternateFeature(trickster,'spellthief-trickster',true);
 assert.equal(sneak(trickster).state,'missing');trickster.advancementMode='standard';assert.equal(sneak(trickster).state,'missing');
});

test('shared sneak attack follows the faster progression, never the largest rounded grant',()=>{
 for(let level=1;level<=20;level++){
  const c=paired(repeat('rogue','spellthief',level));
  assert.equal(resourceNumbers(c).sneakDice,Math.ceil(level/2));
  c.advancementMode='standard';assert.equal(resourceNumbers(c).sneakDice,Math.ceil(level/2)+Math.ceil(level/4));
 }
 const staggered=paired([...repeat('rogue','fighter',5),...repeat('rogue','assassin',10)]);
 assert.equal(resourceNumbers(staggered).sneakDice,8,'offset assassin grants cannot fill the continuing rogue progression gaps');
 const ledger=gestaltFeatureLedger(staggered,sneakAttackProgressions(staggered));
 assert.ok(ledger.every(row=>row.classId==='rogue'));assert.equal(ledger[5].grant,0);
});

test('sneak attack retains nonoverlapping prestige grants and is independent of side and bonus method',()=>{
 const together=paired([...repeat('rogue','wizard',5),...repeat('rogue','arcane-trickster',5)]);
 assert.equal(resourceNumbers(together).sneakDice,5);
 const separate=paired([...repeat('rogue','wizard',5),...repeat('wizard','arcane-trickster',2)]);
 assert.equal(resourceNumbers(separate).sneakDice,4);
 const original=gestaltFeatureLedger(separate,sneakAttackProgressions(separate));
 for(const pair of separate.gestaltProgression.levels)[pair.left,pair.right]=[pair.right,pair.left];
 separate.gestaltProgression.bonusMethod='fractional-v1';
 assert.deepEqual(gestaltFeatureLedger(separate,sneakAttackProgressions(separate)),original);
 const before=structuredClone(separate);resourceNumbers(separate);assert.deepEqual(separate,before);
});

test('all existing sneak sources retain their individual progression and conditional psionic focus',()=>{
 const formulas={rogue:n=>Math.ceil(n/2),assassin:n=>Math.ceil(n/2),'arcane-trickster':n=>Math.floor(n/2),blackguard:n=>Math.floor(Math.max(0,n-1)/3),'psychic-rogue':n=>Math.ceil(n/3),spellthief:n=>Math.ceil(n/4),lurk:n=>n<2?0:1+Math.floor((n-2)/5)};
 for(const [id,formula] of Object.entries(formulas))for(let n=1;n<=Math.min(20,findClass(id).levels.length);n++){
  const c=paired(repeat(id,'fighter',n));
  if(id==='lurk'){const p=makePsionic(findClass('lurk'),n,14);p.focused=true;c.psionics.push(p);}
  assert.equal(resourceNumbers(c).sneakDice,formula(n),id+' '+n);
  c.advancementMode='standard';assert.equal(resourceNumbers(c).sneakDice,formula(n),'standard '+id+' '+n);
 }
 const c=paired(repeat('spellthief','lurk',7)),p=makePsionic(findClass('lurk'),7,14);p.focused=true;c.psionics.push(p);
 assert.equal(resourceNumbers(c).sneakDice,2);p.focused=false;assert.equal(resourceNumbers(c).sneakDice,2);
 const lurk=paired(repeat('lurk','fighter',7));lurk.psionics.push(p);assert.equal(resourceNumbers(lurk).sneakDice,0);p.focused=true;assert.equal(resourceNumbers(lurk).sneakDice,2);
});

test('spellthief alternate features change only their own earned sneak grants',()=>{
 const c=paired([...repeat('spellthief','fighter',4),...repeat('spellthief','rogue',5)]);
 configureAlternateFeature(c,'spellthief-cursed-blow',{reviewed:true});selectAlternateFeature(c,'spellthief-cursed-blow',true);recompute(c);
 const ledger=gestaltFeatureLedger(c,sneakAttackProgressions(c));
 assert.equal(ledger[0].grant,1,'the sacrificed fifth-level die must not erase the first-level grant');assert.equal(resourceNumbers(c).sneakDice,4);
 const only=paired(repeat('spellthief','fighter',9));configureAlternateFeature(only,'spellthief-cursed-blow',{reviewed:true});selectAlternateFeature(only,'spellthief-cursed-blow',true);
 assert.deepEqual(gestaltFeatureLedger(only,sneakAttackProgressions(only)).map(row=>row.grant),[1,0,0,0,0,0,0,0,1]);
 const trickster=paired(repeat('spellthief','fighter',9));configureAlternateFeature(trickster,'spellthief-trickster',{reviewed:true});selectAlternateFeature(trickster,'spellthief-trickster',true);
 assert.equal(resourceNumbers(trickster).sneakDice,1);
});

test('combat precision uses shared dice, retains distinct abilities and never multiplies precision on a critical',()=>{
 const c=paired(repeat('rogue','spellthief',6)),w={...newWeapon(),name:'Test blade',damage:'1d4',damageAbility:'none',criticalMultiplier:2};
 c.automation.context.sneakAttack=true;assert.equal(weaponDamage(c,w),'1d4+3d6');assert.equal(weaponDamage(c,w,true),'2d4+3d6');
 configureAlternateFeature(c,'rogue-deaths-ruin',{reviewed:true});selectAlternateFeature(c,'rogue-deaths-ruin',true);recompute(c);
 c.automation.context.targetType='undead';c.automation.context.deathsRuin=true;
 assert.equal(weaponDamage(c,w),'1d4+1d6');assert.equal(weaponDamage(c,w,true),'2d4+1d6');
 const ninja=paired(repeat('rogue','ninja',6));ninja.automation.context.sneakAttack=true;ninja.automation.context.targetFlatFooted=true;
 assert.equal(weaponDamage(ninja,w),'1d4+3d6+3d6');
 const scout=paired(repeat('rogue','scout',6));scout.automation.context.sneakAttack=true;scout.automation.context.skirmish=true;scout.automation.context.ownTurn=true;
 assert.equal(weaponDamage(scout,w),'1d4+3d6+2d6');
});

test('shared feature extension policies reject negative or fractional grants without modifying sheets',()=>{
 const c=paired(repeat('rogue','fighter',3)),before=structuredClone(c);
 for(const policy of [{rate:-1,cumulative:n=>n},{rate:1,cumulative:n=>n/2},{rate:1,cumulative:n=>3-n}])
  assert.throws(()=>gestaltFeatureLedger(c,{rogue:policy}),/explicit nonnegative progression/);
 assert.deepEqual(c,before);
});

test('cleric and paladin turning overlap once at every gestalt level; ordinary multiclass still stacks',()=>{
 for(let level=1;level<=20;level++){
  const c=paired(repeat('cleric','paladin',level));
  assert.equal(turningClassLevel(c),level);assert.equal(resourceNumbers(c).turnDamage,level);
  const cards=c.features.filter(f=>f.ruleId==='daily:Turn or rebuke undead');
  assert.equal(cards.length,1);assert.equal(cards[0].max,3);assert.equal(cards[0].description,'Effective turning level '+level+'.');
  c.advancementMode='standard';assert.equal(turningClassLevel(c),level+Math.max(0,level-3));
 }
});

test('turning keeps delayed access and nonoverlapping class advances on either side',()=>{
 const early=paired(repeat('paladin','fighter',3));assert.equal(turningClassLevel(early),0);assert.equal(hasTurningAbility(early),false);
 const simultaneous=paired([...repeat('paladin','fighter',3),['cleric','paladin']]);assert.equal(turningClassLevel(simultaneous),1);
 const separate=paired([...repeat('cleric','fighter',4),...repeat('paladin','fighter',4)]);assert.equal(turningClassLevel(separate),5);
 for(const pair of separate.gestaltProgression.levels)[pair.left,pair.right]=[pair.right,pair.left];
 recompute(separate);assert.equal(turningClassLevel(separate),5);
});

test('turning feat bonuses, replaced abilities and spent uses survive recomputation and reload',async()=>{
 const c=paired(repeat('cleric','paladin',6));
 setSkillPoints(c,skillLedger(c).levels[0].key,c.skills.find(s=>s.name==='Knowledge (arcana)').id,2);
 for(const name of ['Improved Turning','Extra Turning'])c.features.push({id:name,name,kind:'Feat',description:'Player choice',source:'',max:0,used:0});
 recompute(c);assert.equal(resourceNumbers(c).turnLevel,7);assert.equal(resourceNumbers(c).turnDamage,7);
 const card=()=>c.features.find(f=>f.ruleId==='daily:Turn or rebuke undead');assert.equal(card().max,7);card().used=4;
 configureAlternateFeature(c,'cleric-divine-counterspell',{reviewed:true});selectAlternateFeature(c,'cleric-divine-counterspell',true);recompute(c);
 assert.equal(turningClassLevel(c),3);assert.equal(resourceNumbers(c).turnLevel,4);assert.equal(card().used,4);
 configureAlternateFeature(c,'paladin-divine-counterspell',{reviewed:true});selectAlternateFeature(c,'paladin-divine-counterspell',true);recompute(c);
 assert.equal(turningClassLevel(c),0);assert.equal(hasTurningAbility(c),false);assert.equal(card(),undefined);
 selectAlternateFeature(c,'cleric-divine-counterspell',false);recompute(c);assert.equal(turningClassLevel(c),6);assert.equal(card().used,4);
 selectAlternateFeature(c,'paladin-divine-counterspell',false);recompute(c);assert.equal(turningClassLevel(c),6);assert.equal(card().used,4);
 const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
 assert.equal(resourceNumbers(loaded).turnLevel,7);assert.equal(loaded.features.find(f=>f.ruleId==='daily:Turn or rebuke undead').used,4);
});

test('simultaneous monk and Psionic Fist levels advance shared monk abilities only once',()=>{
 const c=paired([...repeat('monk','fighter',6),...repeat('monk','psionic-fist',4)]);
 assert.equal(resourceNumbers(c).monkLevel,10);
 assert.equal(weaponDice(c,unarmed()),'1d10');
 assert.equal(movement(c).speed,60);
 assert.equal(sheetTotals(c).ac,15,'10 + Dex 1 + Wisdom 2 + monk AC 2');
 c.automation.context.flurry=true;
 assert.equal(attackRoutine(c,unarmed()).filter(a=>a.label==='Greater flurry').length,0,'Psionic Fist does not advance flurry');
 assert.equal(c.features.find(f=>f.ruleId==='daily:Wholeness of body — healing points').max,20);
});

test('separate monk and Psionic Fist advances accumulate regardless of side changes',()=>{
 const c=paired([...repeat('fighter','monk',6),['monk','psionic-fist'],['psionic-fist','fighter'],['fighter','psionic-fist']]);
 assert.equal(resourceNumbers(c).monkLevel,9);
 assert.equal(weaponDice(c,unarmed()),'1d10');assert.equal(movement(c).speed,60);assert.equal(sheetTotals(c).ac,14);
 const swapped=structuredClone(c);
 for(const pair of swapped.gestaltProgression.levels)[pair.left,pair.right]=[pair.right,pair.left];
 recompute(swapped);assert.equal(resourceNumbers(swapped).monkLevel,9);assert.equal(movement(swapped).speed,60);
});

test('ordinary multiclass monk abilities still stack and an inactive paired plan does not change them',()=>{
 const c=paired([...repeat('monk','fighter',6),...repeat('monk','psionic-fist',4)]);
 c.advancementMode='standard';
 assert.equal(resourceNumbers(c).monkLevel,14);assert.equal(weaponDice(c,unarmed()),'2d6');assert.equal(movement(c).speed,70);
 c.automation.enabled=false;const w=unarmed();w.damage='3d6';assert.equal(weaponDice(c,w),'3d6');
});

test('every Psionic Fist level respects shared progression without granting other monk powers',()=>{
 for(let n=1;n<=10;n++){
  const c=paired([...repeat('monk','fighter',6),...repeat('psionic-fist','monk',n)]),level=6+n;
  assert.equal(resourceNumbers(c).monkLevel,level);
  assert.equal(weaponDice(c,unarmed()),level<8?'1d8':level<12?'1d10':level<16?'2d6':'2d8');
  assert.equal(sheetTotals(c).ac,13+Math.floor(level/5));assert.equal(movement(c).speed,30+10*Math.floor(level/3));
  c.automation.context.flurry=true;
  assert.equal(attackRoutine(c,unarmed()).filter(a=>a.label==='Greater flurry').length,level>=11?1:0);
 }
});

test('alternate movement, armor restrictions and recorded unarmed dice retain their existing meaning',()=>{
 const c=paired([...repeat('monk','fighter',6),...repeat('monk','psionic-fist',4)]);
 const w=unarmed();w.damage='3d6';w.diceSize='Medium';w.useRecordedDice=true;assert.equal(weaponDice(c,w),'3d6');
 configureAlternateFeature(c,'monk-standing-jump',{reviewed:true});selectAlternateFeature(c,'monk-standing-jump',true);recompute(c);
 assert.equal(monkAbilityLevel(c),10);assert.equal(monkAbilityLevel(c,'fast-movement'),4,'replaced monk movement cannot reappear');
 assert.equal(movement(c).speed,30,'Standing Jump uses its existing alternate speed schedule');
 selectAlternateFeature(c,'monk-standing-jump',false);recompute(c);
 addEquipment(c,matchEquipment('Studded leather','armor'));recompute(c);
 assert.equal(movement(c).free,false);assert.equal(movement(c).speed,30);assert.equal(sheetTotals(c).ac,14,'armor 3 + Dex 1, no monk AC');
 assert.equal(weaponDice(c,unarmed()),'1d10','armor does not remove unarmed damage progression');
});

test('shared monk recalculation preserves injury, spent healing and historical purchases through reload',async()=>{
 const c=paired([...repeat('monk','fighter',6),...repeat('monk','psionic-fist',4)]);
 c.hp-=7;c.features.find(f=>f.ruleId==='daily:Wholeness of body — healing points').used=5;
 const ledger=skillLedger(c),skill=c.skills.find(s=>s.name==='Tumble');setSkillPoints(c,ledger.levels[0].key,skill.id,4);
 const history=structuredClone(c.automation.history),before=structuredClone(c);
 recompute(c,before);const loaded=await prepareCharacter(characterSchema.parse(JSON.parse(JSON.stringify(c))));
 assert.equal(loaded.maxHp-loaded.hp,7);assert.equal(loaded.features.find(f=>f.ruleId==='daily:Wholeness of body — healing points').used,5);
 assert.deepEqual(loaded.automation.history,history);assert.equal(resourceNumbers(loaded).monkLevel,10);
 assert.equal(loaded.skills.find(s=>s.id===skill.id).ranks,4);
});

test('full sheet uses five actual levels for Fighter 5 // Wizard 5, while keeping each class at five',()=>{
 const c=paired(repeat('fighter','wizard',5)),n=advancementNumbers(c);
 assert.deepEqual(classTotals(c.classLevels,c.ancestry,c),{level:5,bab:5,fort:4,ref:1,will:4,hitDice:'5d10',missing:[]});
 assert.equal(c.level,5);assert.equal(c.bab,5);assert.equal(c.maxHp,36);assert.equal(c.hitDice,'5d10');
 assert.equal(n.skillBudget,32);assert.equal(n.classMax,8);assert.equal(n.crossMax,4);assert.equal(n.nextXp,15000);assert.equal(n.feats,3);assert.equal(n.abilityIncreases,1);
 assert.equal(n.fighterFeats,3);assert.equal(n.wizardFeats,1);assert.equal(c.casters[0].level,5);
 assert.equal(c.automation.history.length,5);assert.equal(hitDieSequence(c).length,5);
 assert.equal(advancementChoices(c).filter(r=>r.key.startsWith('general-')).length,2);assert.equal(advancementChoices(c).filter(r=>r.kind==='ability').length,1);
 assert.deepEqual(c.classLevels.map(e=>e.level),[5,5]);assert.equal(c.features.filter(f=>f.id.startsWith('class-summary-')).length,2);
 assert.deepEqual(characterSchema.parse(JSON.parse(JSON.stringify(c))),c);
});

test('Ranger // Rogue uses both class skill lists and one historical skill allowance per actual level',()=>{
 const c=paired(repeat('ranger','rogue',3)),survival=c.skills.find(s=>s.name==='Survival'),disable=c.skills.find(s=>s.name==='Disable Device'),spellcraft=c.skills.find(s=>s.name==='Spellcraft');
 let ledger=skillLedger(c);assert.equal(ledger.granted,60);assert.equal(ledger.levels[0].costs[survival.id],1);assert.equal(ledger.levels[0].costs[disable.id],1);assert.equal(ledger.levels[0].costs[spellcraft.id],2);
 assert.equal(survival.classSkill,true);assert.equal(disable.classSkill,true);
 setSkillPoints(c,ledger.levels[0].key,survival.id,4);setSkillPoints(c,ledger.levels[0].key,disable.id,4);
 setSkillPoints(c,ledger.levels[1].key,survival.id,1);setSkillPoints(c,ledger.levels[2].key,survival.id,1);
 const before=structuredClone(c);c.scores.INT=18;recompute(c,before);ledger=skillLedger(c);
 assert.equal(ledger.granted,60);assert.equal(survival.ranks,6);assert.equal(disable.ranks,4);assert.equal(ledger.levels[2].limits[survival.id],6);assert.equal(ledger.levels[2].limits[spellcraft.id],3);
 assert.deepEqual(c.automation.history,before.automation.history);
});

test('native files, browser reload and the real prepare path retain paired levels, injuries, ranks and spent casting',async()=>{
 const c=paired(repeat('wizard','cleric',5));c.hp-=7;c.tempHp=2;c.factotum.spent=1;c.casters[0].slots[1].used=1;c.casters[1].slots[1].used=2;
 const skill=c.skills.find(s=>s.name==='Concentration');setSkillPoints(c,c.automation.history[0].key,skill.id,3);
 c.advancementChoices['ability-1']='WIS';c.features.push({id:'personal',name:'Personal tracker',kind:'Other',description:'Keep me',max:3,used:2,source:''});
 const imported=parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}));assert.deepEqual(imported,c);
 assert.deepEqual(await prepareCharacter(imported),c);
 const values=new Map(),options={scope:'/gestalt-qa/',storage:()=>({getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}),lock:async(name,work)=>work(),id:()=> 'paired-save',now:()=> '2026-10-26T00:00:00Z'};
 const api=createBrowserCharacterApi(options),row=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})});
 const loaded=await createBrowserCharacterApi(options)('/api/characters/'+row.id);assert.deepEqual(loaded.data,c);
 const again=await prepareCharacter(characterSchema.parse(loaded.data));assert.deepEqual(again,c);assert.deepEqual(again.casters.map(p=>p.level),[5,5]);
});

test('old saves remain standard, including manual gestalt-like notes and old homebrew settings',async()=>{
 const c=standard();c.automation.hpMethod='maximum';c.automation.encumbrance=false;c.notes='Gestalt Fighter // Wizard (manual campaign note)';c.hp-=3;
 delete c.advancementMode;const expected=structuredClone(c),loaded=characterSchema.parse(c);
 assert.equal(loaded.advancementMode,'standard');assert.equal(loaded.gestaltProgression,undefined);
 const prepared=await prepareCharacter(loaded);assert.equal(prepared.automation.hpMethod,'maximum');assert.equal(prepared.automation.encumbrance,false);assert.equal(prepared.maxHp-prepared.hp,3);assert.equal(prepared.notes,expected.notes);assert.deepEqual(c,expected);
});

test('invalid plans fail schema validation and recomputation before altering any character data',()=>{
 const c=paired(repeat('fighter','wizard',2));
 for(const change of [d=>delete d.gestaltProgression,d=>d.gestaltProgression.levels.pop(),d=>d.gestaltProgression.levels[0].right='missing',d=>d.classLevels[0].level++,d=>d.ancestry.racialHitDice=1,d=>d.gestaltProgression.bonusMethod='future-method']){
  const broken=structuredClone(c);change(broken);const before=structuredClone(broken);
  assert.equal(characterSchema.safeParse(broken).success,false);assert.throws(()=>recompute(broken));assert.deepEqual(broken,before);
 }
});

test('mode changes and old single-class editing paths cannot silently discard paired history',()=>{
 const c=paired(repeat('fighter','wizard',2));c.experience=30000;const before=structuredClone(c);
 assert.throws(()=>gainLevel(c,'fighter',4),/pair/);assert.throws(()=>moveSkillLevel(c,c.automation.history[0].key,1),/Paired/);assert.deepEqual(c,before);
 const switched=structuredClone(c);switched.advancementMode='standard';const changed=structuredClone(switched);assert.throws(()=>recompute(switched,c),/reviewed progression conversion/);assert.deepEqual(switched,changed);
 const previous=standard();assert.throws(()=>recompute(c,previous),/reviewed progression conversion/);assert.deepEqual(c,before);
});

test('actual HD, racial scaling, initiator limits and essentia capacity never add both sides',()=>{
 const c=paired(repeat('warblade','wizard',5));assert.equal(characterHitDice(c),5);assert.equal(racialHD(c),5);assert.equal(systemLimits(c,'warblade').initiator,5);
 c.ancestry.levelAdjustment=2;assert.equal(advancementNumbers(c).ecl,7);assert.equal(advancementNumbers(c).nextXp,28000);assert.equal(characterHitDice(c),5);
 const incarnate=paired(repeat('incarnate','fighter',5));assert.equal(systemLimits(incarnate,'incarnate').capacity,1);
 const drow=paired(repeat('fighter','wizard',5));drow.ancestry.raceId='drow';drow.ancestry.traitBonuses=true;recompute(drow);assert.equal(drow.defense.sr,16);
});

test('manual base statistics do not turn paired class levels into extra character levels',()=>{
 const c=paired(repeat('fighter','wizard',3));c.automation.enabled=false;c.level=6;c.bab=9;c.maxHp=99;c.hp=77;
 recompute(c);assert.equal(c.level,3);assert.equal(c.bab,9);assert.equal(c.maxHp,99);assert.equal(c.hp,77);assert.equal(advancementNumbers(c).hd,3);
});

test('prestige advancement of the same spellcasting tradition is granted once per pair',()=>{
 const simultaneous=paired([...repeat('wizard','fighter',5),['wizard','loremaster']]);
 assert.equal(casterProgression(simultaneous,simultaneous.casters[0]).progression,6);assert.equal(simultaneous.casters[0].level,6);
 const separate=paired([...repeat('wizard','fighter',5),['fighter','loremaster']]);assert.equal(separate.casters[0].level,6);
 const dual=paired([...repeat('wizard','cleric',5),['wizard','mystic-theurge']]);
 const wizard=dual.casters.find(p=>p.casting.classId==='wizard'),cleric=dual.casters.find(p=>p.casting.classId==='cleric');
 assert.equal(wizard.level,6);assert.equal(cleric.level,6);
 const domain=makeCaster(findClass('cleric'),5,14);domain.id='domain';domain.name='Domains';domain.casting.domain=true;dual.casters.push(domain);wizard.slots[1].used=1;cleric.slots[1].used=2;domain.slots[1].used=1;
 const previous=structuredClone(dual);recompute(dual,previous);assert.equal(domain.level,6);assert.equal(domain.slots[1].max,1);assert.deepEqual(dual.casters.map(p=>p.slots[1].used),[1,2,1]);
 wizard.casting.progression=8;recompute(dual);assert.equal(wizard.level,8,'explicit custom progression overrides remain independent');assert.equal(cleric.level,6);
});

test('Cerebremancer keeps independent spell and psionic traditions without double advancing either',()=>{
 for(const advancing of ['wizard','psion']){
  const c=paired([...repeat('wizard','psion',5),[advancing,'cerebremancer']]);
  const psychic=makePsionic(findClass('psion'),5,16);psychic.spent=3;c.psionics.push(psychic);recompute(c);
  assert.equal(c.casters[0].level,6);assert.equal(psionicProgression(c,psychic).progression,6);assert.equal(psychic.level,6);assert.equal(psychic.spent,3);
  psychic.manifesting.progression=8;recompute(c);assert.equal(psychic.level,8);assert.equal(c.casters[0].level,6);assert.equal(psychic.spent,3);
 }
});

test('Hierophant caster-level-only advancement never adds slots or duplicates simultaneous caster-level gains',()=>{
 const simultaneous=paired([...repeat('cleric','wizard',13),['cleric','hierophant']]);
 const cleric=simultaneous.casters.find(p=>p.casting.classId==='cleric');assert.equal(casterProgression(simultaneous,cleric).progression,14);assert.equal(cleric.level,14);
 const separate=paired([...repeat('cleric','wizard',13),['wizard','hierophant']]);
 const other=separate.casters.find(p=>p.casting.classId==='cleric');assert.equal(casterProgression(separate,other).progression,13);assert.equal(other.level,14);
 assert.equal(other.slots[7].max,makeCaster(findClass('cleric'),13,14).slots[7].max);
 const half=paired([...repeat('ranger','wizard',14),['ranger','hierophant']]);
 const ranger=half.casters.find(p=>p.casting.classId==='ranger');
 assert.equal(casterProgression(half,ranger).progression,15);assert.equal(ranger.level,8,'CL-only grant survives a half-caster level that does not itself increase CL');
});
