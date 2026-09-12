import {abilityKeys,type Character} from './model.ts';
import {advancementNumbers} from './advancement.ts';
import {racialTraits} from './ancestry.ts';
export type AdvancementChoice={key:string,label:string,kind:'ability'|'feat',choice:string};
export function advancementChoices(c:Character):AdvancementChoice[]{
 const n=advancementNumbers(c),rows:AdvancementChoice[]=[];
 const add=(key:string,label:string,kind:AdvancementChoice['kind'])=>{const recorded=c.advancementChoices[key]||'';const choice=kind==='ability'?abilityKeys.includes(recorded as typeof abilityKeys[number])?recorded:'':c.features.some(f=>f.id===recorded&&f.kind==='Feat')?recorded:'';rows.push({key,label,kind,choice})};
 for(let i=1;i<=n.abilityIncreases;i++)add('ability-'+i,'Level '+i*4+' ability increase','ability');
 const human=racialTraits(c)?.id==='human';
 for(let i=0;i<n.feats-(human?1:0);i++)add('general-'+i,'Level '+(i===0?1:i*3)+' general feat','feat');
 if(human)add('human','Human bonus feat','feat');
 for(const [key,label,count] of [['fighter','Fighter bonus feat',n.fighterFeats],['wizard','Wizard bonus feat',n.wizardFeats],['psionic','Psionic bonus feat',n.psionicFeats]] as const)for(let i=1;i<=count;i++)add(key+'-'+i,label+' '+i,'feat');
 return rows;
}
export function recordAdvancementChoice(c:Character,key:string,choice:string,apply=false){
 const row=advancementChoices(c).find(r=>r.key===key);if(!row)throw new Error('This advancement has not been earned.');
 if(row.kind==='ability'){
  if(row.choice)throw new Error('This ability increase is already recorded.');
  if(!abilityKeys.includes(choice as typeof abilityKeys[number]))throw new Error('Choose an ability.');
  const ability=choice as typeof abilityKeys[number];if(apply){if(c.scores[ability]>=100)throw new Error('The base score is already at the sheet limit.');c.scores[ability]++;}
 }else{
  if(!c.features.some(f=>f.id===choice&&f.kind==='Feat'))throw new Error('Add the selected feat to Feats first.');
  if(advancementChoices(c).some(r=>r.key!==key&&r.kind==='feat'&&r.choice===choice))throw new Error('This feat entry is already assigned to another selection.');
 }
 c.advancementChoices[key]=choice;
}
