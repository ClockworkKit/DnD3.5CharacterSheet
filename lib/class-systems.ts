import {z} from 'zod';
import type {Character} from './model.ts';
import {findClass} from './classes.ts';
import {effectiveScore} from './ancestry.ts';
import {equippedArmor,carrying,equipmentById} from './equipment.ts';

export const classSystemsSchema=z.object({
 choices:z.array(z.object({id:z.string().min(1).max(100),classId:z.string().max(100),name:z.string().min(1).max(160),invocationGrade:z.enum(['least','lesser','greater','dark']).optional(),kind:z.enum(['invocation','maneuver','stance','vestige','soulmeld','mystery','fundamental','utterance','aura']),level:z.number().int().min(0).max(9),readied:z.boolean().default(false),granted:z.boolean().default(false),spent:z.number().int().min(0).max(10000).default(0),essentia:z.number().int().min(0).max(20).default(0),bound:z.boolean().default(false),totem:z.boolean().default(false),notes:z.string().max(4000).default('')})).max(200).default([]),
 pools:z.record(z.number().int().min(0).max(10000)).default({}),
 delayedDamage:z.number().int().min(0).max(1000).default(0),
}).default({});
export type SystemChoice=z.infer<typeof classSystemsSchema>['choices'][number];
const lv=(c:Character,id:string)=>c.classLevels.filter(e=>e.classId===id).reduce((n,e)=>n+e.level,0);
const mod=(c:Character,a:'INT'|'WIS'|'CHA'|'CON')=>Math.floor((effectiveScore(c,a)-10)/2);
const row=(c:Character,id:string)=>findClass(id)?.levels.find(r=>r.level===Math.min(20,lv(c,id)));
const column=(c:Character,id:string,i:number)=>parseInt(row(c,id)?.extra[i]?.replaceAll(',','')||'0')||0;
export function systemLimits(c:Character,id:string){
 const level=lv(c,id),r=row(c,id);if(!level||!r)return null;
 const total=c.classLevels.reduce((n,e)=>n+e.level,0)+(c.ancestry.racialHitDice||0);
 const result:{level:number,kind:SystemChoice['kind'],known:number,readied?:number,stances?:number,maxLevel:number,essentia?:number,capacity?:number,binds?:number,initiator?:number,granted?:number}={level,kind:'invocation',known:0,maxLevel:9};
 if(['warlock','dragonfire-adept'].includes(id))return {...result,known:column(c,id,0),maxLevel:9};
 if(['warblade','crusader','swordsage'].includes(id)){const initiator=level+Math.floor((total-level)/2);return {...result,kind:'maneuver' as const,known:column(c,id,0),readied:column(c,id,1),stances:column(c,id,2),maxLevel:Math.min(9,Math.floor((initiator+1)/2)),initiator,...(id==='crusader'?{granted:Number(r.extra[1].match(/\((\d+)\)/)?.[1]||2)}:{})};}
 if(id==='binder')return {...result,kind:'vestige' as const,known:level>=20?4:level>=14?3:level>=8?2:1,maxLevel:column(c,id,0)};
 if(['incarnate','soulborn','totemist'].includes(id))return {...result,kind:'soulmeld' as const,known:Math.max(0,Math.min(column(c,id,0),effectiveScore(c,'CON')-10)),maxLevel:0,essentia:column(c,id,1),capacity:total>=18?4:total>=12?3:total>=6?2:1,binds:column(c,id,2)};
 if(id==='shadowcaster')return {...result,kind:'mystery' as const,known:level,maxLevel:Math.min(9,Math.floor((level+1)/2))};
 if(id==='truenamer')return {...result,kind:'utterance' as const,known:column(c,id,0)+column(c,id,1)+column(c,id,2),maxLevel:6};
 if(id==='dragon-shaman')return {...result,kind:'aura' as const,known:column(c,id,0),maxLevel:0};
 if(id==='marshal')return {...result,kind:'aura' as const,known:column(c,id,0)+column(c,id,1),maxLevel:0};
 return null;
}
export function invocationGradeAvailable(c:Character,s:SystemChoice){return s.kind!=='invocation'||!s.invocationGrade||lv(c,s.classId)>={least:1,lesser:6,greater:11,dark:16}[s.invocationGrade];}
export function choiceDailyUses(c:Character,s:SystemChoice){const level=lv(c,s.classId);if(s.kind==='fundamental')return level>=14?Infinity:3;if(s.kind==='mystery')return s.level<=3?(level>=13?3:level>=7?2:1):s.level<=6?(level>=13?2:1):1;return Infinity;}
export function essentiaCapacity(c:Character,s:SystemChoice){const n=systemLimits(c,s.classId);if(!n)return 0;return (n.capacity||0)+(s.classId==='incarnate'?(n!.level>=3?1:0)+(n!.level>=15?1:0):s.classId==='totemist'&&s.bound&&s.totem?(n!.level>=15?2:1):0);}
export function systemKinds(c:Character,id:string):SystemChoice['kind'][] {const n=systemLimits(c,id);return !n?[]:n.kind==='maneuver'?['maneuver','stance']:n.kind==='mystery'?['mystery','fundamental']:[n.kind];}
export function systemWarnings(c:Character){const warnings:string[]=[];const choices=c.classSystems.choices;
 for(const id of new Set(choices.map(s=>s.classId))){const n=systemLimits(c,id);if(!n){warnings.push(id+': no matching supported class levels.');continue}const group=choices.filter(s=>s.classId===id);if(group.some(s=>!systemKinds(c,id).includes(s.kind)))warnings.push(id+': a choice belongs to a different ability system.');if(n.granted!==undefined&&group.filter(s=>s.granted&&!s.readied).length)warnings.push(id+': only readied maneuvers can be granted.');const primary=group.filter(s=>s.kind===n.kind);if(primary.length>n.known)warnings.push(id+': too many '+n.kind+' choices.');if(group.some(s=>!invocationGradeAvailable(c,s)||s.level>n.maxLevel&&s.kind!=='fundamental'))warnings.push(id+': a choice exceeds the current level limit.');if(n.readied!==undefined&&primary.filter(s=>s.readied).length>n.readied)warnings.push(id+': too many readied maneuvers.');if(n.stances!==undefined&&group.filter(s=>s.kind==='stance').length>n.stances)warnings.push(id+': too many stances.');if(n.binds!==undefined&&group.filter(s=>s.bound).length>n.binds)warnings.push(id+': too many chakra binds.');for(const s of group)if(s.kind==='soulmeld'&&s.essentia>essentiaCapacity(c,s))warnings.push(s.name+': essentia exceeds capacity.');if(id==='shadowcaster'&&group.filter(s=>s.kind==='fundamental').length>3+Math.floor(n.level/4))warnings.push('Shadowcaster: extra fundamentals must replace mystery choices.');}
 const pool=['incarnate','soulborn','totemist'].reduce((n,id)=>n+(systemLimits(c,id)?.essentia||0),0);if(choices.reduce((n,s)=>n+s.essentia,0)>pool)warnings.push('Soulmeld investments exceed the combined class essentia pool.');return warnings;
}
export function spendSystemChoice(c:Character,id:string){const s=c.classSystems.choices.find(s=>s.id===id);if(!s||!lv(c,s.classId))throw new Error('This class choice is not available.');const limit=systemLimits(c,s.classId);if(!limit||!invocationGradeAvailable(c,s)||!systemKinds(c,s.classId).includes(s.kind)||s.level>limit.maxLevel)throw new Error('This choice exceeds the current level limit.');if(s.kind==='maneuver'&&(!s.readied||s.spent||s.classId==='crusader'&&!s.granted))throw new Error('Ready and recover this maneuver before using it.');if(s.spent>=choiceDailyUses(c,s))throw new Error('No daily uses remain.');if(s.kind==='mystery'&&effectiveScore(c,'INT')<10+s.level)throw new Error('Intelligence is too low for this mystery.');if(s.kind==='maneuver'||s.kind==='utterance'||choiceDailyUses(c,s)!==Infinity)s.spent++;if(s.classId==='crusader')s.granted=false;}
export function recoverManeuvers(c:Character,id:string){for(const s of c.classSystems.choices)if(s.classId===id&&s.kind==='maneuver'){s.spent=0;s.granted=false};}
export function settleDelayedDamage(c:Character){const damage=c.classSystems.delayedDamage;c.classSystems.delayedDamage=0;const absorbed=Math.min(c.tempHp,damage);c.tempHp-=absorbed;c.hp-=damage-absorbed;}
export function delayedCapacity(c:Character){const l=lv(c,'crusader');return l?l>=20?30:l>=16?25:l>=12?20:l>=8?15:l>=4?10:5:0;}
export function specialSpellFailure(c:Character,id:string){
 if(findClass(id)?.casting?.type==='divine'||['cleric','druid','paladin','ranger','blackguard'].includes(id))return 0;
 const level=lv(c,id);let allowed=0,shield='none';if(['bard','beguiler','dread-necromancer','hexblade','spellthief','warlock'].includes(id))allowed=1;if(id==='warmage'){allowed=level>=8?2:1;shield='light'}if(id==='duskblade'){allowed=level>=4?2:1;shield=level>=7?'standard':'light'}
 let total=0;const a=equippedArmor(c);for(const g of a.selected){const e=equipmentById(g.catalogId)!;const rank=Math.max(1,['light','medium','heavy'].indexOf(e.category)+1-(g.material==='mithral'?1:0));const ignored=e.kind==='armor'?rank<=allowed:e.kind==='shield'&&(shield==='standard'&&!e.name.includes('tower')||shield==='light'&&(/light/i.test(e.name)||e.name==='Buckler'));if(!ignored)total+=Math.max(0,(e.spellFailure||0)-(g.material==='mithral'?10:0));}return Math.min(100,total+(c.ancestry.raceId==='warforged'&&allowed===0?5:0));
}
export function supplementalTerms(c:Character,target:string,context:Record<string,string|number|boolean>={}){
 if(!c.automation.enabled||!['initiative','save.fort','save.ref','save.will','saves','ac.misc','ac.naturalEnhancement','ac.dodge','speed','damage','attack','critical.confirm','skill.Climb','skill.Jump','skill.Tumble'].includes(target))return [];
 const terms:Array<{value:number,type:string,source:string}>=[],add=(value:number,type:string,source:string)=>{if(value)terms.push({value,type,source})};const x=c.automation.context,armor=equippedArmor(c),lightLoad=!c.automation.encumbrance||carrying(c).category==='Light',light=armor.category<=1&&lightLoad,free=armor.category===0&&!armor.hasShield&&lightLoad;
 const wb=lv(c,'warblade'),ss=lv(c,'swordsage'),sc=lv(c,'scout'),sw=lv(c,'swashbuckler'),ninja=lv(c,'ninja'),cr=lv(c,'crusader');
 if(['skill.Climb','skill.Jump','skill.Tumble'].includes(target)&&ninja>=6)add(2*Math.floor(ninja/6),'untyped','acrobatics');
 if(target==='skill.Jump'&&ninja>=4&&armor.category===0&&lightLoad)add(4,'untyped','great-leap');
 if(target==='initiative'){if(ss)add(1+Math.floor(ss/5),'untyped','quick-to-act');if(sc>=2&&light)add(sc>=20?3:sc>=11?2:1,'competence','battle-fortitude');}
 if(target==='save.fort'&&sc>=2&&light)add(sc>=20?3:sc>=11?2:1,'competence','battle-fortitude');
 if(target==='save.ref'){if(wb&&!x.flatFooted)add(Math.min(wb,Math.max(0,mod(c,'INT'))),'insight','battle-clarity');if(sw>=2&&light)add(sw>=20?3:sw>=11?2:1,'competence','grace');}
 if(target==='save.will'){if(cr>=2&&lv(c,'paladin')<2)add(Math.max(0,mod(c,'CHA')),'untyped','indomitable-soul');if(ninja&&free&&(c.features.find(f=>f.ruleId==='supp:ninja:Ki power')?.used||0)<Math.max(1,Math.floor(ninja/2))+Math.max(0,mod(c,'WIS')))add(2,'untyped','ki-power');}
 if(target==='saves'&&lv(c,'hexblade')>=2&&['spell','spell-like'].includes(x.saveAgainst))add(Math.max(0,mod(c,'CHA')),'untyped','arcane-resistance');
 if(target==='ac.misc'&&!x.helpless){if(ninja&&free)add((lv(c,'monk')?0:Math.max(0,mod(c,'WIS')))+Math.floor(ninja/5),'untyped','ninja-ac');if(ss>=2&&armor.category===1&&!armor.hasShield&&lightLoad)add(Math.max(0,mod(c,'WIS')),'untyped','swordsage-ac');}
 if(target==='ac.dodge'&&sw>=5&&light&&x.dodgeTarget)add(Math.floor(sw/5),'dodge','swashbuckler-dodge');
 if(target==='ac.misc'&&sc>=3&&light&&x.skirmish)add(1+Math.floor((sc-3)/4),'competence','skirmish');
 if(target==='speed'&&sc>=3&&light)add(sc>=11?20:10,'enhancement','scout-speed');
 if(target==='critical.confirm'&&wb>=3)add(Math.max(0,mod(c,'INT')),'insight','battle-ardor');
 if((target==='attack'||target==='damage')&&cr&&x.ownTurn&&c.classSystems.delayedDamage>0)add(Math.min(6,Math.max(1,Math.floor(Math.min(c.classSystems.delayedDamage,delayedCapacity(c))/5))),'untyped','furious-counterstrike');
 if((target==='attack'||target==='damage')&&context.weapon==='melee'&&wb>=15&&x.opportunity)add(Math.max(0,mod(c,'INT')),'insight','battle-mastery');
 if(target==='damage'&&context.weapon==='melee'&&wb>=7&&(x.targetFlatFooted||x.flanking))add(Math.max(0,mod(c,'INT')),'insight','battle-cunning');
 return terms;
}

export type ClassResource={classId:string,name:string,max:number,description:string};
export function supplementalResources(c:Character){const out:ClassResource[]=[];const add=(id:string,at:number,name:string,max:number,description:string)=>{if(lv(c,id)>=at)out.push({classId:id,name,max:Math.max(0,max),description})};
 for(const e of c.classLevels){const d=findClass(e.classId);if(!d?.book)continue;const values=new Map<string,number>();for(const r of d.levels.filter(r=>r.level<=lv(c,d.id)))for(const m of r.special.matchAll(/([^,]+?)\s+(\d+)\/day/g)){const raw=m[1].trim(),name=(raw[0].toUpperCase()+raw.slice(1)).replace('Aura of unlucky','Aura of unluck');if(!/sustaining|sleep/i.test(name))values.set(name,Number(m[2]));}for(const [name,max] of values)add(d.id,1,name,max,'Daily uses. Resolve the feature and its targets using the class reference.');}
 add('swashbuckler',11,'Lucky',1,'Reroll a failed attack, skill check, ability check, or save; keep the new result.');
 add('crusader',3,'Zealous surge',1,'Reroll one save; decide before the result is announced.');
 add('warlock',8,'Fiendish resilience',1,'Fast healing '+(lv(c,'warlock')>=18?5:lv(c,'warlock')>=13?2:1)+' for 20 rounds; apply healing as rounds pass.');
 add('ninja',1,'Ki power',Math.max(1,Math.floor(lv(c,'ninja')/2))+Math.max(0,mod(c,'WIS')),'Shared daily pool for ninja ki abilities. Unarmored and unencumbered.');
 add('knight',1,"Knight's challenge",Math.max(1,Math.floor(lv(c,'knight')/2)+mod(c,'CHA')),'Shared challenge pool; save DC '+(10+Math.floor(lv(c,'knight')/2)+mod(c,'CHA'))+'.');
 add('dread-necromancer',1,'Rebuke undead',3+mod(c,'CHA'),'Turning level '+lv(c,'dread-necromancer')+'.');
 add('dragon-shaman',6,'Touch of vitality',2*lv(c,'dragon-shaman')*Math.max(0,mod(c,'CHA')),'Healing points per day; condition removal spends points from this same pool.');
 add('spirit-shaman',2,'Chastise spirits',3+mod(c,'CHA'),lv(c,'spirit-shaman')+'d6; Will DC '+(10+lv(c,'spirit-shaman')+mod(c,'CHA'))+' halves.');
 add('spirit-shaman',7,'Warding of the spirits',1,'10 minutes per spirit shaman level.');add('spirit-shaman',17,'Spirit journey',1,'Self-only spirit travel.');
 add('lurk',1,'Lurk augment',lv(c,'lurk')+mod(c,'INT'),'Shared daily augment uses; power points spent on augments require separate deduction.');
 add('truenamer',13,'Sending',3,'Truespeak DC 15 + twice target CR.');
 add('incarnate',20,'Perfect meldshaper',1,'Maximum soulmeld investments for 3 + Wisdom modifier rounds.');add('totemist',20,'Totem embodiment',1,'Totem capacity doubles temporarily; duration '+Math.max(1,mod(c,'CON'))+' minutes.');
 for(const [at,name] of [[3,'Cleanse paralysis'],[4,'Cleanse disease'],[5,'Cleanse fear'],[6,'Cleanse poison'],[8,'Call companion'],[9,'Cleanse blindness'],[10,'Cleanse spirit'],[13,'Cleanse petrification'],[15,'New limb']] as const)add('healer',at,name,1,'Resolve the corresponding healing ability from the class reference.');
 return out;
}
export function syncSupplementalResources(c:Character){const resources=supplementalResources(c),keep=new Set(resources.map(r=>'supp:'+r.classId+':'+r.name));c.features=c.features.filter(f=>!f.ruleId?.startsWith('supp:')||keep.has(f.ruleId));for(const r of resources){const ruleId='supp:'+r.classId+':'+r.name;let f=c.features.find(f=>f.ruleId===ruleId);if(!f){if(c.features.length>=250)continue;f={id:crypto.randomUUID(),name:findClass(r.classId)!.name+' · '+r.name,kind:'Class feature',description:r.description,max:r.max,used:0,source:findClass(r.classId)!.source,ruleId};c.features.push(f)}f.max=r.max;f.description=r.description;}}
export function syncGrantedFeats(c:Character){
 const grants:Array<[string,number,string,string?]>=[['swashbuckler',1,'Weapon Finesse'],['samurai',8,'Improved Initiative'],['duskblade',2,'Combat Casting'],['archivist',1,'Scribe Scroll'],['beguiler',5,'Silent Spell'],['beguiler',10,'Still Spell'],['healer',2,'Skill Focus','Heal'],['marshal',1,'Skill Focus','Diplomacy'],['artificer',1,'Scribe Scroll'],['artificer',2,'Brew Potion'],['artificer',3,'Craft Wondrous Item'],['artificer',5,'Craft Magic Arms and Armor'],['artificer',6,'Craft Wand'],['artificer',9,'Craft Rod'],['artificer',12,'Craft Staff'],['artificer',14,'Forge Ring']];
 const earned=grants.filter(([id,at])=>lv(c,id)>=at),keys=new Set(earned.map(([id,at,name])=>'granted:'+id+':'+at+':'+name));c.features=c.features.filter(f=>!f.ruleId?.startsWith('granted:')||keys.has(f.ruleId));
 for(const [id,at,name,choice] of earned){if(c.features.some(f=>f.kind==='Feat'&&f.name===name&&(!choice||f.choice===choice)))continue;if(c.features.length>=250)continue;c.features.push({id:crypto.randomUUID(),name,kind:'Feat',description:'Granted by '+findClass(id)!.name+' at class level '+at+'.',max:0,used:0,source:findClass(id)!.source,ruleId:'granted:'+id+':'+at+':'+name,...(choice?{choice}:{})});}
}
