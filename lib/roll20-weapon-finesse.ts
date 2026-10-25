import type {Character,Weapon} from './model.ts';
import {matchEquipment} from './equipment.ts';
import {weaponContext} from './rules.ts';
import {finesseEligible,finesseShieldPenalty} from './weapon-finesse.ts';

export function chooseWeaponFinesse(c:Character,id:string,includedPenalty:number|null){
 const reviews=c.roll20Import?.weaponFinesse;
 if(!reviews?.[id])throw new Error('Load the imported Weapon Finesse review first.');
 if(includedPenalty!==null&&(!Number.isFinite(includedPenalty)||includedPenalty>0||includedPenalty< -100))throw new Error('Included shield penalty must be between -100 and 0.');
 reviews[id]={...reviews[id],mode:includedPenalty===null?'manual':'automatic',includedPenalty:includedPenalty??0};
}

/** Compare originals, never replace current weapons or infer what edited misc contains. */
export async function reviewRoll20WeaponFinesse(c:Character){
 const imported=c.roll20Import;
 if(!imported||imported.weaponFinesse!==undefined||c.sheetKind==='monster')return c;
 let source:Character|undefined;
 try{const {importRoll20}=await import('./roll20-import.ts');source=importRoll20(imported.raw).character;}catch{/* Current affected weapons will require review. */}
 const eligible=(character:Character,w:Weapon)=>finesseEligible(character,{...w,catalogId:w.catalogId||matchEquipment(w.name,'weapon')?.id},weaponContext(character,w).weapon==='ranged');
 const sourcePenalty=source?finesseShieldPenalty(source):0,currentPenalty=finesseShieldPenalty(c);
 const classEvidence=!!source&&source.classLevels.length>0&&source.classLevels.every(e=>e.classId)&&source.classLevels.reduce((n,e)=>n+e.level,0)===source.level;
 imported.weaponFinesse={};
 for(const current of c.weapons){
  const matches=source?.weapons.filter(w=>w.name===current.name)||[],original=matches.length===1?matches[0]:undefined;
  const currentAffected=eligible(c,current)&&currentPenalty!==0,originalAffected=!!source&&!!original&&eligible(source,original)&&sourcePenalty!==0;
  if(!currentAffected&&!originalAffected)continue;
  const catalog=original&&matchEquipment(original.name,'weapon');
  const unchanged=!!original&&c.weapons.filter(w=>w.name===current.name).length===1&&current.catalogId===catalog?.id&&current.attack===original.attack&&current.ability===original.ability&&current.attackMode===original.attackMode;
  const numeric=original?.roll20AttackSource!==undefined;
  // Numeric STR-based totals can already include an unlabelled DEX substitution.
  // Without a total, nonzero misc does not identify whether it contains shield ACP.
  const safe=!!source&&classEvidence&&unchanged&&sourcePenalty===currentPenalty&&(numeric?original!.ability==='DEX':original!.attack===0);
  imported.weaponFinesse[current.id]={mode:safe?'automatic':'review',includedPenalty:safe&&numeric&&originalAffected?sourcePenalty:0,...(classEvidence&&originalAffected?{sourcePenalty}:{})};
 }
 if(Object.values(imported.weaponFinesse).some(r=>r.mode==='review')){
  const message='Some Weapon Finesse shield penalties may already be in imported attack misc, or the weapon/equipment was edited. Existing attack handling was kept; review Weapon Finesse shield penalty under each affected weapon in Combat. Do not re-import over current characters.';
  if(!imported.report.warnings.includes(message))imported.report.warnings.push(message);
 }
 return c;
}
