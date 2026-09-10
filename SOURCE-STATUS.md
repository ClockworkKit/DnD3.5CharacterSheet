# Character creation and ability rolling — September 10, 2026

Barrow Ledger is the D&D 3.5 character sheet built with Astra for ClockworkKit, maintained in `ClockworkKit/DnD3.5CharacterSheet`.

## Completed

Empty ledgers now offer creation and import, without opening or saving a demo character. Deletion clears the open sheet instead of generating another example. Existing saves remain available. Saving an empty screen is a no-op, and loading errors have a retry action.

The creation dialog offers 4d6 dropping one lowest die, 3d6, and manual score entry. It displays the dice, allows unique score assignments by swapping, and previews racial totals and modifiers. New characters default to level 1 with no sample possessions, money, or selected spells. Class/race rules remain available, and HP, skills, casting, and psionics use the selected abilities. Dice and starting scores are recorded in Notes.

Skill purchases now track points and ranks at each character level. The sheet calculates class and cross-class costs, first-level grants, human bonuses, historical Intelligence, remaining points, and rank caps across multiclass history. Purchases refund immediately, new levels append in order, and imported ranks remain intact until assigned. Training costs and grants have per-level house-rule controls. Speak Language is available as a tracked skill without a check roll.

The header offers three remembered themes: the existing Parchment, dark purple Amethyst, and Classic 3.5 with monochrome boxed fields and bold section bars. Both application editions use the same themes.

The calculation expansion connects advancement, HP, equipped gear, encumbrance, combat routines, common feats and effects, spellcasting progression, psionic progression, and daily resources. Calculations exposes the inputs, progression choices, recorded Hit Dice and Intelligence, effect formulas, and house-rule overrides.

The finishing changes correct bonus stacking, conflicting-effect reactivation, effect expiry, movement overrides, masterwork/magic interactions, thrown weapons, flurry and off-hand routines, prestige advancement targets, casting requirements, and stale casting values after class removal. Recalculation preserves damage, prepared spells, and spent resources. Existing characters retain entered totals through visible adjustments.

See [README.md](README.md) for the supported rules and choices that still require player or DM input. This is not an exhaustive implementation of every published 3.5 exception.

## Validation

- All 81 automated tests pass, including 7 character-creation tests, 9 skill-training tests, 16 calculation tests, and 5 browser-storage tests. Creation and calculation checks exercise all 525 base-class/race combinations for validation, import/export, racial score previews, and repeat-calculation stability.
- The suite also covers legacy sheets, character persistence, ownership isolation, revision conflicts, request validation, dice parsing, and Beyond20 message handling.
- TypeScript checking and the Pages production build passed. Static asset paths and all five reference catalogs were verified for the repository URL. The Sites production build also passed, preserving the original edition.
- No browser walkthrough or live Roll20 delivery test was performed.

## GitHub Pages build

The new standalone build reuses the same character sheet and calculation engine. It saves characters in browser storage with validation, revision conflict checks, atomic writes under Web Locks, and explicit error messages when storage is blocked or full. Existing import/export files remain compatible. The original Sites edition retains its authenticated server API.

The public repository has Pages enabled. The latest verified deployment before this update published the skill-training and theme changes (`a10ed45`). Pushes to `master` now verify, build, and deploy the static site through GitHub Actions. See GITHUB-PAGES.md for the hosting setup.

## Publication and runtime

The current application is hosted at https://clockworkkit.github.io/DnD3.5CharacterSheet/ and updated through the repository's Pages workflow. The original Sites URL's last published source is the race expansion (`9bebace`); subsequent changes have not been redeployed there.

The repository contains application source, the dependency lockfile, database migrations, reference data and licensing, tests, importers, and Sites configuration. It excludes saved characters, database contents, credentials, installed dependencies, and generated build output.

The runtime uses React/Vinext, a Cloudflare Worker, D1, and Sites authentication. GitHub Pages does not supply that runtime. The existing Site configuration is preserved, and no database migration is needed for this update.

The earlier C# application remains in the repository's commit history. The repository uses the `master` branch.
