import {characterSchema,type Character} from './model.ts';
import type {Eligibility,Requirement} from './prerequisites.ts';
import {findClass} from './classes.ts';
import {classAlignmentEligibility} from './class-alignment.ts';
import {createPlayerCharacter,startingPairRows,type CharacterCreationOptions} from './character-creation.ts';
import {createNpcSheet} from './creatures.ts';

export type StartingAlignment=Pick<Character,'alignment'|'deity'|'prerequisiteConfirmations'>;
export type StartingClassOptions=Pick<CharacterCreationOptions,'kind'|'level'|'advancementMode'|'gestaltPairs'|'customClasses'|'clericSpecialty'>;

/** Review the deity the creator will actually record, including a selected specialty. */
export function startingAlignmentContext(options:StartingClassOptions,review:StartingAlignment):StartingAlignment{
 return {...review,alignment:review.alignment.trim(),deity:options.clericSpecialty==='axe-brother'?'Clangeddin Silverbeard':review.deity.trim()};
}

/** Pure draft validation: no character construction, dice rolls or stored-sheet edits. */
export function startingAlignmentEligibility(options:StartingClassOptions,review:StartingAlignment):Eligibility{
 const requirements:Requirement[]=[];
 const missing=(label:string)=>requirements.push({label,state:'missing'});
 const context=startingAlignmentContext(options,review);
 const check=(id:string,level:number)=>{
  const definition=findClass(id,options);
  if(!definition){missing('Choose a supported starting class.');return;}
  if(definition.kind==='Prestige'){missing('Create base-class levels first, then use guided level-up for prestige entry.');return;}
  if(!definition.levels.some(r=>r.level===level)){missing(definition.name+' has no level '+level+' in its table.');return;}
  const classLevels=[{id:'starting-review',classId:definition.id,name:definition.name,level:level-1,notes:''}];
  requirements.push(...classAlignmentEligibility({...context,classLevels},definition).requirements);
 };
 if(!Number.isInteger(options.level)||options.level<1||options.level>20)missing('Choose a starting class level from 1 to 20.');
 else if(options.advancementMode==='gestalt'){
  if(options.gestaltPairs?.length!==options.level)missing('Choose two classes for every starting paired level.');
  else for(const row of startingPairRows(options.gestaltPairs,options.customClasses)){
   if(row.problem)missing(row.problem);
   else for(const side of row.sides)check(side.id,side.level);
  }
 }else for(let level=1;level<=options.level;level++)check(options.kind,level);
 const rows=[...new Map(requirements.map(r=>[r.key??r.label,r])).values()];
 const eligible=rows.every(r=>r.state==='met'||r.state==='confirm'&&r.confirmed);
 return {eligible,requirements:rows,status:eligible?'Eligible':rows.some(r=>r.state==='missing')?'Missing prerequisites':'Needs confirmation'};
}

/** Entry point for guided PC/NPC creation; imports and low-level draft builders do not call it. */
export function createReviewedCharacter(options:CharacterCreationOptions,review:StartingAlignment,kind:'pc'|'npc'='pc'):Character{
 const result=startingAlignmentEligibility(options,review);
 if(!result.eligible)throw new Error('Starting class alignment needs review. '+result.requirements.find(r=>r.state!=='met'&&!r.confirmed)!.label);
 const context=startingAlignmentContext(options,review);
 // Keep only confirmations applicable to this exact build, never discarded drafts or future levels.
 const confirmations=Object.fromEntries(result.requirements.filter(r=>r.state==='confirm'&&r.confirmed&&r.key).map(r=>[r.key!,true]));
 const c=(kind==='npc'?createNpcSheet:createPlayerCharacter)(options);
 c.alignment=context.alignment;c.deity=context.deity;c.prerequisiteConfirmations=confirmations;
 return characterSchema.parse(c);
}
