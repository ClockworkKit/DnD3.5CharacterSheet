// Run import-ultimate-catalogs.py first. Only mechanical facts and feature names
// enter this legacy mechanical catalog; source prose stays in the local review cache.
// ancestry.ts overlays reviewed race-rule-summaries.json for visible and saved rules.
// Keep the original trait blocks here: existing character cards use them as exact
// migration markers. After editing summaries, run build-character-sources.mjs.
import fs from 'node:fs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const seed=read('lib/race-data.json'),sections=read('work/race-sections.json');
const html=fs.readFileSync('work/srd/races.html','utf8');
const main=html.split('<h3>RACES (By Subraces)</h3>')[1].split('<h3>RACES (By Book)</h3>')[0];
const urls=[...new Set([...main.matchAll(/href="([^"]+)"/g)].map(m=>new URL(m[1],'https://srd.dndtools.org/srd/races/races.html').href))];
const norm=s=>s.toLowerCase().replace(/dwarves|dwarven/g,'dwarf').replace(/elves|elven/g,'elf').replace(/gnomish/g,'gnome').replace(/halflings/g,'halfling').replace(/humans/g,'human').replace(/orcs/g,'orc').replace(/ies\b/g,'y').replace(/s\b/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const abilities={Strength:'STR',Dexterity:'DEX',Constitution:'CON',Intelligence:'INT',Wisdom:'WIS',Charisma:'CHA'};
const books={Core:'Core rules',Rod:'Races of Destiny',Environment:'Unearthed Arcana',Elemental:'Unearthed Arcana',Dramag:'Dragon Magazine',Storm:'Stormwrack',Moi:'Magic of Incarnum',Planar:'Planar Handbook',Eberron:'Eberron Campaign Setting',Und:'Underdark',Psionic:'Expanded Psionics Handbook / Complete Psionic',Cor:'Champions of Ruin',Frost:'Frostburn',Rof:'Races of Faerûn',Ueast:'Unapproachable East',Dof:'Dragons of Faerûn',Roa:'Races of Ansalon',Tom:'Tome of Magic',Drm:'Dragon Magic',Bovd:'Book of Vile Darkness',Mm1:'Monster Manual',Mm3:'Monster Manual III',Sand:'Sandstorm',Boed:'Book of Exalted Deeds',Rotw:'Races of the Wild',Moe:'Magic of Eberron',Ettdp:'Expedition to the Demonweb Pits',Dc:'Dragon Compendium',Dlance:'Dragonlance Campaign Setting',Rotd:'Races of the Dragon',Drac:'Draconomicon',Ros:'Races of Stone',Pgtf:"Player’s Guide to Faerûn",Mm5:'Monster Manual V',Ssouth:'Shining South',Sox:'Secrets of Xen’drik',Dunmag:'Dungeon Magazine',Mm4:'Monster Manual IV',Dotu:'Drow of the Underdark',Fc2:'Fiendish Codex II',Oa:'Oriental Adventures',Sos:'Secrets of Sarlona',Sk:'Serpent Kingdoms','5n':'Five Nations'};
const typeRules={Aberration:[8,.75,['will'],2],Animal:[8,.75,['fort','ref'],2],Construct:[10,.75,[],2],Dragon:[12,1,['fort','ref','will'],6],Elemental:[8,.75,[],2],Fey:[6,.5,['ref','will'],6],Giant:[8,.75,['fort'],2],Humanoid:[8,.75,['ref'],2],'Magical Beast':[10,1,['fort','ref'],2],'Monstrous Humanoid':[8,1,['ref','will'],2],Ooze:[10,.75,[],2],Outsider:[8,1,['fort','ref','will'],8],Plant:[8,.75,['fort'],2],Undead:[12,.5,['will'],4],Vermin:[8,.75,['fort'],2]};
const templateNames=['Dragonborn of Bahamut','Shades','Lycanthropes','Remade','Dark Creatures','Half-Dragons','Lesser Planetouched'];
const referenceNames=["Ithin'Carthians",'Sea Elves','Cyclopeans','Psiforged'];
const canonical=urls.map(source=>sections.find(e=>e.source===source)).filter(Boolean);
const sourceFix=u=>u.replace('races.html#half-','racesCore.html#half-').replace('#azebloods','#azerbloods').replace('racesMm1.html#doppelgangers','racesMm1.html#dopplegangers').replace('racesUnd.html#svirfneblin','racesUnd.html#Svirfneblin').replace('racesDunmag.html#githyanki','racesDunmag.html#githtanki');
const sourceMap={},used=new Set(),byKey=new Map(seed.map(r=>[norm(r.name),r])),result=[],references=[],review=[];
byKey.set('svirfneblin',seed.find(r=>r.id==='deep-gnome'));
const chooseSeed=e=>e.source.includes('racesDramag.html#half-giants')?undefined:byKey.get(norm(e.name));
for(const e of canonical){const old=chooseSeed(e);if(old&&!sourceMap[old.id])sourceMap[old.id]=sourceFix(e.source);}
sourceMap['half-elf']='https://srd.dndtools.org/srd/races/racesCore.html#half-elves';
sourceMap['half-orc']='https://srd.dndtools.org/srd/races/racesCore.html#half-orcs';
sourceMap['psionic-duergar']='https://srd.dndtools.org/srd/races/racesPsionic.html#duergar';
const parentExceptions={'aquatic-half-elf':'half-elf','karsite':'human','wendle-centaur':'centaur','umbragen':'drow','tundra-halfling':'halfling','wild-gnome':'tinker-gnome','afflicted-kender':'kender','mountain-dwarf':'dwarf','deep-halfling':'halfling','tallfellow':'halfling','ice-gnome':'gnome','forestlord-elf':'elf','qualinesti':'elf','mad-gnome':'tinker-gnome','lesser-duergar':'dwarf','lesser-drow':'elf','lesser-svirfneblin':'gnome','deepwyrm-half-drow':'half-elf','forestlord-half-elf':'half-elf','frostblood-half-orc':'half-orc'};
function parentFor(e){
 const key=norm(e.name);
 let parentKey=parentExceptions[key];
 if(e.source.includes('racesDramag.html#half-giants'))parentKey='half-giant';
 if(e.file==='racesEnvironment.html')parentKey=key.replace(/^(aquatic|arctic|desert|jungle)-/,'');
 if(!parentKey){
  // Capture the named parent in a rules declaration, never a resemblance in lore.
  const declaration=e.text.match(/(?:have|share|possess) (?:all )?(?:of )?(?:the )?([a-z -]+?) racial traits\b/i)
   ||e.text.match(/(?:all (?:of )?the |same )?racial traits (?:as|of) (?:other )?([a-z -]+?)(?: except|,|\.)/i)
   ||e.text.match(/identical to ([a-z -]+?)(?:,|\.| except)/i);
  if(declaration)parentKey=norm(declaration[1]);
 }
 if(!parentKey||parentKey===key&&!e.source.includes('racesDramag.html#half-giants'))return;
 const existing=byKey.get(parentKey);if(existing)return existing;
 const parentSection=canonical.find(s=>norm(s.name)===parentKey);return parentSection&&build(parentSection);
}
function build(e){
 const key=norm(e.name),old=chooseSeed(e);if(old)return old;
 if(used.has(sourceFix(e.source)))return;used.add(sourceFix(e.source));
 const book=books[e.file?.replace(/^races|\.html$/g,'')]||'Ultimate SRD';
 const id=e.source.includes('racesDramag.html#half-giants')?'athasian-half-giant':key;
 const parent=parentFor(e),body=e.rules.join(' ').replace(/[−–]/g,'-'),manual=[];
 let r=parent?structuredClone(parent):{abilities:{},size:'Medium',speed:30,type:'Humanoid',vision:'Normal vision',languages:['Common'],bonusLanguages:'See source',favoredClass:'Any',la:0,rhd:0,hitDice:'None',natural:0,dodge:0,skills:{},saves:{},powerPoints:0,grapple:0};
 Object.assign(r,{id,name:e.name,group:book,source:sourceFix(e.source),book,openGame:false,imported:true,traits:[],baseRace:parent?.id});
 if(templateNames.includes(e.name)||/(?:acquired|inherited) template/.test(e.text))r.entryKind='template';
 else if(referenceNames.includes(e.name)||!e.rules.length&&!parent)r.entryKind='reference';
 else r.entryKind='race';
 const abilityRule=e.rules.find(s=>/^(?:[+-]\d+\s*(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s*[+-]|Ability (?:Score )?Adjustments)/i.test(s));
 if(abilityRule){const first=abilityRule.split(/[.:]/)[0].replace(/[−–]/g,'-');r.abilities=id==='athasian-elan'?{...parent?.abilities}:{};for(const [word,a] of Object.entries(abilities)){const m=first.match(new RegExp('([+-]\\d+),? '+word+'|'+word+' ([+-]\\d+)','i'));if(m)r.abilities[a]=Number(m[1]||m[2]);}}
 if(e.rules.some(s=>/no (?:racial )?ability (?:score )?(?:adjustments|modifiers)/i.test(s)))r.abilities={};
 const size=body.match(/(?:^|\. )(Fine|Diminutive|Tiny|Small|Medium|Large|Huge)(?:\s+(?:size|Size)|:|\.)/);if(size)r.size=size[1];
 const speed=body.match(/(?:base )?(?:land )?speed (?:(?:is|of) )?(\d+) (?:feet|ft)/i);if(speed)r.speed=Number(speed[1]);
 const typeNames=Object.keys(typeRules).sort((a,b)=>b.length-a.length);
 const type=typeNames.find(t=>new RegExp('\\b'+t+'\\b','i').test(e.rules.find(line=>/^Racial Hit Dice/i.test(line))||''))||typeNames.find(t=>e.rules.some(line=>new RegExp('^'+t+'(?: Type)?(?:\\s*\\([^)]*\\))?[:.]','i').test(line)));
 if(type)r.type=type;
 r.nonabilities=Object.entries(abilities).filter(([word])=>new RegExp('no '+word+' score','i').test(body)).map(([,a])=>a);
 if(r.type==='Undead'||r.type==='Construct'&&!/living construct/i.test(body))r.nonabilities=[...new Set([...r.nonabilities,'CON'])];
 const hd=body.match(/(?:racial Hit Dice|racial HD)[^.]{0,100}?(\d+)d(\d+)|(?:provide|has|have) (\d+)d(\d+) (?:racial )?Hit Dice/i);
 if(hd){r.rhd=Number(hd[1]||hd[3]);r.hitDice=r.rhd+'d'+(hd[2]||hd[4]);}
 const la=body.match(/Level Adjustment\s*:?\s*\+(\d+)/i);if(la)r.la=Number(la[1]);
 const natural=body.match(/\+(\d+) (?:racial bonus to |bonus to )?natural armor|natural armor bonus (?:of )?\+(\d+)/i);if(natural)r.natural=Number(natural[1]||natural[2]);
 const vision=[];for(const m of body.matchAll(/(?:Darkvision(?: out)?(?: up)?(?: to)?(?: a range of)?(?: of)?(?:[: ]+)[^.]*?\b\d+ (?:feet|ft)|(?:Superior )?low-light vision)/gi))vision.push(m[0]);if(vision.length)r.vision=[...new Set(vision)].join('; ');
 if(/no (?:longer have |longer possess |longer gain )?darkvision|lose[^.]*Darkvision/i.test(body))r.vision=r.vision.split('; ').filter(v=>!/darkvision/i.test(v)).join('; ')||'Normal vision';
 const lang=body.match(/Automatic Languages?\s*:\s*([^.]+)/i);if(lang)r.languages=lang[1].split(/,| and /).map(s=>s.trim()).filter(Boolean);
 const bonus=body.match(/Bonus Languages?\s*:\s*([^.]+)/i);if(bonus)r.bonusLanguages=bonus[1];
 const favored=body.match(/Favored Class\s*:\s*([^.]+)/i);if(favored)r.favoredClass=favored[1];
 const skills=['Appraise','Balance','Bluff','Climb','Concentration','Diplomacy','Disguise','Escape Artist','Gather Information','Handle Animal','Heal','Hide','Intimidate','Jump','Listen','Move Silently','Ride','Search','Sense Motive','Spellcraft','Spot','Survival','Swim','Tumble','Use Rope','Sleight of Hand','Knowledge (nature)','Knowledge (history)','Craft (alchemy)'];
 for(const line of e.rules){const first=line.split(/[.:]/)[0];const m=first.match(/\+(\d+) (?:racial )?bonus (?:on|to) (.+?) checks?$/i);if(m&&!/against|when|while|in |to notice|related|involving/i.test(m[2]))for(const skill of skills)if(m[2].toLowerCase().includes(skill.toLowerCase()))r.skills[skill]=Number(m[1]);
  if(/lose|do not|does not|no racial|no longer|instead of|rather than|replaces/i.test(line))for(const skill of skills)if(line.includes(skill)&&parent?.skills[skill]&&!/\+\d+ racial bonus/.test(line))delete r.skills[skill];
 }
 const saves=body.match(/\+(\d+) racial bonus (?:on|to) all saving throws/i);if(saves)r.saves={fort:Number(saves[1]),ref:Number(saves[1]),will:Number(saves[1])};if(/No racial bonus on saving throws/i.test(body))r.saves={};
 const pp=body.match(/(?:gain|gains|have|has) (\d+) bonus power points?/i);if(pp)r.powerPoints=Number(pp[1]);
 for(const mode of ['swim','fly','climb','burrow']){const m=body.match(new RegExp(mode+' speed (?:is |of )?(\\d+) (?:feet|ft)','i'));if(m)r[mode]=Number(m[1]);}
 const skillList=body.match(/(?:Its|His|Her|Their) class skills are ([^.]+)/i);
 const racialType=Object.keys(typeRules).sort((a,b)=>b.length-a.length).find(t=>r.type.toLowerCase().includes(t.toLowerCase()))||'Humanoid';
 const [die,bab,goodSaves,skillBase]=typeRules[racialType];
 r.racialProgression={type:racialType,die:Number(r.hitDice.match(/d(\d+)/)?.[1]||die),bab,goodSaves:[...goodSaves],skillBase,classSkills:skillList?skillList[1].split(/,| and /).map(x=>x.trim().replace(/ \((Str|Dex|Con|Int|Wis|Cha)\)$/i,'')).filter(Boolean):parent?.racialProgression?.classSkills||({gnoll:['Climb','Listen','Spot'],lizardfolk:['Balance','Jump','Swim']}[parent?.id]||[])};
 const racialSkills=body.match(/(?:skill points|Skills)[^.]{0,130}?(\d+) \+ Int/i);if(racialSkills)r.racialProgression.skillBase=Number(racialSkills[1]);
 if(r.rhd){const row=body.match(/(?:base )?(?:saving throw bonuses|saving throws|saving throw modifiers)[^.]+/i)?.[0]||'';for(const [save,label] of [['fort','Fort'],['ref','Ref'],['will','Will']]){const m=row.match(new RegExp(label+' \\+(\\d+)'));if(m){const good=Number(m[1])===2+Math.floor(r.rhd/2);r.racialProgression.goodSaves=r.racialProgression.goodSaves.filter(s=>s!==save);if(good)r.racialProgression.goodSaves.push(save);}}}
 r.bonusFeat=parent?.id==='human'||parent?.bonusFeat||false;r.bonusSkillPoints=parent?.id==='human'?1:parent?.bonusSkillPoints||0;
 if(/bonus feat at (?:1st|first)|1 extra feat at (?:1st|first)/i.test(body)&&!/lose[^.]*[Bb]onus feat/.test(body))r.bonusFeat=true;
 if(/extra skill points at 1st/i.test(body))r.bonusSkillPoints=1;
 if(/lose[^.]*[Bb]onus feat|do not[^.]*bonus feat/i.test(body))r.bonusFeat=false;
 if(/No Bonus Skill Points|lose[^.]*[Bb]onus skill|do not[^.]*extra skill|do not[^.]*bonus skill/i.test(body))r.bonusSkillPoints=0;
 if(/Powerful Build/i.test(body))r.grapple=4;
 const labels=e.rules.map(s=>s.match(/^([A-Za-z][\w ’'()/-]{2,65}):/)?.[1]).filter(Boolean).filter(s=>!/^Automatic Language|Bonus Language|Favored Class|Level Adjustment|Racial (?:Hit Dice|Skills|Feats)|Small|Medium|Large$/.test(s));
 r.traits=[...new Set(labels)].map(s=>s+' — use the source rules for conditions and choices.');
 if(parent){r.parentSource=sourceMap[parent.id]||parent.source;manual.push('Inherits '+parent.name+'; variant replacements take precedence. Conditional parent bonuses are not automatically applied. Consult both sources for retained parent abilities and the variant’s replacements.');}
 manual.push('Automatic: listed ability, size, speed, unconditional bonuses and racial progression. Manual: conditional traits, natural attacks, spells, resistances, prerequisites, transformations and other source choices.');
 if(r.rhd&&!r.racialProgression.classSkills.length)manual.push('Racial class-skill list requires source review; use level training overrides.');
 if(/\+2 any|any (?:one|two) ability|choice of.*ability/i.test(body))manual.push('Choose the source’s ability adjustments in the base score fields; this choice is not added automatically.');
 r.manualHandling=manual;
 if(!abilityRule&&!parent&&body&&!/no.*ability|human/i.test(e.name))review.push({id,name:e.name,reason:'No simple ability adjustment row',rules:e.rules.slice(0,3)});
 if(r.entryKind!=='race'){r.traits=['Reference only: '+(r.entryKind==='template'?'apply to an existing base creature using the source instructions.':'review the source for individual choices.')];references.push(r);}else{result.push(r);byKey.set(key,r);}
 return r;
}
for(const e of canonical)build(e);
// Explicit choices prevent the parser from combining mutually exclusive traits.
for(const family of ['Hellbred','Mephlings']){
 const base=result.find(r=>r.name===family);if(!base)continue;
 result.splice(result.indexOf(base),1);references.push({...base,entryKind:'reference',traits:['Choose one of the individual '+family+' options.']});
 const choices=family==='Hellbred'?[
  ['body',{CON:2,INT:-2},'Normal vision','Paladin'],['spirit',{CHA:2,CON:-2},'Darkvision 30 ft.','Paladin'],
 ]:[['air',{INT:-2,CHA:2,DEX:2},'Normal vision','Bard'],['earth',{INT:-2,CHA:2,STR:2,DEX:-2},'Normal vision','Druid'],['fire',{INT:-2,CHA:2,DEX:2},'Normal vision','Sorcerer'],['water',{INT:-2,CHA:2,CON:2},'Normal vision','Monk']];
 for(const [choice,abilities,vision,favoredClass] of choices){const r={...structuredClone(base),id:(family==='Hellbred'?'hellbred-': 'mephling-')+choice,name:family==='Hellbred'?'Hellbred ('+choice+')':choice[0].toUpperCase()+choice.slice(1)+' Mephling',choiceFamily:family,choice,entryKind:'race',abilities,vision,favoredClass};if(family==='Hellbred'){r.skills={Intimidate:2,...(choice==='spirit'?{'Sense Motive':2}:{})};r.traits.push(choice==='body'?'Poison saves +4; bonus devil-touched feats at 4 and 14 HD (manual).':'Darkvision: 60 ft. at 6 HD, 120 ft. at 9 HD; magical darkness at 12 HD, telepathy 100 ft. at 15 HD (manual).');}else{r.size='Small';r.la=1;r.speed=30;r.type='Humanoid (extraplanar)';r.languages=['Common',{air:'Auran',earth:'Terran',fire:'Ignan',water:'Aquan'}[choice]];for(const mode of ['fly','burrow','swim'])delete r[mode];if(choice==='air')r.fly=10;if(choice==='earth')r.burrow=10;if(choice==='water')r.swim=30;r.traits.push('Breath: 15-ft. cone, 1d8; Reflex DC 10 + half HD + Con modifier halves damage. One daily use plus one per four levels; wait 1d4 rounds between uses. Handle targets and usage manually.');}result.push(r);}
}
// Verified exceptions and unconditional facts not expressed as a leading bonus row.
// Shared source sections describe two distinct parent races.
for(const [id,name,parentId,sourceId,remove] of [
 ['deepwyrm-half-drow','Deepwyrm Half-Drow','half-drow','deepwyrm-drow',['Diplomacy']],
 ['forestlord-half-elf','Forestlord Half-Elf','half-elf','forestlord-elf',['Diplomacy','Gather Information']],
]){const parent=byKey.get(parentId),source=result.find(r=>r.id===sourceId);const r={...structuredClone(parent),id,name,baseRace:parentId,parentSource:sourceMap[parent.id]||parent.source,source:source.source,book:source.book,group:source.group,imported:true,entryKind:'race',traits:source.traits,manualHandling:source.manualHandling};for(const skill of remove)delete r.skills[skill];if(id==='deepwyrm-half-drow')r.skills.Bluff=2;else{r.alwaysClassSkills=['Hide'];r.favoredClass='Sorcerer';}result.push(r);}
const corrections={
 'silverbrow-human':{skills:{Disguise:2},alwaysClassSkills:['Disguise']},
 'forestlord-elf':{alwaysClassSkills:['Hide']},'forestlord-half-elf':{alwaysClassSkills:['Hide']},
 'unbodied':{speed:0,skills:{Bluff:4,Disguise:4}},
};
for(const [id,patch] of Object.entries(corrections)){const r=result.find(r=>r.id===id);if(r)Object.assign(r,patch);}
for(const ref of references)ref.manualHandling=['Reference only: no rules are automatically applied from this entry. Use the linked source with your existing base race.'];
for(const r of result){
 if(r.id==='satyr')r.manualHandling.push('Source exception: the race page prints 5d8 despite the usual fey d6. This entry retains the race page’s dice; confirm with the DM.');
 if(r.id==='athasian-half-giant')r.name='Athasian Half-Giant';
 if(!r.traits.length)r.traits=['Use the linked racial rules for additional traits and restrictions.'];
}
write('lib/ultimate-race-data.json',result);
write('lib/race-reference-data.json',references);
write('lib/race-source-urls.json',sourceMap);
write('scripts/data/ultimate-race-coverage.json',canonical.map(e=>({name:e.name,source:e.source,resolvedSource:sourceFix(e.source),id:chooseSeed(e)?.id||result.find(r=>r.source===sourceFix(e.source))?.id||references.find(r=>r.source===sourceFix(e.source))?.id})));
write('work/race-review.json',review);
console.log({existing:seed.length,added:result.length,references:references.length,indexEntries:canonical.length,review:review.length});
