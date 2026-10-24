import {characterSchema,uid,type Character,type Spell} from './model.ts';
import {attributeReader,parseRepeating} from './roll20-attributes.ts';
import {roll20ExportSchema} from './roll20-schema.ts';
import {findClass,makeCaster} from './classes.ts';
import {effectiveScore} from './ancestry.ts';
import {activateAutomation,migrateRoll20Automation,recompute} from './automation.ts';
import {applyClericSpecialty,isSilverbeardSpell} from './cleric-specialty.ts';
import {axeBrotherDomainList} from './cleric-domains.ts';

/** Evidence only: a deity alone never selects a specialty or invents class levels. */
export function axeBrotherImportEvidence(c:Character){
 const parsed=roll20ExportSchema.safeParse(c.roll20Import?.raw);if(!parsed.success)return null;
 const r=attributeReader(parsed.data,()=>{}),groups=parseRepeating(parsed.data.attributes);
 const domains:string[]=[];
 for(const section of ['doains','domains','domain'])for(const row of Object.values(groups[section]?.rows||{})){
  const field=Object.values(row.fields).flat().find(f=>f.name.toLowerCase()==='domainname');
  if(field){const name=r.text(field.originalName)?.trim().toLowerCase();if(name)domains.push(name);}
 }
 const classes=Array.from({length:10},(_,i)=>r.text('class'+(i+1))).filter(Boolean);
 if(classes.length!==1||!/^cleric(?:\s+dwarf\s+strength)?$/i.test(classes[0]!.trim())||!/^clangeddin(?: silverbeard)?$/i.test((r.text('deity')||'').trim())||domains.length!==2||!domains.includes('dwarf')||!domains.includes('strength'))return null;
 if(Object.values(groups.classes?.rows||{}).length||Object.values(groups.class?.rows||{}).length)return null;
 const recorded=r.number('level1','class1level'),level=recorded&&recorded>0?recorded:r.number('level','character_level');
 if(!Number.isInteger(level)||level!<1||level!>20)return null;
 return {className:classes[0]!.trim(),level:level!};
}

/** Explicit player/DM repair, never run automatically on load. Work on a clone so errors are atomic. */
export function repairAxeBrotherImport(c:Character,spells:Spell[]):Character {
 if(c.roll20Import?.axeBrotherReview===1)return c;
 const evidence=axeBrotherImportEvidence(c);if(!evidence)throw new Error('This export does not uniquely identify a Clangeddin cleric with Dwarf and Strength domains.');
 const next=structuredClone(c),missing=!next.classLevels.length;
 if(missing){
  if(next.ancestry.racialHitDice||next.ancestry.levelAdjustment||!Number.isInteger(next.level)||next.level<evidence.level||next.level>20)throw new Error('Review current Cleric levels in Classes before repairing this import.');
  next.classLevels.push({id:uid(),classId:'cleric',name:'Cleric',level:next.level,notes:'Recovered from the Roll20 class entry: '+evidence.className});
 }else if(!next.classLevels.some(e=>e.classId==='cleric'))throw new Error('Add or correct the current Cleric class entry first; existing classes were not replaced.');
 const ordinary=next.casters.filter(p=>!p.casting?.domain&&(p.casting?.classId==='cleric'||!p.casting?.classId&&p.name==='Imported divine casting'));
 const domains=next.casters.filter(p=>p.casting?.domain&&(p.casting.classId==='cleric'||!p.casting.classId&&/^Imported divine casting [—-] imported domain spells$/.test(p.name)));
 const unresolvedDomains=next.casters.filter(p=>p.casting?.domain&&!p.casting.classId&&!domains.includes(p));
 if(unresolvedDomains.length)throw new Error('An unlinked domain spellbook needs review in Magic. If it is the renamed imported Dwarf/Strength book, restore its tradition name to "Imported divine casting - imported domain spells" before retrying. No extra domain pool was created.');
 if(ordinary.length!==1||domains.length>1)throw new Error('Review duplicate or missing Cleric spellbooks in Magic first; no books were merged or replaced.');
 const p=ordinary[0],level=next.classLevels.filter(e=>e.classId==='cleric').reduce((n,e)=>n+e.level,0);
 const domain=domains[0]||makeCaster(findClass('cleric')!,level,effectiveScore(next,'WIS'));
 if(!domains.length){domain.name='Dwarf and Strength domains';next.casters.push(domain);}
 const byId=new Map(spells.map(s=>[s.id,s]));
 // Move the same records, never recreate spells or reset their preparation/use counts.
 domain.spells=domain.spells.filter(k=>{
  const s=k.custom||byId.get(k.spellId);
  const move=isSilverbeardSpell(k.spellId)||s&&s.levels[axeBrotherDomainList]===undefined&&s.levels.Cleric===k.level;
  if(move)p.spells.push(k);
  return !move;
 });
 for(const book of [p,domain]){
  book.casting={classId:'cleric',domain:book===domain,automatic:true,progression:null,levelAdjustment:0,slotAdjustments:Array(10).fill(0)};
  book.ability='WIS';book.mode='prepared';book.list=book===domain?axeBrotherDomainList:'Cleric';
 }
 if(p.name==='Imported divine casting')p.name='Cleric';
 domain.name='Dwarf and Strength domains';
 const note='Dwarf and Strength share one domain slot per available spell level (no level-0 domain slots). Elemental Swarm from Dwarf summons earth elementals only. Silverbeard uses ordinary cleric slots. Recorded preparations and spent uses were retained; review any over-capacity entries.';
 if(!domain.notes.includes(note))domain.notes=(domain.notes+'\n'+note).trim();
 applyClericSpecialty(next,'axe-brother');
 for(const [name,description] of [['Dwarf domain','Grants Great Fortitude (+2 Fortitude); do not add it twice if already recorded. Domain spells use the shared Dwarf / Strength book. Spell Compendium p.273.'],['Strength domain','Once per day, as a free action, gain an enhancement bonus to Strength equal to your cleric level for 1 round. Apply and track this power manually; it does not stack with another enhancement bonus.']]){
  if(!next.features.some(f=>f.name.toLowerCase()===name.toLowerCase()))next.features.push({id:uid(),name,description,kind:'Class feature',source:'Cleric domain review',max:0,used:0});
 }
 // Recovering missing levels must not add their HP/BAB/saves on top of old manual totals.
 if(missing&&next.automation.enabled){
  const before={maxHp:next.maxHp,bab:next.bab,fort:next.saves.fort.base,ref:next.saves.ref.base,will:next.saves.will.base},hp=next.hp;
  recompute(next);
  const after={maxHp:next.maxHp,bab:next.bab,fort:next.saves.fort.base,ref:next.saves.ref.base,will:next.saves.will.base};
  for(const key of ['maxHp','bab','fort','ref','will'] as const){const path=key==='maxHp'||key==='bab'?key:'saves.'+key+'.base';if(next.automation.overrides[path]===undefined)next.automation.adjustments[path]=(next.automation.adjustments[path]||0)+before[key]-after[key];}
  recompute(next);next.hp=hp;
 }else activateAutomation(migrateRoll20Automation(next));
 // Adoption preserves old manual casting totals; this explicit review opts into standard progression.
 for(const book of [p,domain]){book.casting!.levelAdjustment=0;book.casting!.slotAdjustments=Array(10).fill(0);}
 recompute(next);
 next.roll20Import!.axeBrotherReview=1;
 next.roll20Import!.report.warnings.push('Applied the confirmed Axe Brother repair: current Cleric levels, full cleric casting progression, Dwarf/Strength shared domain slots, and ordinary-slot Silverbeard. Current HP, spell preparations and spent uses were retained. Earlier import warnings describe the original conversion; review over-capacity preparations and custom domain spells.');
 return characterSchema.parse(next);
}
