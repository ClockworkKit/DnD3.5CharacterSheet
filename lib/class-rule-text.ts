import data from './character-source-data.json' with {type:'json'};

const details=data.classes as Record<string,{book:string,url:string,text:string}>;
export const classRuleHeading='Class rules (check your level and alternate feature choices):';
export function classRuleText(id:string){
 const detail=details[id];
 return detail?'\n\n'+classRuleHeading+'\n'+detail.text+'\n\nSource: '+detail.book+' — '+detail.url:'';
}
