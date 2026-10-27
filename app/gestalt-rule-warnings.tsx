'use client';
import type {Character} from '@/lib/model';
import {gestaltVariantWarnings} from '@/lib/gestalt-class-families';

export function GestaltRuleWarnings({c}:{c:Character}){
 const warnings=gestaltVariantWarnings(c);
 if(!warnings.length)return null;
 return <section className="subcard" aria-label="Saved gestalt rules review">
  <h3>Saved gestalt pairs need rules review</h3>
  <p className="fine">This sheet contains {warnings.length} paired {warnings.length===1?'level':'levels'} combining versions of the same class, which standard gestalt rules do not permit. Your saved classes, level-ups and resources have been preserved; nothing has been removed or converted. Review these historical pairs with your DM. New levels must use a valid pair.</p>
  <details><summary>Show affected paired levels</summary><ul>{warnings.map(w=><li key={w.key}>Level {w.level}: {w.message}</li>)}</ul></details>
 </section>;
}
