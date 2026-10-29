import {berserkerStrengthActive} from './alternate-benefits.ts';
import {alternateClassLevel,classFeatureLevel,hasAlternateFeature} from './alternate-features.ts';
import {monkStyleBonus} from './alternate-grants.ts';
import {combatExpertiseAmount} from './combat-options.ts';
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

/** Do not infer a neutral character's choice or parse arbitrary alignment prose. */
export function favoredSoulDamageReduction(c:Character){
  if(alternateClassLevel(c,'favored-soul')<20)return null;
  if(hasAlternateFeature(c,'favored-soul-favored-of-bahamut-tiamat'))return {bypass:'epic',needsChoice:false,unknownAlignment:false};
  if(!classFeatureLevel(c,'favored-soul','damage-reduction'))return null;
  const alignment=c.alignment.trim().toLowerCase().replace(/\s+/g,' ');
  if(['lg','ln','le','lawful good','lawful neutral','lawful evil'].includes(alignment))return {bypass:'silver',needsChoice:false,unknownAlignment:false};
  if(['cg','cn','ce','chaotic good','chaotic neutral','chaotic evil'].includes(alignment))return {bypass:'cold iron',needsChoice:false,unknownAlignment:false};
  const neutral=['n','tn','ng','ne','neutral','true neutral','neutral good','neutral evil'].includes(alignment);
  return {bypass:neutral?c.defense.favoredSoulDr:undefined,needsChoice:neutral,unknownAlignment:!neutral};
}

/** Keep sources separate: bypass conditions and stacking require a ruling per hit. */
export function activeDamageReductions(c:Character) {
  const rows=c.defense.drSources.filter(source=>damageReductionStatus(c,source)==='Active');
  const add=(id:string,source:string,amount:number,notes='',bypass='—')=>rows.push({id,source,amount,notes,bypass,active:true,gearId:''});
  if(c.automation.enabled){
    const barbarian=classFeatureLevel(c,'barbarian','damage-reduction');
    const defender=classFeatureLevel(c,'dwarven-defender','damage-reduction');
    const notes='Automatic class source; does not stack with other DR unless that source explicitly says so. Applies to weapon and natural-attack damage, not energy damage. No HP is deducted automatically.';
    if(barbarian>=7)add('class-dr:barbarian','Barbarian',Math.min(5,Math.floor((barbarian-4)/3)),notes);
    if(defender>=6)add('class-dr:dwarven-defender','Dwarven Defender',defender>=10?6:3,notes);
    const warlock=classFeatureLevel(c,'warlock','damage-reduction');
    if(warlock>=3)add('class-dr:warlock','Warlock',Math.min(5,Math.floor((warlock+1)/4)),notes+' Cold iron weapons bypass this source. Supernatural: unavailable in antimagic; resolve suppression at the table.','cold iron');
    if(classFeatureLevel(c,'monk','perfect-self')>=20)add('class-dr:monk','Monk — Perfect Self',10,notes+' Magic weapons and attacks treated as magic bypass this source. Uses actual monk levels, not Psionic Fist advancement.','magic');
    const adept=classFeatureLevel(c,'dragonfire-adept','damage-reduction');
    if(adept>=6)add('class-dr:dragonfire-adept','Dragonfire Adept',adept>=16?5:2,notes+' Magic weapons and attacks treated as magic bypass this source. Extraordinary: antimagic does not suppress it.','magic');
    const soul=favoredSoulDamageReduction(c);
    if(soul?.bypass)add('class-dr:favored-soul',soul.bypass==='epic'?'Favored Soul — Favored of Bahamut/Tiamat':'Favored Soul',10,notes+' Supernatural: unavailable in antimagic; resolve suppression at the table.',soul.bypass);
  }
  if(berserkerStrengthActive(c)){const level=alternateClassLevel(c,'barbarian');add('acf-berserker','Berserker strength',level>=20?4:level>=11?3:2,'Stacks with other damage reduction, as specified by this feature.');}
  if(c.automation.enabled&&monkStyleBonus(c,'Undying Way')&&(c.automation.context.defensive!=='none'||combatExpertiseAmount(c)>0))add('acf-undying','Undying Way',2,'Requires the qualified sixth-level style benefit and fighting defensively, total defense, or actual Combat Expertise use. A saved Expertise amount without the feat or usable BAB grants no protection. Does not stack with other DR unless that source explicitly says so.');
  return rows;
}

export function formatDamageReduction(source:DamageReductionSource) {
  return `DR ${source.amount}/${source.bypass.trim()||'—'}`;
}
