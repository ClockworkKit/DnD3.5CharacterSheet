import type {Character,Weapon} from './model.ts';
import {armorProficient,equippedArmor,equipmentById,gearEquipment} from './equipment.ts';
import {hasFeat} from './effects.ts';

/** Nonproficient shields already impose this ACP through the general attack term. */
export function finesseShieldPenalty(c:Character){
 let penalty=0;
 for(const g of equippedArmor(c).selected){
  const e=gearEquipment(g)!;
  if(e.kind==='shield'&&(g.proficient??armorProficient(c,e)))penalty+=Math.min(0,e.checkPenalty!+(g.material==='mithral'?3:g.masterwork||g.enhancement||g.material==='adamantine'?1:0));
 }
 return penalty;
}

export function finesseEligible(c:Character,w:Weapon,ranged:boolean){
 const e=equipmentById(w.catalogId);
 return !ranged&&['STR','DEX'].includes(w.ability)&&hasFeat(c,'Weapon Finesse')&&!!(e?.hands==='light'||['Rapier','Whip','Chain, spiked','Unarmed strike'].includes(e?.name||''));
}

/** Explicit Dexterity stays explicit; automatic STR selection chooses the better total. */
export function weaponFinesse(c:Character,w:Weapon,ranged:boolean,mods:Record<Weapon['ability'],number>){
 let ability=w.ability,penalty=0;
 if(!c.automation.enabled)return {ability,penalty};
 const review=c.roll20Import?.weaponFinesse?.[w.id];
 const legacy=!!c.roll20Import&&(c.roll20Import.weaponFinesse===undefined||review&&review.mode!=='automatic');
 if(finesseEligible(c,w,ranged)){
  const shield=legacy?0:finesseShieldPenalty(c);
  if(ability==='STR'&&mods.DEX+shield>mods.STR)ability='DEX';
  if(ability==='DEX')penalty=shield;
 }
 if(!legacy)penalty-=review?.includedPenalty||0;
 return {ability,penalty};
}
