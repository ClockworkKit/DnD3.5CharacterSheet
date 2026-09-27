import {z} from 'zod';
export const alternateFeatureIds=['paladin-charging-smite','paladin-divine-spirit','paladin-detect-undead','paladin-divine-counterspell','paladin-curse-breaker','cleric-divine-counterspell'] as const;
export type AlternateFeatureId=typeof alternateFeatureIds[number];
export type AlternateFeatureDefinition={id:AlternateFeatureId,name:string,classId:string,level:number,replaces:string[],replacementLabels:string[],skill?:{name:string,ranks:number},description:string,source:string};
const source='https://srd.dndtools.org/srd/classes/baseCore/paladin.html';
export const alternateFeatureCatalog:AlternateFeatureDefinition[]=[
 {id:'paladin-charging-smite',name:'Charging Smite',classId:'paladin',level:5,replaces:['special-mount'],replacementLabels:['Special mount'],description:'On a charging melee smite against evil, add twice your paladin level to normal smite damage. A missed charging smite does not spend the smite use. Uses the ordinary smite pool; mark it spent only after a hit.',source},
 {id:'paladin-divine-spirit',name:'Divine Spirit',classId:'paladin',level:5,replaces:['special-mount'],replacementLabels:['Special mount'],description:'Summon celestial spirits as a standard action. Each unlocked spirit can be summoned once daily and lasts up to your paladin level in rounds. Positioning, dispelling and effects on allies are resolved at the table.',source},
 {id:'paladin-detect-undead',name:'Detect Undead',classId:'paladin',level:1,replaces:['detect-evil'],replacementLabels:['Detect evil'],description:'At-will spell-like detection of undead regardless of alignment. A chosen 60-degree arc reveals their presence, number and location immediately; use the source for the full detection rules.',source},
 {id:'paladin-divine-counterspell',name:'Divine Counterspell',classId:'paladin',level:4,replaces:['turn-undead'],replacementLabels:['Turn undead'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Counterspell as with dispel magic, without identifying the spell. Use cleric level if you have it; otherwise use paladin level minus 3. Knowledge (arcana) 5 ranks adds +2. Daily uses equal 1 + Charisma modifier.',source},
 {id:'paladin-curse-breaker',name:'Curse Breaker',classId:'paladin',level:6,replaces:['remove-disease'],replacementLabels:['Remove disease and later improvements'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Replace the weekly remove disease ability with remove curse. Gain one weekly use at level 6 and another every three paladin levels thereafter. At level 12, break enchantment costs two uses from that same weekly pool.',source},
 {id:'cleric-divine-counterspell',name:'Divine Counterspell',classId:'cleric',level:1,replaces:['turn-undead'],replacementLabels:['Turn or rebuke undead'],skill:{name:'Knowledge (arcana)',ranks:1},description:'Replace cleric turning with counterspelling. Counterspell as with dispel magic using cleric level; no spell identification is needed. Knowledge (arcana) 5 ranks adds +2. Daily uses equal 1 + Charisma modifier.',source},
];
export const alternateFeaturesSchema=z.object({
 selected:z.array(z.enum(alternateFeatureIds)).max(alternateFeatureIds.length).default([]).superRefine((ids,ctx)=>{
  const spent=new Set<string>();for(const id of ids){const d=alternateFeatureCatalog.find(d=>d.id===id)!;for(const feature of d.replaces){const key=d.classId+':'+feature;if(spent.has(key))ctx.addIssue({code:z.ZodIssueCode.custom,message:'An original class feature cannot be replaced twice.'});spent.add(key);}}
 }),
 uses:z.record(z.string().max(120),z.number().int().min(0).max(10000)).default({}),
}).default({});
