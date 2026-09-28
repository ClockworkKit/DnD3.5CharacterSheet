import {z} from 'zod';
import {monkStyles,rangerStyles,clericPaths} from './alternate-styles.ts';
import data from './alternate-feature-data.json' with {type:'json'};
export type AlternateFeatureId=string;
export type AlternateFeatureDefinition={id:string,name:string,classId:string,level:number,replaces:string[],replacementLabels:string[],skill?:{name:string,ranks:number},description:string,source:string,kind?:'replacement'|'optional'|'reference',catalogId?:string,levels?:number[],choices?:string[],choiceRequired?:boolean,review?:boolean,requirementsNote?:string,activation?:string};
const source='https://srd.dndtools.org/srd/classes/baseCore/paladin.html';
const original:AlternateFeatureDefinition[]=[
 {id:'paladin-charging-smite',name:'Charging Smite',classId:'paladin',level:5,replaces:['special-mount'],replacementLabels:['Special mount'],description:'On a charging melee smite against evil, add twice your paladin level to normal smite damage. A missed charging smite does not spend the smite use. Uses the ordinary smite pool; mark it spent only after a hit.',source},
 {id:'paladin-divine-spirit',name:'Divine Spirit',classId:'paladin',level:5,replaces:['special-mount'],replacementLabels:['Special mount'],description:'Summon celestial spirits as a standard action. Each unlocked spirit can be summoned once daily and lasts up to your paladin level in rounds. Positioning, dispelling and effects on allies are resolved at the table.',source},
 {id:'paladin-detect-undead',name:'Detect Undead',classId:'paladin',level:1,replaces:['detect-evil'],replacementLabels:['Detect evil'],description:'At-will spell-like detection of undead regardless of alignment. A chosen 60-degree arc reveals their presence, number and location immediately; use the source for the full detection rules.',source},
 {id:'paladin-divine-counterspell',name:'Divine Counterspell',classId:'paladin',level:4,replaces:['turn-undead'],replacementLabels:['Turn undead'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Counterspell as with dispel magic, without identifying the spell. Use cleric level if you have it; otherwise use paladin level minus 3. Knowledge (arcana) 5 ranks adds +2. Daily uses equal 1 + Charisma modifier.',source},
 {id:'paladin-curse-breaker',name:'Curse Breaker',classId:'paladin',level:6,replaces:['remove-disease'],replacementLabels:['Remove disease and later improvements'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Replace the weekly remove disease ability with remove curse. Gain one weekly use at level 6 and another every three paladin levels thereafter. At level 12, break enchantment costs two uses from that same weekly pool.',source},
 {id:'cleric-divine-counterspell',name:'Divine Counterspell',classId:'cleric',level:1,replaces:['turn-undead'],replacementLabels:['Turn or rebuke undead'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Replace cleric turning with counterspelling. Counterspell as with dispel magic using cleric level; no spell identification is needed. Knowledge (arcana) 5 ranks adds +2. Daily uses equal 1 + Charisma modifier.',source},
];

const label=(key:string)=>key.replaceAll('-',' ').replace('@',' at level ');
export const alternateFeatureCatalog:AlternateFeatureDefinition[]=data.flatMap(row=>{
 const previous=original.find(d=>d.id===row.id);
 const d:AlternateFeatureDefinition={...row,kind:row.kind as AlternateFeatureDefinition['kind'],replacementLabels:row.replaces.map(label),...previous,source:row.source,review:previous?false:row.review,catalogId:row.id};
 if(d.id==='monk-fighting-styles')d.choices=monkStyles.map(s=>s.name);
 if(d.id==='ranger-combat-styles')d.choices=Object.keys(rangerStyles);
 if(d.id==='cleric-no-turning')d.choices=clericPaths;
 if(['warmage-eclectic-learning','bard-music-of-creation'].includes(d.id))return d.levels!.map(level=>({...d,id:d.id+'-level-'+level,name:d.name+' (level '+level+')',level,levels:undefined,replaces:d.replaces.map(k=>k.replace('@choice','@'+level)),replacementLabels:d.replaces.map(k=>label(k.replace('@choice','@'+level)))}));
 if(d.id.endsWith('-skilled-city-dweller'))return d.choices!.map((choice,i)=>({...d,id:d.id+'-'+(i+1),name:d.name+': '+choice,choices:[choice],replaces:['skill@'+(i+1)],replacementLabels:[choice.split(' → ')[0]]}));
 return [d];
});
export const alternateFeatureById=new Map(alternateFeatureCatalog.map(d=>[d.id,d]));
export const alternateFeatureIds=alternateFeatureCatalog.map(d=>d.id) as [string,...string[]];
export const alternateSettingsSchema=z.object({
 rules:z.record(z.string().max(80),z.string().max(200)).default({}),
 actions:z.record(z.string().max(80),z.object({rounds:z.number().int().min(0).max(10000).default(0),cooldown:z.number().int().min(0).max(10000).default(0)})).default({}),
 styleQualifiedAtSix:z.boolean().default(false),
 level:z.number().int().min(1).max(20).optional(),choice:z.string().max(300).default(''),notes:z.string().max(4000).default(''),reviewed:z.boolean().default(false),active:z.boolean().default(false),
 counters:z.array(z.object({id:z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/),name:z.string().min(1).max(120),max:z.number().int().min(0).max(10000),used:z.number().int().min(0).max(10000).default(0),period:z.enum(['day','week','encounter','manual'])})).max(12).default([]).superRefine((rows,ctx)=>{if(new Set(rows.map(r=>r.id)).size!==rows.length)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Tracker IDs must be unique.'});}),
});
export type AlternateSettings=z.infer<typeof alternateSettingsSchema>;
export function replacementKeys(d:AlternateFeatureDefinition,settings?:Partial<AlternateSettings>){return d.replaces.map(k=>k.replace('@choice','@'+(d.levels?(settings?.level??d.level):(settings?.choice||'?'))));}
export function replacementOverlap(a:string,b:string):boolean {
 if(a===b)return true;
 const families:Record<string,string[]>={'wild-shape':['wild-shape-animal','wild-shape-elemental','wild-shape-use'],'domains':['domain','domain-power'],'domain':['domain-power'],'armor-proficiencies':['light-armor','medium-armor','heavy-armor'],'shields':['tower-shields']};
 const [ak,al]=a.split('@'),[bk,bl]=b.split('@');
 const related=ak===bk||families[ak]?.includes(bk)||families[bk]?.includes(ak);
 return !!related&&(!al||!bl||al===bl);
}
export const alternateFeaturesSchema=z.object({
 selected:z.array(z.enum(alternateFeatureIds)).max(100).default([]),
 uses:z.record(z.string().max(160),z.number().int().min(0).max(10000)).default({}),
 settings:z.record(z.string().max(160),alternateSettingsSchema).default({}),
}).superRefine((state,ctx)=>{
 const spent:{classId:string,key:string}[]=[];
 const invalid=(message:string)=>ctx.addIssue({code:z.ZodIssueCode.custom,message});
 if(new Set(state.selected).size!==state.selected.length)invalid('Duplicate alternate class feature.');
 for(const id of state.selected){const d=alternateFeatureById.get(id)!;const s=state.settings[id];
  if(d.kind==='reference')invalid('Reference collections are not single class features.');
  if(d.levels&&s?.level!==undefined&&!d.levels.includes(s.level))invalid('Invalid replacement level.');
  if((d.choices||d.choiceRequired)&&!s?.choice.trim())invalid('A required feature option is missing.');
  if(d.choices&&s?.choice&&!['monk-fighting-styles','ranger-combat-styles'].includes(id)&&!d.choices.includes(s.choice))invalid('Invalid feature choice.');
  for(const key of replacementKeys(d,s)){if(spent.some(x=>x.classId===d.classId&&replacementOverlap(x.key,key)))invalid('An original class feature cannot be replaced twice.');spent.push({classId:d.classId,key});}
 }
}).default({});
