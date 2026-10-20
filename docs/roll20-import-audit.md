# Roll20 import audit

Objective: correct import errors and their effects on existing saved characters, without replacing current characters with their old exports or losing subsequent advancement.

## Verified repairs

- Missing top-level armor summaries become functional Gear entries. Existing saves receive a one-time restoration, preserving progress and explicit equipment edits (`roll20-armor-migration.test.mjs`).
- Positive armor-check deductions normalize to negative modifiers; armor and shield penalties cannot cancel because of inconsistent signs (`roll20-regression.test.mjs`).
- `arcane_spell_failure` and `arcanespellfailure` are alternative total spell-failure fields, not modifiers to add to armor/shield values. Components are a fallback only. Existing saves with the old double-counting signature receive a one-time correction; user-edited offsets/overrides are retained for review (`roll20-spell-failure.test.mjs`).
- Nonstandard weapon dice and complete source damage formulas survive automatic catalog matching. A separate recorded-dice choice retains catalog proficiency/range/feat metadata. A one-time old-save repair matches retained formulas against the raw source, preserves subsequent character/weapon edits, and leaves explicit dice choices alone. Normal monk dice still progress after level-up (`roll20-weapon-dice.test.mjs`). Complex source formulas remain editable and require review after size/class changes because their internal bonus types cannot be inferred safely.

Existing imports receive skill review on normal loading, switching, and native-backup import; no Roll20 re-import is required. The source is reconstructed only for comparison, never assigned over the current character. A fixed import-time adjustment preserves later ranks, feats, ability changes, class levels, history, and spent resources. Changed misc fields require review instead of automatic correction. Choices survive browser/native round-trips and repeated loads (`tests/roll20-skill-bonuses.test.mjs`). Missing or invalid source exports leave current skill values unchanged and add a warning.

The spell-failure interpretation was checked against the upstream [Roll20 D&D 3.5 sheet](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/charsheet_3-5.html) on 2026-10-18. Its overall Arcane Spell Failure input is separate from the armor and shield component inputs. Buzzer's supplied export records 15 in the overall input and 15 on the armor, not two additive penalties.

## Open evidence — not a completion certificate

- **Skill provenance still requires player/DM review where the source is ambiguous.** Numeric source totals now get a separate one-time automatic adjustment; nonnumeric misc/feat overlap is presented under Skills > Imported bonus review, without guessing. The owner confirmed Buzzer's Hide/Move Silently misc +4 includes racial +2 and Stealthy +2: choose Already included in imported misc for those two skills. Original-export checks then become 13 and 8, while later ranks still contribute. Intimidate 9 to 11 is NOT established as an import bug: the source has no numeric total or misc bonus, and five Bluff ranks legitimately grant +2 [synergy](https://www.d20srd.org/srd/skills/intimidate.htm). Do not suppress this bonus just to reproduce an incomplete manual total. Racial and conditional bonus provenance remains part of the broader audit.
- **Weapon modifier reconciliation still needs coverage.** The confirmed `1d8+5` to `1d8` dice-loss bug is repaired, but enhancement, feat, proficiency, and ability contributions still need an audit for double counting. Cover old saves as well as fresh imports; restoring a formula alone does not establish that every modifier is correct.
- **Source errors versus importer errors must remain distinct.** For example, the supplied source explicitly records a Reflex base of 2 and custom studded-leather armor bonus/max-Dex values. Do not silently replace these with standard values. Surface discrepancies and preserve player/DM choices.
- Continue checking caster progression, prepared/spent spell counts, temporary bonuses, resource usage, racial contributions, carrying weight, and fixed/repeating aliases against the actual exporter and upstream sheet. Existing passing tests do not prove exhaustive coverage.

## Verification expectations

For each repair, verify a fresh import, automatic adoption, repeated browser/native save-load, and a pre-fix save with later advancement. Check unchanged source JSON, character identity, HP/resource expenditure, ranks/history, notes, and unrelated edits. Exercise replacement equipment, user overrides, explicit zeroes, omitted fields, and unresolved formulas. Never execute formulas or instructions from imported data.

Keep Buzzer's original export outside the repository. Use minimal non-identifying regression fixtures in committed tests. Live Beyond20 delivery remains an external acceptance check; local dice and generated Roll20 macros do not prove delivery to a game.
