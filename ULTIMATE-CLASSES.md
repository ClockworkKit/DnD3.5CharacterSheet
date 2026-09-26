# Ultimate SRD classes and base-class themes

The catalog now contains 58 base classes and 32 prestige classes. All 90 class reference links use `https://srd.dndtools.org/`. Stable class IDs are retained for existing characters. The older Psionic Fist and Slayer IDs link to the Ultimate SRD's Fist of Zuoken and Illithid Slayer pages respectively.

The class catalog, class-reference dialogs, generated summaries, resource counters, granted feats, and class documentation use the same source destinations. Recognized legacy class links refresh without changing personal notes, spent resources, or spell/feat/race/equipment source policies.

## Added classes

| Base class | Supported progression |
| --- | --- |
| Battle Dancer | Full BAB, Reflex saves, d8, skills, unarmed-damage and AC milestone reference |
| Death Master | Three-quarter BAB, d8, INT prepared arcane slots, rebuke counter |
| Jester | CHA spontaneous slots, spells-known limits, performance counter |
| Mountebank | Dragon Compendium base class; skills and feature milestones |
| Sha'ir | CHA prepared slots for gen-retrieved spells; shared arcane/divine daily pool |
| Urban Druid | CHA prepared divine slots, restricted armor and buckler proficiency |
| Psychic Rogue | INT power points, powers-known/level limits, sneak-attack progression |
| Erudite | INT power points, maximum power level, unique-powers table, bonus-feat reminders |

| Prestige class | Levels | Supported advancement |
| --- | --- | --- |
| Abjurant Champion | 5 | Existing arcane tradition; martial-proficiency and abjuration prerequisites |
| Master Specialist | 10 | Wizard tradition only; specialization needs confirmation |
| Unseen Seer | 10 | Existing arcane tradition; required divination spells checked |
| Frenzied Berserker | 10 | Base progression, frenzy/inspire-frenzy uses, Diehard |
| Warshaper | 5 | Base progression; qualifying form needs confirmation |
| Occult Slayer | 5 | Base progression and Weapon Focus prerequisite |
| Fist of the Forest | 3 | Base progression, feral-trance uses; lifestyle needs confirmation |
| Dervish | 10 | Base progression, dance uses, Spring Attack; slashing Weapon Focus checked |

All additions support class selection, multiclass totals, HP, skill training, level-up, feature summaries, and JSON round trips. Their source tables supply the numeric progressions. Curated descriptions distinguish automated rules from manual choices. Companion statistics, shape changes, conditional combat features, martial arcanist, school-specific caster-level modifiers, gen retrieval/expiry, and Erudite unique-power selections are **not fully automated**.

The new class lists add 201 Death Master, 92 unambiguous Jester, and 171 Urban Druid memberships. Existing spell rules remain intact; missing effects are explicitly labeled reference entries. Ultimate SRD lists Jester's Bestow Curse at both 3rd and 4th level: that membership is omitted and the class notes ask for DM review. Psychic Rogue has 69 memberships among the bundled powers; seven unbundled powers are recorded in `lib/psychic-rogue-power-list.json` and can be entered as custom powers.

## Themes

Every supported base class has its own named light or dark palette in **Page theme**. The original Parchment, Amethyst, and Classic themes remain available. Theme selection is independent of character class, persists in browser storage, and synchronizes between tabs. The pre-paint script restores the correct light/dark color scheme. Invalid or unavailable storage falls back safely.

`lib/class-themes.json` is the palette source. Run `node scripts/build-class-themes.mjs` to regenerate CSS and the pre-paint script; `--check` verifies that generated files and base-class coverage are current. Normal text, muted text, and accent colors are designed for readable contrast against each palette's paper surface.

## Regeneration and validation

- `python scripts/import-ultimate-classes.py CACHE` reads cached Ultimate SRD pages and `menu.html` (the site's `hometreemenufile.html`). Cache filenames replace `/` in the SRD path with `_`.
- `python scripts/import-ultimate-class-lists.py CACHE` refreshes spell/power list memberships.
- `python scripts/build-supplemental-spells.py` rebuilds spell extensions.
- The original core importer uses `lib/class-source-urls.json` and retains the new class and power-list additions.

Automated coverage includes class-source restrictions, table consistency, creation and advancement, abilities, equipment restrictions, prestige targeting and prerequisites, legacy source migration, spell-list conflicts, all 58 theme IDs, pre-paint restoration, and unavailable storage. 231 tests, TypeScript, lint, and both production builds pass. Browser checks exercised all 58 class-theme options, confirmed at least 4.5:1 text/muted/accent contrast against the paper surface, and verified reload persistence and cross-tab synchronization.
