import type {Skill} from './model.ts';

// Stable IDs leave the original numbered skill rows and their purchase histories intact.
const definitions=[
 {name:'Autohypnosis',ability:'WIS',prefix:'autohypnosis'},
 {name:'Knowledge (psionics)',ability:'INT',prefix:'knowpsionic'},
 {name:'Psicraft',ability:'INT',prefix:'psicraft'},
 {name:'Use Psionic Device',ability:'CHA',prefix:'usepsionicdevice'},
] as const;

const skillKey=(name:string)=>name.toLowerCase().replace(/[^a-z0-9]/g,'');

export function psionicSkillDefinition(name:string){
 return definitions.find(def=>skillKey(def.name)===skillKey(name));
}

export function missingPsionicSkills(skills:Skill[]){
 return definitions.flatMap(({name,ability,prefix})=>{
  const id='skill-'+prefix;
  if(skills.some(s=>s.id===id||skillKey(s.name)===skillKey(name)))return [];
  const skill:Skill={id,name,ability,trained:true,armor:0,classSkill:false,ranks:0,misc:0};
  return [{skill,prefix}];
 });
}
