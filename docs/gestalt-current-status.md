# Standard defaults and gestalt: current handoff

Updated 2026-11-06 after desktop continuation from Cloud Astra's merged
`88c9d83`, including the standard prestige form correction below. Read [the rules policy](rules-policy.md) and
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

## Mixed Uncanny Dodge continuation (2026-11-05)

Combat now offers an explicit GM ruling for mixed or staggered gestalt Uncanny
Dodge histories. Review and confirmation record whether the improvement is
granted and, if so, the minimum attacker rogue level, with a GM name and source
explanation. This is a table decision, not a new automatic interpretation of RAW.
Ordinary multiclass and parallel faster-class progression retain their rules.

The optional record is scoped to the reviewed progression and relevant feature
replacements. Advancement makes it stale without deleting it. Focus loss suspends
a dependent ruling without erasing it or suppressing independent listed benefits.
Rulings cannot remove listed improvements or restore surrendered features. Saved
rulings stay visible when their sources disappear. Switching characters resets
the Combat draft, and confirmation rejects changed choices or progression.

Fourteen new regression cases exercise these boundaries, native/browser storage,
and paired advancement while preserving damage, preparations, history and spent
resources. Actual React rendering covers active, stale, suspended and removed
source states. Final validation is recorded in the implementation record.

## Turning-feat continuation (2026-11-05)

Extra Turning now adds its repeatable four uses to the existing Dread Necromancer
and Death Master rebuking cards. Improved Turning updates their effective levels
and Blackguard's Command Undead level. Cleric/paladin and Blackguard daily limits
reuse the same feat calculations; no new turning pools or class levels are added.

Eleven new regression cases cover ordinary and paired characters, delayed entry,
replacements, effective Charisma, granted-feat identity, old resource text, manual
limits, advancement and native/browser persistence. Changing a maximum preserves
spent uses even above the new limit. Personal names, notes, source annotations,
injuries, preparations and historical training remain intact. Current effective
levels appear through the existing resource guidance. The first three tests
reproduced the omissions before the fix. Final validation is recorded in the
implementation record; interactive browser acceptance remains open.

## Desktop continuation: standard prestige target form (2026-11-06)

The standard level-up form displayed custom prestige target choices but did not
send them to `gainLevel`. An interactive reproduction selected Sorcerer after a
previous Wizard grant; it incorrectly advanced Wizard again. The button now
submits all displayed choices, including explicit no-advancement selections.
An empty choice blocks advancement with an inline error; failed validation keeps
the draft for correction. Successful advancement clears transient targets and
the next die input. Existing saved targets are not rewritten or guessed.

Local browser verification covered the failing-before/passing-after target
change, blank-selection rejection, explicit opt-out, saved per-level history,
export and full reload. Inspection of the actual browser export confirmed
unchanged historical training, preparations, spent slots, notes and injury.
Additional browser smoke tests created a standard Fighter and Cleric // Wizard,
advanced them, saved and reloaded, and checked paired cancellation/stale-review
protection. These used synthetic characters on a separate localhost origin.

All 887 existing regression tests, TypeScript and both Pages/Worker builds passed.
This is a form-wiring correction, not a new rules interpretation. See the
implementation record for the exact reproduction and validation scope. The
complete browser acceptance matrix below remains open.

## Desktop continuation: shared spell lists and custom paired browser QA (2026-11-06)

Wizard and Sorcerer catalog filters now include the shared Sorcerer / Wizard
list. Adding a spell uses its destination tradition's level before other lists;
explicit class-only entries still take precedence and remain exclusive. No
existing saved spell levels, preparations or expenditures are rewritten.

Interactive testing created a synthetic custom prepared caster paired with
Fighter, changed the left side to Rogue and later the right side to Wizard,
and reviewed an edit to the earned custom casting table. Stale review was
blocked after changing the character name. Save, reload, native export and
reimport preserved three points of damage, recorded rolls, independent caster
levels and Magic Missile's two preparations/one spent use. The library now
finds Magic Missile on the Wizard list and adds Scrying at Wizard level 4.
The low-level character still cannot cast Scrying. See the implementation
record for the exact scope. All **890 tests passed**, as did TypeScript and both
the Pages and Worker production builds.

## First autosave after import (2026-11-13)

The level-up form now keeps the same editing session while an imported sheet receives its first save ID. A successful switch to another character starts a new session.

In an isolated browser, hold the first autosave of a disposable three-level paired import. Select Wizard and a custom combination prestige class, enter GM approval, choose the Wizard tradition, and open the review. Release the autosave. Both class choices, approval, target and open review should persist. Cancel, select Sorcerer as the arcane target, confirm, reload and export. The example advanced Wizard to 3, Sorcerer to 2, and Cleric and its domain book to 4. It retained the three points of damage and each book's spent slot. Switching away from a second character's unconfirmed review cleared it on return.

The standard check selected Cleric on a first-level Wizard before releasing the import's first autosave. The choice persisted, and confirming then reloading produced Wizard 1 / Cleric 1.

## Remaining work and explicit limits

The November 6 spellbook release reached Pages in run [42258109599](https://github.com/ClockworkKit/DnD3.5CharacterSheet/actions/runs/42258109599).
The live entry and Magic files matched the CI build. Two subsequent browser
checks switched away from a reviewed custom-class edit and a pending paired
level-up. Returning to the original sheet retained its saved custom table,
level 3 and 22/25 HP. Both unconfirmed reviews cleared on switch.

1. Interactive browser QA is still required: standard and paired creation,
   changing each side during level-up, prestige target review, cancel/stale review,
   custom-table editing, saving/reloading, export/import and character switching.
   The cloud session lacked browser control; desktop has now completed the
   interactive scenarios recorded above, including one custom-table edit and
   changes to each side on successive levels and character switching during the
   two reviews described above. The broader prestige/custom-profile matrix
   still needs interactive checks.
   Do not mark the entire gate passed based on rendering/storage tests.
2. Custom own-class resources and explicit prestige advancement schedules now
   use the existing engine and reviewed editor. Exceptional formulas, conditional
   grants/targets, and the broader source-specific feature audit remain unfinished. Manual pools, notes and counters remain supported.
   Names and milestone prose never grant invented mechanics.
3. Mixed/staggered Uncanny Dodge histories now support an explicit, persisted
   GM ruling; no unsupported combined threshold is silently substituted. Additional
   source-specific cases need their own evidence, policies and regressions.
   Mixed/staggered shared essentia now has an explicit, persisted GM ruling;
   exceptional meld effects, chakra choices and other source prerequisites still
   require review rather than being inferred from free-form notes.
4. Retained racial Hit Dice now precede pairs in creation, advancement and saved history. Level adjustment affects XP separately. Unknown racial progressions are rejected explicitly. Changing an existing racial-HD history still requires a reviewed conversion. See the November 13 implementation evidence below.
5. Full reviewed mode conversion remains a planned enhancement. Current mode
   changes are blocked rather than converting, dropping a class track or
   rewriting history. No existing character is automatically made gestalt.

No private character exports or player saves were used or modified. Keep this
milestone reviewable separately from a claim that the entire goal is complete.

## 2026-11-13: Racial Hit Dice before paired class levels

Implemented the recorded conservative interpretation of [monster characters](https://www.d20srd.org/srd/monstersAsRaces.htm#humanoidsAndClassLevels) with [gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm#buildingAGestaltCharacter). The published texts do not explicitly place racial dice on a gestalt track. Retained racial Hit Dice precede pairs; classes on both sides keep their own advancement. This supersedes earlier notes that all racial-HD combinations are unsupported.

Creation, totals, history, skill training, level-up review and casting-history labels use this order. The first racial die receives the first-HD HP and skill treatment; the first class pair receives ordinary later-level grants. HD-based feats, ability increases and rank limits count racial dice plus pairs. XP adds level adjustment. Class casting does not acquire racial levels. Printed racial BAB/saves add normally; the optional fractional method carries the racial fractions before rounding the combined total, using the existing good-save-start convention.

A gnoll with Fighter 1 // Wizard 1 has three HD, ECL4, BAB+2 and base saves +5/+0/+2. With base CON14 and INT16 (racial adjustments enabled), recorded dice 8/4/5 give 26 HP and skill grants 16/4/4. Wizard remains CL1. Advancing the pair at 10,000 XP reaches HD4/ECL5, grants one ability increase, and uses the next class Hit Die once.

Unknown racial progressions and a single retained die are rejected explicitly. Catalog races that replace their single racial die already record zero retained dice. Existing sheets are not converted on load. Changing a saved racial-HD count or switching its racial history requires the still-unimplemented reviewed conversion. Rejected Race edits, including detaching a racial reference, show an alert and leave the save intact. Ordinary races without retained dice can still be changed normally.

Seven regression cases cover the concrete calculations, fractional carry, subsequent advancement, unsupported histories, standard/replacement races, every catalog racial progression's stable creation, and first import save/native reload. The persistence case retains the level-four ability increase, assigned feat, historical training, injury and spent spell slot. All **936 tests** and TypeScript passed; both Pages and Worker production builds passed with existing script, bundle and plugin notices.

Isolated browser QA created the gnoll through the real dialog and checked its actual-level history. A separate synthetic already-leveled import selected Rogue and a new HP roll before its first autosave. Both draft selections survived that save. The resulting level-five confirmation saved/reloaded with the original ability and feat assignments, four earlier history rows, skill ranks, three damage and one spent slot intact. No real player storage or private exports were used.

The broader goal remains open, including reviewed progression/racial-history conversion and the remaining documented class-specific and browser acceptance cases.

## 2026-11-14: Racial skill summary consistency

The automatic class-skill flags now include all catalog racial-HD skill lists and always-class racial grants. Per-level training costs and explicit overrides remain intact. Five new regressions and isolated browser purchases/reloads preserve existing advancement, skill history, damage and spent slots. All 941 tests, TypeScript and the Pages build passed. See the implementation record for rules sources and concrete checks.
