import {characterSchema,type Character,type Spell} from './model.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from './automation.ts';
import {castingNumbers} from './advancement.ts';
import {chooseDilettante} from './factotum.ts';

/** Narrow source evidence, not character names or automatic permission to change a save. */
export function arcaneImportEvidence(c:Character):'factotum'|'sorcerer'|null {
 if(c.sheetKind==='monster')return null;
 const parsed=roll20ExportSchema.safeParse(c.roll20Import?.raw);if(!parsed.success)return null;
 let ambiguous=false;
 const r=attributeReader(parsed.data,()=>{ambiguous=true;}),groups=parseRepeating(parsed.data.attributes);
 if(Object.values(groups.classes?.rows||{}).length||Object.values(groups.class?.rows||{}).length)return null;
 for(let i=2;i<=10;i++)if(r.present('class'+i)&&r.text('class'+i))return null;
 const name=r.text('class1')?.trim().toLowerCase(),level=r.number('level1','class1level'),cl=r.number('arcanecasterlevel');
 if(ambiguous)return null;
 if(name==='factotum'&&level===1&&cl===2)return 'factotum';
 if(name==='sorcerer'&&level===2&&cl===1)return 'sorcerer';
 return null;
}

export function repairSorcererImport(c:Character):Character {
 if(c.roll20Import?.sorcererReview===1)return c;
 if(arcaneImportEvidence(c)!=='sorcerer')throw new Error('The original export does not identify this Sorcerer progression discrepancy.');
 if(!c.classLevels.some(e=>e.classId==='sorcerer'))throw new Error('Review the current Sorcerer class entry first; no class levels were replaced.');
 const books=c.casters.filter(p=>!p.casting?.domain&&(p.casting?.classId==='sorcerer'||!p.casting?.classId&&p.name==='Sorcerer'));
 if(books.length!==1)throw new Error('Review missing or duplicate Sorcerer spellbooks in Magic first.');
 const next=structuredClone(c);
 activateAutomation(migrateRoll20Automation(next));
 const p=next.casters.find(p=>p.id===books[0].id)!;
 p.casting={classId:'sorcerer',domain:false,automatic:true,progression:null,levelAdjustment:0,slotAdjustments:Array(10).fill(0)};
 p.ability='CHA';p.mode='spontaneous';p.list='Sorcerer / Wizard';
 const numbers=castingNumbers(next,p);
 p.level=numbers.level;p.slots=p.slots.map((s,i)=>({...s,max:numbers.slots[i]}));
 next.roll20Import!.sorcererReview=1;
 next.roll20Import!.report.warnings.push('Confirmed normal Sorcerer casting: current class levels and Charisma now determine caster level and daily slots, replacing imported casting overrides. Later levels, known spells and spent slots were kept. Earlier warnings describe the original import.');
 return characterSchema.parse(next);
}

export type ImportedDailyStatus='reference'|'unused'|'spent';
export function factotumImportedBook(c:Character){
 const books=c.casters.filter(p=>!p.casting?.classId&&!p.casting?.domain&&p.name==='Imported arcane casting');
 return books.length===1?books[0]:null;
}

/** Explicit review keeps the old book as a typed, non-castable snapshot, not a second spell pool. */
export function repairFactotumImport(c:Character,spells:Spell[],statuses:Record<string,ImportedDailyStatus>):Character {
 if(c.roll20Import?.factotumReview===1)return c;
 if(arcaneImportEvidence(c)!=='factotum')throw new Error('The original export does not identify this Factotum level discrepancy.');
 const entries=c.classLevels.filter(e=>e.classId==='factotum'),book=factotumImportedBook(c);
 if(entries.length!==1||!book||c.casters.some(p=>p!==book&&!p.casting?.classId)||c.roll20Import?.factotumArchivedCasting?.length)throw new Error('Review duplicate, renamed or missing Factotum/imported casting entries first. No books were removed.');
 if(c.classLevels.some(e=>e.classId!=='factotum')&&entries[0].level<2||c.ancestry.racialHitDice||c.ancestry.levelAdjustment)throw new Error('Review mixed class levels or racial advancement before correcting the Factotum level.');
 const next=structuredClone(c);
 const intendedLevel=Math.max(2,entries[0].level,c.classLevels.length===1?c.level:0);
 if(intendedLevel>30)throw new Error('Review the current Factotum class level before repairing this import.');
 activateAutomation(migrateRoll20Automation(next));
 const entry=next.classLevels.find(e=>e.id===entries[0].id)!;
 if(entry.level<intendedLevel){
  // This is a correction of a misrecorded level, not a new level-up or extra HP award.
  const paths=['maxHp','bab','saves.fort.base','saves.ref.base','saves.will.base'] as const;
  const totals=()=>[next.maxHp,next.bab,next.saves.fort.base,next.saves.ref.base,next.saves.will.base];
  const before=totals(),hp=next.hp;entry.level=intendedLevel;recompute(next);const after=totals();
  paths.forEach((path,i)=>{if(next.automation.overrides[path]===undefined)next.automation.adjustments[path]=(next.automation.adjustments[path]||0)+before[i]-after[i];});
  recompute(next);next.hp=hp;
 }
 const byId=new Map(spells.map(s=>[s.id,s]));
 for(const k of book.spells){
  const spell=k.custom||byId.get(k.spellId);
  // A previously selected daily spell is authoritative, especially its used flag.
  if(c.factotum.spells.some(s=>s.spell.id===(spell?.id||k.spellId)))continue;
  const status=statuses[k.id];
  if(!['reference','unused','spent'].includes(status))throw new Error('Confirm today\'s status for each imported spell; old preparation counts do not establish daily use.');
  if(status==='reference')continue;
  if(!spell||spell.referenceOnly)throw new Error('This spell needs rules review; keep it as reference only.');
  const chosen=structuredClone(spell);if(k.attack)chosen.attack=structuredClone(k.attack);
  chooseDilettante(next,chosen);
  next.factotum.spells.at(-1)!.spent=status==='spent';
 }
 // Preserve the entire current book, including later notes, formulas and use counts.
 next.roll20Import!.factotumArchivedCasting=[structuredClone(book)];
 next.casters=next.casters.filter(p=>p.id!==book.id);
 next.roll20Import!.factotumReview=1;
 next.roll20Import!.report.warnings.push('Confirmed Factotum 2 minimum; later class levels and recorded HP/base totals were retained. The generic imported spellbook is now read-only reference, not extra wizard slots. Daily spell status was explicitly reviewed; existing choices and inspiration expenditure were kept. Archived formulas and notes remain available for reference.');
 return characterSchema.parse(next);
}
