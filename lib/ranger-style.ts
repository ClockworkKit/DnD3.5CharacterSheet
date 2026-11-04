import type {Character} from './model.ts';
import {classLevel} from './effects.ts';
import {featureReplaced} from './alternate-features.ts';
import {carrying,gearEquipment} from './equipment.ts';

/** PHB combat styles require light/no armor; the carrying rules also treat a
 * medium/heavy load as armor for restricted abilities. Read equipment directly:
 * equippedArmor also checks proficiency, which can depend on a granted feat. */
export function rangerStyleRestriction(c:Character):string{
 const armored=c.gear.some(g=>{
  if(!g.carried||!g.equipped||g.qty<=0)return false;
  const e=gearEquipment(g);
  return e?.kind==='armor'&&['light','medium','heavy'].indexOf(e.category)-(g.material==='mithral'?1:0)>0;
 });
 if(armored)return 'Ranger combat style is inactive while wearing medium or heavy armor.';
 if(c.automation.encumbrance&&carrying(c).category!=='Light')return 'Ranger combat style is inactive while carrying more than a light load.';
 return '';
}

export function rangerStyleLevel(c:Character,style:'archery'|'two-weapon'){
 if(c.automation.rangerStyle!==style||featureReplaced(c,'ranger','combat-style'))return 0;
 const level=classLevel(c,'ranger');
 return level>=2&&!rangerStyleRestriction(c)?level:0;
}
