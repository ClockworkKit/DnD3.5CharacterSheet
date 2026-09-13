import type {Character} from './model.ts';
import {uid} from './model.ts';
import {systemLimits} from './class-systems.ts';
export type Invocation={id:string,name:string,classId:string,grade:'least'|'lesser'|'greater'|'dark',level:number,category:string,source:string};
export function invocationProblem(c:Character,v:Invocation){
 const n=systemLimits(c,v.classId),level=c.classLevels.filter(e=>e.classId===v.classId).reduce((n,e)=>n+e.level,0);
 if(!n||!['warlock','dragonfire-adept'].includes(v.classId))return 'Requires the matching invocation class.';
 if(level<({least:1,lesser:6,greater:11,dark:16}[v.grade]))return 'This invocation grade is not available yet.';
 const known=c.classSystems.choices.filter(s=>s.classId===v.classId&&s.kind==='invocation');
 if(known.some(s=>s.name.toLowerCase()===v.name.toLowerCase()))return 'Already recorded.';
 if(known.length>=n.known)return 'All known-invocation choices are filled.';
 if(c.classSystems.choices.length>=200)return 'The character has reached the choice limit.';
 return '';
}
export function learnInvocation(c:Character,v:Invocation){
 const problem=invocationProblem(c,v);if(problem)throw new Error(problem);
 c.classSystems.choices.push({id:uid(),classId:v.classId,name:v.name,kind:'invocation',invocationGrade:v.grade,level:v.level,readied:false,granted:false,spent:0,essentia:0,bound:false,totem:false,notes:`${v.grade} invocation · ${v.category}. At will; resolve the individual effect, action, targeting, and any restrictions using the source: ${v.source}`});
}
