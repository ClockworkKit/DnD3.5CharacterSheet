import type {Character,Weapon} from './model.ts';
import {matchEquipment} from './equipment.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';

/** A dash is no range information, not proof that Dexterity means a ranged attack. */
export function roll20DashWeaponMode(name:string,ability:Weapon['ability']):'melee'|'ranged'{
 const e=matchEquipment(name,'weapon');
 if(e&&!e.ranged&&!e.thrown)return 'melee';
 if(e?.ranged)return 'ranged';
 // Thrown/custom weapons are ambiguous; keep the previous fallback for review.
 return ability==='DEX'?'ranged':'melee';
}

/** Old explicit modes may have been deliberately edited. Warn instead of overwriting them. */
export function reviewRoll20WeaponModes(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.weaponModeReview===1||c.sheetKind==='monster')return;
 const warn=(message:string)=>{if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);};
 const parsed=roll20ExportSchema.safeParse(imported.raw);
 if(!parsed.success||parsed.data.version!==1){warn('Original weapon attack modes could not be checked. Current weapons were kept; review their Attack form in Combat.');return;}
 const r=attributeReader(parsed.data,()=>{}),names:string[]=[];
 const check=(map:(key:string)=>string)=>{
  const name=r.text(...['weaponname','npcattackname','name','attackname'].map(map));if(!name)return;
  const range=r.text(...['weaponrange','npcattackrange','range','reach'].map(map));
  const e=matchEquipment(name,'weapon');
  if(range==='-'&&e&&(e.ranged||!e.thrown))names.push(name);
 };
 for(let i=1;i<=10;i++)check(key=>key.startsWith('weapon')?key.replace(/^weapon/,'weapon'+i):'__fixed_weapon_'+i+'_'+key);
 const groups=parseRepeating(parsed.data.attributes);
 for(const section of ['weapon','weapons','attack','attacks'])for(const row of Object.values(groups[section]?.rows||{})){
  const first=Object.values(row.fields)[0][0],prefix=first.originalName.slice(0,-first.name.length);check(key=>prefix+key);
 }
 if(c.weapons.some(w=>names.includes(w.name)&&w.range==='Melee'&&w.attackMode===(w.ability==='DEX'?'ranged':'melee')&&w.attackMode!==roll20DashWeaponMode(w.name,w.ability)))warn('An older Roll20 import may have classified a Dexterity-based melee weapon as ranged, or a non-Dexterity ranged weapon as melee, because its source range was a dash. In Combat, review the weapon\'s Attack form: Melee for a normal finesse attack, Ranged / thrown for a projectile attack. Current weapon choices, bonuses and spent resources were not changed. Do not re-import over your current character.');
 imported.weaponModeReview=1;
}
