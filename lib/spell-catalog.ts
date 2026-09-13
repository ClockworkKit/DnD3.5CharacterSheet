import type {Spell,Character,Caster} from './model.ts';
import {effectiveScore} from './ancestry.ts';
export type SpellExtension={id:string,levels:Record<string,number>,sources:string[],spell?:Spell};
export function expandSpellCatalog(base:Spell[],extensions:SpellExtension[]):Spell[]{
 const map=new Map(base.map(s=>[s.id,{...s,levels:{...s.levels}}]));
 for(const x of extensions){const s=map.get(x.id)||x.spell;if(!s)continue;const levels={...s.levels,...x.levels};map.set(x.id,{...s,levels,levelText:Object.entries(levels).map(([k,v])=>k+' '+v).join(', ').slice(0,160)});}
 // These classes explicitly draw on an existing list. Spellthief is restricted
 // to five schools and spell levels 1–4; stolen spells are a separate ability.
 for(const s of map.values()){
  if(s.levels.Cleric!==undefined){s.levels.Archivist=s.levels.Cleric;s.levels['Favored Soul']=s.levels.Cleric;}
  if(s.levels.Druid!==undefined)s.levels['Spirit Shaman']=s.levels.Druid;
  const arcane=s.levels['Sorcerer / Wizard'];if(arcane>=1&&arcane<=4&&/^(Abjuration|Divination|Enchantment|Illusion|Transmutation)\b/.test(s.school))s.levels.Spellthief=arcane;
 }
 for(const s of map.values())s.levelText=Object.entries(s.levels).map(([k,v])=>k+' '+v).join(', ').slice(0,160);
 return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function unrecordedClassSpells(c:Character,p:Caster,spells:Spell[]){
 const id=p.casting?.classId||'';if(!['beguiler','warmage','dread-necromancer'].includes(id))return [];
 const list=id.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' ');
 return spells.filter(s=>{const level=s.levels[list];return level!==undefined&&p.slots[level]?.max>0&&effectiveScore(c,p.ability)>=10+level&&!p.spells.some(k=>k.spellId===s.id)});
}
export function learnClassList(c:Character,p:Caster,spells:Spell[]){
 for(const s of unrecordedClassSpells(c,p,spells)){if(p.spells.length>=1000)break;const list=p.casting!.classId.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '),level=s.levels[list];p.spells.push({id:crypto.randomUUID(),spellId:s.id,level,slotLevel:level,prepared:0,spent:0,notes:'',formula:'',custom:null});}
}
