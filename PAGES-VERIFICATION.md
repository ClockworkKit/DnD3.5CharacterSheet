# GitHub Pages verification — September 12, 2026

Tested the [live Pages edition](https://clockworkkit.github.io/DnD3.5CharacterSheet/) in a desktop Chrome cloud browser with disposable QA characters. The browser initially had an empty ledger. No existing player characters were used.

Baseline source: `038c8a8b2922c2595873d41bb25c5a0c2728c2d0`. The [Pages workflow](https://github.com/ClockworkKit/DnD3.5CharacterSheet/actions/runs/34495803040) successfully deployed that commit on September 10. The fix in this PR is not deployed by this walkthrough.

## Live walkthrough results

| Area | Result and evidence |
| --- | --- |
| Empty ledger | PASS: Create and Import controls appeared; no demo character was loaded. |
| 4d6 creation | PASS: six visible rolls summed correctly after dropping one lowest die, including a tie. Roll totals were 11, 11, 12, 8, 12, 10. Assigning Roll 3 to Strength swapped Constitution to Roll 1. |
| Created fighter | PASS: Human Fighter 1, STR 12, CON 11, INT 8; HP 10/10, BAB +1, class saves +2/+0/+0. Saved automatically and reopened after reload. |
| 3d6 and Cancel | PASS: six totals (9, 16, 11, 18, 7, 13) matched all three dice, with no dropped dice. Cancel returned to the existing character without replacing it. |
| Manual creation | PASS: Dwarf Wizard 1 with base STR 10, DEX 14, CON 12, INT 18, WIS 12, CHA 8. Preview applied CON +2 and CHA -2 once. Sheet had HP 6/6, AC 12, speed 20, 24 skill points, three cantrip slots and two first-level slots. No spells were preselected. |
| Autosave and explicit Save | PASS: background text survived reload without pressing Save; explicit saves completed with “Saved in this browser.” Starting scores and dice remained in Notes. |
| Two-tab conflict | PASS: two tabs opened the same revision. A saved a rename; B's subsequent save was rejected with “Another tab saved a newer revision.” B kept its edits, and Save as new character succeeded. |
| Export/import | PASS: downloaded fighter JSON contained its creation dice and background. Import created a new save and the original remained available in the picker. |
| Stateful backup round trip | PASS: wizard export/import retained HP 4/7, Balance 0.5 ranks, Concentration 3 ranks, and Magic Missile prepared 1/spent 1. Balance ranks and spent spell count also survived a reload. |
| Import envelope validation | **FAIL on live baseline; fixed in this PR.** A valid exported character wrapped in `format: "unrelated-app", version: 999` was accepted and saved. |
| Skill purchases | PASS: Concentration purchase of four points produced four ranks and check +6, then disabled further purchases at the cap. Refund reduced it to three ranks. One Balance purchase produced 0.5 rank and retained check +2. |
| HP recalculation | PASS: after taking three damage (3/6 HP), increasing base CON 12→14 changed HP to 4/7, preserving three damage. |
| Themes | PASS: Parchment, Amethyst and Classic selected successfully. Amethyst survived reload; switching to Classic propagated to the second tab. Amethyst and Classic were visually inspected. Returned to Parchment, which survived reload and character import. |
| Spell reference | PASS: library loaded, Magic Missile search returned one result, and adding it supplied the level-one formula `1d4+1`. |
| Practice roll and clipboard | PASS: `2d6+3` rolled 2 and 4 for total 9. Copy Roll20 macro placed the expected single-line default-template macro on the clipboard. |
| Missing Beyond20 | PASS: setup reported that Beyond20 had not announced itself. Test/cast attempts opened or retained setup instead of recording a successful handoff. Failed casting left prepared 1/spent 0. |
| Practice spell casting | PASS: switching back to Practice and casting spent exactly one prepared copy. |
| Actual Beyond20 → Roll20 receipt | **NOT VERIFIED.** No detected Beyond20 bridge or connected Roll20 game in this test browser. Unit tests are not evidence of extension or VTT delivery. |

The second tab's character picker does not refresh automatically when another tab adds or renames characters; reloading refreshes it. Revision protection still prevents overwrites. This is a usability limitation, not evidence of lost saves.

## Fix and regression evidence

The importer previously inspected only `raw.data || raw`, ignoring the export format and version. That can silently accept an incompatible export and discard unfamiliar fields during schema parsing. A JSON `null` also caused a low-level property-access error.

`parseCharacterFile` now checks declared format/version before parsing the character, rejects malformed or missing data with actionable messages, and retains compatibility with version-one exports, raw characters, and legacy `{data: character}` files. Rejected files never reach character replacement or saving.

Validation on this branch:

- All **84 tests pass** (81 existing plus three import regression tests).
- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed.
- `npm run build:pages` passed; the existing large-bundle advisory remains.
- The actual downloaded fighter backup passed the new parser; the same wrong-format file accepted by the live UI was rejected; JSON `null` received a readable validation error.
- The patched browser UI was **not** walked through: the cloud browser rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`. The original Sites production build was not rerun for this PR.

## Remaining acceptance checks

These require another browser environment or a connected tabletop. Do not label them passed based on the automated suite.

1. After merging/deploying, import an ordinary export, then the wrong-format and unsupported-version fixtures. Invalid imports should show an error while keeping the open character and saved picker unchanged. Repeat with malformed JSON and `null`.
2. On a desktop browser with Beyond20 installed, enable the Pages URL using the sheet's Roll20 setup instructions. Open a **test Roll20 game** in that same browser and explicitly select it in Beyond20.
3. Send the connection test. Confirm a `1d20` Connection test card actually appears in that game's chat. A “Handed to Beyond20” label alone is insufficient.
4. Test one ability/skill check, an attack/damage pair, a spell card, and a GM-whispered roll. Compare the inline formulas and character name in Roll20 with the sheet's copied macros. Verify initiative goes to chat; this app does not synchronize tokens, HP, attributes, or the turn tracker.
5. Repeat backup recovery in a second browser profile/device and test blocked/full storage. The existing storage tests cover these failures at the API layer; they were not forced in this browser walkthrough. Mobile layouts, Firefox/Safari, deletion, and the original Sites-to-Pages migration were not tested here.

The bridge follows [Beyond20's documented DOM/custom-site API](https://beyond20.here-for-more.info/api#integrating-with-beyond20). Its synthetic event tests validate request shape and detection gating, not live delivery.

## Follow-up: character options and scrolling

The follow-up branch adds bounded dropdown viewports, sticky dialog Close footers, maximum-HP controls, Factotum, and the Axe Brother cleric specialty. Automated checks cover maximum HP and damage preservation, Factotum progression/resources/spell limits, Silverbeard effects and unchanged cleric slots, and legacy/new save round trips.

The changed visual behavior still requires a deployed-browser check: the available browser rejected the local preview with `ERR_BLOCKED_BY_CLIENT`. On the deployed update, verify dropdown wheel/touch/keyboard scrolling and Close-footer reachability in long class, spell, and equipment dialogs at desktop and mobile widths, in every theme. Verify Factotum spell-card receipt in Roll20 with Beyond20; actual external receipt remains unverified. The existing live walkthrough above predates this follow-up.
