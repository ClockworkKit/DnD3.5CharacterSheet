# Skill points and page themes — September 10, 2026

Barrow Ledger is the D&D 3.5 character sheet built with Astra for ClockworkKit, maintained in `ClockworkKit/DnD3.5CharacterSheet`.

## Completed

Skill purchases now track points and ranks at each character level. The sheet calculates class and cross-class costs, first-level grants, human bonuses, historical Intelligence, remaining points, and rank caps across multiclass history. Purchases refund immediately, new levels append in order, and imported ranks remain intact until assigned. Training costs and grants have per-level house-rule controls. Speak Language is available as a tracked skill without a check roll.

The header offers three remembered themes: the existing Parchment, dark purple Amethyst, and Classic 3.5 with monochrome boxed fields and bold section bars. Both application editions use the same themes.

The calculation expansion connects advancement, HP, equipped gear, encumbrance, combat routines, common feats and effects, spellcasting progression, psionic progression, and daily resources. Calculations exposes the inputs, progression choices, recorded Hit Dice and Intelligence, effect formulas, and house-rule overrides.

The finishing changes correct bonus stacking, conflicting-effect reactivation, effect expiry, movement overrides, masterwork/magic interactions, thrown weapons, flurry and off-hand routines, prestige advancement targets, casting requirements, and stale casting values after class removal. Recalculation preserves damage, prepared spells, and spent resources. Existing characters retain entered totals through visible adjustments.

See [README.md](README.md) for the supported rules and choices that still require player or DM input. This is not an exhaustive implementation of every published 3.5 exception.

## Validation

- All 74 automated tests pass, including 9 skill-training tests, 16 calculation tests, and 5 browser-storage tests. One exercises all 525 base-class/race combinations for validation, import/export, and repeat-calculation stability.
- The suite also covers legacy sheets, character persistence, ownership isolation, revision conflicts, request validation, dice parsing, and Beyond20 message handling.
- TypeScript checking and the Pages production build passed. Static asset paths and all five reference catalogs were verified for the repository URL. The Sites production build also passed, preserving the original edition.
- No browser walkthrough or live Roll20 delivery test was performed.

## GitHub Pages build

The new standalone build reuses the same character sheet and calculation engine. It saves characters in browser storage with validation, revision conflict checks, atomic writes under Web Locks, and explicit error messages when storage is blocked or full. Existing import/export files remain compatible. The original Sites edition retains its authenticated server API.

The repository includes a Pages workflow. On a push while Pages is disabled, it verifies and packages the static site. Deployment runs once Pages is enabled, or when the workflow is started manually. The repository is now public; Pages was still disabled when this update was prepared. See GITHUB-PAGES.md for the activation steps.

## Publication and runtime

This is a source update to GitHub. The original live Site's last published source is the race expansion (`9bebace`); the calculation, skill-training, and theme changes have not been redeployed to that URL.

The repository contains application source, the dependency lockfile, database migrations, reference data and licensing, tests, importers, and Sites configuration. It excludes saved characters, database contents, credentials, installed dependencies, and generated build output.

The runtime uses React/Vinext, a Cloudflare Worker, D1, and Sites authentication. GitHub Pages does not supply that runtime. The existing Site configuration is preserved, and no database migration is needed for this update.

The earlier C# application remains in the repository's commit history. The repository uses the `master` branch.
