# Roll20 3.5e exporter

In Roll20, open **Game Settings → Mod (API) Scripts**, create a new script, and paste in `export35.js`. Save it, then run one of these commands as a GM:

```text
!export35 --selected
!export35 --name "Character Name"
!export35 --id CHARACTER_ID
```

The script creates a fresh GM-only handout named `3.5e Export - Character Name - timestamp`. It never reuses an older handout that might have been shared. Copy the JSON from the handout into **Import from Roll20** in Barrow Ledger, or save it as a JSON file and choose that file in the dialog. Choose **Review import**, inspect the values and warnings, then **Import as new character**. Preview and Cancel do not save anything. Every completed import creates a separate character and saves pending edits to the previously open sheet first.

The exporter records every instantiated Attribute, including empty and zero current/max values, and reconstructs repeating sections by section and RowID while retaining each original attribute name. Roll20 does not expose arbitrary sheet-default fields as API objects; the script additionally queries a maintained list of important core 3.5e fields with `getAttrByName()`. Extend that list in `CORE` when a known core field needs coverage.

The complete original JSON, including unknown fields, abilities/macros, formulas, empty values, nulls, and zeros, stays attached to the character. **Notes → Roll20 import report → Download original Roll20 JSON** retrieves it. Native Barrow Ledger backups retain it too. Exports and the resulting character must fit the site's 1 MB save limit; larger files are rejected before changing any character.

The importer starts with a blank character and manual calculations. It maps identity, ability scores and temporary adjustments, fixed and repeating multiclass entries, current/maximum HP, saves, AC components, initiative, grapple, standard/custom skill ranks, currency, equipment, feats/features, fixed/repeating weapons, prepared spells, spontaneous usage, and a single psionic reserve. Source totals are retained through explicit offsets. Inspect those offsets before enabling automatic calculations or adding duplicate effects.

Armor check penalties entered as positive deductions are converted to negative modifiers, with a note in the import report. Already-negative penalties keep their sign. If no numeric total is available, the importer combines the normalized penalties from worn armor and shields. The original export remains unchanged.

Numbered arcane and divine spell sections are assigned separately. Ambiguous classes and domain spells get separate manual casting profiles for review. Unknown spells retain their recorded details. Unusual supported weapon damage selectors become fixed adjustments with a warning; arbitrary formulas are never evaluated. Unsupported powers, systems, custom sections, sheet-worker formulas, and macros remain recoverable in the raw JSON. The report identifies unresolved attributes and mapping limitations; it does not certify that every recorded rule has an automated equivalent.

Field names were checked against the [Roll20 community D&D 3.5 sheet](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/charsheet_3-5.html), blob `72bf12e240bd28865e2dd4bd6532665fc5f38cc6`, on September 19, 2026. Other sheet implementations may use different names. `getAttrByName()` can return a formula rather than a computed number; those values are preserved for review.

Additional website mappings belong in `lib/roll20-import.ts` and repeating-field parsing in `lib/roll20-attributes.ts`. Keep the standalone exporter's parser in sync with the latter; `tests/roll20-exporter.test.mjs` checks their parity. Run `node --test tests/roll20-*.test.mjs` for the importer and mocked Roll20 sandbox regressions. A real Roll20 game/export remains an acceptance check; the sandbox tests do not establish live game behavior.
