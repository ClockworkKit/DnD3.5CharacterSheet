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
  return c.defense.drSources.filter(source=>damageReductionStatus(c,source)==='Active');
}

export function formatDamageReduction(source:DamageReductionSource) {
  return `DR ${source.amount}/${source.bypass.trim()||'—'}`;
}
