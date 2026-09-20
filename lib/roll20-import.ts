import {abilityKeys,abilityNames,baseSkills,characterSchema,newWeapon,uid,type Character,type Caster,type Skill,type Spell} from './model.ts';
import {findClass,makeCaster,makePsionic,castingAbility,manifestingAbility,classTotals} from './classes.ts';
import {raceCatalog} from './ancestry.ts';
import {sheetTotals,skillBonus,weaponAttack} from './rules.ts';
import {parseDiceFormula} from './dice.mjs';
import {expandSpellCatalog,type SpellExtension} from './spell-catalog.ts';
import {roll20ExportSchema,type Roll20Report} from './roll20-schema.ts';
import {attributeReader,parseRepeating,roll20Number,type RepeatingRow} from './roll20-attributes.ts';
import baseSpells from '../public/data/spells.json' with {type:'json'};
import extraSpells from '../public/data/supplemental-spells.json' with {type:'json'};
import feats from '../public/data/feats.json' with {type:'json'};
import powers from '../public/data/powers.json' with {type:'json'};

export {roll20ExportSchema,parseRepeating};
const spells=expandSpellCatalog(baseSpells as unknown as Spell[],extraSpells as unknown as SpellExtension[]);
const normalized=(s:string)=>s.toLowerCase().replace(/\s*\[[^\]]*\]/g,'').replace(/[’‘]/g,"'").replace(/[^a-z0-9]/g,'');
function named<T extends {id:string,name:string}>(name:string,catalog:T[]){const hits=catalog.filter(x=>normalized(x.name)===normalized(name));return hits.length===1?hits[0]:undefined;}
const ability=(value:string|undefined)=>abilityKeys.find(a=>[a,abilityNames[a],'@{'+a.toLowerCase()+'-mod}'].some(k=>k.toLowerCase()===value?.trim().toLowerCase()));
const sizes:Character['size'][]=['Fine','Diminutive','Tiny','Small','Medium','Large','Huge','Gargantuan','Colossal'];
const sizeBonuses=[8,4,2,1,0,-1,-2,-4,-8];

function emptyCharacter():Character {
 // Import into a blank record, with manual calculations protecting source totals.
 return characterSchema.parse({schemaVersion:1,name:'Imported character',race:'',classes:'',level:1,alignment:'',deity:'',player:'',experience:0,languages:'',appearance:'',size:'Medium',
  scores:{STR:10,DEX:10,CON:10,INT:10,WIS:10,CHA:10},temps:{STR:0,DEX:0,CON:0,INT:0,WIS:0,CHA:0},
  hp:0,maxHp:0,tempHp:0,nonlethal:0,hitDice:'',speed:30,initiative:0,bab:0,grapple:0,situational:0,
  defense:{armor:0,shield:0,natural:0,deflection:0,dodge:0,misc:0,dexCap:100,checkPenalty:0,spellFailure:0,sr:0,dr:'',resistances:''},
  saves:{fort:{base:0,misc:0},ref:{base:0,misc:0},will:{base:0,misc:0}},
  skills:baseSkills.map(([name,ability,trained,armor],i)=>({id:'skill-'+i,name,ability,trained,armor,ranks:0,misc:0,classSkill:false})),
  weapons:[],casters:[],gear:[],coins:{cp:0,sp:0,gp:0,pp:0},coinWeight:true,features:[],conditions:'',notes:'',background:'',automation:{version:1,enabled:false},
 });
}

export function importRoll20(raw:unknown):{character:Character,report:Roll20Report} {
 let json:string;
 try{json=JSON.stringify(raw)}catch{throw Error('The Roll20 export must contain JSON data without circular references.');}
 if(!json||new TextEncoder().encode(json).length>1000000)throw Error('Choose a Roll20 export smaller than 1 MB.');
 const checked=roll20ExportSchema.safeParse(raw);
 if(!checked.success)throw Error('Invalid Roll20 export: '+checked.error.issues.slice(0,3).map(i=>i.path.join('.')+' '+i.message).join('; '));
 const data=checked.data;
 if(data.version!==1)throw Error(`Unsupported Roll20 export version ${data.version}. This site supports version 1.`);
 const report:Roll20Report={mapped:0,unmapped:[],warnings:[]},warnings=new Set<string>();
 const warn=(message:string)=>warnings.add(message),reader=attributeReader(data,warn),c=emptyCharacter();
 const scope=(prefix='',transform=(s:string)=>s)=>({
  n:(...names:string[])=>reader.number(...names.map(n=>prefix+transform(n))),
  t:(...names:string[])=>reader.text(...names.map(n=>prefix+transform(n))),
  b:(...names:string[])=>reader.boolean(...names.map(n=>prefix+transform(n))),
 });
 const core=scope(),rowScope=(row:RepeatingRow)=>{const f=Object.values(row.fields)[0][0];return scope(f.originalName.slice(0,-f.name.length));};
 type Scope=ReturnType<typeof scope>;
 const sum=(r:Scope,names:string[])=>names.reduce((total,n)=>total+(r.n(n)??0),0);
 const groups=parseRepeating(data.attributes);
 c.name=data.character.name||core.t('character_name','name')||c.name;
 c.race=core.t('race','character_race')||'';const race=named(c.race,raceCatalog);
 if(race){c.ancestry.raceId=race.id;c.size=race.size;c.speed=race.speed;}
 else if(c.race)warn('Race '+c.race+' has no unique catalog match; its name is preserved.');
 c.ancestry.racialHitDice=core.n('racial_hit_dice','racialhd')??0;
 c.ancestry.levelAdjustment=core.n('level_adjustment','la')??0;
 c.alignment=core.t('alignment')||'';c.deity=core.t('deity')||'';c.player=core.t('playername','player')||'';
 c.languages=core.t('languages')||'';c.experience=core.n('expcurrent','xp','experience','experience_points')??0;
 c.appearance=[core.t('appearance'),...['gender','sex','age','height','weight','skin','eyes','hair','homeland'].map(k=>{const v=core.t(k);return v?k+': '+v:undefined})].filter(Boolean).join('\n');
 c.background=core.t('background','backstory')||'';c.notes=core.t('notes')||'';c.conditions=core.t('conditions')||'';
 const size=core.t('size'),sizeNumber=roll20Number(size);
 if(size){const value=sizes.find(s=>s.toLowerCase()===size.toLowerCase())??sizes[sizeBonuses.indexOf(sizeNumber??99)];if(value)c.size=value;else warn('Unrecognized size '+size+'; review the imported size.');}
 const temporaryEnabled=core.b('tempBonusEnabled')!==false;
 for(const a of abilityKeys){
  const lower=a.toLowerCase(),temp=temporaryEnabled?(core.n(lower+'-temp',lower+'_temp','temp_'+lower)??0):0;
  const total=core.n(lower,abilityNames[a].toLowerCase(),lower+'_score','ability_'+lower);
  const base=total===undefined?core.n(lower+'-base'):undefined;
  if(total!==undefined)c.scores[a]=total-temp;
  else if(base!==undefined)c.scores[a]=base+sum(core,[lower+'-misc',lower+'-equi',lower+'-action']);
  else warn(a+' was missing or a formula; review the placeholder score of 10.');
  c.temps[a]=temp;
 }
 function addClass(name:string,level:number|undefined){
  if(!name.trim())return;
  if(level===undefined||!Number.isInteger(level)||level<1||level>30){warn('Class '+name+' has no supported numeric level; its original fields remain in the export.');return;}
  const d=findClass(name);c.classLevels.push({id:uid(),classId:d?.id||'',name:d?.name||name,level,notes:d?'':'Imported custom class; enter progression manually.'});
  if(!d)warn('Custom class '+name+' needs manual progression.');
 }
 for(let i=1;i<=10;i++){const name=core.t('class'+i);if(name)addClass(name,core.n('level'+i,'class'+i+'level'));}
 for(const name of ['class','classes'])for(const row of Object.values(groups[name]?.rows||{})){const r=rowScope(row),title=r.t('name','classname','class');if(title)addClass(title,r.n('level','classlevel'));}
 const classText=core.t('classes','class','class_and_level');
 if(!c.classLevels.length&&classText)for(const part of classText.split(/\s*\/\s*|;/)){const m=part.trim().match(/^(.+?)\s+(\d+)$/);if(m)addClass(m[1],Number(m[2]));else warn('Could not separate class and level in '+part+'; the original class text is retained.');}
 c.classes=c.classLevels.map(e=>e.name+' '+e.level).join(' / ')||classText||'';
 const totals=classTotals(c.classLevels,c.ancestry),explicitLevel=core.n('level','character_level');
 c.level=explicitLevel??(totals.level||1);c.hitDice=core.t('hitdice','hit_dice')||totals.hitDice;
 if(!c.classes)warn('No class was identified. Add the character’s classes before enabling calculations.');
 if(explicitLevel!==undefined&&totals.level&&totals.level!==explicitLevel)warn('The total level differs from the class-level sum; review racial Hit Dice or gestalt progression.');
 c.bab=core.n('bab','base_attack_bonus')??totals.bab;
 for(const e of c.classLevels){const d=findClass(e.classId);if(!d)continue;
  if(d.levels.some(row=>row.slots)){const p=makeCaster(d,Math.min(e.level,d.levels.length),c.scores[castingAbility(d)]);p.casting!.automatic=false;c.casters.push(p);}
  if(d.manifesting||['psion','wilder','psychic-warrior','soulknife'].includes(d.id)){const p=makePsionic(d,Math.min(e.level,d.levels.length),c.scores[manifestingAbility(d)]);p.manifesting!.automatic=false;c.psionics.push(p);}
 }
 c.hp=core.n('hitpoints','hp','current_hp','hit_points')??0;
 c.maxHp=reader.max('hitpoints','hp','hit_points')??core.n('hitpoints_max','hp_max','max_hp','hit_points_max')??Math.max(0,c.hp);
 if(!reader.present('hitpoints_max','hp_max','max_hp','hit_points_max')&&reader.max('hitpoints','hp','hit_points')===undefined)warn('Maximum HP was not recorded; review it before play.');
 c.tempHp=core.n('temphp','temp_hp','temporary_hp')??0;c.nonlethal=core.n('nonlethaldamage','nonlethal','nonlethal_damage')??0;
 const speed=reader.read(['speed','movement','land_speed'],v=>roll20Number(v)??(typeof v==='string'&&/^\d+\s*(?:ft\.?|feet)$/i.test(v.trim())?Number(v.match(/\d+/)![0]):undefined));if(speed!==undefined)c.speed=speed;
 c.automation.baseSpeed=c.speed;c.automation.baseSize=c.size;
 for(const [coin,name] of [['cp','copper'],['sp','silver'],['gp','gold'],['pp','platinum']] as const)c.coins[coin]=core.n(name,coin)??0;
 c.defense.armor=core.b('armorworn')===false?0:core.n('acitembonus','armor_bonus','armor')??0;
 c.defense.shield=core.b('shieldworn')===false?0:core.n('shieldbonus','shield_bonus')??0;
 c.defense.natural=core.n('totalnaturalarmorbonus','acnaturalarmor','armorclassnaturalarmor','natural_armor')??0;
 c.defense.deflection=core.n('totaldeflectionbonus','acdeflectionmod','armorclassdeflectionmod','deflection')??0;
 c.defense.dodge=core.n('totaldodgebonus','acdodgemod','armorclassdodgemod','dodge')??0;
 c.defense.misc=core.n('totalmiscacbonus','acmiscmod','armorclassmiscmod','ac_misc')??0;
 c.defense.dexCap=core.b('armorworn')===false?100:core.n('acitemdex','max_dex','dex_cap')??100;
 // Some exports record deductions as positive magnitudes. Normalize each
 // component before adding, so mixed armor/shield signs cannot cancel out.
 const checkPenalty=(value=0)=>{if(value>0){warn('Positive armor check penalties were converted to negative modifiers.');return -value;}return value;};
 const totalCheckPenalty=core.n('armorcheckpenalty','armor_check_penalty');
 c.defense.checkPenalty=totalCheckPenalty!==undefined?checkPenalty(totalCheckPenalty):
  (core.b('armorworn')===false?0:checkPenalty(core.n('acitemcheckpenalty')))+(core.b('shieldworn')===false?0:checkPenalty(core.n('shieldcheckpenalty')));
 c.defense.spellFailure=core.n('arcane_spell_failure')??sum(core,['arcanespellfailure',...(core.b('armorworn')===false?[]:['acitemspellfailure']),...(core.b('shieldworn')===false?[]:['shieldspellfailure'])]);
 c.defense.sr=core.n('spellresistance','sr','spell_resistance')??0;c.defense.dr=core.t('damagereduction','dr','damage_reduction')||'';
 c.defense.resistances=['resistances','energy_resistance','immunities'].map(k=>core.t(k)).filter(Boolean).join('\n');
 for(const [save,prefix] of [['fort','fortitude'],['ref','reflex'],['will','will']] as const){
  c.saves[save].base=core.n(prefix+'base',save+'_base')??totals[save];
  c.saves[save].misc=sum(core,['magicmod','miscmod','tempmod','actionmod','epicsavemod'].map(k=>prefix+k));
  const total=core.n(prefix,save,save+'_total');if(total!==undefined)c.saves[save].misc+=total-sheetTotals(c).saves[save];
 }
 c.initiative=sum(core,['initmiscmod','inittempmod','initactionmod']);const init=core.n('init','initiative','initiative_bonus');if(init!==undefined)c.initiative+=init-sheetTotals(c).initiative;
 c.grapple=sum(core,['grapplemiscmod','grappletempmod']);const grapple=core.n('grapple','grapple_bonus');if(grapple!==undefined)c.grapple+=grapple-sheetTotals(c).grapple;
 const ac=core.n('armorclass','ac');if(ac!==undefined)c.defense.misc+=ac-sheetTotals(c).ac;
 for(const [field,aliases] of [['touch',['touchac','touch_ac']],['flat',['flatfootedac','flat_footed_ac']]] as const){const total=core.n(...aliases);if(total!==undefined&&total!==sheetTotals(c)[field])warn('Imported '+field+' AC differs from the component totals; its original total is preserved for review.');}

 const knowledge:Record<string,string>={arcana:'knowarcana','architecture and engineering':'knowengineer',dungeoneering:'knowdungeon',geography:'knowgeography',history:'knowhistory',local:'knowlocal',nature:'knownature','nobility and royalty':'knownobility',religion:'knowreligion','the planes':'knowplanes',psionics:'knowpsionic'};
 const skillTotals:Array<[Skill,number]>=[];
 function fillSkill(skill:Skill,r:Scope,prefix:string){
  skill.ranks=r.n(prefix+'ranks',prefix+'_ranks')??skill.ranks;skill.misc=sum(r,[prefix+'miscmod',prefix+'tempmod',prefix+'actionmod']);
  const trained=r.b(prefix+'classskill');if(trained!==undefined)skill.classSkill=trained;
  const total=r.n(prefix);if(total!==undefined)skillTotals.push([skill,total]);
 }
 for(const s of c.skills){const specialty=s.name.match(/^Knowledge \((.+)\)$/)?.[1],prefix=specialty?knowledge[specialty]:normalized(s.name);if(prefix)fillSkill(s,core,prefix);}
 for(const kind of ['Craft','Perform','Profession'])for(let i=1;i<=3;i++){const prefix=kind.toLowerCase()+i,name=core.t(prefix+'name');if(!name)continue;const base=c.skills.find(s=>s.name===kind)!;const s={...base,id:uid(),name:kind+' ('+name+')',ranks:0,misc:0};fillSkill(s,core,prefix);c.skills.push(s);}
 for(const row of Object.values(groups.skills?.rows||{})){
  const r=rowScope(row),name=r.t('otherskillname','name');if(!name)continue;
  const s=c.skills.find(s=>normalized(s.name)===normalized(name))||{id:uid(),name,ability:ability(r.t('otherskillstat','ability'))||'INT',ranks:0,misc:0,trained:false,armor:0,classSkill:false};
  if(!c.skills.includes(s))c.skills.push(s);s.ranks=r.n('otherskillranks','ranks')??0;s.misc=sum(r,['otherskillmiscmod','otherskilltempmod','otherskillactionmod','misc']);
  const total=r.n('otherskill','total');if(total!==undefined)skillTotals.push([s,total]);
 }
 // Apply total offsets after all ranks are known, so synergy is not added twice.
 for(const [s,total] of skillTotals)s.misc+=total-skillBonus(c,s);

 function addFeature(name:string,description:string,kind:Character['features'][number]['kind'],magic=false,max=0,used=0){
  const known=kind==='Feat'?named(name,feats):undefined;
  c.features.push({id:uid(),name:known?.name||name,kind,description:description||known?.description||'',source:known?.source||'Roll20 import',max,used,...(magic?{magic:true}:{})});
 }
 const featText=core.t('feats');if(featText)for(const line of featText.split(/[\n;]+/).filter(s=>s.trim())){const name=line.trim();if(name.length<=160)addFeature(name,'','Feat');else addFeature('Imported feat notes',name,'Other');}
 for(const [field,name,kind] of [['classabilities','Imported class abilities','Class feature'],['racialabilities','Imported racial abilities','Racial trait']] as const){const value=core.t(field);if(value)addFeature(name,value,kind);}
 for(const section of ['feat','feats','ability','abilities','specialability','specialabilities'])for(const row of Object.values(groups[section]?.rows||{})){
  const r=rowScope(row),name=r.t('name','featname','abilityname');if(name)addFeature(name,r.t('description','desc','notes')||'',/^feats?$/.test(section)?'Feat':'Class feature',r.b('magic','spelllike')||false,r.n('max','uses')??0,r.n('used')??0);
 }
 function addWeapon(r:Scope){
  const name=r.t('weaponname','npcattackname','name','attackname');if(!name)return;
  const w=newWeapon(),attackStat=r.t('weaponstat','npcattackstat','ability');w.name=name;w.ability=ability(attackStat)||'STR';
  if(attackStat&&!ability(attackStat))warn(name+': unrecognized attack ability; review the placeholder Strength selection.');
  w.range=r.t('weaponrange','npcattackrange','range','reach')||'Melee';w.attackMode=w.ability==='DEX'&&w.range!=='Melee'?'ranged':'melee';
  const damageStat=r.t('weapondamagestat','npcattackdamagestat','damageability');
  const selector=damageStat?.toLowerCase().replace(/\s+/g,''),mods=sheetTotals(c).mods;
  let damageOffset=0;
  w.role=r.t('weaponhand','npcattackhand')==='off-hand'?'off':'main';
  if(selector==='(floor(@{str-mod}/2))'||selector==='(@{str-mod}+floor(@{str-mod}/2))'){
   w.strength=selector.startsWith('(floor')?'off':'two';
   const source=(w.strength==='two'?mods.STR:0)+Math.floor(mods.STR/2);
   const native=mods.STR>0?Math.floor(mods.STR*(w.strength==='two'?1.5:.5)):mods.STR;
   damageOffset=source-native;
   if(damageOffset)warn(name+': the source Strength formula differs from the standard negative modifier; its difference is retained as a manual damage adjustment.');
  }else if(!selector||ability(damageStat)==='STR')w.damageAbility='STR';
  else if(ability(damageStat)==='DEX')w.damageAbility='DEX';
  else {
   w.damageAbility='none';
   // Only these literal sheet selectors are recognized; never evaluate export code.
   const fixed:Record<string,number>={
    '(@{str-mod}+@{int-mod})':mods.STR+mods.INT,
    '(floor(@{str-mod}/2)+@{int-mod})':Math.floor(mods.STR/2)+mods.INT,
    '(@{str-mod}+@{dex-mod})':mods.STR+mods.DEX,
    '(@{str-mod}+@{dex-mod}+@{int-mod})':mods.STR+mods.DEX+mods.INT,
   };
   const a=ability(damageStat),value=a?mods[a]:Object.hasOwn(fixed,selector)?fixed[selector]:roll20Number(selector);
   if(value!==undefined){damageOffset=value;if(value||a)warn(name+': its unusual damage ability is preserved as a fixed adjustment; update it if ability scores change.');}
   else if(selector!=='none')warn(name+': unrecognized damage ability formula; no ability bonus was guessed. Review it before rolling.');
  }
  w.ammo=r.n('weaponammunition','npcattackammunition','ammo')??0;
  const dice=r.n('weapondicenumber','npcattackdicenumber'),sides=r.n('weapondicetype','npcattackdicetype');
  const fullDamage=r.t('damage','dmg','weapondamage','npcattackdamage');
  if(dice!==undefined&&sides!==undefined){
   try{w.damage=parseDiceFormula(dice+'d'+sides).formula;w.damageExtra=damageOffset+sum(r,['weaponbonusdamage','weaponspecialize','weaponenh','npcattackbonusdamage','npcattackspecialize','npcattackenh']);}
   catch{w.damage='0';w.damageAbility='none';warn(name+': recorded damage dice are unsupported; review them before rolling.');}
  }else if(fullDamage){try{w.damage=parseDiceFormula(fullDamage).formula;w.damageAbility='none';}catch{w.damage='0';w.damageAbility='none';warn(name+': damage is a Roll20 formula; review it before rolling.');}}
  else {w.damage='0';w.damageAbility='none';warn(name+': no damage dice were recorded; enter them before rolling.');}
  w.attack=sum(r,['weaponenh','weaponfocus','npcattackenh','npcattackfocus','attackmisc']);
  const total=r.n('weaponattackcalc','npcattackattackcalc','attack','attackbonus');if(total!==undefined)w.attack+=total-weaponAttack(c,w);
  w.crit=r.t('crit','critical')||`${r.n('weaponcritmin','npcattackcritmin')??20} / ×${r.n('weaponcritmult','npcattackcritmult')??2}`;
  w.notes=r.t('weaponspecialproperties','npcattackspecialproperties','notes','description')||'';c.weapons.push(w);
 }
 for(let i=1;i<=10;i++)addWeapon(scope('',s=>s.startsWith('weapon')?s.replace(/^weapon/,'weapon'+i):'__fixed_weapon_'+i+'_'+s));
 for(const section of ['weapon','weapons','attack','attacks'])for(const row of Object.values(groups[section]?.rows||{}))addWeapon(rowScope(row));
 for(const section of ['equipment','inventory','gear'])for(const row of Object.values(groups[section]?.rows||{})){
  const r=rowScope(row),name=r.t('equipmentname','itemname','name');if(!name)continue;
  c.gear.push({id:uid(),name,qty:r.n('equipmentquantity','quantity','qty')??1,weight:r.n('equipmentweight','weight')??0,carried:r.b('carried')??true,equipped:r.b('equipped')??false,notes:[r.t('equipmentnotes','notes','description'),r.t('equipmentlocation','location')].filter(Boolean).join('\n')});
 }

 const castingKinds=new Map<string,string>();
 const tradition=(p:Caster)=>castingKinds.get(p.id)||findClass(p.casting?.classId||p.name)?.casting?.type||(['wizard','sorcerer','bard','assassin'].includes(p.casting?.classId||'')?'arcane':'divine');
 const generic=new Map<string,Caster>();
 function casterFor(kind:string,row?:Scope){
  const selector=row?.t('class','caster','casterclass'),candidates=c.casters.filter(p=>(kind==='spell'||tradition(p)===kind)&&(!selector||normalized(p.name)===normalized(selector))&&!p.casting?.domain);
  if(candidates.length===1)return candidates[0];
  const label=selector||kind;if(generic.has(label))return generic.get(label)!;
  const p:Caster={id:uid(),name:'Imported '+label+' casting',list:'',ability:ability(core.t(kind+'castingstat'))||(kind==='divine'?'WIS':'INT'),level:core.n(kind+'casterlevel')??0,mode:'prepared',dcExtra:0,penetration:0,slots:Array.from({length:10},()=>({max:0,used:0})),spells:[],casting:{classId:'',domain:false,progression:null,levelAdjustment:0,slotAdjustments:Array(10).fill(0),automatic:false},notes:'Select a spell list and verify slots and casting ability.'};
  generic.set(label,p);castingKinds.set(p.id,kind);c.casters.push(p);warn('Could not uniquely match '+label+' casting to a class; a separate manual tradition preserves these spells.');return p;
 }
 for(const kind of ['arcane','divine'])if(core.n(kind+'casterlevel')!==undefined||Array.from({length:10},(_,i)=>core.n(kind+'spells'+i)).some(n=>n!==undefined)){
  const p=casterFor(kind);p.level=core.n(kind+'casterlevel')??p.level;p.ability=ability(core.t(kind+'castingstat'))||p.ability;p.penetration=core.n('spellpen')??0;
  for(let i=0;i<=9;i++){p.slots[i].max=core.n(kind+'spells'+i)??p.slots[i].max;p.slots[i].used=core.n(kind+'spells'+i+'_used')??0;}
 }
 function addSpell(r:Scope,section:string){
  const match=section.match(/^spells(\d+)([12])$/),suffix=match?match[1]+match[2]:'';
  const name=r.t('spellname'+suffix,'spellname','name');if(!name)return;
  const level=r.n('spelllevel'+suffix,'spelllevel','level')??(match?Number(match[1]):undefined);
  if(level!==undefined&&(level<0||level>9)){warn(name+': unsupported spell level '+level+'; the row remains in the original export.');return;}
  const p=casterFor(match?(match[2]==='1'?'divine':'arcane'):'spell',r),s=named(name,spells);
  const spellLevel=level??(s?.levels[p.list]);
  if(spellLevel===undefined){warn(name+': spell level is ambiguous; the row remains in the original export.');return;}
  const custom:Spell={id:'roll20-'+uid(),name,school:r.t('spellschool'+suffix,'school')||'',levels:{},levelText:String(spellLevel),components:r.t('spellcomponents'+suffix,'components')||'',castingTime:r.t('spellcastingtime'+suffix,'castingtime')||'',range:r.t('spellrange'+suffix,'range')||'',target:r.t('spelltea'+suffix,'target')||'',duration:r.t('spellduration'+suffix,'duration')||'',save:r.t('spellst'+suffix,'save')||'',resistance:r.t('spellsr'+suffix,'resistance')||'',description:r.t('description','desc')||'',source:'Roll20 import'};
  const prepared=r.n('spellprep'+suffix,'prepared','memorized')??(r.b('prepared','memorized')?1:0),spent=r.n('spellused'+suffix,'spent','used')??0;
  const domain=r.b('domain'+suffix,'domain')===true;
  let target=p;
  if(domain){const key=p.id+':domain';target=generic.get(key)!;if(!target){target={...structuredClone(p),id:uid(),name:p.name+' — imported domain spells',list:'',spells:[],slots:Array.from({length:10},()=>({max:0,used:0})),casting:p.casting?{...p.casting,domain:true}:undefined};generic.set(key,target);c.casters.push(target);warn('Domain spells use a separate manual tradition; select their domain list and review its slots.');}}
  const details=[r.t('notes','description','desc'),...Object.entries(custom).filter(([k,v])=>!['id','name','source','description','levels','levelText'].includes(k)&&v).map(([k,v])=>k+': '+v)].filter(Boolean).join('\n');
  target.spells.push({id:uid(),spellId:s?.id||custom.id,level:spellLevel,slotLevel:r.n('slotlevel','preparedlevel')??spellLevel,prepared,spent,formula:'',notes:details,custom:s?null:custom});
 }
 for(const [section,group] of Object.entries(groups)){
  for(const row of Object.values(group.rows)){
   const r=rowScope(row);
   if(/^(spell|spells|spellbook)$|^spells\d+[12]$/.test(section))addSpell(r,section);
   else if(/^spells\d+3$/.test(section)||section==='powers'){
    const suffix=section.replace(/^spells/,''),name=r.t('powername'+suffix,'powername','name');if(!name)continue;
    const p=c.psionics.length===1?c.psionics[0]:undefined;
    if(!p){warn(name+': no unique manifesting class; the power remains in the original export.');continue;}
    const known=named(name,powers),level=r.n('level','powerlevel')??Number(suffix.slice(0,-1));
    if(!Number.isInteger(level)||level<1||level>9){warn(name+': review its power level in the original export.');continue;}
    p.powers.push({id:uid(),name,powerId:known?.id||'',level,cost:r.n('cost','powercost')??2*level-1,formula:'',notes:r.t('notes','description')||''});
   }else if(/^spells\d+[46]$/.test(section)){
    const suffix=section.slice(6),name=r.t('invocationname'+suffix,'spellname'+suffix);if(name)addFeature(name,r.t('description','notes')||'Imported magic; consult the original Roll20 fields for its full details.','Class feature',true,r.n('spellprep'+suffix)??0,r.n('spellused'+suffix)??0);
   }else if(/^notes[12]$/.test(section)){const n=section.slice(-1),body=r.t('note'+n+'body');if(body)c.notes+=[c.notes?'\n\n':'',r.t('note'+n+'date'),body].filter(Boolean).join('\n');}
  }
 }
 // Preserve aggregate power-point bookkeeping without counting a shared pool twice.
 const pp=core.n('powerpoints','power_points'),ppMax=reader.max('powerpoints','power_points')??core.n('powerpoints_max','power_points_max');
 if(c.psionics.length===1){const p=c.psionics[0];p.level=core.n('manifesterlevel','manifester_level')??p.level;p.max=ppMax??p.max;if(pp!==undefined){if(pp>p.max){p.max=pp;warn('Power points exceed the recorded maximum; review the imported reserve.');}p.spent=p.max-pp;}}
 else if(pp!==undefined||ppMax!==undefined)warn('Power points could not be assigned to one manifesting class; review the original reserve before manifesting.');
 // Spontaneous sheets commonly record uses on individual spell rows.
 for(const p of c.casters)if(p.mode==='spontaneous')for(let level=0;level<=9;level++)p.slots[level].used=Math.max(p.slots[level].used,p.spells.filter(s=>s.slotLevel===level).reduce((n,s)=>n+s.spent,0));
 report.mapped=reader.used.size;report.unmapped=data.attributes.filter((_,i)=>!reader.used.has(i)).map(a=>a.name);
 warn('Automatic calculations are off to preserve imported totals. Review the sheet before enabling them.');
 if(report.unmapped.length)warn('Unmapped fields, formulas, macros, and custom sections remain in the attached original export.');
 report.warnings=[...warnings];
 c.roll20Import={format:'roll20-dnd35-export',version:data.version,exportedAt:data.exportedAt,sourceCharacterId:data.character.id,raw:JSON.parse(json),report};
 const result=characterSchema.safeParse(c);
 if(!result.success)throw Error('The imported values exceed the character schema: '+result.error.issues.slice(0,3).map(i=>i.path.join('.')+' '+i.message).join('; ')+'. The source export has not been changed.');
 if(new TextEncoder().encode(JSON.stringify({data:result.data})).length>980000)throw Error('This export and its mapped character exceed the 1 MB save limit. Keep the original export; no character has been imported.');
 return {character:result.data,report};
}
