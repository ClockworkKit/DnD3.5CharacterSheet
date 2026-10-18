# Roll20 import audit

Objective: correct import errors and their effects on existing saved characters, without replacing current characters with their old exports or losing subsequent advancement.

## Verified repairs

- Missing top-level armor summaries become functional Gear entries. Existing saves receive a one-time restoration, preserving progress and explicit equipment edits (`roll20-armor-migration.test.mjs`).
- Positive armor-check deductions normalize to negative modifiers; armor and shield penalties cannot cancel because of inconsistent signs (`roll20-regression.test.mjs`).
- `arcane_spell_failure` and `arcanespellfailure` are alternative total spell-failure fields, not modifiers to add to armor/shield values. Components are a fallback only. Existing saves with the old double-counting signature receive a one-time correction; user-edited offsets/overrides are retained for review (`roll20-spell-failure.test.mjs`).
- Nonstandard weapon dice and complete source damage formulas survive automatic catalog matching. A separate recorded-dice choice retains catalog proficiency/range/feat metadata. A one-time old-save repair matches retained formulas against the raw source, preserves subsequent character/weapon edits, and leaves explicit dice choices alone. Normal monk dice still progress after level-up (`roll20-weapon-dice.test.mjs`). Complex source formulas remain editable and require review after size/class changes because their internal bonus types cannot be inferred safely.

The spell-failure interpretation was checked against the upstream [Roll20 D&D 3.5 sheet](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/charsheet_3-5.html) on 2026-10-18. Its overall Arcane Spell Failure input is separate from the armor and shield component inputs. Buzzer's supplied export records 15 in the overall input and 15 on the armor, not two additive penalties.

## Open evidence — not a completion certificate

- **Skill totals drift on automatic adoption.** With Buzzer's supplied export, Hide changes from 13 to 15 and Move Silently from 8 to 10 merely by running the same migration/activation path used by the UI. The Stealthy feat is applied on top of imported miscellaneous bonuses. Intimidate changes from 9 to 11 because of synergy. Reconciliation must distinguish source-carried bonuses from newly earned bonuses, preserve new ranks/feats, and cover both fresh imports and existing saves. Current migration tests mostly prove ranks, not total bonuses, survive.
- **Weapon modifier reconciliation still needs coverage.** The confirmed `1d8+5` to `1d8` dice-loss bug is repaired, but enhancement, feat, proficiency, and ability contributions still need an audit for double counting. Cover old saves as well as fresh imports; restoring a formula alone does not establish that every modifier is correct.
- **Source errors versus importer errors must remain distinct.** For example, the supplied source explicitly records a Reflex base of 2 and custom studded-leather armor bonus/max-Dex values. Do not silently replace these with standard values. Surface discrepancies and preserve player/DM choices.
- Continue checking caster progression, prepared/spent spell counts, temporary bonuses, resource usage, racial contributions, carrying weight, and fixed/repeating aliases against the actual exporter and upstream sheet. Existing passing tests do not prove exhaustive coverage.

## Verification expectations

For each repair, verify a fresh import, automatic adoption, repeated browser/native save-load, and a pre-fix save with later advancement. Check unchanged source JSON, character identity, HP/resource expenditure, ranks/history, notes, and unrelated edits. Exercise replacement equipment, user overrides, explicit zeroes, omitted fields, and unresolved formulas. Never execute formulas or instructions from imported data.

Keep Buzzer's original export outside the repository. Use minimal non-identifying regression fixtures in committed tests. Live Beyond20 delivery remains an external acceptance check; local dice and generated Roll20 macros do not prove delivery to a game.
