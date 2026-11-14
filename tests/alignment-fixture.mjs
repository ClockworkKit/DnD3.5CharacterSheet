import {classAlignmentEligibility} from '../lib/class-alignment.ts';
import {findClass} from '../lib/classes.ts';
// Unrelated mechanics fixtures explicitly record a neutral-good alignment and
// the Cleric/deity source review. This never grants a contradictory exception.
export function withFixtureAlignment(c,alignment='Neutral Good'){
 c.alignment=alignment;
 for(const requirement of classAlignmentEligibility(c,findClass('cleric')).requirements)
  if(requirement.state==='confirm')c.prerequisiteConfirmations[requirement.key]=true;
 return c;
}
