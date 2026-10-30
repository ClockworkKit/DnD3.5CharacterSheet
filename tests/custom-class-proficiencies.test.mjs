import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlayerCharacter} from '../lib/character-creation.ts';
import {customClassDraft,customClassTable,previewCustomClassChange,applyCustomClassChange} from '../lib/custom-class-editor.ts';
import {customClassSchema} from '../lib/custom-class-schema.ts';
import {addEquipment,equipmentById,weaponProficient,armorProficient,equippedArmor} from '../lib/equipment.ts';
import {recompute} from '../lib/automation.ts';
import {weaponAttack} from '../lib/rules.ts';
import {gainLevel,previewGestaltLevel,applyGestaltLevel} from '../lib/level-up.ts';
import {prepareCharacter} from '../lib/roll20-skill-bonuses.ts';
import {parseCharacterFile} from '../lib/character-file.ts';
import {createBrowserCharacterApi} from '../lib/browser-character-store.ts';
import {featEligibility} from '../lib/prerequisites.ts';

const options={name:'Custom training QA',kind:'Wizard',level:2,raceId:'human',scores:{STR:14,DEX:14,CON:14,INT:16,WIS:12,CHA:10},method:'manual',hpMethod:'average'};
const empty=()=>({simple:false,martial:false,armor:'none',shields:'none',weapons:[]});
function profile(){const d=customClassDraft(createPlayerCharacter(options));d.definition.name='Synthetic guard';d.definition.source='Synthetic test source';d.definition.proficiencies=empty();return d;}
function create(d=profile(),paired=false){return createPlayerCharacter({...options,customClasses:[d],kind:d.definition.id,...(paired?{advancementMode:'gestalt',gestaltPairs:Array.from({length:2},()=>({left:d.definition.id,right:'wizard'}))}:{})});}
const weapon=(c,id)=>{addEquipment(c,equipmentById(id));return c.weapons.at(-1);};
const trained=(c,id)=>weaponProficient(c,weapon(c,id));

test('explicit saved custom proficiency metadata validates without granting anything by default',()=>{
 const d=profile();assert.equal(customClassSchema.safeParse(d).success,true);
 delete d.definition.proficiencies;assert.equal(Object.hasOwn(customClassSchema.parse(d).definition,'proficiencies'),false);
 const c=create(d);assert.equal(trained(c,'weapon-longbow'),false);assert.equal(armorProficient(c,equipmentById('armor-studded-leather')),false);
 for(const p of [{...empty(),armor:'all'},{...empty(),shields:'tower only'},{...empty(),weapons:['Invented catalog name']},{...empty(),armors:['Longsword']},{...empty(),simpleMeleeOnly:true},{...empty(),mediumAt:0},{...empty(),unrecognized:true}]){
  d.definition.proficiencies=p;assert.equal(customClassSchema.safeParse(d).success,false);
 }
});

test('custom weapon groups, individual exceptions and armor/shield scopes remain independent',()=>{
 const d=profile();d.definition.proficiencies={...empty(),simple:true,simpleMeleeOnly:true,martial:true,martialMeleeOnly:true,weapons:['Longbow'],armors:['Leather'],shields:'buckler'};
 const c=create(d);assert.equal(trained(c,'weapon-dagger'),true);assert.equal(trained(c,'weapon-crossbow-light'),false);assert.equal(trained(c,'weapon-longsword'),true);assert.equal(trained(c,'weapon-longbow'),true);assert.equal(trained(c,'weapon-shortbow'),false);
 assert.equal(armorProficient(c,equipmentById('armor-leather')),true);assert.equal(armorProficient(c,equipmentById('armor-studded-leather')),false);
 assert.equal(armorProficient(c,equipmentById('armor-buckler')),true);assert.equal(armorProficient(c,equipmentById('armor-shield-light-steel')),false);
 c.customClasses[0].definition.proficiencies.shields='standard';assert.equal(armorProficient(c,equipmentById('armor-shield-heavy-steel')),true);assert.equal(armorProficient(c,equipmentById('armor-shield-tower')),false);
 c.customClasses[0].definition.proficiencies.shields='all';assert.equal(armorProficient(c,equipmentById('armor-shield-tower')),true);
 c.customClasses[0].definition.proficiencies.armor='medium';assert.equal(armorProficient(c,equipmentById('armor-studded-leather')),true);assert.equal(armorProficient(c,equipmentById('armor-breastplate')),true);assert.equal(armorProficient(c,equipmentById('armor-full-plate')),false);
});

test('custom training changes real attack penalties but not skill ACP, spell failure or manual overrides',()=>{
 const d=profile(),c=create(d),w=weapon(c,'weapon-longsword');addEquipment(c,equipmentById('armor-studded-leather'));recompute(c);
 const before=weaponAttack(c,w),armor=equippedArmor(c);assert.equal(armor.nonproficient,-1);
 c.customClasses[0].definition.proficiencies={...empty(),martial:true,armor:'light'};recompute(c);
 assert.equal(weaponAttack(c,w)-before,5);assert.equal(equippedArmor(c).nonproficient,0);assert.equal(equippedArmor(c).checkPenalty,armor.checkPenalty);assert.equal(equippedArmor(c).spellFailure,armor.spellFailure);
 w.proficiency='no';assert.equal(weaponProficient(c,w),false);c.gear.find(g=>g.catalogId==='armor-studded-leather').proficient=false;assert.equal(equippedArmor(c).nonproficient,-1);
 w.proficiency='yes';c.customClasses[0].definition.proficiencies=empty();assert.equal(weaponProficient(c,w),true);
});

test('delayed medium armor uses actual custom class level on either gestalt side and standard advancement',()=>{
 for(const paired of [false,true]){
  const d=profile();d.definition.proficiencies={...empty(),armor:'light',mediumAt:3};const c=create(d,paired),id=d.definition.id;
  assert.equal(armorProficient(c,equipmentById('armor-breastplate')),false);c.experience=3000;c.hp-=2;const before=structuredClone(c);
  if(paired)applyGestaltLevel(c,previewGestaltLevel(c,{left:'wizard',right:id}));else gainLevel(c,id);
  recompute(c,before);assert.equal(armorProficient(c,equipmentById('armor-breastplate')),true);assert.equal(c.level,3);assert.equal(c.maxHp-c.hp,2);
  assert.equal(trained(c,'weapon-longbow'),false);
 }
});

test('reviewed proficiency edits preserve equipment and resources through native and browser persistence',async()=>{
 const d=profile(),c=create(d,true);weapon(c,'weapon-longsword');addEquipment(c,equipmentById('armor-studded-leather'));c.hp-=2;c.casters[0].slots[1].used=1;recompute(c);
 const before=structuredClone(c),changed=structuredClone(d);changed.definition.proficiencies={...empty(),martial:true,armor:'light'};
 const review=previewCustomClassChange(c,d.definition.id,changed);assert.deepEqual(c,before);
 assert.match(review.summary.proficiencies.after,/all martial weapons/);assert.equal(review.summary.proficiencies.items.length,2);assert.ok(review.summary.proficiencies.items.every(item=>!item.before&&item.after));
 applyCustomClassChange(c,review);recompute(c,before);assert.deepEqual(c.gear,before.gear);assert.deepEqual(c.weapons,before.weapons);assert.deepEqual(c.automation.history,before.automation.history);assert.equal(c.casters[0].slots[1].used,1);assert.equal(c.maxHp-c.hp,2);
 assert.equal(weaponProficient(c,c.weapons[0]),true);assert.equal(equippedArmor(c).nonproficient,0);
 const persisted=JSON.parse(JSON.stringify(c));
 assert.deepEqual(await prepareCharacter(parseCharacterFile(JSON.stringify({format:'barrow-ledger-character',version:1,data:c}))),persisted);
 const values=new Map(),storage=()=>({getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}),lock=async(_name,fn)=>fn(),api=createBrowserCharacterApi({scope:'/custom-training/',storage,lock});
 const saved=await api('/api/characters',{method:'POST',body:JSON.stringify({data:c})}),fresh=createBrowserCharacterApi({scope:'/custom-training/',storage,lock});
 assert.deepEqual((await fresh('/api/characters/'+saved.id)).data,persisted);
});

test('unused custom tables and misleading class names confer no catalog or extra equipment training',()=>{
 const d=profile();d.definition.name='Fighter';d.definition.proficiencies={...empty(),martial:true,armor:'heavy',shields:'all'};
 const c=createPlayerCharacter({...options,customClasses:[d]});assert.equal(trained(c,'weapon-longbow'),false);assert.equal(armorProficient(c,equipmentById('armor-full-plate')),false);
 const custom=create(d);assert.equal(trained(custom,'weapon-longbow'),true);assert.equal(armorProficient(custom,equipmentById('armor-full-plate')),true);
 custom.customClasses[0].definition.proficiencies=empty();assert.equal(armorProficient(custom,equipmentById('armor-full-plate')),false);
 assert.deepEqual(customClassTable(d,10).definition.proficiencies,d.definition.proficiencies);
});

test('class training combines with the other gestalt class, feats and racial familiarity without duplicate benefits',()=>{
 const d=profile();d.definition.proficiencies={...empty(),martial:true,martialMeleeOnly:true};
 const dwarf=createPlayerCharacter({...options,kind:d.definition.id,raceId:'dwarf',customClasses:[d]});
 assert.equal(trained(dwarf,'weapon-waraxe-dwarven'),true);assert.equal(trained(dwarf,'weapon-urgrosh-dwarven'),true);assert.equal(trained(dwarf,'weapon-longbow'),false);
 const human=create(d);assert.equal(trained(human,'weapon-waraxe-dwarven'),false);
 const c=createPlayerCharacter({...options,customClasses:[d],advancementMode:'gestalt',gestaltPairs:[{left:d.definition.id,right:'fighter'},{left:'fighter',right:d.definition.id}]});
 assert.equal(trained(c,'weapon-longbow'),true);assert.equal(armorProficient(c,equipmentById('armor-full-plate')),true);
 const bow=c.weapons.at(-1),attack=weaponAttack(c,bow);c.customClasses[0].definition.proficiencies.martialMeleeOnly=false;assert.equal(weaponAttack(c,bow),attack);
 const f={id:'test-focus',name:'Weapon Focus',description:'',source:'Synthetic test',prerequisites:'Proficiency with selected weapon, base attack bonus +1.'};
 assert.equal(featEligibility(human,f,'Longsword').eligible,true);assert.equal(featEligibility(human,f,'Longbow').eligible,false);
 human.features.push({id:'bow-feat',name:'Martial Weapon Proficiency',choice:'Longbow',kind:'Feat',description:'Chosen feat',source:'',max:0,used:0});assert.equal(trained(human,'weapon-longbow'),true);
});

test('proficiency removal is previewed, preserves explicit item overrides and rejects stale or malformed reviews',()=>{
 const d=profile();d.definition.proficiencies={...empty(),martial:true,armor:'heavy'};const c=create(d),w=weapon(c,'weapon-longsword');addEquipment(c,equipmentById('armor-full-plate'));recompute(c);
 const changed=structuredClone(d);delete changed.definition.proficiencies;let review=previewCustomClassChange(c,d.definition.id,changed);assert.equal(review.summary.proficiencies.items.length,2);
 w.proficiency='yes';c.gear.find(g=>g.catalogId==='armor-full-plate').proficient=true;
 assert.throws(()=>applyCustomClassChange(c,review),/changed/);
 review=previewCustomClassChange(c,d.definition.id,changed);assert.equal(review.summary.proficiencies.items.length,0);
 const before=structuredClone(c);applyCustomClassChange(c,review);recompute(c,before);assert.deepEqual(c.gear,before.gear);assert.deepEqual(c.weapons,before.weapons);assert.equal(weaponProficient(c,w),true);assert.equal(equippedArmor(c).nonproficient,0);
 const invalid=structuredClone(d);invalid.definition.proficiencies.mediumAt=99;const current=structuredClone(c);assert.throws(()=>previewCustomClassChange(c,d.definition.id,invalid));assert.deepEqual(c,current);
});
