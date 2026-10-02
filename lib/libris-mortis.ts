import data from './libris-mortis-data.json' with {type:'json'};
import {createMonsterSheet,creatureAbilityModifier,naturalAttackRoutine} from './creatures.ts';
import {characterSchema,newWeapon,uid,type Character} from './model.ts';
import {naturalAttackSchema,type CreatureProfile} from './creature-schema.ts';
import {sheetTotals,skillBonus,weaponAttack,weaponDamage} from './rules.ts';

type Published = {id:string,name:string,source:string,sizeType:string,stats:Record<string,string>,templateExample:boolean};
const records=data as unknown as Published[];
const normalized=(s:string)=>s.replace(/[−–]/g,'-').replace(/(\d+d\d+)\s*([+-])\s*(\d+)/g,'$1$2$3').replace(/\s+/g,' ').trim();
const number=(s:string)=>s.includes('/')?Number(s.split('/')[0])/Number(s.split('/')[1]):Number(s);
export const librisMortisBestiary=records.map(e=>({id:e.id,name:e.name,type:e.sizeType,cr:number(e.stats['Challenge Rating']),source:e.source,book:'Libris Mortis'}));
const split=(s:string)=>s.split(/,(?![^()]*\))/).map(v=>v.trim()).filter(Boolean);
const abilityMap:Record<string,'STR'|'DEX'|'CON'|'INT'|'WIS'|'CHA'>={Str:'STR',Dex:'DEX',Con:'CON',Int:'INT',Wis:'WIS',Cha:'CHA',Strength:'STR',Dexterity:'DEX',Constitution:'CON',Intelligence:'INT',Wisdom:'WIS',Charisma:'CHA'};

/** Printed totals are authoritative, including source exceptions. No PC recompute. */
export function createLibrisMortisMonster(id:string,name?:string):Character {
 const entry=records.find(e=>e.id===id);if(!entry)throw Error('Unknown Libris Mortis preset.');
 const s=entry.stats,get=(key:string)=>normalized(s[key]||'');
 const scores=Object.fromEntries([...get('Abilities').replace(/Con —, (\d+), Wis/,'Con —, Int $1, Wis').matchAll(/(Str|Dex|Con|Int|Wis|Cha)\s+(\d+|—|-)/g)].map(m=>[abilityMap[m[1]],/^\d+$/.test(m[2])?Number(m[2]):null])) as Record<keyof Character['scores'],number|null>;
 const size=entry.sizeType.split(' ')[0] as Character['size'];
 const type=entry.sizeType.match(/Undead|Construct|Animal|Vermin|Humanoid|Giant/)![0] as CreatureProfile['type'];
 const subtypes=entry.sizeType.match(/\((.+)\)/)?.[1].split(',').map(s=>s.trim())||[];
 const hd=[...get('Hit Dice').matchAll(/(\d+)d(\d+)/g)];
 const totalHd=hd.reduce((n,m)=>n+Number(m[1]),0);
 const c=createMonsterSheet({name:name?.trim()||entry.name,size,scores,speed:Number(get('Speed').match(/^(\d+)/)?.[1]||0),maxHp:Number(get('Hit Dice').match(/\((\d+) hp\)/)![1]),creature:{type,subtypes,source:entry.source,racialHitDice:totalHd,hitDie:Number(hd[0][2]) as CreatureProfile['hitDie'],nonabilities:Object.entries(scores).filter(([,v])=>v===null).map(([a])=>a as keyof typeof scores),challengeRating:number(get('Challenge Rating'))}});
 c.bab=Number(get('Base Attack/Grapple').match(/^[+-]?\d+/)?.[0]??c.bab);
 c.hitDice=get('Hit Dice').replace(/ \(.*$/,'');c.alignment=s.Alignment||'';
 c.initiative=(/^[+-]?\d+/.test(get('Initiative'))?parseInt(get('Initiative'),10):creatureAbilityModifier(c,'DEX'))-creatureAbilityModifier(c,'DEX');
 const grapple=get('Base Attack/Grapple').match(/\/([+-]?\d+)/);
 if(grapple)c.grapple=Number(grapple[1])-sheetTotals(c).grapple;
 for(const [key,ability] of [['fort','CON'],['ref','DEX'],['will','WIS']] as const){const value=get('Saves').match(new RegExp(key+'\\s*([+-]?\\d+)','i'));if(value)c.saves[key]={base:Number(value[1])-creatureAbilityModifier(c,ability),misc:0};}
 const ac=get('Armor Class')||(get('Speed').match(/ArmorClass: (.+)/)?.[1]||'');
 for(const [key,label] of [['natural','natural'],['armor','armor'],['shield','shield'],['deflection','deflection'],['dodge','dodge']] as const){const match=ac.match(new RegExp('([+-]\\d+) '+label+'\\b'));if(match)c.defense[key]=Number(match[1]);}
 c.defense.misc=Number(ac.match(/^\d+/)![0])-sheetTotals(c).ac;
 for(const mode of ['burrow','climb','swim','fly'] as const){const match=get('Speed').match(new RegExp(mode+' (\\d+)','i'));if(match)c.creature!.movement[mode]=Number(match[1]);}
 c.creature!.movement.maneuverability=(get('Speed').match(/\((perfect|good|average|poor|clumsy)\)/)?.[1]||null) as CreatureProfile['movement']['maneuverability'];
 const space=get('Space/Reach')||get('Face/Reach')||(get('Full Attack').match(/(?:Space|Face)\/Reach: (.+)/)?.[1]||'');
 const distances=[...space.matchAll(/(\d+(?:\.\d+)?)\s*ft\./g)];if(distances.length>=2){c.creature!.space=Number(distances[0][1]);c.creature!.reach=Number(distances[1][1]);}
 const qualities=get('Special Qualities')||get('Special Quality');
 c.creature!.specialAttacks=split(s['Special Attacks']||'').filter(x=>!['—','-'].includes(x));
 c.creature!.specialQualities=split(s['Special Qualities']||s['Special Quality']||'');
 c.creature!.senses=split(qualities).filter(x=>/vision|sight|sense|scent/i.test(x)).join('; ');
 c.creature!.immunities=split(qualities).filter(x=>/immun|undead traits|construct traits|vermin traits/i.test(x)).join('; ');
 c.creature!.vulnerabilities=split(qualities).filter(x=>/vulnerab/i.test(x)).join('; ');
 c.defense.dr=qualities.match(/damage reduction ([^,;]+)/i)?.[1]||'';
 c.defense.sr=Number(qualities.match(/spell resistance (\d+)/i)?.[1]||0);
 c.defense.resistances=split(qualities).filter(x=>/resistance/i.test(x)&&!/spell resistance/i.test(x)).join('; ');
 for(const key of ['environment','organization','treasure','advancement'] as const)c.creature![key]=s[key[0].toUpperCase()+key.slice(1)]||'';
 for(const name of split(s.Feats||''))if(name!=='—')c.features.push({id:uid(),name:name.replace(/[†*]/g,''),kind:'Feat',description:'Published feat; its fixed bonuses are already included in this preset. Resolve conditional benefits using the source.',source:entry.source,max:0,used:0});
 for(const name of [...c.creature!.specialAttacks,...c.creature!.specialQualities])c.features.push({id:uid(),name,kind:'Other',description:'Resolve this ability using the linked source. Targets, saving throws, conditions, transformations, spell choices and ongoing effects require manual handling.',source:entry.source,max:0,used:0});
 for(const part of split(get('Skills'))){const m=part.match(/^(.+?) ([+-]\d+)/);if(!m)continue;let skill=c.skills.find(sk=>sk.name.toLowerCase()===m[1].toLowerCase());if(!skill){const family=m[1].split(' (')[0];const base=c.skills.find(sk=>sk.name.startsWith(family));skill={id:uid(),name:m[1],ability:base?.ability||'INT',ranks:0,misc:0,trained:base?.trained??true,armor:base?.armor||0,classSkill:false};c.skills.push(skill);}skill.ranks=Math.max(0,Number(m[2])-creatureAbilityModifier(c,skill.ability));skill.misc=Number(m[2])-skillBonus(c,skill);}
 c.creature!.notes='Published statistics; fixed feat, equipment and aura bonuses are included. Resolve special abilities, conditional bonuses and attack alternatives manually using the source. Editing HD, feats or equipment does not recalculate these printed bonuses.'+(entry.templateExample?' This is a published example of a template, not a template applied to another character.':'');
 if(!/^[+-]?\d+/.test(get('Base Attack/Grapple')))c.creature!.notes+=' Source base attack and grapple are unspecified (—); the sheet uses the creature type BAB pending a DM ruling.';
 if(!/^[+-]?\d+/.test(get('Initiative')))c.creature!.notes+=' Source initiative is unspecified (—); the sheet uses Dexterity pending a DM ruling.';
 c.notes=Object.entries(s).map(([key,value])=>key+': '+value).join('\n')+'\nSource: '+entry.source;
 if(id==='lm-evolved-undead')c.creature!.notes+=' Source omits the Int label before 14; the six-score order identifies it as Intelligence. Original text is preserved in Notes.';
 if(id==='lm-half-vampire'){c.creature!.racialHitDice=2;c.classLevels=[{id:uid(),classId:'barbarian',name:'Barbarian',level:1,notes:'Published template example; totals are manual.'}];c.classes='Barbarian 1';}
 if(id==='lm-gravetouched-ghoul'){c.creature!.racialHitDice=0;c.classLevels=[{id:uid(),classId:'monk',name:'Monk',level:6,notes:'Published template example; totals are manual.'}];c.classes='Monk 6';}
 if(id==='lm-necropolitan'){c.creature!.racialHitDice=0;c.classLevels=[{id:uid(),classId:'wizard',name:'Wizard',level:5,notes:'Published template example; spell preparation is manual.'}];c.classes='Wizard 5';}
 if(id==='lm-swarm-shifter'){c.creature!.racialHitDice=8;c.classLevels=[{id:uid(),classId:'cleric',name:'Cleric',level:13,notes:'Published template example; spell preparation is manual.'}];c.classes='Cleric 13';}
 importAttacks(c,get('Full Attack'));
 // Keep discrepancies visible rather than silently replacing a published total.
 const total=sheetTotals(c),printedTouch=Number(ac.match(/touch (\d+)/)?.[1]),printedFlat=Number(ac.match(/flat-footed (\d+)/)?.[1]);
 if(total.touch!==printedTouch||total.flat!==printedFlat)c.creature!.notes+=' Source AC exception: printed touch '+printedTouch+', flat-footed '+printedFlat+'; sheet components yield '+total.touch+'/'+total.flat+'. Use the published values when appropriate.';
 if(['lm-dream-vestige','lm-raiment','lm-revived-fossil','lm-skin-kite','lm-tomb-mote'].includes(id))c.creature!.notes+=' The source has an unusual HD/HP or ability/aura total. The printed stat block in Notes is retained unchanged; review with the DM.';
 return characterSchema.parse(c);
}

function importAttacks(c:Character,full:string){
 const matches=[...full.matchAll(/(?:^|\bplus |\band |\bor )(?:(\d+) )?([\w +'-]+?)\s+([+-]\d+(?:\/[+-]\d+)*)\s+(melee(?: touch)?|ranged)(?: touch)?\s*[([](\d+d\d+)([+-]\d+)?([^)]*)[)\]]/g)];
 for(const [i,m] of matches.entries()){
  const name=m[2].trim(),count=Number(m[1]||1),bonuses=m[3].split('/').map(Number),damageBonus=Number(m[6]||0),ranged=m[4]==='ranged';
  const damageAbility=m[7].match(/\b(Str(?:ength)?|Dex(?:terity)?|Con(?:stitution)?|Int(?:elligence)?|Wis(?:dom)?|Cha(?:risma)?)\b/)?.[1];
  const onlyAbility=!!damageAbility&&!/plus/.test(m[7]);
  const natural=/claw|bite|slam|touch|tendril|slap|sleeve|talon|loop/i.test(name)&&!/^Large scythe/i.test(name);
  if(natural){
   const secondary=i>0&&!/^or /.test(m[0]);
   const a=naturalAttackSchema.parse({id:uid(),name,count,role:secondary?'secondary':'primary',ability:(/touch/i.test(name+m[4])&&c.creature!.nonabilities.includes('STR')||c.features.some(f=>f.name==='Weapon Finesse'))?'DEX':'STR',damage:m[5],strengthMultiplier:onlyAbility||/touch/i.test(name)?0:secondary?.5:1,damageKind:onlyAbility?(/drain/.test(m[7])?'ability-drain':'ability-damage'):'hit-points',damageAbility:onlyAbility?abilityMap[damageAbility!]:null,criticalRange:Number(m[7].match(/\/(\d+)-20/)?.[1]||20),notes:full});
   c.creature!.naturalAttacks.push(a);const computed=naturalAttackRoutine(c).find(r=>r.id===a.id+':0')!;a.attackBonus+=bonuses[0]-computed.attackBonus;
   const modifier=Number(computed.damageFormula.slice(a.damage.length)||0);a.damageBonus+=damageBonus-modifier;
  }else{
   const w={...newWeapon(),name,ability:ranged?'DEX' as const:'STR' as const,damage:m[5],damageAbility:'none' as const,damageExtra:damageBonus,attackMode:ranged?'ranged' as const:'melee' as const,range:ranged?'See published range':'Melee',criticalRange:Number(m[7].match(/\/(\d+)-20/)?.[1]||20),criticalMultiplier:Number(m[7].match(/×(\d+)/)?.[1]||2),notes:full,attackSequence:Array.from({length:count},()=>bonuses.map(b=>b-bonuses[0])).flat()};
   w.attack=bonuses[0]-weaponAttack(c,w);c.weapons.push(w);weaponDamage(c,w);
  }
  for(const rider of m[7].matchAll(/plus (\d+d\d+) (Str(?:ength)?|Dex(?:terity)?|Con(?:stitution)?|Int(?:elligence)?|Wis(?:dom)?|Cha(?:risma)?) (drain|damage)/g))c.creature!.naturalAttacks.push(naturalAttackSchema.parse({id:uid(),name:name+' rider',damage:rider[1],attackRoll:false,strengthMultiplier:0,damageKind:rider[3]==='drain'?'ability-drain':'ability-damage',damageAbility:abilityMap[rider[2]],notes:'Apply only after a successful '+name+' hit. '+full}));
 }
 for(const rider of full.matchAll(/plus (\d+d\d+)([+-]\d+)? (cold|fire|electricity|acid|negative energy)\b/gi))c.creature!.naturalAttacks.push(naturalAttackSchema.parse({id:uid(),name:rider[3]+' rider',damage:rider[1],damageBonus:Number(rider[2]||0),attackRoll:false,strengthMultiplier:0,notes:'Apply this '+rider[3]+' damage only after the corresponding hit. '+full}));
 const swarm=full.match(/^Swarm \((\d+d\d+)/);if(swarm)c.creature!.naturalAttacks.push(naturalAttackSchema.parse({id:uid(),name:'Swarm',damage:swarm[1],attackRoll:false,strengthMultiplier:0,notes:full+'; automatic swarm damage, no attack roll.'}));
}
