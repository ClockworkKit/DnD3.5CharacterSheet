# Source snapshot — September 9, 2026

Project: Barrow Ledger, the D&D 3.5 character sheet built with Astra for ClockworkKit.

GitHub repository: `ClockworkKit/DnD3.5CharacterSheet`.

## Contents

This snapshot contains the full application source, dependency lockfile, character API and database migrations, reference data and licensing notices, tests, importer scripts, and Sites configuration. Saved characters, database contents, credentials, dependency installations, and generated build output are excluded.

The last published source commit is `9bebace`, which includes the race expansion. This snapshot additionally preserves the subsequent automatic-calculation work: equipment and encumbrance, HP and advancement, caster progression, effects, daily resources, and formula controls. That expansion remains under development and has not been published as part of this GitHub export task.

## Checks performed

- Fixed TypeScript errors in recursive caster progression and escaped literal formula examples in the spell and power interfaces.
- TypeScript check passed: `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- All 44 existing automated tests passed: `node --test tests/*.test.mjs`.
- Production build passed using the Sites build helper.

The existing tests cover the previously published features. They do not establish complete coverage of the new automatic-calculation rules. No browser or live Roll20 delivery test was performed for this snapshot.

## Runtime

The project uses React, Vinext, and a Cloudflare Worker with a D1 binding named `DB`. The character API relies on authenticated identity supplied by Sites. Copying the source to GitHub does not transfer saved characters or publish the application through GitHub Pages. A deployment outside Sites requires equivalent authentication, database bindings, and migrations.

The existing `.openai/hosting.json` identifies the user's current Site. Preserve it when continuing that Site; use an appropriate independent deployment configuration for a separate installation.

## GitHub source

The repository's current files are replaced with this Astra-built web application at the owner's request. The earlier C# application remains available through the repository's existing commit history.

This source import preserves the repository's private visibility and default `master` branch. It does not update the live Site or transfer its saved character data.
