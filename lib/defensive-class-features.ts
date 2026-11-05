import type {Character} from './model.ts';
import {alternateClassLevel,classFeatureLevel,featureReplaced,hasAlternateFeature} from './alternate-features.ts';
import {carrying,equippedArmor} from './equipment.ts';
import {findClass} from './classes.ts';
import {characterGestaltRows} from './gestalt-progression.ts';

// Explicit source policies, not matches against free-text class summaries.
const evasionLevels:Readonly<Record<string,{level:number;improved?:number;armor:number}>>={
 rogue:{level:2,armor:1},monk:{level:2,improved:9,armor:1},ranger:{level:9,armor:1},
 shadowdancer:{level:2,improved:10,armor:1},swordsage:{level:9,improved:17,armor:1},
 ninja:{level:12,armor:0},scout:{level:5,armor:1},lurk:{level:9,armor:1},'psychic-rogue':{level:2,armor:1},
};
const uncannyLevels:Readonly<Record<string,number>>={barbarian:2,rogue:4,assassin:2,shadowdancer:2,warblade:2,scout:2,'psychic-rogue':7,'fist-of-the-forest':2,'dwarven-defender':2};
const improvedUncannyLevels:Readonly<Record<string,number>>={barbarian:5,rogue:8,assassin:5,shadowdancer:5,warblade:6,'psychic-rogue':9,'dwarven-defender':6};
const focused=(c:Character,id:string)=>c.psionics.some(p=>p.manifesting?.classId===id&&p.focused);

/** Duplicate grants provide the best available benefit, never extra damage reductions. */
export function evasionFeatures(c:Character){
 const armor=equippedArmor(c),load=carrying(c),heavyLoad=c.automation.enabled&&c.automation.encumbrance&&load.category!=='Light';
 const blocked=(limit:number)=>c.automation.context.helpless?'being helpless':armor.category>limit?(limit===0?'wearing armor':'medium or heavy armor'):heavyLoad?'a medium or heavier load':'';
 const chosenImproved=c.features.some(f=>f.kind==='Class feature'&&/^improved evasion(?: \(ex\))?$/i.test(f.name.trim()));
 const sources:{classId:string;name:string;tier:number;blocked:string;magicOnly:boolean}[]=[];
 for(const [classId,policy] of Object.entries(evasionLevels)){
  const level=alternateClassLevel(c,classId),base=level>=policy.level&&!featureReplaced(c,classId,'evasion');
  const chosen=chosenImproved&&(classId==='rogue'&&level>=10||classId==='psychic-rogue'&&level>=11);
  const improved=(!!policy.improved&&level>=policy.improved||chosen||classId==='lurk'&&level>=14&&hasAlternateFeature(c,'lurk-true-thief')&&focused(c,'lurk'))&&!featureReplaced(c,classId,'improved-evasion');
  const tier=improved?(hasAlternateFeature(c,classId+'-spell-reflection')?1:2):base?1:0;
  if(tier)sources.push({classId,name:findClass(classId)?.name??classId,tier,blocked:blocked(policy.armor),magicOnly:false});
 }
 if(hasAlternateFeature(c,'fighter-eldritch-grace'))sources.push({classId:'fighter',name:'Fighter (Eldritch Grace; spells and magical effects only)',tier:1,blocked:c.automation.context.helpless?'being helpless':heavyLoad?'a medium or heavier load':'',magicOnly:true});
 return {sources,tier:Math.max(0,...sources.map(s=>s.tier)),activeTier:Math.max(0,...sources.filter(s=>!s.blocked&&!s.magicOnly).map(s=>s.tier)),magicTier:Math.max(0,...sources.filter(s=>!s.blocked).map(s=>s.tier))};
}

/** Basic Dexterity retention only; improved anti-flanking progression is separate. */
function uncannySources(c:Character,ignoreFocus=false){
 const sources=Object.entries(uncannyLevels).filter(([id,level])=>classFeatureLevel(c,id,'uncanny-dodge')>=level&&(ignoreFocus||id!=='psychic-rogue'||focused(c,id))).map(([id])=>({classId:id,name:findClass(id)?.name??id}));
 if(alternateClassLevel(c,'lurk')>=3&&hasAlternateFeature(c,'lurk-true-thief')&&(ignoreFocus||focused(c,'lurk')))sources.push({classId:'lurk',name:'Lurk (focused True Thief)'});
 return sources;
}
export const uncannyDodgeSources=(c:Character)=>uncannySources(c);
function earnedUncannySources(c:Character,ignoreFocus=false){
 return Object.entries(improvedUncannyLevels).filter(([id,level])=>classFeatureLevel(c,id,'improved-uncanny-dodge')>=level&&(ignoreFocus||id!=='psychic-rogue'||focused(c,id))).map(([id])=>({classId:id,name:findClass(id)?.name??id}));
}
const distinctSources=(sources:Array<{classId:string}>)=>[...new Set(sources.map(s=>s.classId))].sort();
function uncannyHistories(rows:ReturnType<typeof characterGestaltRows>,ids:string[]){
 const histories=rows?ids.map(id=>rows.flatMap((row,i)=>row.left.classId===id||row.right.classId===id?[i]:[])):[];
 return {histories,mixed:histories.some(h=>h.length!==histories[0].length||h.some((level,i)=>level!==histories[0][i]))};
}

/** Read-only explanation; no target/attacker information is inferred from the sheet. */
export function uncannyDodgeFeatures(c:Character){
 const rows=characterGestaltRows(c),sources=uncannyDodgeSources(c);
 const earned=earnedUncannySources(c);
 // Ordinary multiclass second-source upgrades are distinct from UA's shared
 // gestalt progression. A replacement cannot re-grant its own surrendered feature.
 const duplicateUpgrade=!rows&&sources.length>1&&sources.some(s=>!featureReplaced(c,s.classId,'improved-uncanny-dodge'));
 const automaticImproved=earned.length>0||duplicateUpgrade;
 const ids=distinctSources([...sources,...earned]);
 // Equal sets of actual levels cover uninterrupted pairs (and swapping sides).
 // Staggered/mixed source histories need a specific ruling, not a fabricated
 // threshold obtained by summing both sides. See docs/rules-policy.md.
 const {histories,mixed}=uncannyHistories(rows,ids);
 const automaticMinimumRogueLevel=!automaticImproved||mixed?null:(rows?(histories[0]?.length??0):ids.reduce((n,id)=>n+alternateClassLevel(c,id),0))+4;
 // Focus is a temporary eligibility condition, not a change to the progression
 // the GM reviewed. Losing focus suspends a dependent ruling without erasing it.
 const potentialEarned=earnedUncannySources(c,true),potentialIds=distinctSources([...uncannySources(c,true),...potentialEarned]);
 const rulingEligible=!!rows&&uncannyHistories(rows,potentialIds).mixed;
 const progression=JSON.stringify({version:1,mode:c.advancementMode??'standard',
  sources:potentialIds.map(id=>[id,featureReplaced(c,id,'uncanny-dodge'),featureReplaced(c,id,'improved-uncanny-dodge'),potentialEarned.some(s=>s.classId===id)]),
  levels:rows?.map(row=>[row.left,row.right].map(side=>[side.classId,side.classLevel]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))))??null});
 const ruling=c.classSystems.uncannyDodgeRuling;
 const improvementAvailable=potentialIds.some(id=>!featureReplaced(c,id,'improved-uncanny-dodge'));
 const staleRuling=!!ruling&&(!rulingEligible||ruling.progression!==progression);
 const incompatibleRuling=!!ruling&&(potentialEarned.length>0&&!ruling.decision.improved||ruling.decision.improved&&!improvementAvailable);
 const suspendedSources=potentialIds.filter(id=>!ids.includes(id));
 const rulingApplied=!!ruling&&!staleRuling&&!incompatibleRuling&&!suspendedSources.length;
 const improved=rulingApplied?ruling!.decision.improved:automaticImproved;
 const minimumRogueLevel=rulingApplied?ruling!.decision.minimumRogueLevel:automaticMinimumRogueLevel;
 const review=staleRuling?'The saved Uncanny Dodge GM ruling no longer matches the progression or feature choices. It is retained but not applied; review again.'
  :incompatibleRuling?'The saved Uncanny Dodge GM ruling conflicts with a listed class improvement or replacement. It is retained but not applied; review again.'
  :ruling&&suspendedSources.length?'The saved Uncanny Dodge GM ruling is temporarily inactive while a reviewed source is unavailable (for example, without psionic focus). Listed active class benefits still apply.'
  :!rulingApplied&&mixed?'Mixed or staggered gestalt Uncanny Dodge sources need DM review for duplicate-grant timing and the rogue-level exception. Listed class improvements are shown; no additional upgrade or combined threshold is inferred.':'';
 return {sources,earned,improved,duplicateUpgrade,minimumRogueLevel,review,gestalt:!!rows,
  automaticImproved,automaticMinimumRogueLevel,rulingEligible,progression,staleRuling,incompatibleRuling,rulingApplied,suspendedSources,listedImprovement:potentialEarned.length>0,improvementAvailable};
}
