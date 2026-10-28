import {berserkerStrengthActive} from './alternate-benefits.ts';
import {alternateClassLevel,classFeatureLevel} from './alternate-features.ts';
import {monkStyleBonus} from './alternate-grants.ts';
import {uid,type Character,type DamageReductionSource} from './model.ts';

export function newDamageReductionSource():DamageReductionSource {
  return {id:uid(),source:'',amount:0,bypass:'',active:true,gearId:'',notes:''};
}

export function damageReductionStatus(c:Character,source:DamageReductionSource) {
  if(!source.active)return 'Inactive';
  if(source.amount===0)return 'Set an amount';
  if(source.gearId){
    const gear=c.gear.find(item=>item.id===source.gearId);
    if(!gear)return 'Linked item removed';
    if(!gear.carried||!gear.equipped||gear.qty===0)return 'Linked item not equipped';
  }
  return 'Active';
}

/** Keep sources separate: bypass conditions and stacking require a ruling per hit. */
export function activeDamageReductions(c:Character) {
  const rows=c.defense.drSources.filter(source=>damageReductionStatus(c,source)==='Active');
  const add=(id:string,source:string,amount:number,notes='')=>rows.push({id,source,amount,notes,bypass:'—',active:true,gearId:''});
  if(c.automation.enabled){
    const barbarian=classFeatureLevel(c,'barbarian','damage-reduction');
    const defender=classFeatureLevel(c,'dwarven-defender','damage-reduction');
    const notes='Automatic class source; does not stack with other DR unless that source explicitly says so. Applies to weapon and natural-attack damage, not energy damage. No HP is deducted automatically.';
    if(barbarian>=7)add('class-dr:barbarian','Barbarian',Math.min(5,Math.floor((barbarian-4)/3)),notes);
    if(defender>=6)add('class-dr:dwarven-defender','Dwarven Defender',defender>=10?6:3,notes);
  }
  if(berserkerStrengthActive(c)){const level=alternateClassLevel(c,'barbarian');add('acf-berserker','Berserker strength',level>=20?4:level>=11?3:2,'Stacks with other damage reduction, as specified by this feature.');}
  if(c.automation.enabled&&monkStyleBonus(c,'Undying Way')&&(c.automation.context.defensive!=='none'||c.automation.context.combatExpertise>0))add('acf-undying','Undying Way',2);
  return rows;
}

export function formatDamageReduction(source:DamageReductionSource) {
  return `DR ${source.amount}/${source.bypass.trim()||'—'}`;
}
