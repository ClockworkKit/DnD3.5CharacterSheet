import { z } from 'zod';
import {automationSchema,effectSchema,defaultAutomation} from './automation-schema.ts';
import {findClass,makeCaster,makePsionic,applyStartingClass,applyClassTotals} from './classes.ts';
import {selectRace,findRace,effectiveScore} from './ancestry.ts';

export const abilityKeys = ['STR','DEX','CON','INT','WIS','CHA'] as const;
export const abilityNames = {STR:'Strength',DEX:'Dexterity',CON:'Constitution',INT:'Intelligence',WIS:'Wisdom',CHA:'Charisma'};
const ability = z.enum(abilityKeys);
const num = z.number().finite().min(-10000).max(100000);
const count = z.number().int().min(0).max(10000);
const short = z.string().max(160);
const note = z.string().max(20000);
const ident = z.string().min(1).max(100);
const spellSchema = z.object({id:ident,name:short,school:short,levels:z.record(z.number().int().min(0).max(9)),levelText:short,components:short,castingTime:short,range:short,target:z.string().max(1000),duration:short,save:short,resistance:short,description:note,source:z.string().max(500)});
export type Spell = z.infer<typeof spellSchema>;
export type Feat = {id:string,name:string,description:string,source:string};
const knownSchema = z.object({id:ident,spellId:ident,level:z.number().int().min(0).max(9),slotLevel:z.number().int().min(0).max(9),prepared:count,spent:count,formula:z.string().max(80),notes:z.string().max(2000),custom:spellSchema.nullable()});
const casterSchema = z.object({id:ident,name:short,list:short,ability,level:z.number().int().min(0).max(100),mode:z.enum(['prepared','spontaneous']),dcExtra:num,penetration:num,slots:z.array(z.object({max:count,used:count})).length(10),spells:z.array(knownSchema).max(1000),notes:z.string().max(4000),casting:z.object({classId:short,domain:z.boolean().default(false),progression:z.number().min(0).max(100).nullable().default(null),levelAdjustment:num.default(0),slotAdjustments:z.array(num).length(10).default(Array(10).fill(0)),automatic:z.boolean().default(true)}).optional()});
const skillSchema = z.object({id:ident,name:short,ability,ranks:z.number().min(0).max(1000).multipleOf(.5),misc:num,trained:z.boolean(),armor:z.number().int().min(0).max(2),classSkill:z.boolean()});
const weaponSchema = z.object({id:ident,name:short,ability,attack:num,damage:z.string().max(80),damageAbility:z.enum(['STR','DEX','none']),strength:z.enum(['one','two','off']),damageExtra:num,crit:short,range:short,ammo:count,notes:z.string().max(2000),catalogId:short.optional(),enhancement:count.optional(),masterwork:z.boolean().optional(),proficiency:z.enum(['auto','yes','no']).optional(),role:z.enum(['main','off']).optional(),diceSize:short.optional(),criticalRange:count.optional(),criticalMultiplier:count.optional(),extraDamage:z.string().max(200).optional(),bowStrength:count.optional(),keen:z.boolean().optional()});
const classLevelSchema = z.object({id:ident,classId:short,name:short,level:z.number().int().min(1).max(30),notes:z.string().max(2000),castingTarget:short.optional(),divineTarget:short.optional(),psionicTarget:short.optional()});
const psionicSchema = z.object({id:ident,name:short,ability,level:z.number().int().min(0).max(100),max:count,spent:count,focused:z.boolean(),dcExtra:num,notes:z.string().max(4000),powers:z.array(z.object({id:ident,name:short,powerId:short.default(''),level:z.number().int().min(1).max(9),cost:z.number().int().min(1).max(100),formula:z.string().max(80),notes:z.string().max(10000)})).max(200),manifesting:z.object({classId:short,progression:z.number().min(0).max(100).nullable().default(null),levelAdjustment:num.default(0),pointsAdjustment:num.default(0),automatic:z.boolean().default(true)}).optional()});
export const characterSchema = z.object({
  schemaVersion:z.literal(1), name:short.min(1),race:short,classes:z.string().max(2000),level:z.number().int().min(1).max(100),alignment:short,deity:short,player:short,experience:z.number().int().min(0).max(100000000),languages:z.string().max(2000),appearance:z.string().max(2000),size:z.enum(['Fine','Diminutive','Tiny','Small','Medium','Large','Huge','Gargantuan','Colossal']),
  scores:z.object({STR:num,DEX:num,CON:num,INT:num,WIS:num,CHA:num}),temps:z.object({STR:num,DEX:num,CON:num,INT:num,WIS:num,CHA:num}),
  hp:num,maxHp:count,tempHp:count,nonlethal:count,hitDice:short,speed:count,initiative:num,bab:num,grapple:num,situational:num,
  defense:z.object({armor:num,shield:num,natural:num,deflection:num,dodge:num,misc:num,dexCap:z.number().min(-100).max(100),checkPenalty:z.number().min(-100).max(0),spellFailure:z.number().min(0).max(100),sr:count,dr:short,resistances:z.string().max(2000)}),
  saves:z.object({fort:z.object({base:num,misc:num}),ref:z.object({base:num,misc:num}),will:z.object({base:num,misc:num})}),
  skills:z.array(skillSchema).max(120),weapons:z.array(weaponSchema).max(50),casters:z.array(casterSchema).max(15),
  gear:z.array(z.object({id:ident,name:short,qty:count,weight:z.number().min(0).max(100000),carried:z.boolean(),equipped:z.boolean(),notes:z.string().max(2000),catalogId:short.optional(),enhancement:count.optional(),masterwork:z.boolean().optional(),material:z.enum(['standard','mithral','adamantine']).optional(),proficient:z.boolean().optional(),weaponId:short.optional()})).max(500),
  coins:z.object({cp:count,sp:count,gp:count,pp:count}),coinWeight:z.boolean(),
  features:z.array(z.object({id:ident,name:short,kind:z.enum(['Feat','Class feature','Racial trait','Other']),description:note,max:count,used:count,source:z.string().max(500),choice:short.optional(),ruleId:short.optional(),formula:z.string().max(200).optional()})).max(250),
  conditions:z.string().max(2000),notes:note,background:note,
  automation:automationSchema.default({}),effects:z.array(effectSchema).max(100).default([]),
  classLevels:z.array(classLevelSchema).max(30).default([]),
  psionics:z.array(psionicSchema).max(15).default([]),
  ancestry:z.object({raceId:short,abilityAdjustments:z.boolean(),traitBonuses:z.boolean(),racialHitDice:count,levelAdjustment:count,ignoreLevelAdjustment:z.boolean(),powerPointsSpent:count,notes:z.string().max(4000)}).default({raceId:'',abilityAdjustments:false,traitBonuses:false,racialHitDice:0,levelAdjustment:0,ignoreLevelAdjustment:false,powerPointsSpent:0,notes:''}),
});
export type Character = z.infer<typeof characterSchema>;
export type Caster = Character['casters'][number];
export type KnownSpell = Caster['spells'][number];
export type Skill = Character['skills'][number];
export type Weapon = Character['weapons'][number];
export type ClassLevel = Character['classLevels'][number];
export type Psionic = Character['psionics'][number];
export const uid = () => globalThis.crypto.randomUUID();
export const baseSkills: Array<[string,Skill['ability'],boolean,number]> = [
 ['Appraise','INT',false,0],['Balance','DEX',false,1],['Bluff','CHA',false,0],['Climb','STR',false,1],['Concentration','CON',false,0],['Craft','INT',false,0],['Decipher Script','INT',true,0],['Diplomacy','CHA',false,0],['Disable Device','INT',true,0],['Disguise','CHA',false,0],['Escape Artist','DEX',false,1],['Forgery','INT',false,0],['Gather Information','CHA',false,0],['Handle Animal','CHA',true,0],['Heal','WIS',false,0],['Hide','DEX',false,1],['Intimidate','CHA',false,0],['Jump','STR',false,1],
 ...['arcana','architecture and engineering','dungeoneering','geography','history','local','nature','nobility and royalty','religion','the planes'].map(x=>['Knowledge ('+x+')','INT',true,0] as [string,'INT',boolean,number]),
 ['Listen','WIS',false,0],['Move Silently','DEX',false,1],['Open Lock','DEX',true,0],['Perform','CHA',false,0],['Profession','WIS',true,0],['Ride','DEX',false,0],['Search','INT',false,0],['Sense Motive','WIS',false,0],['Sleight of Hand','DEX',true,1],['Spellcraft','INT',true,0],['Spot','WIS',false,0],['Survival','WIS',false,0],['Swim','STR',false,2],['Tumble','DEX',true,1],['Use Magic Device','CHA',true,0],['Use Rope','DEX',false,0]
];
export function newCaster(kind='Cleric'): Caster {const def=findClass(kind);if(!def)throw new Error('Choose a known casting class.');return makeCaster(def);}
export function newWeapon(): Weapon {return {id:uid(),name:'New weapon',ability:'STR',attack:0,damage:'1d6',damageAbility:'STR',strength:'one',damageExtra:0,crit:'20 / ×2',range:'Melee',ammo:0,notes:''};}
export function newCharacter(kind='Fighter',level=3,raceId?:string): Character {
 const c: Character = {schemaVersion:1,automation:defaultAutomation(),effects:[],classLevels:[],psionics:[],ancestry:{raceId:'',abilityAdjustments:false,traitBonuses:false,racialHitDice:0,levelAdjustment:0,ignoreLevelAdjustment:false,powerPointsSpent:0,notes:''},name:kind==='Fighter'?'Borin Stoneward':'New '+kind.toLowerCase(),race:kind==='Fighter'?'Dwarf':'Human',classes:kind+' 3',level:3,alignment:'',deity:'',player:'',experience:3000,languages:'Common'+(kind==='Fighter'?', Dwarven':''),appearance:'',size:'Medium',scores:{STR:16,DEX:12,CON:14,INT:10,WIS:10,CHA:8},temps:{STR:0,DEX:0,CON:0,INT:0,WIS:0,CHA:0},hp:26,maxHp:30,tempHp:0,nonlethal:0,hitDice:'3d10',speed:20,initiative:0,bab:3,grapple:0,situational:0,defense:{armor:6,shield:2,natural:0,deflection:0,dodge:0,misc:0,dexCap:1,checkPenalty:-6,spellFailure:40,sr:0,dr:'',resistances:''},saves:{fort:{base:3,misc:0},ref:{base:1,misc:0},will:{base:1,misc:0}},skills:baseSkills.map(([name,ability,trained,armor],i)=>({id:'skill-'+i,name,ability,ranks:0,misc:0,trained,armor,classSkill:kind==='Fighter'&&['Climb','Craft','Handle Animal','Intimidate','Jump','Ride','Swim'].includes(name)})),weapons:[{...newWeapon(),name:'Battleaxe',damage:'1d8',crit:'20 / ×3'}],casters:[],gear:[{id:uid(),name:'Banded mail',qty:1,weight:35,carried:true,equipped:true,notes:'Armor +6; max Dex +1; check −6; arcane failure 35%.'},{id:uid(),name:'Heavy wooden shield',qty:1,weight:10,carried:true,equipped:true,notes:'Shield +2; check −2; arcane failure 15%.'},{id:uid(),name:'Battleaxe',qty:1,weight:6,carried:true,equipped:true,notes:''}],coins:{cp:0,sp:0,gp:50,pp:0},coinWeight:true,features:[],conditions:'',notes:'',background:''};
 c.defense.checkPenalty=-8;c.defense.spellFailure=50;
 applyStartingClass(c,kind,level);
 if(raceId){
  const oldWis=Math.floor((c.scores.WIS-10)/2),oldCha=Math.max(0,Math.floor((c.scores.CHA-10)/2));
  const speedBonus=kind==='Fighter'?0:Math.max(0,c.speed-30);c.languages='';
  selectRace(c,raceId,{abilities:true,traits:true,body:true,languages:true,speedBonus});applyClassTotals(c);
  const race=findRace(raceId)!,def=findClass(kind)!,con=Math.floor((effectiveScore(c,'CON')-10)/2);
  const hp=def.hitDie+Math.ceil((level-1)*(def.hitDie/2+.5));
  c.maxHp=Math.max(c.level,(race.rhd?8+Math.ceil((race.rhd-1)*4.5+level*(def.hitDie/2+.5)):hp)+con*c.level);c.hp=c.maxHp;
  if(kind==='Monk')c.defense.misc+=Math.floor((effectiveScore(c,'WIS')-10)/2)-oldWis;
  if(kind==='Paladin'&&level>=2){const change=Math.max(0,Math.floor((effectiveScore(c,'CHA')-10)/2))-oldCha;c.saves.fort.misc+=change;c.saves.ref.misc+=change;c.saves.will.misc+=change;}
  c.casters=c.casters.map(p=>makeCaster(def,level,effectiveScore(c,p.ability)));
  c.psionics=c.psionics.map(p=>makePsionic(def,level,effectiveScore(c,p.ability)));
  if(c.size==='Small'){const small:Record<string,string>={'1d12':'1d10','1d10':'1d8','1d8':'1d6','1d6':'1d4','2d6':'1d10','2d8':'2d6','2d10':'2d8'};c.weapons.forEach(w=>{w.damage=small[w.damage]||w.damage});}
  if(kind==='Fighter'&&raceId!=='dwarf'){c.name='New '+race.name.toLowerCase()+' fighter';c.gear=[];c.defense.armor=0;c.defense.shield=0;c.defense.dexCap=100;c.defense.checkPenalty=0;c.defense.spellFailure=0;}
  const ecl=c.level+race.la;c.experience=ecl*(ecl-1)*500;
  const cha=Math.floor((effectiveScore(c,'CHA')-10)/2);
  for(const f of c.features){if(f.name==='Turn or rebuke undead')f.max=Math.max(0,3+cha);if(f.name==='Lay on hands — healing points')f.max=level*Math.max(0,cha);}
 }

 if(c.casters.length){
  const choices:Record<string,Array<[string,number]>>={Bard:[['detect-magic',0],['read-magic',0],['mage-hand',0],['cure-light-wounds',1],['charm-person',1]],Druid:[['detect-magic',0],['read-magic',0],['guidance',0],['light',0],['cure-light-wounds',1],['entangle',1],['faerie-fire',1],['barkskin',2],['flaming-sphere',2]],Wizard:[['detect-magic',0],['read-magic',0],['magic-missile',1],['shield',1],['mage-armor',1],['invisibility',2],['scorching-ray',2]],Cleric:[['detect-magic',0],['read-magic',0],['light',0],['create-water',0],['bless',1],['cure-light-wounds',1],['shield-of-faith',1],['aid',2],['hold-person',2]],Sorcerer:[['detect-magic',0],['read-magic',0],['acid-splash',0],['ray-of-frost',0],['light',0],['magic-missile',1],['shield',1],['mage-armor',1]]};
  c.casters[0].spells=(choices[kind]||[]).filter(([,level])=>c.casters[0].slots[level].max>0).filter((entry,index,list)=>kind!=='Sorcerer'||level>2||list.slice(0,index).filter(x=>x[1]===entry[1]).length<(entry[1]===0?(level===1?4:5):2)).map(([spellId,level])=>({id:uid(),spellId,level,slotLevel:level,prepared:0,spent:0,formula:'',notes:'',custom:null}));
  if(c.casters[0].mode==='prepared'){const allocated=Array(10).fill(0);for(const k of c.casters[0].spells){if(allocated[k.level]<c.casters[0].slots[k.level].max){k.prepared=1;allocated[k.level]++;}}}
 }
 return c;
}
