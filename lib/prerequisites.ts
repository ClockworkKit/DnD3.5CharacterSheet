import {krauBonus} from './racial-abilities.ts';
import catalog from './prerequisite-catalog.json' with {type:'json'};
import type {Character,Feat} from './model.ts';
import {newWeapon,uid} from './model.ts';
import {classTotals,findClass,type ClassDefinition} from './classes.ts';
import {classLevel,hasFeat,featName,featChoice,featChoiceKey} from './effects.ts';
import {effectiveScore,findRace} from './ancestry.ts';
import {equipmentCatalog,matchEquipment,weaponProficient,armorProficient} from './equipment.ts';
import {castingNumbers,psionicProgression} from './advancement.ts';

export type Requirement={label:string,state:'met'|'missing'|'confirm',key?:string,confirmed?:boolean};
export type Eligibility={eligible:boolean,requirements:Requirement[],status:'Eligible'|'Missing prerequisites'|'Needs confirmation'};
const norm=(s:string)=>s.toLowerCase().replace(/[–—-]/g,' ').replace(/\s+/g,' ').trim();
const clean=(s:string)=>s.replace(/\s*\[[^\]]*\]/g,'').trim();
const rank=(c:Character,name:string)=>Math.max(0,...c.skills.filter(s=>norm(s.name)===norm(name)||!name.includes('(')&&norm(s.name).startsWith(norm(name)+' (')).map(s=>s.ranks));
function result(requirements:Requirement[]):Eligibility {const missing=requirements.some(r=>r.state==='missing'),pending=requirements.some(r=>r.state==='confirm'&&!r.confirmed);return {eligible:!missing&&!pending,requirements,status:missing?'Missing prerequisites':pending?'Needs confirmation':'Eligible'};}
function checker(c:Character,id:string){const rows:Requirement[]=[];return {rows,check:(label:string,met:boolean)=>rows.push({label,state:met?'met':'missing'}),manual:(label:string)=>{const key=id+':'+label;rows.push({label,state:'confirm',key,confirmed:!!c.prerequisiteConfirmations?.[key]});}};}
export function prerequisiteText(f:Feat){return f.prerequisites??(f.description.match(/Prerequisites?:\s*([\s\S]*?)(?=\n\s*\n|\b(?:Benefits?|Normal|Special):|$)/i)?.[1]?.trim()||'');}
const weaponFeats=['weapon-focus','greater-weapon-focus','weapon-specialization','greater-weapon-specialization','improved-critical','rapid-reload','exotic-weapon-proficiency','martial-weapon-proficiency'];
const schools=['Abjuration','Conjuration','Divination','Enchantment','Evocation','Illusion','Necromancy','Transmutation'];
export function featChoices(c:Character,f:Feat):string[]{
 if(['spell-focus','greater-spell-focus'].includes(f.id))return schools;
 if(f.id==='skill-focus')return [...new Set(c.skills.map(s=>s.name))];
 if(weaponFeats.includes(f.id))return [...new Set([...equipmentCatalog.filter(e=>e.kind==='weapon'&&(f.id!=='exotic-weapon-proficiency'||e.category==='exotic')&&(f.id!=='martial-weapon-proficiency'||e.category==='martial')&&(f.id!=='rapid-reload'||['Crossbow, hand','Crossbow, heavy','Crossbow, light'].includes(e.name))).map(e=>e.name),...(['weapon-focus','greater-weapon-focus','weapon-specialization','greater-weapon-specialization'].includes(f.id)?['Grapple','Ray']:[])])];
 return [];
}
function proficient(c:Character,choice:string){if(norm(choice)==='grapple')return true;if(norm(choice)==='ray')return c.casters.some(p=>p.level>0);const e=matchEquipment(choice,'weapon');return !!e&&weaponProficient(c,{...newWeapon(),name:e.name,catalogId:e.id});}
function has(c:Character,name:string,choice?:string){
 if(hasFeat(c,name,choice))return true;
 if(name==='Armor Proficiency'&&choice){const e=equipmentCatalog.find(e=>e.kind==='armor'&&e.category===choice.toLowerCase());return !!e&&armorProficient(c,e);}
 if(name==='Shield Proficiency'){const e=matchEquipment('Heavy wooden shield','shield');return !!e&&armorProficient(c,e);}
 if(name==='Simple Weapon Proficiency')return equipmentCatalog.filter(e=>e.kind==='weapon'&&e.category==='simple').every(e=>proficient(c,e.name));
 if(name==='Martial Weapon Proficiency'&&choice)return proficient(c,choice);
 if(name==='Tower Shield Proficiency'){const e=equipmentCatalog.find(e=>e.kind==='shield'&&/tower/i.test(e.name));return !!e&&armorProficient(c,e);}
 if(name==='Improved Unarmed Strike'&&classLevel(c,'monk')>0)return true;
 if(name==='Scribe Scroll'&&classLevel(c,'wizard')>0)return true;
 if(name==='Endurance'&&classLevel(c,'ranger')>=3)return true;
 if(name==='Track'&&classLevel(c,'ranger')>0)return true;
 if(name==='Wild Talent'&&classLevel(c,'soulknife')>0)return true;
 return false;
}
function casterLevel(c:Character){return Math.max(0,...c.casters.map(p=>p.casting?.automatic&&c.automation.enabled?castingNumbers(c,p).level:p.level),classLevel(c,'artificer')+ (classLevel(c,'artificer')?2:0),(classLevel(c,'warlock')?classLevel(c,'warlock')+krauBonus(c,classLevel(c,'warlock')):0),(classLevel(c,'dragonfire-adept')?classLevel(c,'dragonfire-adept')+krauBonus(c,classLevel(c,'dragonfire-adept')):0),(classLevel(c,'shadowcaster')?classLevel(c,'shadowcaster')+krauBonus(c,classLevel(c,'shadowcaster')):0),classLevel(c,'factotum')>=2?classLevel(c,'factotum')+krauBonus(c,classLevel(c,'factotum')):0);}
function prerequisiteBab(c:Character){const totals=classTotals(c.classLevels,c.ancestry);return !c.automation.enabled||totals.missing.length?c.bab:c.automation.overrides.bab??totals.bab+(c.automation.adjustments.bab||0);}
export function featEligibility(c:Character,f:Feat,choice=''):Eligibility{
 const q=checker(c,'feat:'+f.id+':'+choice),{check,manual}=q;
 const choices=featChoices(c,f);choice=choices.find(v=>featChoiceKey(v)===featChoiceKey(choice))||choice;if(choices.length)check('Select a weapon, skill or school',choices.includes(choice));
 const name=clean(f.name),intrinsic=featChoice(name),baseName=name.replace(/\s*\(.*/,''),repeat=f.repeatable??['toughness','extra-turning','spell-mastery'].includes(f.id);
 check(choices.length?'Not already selected for '+(choice||'this choice'):'Not already selected',repeat&&!choices.length||!has(c,baseName,choices.length?choice:intrinsic));
 const bab=prerequisiteBab(c);
 for(const raw of prerequisiteText(f).split(/,\s*(?![^()]*\))/)){
  const s=raw.trim().replace(/\.$/,'');if(!s)continue;let m:RegExpMatchArray|null;
  if((m=s.match(/^(Str|Dex|Con|Int|Wis|Cha) (\d+)$/i)))check(s,effectiveScore(c,m[1].toUpperCase() as keyof Character['scores'],true)>=+m[2]);
  else if((m=s.match(/^base attack bonus \+(\d+)/i))){check('Base attack bonus +'+m[1],bab>=+m[1]);if(/plus Str 13/i.test(s)&&/bastard|dwarven waraxe|waraxe, dwarven/i.test(choice))check('Strength 13 for '+choice,effectiveScore(c,'STR',true)>=13);}
  else if((m=s.match(/^(caster|character|fighter|wizard) level (\d+)/i))){const kind=m[1].toLowerCase(),n=kind==='caster'?casterLevel(c):kind==='character'?(classTotals(c.classLevels,c.ancestry).level||c.level):kind==='fighter'?classLevel(c,'fighter')+Math.max(0,classLevel(c,'warblade')-2):classLevel(c,kind);check(s,n>=+m[2]);}
  else if((m=s.match(/^(.+?) (\d+) ranks?$/i)))check(s,rank(c,m[1])>=+m[2]);
  else if(/^(proficiency with selected weapon|proficient with weapon|weapon proficiency \(crossbow type chosen\))$/i.test(s))check('Proficiency with '+(choice||'selected weapon'),proficient(c,choice));
  else if((m=s.match(/^(.+?) with selected weapon$/i)))check(m[1]+' ('+(choice||'selected weapon')+')',has(c,m[1],choice));
  else if(/ability to turn or rebuke creatures/i.test(s))check(s,classLevel(c,'cleric')>0||classLevel(c,'paladin')>=4||classLevel(c,'blackguard')>=3||classLevel(c,'dread-necromancer')>0||c.features.some(f=>/^(turn|rebuke)\b/i.test(f.name)));
  else if(/^wild shape ability$/i.test(s))check(s,classLevel(c,'druid')>=5||c.features.some(f=>/^wild shape\b/i.test(f.name)));
  else if(f.id==='improved-familiar')manual(s);
  else {m=s.match(/^(.+?)\s*\((.+)\)$/);check(s,has(c,m?m[1]:s,m?.[2]));}
 }
 // This prerequisite is in the opening instruction rather than a labeled paragraph.
 if(f.id==='greater-spell-focus')check('Spell Focus ('+(choice||'selected school')+')',has(c,'Spell Focus',choice));
 if(choices.includes('Ray')&&choice==='Ray')check('Spellcaster for ray selection',c.casters.some(p=>p.level>0));
 return result(q.rows);
}
export function addEligibleFeat(c:Character,f:Feat,choice='') {choice=featChoices(c,f).find(v=>featChoiceKey(v)===featChoiceKey(choice))||choice;if(!featEligibility(c,f,choice).eligible)throw new Error('Feat prerequisites are not met.');c.features.push({id:uid(),name:clean(f.name),choice,kind:'Feat',description:f.description,max:0,used:0,source:f.source});}
function traditionType(p:Character['casters'][number]){const d=findClass(p.casting?.classId||p.name);return d?.casting?.type||(['wizard','sorcerer','bard','assassin'].includes(d?.id||'')?'arcane':['cleric','druid','paladin','ranger','blackguard'].includes(d?.id||'')?'divine':'unknown');}
function canSpell(c:Character,level:number,type?:string,spontaneous=false){return c.casters.some(p=>(!type||traditionType(p)===type)&&(!spontaneous||p.mode==='spontaneous')&&(p.casting?.automatic&&c.automation.enabled?castingNumbers(c,p).slots:p.slots.map(s=>s.max)).some((max,i)=>i>=level&&max>0&&effectiveScore(c,p.ability,true)>=10+i));}
function knownSpells(c:Character,type?:string){
 const spells=new Map<string,{id:string,school:string,level:number}>();
 for(const p of c.casters){
  if(type&&traditionType(p)!==type)continue;
  const slots=p.casting?.automatic&&c.automation.enabled?castingNumbers(c,p).slots:p.slots.map(s=>s.max);
  const available=(level:number)=>slots[level]>0&&effectiveScore(c,p.ability,true)>=10+level;
  const d=findClass(p.casting?.classId||p.name);
  if(['cleric','druid','paladin','ranger','healer','beguiler','warmage','dread-necromancer'].includes(d?.id||''))for(const s of catalog.spells){const level=(s.levels as Partial<Record<string,number>>)[p.list];if(level!==undefined&&available(level))spells.set(s.id,{id:s.id,school:s.school,level});}
  for(const k of p.spells){if(!available(k.level))continue;const s=k.custom||catalog.spells.find(s=>s.id===k.spellId);if(s)spells.set(k.spellId,{id:k.spellId,school:s.school.split(/[ (]/)[0],level:k.level});}
 }
 return [...spells.values()];
}
function canPower(c:Character,level:number){return c.psionics.some(p=>{const d=findClass(p.manifesting?.classId||p.name),n=psionicProgression(c,p),row=d?.levels.find(r=>r.level===n.progression);return !!row&&Math.max(row.powerLevel||0,d?.id==='ardent'?Math.ceil(n.level/2):0)>=level&&n.level>=2*level-1&&p.max>=2*level-1&&effectiveScore(c,p.ability,true)>=10+level;});}
const alignment=(s:string)=>({lg:'lawful good',ng:'neutral good',cg:'chaotic good',ln:'lawful neutral',n:'true neutral',tn:'true neutral',cn:'chaotic neutral',le:'lawful evil',ne:'neutral evil',ce:'chaotic evil'}[s.trim().toLowerCase()]||s.trim().toLowerCase());
export function prestigeEligibility(c:Character,d:ClassDefinition):Eligibility {
 const q=checker(c,'class:'+d.id),{check,manual}=q;
 if(d.kind!=='Prestige')return result([]);
 const bab=prerequisiteBab(c);
 const spellRequirement=(s:string)=>{let matched=false;for(const m of s.matchAll(/(\d+)(?:st|nd|rd|th)(?:-level| level)? (arcane|divine) spells?/gi)){matched=true;check(m[0],canSpell(c,+m[1],m[2].toLowerCase()));}if(/without preparation/i.test(s)){matched=true;check(s,canSpell(c,0,'arcane',true));}
  if(/mage hand/i.test(s)){matched=true;check('Able to cast mage hand',knownSpells(c,'arcane').some(s=>s.id==='mage-hand'));}
  if(/lesser planar ally/i.test(s)){matched=true;check('Able to cast lesser planar ally',canSpell(c,4,'divine')&&(classLevel(c,'cleric')>0||c.casters.some(p=>p.spells.some(k=>['lesser-planar-ally','planar-ally-lesser'].includes(k.spellId)||norm(k.custom?.name||'')==='lesser planar ally'))));}
  if(/five schools/i.test(s))check('Knowledge of 5th-level or higher spells from at least five schools',new Set(knownSpells(c).filter(s=>s.level>=5&&schools.includes(s.school)).map(s=>s.school)).size>=5);
  if(/seven different divination/i.test(s)){matched=true;const known=knownSpells(c).filter(s=>s.school==='Divination');check(s,known.length>=7&&known.some(s=>s.level>=3));}
  if(!matched)manual(s);
 };
 for(const section of d.requirements.split(/\n\n+/)){
  const match=section.match(/^([^:]+):\s*([\s\S]+)$/);if(!match)continue;
  const field=match[1].toLowerCase(),s=match[2].trim().replace(/\.$/,'');
  if(field==='base attack bonus')check('Base attack bonus '+s,bab>=Number(s));
  else if(field==='alignment'){const a=alignment(c.alignment),valid=/^(lawful|neutral|chaotic) (good|neutral|evil)$|^true neutral$/.test(a);const pass=/nonlawful/i.test(s)?!a.startsWith('lawful'):/nonchaotic/i.test(s)?!a.startsWith('chaotic'):/lawful/i.test(s)?a.startsWith('lawful'):/chaotic/i.test(s)?a.startsWith('chaotic'):/evil/i.test(s)?a.endsWith('evil'):false;check('Alignment: '+s,valid&&pass);}
  else if(field==='race'){const r=findRace(c.ancestry.raceId),race=(r?.type||c.race).toLowerCase();if(/nondragon/i.test(s)){if(/dragon/i.test(race)||/half.dragon/i.test(c.race))check('Race: '+s,false);else if(r)check('Race: '+s,true);else manual('Race: '+s);}else check('Race: '+s,/dwarf/i.test(s)?/dwarf/i.test(race):/\belf\b/i.test(race)||/half.elf/i.test(c.race));}
  else if(field==='skills'||field==='skill'){if(/any two/i.test(s))check(s,new Set(c.skills.filter(k=>/^Knowledge \(/i.test(k.name)&&k.ranks>=10).map(k=>norm(k.name))).size>=2);else for(const m of s.matchAll(/([^,]+?) (\d+) ranks?/g))check(m[0].trim(),rank(c,m[1].trim())>=+m[2]);}
  else if(field==='feats'||field==='feat'){
   if(/any (three )?metamagic/i.test(s)){
    const allowed=catalog.feats.filter(f=>/\[Metamagic\]/i.test(f.name)||/three/i.test(s)&&/\[Item Creation\]/i.test(f.name));
    check(/three/i.test(s)?'Three metamagic or item creation feats':'Any metamagic feat',allowed.filter(f=>has(c,clean(f.name))).length>=(/three/i.test(s)?3:1));
    if(/Skill Focus/i.test(s))check('Skill Focus in an individual Knowledge skill',c.features.some(f=>featName(f.name)==='skill focus'&&/^Knowledge \(/i.test(f.choice||featChoice(f.name)||'')));
    continue;
   }
   for(const f of s.split(/,\s*(?![^()]*\))/)){if(/Spell Focus in two schools/i.test(f)){check(f,new Set(c.features.filter(f=>featName(f.name)==='spell focus').map(f=>norm(f.choice||featChoice(f.name)||'')).filter(s=>schools.some(k=>norm(k)===s))).size>=2);continue;}
    const m=f.match(/^(.+?)\s*\((.+)\)$/);const name=m?m[1]:f,choices=m?.[2].split(' or ');check(f,choices?choices.some(choice=>has(c,name,choice)):has(c,name));
   }
  }
  else if(field==='spells'||field==='spellcasting')spellRequirement(s);
  else if(field==='languages')check('Language: '+s,c.languages.split(/[,;\n]+/).some(l=>norm(l)===norm(s)));
  else if(field==='weapon proficiency')check(s,equipmentCatalog.filter(e=>e.kind==='weapon'&&e.category==='martial').every(e=>proficient(c,e.name)));
  else if(field==='psionics'){
   let m=s.match(/manifest (\d+)(?:st|nd|rd|th)-level/i);if(m)check(s,canPower(c,+m[1]));
   m=s.match(/Manifester level (\d+)/i);if(m)check('Manifester level '+m[1],Math.max(0,...c.psionics.map(p=>psionicProgression(c,p).level))>=+m[1]);
   if(/mindlink/i.test(s))check('Able to manifest mindlink',c.psionics.some(p=>p.powers.some(k=>norm(k.name)==='mindlink')&&p.max>=1&&p.level>=1));
   if(/power point reserve/i.test(s))check(s,c.psionics.some(p=>p.max>=1)||!!findRace(c.ancestry.raceId)?.powerPoints||has(c,'Wild Talent'));
  }
  else if(field==='special'){
   if(/sneak attack \+2d6/i.test(s)){const rogue=classLevel(c,'rogue'),assassin=classLevel(c,'assassin'),spellthief=classLevel(c,'spellthief');check(s,Math.ceil(rogue/2)+Math.ceil(assassin/2)+(spellthief?1+Math.floor((spellthief-1)/4):0)+Math.floor(classLevel(c,'arcane-trickster')/2)>=2);}
   else if(/Still mind class feature/i.test(s))check(s,classLevel(c,'monk')>=3||c.features.some(f=>norm(f.name)==='still mind'));
   else manual(s);
  }else manual(section);
 }
 if(!q.rows.length)manual('Verify entry requirements in the class source');
 return result(q.rows);
}
