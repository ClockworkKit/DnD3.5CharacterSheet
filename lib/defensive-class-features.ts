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
const uncannyLevels:Readonly<Record<string,number>>={barbarian:2,rogue:4,assassin:2,shadowdancer:2,warblade:2,scout:2,'psychic-rogue':7,'fist-of-the-forest':2};
const improvedUncannyLevels:Readonly<Record<string,number>>={barbarian:5,rogue:8,assassin:5,shadowdancer:5,warblade:6,'psychic-rogue':9};
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
export function uncannyDodgeSources(c:Character){
 const sources=Object.entries(uncannyLevels).filter(([id,level])=>classFeatureLevel(c,id,'uncanny-dodge')>=level&&(id!=='psychic-rogue'||focused(c,id))).map(([id])=>({classId:id,name:findClass(id)?.name??id}));
 if(alternateClassLevel(c,'lurk')>=3&&hasAlternateFeature(c,'lurk-true-thief')&&focused(c,'lurk'))sources.push({classId:'lurk',name:'Lurk (focused True Thief)'});
 return sources;
}

/** Read-only explanation; no target/attacker information is inferred from the sheet. */
export function uncannyDodgeFeatures(c:Character){
 const rows=characterGestaltRows(c),sources=uncannyDodgeSources(c);
 const earned=Object.entries(improvedUncannyLevels).filter(([id,level])=>classFeatureLevel(c,id,'improved-uncanny-dodge')>=level&&(id!=='psychic-rogue'||focused(c,id))).map(([id])=>({classId:id,name:findClass(id)?.name??id}));
 // Ordinary multiclass second-source upgrades are distinct from UA's shared
 // gestalt progression. A replacement cannot re-grant its own surrendered feature.
 const duplicateUpgrade=!rows&&sources.length>1&&sources.some(s=>!featureReplaced(c,s.classId,'improved-uncanny-dodge'));
 const improved=earned.length>0||duplicateUpgrade;
 const ids=[...new Set([...sources,...earned].map(s=>s.classId))];
 // Equal sets of actual levels cover uninterrupted pairs (and swapping sides).
 // Staggered/mixed source histories need a specific ruling, not a fabricated
 // threshold obtained by summing both sides. See docs/rules-policy.md.
 const histories=rows?ids.map(id=>rows.flatMap((row,i)=>row.left.classId===id||row.right.classId===id?[i]:[])):[];
 const mixed=histories.some(h=>h.length!==histories[0].length||h.some((level,i)=>level!==histories[0][i]));
 const review=mixed?'Mixed or staggered gestalt Uncanny Dodge sources need DM review for duplicate-grant timing and the rogue-level exception. Listed class improvements are shown; no additional upgrade or combined threshold is inferred.':'';
 const minimumRogueLevel=!improved||mixed?null:(rows?(histories[0]?.length??0):ids.reduce((n,id)=>n+alternateClassLevel(c,id),0))+4;
 return {sources,earned,improved,duplicateUpgrade,minimumRogueLevel,review,gestalt:!!rows};
}
