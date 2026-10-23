import {newWeapon,type Character} from './model.ts';
import {weaponAttack} from './rules.ts';
import {spellAttackCharacter} from './spell-attacks.ts';

export const eldritchBlastAttackNote='Unmodified blast: one ranged touch attack, 60 ft. maximum (not a range increment), no save. Choose a legal target; resolve blast shapes and essences separately.';

export function eldritchBlastAttackBonus(c:Character){
 const strike={...newWeapon(),name:'Eldritch blast',ability:'DEX' as const,attackMode:'ranged' as const,range:'Ranged',damageAbility:'none' as const,proficiency:'yes' as const};
 // Preserve Weapon Focus (eldritch blast), without treating this at-will ability as a weapon full attack.
 return weaponAttack(spellAttackCharacter(c),strike);
}
