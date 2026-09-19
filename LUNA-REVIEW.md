# Luna contribution review — September 19, 2026

Reviewed against `master` at `7be86e3`. The maintenance work and Roll20 continuation are separate review batches. Original working directories were preserved. The separate unfinished PDF importer was not combined with this change.

## Maintenance and reference data

- Retained Luna's feat metadata and class-text corrections. Corrected feat normalization so multi-paragraph Special conditions are complete. The normalizer and prerequisite-index script now share one catalog builder.
- Strengthened prerequisite tests to exercise actual BAB/caster boundaries, ancestry alternatives, spontaneous casting, power-point reserves, and all current prestige classes. Catalog checks validate spell shapes and invocation references while preserving intentional class-specific invocation entries with the same name.
- Fixed the remaining application lint/type errors, including plain functions named like React hooks, theme subscription/state handling, and save snapshots during consecutive edits. Generated outputs are excluded from linting.
- Maintenance checkpoint: 188 tests passed; lint and TypeScript passed.

## Roll20 continuation

Luna's draft lived in an older Sites checkout. Its new exporter/importer files were brought into the current GitHub project and reviewed against the actual Roll20 community sheet fields.

The draft could add demo possessions/classes, coerce missing numbers to zero, fail schema validation on boolean preparations, assign unrelated spells to the first caster, and reuse a potentially shared handout. The reviewed implementation instead uses a blank record, explicit numeric handling, separate casting profiles, preserved raw source data, and a fresh GM-only handout per export.

The UI provides file upload/paste, a preview, warnings, explicit import as a new character, and an original-JSON download. Importing first flushes pending edits on the open sheet. Manual calculations protect the source totals through save/reload. See [exporter instructions and mapping limits](roll20/README.md).

## Validation

- `node --test tests/*.test.mjs`: **203 passed**, no failures or skips.
- `npm run lint` and `tsc --noEmit`: passed.
- `npm run build:pages` and `npm run build`: passed. The Pages build reports large chunks and existing classic-script notices; the importer loads only when opened.
- The 15 Roll20 tests cover real sheet field names, ambiguous multiclass casting, preparations/spent uses, weapon selectors, psionics, duplicate fields, formula preservation, repeating-section order/RowIDs, prototype-like keys, size/schema limits, raw JSON/native/browser-storage round trips, GM command validation, fresh handout access, and HTML/chat escaping.
- Local production Pages walkthrough in Chromium 153: empty ledger, preview/cancel without writes, upload and separate imports, exact original-JSON download, arcane/divine spell selection, consecutive edits and immediate save/reload, cross-tab theme updates, pending-edit preservation, native backup round trip, and invalid-import rejection passed. No browser runtime errors were observed. The 390-pixel mobile dialog stayed within the viewport. Visual inspection caught and corrected an export textarea that grew with the entire JSON; it now has a bounded height.

No real Roll20 game was modified during this review. Installing/running the exporter in an actual game and comparing the result with its sheet remain acceptance checks. Automated mappings do not resolve every custom class, macro, game rule, or formula.
