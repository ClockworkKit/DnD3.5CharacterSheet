import {importedArmorSchema,type Character} from './model.ts';
import {attributeReader,type AttributeReader} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';
import {gearEquipment,matchEquipment} from './equipment.ts';

type Gear=Character['gear'][number];
const canonical=(name:string)=>name.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(Boolean).sort().join(' ');
const sameItem=(a:Gear,b:Gear)=>canonical(a.name)===canonical(b.name)||!!a.catalogId&&a.catalogId===b.catalogId;

/** Read only equipment summaries; never replace a saved sheet with its old export. */
export function roll20ArmorItems(reader:AttributeReader,warn:(message:string)=>void):Gear[]{
 const result:Gear[]=[];
 for(const kind of ['armor','shield'] as const){
  const name=(kind==='armor'?reader.text('acitem','armor_name'):reader.text('shieldname','shield','shield_name'))?.trim();
  if(!name||/^(?:-|none|no\s+(?:armor|armour|shield)|unarmou?red)$/i.test(name)||reader.boolean(kind+'worn')===false)continue;
  const catalog=matchEquipment(name,kind),prefix=kind==='armor'?'acitem':'shield';
  const category=kind==='shield'?'shields':reader.text(prefix+'type')?.trim().toLowerCase()||catalog?.category||'light';
  const penalty=reader.number(prefix+'checkpenalty')??catalog?.checkPenalty??0;
  const stats=importedArmorSchema.safeParse({kind,category,armor:reader.number(prefix+'bonus')??catalog?.armor??0,dexCap:reader.number(prefix+'dex')??catalog?.dexCap??100,checkPenalty:penalty>0?-penalty:penalty,spellFailure:reader.number(prefix+'spellfailure')??catalog?.spellFailure??0});
  const weight=reader.number(prefix+'weight')??catalog?.weight??0;
  if(!stats.success||name.length>160||weight<0||weight>100000){warn(`Could not restore ${name.slice(0,160)}: review the armor summary in the original export.`);continue;}
  const standard=catalog&&Object.entries(stats.data).every(([key,value])=>catalog[key as keyof typeof catalog]===value)&&weight===catalog.weight;
  const properties=reader.text(prefix+'properties')||'';
  result.push({id:crypto.randomUUID(),name,qty:1,weight,carried:true,equipped:true,catalogId:standard?catalog.id:undefined,importedManual:!standard||undefined,armorStats:standard?undefined:stats.data,
   notes:[`Imported Roll20 ${kind} summary.`,properties,!standard?'Recorded armor values are attached to this item and apply while carried and equipped.':''].filter(Boolean).join('\n').slice(0,2000)});
  if(!standard)warn(`Imported ${kind} "${name}" uses custom armor values; review its editable values in Gear.`);
 }
 return result;
}

export function importRoll20Armor(c:Character,reader:AttributeReader,warn:(message:string)=>void){
 for(const item of roll20ArmorItems(reader,warn)){
  const existing=c.gear.find(g=>sameItem(g,item));
  if(existing){Object.assign(existing,{catalogId:item.catalogId,armorStats:item.armorStats,importedManual:item.importedManual,carried:true,equipped:true});existing.notes=[existing.notes,item.notes].filter(Boolean).join('\n').slice(0,2000);}
  else c.gear.push(item);
 }
}

/** Idempotent repair for pre-fix saves, including already automated characters. */
export function restoreRoll20Armor(c:Character):boolean {
 const source=c.roll20Import;
 if(!source||source.equipmentMigration===1||c.sheetKind==='monster')return false;
 const parsed=roll20ExportSchema.safeParse(source.raw);
 if(!parsed.success||parsed.data.version!==1)return false;
 const warn=(message:string)=>{if(!source.report.warnings.includes(message))source.report.warnings.push(message);};
 const items=roll20ArmorItems(attributeReader(parsed.data,warn),warn);
 let changed=false;
 for(const item of items){
  const kind=gearEquipment(item)!.kind as 'armor'|'shield';
  const existing=c.gear.find(g=>sameItem(g,item));
  // Only upgrade the inert custom entries created by the previous importer.
  // Players' replacement equipment, equipped flags and item edits take priority.
  if(existing){
   if(existing.importedManual&&!existing.armorStats&&!existing.catalogId){existing.armorStats=item.armorStats||{kind,category:gearEquipment(item)!.category as 'light'|'medium'|'heavy'|'shields',armor:gearEquipment(item)!.armor!,dexCap:gearEquipment(item)!.dexCap!,checkPenalty:gearEquipment(item)!.checkPenalty!,spellFailure:gearEquipment(item)!.spellFailure!};existing.notes=[existing.notes,item.notes].filter(Boolean).join('\n').slice(0,2000);changed=true;}
   continue;
  }
  if(c.defense[kind]<=0||c.gear.some(g=>gearEquipment(g)?.kind===kind&&g.equipped&&g.carried&&g.qty>0))continue;
  if(c.gear.length>=500){warn('The equipment list is full; the original Roll20 armor summary remains available in Notes.');continue;}
  c.gear.push(item);changed=true;
 }
 source.equipmentMigration=1;
 if(changed)warn('Restored missing Roll20 armor equipment. Current character progress and combat totals were preserved; armor bonuses now follow the equipped item.');
 return changed;
}
