import type {Character} from './model.ts';
import {expression} from './formulas.ts';
type Effect=Character['effects'][number];
export type Modifier=Effect['modifiers'][number];
export const classLevel=(c:Character,id:string)=>c.classLevels.filter(x=>x.classId===id).reduce((n,x)=>n+x.level,0);
export function featCount(c:Character,name:string,choice?:string){return c.features.filter(f=>f.kind==='Feat'&&f.name.toLowerCase().replace(/\s*\(.*/, '')===name.toLowerCase()&&(!choice||(f.choice||f.name.match(/\((.*)\)/)?.[1]||'').toLowerCase()===choice.toLowerCase())).length;}
export const hasFeat=(c:Character,name:string,choice?:string)=>featCount(c,name,choice)>0;
export function baseVariables(c:Character){const v:Record<string,number>={LEVEL:c.level,HD:c.level,BAB:c.bab,CL:Math.max(0,...c.casters.map(p=>p.level)),ML:Math.max(0,...c.psionics.map(p=>p.level)),BARBARIAN:0};for(const a of ['STR','DEX','CON','INT','WIS','CHA'] as const){v[a]=c.scores[a]+c.temps[a];v[a+'_MOD']=Math.floor((v[a]-10)/2)}for(const e of c.classLevels){const k=e.classId.toUpperCase().replaceAll('-','_');v[k]=(v[k]||0)+e.level}return v;}
export function effectActive(c:Character,id:string){return c.automation.enabled&&c.effects.some(e=>e.active&&e.preset===id)&&!(id==='fatigued'&&c.effects.some(e=>e.active&&e.preset==='exhausted'));}
export function conditionMatches(c:Character,when:string,context:Record<string,string|number|boolean>={}){if(!when)return true;const [key,value]=when.split('=');return String(context[key]??(c.automation.context as Record<string,unknown>)[key]??'').toLowerCase()===value?.toLowerCase();}
export type BonusTerm={value:number,type:string,source:string};
export function stackBonuses(terms:BonusTerm[]){const groups=new Map<string,number[]>();for(const t of terms){const key=['untyped','dodge','circumstance'].includes(t.type)?t.type+':'+t.source:t.type;const a=groups.get(key)||[];a.push(t.value);groups.set(key,a)}return [...groups.values()].reduce((n,a)=>n+Math.max(0,...a)+Math.min(0,...a),0);}
export function effectTerms(c:Character,target:string,context:Record<string,string|number|boolean>={},lasting=false):BonusTerm[]{if(!c.automation.enabled)return [];const v=baseVariables(c);return c.effects.filter(e=>e.active&&(!lasting||e.permanent)&&!(e.preset==='fatigued'&&effectActive(c,'exhausted'))).flatMap(e=>e.modifiers.filter(m=>m.target===target&&conditionMatches(c,m.when,context)).map(m=>{let value=0;try{value=expression(m.value,{...v,...Object.fromEntries(Object.entries(context).filter(([,v])=>typeof v==='number')),CL:e.casterLevel})}catch{}return {value,type:m.type,source:e.preset||e.id}}));}
export function effectBonus(c:Character,target:string,context:Record<string,string|number|boolean>={},lasting=false){return stackBonuses(effectTerms(c,target,context,lasting));}
export function classAbilityBonus(c:Character,a:string){if(!c.automation.enabled)return 0;const n=classLevel(c,'dragon-disciple');return a==='STR'?(n>=10?8:n>=4?4:n>=2?2:0):a==='CON'&&n>=6?2:a==='INT'&&n>=8?2:a==='CHA'&&n>=10?2:0;}
const m=(target:string,type:Modifier['type'],value:string,when=''):Modifier=>({target,type,value,when});
type Preset={id:string,name:string,notes:string,modifiers:Modifier[]};
export const effectPresets:Preset[]=[
 {id:'bless',name:'Bless',notes:'+1 morale to attacks and saves against fear.',modifiers:[m('attack','morale','1'),m('saves','morale','1','saveAgainst=fear')]},
 {id:'divine-favor',name:'Divine favor',notes:'Luck bonus to weapon attacks and damage, maximum +3.',modifiers:[m('attack','luck','min(3,max(1,floor(CL/3)))'),m('damage','luck','min(3,max(1,floor(CL/3)))')]},
 {id:'mage-armor',name:'Mage armor',notes:'Armor bonus; does not stack with worn armor.',modifiers:[m('ac.armor','armor','4')]},
 {id:'shield',name:'Shield',notes:'Shield bonus; does not stack with a physical shield.',modifiers:[m('ac.shield','shield','4')]},
 {id:'shield-of-faith',name:'Shield of faith',notes:'Deflection bonus, maximum +5.',modifiers:[m('ac.deflection','deflection','min(5,2+floor(CL/6))')]},
 {id:'barkskin',name:'Barkskin',notes:'Enhancement to natural armor, maximum +5.',modifiers:[m('ac.naturalEnhancement','enhancement','min(5,2+max(0,floor((CL-3)/3)))')]},
 {id:'haste',name:'Haste',notes:'One extra attack at your highest bonus on a full attack; speed increase capped at your normal speed.',modifiers:[m('attack','untyped','1'),m('ac.dodge','dodge','1'),m('save.ref','untyped','1'),m('speed.haste','enhancement','30')]},
 {id:'slow',name:'Slow',notes:'Half speed, rounded down to 5 ft. A single move or standard action each turn; no full attack. Counters haste.',modifiers:[m('attack','untyped','-1'),m('ac.misc','untyped','-1'),m('save.ref','untyped','-1')]},
 {id:'rage',name:'Barbarian rage',notes:'Rage duration and daily uses appear under Calculations. Constitution increases HP while active.',modifiers:[m('STR','untyped','4+2*floor(BARBARIAN/11)+2*floor(BARBARIAN/20)'),m('CON','untyped','4+2*floor(BARBARIAN/11)+2*floor(BARBARIAN/20)'),m('save.will','morale','2+floor(BARBARIAN/11)+floor(BARBARIAN/20)'),m('ac.misc','untyped','-2')]},
 {id:'enlarge-person',name:'Enlarge person',notes:'One size larger; equipment damage scales with size. Multiple size increases do not stack.',modifiers:[m('STR','size','2'),m('DEX','size','-2'),m('size','size','1')]},
 {id:'reduce-person',name:'Reduce person',notes:'One size smaller; equipment damage scales with size.',modifiers:[m('STR','size','-2'),m('DEX','size','2'),m('size','size','-1')]},
 ...(['STR','DEX','CON','INT','WIS','CHA'] as const).map((a,i)=>({id:'ability-'+a,name:["Bull’s strength","Cat’s grace","Bear’s endurance","Fox’s cunning","Owl’s wisdom","Eagle’s splendor"][i],notes:'+4 enhancement. Temporary ability effects do not grant bonus daily spells or power points.',modifiers:[m(a,'enhancement','4')]})),
 ...['Shaken','Frightened','Panicked'].map(name=>({id:name.toLowerCase(),name,notes:'−2 on attacks, saves, skill checks, and ability checks. Fear penalties do not stack.',modifiers:['attack','saves','skills','checks'].map(t=>m(t,'morale','-2'))})),
 {id:'sickened',name:'Sickened',notes:'−2 attacks, weapon damage, saves, skill and ability checks.',modifiers:['attack','damage','saves','skills','checks'].map(t=>m(t,'untyped','-2'))},
 {id:'fatigued',name:'Fatigued',notes:'−2 Strength and Dexterity; cannot run or charge.',modifiers:[m('STR','untyped','-2'),m('DEX','untyped','-2')]},
 {id:'exhausted',name:'Exhausted',notes:'−6 Strength and Dexterity, half speed; cannot run or charge.',modifiers:[m('STR','untyped','-6'),m('DEX','untyped','-6')]},
 {id:'entangled',name:'Entangled',notes:'−2 attacks, −4 Dexterity, half speed. Casting requires Concentration DC 15.',modifiers:[m('attack','untyped','-2'),m('DEX','untyped','-4')]},
 {id:'dazzled',name:'Dazzled',notes:'−1 attacks, Search and Spot.',modifiers:[m('attack','untyped','-1'),m('skill.Search','untyped','-1'),m('skill.Spot','untyped','-1')]},
 {id:'blinded',name:'Blinded',notes:'Lose positive Dex and dodge AC, −2 AC, half speed. Visual checks fail; attacks have 50% miss chance.',modifiers:[m('ac.misc','untyped','-2')]},
 {id:'prone',name:'Prone',notes:'−4 melee attacks. Against melee: −4 AC; against ranged: +4 AC. Most ranged weapons cannot be used.',modifiers:[m('attack','untyped','-4','weapon=melee'),m('ac.misc','untyped','-4','incoming=melee'),m('ac.misc','untyped','4','incoming=ranged')]},
 {id:'stunned',name:'Stunned',notes:'Lose positive Dex and dodge AC; −2 AC. Cannot act.',modifiers:[m('ac.misc','untyped','-2')]},
 {id:'invisible',name:'Invisible',notes:'+2 attacks against sighted opponents who cannot see you. Target loses Dex to AC; choose appropriate target defenses.',modifiers:[m('attack','untyped','2','unseen=true')]},
 {id:'resistance',name:'Resistance',notes:'+1 resistance bonus to all saving throws.',modifiers:[m('saves','resistance','1')]},
 {id:'heroism',name:'Heroism',notes:'+2 morale on attacks, saves and skill checks.',modifiers:['attack','saves','skills'].map(t=>m(t,'morale','2'))}
];
export function setEffectActive(c:Character,id:string,active:boolean){
 const effect=c.effects.find(e=>e.id===id);if(!effect)return;
 if(active){
  const opposites:Record<string,string[]>={haste:['slow'],slow:['haste'],fatigued:['exhausted'],exhausted:['fatigued'],'enlarge-person':['reduce-person'],'reduce-person':['enlarge-person']};
  for(const other of c.effects)if(opposites[effect.preset]?.includes(other.preset))other.active=false;
 }
 effect.active=active;
}
export function addEffect(c:Character,id:string){
 const preset=effectPresets.find(p=>p.id===id);if(!preset)return;
 const existing=c.effects.find(e=>e.preset===id);
 if(existing){setEffectActive(c,existing.id,!existing.active);return;}
 const effect={id:crypto.randomUUID(),preset:preset.id,name:preset.name,notes:preset.notes,active:false,permanent:false,casterLevel:Math.max(1,...c.casters.map(p=>p.level)),rounds:0,modifiers:structuredClone(preset.modifiers)};
 c.effects.push(effect);setEffectActive(c,effect.id,true);
}
export function advanceEffects(c:Character){
 for(const e of c.effects)if(e.active&&e.rounds>0){e.rounds--;if(e.rounds===0)e.active=false;}
}
