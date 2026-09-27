import test from 'node:test';
import assert from 'node:assert/strict';
import data from '../lib/alternate-feature-data.json' with {type:'json'};
import coverage from '../scripts/data/alternate-feature-coverage.json' with {type:'json'};
import {newCharacter,characterSchema,newWeapon,uid} from '../lib/model.ts';
import {findClass} from '../lib/classes.ts';
import {activateAutomation,recompute} from '../lib/automation.ts';
import {alternateFeatureCatalog,alternateFeatureById,alternateFeaturesSchema} from '../lib/alternate-feature-schema.ts';
import {selectAlternateFeature,configureAlternateFeature,alternateSettings,alternateResources,spendAlternateResource,alternateResourceUsed,featureReplaced} from '../lib/alternate-features.ts';
import {advancementNumbers,castingNumbers} from '../lib/advancement.ts';
import {resetDaily,weaponDamage,weaponAttack,attackRoutine,castingProblem} from '../lib/rules.ts';
import {effectBonus,addEffect} from '../lib/effects.ts';
import {effectiveScore} from '../lib/ancestry.ts';
import {movement,weaponProficient,armorProficient,equipmentCatalog} from '../lib/equipment.ts';
const create=(id='fighter',level=20)=>activateAutomation(newCharacter(findClass(id).name,level),false);
function configure(c,id,extra={}){const d=alternateFeatureById.get(id);if(d.skill){const s=c.skills.find(s=>s.name===d.skill.name);s.ranks=d.skill.ranks;c.automation.skillTraining.unassigned[s.id]=s.ranks;}configureAlternateFeature(c,id,{reviewed:true,choice:d.choices?.[0]||(d.choiceRequired?'Recorded source choice':''),...(d.levels?{level:d.levels[0]}:{}),...extra});}
const choose=(c,id,extra={})=>{configure(c,id,extra);selectAlternateFeature(c,id,true);recompute(c);};
const remove=(c,id)=>{selectAlternateFeature(c,id,false);recompute(c);};

test('all 322 indexed entries on 66 base-class pages have explicit source coverage',()=>{
 assert.equal(data.length,322);assert.equal(coverage.length,66);assert.equal(coverage.reduce((sum,p)=>sum+p.alternatives,0),322);
 assert.equal(new Set(alternateFeatureCatalog.map(d=>d.id)).size,alternateFeatureCatalog.length);
 for(const d of data){assert.ok(findClass(d.classId),d.id);assert.match(d.source,/^https:\/\/srd\.dndtools\.org\/srd\/classes\/.*#/);assert.ok(d.level>=1&&d.level<=20,d.id);assert.ok(alternateFeatureCatalog.some(option=>option.catalogId===d.id),d.id);}
});
test('every selectable feature survives selection, recomputation and JSON persistence',()=>{
 for(const d of alternateFeatureCatalog.filter(d=>d.kind!=='reference')){
  const c=create(d.classId);choose(c,d.id);
  const saved=characterSchema.parse(JSON.parse(JSON.stringify(c)));assert.deepEqual(saved,c,d.id+' lost data');
  recompute(c);recompute(c);assert.deepEqual(c,saved,d.id+' changed after recalculation');
 }
});
test('fighter trades reserve exact feat slots; invalid edits are atomic',()=>{
 const c=create();assert.equal(advancementNumbers(c).fighterFeats,11);choose(c,'fighter-dungeon-crasher');assert.equal(advancementNumbers(c).fighterFeats,9);
 configure(c,'fighter-elusive-attack');assert.throws(()=>selectAlternateFeature(c,'fighter-elusive-attack',true),/Conflicts/);
 choose(c,'fighter-aligned-strike',{level:4});assert.equal(advancementNumbers(c).fighterFeats,8);
 assert.throws(()=>configureAlternateFeature(c,'fighter-aligned-strike',{level:6}),/Conflicts/);assert.equal(alternateSettings(c,'fighter-aligned-strike').level,4);
 remove(c,'fighter-dungeon-crasher');assert.equal(advancementNumbers(c).fighterFeats,10);
});
test('imports reject duplicate, overlapping, and malformed choices',()=>{
 for(const state of [{selected:['fighter-dungeon-crasher','fighter-aligned-strike'],settings:{'fighter-aligned-strike':{level:6}}},{selected:['cleric-golarion-cleric','cleric-divine-magician'],settings:{'cleric-divine-magician':{choice:'1'}}},{selected:['fighter-aligned-strike'],settings:{'fighter-aligned-strike':{level:3}}},{selected:['druid-animal-companions']}])assert.equal(alternateFeaturesSchema.safeParse(state).success,false);
});
test('warmage learning trades may be selected independently at several levels',()=>{
 const c=create('warmage');choose(c,'warmage-eclectic-learning-level-3');choose(c,'warmage-eclectic-learning-level-11');
 assert.equal(featureReplaced(c,'warmage','advanced-learning',3),true);assert.equal(featureReplaced(c,'warmage','advanced-learning',6),false);assert.equal(featureReplaced(c,'warmage','advanced-learning',11),true);
});
test('lost casting cannot be restored by slot adjustments or manual profiles',()=>{
 const c=create('paladin',12),p=c.casters[0];assert.ok(p);p.slots[1].used=1;p.casting.slotAdjustments[1]=5;
 choose(c,'paladin-holy-warrior');assert.ok(castingNumbers(c,p).slots.every(n=>n===0));assert.equal(p.slots[1].used,1);
 p.casting.automatic=false;p.slots[1].max=10;assert.match(castingProblem(p,{level:1,slotLevel:1,prepared:1,spent:0},c),/traded away/);
 remove(c,'paladin-holy-warrior');assert.ok(castingNumbers(c,p).slots[1]>0);
});
test('whirling frenzy preserves rage expenditure without retaining Constitution bonuses',()=>{
 const c=create('barbarian',12);c.features.find(f=>f.ruleId==='daily:Rage').used=2;const hp=c.maxHp,con=effectiveScore(c,'CON');
 choose(c,'barbarian-whirling-frenzy');addEffect(c,'rage');c.effects.find(e=>e.preset==='rage').active=true;recompute(c);
 assert.equal(c.maxHp,hp);assert.equal(effectiveScore(c,'CON'),con);assert.equal(alternateResourceUsed(c,'retained:daily:Rage'),2);
 const w=newWeapon();const before=attackRoutine(c,w).length;configureAlternateFeature(c,'barbarian-whirling-frenzy',{active:true});assert.equal(attackRoutine(c,w).length,before+1);assert.equal(effectBonus(c,'attack'),-2);
 remove(c,'barbarian-whirling-frenzy');assert.equal(c.features.find(f=>f.ruleId==='daily:Rage').used,2);
});
test('lost movement and flurry affect calculations while other classes retain their own benefits',()=>{
 const c=create('barbarian',12),before=movement(c).speed;choose(c,'barbarian-spiritual-totem',{choice:'Lion'});assert.equal(movement(c).speed,before-10);
 const m=create('monk',12),w={...newWeapon(),name:'Unarmed strike'};m.automation.context.flurry=true;const n=attackRoutine(m,w).length;choose(m,'monk-decisive-strike');assert.equal(attackRoutine(m,w).length,n-2);
});
test('regional weapons and class armor losses respect other training and explicit feats',()=>{
 const c=create('druid',12),club=equipmentCatalog.find(e=>e.name==='Club'),whip=equipmentCatalog.find(e=>e.name==='Whip');
 const weapon=e=>({...newWeapon(),name:e.name,catalogId:e.id,proficiency:'auto'});choose(c,'druid-weapon-proficiencies',{choice:'Desert'});
 assert.equal(weaponProficient(c,weapon(club)),false);assert.equal(weaponProficient(c,weapon(whip)),true);
 c.classLevels.push({id:uid(),classId:'fighter',name:'Fighter',level:1,notes:''});recompute(c);assert.equal(weaponProficient(c,weapon(club)),true);
 const f=create('fighter'),plate=equipmentCatalog.find(e=>e.name==='Full plate');choose(f,'fighter-drow-fighter');assert.equal(armorProficient(f,plate),false);
 f.classLevels.push({id:uid(),classId:'paladin',name:'Paladin',level:1,notes:''});assert.equal(armorProficient(f,plate),false);
 f.features.push({id:uid(),name:'Armor Proficiency (heavy)',kind:'Feat',max:0,used:0,description:'',source:''});assert.equal(armorProficient(f,plate),true);
});
test('smiting arrow applies only within 30 feet',()=>{
 const c=create('paladin',8),w={...newWeapon(),name:'Test bow',attackMode:'ranged',range:'60 ft.',damage:'1d8',damageAbility:'none',proficiency:'yes'};choose(c,'paladin-smiting-arrow');c.automation.context.targetType='evil';c.automation.context.smite=true;c.automation.context.distance=30;
 assert.equal(weaponDamage(c,w),'1d8+8');c.automation.context.distance=31;assert.equal(weaponDamage(c,w),'1d8');const attack=weaponAttack(c,w);c.automation.context.smite=false;assert.equal(weaponAttack(c,w),attack);
});
test('underground bonuses require their context toggle',()=>{
 const c=create('paladin',10),speed=movement(c).speed;choose(c,'paladin-underdark-knight');assert.equal(movement(c).speed,speed);configureAlternateFeature(c,'paladin-underdark-knight',{active:true});assert.equal(movement(c).speed,speed+10);assert.equal(effectBonus(c,'skill.Climb'),2);
});
test('stalwart sorcerer restores HP and spells known on removal',()=>{
 const c=create('sorcerer',5),hp=c.maxHp,known=castingNumbers(c,c.casters[0]).known;choose(c,'sorcerer-stalwart-sorcerer');assert.equal(c.maxHp,hp+10);assert.equal(castingNumbers(c,c.casters[0]).known[2],known[2]-1);remove(c,'sorcerer-stalwart-sorcerer');assert.equal(c.maxHp,hp);assert.deepEqual(castingNumbers(c,c.casters[0]).known,known);
});
test('rest resets only daily custom trackers and reselection preserves notes and expenditure',()=>{
 const c=create('fighter');choose(c,'fighter-dungeon-crasher');configureAlternateFeature(c,'fighter-dungeon-crasher',{notes:'DM approved',counters:['day','week','encounter'].map(period=>({id:period,name:period,max:3,used:0,period}))});
 for(const period of ['day','week','encounter'])spendAlternateResource(c,'custom:fighter-dungeon-crasher:'+period);
 Object.assign(c,resetDaily(c));assert.equal(alternateResourceUsed(c,'custom:fighter-dungeon-crasher:day'),0);assert.equal(alternateResourceUsed(c,'custom:fighter-dungeon-crasher:week'),1);assert.equal(alternateResourceUsed(c,'custom:fighter-dungeon-crasher:encounter'),1);
 remove(c,'fighter-dungeon-crasher');assert.equal(alternateResources(c).length,0);selectAlternateFeature(c,'fighter-dungeon-crasher',true);assert.equal(alternateSettings(c,'fighter-dungeon-crasher').notes,'DM approved');assert.equal(alternateResourceUsed(c,'custom:fighter-dungeon-crasher:week'),1);
});

test('trickster spellthief gains bard casting while losing only its own skill and sneak progression',()=>{
 const c=create('spellthief',8),p=c.casters[0],bard=create('bard',8);choose(c,'spellthief-trickster');
 assert.equal(castingNumbers(c,p).level,8);assert.deepEqual(castingNumbers(c,p).known,castingNumbers(bard,bard.casters[0]).known);
 for(const name of ['Bluff','Escape Artist','Move Silently'])assert.equal(c.skills.find(s=>s.name===name).classSkill,false,name);
 assert.equal(c.skills.find(s=>s.name==='Listen').classSkill,true);
 c.classLevels.push({id:uid(),classId:'rogue',name:'Rogue',level:1,notes:''});recompute(c);assert.equal(c.skills.find(s=>s.name==='Bluff').classSkill,true);
});

test('hit-and-run damage uses effective Dexterity and its target conditions',()=>{
 const c=create('fighter',6);choose(c,'fighter-drow-fighter');c.scores.DEX=14;c.automation.context.targetFlatFooted=true;c.automation.context.distance=30;addEffect(c,'ability-DEX');
 assert.equal(effectBonus(c,'damage'),4);c.automation.context.distance=31;assert.equal(effectBonus(c,'damage'),0);c.automation.context.distance=30;c.automation.context.targetFlatFooted=false;assert.equal(effectBonus(c,'damage'),0);
});
