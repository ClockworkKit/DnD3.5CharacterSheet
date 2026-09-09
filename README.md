# Barrow Ledger

A D&D 3.5 character-sheet website built with Astra for ClockworkKit.

Live sheet: https://barrow-sheet-demo.clockworkkit.chatgpt.site

This source snapshot also preserves the automatic-calculation expansion under development. See `SOURCE-STATUS.md` for its validation and publication status; the sections below document the previously published features.

A complete, editable 3.5 character sheet and Beyond20 companion. The existing Site identity and visual design are preserved.

## What it does

- Saves multiple private characters with authenticated ownership, autosave, explicit Save, optimistic revision checks, and JSON import/export.
- Tracks ability scores and temporary adjustments, HP, AC/touch/flat-footed, saves, base attack, grapple, iterative attacks, weapon damage, initiative, and the complete core skill list with custom specialties.
- Includes 606 spells and 110 feats from the revised 3.5 SRD, with searchable spell lists, domains, levels, full reference text, and source links.
- Tracks separate casting traditions, caster levels, save DCs, prepared copies, spontaneous slots including level 0, metamagic slot levels, spell penetration, and daily reset.
- Supports custom spells, feats, class and racial features, daily resources, inventory, coin weight, conditions, background, and campaign notes.
- Rolls locally or hands generic Roll20 chat macros to Beyond20, with a copyable macro for each journal entry. The early bridge catches Beyond20's custom-site events before hydration.

This is an editable sheet, not an automatic class progression or rules validation engine. Class totals can apply base attack and saves; selected racial bonuses are calculated separately. Equipment/feat bonuses, encumbrance penalties, spell exceptions, and house rules are entered manually. Common spell damage/healing formulas scale with caster level; other effects accept explicit custom dice. Initiative posts to chat. No token, HP, turn tracker, or character attribute synchronization is claimed. Beyond20's custom-site event API provides no delivery acknowledgement; a handoff is labeled accordingly.

## Source and licensing

`public/data/spells.json` and `public/data/feats.json` are plain-text conversions of the revised SRD mirror at https://github.com/olimot/srd-v3.5. Their Open Game Content notice, full OGL 1.0a, and original copyright notice are included in `public/data/OPEN-GAME-LICENSE.txt` and linked from the sheet. Reference HTML is never rendered as executable HTML.

`python scripts/import-srd.py /path/to/srd-source` rebuilds the data from the mirror's `spells/spells-*.html`, `basic-rules-and-legal/feats.html`, and `basic-rules-and-legal/legal-information.html`. Keep the directory structure intact.

Beyond20 reference: https://beyond20.here-for-more.info/api#integrating-with-beyond20

## Application

React/Vinext Worker using the Sites starter. D1 is declared logically as `DB` in `.openai/hosting.json`. The `characters` schema is in `db/schema.ts`; generated migrations are in `drizzle/`. Schema changes are applied through the hosting migration pipeline, never created at request time.

The API trusts the authenticated identity headers supplied by Sites and includes the owner key in every database query. Writes require JSON and same-origin requests. Updates and deletes require the current saved revision. Failed writes retain page edits and expose retry, export backup, and save-as-new options. Character switching flushes in-flight and subsequent edits before loading another character.

## Verification

- `node --test tests/*.test.mjs`: dice grammar/randomness, 3.5 mechanics, prepared/spontaneous spell accounting, reference completeness, Beyond20 event contract and macro safety, actual API create/load/update/delete against SQLite, ownership isolation, stale revision protection, validation, and request origin checks.
- `node node_modules/typescript/bin/tsc --noEmit`: type checks.
- Build with the installed Sites `scripts/build-site.mjs` helper.

No agent browser testing or live Roll20 end-to-end test was performed. The user can send a test roll from the Roll20 setup dialog with Beyond20 enabled in their desktop browser.

## Class expansion

All 11 core base classes and 4 psionic classes have level 1–20 starting templates. The Classes tab includes 24 SRD prestige classes, their entry requirements, progression tables and full class text. Multiclass totals can be reviewed and explicitly applied; miscellaneous modifiers, current HP and bought skill ranks are retained. Feats can receive reusable class-feature summaries. Existing saved characters and JSON exports default to empty class and psionic records without discarding their prior data.

Prestige casting advancement and eligibility remain manual. Ordinary class totals do not implement gestalt, fractional progression, racial Hit Dice, or level adjustment. Custom classes can be named and recorded for use with the user's own books. Assassin and Blackguard spell-list levels are included; the older Blackguard list name “Protection from Elements” is mapped to “Protection from Energy.” Corrupt Weapon uses the source's reversed Bless Weapon effects.

Psionics adds 286 SRD powers, editable powers known, a shared multiclass power-point reserve, per-tradition manifester levels, focus tracking, and cast/post/effect-roll controls. Augmentation costs, wild surge exceptions and power-specific DC adjustments are manual. Soulknife starts with Wild Talent's 2 PP, no powers, and no manifester level.

`python scripts/import-classes.py /path/to/class-source` rebuilds the class and psionic catalogs from `character-classes-i.html`, `character-classes-ii.html`, `prestige-classes.html`, `psionic-classes.html`, and the four `psionic-powers-*.html` source files. Run it after the base spell importer to restore prestige spell-list levels. All reference data is covered by the included OGL notice. No database table migration is needed for these additions to the saved character JSON.

## Race expansion

The Race tab and new-character dialog include 35 races: seven core choices, ten subraces, six monstrous races, two planetouched races, six psionic choices, and four popular book races. SRD entries include full source text; Changeling, Warforged, Goliath, and Whisper Gnome use concise original summaries and source links.

Ability adjustments and unconditional trait bonuses are separate calculation layers, each explicitly enabled. Selecting a race repeatedly cannot accumulate modifiers. Existing sheets default to neither layer, preserving scores and manually included bonuses. A review dialog separately controls size, land speed, and automatic languages. Custom race names and trait notes remain supported.

Enabled traits affect skill checks, general saves, natural armor, dodge AC, powerful-build grapple checks, and the shared psionic reserve. Small-size Hide adjustments are included with trait bonuses; conditional bonuses and racial spell-like abilities remain reference notes. Plating, spell resistance, resistances, and class-dependent bonuses are entered in the corresponding fields.

Racial HD and level adjustment are recorded separately; a house-rule checkbox excludes LA from the displayed ECL. Class totals include gnoll and lizardfolk racial HD progression, and new characters include those HD in HP and experience. Updating an existing race does not change its HP, prepared spells, class resources, or weapon dice; these require review. New characters calculate starting racial abilities, Constitution HP, casting ability bonuses, and Small weapon dice.

`python scripts/import-races.py /path/to/race-source` rebuilds the catalogs from the revised SRD race files and the listed Monster Manual files, with the concise book summaries maintained in the script. No database migration is needed.
