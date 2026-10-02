# Ultimate SRD race and Libris Mortis continuation

## Verified recovery state — 2026-10-01

- Workspace initially empty; cloned existing repository without discarding files.
- Base master b190efd includes merged PRs #23–#27.
- All 27 remote branches inspected; no race-expansion branch/PR found. Available local mirror predates that work; no race artifact recovered. Earlier reported counts and test results remain unverified.
- Working branch: feat/ultimate-races-libris-mortis. Finish with reviewable PR; no merge/deployment performed.
- No repository AGENTS.md. User’s Ultimate SRD source requirement governs this work.
- Shared React UI/model serves Pages browser storage and Sites API. Preserve both.
- Reused dependency cache with byte-equivalent lockfile (after line-ending normalization).

## Implementation complete

- 360 selectable races: the existing 47 IDs plus 313 additional choices. Nine templates/overview entries remain reference-only and cannot replace a base race. The earlier fragment “367” is not the final count.
- `scripts/data/ultimate-race-coverage.json` resolves all 363 distinct links in the main Ultimate SRD **RACES (By Subraces)** index. The separate By Book index includes additional duplicate/reprint/book-variant URLs; this is not a claim that all 435 URLs are separate imported choices.
- Hellbred body/spirit and four Mephling choices are separate. Reviewed parent inheritance retains numerical traits and removes replaced traits. Imported conditional traits use explicit manual notes, rather than guessing bonuses from the race name.
- Racial HD use the source creature's die, BAB, saves, skill budget and class skills. LA affects effective level only. Bonus feats and human-style skill points are independent. Absent abilities survive creation, serialization and race changes.
- Added all 48 stat blocks from the two Ultimate SRD Libris Mortis pages, including published template examples and the living/construct examples. Together with the six existing presets, the bestiary has 54 entries.
- Presets preserve printed HP, BAB, saves, AC, initiative, skills, movement, senses, defenses, special-ability names and source stat blocks. PC automation remains disabled for monsters. Every creation has independent data.
- Natural attacks retain primary/secondary roles and do not gain BAB iteratives. Manufactured attack sequences retain printed repeat attacks and can be edited. Swarms and damage riders have damage-only controls. Hit-point damage, ability damage and ability drain have distinct labels.
- Existing class, alternate-feature, Roll20 and browser/API storage functionality remains in the shared application. No replacement app or redesign.

## Verification

- Full regression suite: 306 passed, zero failed. Includes all 360 race / 50 class creation and automation combinations, source coverage, template rejection, inheritance, racial progression, absent abilities, preset isolation and attack semantics.
- TypeScript `--noEmit`, ESLint, production Vinext build, GitHub Pages Vite build, and `git diff --check` pass.
- Desktop browser: created Hellbred spirit NPC and Cinderspawn monster; checked absent Constitution, published totals, race search and reference-only Dragonborn. Edited HP to 61/65, saved, then verified persistence in a fresh page. Existing “Spell library check” Human Wizard retained scores and Kelgore's Fire Bolt.
- Mobile browser at 390 × 844: four Mephling choices visible; combat layout fits viewport; Cinderspawn CHA drain produces a labeled 1d6 practice roll; Bone Rat Swarm has a damage-only control and produces a labeled 1d6 practice roll. Restored normal viewport afterward.
- Manufactured attack editor: Entropic Reaper starts at +13/+8; changing the second offset to zero gives +13/+13 and survives Save and reload. Local browser console has no recorded errors.
- QA screenshots and full logs are local ignored files in `work/`; no test character data or source HTML cache is committed.
- Windows runner has bundled Node 24 but no npm/Bash executable. Validation invoked the installed TypeScript, ESLint, Vite and Vinext entry points directly. The production wrapper uses the same `vinext build` command with a 180-second bound. Dependency cache matched the repository lockfile after CRLF normalization. Shell scripts now enforce LF; generated theme comparison tolerates platform line endings.
- Nonfatal build warnings: large application/Roll20 chunks, plugin timing, classic public theme/bridge scripts intentionally copied rather than bundled, and Vinext's existing inability to statically classify the root route. Both builds complete and the Pages preview renders successfully.

## Source maintenance

Only Ultimate SRD was used; no secondary race/monster source exceptions.

1. `node scripts/download-ultimate-catalogs.mjs`
2. Install BeautifulSoup 4 in your Python environment, then `python scripts/import-ultimate-catalogs.py work/srd`.
3. `node scripts/build-ultimate-races.mjs` and `node scripts/build-libris-mortis.mjs`.
4. Review generated differences and run the regression suite. Imports are maintenance operations; normal builds/tests require no source-network access.

Source pages: [race index](https://srd.dndtools.org/srd/races/races.html), [Libris Mortis A–G](https://srd.dndtools.org/srd/monsters/monsters/lm/librismortisA-G.html), [Libris Mortis H–W](https://srd.dndtools.org/srd/monsters/monsters/lm/librismortisH-W.html).

## Remaining limitations and publication state

- Conditional racial bonuses, proficiencies, armor movement exceptions, racial casting, forms and complex special traits require the linked source and manual handling unless explicitly supported. Catalog availability does not imply complete automation.
- Some source stat blocks contain omissions or inconsistent components. Keep the printed values and preset notes; do not silently recalculate them. Examples include absent source BAB/initiative, AC component disagreement, an omitted ability label in evolved wraith, and Satyr's source-listed 5d8.
- Monster specials, saves imposed on targets and damage application remain manual. Printed offsets preserve the starting stat block; changing feats or special abilities may require updating those offsets.
- Alternate-feature transformations, companions and specialized effects remain unfinished from earlier work.
- Live site checked on 2026-10-01: it loads, but its footer shows **606 spells**, versus **4273** in this branch. Merged PR status does not establish live deployment. This task does not merge or deploy.
- Deliver this branch as a reviewable commit and PR against `master`; the chat records the actual pushed commit and PR URL. If interrupted before publication, inspect `git status` and remote branch state before continuing.
