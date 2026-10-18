import type {Character,Weapon} from './model.ts';
import {parseDiceFormula} from './dice.mjs';
import {matchEquipment,allSizes} from './equipment.ts';
import {weaponDice} from './rules.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';
import {findClass} from './classes.ts';

type Scope={n:(...names:string[])=>number|undefined,t:(...names:string[])=>string|undefined};
export function readRoll20WeaponDice(r:Scope){
 const legacy=r.t('weaponstatdamage','statdamage')?.match(/^(\d+)?d(\d+)$/i);
 const dice=r.n('weapondicenumber','npcattackdicenumber')??(legacy?Number(legacy[1]||1):undefined),sides=r.n('weapondicetype','npcattackdicetype')??(legacy?Number(legacy[2]):undefined);
 const full=r.t('damage','dmg','weapondamage','npcattackdamage');
 if(dice!==undefined&&sides!==undefined){try{return {formula:parseDiceFormula(dice+'d'+sides).formula,complete:false,problem:''};}catch{return {formula:'0',complete:true,problem:'recorded damage dice are unsupported; review them before rolling.'};}}
 if(full){try{return {formula:parseDiceFormula(full).formula,complete:true,problem:''};}catch{return {formula:'0',complete:true,problem:'damage is a Roll20 formula; review it before rolling.'};}}
 return {formula:'0',complete:true,problem:'no damage dice were recorded; enter them before rolling.'};
}

/** Keep catalog identity for proficiency, feats and range; override only dice. */
export function preserveRoll20WeaponDice(c:Character,w:Weapon){
 const e=matchEquipment(w.name,'weapon');if(!e)return false;
 const baseline={...c,automation:{...c.automation,enabled:true}};
 const standard=weaponDice(baseline,{...w,catalogId:e.id,useRecordedDice:false});
 if(w.damage===standard)return false;
 w.useRecordedDice=true;w.diceSize=c.size;return true;
}

/** Repair unchanged imported formulas, without replacing current weapons. */
export function repairRoll20WeaponDice(c:Character){
 const source=c.roll20Import;
 if(!source||source.weaponDiceMigration===1||c.sheetKind==='monster')return;
 const parsed=roll20ExportSchema.safeParse(source.raw);if(!parsed.success||parsed.data.version!==1)return;
 const r=attributeReader(parsed.data,()=>{}),groups=parseRepeating(parsed.data.attributes);
 const scope=(map:(name:string)=>string):Scope=>({n:(...names)=>r.number(...names.map(map)),t:(...names)=>r.text(...names.map(map))});
 const rowScope=(row:ReturnType<typeof parseRepeating>[string]['rows'][string])=>{const f=Object.values(row.fields)[0][0],prefix=f.originalName.slice(0,-f.name.length);return scope(name=>prefix+name);};
 const originalClasses:Character['classLevels']=[];
 const addClass=(name:string|undefined,level:number|undefined)=>{if(!name||level===undefined||!Number.isInteger(level)||level<1||level>30)return;const d=findClass(name);if(d)originalClasses.push({id:'source-'+originalClasses.length,classId:d.id,name:d.name,level,notes:''});};
 for(let i=1;i<=10;i++)addClass(r.text('class'+i),r.number('level'+i,'class'+i+'level'));
 for(const section of ['class','classes'])for(const row of Object.values(groups[section]?.rows||{})){const s=rowScope(row);addClass(s.t('name','classname','class'),s.n('level','classlevel'));}
 if(!originalClasses.length)for(const part of (r.text('classes','class','class_and_level')||'').split(/\s*\/\s*|;/)){const match=part.trim().match(/^(.+?)\s+(\d+)$/);if(match)addClass(match[1],Number(match[2]));}
 const records:Array<{name:string,formula:string}>=[];
 const add=(s:Scope)=>{const name=s.t('weaponname','npcattackname','name','attackname');if(name)records.push({name,formula:readRoll20WeaponDice(s).formula});};
 for(let i=1;i<=10;i++)add(scope(name=>name.startsWith('weapon')?name.replace(/^weapon/,'weapon'+i):'__fixed_weapon_'+i+'_'+name));
 for(const section of ['weapon','weapons','attack','attacks'])for(const row of Object.values(groups[section]?.rows||{}))add(rowScope(row));
 let repaired=0;
 for(const w of c.weapons){
  if(w.useRecordedDice!==undefined)continue;
  if(!records.some(entry=>entry.name===w.name&&entry.formula===w.damage))continue;
  const e=matchEquipment(w.name,'weapon');if(!e||w.catalogId&&w.catalogId!==e.id)continue;
  // A deliberate switch to custom equipment must not be undone.
  if(c.automation.enabled&&!w.catalogId)continue;
  const size=allSizes.includes(w.diceSize as Character['size'])?w.diceSize as Character['size']:c.automation.baseSize;
  if(preserveRoll20WeaponDice({...c,size,classLevels:originalClasses},w))repaired++;
 }
 source.weaponDiceMigration=1;
 if(repaired)source.report.warnings.push('Restored recorded weapon damage that catalog automation had replaced. Weapon identities, current progression, and other weapon edits were retained. Recorded dice are editable in Combat.');
}
