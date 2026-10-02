# On-sheet class and race sources — 2026-10-02

## Scope and state

Started from `origin/master` after PR #28 was verified merged. Work branch: `feat/on-sheet-source-details`.

The user requested source information on the character sheet for Factotum, Rogue, Sorcerer, Cleric, Bard, Kenku, Illumian, Aquatic Kobold, Mountain Dwarf and Lirael's elf ancestry. Interpreted as readable rules, source-book names and Ultimate SRD links. Lirael was not found in the available project files; her subrace remains unconfirmed. Existing elf reference entries are included without inventing an identity for her.

## Behavior

- Collapsible rules references appear directly in Classes and Race, and together under **Notes → Rules & sources**. Existing library reference views also expose the expanded text.
- A separate `sourceReferences` field stores reference snapshots in saved characters and JSON exports. No feature grants, numerical adjustments, spent resources, or personal notes are changed by this field.
- Opening/recomputing PC/NPC sheets refreshes the matching references, even with calculations disabled. Roll20 imports receive them immediately. Recognizable race labels can obtain references without attaching or enabling racial bonuses. Removing/changing a class or race removes its stale generated reference.
- Monster records do not receive automatic reference enrichment. Existing monster round-trip/recompute behavior is retained.
- Core class text reuses the existing repository SRD reference library. Factotum and the four requested races have reviewed mechanical summaries. Illumian references include all power-word options, clearly stating only the selected combination applies.
- Factotum's Ultimate SRD introductory Hit Die says d6, conflicting with the existing d8 progression. The reference reports that discrepancy and retains existing statistics. No secondary source or silent HP change.
- These are base rules references, including later-level abilities. Character level and selected alternate features determine actual grants. This update does not claim additional rules automation.

## Maintenance and validation

Edit `lib/source-detail-notes.ts` for reviewed summaries. Run `node scripts/build-character-sources.mjs` after changing those notes or the underlying public class/race reference files. Generated `lib/character-source-data.json` is bundled; reading the notes needs no runtime source fetch.

Focused regression checks cover portable text/book/link data for all requested classes and named races, legacy enrichment with no change to other fields, changing identities, and JSON import/export. Existing Roll20 preservation tests pass unchanged. Desktop/mobile browser checks verified Kenku/Factotum details in Notes and Classes, save/reload, phone-width wrapping and no browser console errors.

Validation: 309/309 regression tests pass; TypeScript, ESLint, production build and Pages build pass. A final singular/plural elf-name lookup adjustment also passes the focused reference tests; GitHub runs the full suite on the published commit. Final PR status/URL are recorded in the task response. No merge or deployment is requested in this continuation.
