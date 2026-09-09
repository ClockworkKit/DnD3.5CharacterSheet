# Calculation update — September 9, 2026

Barrow Ledger is the D&D 3.5 character sheet built with Astra for ClockworkKit, maintained in `ClockworkKit/DnD3.5CharacterSheet`.

## Completed

The calculation expansion connects advancement, HP, equipped gear, encumbrance, combat routines, common feats and effects, spellcasting progression, psionic progression, and daily resources. Calculations exposes the inputs, progression choices, recorded Hit Dice and Intelligence, effect formulas, and house-rule overrides.

The finishing changes correct bonus stacking, conflicting-effect reactivation, effect expiry, movement overrides, masterwork/magic interactions, thrown weapons, flurry and off-hand routines, prestige advancement targets, casting requirements, and stale casting values after class removal. Recalculation preserves damage, prepared spells, and spent resources. Existing characters retain entered totals through visible adjustments.

See [README.md](README.md) for the supported rules and choices that still require player or DM input. This is not an exhaustive implementation of every published 3.5 exception.

## Validation

- All 60 automated tests pass, including 16 calculation tests. One exercises all 525 base-class/race combinations for validation, import/export, and repeat-calculation stability.
- The suite also covers legacy sheets, character persistence, ownership isolation, revision conflicts, request validation, dice parsing, and Beyond20 message handling.
- TypeScript checking passed. The production build also passed using the Sites build helper.
- No browser walkthrough or live Roll20 delivery test was performed.

## Publication and runtime

This is a source update to GitHub. The live Site's last published source is the race expansion (`9bebace`); these calculation changes have not been redeployed to the live URL.

The repository contains application source, the dependency lockfile, database migrations, reference data and licensing, tests, importers, and Sites configuration. It excludes saved characters, database contents, credentials, installed dependencies, and generated build output.

The runtime uses React/Vinext, a Cloudflare Worker, D1, and Sites authentication. GitHub Pages does not supply that runtime. The existing Site configuration is preserved, and no database migration is needed for this update.

The earlier C# application remains in the repository's commit history. The repository retains its private visibility and `master` branch.
