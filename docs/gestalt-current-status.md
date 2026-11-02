# Standard defaults and gestalt: current handoff

Updated 2026-11-02 from the user's supplied goal and the GitHub checkout at
`183213f`. Read [the rules policy](rules-policy.md) and
[the implementation record](gestalt-implementation.md) before changing mechanics.

**The overall goal remains open.** This page separates currently verified
behavior from the historical record's unfinished work. It is not a replacement
for the user's completion criteria or evidence of browser acceptance.

## Goal and implemented boundaries

Fresh PCs and NPCs default to standard D&D 3.5: armor grants AC; the first Hit Die
is maximized and later dice are recorded rolls; normal class advancement and
character-level benefits remain in effect. Independent optional HP, encumbrance,
level-adjustment, calculation and historical-training settings stay saved per
character. Existing saves retain their choices. There is no campaign-settings
service to supply implicit shared defaults.

Explicit gestalt characters store one ordered pair per actual level. Both
classes retain their individual progressions. Creation and guided paired
advancement use the existing calculation, history, prerequisite, resource and
storage systems. Reviews are atomic and reject stale confirmation. The saved
printed-table convention remains the default, with fractional bonuses optional.

| Required scenario | Existing automated evidence |
| --- | --- |
| Fresh standard Fighter, armor AC, first-level HP, ordinary advancement | `standard-rules-defaults.test.mjs` |
| Existing homebrew settings and independent optional rules | `standard-rules-defaults.test.mjs`, `gestalt-creation.test.mjs` |
| Fighter 5 // Wizard 5: five levels, correct HP/BAB/saves/skills | `gestalt-creation.test.mjs`, `gestalt-progression.test.mjs` |
| Ranger // Rogue skills and both feature sets | `gestalt-creation.test.mjs` |
| Wizard // Cleric and independent psionic traditions | `gestalt-creation.test.mjs`, `gestalt-integration.test.mjs` |
| Both sides changing classes; printed and fractional conventions | `gestalt-progression.test.mjs`, `gestalt-integration.test.mjs` |
| Prestige entry before the level, one prestige per pair, scoped combination approvals | `gestalt-integration.test.mjs`, `prerequisite-boundaries.test.mjs` |
| Character-level feats, ability choices and XP counted once | `gestalt-creation.test.mjs`, `gestalt-integration.test.mjs` |
| Native files, fresh storage clients, injuries, purchases and expenditure | `gestalt-integration.test.mjs`, `resource-preservation.test.mjs` |
| Standard behavior and Roll20 compatibility | Full regression suite, including the Roll20 suites |

## Resource-preservation continuation (2026-11-01)

- Classes displays authoritative paired history and actual character level.
  Independent class-level/removal/addition controls and skill-history reorder
  controls cannot corrupt a saved pair. Standard controls remain editable.
  Class cards distinguish effective Hit Dice/skills from base reference tables.
- Daily and supplemental resource cards retain identity, names, notes, sources
  and expenditure during recalculation and advancement. Generated guidance is
  refreshed only within a uniquely recognized generated block; other text is
  preserved and current guidance is displayed separately.
- Replaced class resources move to optional `retiredResources`, preserving their
  full records outside active calculations. Restoring the feature restores the
  same card and current retained expenditure. Explicit daily rest clears daily
  expenditure, including retained cards. Legacy sheets acquire no empty archive.
  These records survive native export/import and browser storage.
- Monk and ninja AC abilities use the higher complete source, never their sum.
  Wisdom contributes a bonus only. Helplessness/immobilization, armor, shields
  and applicable encumbrance suppress them; touch/flat-footed applicability and
  the existing Psionic Fist advancement are retained. See the implementation
  record for published sources and boundary tests.

Validation: **794 tests passed**, including nine new regressions. TypeScript and
both the GitHub Pages and Worker production builds passed. React rendering
checks verified standard editing, protected paired controls, paired history,
skill-order protection and retained-note visibility. Rendering and storage API
tests do **not** establish interactive browser acceptance. Builds retain existing
large-chunk, script, plugin-timing and route-classification notices.

## Custom-resource continuation (2026-11-02)

The reviewed custom-class editor now supports explicit daily spell slots,
optional spells-known allowances, power points, powers known, maximum power
levels, split casting abilities, delayed access, and supported level formulas.
Creation and guided standard/gestalt advancement reuse existing resource pools
and calculations. Eligible catalog prestige classes can advance custom traditions
without duplicating same-pair grants. Exact class IDs prevent name-based adoption.

Table review shows changed resource totals and preserves prepared spells, chosen
powers, notes, manual settings, focus and expenditure. Existing prestige targets
are recorded before new traditions change their ambiguity. Missing progression
rows preserve saved values and require source review rather than approximation.
All tables and resources survive native files and fresh storage clients. See
[the custom-profile contract](custom-class-profiles.md#explicit-spell-and-power-tables-2026-11-02).

Validation for this continuation: the full suite passed **809 tests**, including
15 new custom-resource regressions. After the final missing-table guards, all
108 related mechanics tests passed. TypeScript and both production builds passed.
React rendering checks covered the resource editor, unavailable spell columns,
linked spellbook and known-power limits. Interactive browser QA remains pending.

## Remaining work and explicit limits

1. Interactive browser QA is still required: standard and paired creation,
   changing each side during level-up, prestige target review, cancel/stale review,
   custom-table editing, saving/reloading, export/import and character switching.
   No browser-control tool is available in this cloud session. Do not mark this
   gate passed based on React rendering or storage tests.
2. Custom own-class spellcasting/manifesting tables now use the existing engine
   and reviewed editor. Custom prestige advancement of another tradition,
   exceptional formulas/grants, and the broader source-specific feature audit
   remain unfinished. Manual pools, notes and counters remain supported.
   Names and milestone prose never grant invented mechanics.
3. Mixed/staggered Uncanny Dodge histories still show an explicit DM-review
   notice; no unsupported combined threshold is silently substituted. Additional
   source-specific cases need their own evidence, policies and regressions.
4. Racial-HD occupancy in gestalt remains explicitly unsupported. Level
   adjustment is supported without adding paired levels. Existing standard
   racial-HD support remains intact.
5. Full reviewed mode conversion remains a planned enhancement. Current mode
   changes are blocked rather than converting, dropping a class track or
   rewriting history. No existing character is automatically made gestalt.

No private character exports or player saves were used or modified. Keep this
milestone reviewable separately from a claim that the entire goal is complete.
