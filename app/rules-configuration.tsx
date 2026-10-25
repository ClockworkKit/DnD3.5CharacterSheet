'use client';
import {optionalRuleSettings} from '@/lib/character-rules';
import {Section,type SheetProps} from './sheet-ui';

export function RulesConfiguration({c}:Pick<SheetProps,'c'>){
 const options=optionalRuleSettings(c);
 return <Section title="Rules configuration" note="Standard D&D 3.5e advancement. Options are saved independently with this character.">
  <p className="fine">Equipped armor grants AC. Damage reduction sources are separate and do not automatically replace armor AC. HP method is selected below; level-adjustment exceptions are in Race; individual calculation overrides are below; custom skill grants and training are in Skills.</p>
  {options.length?<><p className="fine">Current optional settings (including retained imported adjustments):</p><ul>{options.map(option=><li key={option}>{option}</li>)}</ul></>:<p className="fine">Standard HP, level-adjustment and encumbrance settings are selected. No custom calculation or skill-training overrides are enabled.</p>}
  <p className="fine">Changing one option does not reset the others. Existing characters keep their saved settings; there is no global homebrew switch.</p>
 </Section>;
}
