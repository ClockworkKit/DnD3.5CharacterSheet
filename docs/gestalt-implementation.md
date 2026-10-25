# Standard defaults and gestalt progression

Goal source: the user-supplied `goal-objective.md` (2026-10-25). This work is not complete merely when the phases below have unit coverage; creation, advancement, persistence, UI and existing saves must all be verified.

## Architecture findings

- `createPlayerCharacter` is the player creation boundary; `createNpcSheet` delegates to it. `newCharacter` also supplies demo/import fixtures and is not a migration boundary.
- Existing independent options already include `automation.hpMethod`, encumbrance, field adjustments/overrides, historical skill grants/class overrides, `ancestry.ignoreLevelAdjustment`, and separately tracked DR sources. Reuse these; do not create a master homebrew switch or duplicate their saved values.
- Equipped armor already adds AC. DR entries are independent; there is no automatic armor-to-DR conversion in the current calculation path.
- The creation dialog currently defaults to average HP, and cannot choose rolled HP. Old schema defaults also use average; changing that schema default would change legacy saves and is not safe. Standard creation must explicitly select and record actual Hit Die rolls after the maximized first die, without rerolling on load or recomputation.
- `classLevels` supplies individual class feature/casting levels. `classTotals`, `hitDieSequence`, `skillLedger`, `advancementNumbers`, and `gainLevel` assume their sum is actual level. Gestalt must adapt these common boundaries, not layer a competing sheet calculator over them.
- `automation.history` and `levelOrder` hold per-character-level HP/Intelligence/skill purchases. Gestalt needs one history row per paired level with both class identities, plus stable keys for safe round trips.
- `casterProgression`, `psionicProgression`, supplemental resources and class feature calculators use class-specific levels. Review overlapping prestige/base advancement and shared features explicitly; do not simply sum paired grants.
- Additional actual-level consumers found: racial HD/Illumian limits in `racial-abilities`, racial SR in `automation`, initiator level and essentia capacity in `class-systems`, Race's HD/ECL display, and prestige prerequisite checks. These must consume actual progression rather than summing the two class tracks.
- There is no campaign-settings service in the inspected browser-local character store. Keep character settings self-contained; do not invent an implicit campaign profile.

## Ordered implementation and completion gates

1. **Standard creation defaults:** rolled HP with maximum first die; record rolls once; preserve old average/maximum/custom settings. Verify Fighter HP/BAB/saves/skills/feat/XP, armor AC, optional switches, save/reload and NPC creation. Explain independent rule options in Calculations.
2. **Gestalt data and calculations:** persist ordered pairs referencing existing class entries; actual level is pair count (plus supported racial HD). Validate unique level keys, same-class/variant-family exclusions, class table limits, prestige prerequisites, one-prestige-per-pair and prohibited dual-progression classes with named, recorded GM overrides. Define custom-class extension points. Integrate better HD/BAB/saves/skill grants and the union of class skills; keep Constitution and character-level benefits single-counted. Audit shared class abilities, spellcasting, psionics, invocations and other supported resources.
3. **Creation and level-up UI:** standard is the default; gestalt reveals both choices at each level. Extend guided level-up to validate both choices against the pre-level character and preview all changes before confirmation. Track changes on either side independently. Explain actual character level versus class levels. Preserve damage, preparations and expenditure when applying a level.
4. **Compatibility:** no implicit conversion on import/load. Any mode switch must validate/preview mappings and retain old progression/history rather than silently dropping a side. Cover old saves, native export, browser persistence, Roll20, alternate features, custom classes and prestige casting targets.
5. **End-to-end gate:** full test/type/build checks plus browser creation/level-up/save/reload. Required scenarios: standard Fighter; existing homebrew save; Fighter 5 // Wizard 5; Ranger // Rogue skills/features; Wizard // Cleric separate casting; class changes on either side; prestige restrictions/prerequisites; feats/ability increases once; both tracks round-trip. Do not mark the goal complete with any gate missing.

## Rules references and decisions still to verify

- [Unearthed Arcana gestalt rules, SRD](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm): best overlapping progressions, both non-overlapping feature sets, separate spellcasting, no two prestige classes at one level, suggested prohibition on combination prestige classes.
- Multiclass BAB/save interpretation and shared-feature accrual need explicit documentation and regression examples before implementation. Do not silently use fractional variants, sum both sides, or allow staggered poor/medium progressions to exceed a full progression.
- Published racial-HD replacement, level adjustment, custom classes and class-combination exceptions must be handled explicitly or surfaced as unsupported review cases, not approximated without notice.

The Weapon Finesse fix is a separate tested change. Its earlier commit was not executed because approval review hit a usage limit; ordinary approval review became available again during Phase 1 verification. Keep its commit separate from the standard-default changes.

## Phase 1 implementation status

- Creation now explicitly defaults to recorded HP, maximizes the first Hit Die, rolls later starting dice once and stores them in level history and Notes. Explicit average/maximum options remain available. Old schema defaults are deliberately unchanged.
- New-character dialogs reset optional HP/specialty choices on opening. Calculations explains independent saved rule settings; it does not reset or copy them into competing flags.
- Seven new tests cover standard Fighter numbers/armor, deterministic and generated starting rolls, validation/minimum HP, rolled level-up, old homebrew saves, independent method changes without healing, and NPC/browser/native persistence. Existing level-up tests now supply valid recorded dice instead of relying on the former average creation default.
- Verification: targeted suite 47 passing; full suite 614 passing; TypeScript and production Pages build passed. Browser QA created a Human Fighter 3 with CON 14, recorded d10 rolls 10/1/5 and HP 22, then saved 18/22 HP and reloaded without rerolling or healing. Notes and Calculations showed the recorded dice. Selecting maximum HP, cancelling, and reopening creation restored the standard default. An existing average-HP character retained its method and 17/22 HP. The calculation-page layout was visually checked. Deployment still requires an approved push.
- Gestalt data, calculations, creation and advancement are not implemented yet. Continue with Phase 2 only after resolving Phase 1 verification failures.
