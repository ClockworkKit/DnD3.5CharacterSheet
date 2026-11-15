'use client';
import {optionalRuleSettings} from '@/lib/character-rules';
import {Choice,Section,type SheetProps} from './sheet-ui';

export function RulesConfiguration({c,edit}:Pick<SheetProps,'c'|'edit'>){
 const options=optionalRuleSettings(c);
 return <Section title="Rules configuration" note={(c.advancementMode==='gestalt'?'Gestalt D&D 3.5e advancement.':'Standard D&D 3.5e advancement.')+' Options are saved independently with this character.'}>
  <p className="fine">Equipped armor grants AC. Damage reduction sources are separate and do not automatically replace armor AC. HP method is selected below; level-adjustment exceptions are in Race; individual calculation overrides are below; custom skill grants and training are in Skills.</p>
  {options.length?<><p className="fine">Current optional settings (including retained imported adjustments):</p><ul>{options.map(option=><li key={option}>{option}</li>)}</ul></>:<p className="fine">Standard HP, level-adjustment and encumbrance settings are selected. No custom calculation or skill-training overrides are enabled.</p>}
  {c.advancementMode==='gestalt'&&<><Choice label="Monk / Paladin gestalt continuation" value={c.gestaltContinuationRule??'continuous'} options={[[ 'continuous','Advancing either side continues the class'],['review','Review each paired continuation']]} onChange={value=>edit(d=>{d.gestaltContinuationRule=value as 'continuous'|'review'})}/><p className="fine">Interpretation: a class remains uninterrupted while it advances on either side of every pair. A later pair omitting it needs return review. Unearthed Arcana does not explicitly resolve this interaction; choose per-level review if your table handles it differently.</p></>}
  <p className="fine">Changing one option does not reset the others. Existing characters keep their saved settings; there is no global homebrew switch.</p>
 </Section>;
}
