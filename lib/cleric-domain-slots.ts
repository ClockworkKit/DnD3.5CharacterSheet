import type {Character,Caster} from './model.ts';
import {castingDefinition,castingNumbers} from './advancement.ts';

export function hasClericDomainSlots(c:Character){
 return c.casters.some(book=>book.casting?.domain&&castingDefinition(book,c)?.id==='cleric');
}

export function addClericDomainSlots(c:Character,ordinaryId:string){
 const ordinary=c.casters.find(book=>book.id===ordinaryId);
 if(!ordinary||ordinary.casting?.domain||castingDefinition(ordinary,c)?.id!=='cleric'||hasClericDomainSlots(c)||c.casters.length>=15)return;
 const domain:Caster={...ordinary,id:crypto.randomUUID(),name:'Domain',mode:'prepared',spells:[],
  notes:'Prepare one spell from either of your domains at each available spell level, starting at 1st level.',
  casting:{classId:'cleric',domain:true,automatic:ordinary.casting?.automatic??true,progression:null,levelAdjustment:0,slotAdjustments:Array(10).fill(0)}};
 const numbers=castingNumbers(c,domain);
 domain.slots=numbers.slots.map(max=>({max,used:0}));
 domain.level=domain.casting!.automatic?Math.min(100,Math.max(0,numbers.level)):ordinary.level;
 c.casters.push(domain);
}
