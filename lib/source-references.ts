import data from './character-source-data.json' with {type:'json'};
import {classCatalog} from './class-catalog.ts';
import {findRace,raceCatalog} from './ancestry.ts';
import type {Character} from './model.ts';

export type SourceReference={id:string,title:string,book:string,url:string,text:string};
type Detail={book:string,url:string,text:string};
const classDetails=data.classes as Record<string,Detail>,raceDetails=data.races as Record<string,Detail>;
const normalize=(s:string)=>s.trim().toLowerCase().replace(/-/g,' ').replace(/\belves\b/g,'elf').replace(/\s+/g,' ');
export const classSourceDetail=(id:string)=>classDetails[id];
export const raceSourceDetail=(id:string)=>raceDetails[id];

/** Read-only reference snapshots. Never alter feats, statistics, personal notes or uses. */
export function characterSourceReferences(c:Character):SourceReference[]{
 const references:SourceReference[]=[];
 const entries=c.classLevels.length?c.classLevels:c.classes.split(/\s*\/\s*/).flatMap(label=>{
  const name=label.trim().match(/^(.+?)\s+\d+$/)?.[1];
  const d=classCatalog.find(d=>normalize(d.name)===normalize(name||''));
  return d?[{classId:d.id}]:[];
 });
 for(const entry of entries){
  const d=classCatalog.find(d=>d.id===entry.classId),detail=d&&classDetails[d.id];
  if(!d||!detail||references.some(r=>r.id==='class:'+d.id))continue;
  references.push({id:'class:'+d.id,title:d.name+' rules & source',...detail,text:'Base-class reference, including later-level abilities. Use your class level and selected alternate features to determine which abilities you have. Reading this reference grants no additional abilities.\n\n'+detail.text});
 }
 // A recognizable imported race label can carry references without enabling its bonuses.
 const race=findRace(c.ancestry.raceId)||raceCatalog.find(r=>normalize(r.name)===normalize(c.race)||normalize(r.id)===normalize(c.race));
 const detail=race&&raceDetails[race.id];
 if(race&&detail)references.push({id:'race:'+race.id,title:race.name+' rules & source',...detail,text:'Reference only. Apply racial adjustments once; conditional abilities still require their stated trigger.\n\n'+detail.text});
 return references;
}

export function syncSourceReferences(c:Character){c.sourceReferences=characterSourceReferences(c);}
