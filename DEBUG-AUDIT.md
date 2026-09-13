# Character sheet debug audit

September 13, 2026. Audited the current Pages edition and the code after PR #12, whose merged commit is `201351fa7330301677885272749a301380f5d6da`. This pass fixes existing behavior; it does not expand the rules catalog.

## Fixes

| Problem | Reproduction | Corrected behavior |
| --- | --- | --- |
| A spell could use a slot below its spell level. | Give a level-5 wizard a prepared Fireball and change its slot level to 0. | Automated casting rejects the mismatch before spending a preparation. A sufficient slot works normally; manual calculation mode retains house-rule overrides. |
| A calculated zero-use spell-like ability acted as unlimited. | Move an ability with a daily-limit formula of `0` into Magic. | Rule/formula-backed limits of zero are exhausted. Untracked custom abilities still work without a counter. Calculated limits are read-only and no longer labeled as untracked. |
| Dragonfire Adept invocations incorrectly ignored armor failure. | Equip a Chain shirt on a Dragonfire Adept. | Invocation failure is 20%, with the percentage visible on invocation cards. Warlock's light-armor exemption and divine casting remain intact. |
| Krau created a caster level for classes a character did not have. | Give an Illumian Fighter 3 the Naen/Krau sigils and check Scribe Scroll. | Krau only modifies an existing supported casting class; it cannot qualify this noncaster for the feat. |
| Shield Proficiency was not recognized from class proficiency. | Browse feats on a fighter: Shield Proficiency was offered, while Improved Shield Bash was blocked. | The lookup resolves the catalog's `Shield, heavy wooden` name. Fighters already have the proficiency and qualify for Improved Shield Bash. |
| Some class-system warnings disappeared from the Magic tab. | Exceed the combined essentia pool or record extra Shadowcaster fundamentals. | Shared soulmeld-pool warnings and class-display-name warnings survive the tab's filtering. Existing choices remain available for correction. |
| Malformed API requests were reported as service outages. | Send `null`, an array, a scalar, or malformed JSON to character write/delete routes. | POST, PUT, and DELETE return validation errors (400). Authentication, owner isolation, and revision checks continue to apply. This concerns the original server-backed edition, not browser-only Pages storage. |

Rules references: [Dragonfire Adept](https://srd.dndtools.org/srd/classes/baseDrm/dragonfireAdept.html), [Illumian sigils](https://srd.dndtools.org/srd/races/racesRod.html), and the existing bundled spell, feat, and equipment catalogs. Invocation armor failure is displayed for player resolution; this change does not automatically roll failure or resolve individual invocation effects.

## Automated validation

- **171 tests pass**, including all 2,350 base-class/race creation combinations and an added 250-scenario check of all 50 base classes at levels 1, 4, 8, 12, and 20. The latter checks recalculation stability, save-schema compatibility, and rest results.
- Existing regression coverage includes feat chains and duplicate choices, prestige entry, XP leveling, ability/feat reminders, skill budgets and rank caps, multiclass advancement, equipment and combat, racial choices and slot costs, spell/power progression, class resources, invocation eligibility, and legacy saves.
- Browser-storage tests cover save/import round trips, concurrent-tab revision conflicts, blocked/full storage, and malformed or unsupported saved data. SQLite-backed API tests cover owner isolation, revisions, CRUD, and invalid requests.
- Added targeted regressions for spell-slot mismatches, zero-use resources, invocation armor failure, Krau, and shield proficiency. The invocation rest test now checks the returned rested character, correcting a test that previously ignored it.
- TypeScript and the GitHub Pages production build pass. The Pages build retains its existing large-main-bundle and classic-script warnings; Magic still loads separately. No saved-character schema or database migration is required.

Commands:

```sh
node --experimental-strip-types --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build:pages
git diff --check
```

## Live browser checks

Performed on the deployed version, before these fixes, using disposable characters in desktop Chrome at the [Pages URL](https://clockworkkit.github.io/DnD3.5CharacterSheet/).

| Workflow | Result |
| --- | --- |
| Character creation and calculation | Human Fighter 8 and Warlock 6 created with expected HP, saving throws, and advancement reminders. Rolled abilities were retained. |
| Save and reload | Character identity and edits survived reload. A learned Baleful Utterance retained its grade, equivalent level, and source notes. |
| Feat duplicates | After selecting Combat Reflexes, it disappeared from eligible results. The shield-proficiency defect above was reproduced in this walkthrough. |
| Skills | Fighter 8 displayed the expected 44-point grant, class-rank cap 11, and cross-class cap 5.5. Purchases/refunds and automatic level selection are covered by regression tests. |
| Relevant Magic sections | A fighter displayed the empty-magic guidance. A warlock displayed invocation/class controls without ordinary spell slots or an unrelated psionic section. |
| Invocation eligibility | Warlock 6 showed 55 eligible entries. Devour Magic was hidden; Show all exposed both the wrong-class and insufficient-grade reasons with disabled Learn controls. Baleful Utterance could be learned once and disappeared from eligible results afterward. |
| Invocation practice card | Posting Baleful Utterance produced a practice journal entry with its source notes and Roll20 macro controls. No ordinary spell slot was spent. |
| Guided XP advancement | Changing XP to 30,000 offered levels 7 and 8, one at a time. Seven points of existing damage were preserved: HP changed from 23/30 to 27/34 and then 32/39. The prompt disappeared at level 8. |
| Dropdown and dialog controls | Wheel scrolling kept the class menu bounded, and a visible scrolled option selected correctly. Keyboard selection worked. The creation dialog's Close footer stayed visible, and the invocation dialog's footer closed it. An initial off-screen automated click did not select its target; this was not reproduced when scrolling to the option first. |
| Theme | Amethyst rendered correctly and persisted through reload. Parchment was used for the rest of the walkthrough. |

## Verification boundaries

The local preview remains blocked by this browser, so the new fixes have automated/build verification and still need a browser recheck after deployment. In particular, retest the Fireball slot error, a zero-capacity ability, fighter shield-feat results, armored Dragonfire Adept cards, and the two Magic warning cases.

This pass did not repeat native file upload/download or the two-tab conflict workflow in the live UI; their automated coverage passed, and earlier UI results remain in [Pages verification](PAGES-VERIFICATION.md). Mobile touch, other browsers, and the original authenticated Site's live UI were not certified. The API changes were tested locally against SQLite, not deployed to the original Site.

Beyond20 is absent from the test browser. The owner's earlier confirmation of actual Roll20 delivery remains recorded; this is not a new Roll20 delivery test. Practice output cannot confirm receipt in a game.

Existing manual boundaries remain: story-based prestige requirements, special bonus-feat exceptions, individual spell/invocation effects, and custom class rules still require player/DM review as described in the README. Passing this audit covers the tested workflows and supported calculations, not every possible campaign rule combination.
