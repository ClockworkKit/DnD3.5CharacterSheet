# Standard defaults and gestalt: current handoff

Updated 2026-11-04 from the user's supplied goal and the GitHub checkout at
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

## Custom-prestige continuation (2026-11-02)

Custom prestige classes can now configure explicit per-level advancement of an
existing arcane, divine, general spellcasting or psionic tradition. Each schedule
can include levels without grants. The existing prerequisite, named GM approval,
same-family and two-prestige safeguards remain in place.

Standard custom-prestige advancement saves targets by class level; gestalt uses
its existing pair records. Both can choose a different eligible tradition later
without reassigning earlier gains. Targets require a class held before entry;
missing or ineligible saved targets produce review notices. Own/base and prestige
advancement of the same gestalt tradition still counts once.

The custom editor reviews targets for already earned levels alongside changed
resource totals. Source changes cannot silently discard saved choices, skill
history, preparations, chosen powers, focus, notes or expenditure. Standard gain
operations are atomic, and native/browser persistence includes the new optional
standard-level target records without migrating legacy sheets automatically.
See [the prestige contract](custom-class-profiles.md#explicit-prestige-advancement-2026-11-02).

Validation for this continuation: **819 tests passed**, including ten new
prestige regressions. TypeScript, Pages and Worker production builds passed.
React rendering covered grant controls, skipped levels, and both target-history
displays. Two standard level-up reference regressions found by the full suite
were fixed before the passing run. Interactive browser QA is still outstanding;
existing build notices remain.

## Shared-meldshaping continuation (2026-11-02)

The existing class-system panel now checks one Constitution ceiling across all
recorded soulmelds and shows a shared essentia total. Ordinary multiclass sources
add normally. Simultaneous gestalt classes use the consistently better printed
essentia progression once; unrelated class levels never increase capacity twice.
Independent meld lists, binds and class capacity increases remain separate.

Mixed or staggered overlapping essentia histories require an explicit total with
a GM name and source/ruling explanation. This optional record is scoped to the
reviewed progression and stays saved but becomes stale after advancement. It can
also describe additional essentia sources. Neither warnings nor loading delete
over-limit melds, binds, allocations, notes or expenditure. Rulings remain visible
after their class is removed and survive explicit daily rest without resetting
allocated essentia. Legacy sheets gain no implicit rule choice.

The implementation record distinguishes published multiclass rules from the
conservative gestalt application and unresolved mixed cases. The defensive audit
also verified the existing Evasion armor/load restrictions; it did not replace
them with an unsupported interpretation.

Validation: **830 tests passed** in the full suite, followed by **31 passing
related tests** after the final missing-table guard. The twelve new regressions
cover combined restrictions, every supported parallel pair through level 20,
side swaps, sequential and mixed histories, reviewed/stale rulings, unavailable
tables, independent capacities, module initialization and persistence. TypeScript
and both production builds passed. Rendering checks covered the changed states;
interactive browser acceptance remains separate and is still unavailable here.

## Granted-feat continuation (2026-11-03)

Catalog and alternate granted feats now preserve card identity, personal notes,
names, source annotations and counters. Changing a style, weapon or bonus feat
keeps the old record inactive; restoring that choice restores its original card.
The existing retained-resource store holds these histories alongside resources.
Saved rule identity keeps renamed cards functional without producing duplicates.
Legacy duplicate cards remain readable while contributing one copy of a grant.

Fixed grants from overlapping classes keep one source; separately selected
repeatable feats retain their stacking behavior. Ordinary selected feats remain
independent. Both kinds of managed class grant are excluded from general or
separately selected bonus-feat assignments. Invalid old assignments are retained
and explained for review, with their advancement reminder left pending.

The existing Feats panel exposes current granted identity, personal notes and
inactive records. Ten regressions cover standard/gestalt recomputation, style
and weapon changes, repeated choices, duplicate records, class advancement,
native files and fresh browser storage. The four initial regressions failed
before the fix. No player saves or private exports were used.

Validation: all **841 tests passed**, plus TypeScript and React rendering of the
changed controls and retained-note states. Pages and Worker production builds
passed; their existing bundle/script/plugin-timing/route-classification notices remain.
Interactive browser QA remains unavailable and is not replaced by rendering tests.

## Ranger-style continuation (2026-11-03)

Ordinary and alternate ranger combat styles now share their armor and load
restriction. Medium or heavier loads suppress the style when the saved
encumbrance option is enabled. Imported armor uses its saved category; mithral
retains its usual category reduction. Independent selected feats remain usable.
Attack penalties and extra attacks agree, and Classes, Calculations and granted
feat cards explain temporary inactivity. No choices or cards are removed.

Eight regressions cover standard and paired milestone levels, load boundaries,
effective Strength, optional encumbrance, imported armor, mithral, separate feats,
native files, fresh storage clients and paired advancement with preserved notes,
training, injuries and spent spell slots. Seven cases failed before the fix.
All **849 tests passed**, as did TypeScript and rendering checks of the updated
panels. Pages and Worker production builds passed with their existing notices.
Browser interaction remains unverified; the overall goal remains open.

## Imported armored-casting continuation (2026-11-04)

Imported armor no longer throws while rendering a supported spellbook or
invocation panel. Per-tradition spell failure reads the same saved equipment
stats as AC, including custom values that override a catalog reference. Bard,
warmage, duskblade and warlock exemptions remain scoped to their own traditions;
paired wizard spells retain their separate failure chance.

Gear now offers an optional shield type for imported shields. Explicit types
and recognized catalog identities survive personal renaming and drive existing
casting, shield-training and tower-penalty checks. Unidentified shields cannot
gain a casting exemption from an arbitrary name; the Spellbook shows a review
message. Old records acquire no automatic shield-type setting.

Thirteen regressions cover saved/custom and catalog stats, paired and ordinary
multiclass traditions, class milestones, shields, mithral, invocations, real
Roll20-format fixtures, native files, browser storage and paired advancement.
Preparations, expenditure, notes, injuries, equipment and earlier training stay
saved. The initial nine imported-equipment cases reproduced the crash before
the fix. All **862 tests passed**, as did TypeScript, React rendering checks and
both Pages and Worker production builds. Existing build notices remain.
Interactive browser QA and the broader source-specific audit remain open.

## Remaining work and explicit limits

1. Interactive browser QA is still required: standard and paired creation,
   changing each side during level-up, prestige target review, cancel/stale review,
   custom-table editing, saving/reloading, export/import and character switching.
   No browser-control tool is available in this cloud session. Do not mark this
   gate passed based on React rendering or storage tests.
2. Custom own-class resources and explicit prestige advancement schedules now
   use the existing engine and reviewed editor. Exceptional formulas, conditional
   grants/targets, and the broader source-specific feature audit remain unfinished. Manual pools, notes and counters remain supported.
   Names and milestone prose never grant invented mechanics.
3. Mixed/staggered Uncanny Dodge histories still show an explicit DM-review
   notice; no unsupported combined threshold is silently substituted. Additional
   source-specific cases need their own evidence, policies and regressions.
   Mixed/staggered shared essentia now has an explicit, persisted GM ruling;
   exceptional meld effects, chakra choices and other source prerequisites still
   require review rather than being inferred from free-form notes.
4. Racial-HD occupancy in gestalt remains explicitly unsupported. Level
   adjustment is supported without adding paired levels. Existing standard
   racial-HD support remains intact.
5. Full reviewed mode conversion remains a planned enhancement. Current mode
   changes are blocked rather than converting, dropping a class track or
   rewriting history. No existing character is automatically made gestalt.

No private character exports or player saves were used or modified. Keep this
milestone reviewable separately from a claim that the entire goal is complete.
