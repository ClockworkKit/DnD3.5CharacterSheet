# Standard defaults and gestalt progression

Current continuation: [verified behavior and remaining gates](gestalt-current-status.md).

**Standing requirement:** follow the [rules-as-written policy](rules-policy.md)
before changing mechanics. The 2026-10-27 user direction resolves the earlier
Uncanny Dodge question in favor of the gestalt faster-class rule; historical
notes below that say the choice is pending are superseded by this decision.

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
- The user selected printed-table multiclass bonuses, with fractional bonuses optional. The versioned interpretation and tie policy are documented below. Shared-feature accrual still needs its own integration and regression examples. Never sum both sides or allow BAB to exceed full progression.
- Published racial-HD replacement, level adjustment, custom classes and class-combination exceptions must be handled explicitly or surfaced as unsupported review cases, not approximated without notice.

The Weapon Finesse fix is a separate tested change. Its earlier commit was not executed because approval review hit a usage limit; ordinary approval review became available again during Phase 1 verification. Keep its commit separate from the standard-default changes.

## Phase 1 implementation status

- Creation now explicitly defaults to recorded HP, maximizes the first Hit Die, rolls later starting dice once and stores them in level history and Notes. Explicit average/maximum options remain available. Old schema defaults are deliberately unchanged.
- New-character dialogs reset optional HP/specialty choices on opening. Calculations explains independent saved rule settings; it does not reset or copy them into competing flags.
- Seven new tests cover standard Fighter numbers/armor, deterministic and generated starting rolls, validation/minimum HP, rolled level-up, old homebrew saves, independent method changes without healing, and NPC/browser/native persistence. Existing level-up tests now supply valid recorded dice instead of relying on the former average creation default.
- Verification: targeted suite 47 passing; full suite 614 passing; TypeScript and production Pages build passed. Browser QA created a Human Fighter 3 with CON 14, recorded d10 rolls 10/1/5 and HP 22, then saved 18/22 HP and reloaded without rerolling or healing. Notes and Calculations showed the recorded dice. Selecting maximum HP, cancelling, and reopening creation restored the standard default. An existing average-HP character retained its method and 17/22 HP. The calculation-page layout was visually checked. Deployment still requires an approved push.
- Phase 1 is verified and deployed. Phase 2's internal foundation is described below; gestalt is not yet a usable character mode.

## Advancement consistency follow-up

- Found and reproduced a mismatch: Golarion Cleric's selected alternate feature uses d10 in HP/history, but guided advancement validated rolls against the base cleric d8. Shared `classHitDie` now supplies totals, history, level-up options (including the UI label/maximum), and validation.
- Regression test first failed on a valid roll of 10, then passed with the fix. Standard clerics and Axe Brothers still use d8; invalid rolls do not mutate characters; injuries and spent spell slots survive advancement. Full suite: 615 passing; TypeScript and production build passed. Browser QA selected the variant on a synthetic cleric, entered 10 in the d10 level-up field, and advanced from 7/10 HP to 17/20 HP with 2d10.
- Remaining display audit for Phase 2: the Classes entry summary still describes the unmodified base-class table (including d8/BAB for a Golarion cleric). The authoritative totals and guided level-up are correct, but class cards should distinguish base-table references from effective variant values when integrating gestalt.
- Phase 1 and the Weapon Finesse fix were pushed as `558a66d` and `151caa9`; GitHub Pages run `40206837003` succeeded.

## Phase 2 foundation (not yet exposed to players)

- `gestalt-progression.ts` defines a strict, versioned plan of ordered pairs referencing existing class-entry IDs. Stable per-level keys retain a place for historical HP, Intelligence and skill purchases. Neither loading an old character nor any existing UI calls this compiler; no character-schema change or automatic conversion has been added.
- Compilation is read-only. It validates unique entries, matching class counts, complete class tables, distinct class families, and the ban on two prestige classes in one pair. The named combination prestige classes and Cerebremancer require a scoped GM name and reason. This does **not** waive entry prerequisites: the future advancement transaction must validate both classes against the pre-level character before applying changes.
- Explicit custom tables and class-family policy metadata have extension points; they cannot silently replace catalog tables. Actual catalog variant-family classification and custom skill-list integration remain to be completed. Racial-HD and monster combinations explicitly fail until a supported occupancy policy exists; level adjustment never creates a paired level.
- Paired rows use the existing `LevelRow`, HP grant, skill grant and skill-classification systems. They select the larger die and skill allowance, union known class skills, and apply Constitution, historical Intelligence, racial skill bonuses and the first-level multiplier once. Individual class identities and levels are retained separately.
- Constant-pair totals retain the better whole progression. A rejected prototype took the maximum rounded increment each level; tests caught it incorrectly producing Fortitude +5 for Fighter 5 // Wizard 5 instead of +4. The same defect affects medium/poor BAB at later levels. Do not restore that algorithm or change the regression expectations to match it.
- Mixed-class bonus calculation now supports the user-selected printed-table default and an explicit fractional variant. Neither method depends on left/right placement. See the policy below; this resolves the earlier pending rounding question without enabling a player-facing mode prematurely.
- Twelve foundation tests cover the required simple pairs; correct Fighter//Wizard and Cleric//Wizard bonus tables at all levels 1–20; either side changing classes; validation and approval round trips; alternate-class changes; custom tables; and shared HP/skill helpers. This is **not** complete gestalt creation, full character persistence, feature overlap, casting, or guided advancement.
- Remaining integration gates: attach validated plans to character persistence; adapt `classTotals`/`hitDieSequence` and all actual-level consumers; cap shared class/casting advancement per pair; validate prestige prerequisites in atomic previews; build creation/level-up and safe mode-switch UI; complete end-to-end save/import/export and existing-character checks. Do not announce gestalt availability before these gates pass.
- Verification: 627 tests passed across the full suite, including 12 new foundation tests; TypeScript and Pages build passed. The HP extraction retains the existing once-per-calculation Constitution lookup. No new UI or character-save field is enabled by this milestone.

## Multiclass bonus convention (user decision, 2026-10-25)

The user chose **printed-table progressions by default; fractional bonuses optional**. UA specifies the better progression but does not unambiguously resolve mixed-class rounded ties. The following is this sheet's explicit, versioned interpretation, not a claim that UA uniquely mandates these tie rules.

- `printed-table-v1` is the plan default. For BAB and each save independently, compare the underlying progression rates first. Choose full over medium over poor BAB, or good over poor saves. Then contribute that chosen class's actual printed-table increase at its own current class level. Do not compare rounded increases to choose the winner.
- When rates tie, continue the preceding level's selected class if it is still available among the best progressions. Otherwise choose the higher class level; remaining ties use stable class ID in lexical order. No class name, entry UUID, entry ordering or left/right placement participates. A later class choice cannot rewrite earlier contributions.
- Ordinary multiclass rounding and save starts are retained. A newly selected class at class level 1 contributes its printed initial bonus, but two overlapping starts in the same pair never stack. A newly introduced class does not displace an equal-rate continuing class just to collect another start. This can differ from fractional totals in either direction; the optional method is not promised to increase every mixed gestalt total.
- `fractional-v1` uses the same progression selection and tie convention, retains the fractional rate of each selected contribution, and rounds down only the final sum. Exact twelfths represent halves, thirds and quarters. The selected good-save class contributes its initial +2 at class level 1. This follows the D&D 3.5 fractional variant's per-class starts, **not** Pathfinder's separate once-per-save convention. Source: *Unearthed Arcana*, p. 73, “House Rule: Fractional Base Bonuses” ([book text](https://www.tjlee.com/dnd/uarcana.pdf)). Combining that variant with gestalt uses the explicit nonstacking selection policy above.
- Examples: Fighter 5 // Wizard 5 remains BAB +5, Fort +4, Ref +1, Will +4 in either method. Cleric 5 // Wizard 5 remains BAB +3. Rogue 1 // Wizard 1 followed by Bard 1 // Sorcerer 1 has printed BAB +0, Ref +4, Will +4, versus fractional BAB +1, Ref +5, Will +5. Switching Fighter and Wizard between left/right at level 6 still produces BAB +10 at character level 10.
- Rates are verified against each entire supplied table, not guessed from a class name, Hit Die or first row. All catalog tables currently match. Short ambiguous custom tables require an explicit matching `bonusProfile` in class-policy metadata; irregular tables fail for review rather than silently receiving a standard rate. Selected Golarion Cleric uses its effective full BAB in both current and previous values.
- `gestaltBonusLedger` exposes the chosen class, class level, printed delta, exact contribution and running bonus for each stat at each level. The future preview/UI should show these decisions and clearly label optional fractions. Method selection is carried from the validated plan to every compiled row; mixed-method rows are rejected. Calculating or comparing either method is read-only.
- Regression coverage now includes both methods at every level 1–20 for four constant pairs, mixed classes, all combinations of side swaps in a five-level fixture, prestige starts, fractional precision, custom metadata, all catalog rates, save/load plan round trips, and no mutation. Player-facing creation/advancement/persistence integration remains outstanding.
- Final verification for this convention: 636 full-suite tests passed (21 gestalt tests); TypeScript, whitespace checks and the production build passed. Supplemental class-policy metadata cannot erase a built-in combination-prestige approval requirement, and later choices cannot rewrite earlier bonus rows. No player saves or progression modes are changed by this internal milestone.

## Phase 2 integration: saved progression and shared calculation boundaries

- Character data now records `advancementMode` (default `standard`) and an optional versioned `gestaltProgression`. The structural schema lives in a data-only module to avoid schema initialization cycles. The full character validator verifies active plans against their class entries and catalog tables. Old saves and manual gestalt-like class text are never inferred as paired progression; all existing HP/homebrew settings remain untouched.
- `classTotals` and `hitDieSequence` now use the validated paired sequence when explicitly selected. The existing HP, historical Intelligence, skill purchases/rank limits, XP, feat and ability-choice systems consequently use actual level, while individual class features and bonus feat counts keep their own levels. No second HP/skill calculator or history store was introduced.
- Shared actual-HD counting now feeds racial scaling, martial initiator levels, essentia capacity and the Race page's HD/ECL summary. Gestalt's actual level remains the pair count even when base statistics are manual. Standard racial and custom-class behavior is retained.
- Native character files, browser storage and the real `prepareCharacter` load path preserve both class tracks, plan policy, HP damage, historical ranks/Intelligence, selected advancement choices, daily counters and spell expenditures. Invalid active plans fail before recomputation mutates data.
- Casting and manifesting advancement of the **same** tradition is capped at the better contribution in each pair. Independent traditions remain separate; cleric domains follow their primary tradition. Hierophant's CL-only advancement remains separate from slots and cannot duplicate simultaneous CL advancement; it still applies when a half-caster's current level grants no CL increase. Explicit per-tradition progression overrides retain their existing meaning.
- Mode changes through ordinary recomputation are rejected before mutation until the reviewed conversion workflow exists. Ordinary one-class level-up and independent skill-level reordering likewise reject paired characters. These are interim data-integrity guards, not the completed paired advancement or conversion UI.
- New integrated regression cases cover Fighter 5 // Wizard 5 through full recomputation, Ranger // Rogue skill purchases, Wizard // Cleric save/load/spent slots, legacy settings, invalid-plan atomicity, manual statistics, level-dependent racial/martial/incarnum limits, overlapping prestige casting/manifesting and Hierophant advancement. No user character files were changed.
- **Still incomplete:** shared noncasting feature accrual, persisted custom-class profiles, complete same-class variant-family classification, paired creation and guided level-up/prestige-entry previews, safe reviewed mode conversion, and end-to-end browser QA. Racial-HD occupancy remains an explicit unsupported policy. Do not announce gestalt ready for players or mark the goal complete yet.
- Verification: 647 full-suite tests passed, including 11 new integrated tests; TypeScript and the production build passed. The built browser preview loaded the existing synthetic Alternate Cleric HP QA sheet at level 2 with 17/20 HP and 2d10, and its Race page reported 2 HD/ECL. No player sheets were opened or edited. This is a standard-sheet browser smoke test, not the still-pending gestalt creation/advancement browser gate.

## Shared-feature audit: monk / Psionic Fist

- Reproduced a double-counting bug: six Monk // Fighter levels followed by four Monk // Psionic Fist levels produced effective monk level 14 instead of 10 for unarmed damage, AC and unarmored speed. Three new regression cases failed before the fix.
- `monkAbilityLevel` now supplies all four existing consumers (damage dice, AC, movement and resource/formula numbers). For explicit gestalt plans it counts each paired level containing either advancing class once; levels taken at different actual levels still accumulate, and switching left/right does not affect the result. Standard multiclass sheets retain their original summed levels, even if an inactive plan is present.
- Scope follows [Psionic Fist's Monk Abilities](https://www.d20srd.org/srd/psionic/prestigeClasses/psionicFist.htm) and [UA shared-feature advancement](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm). Flurry, Wholeness of Body and other monk powers still use actual monk class levels; Psionic Fist does not grant extra advancement to those powers. Existing alternate movement, armor restrictions, recorded weapon dice and manual settings remain intact.
- Six integrated cases cover all ten Psionic Fist levels, simultaneous versus separate advancement, side swaps, ordinary multiclass behavior, alternate movement and armor, and save/reload with injuries, spent healing and historical skill purchases preserved. No private character exports were modified.
- Remaining shared-feature work includes sneak attack, turning, and overlapping static features. This narrow fix does not complete the shared-feature audit or unlock the still-unfinished gestalt creation/advancement UI. Existing completion gates remain in force.
- Verification: all 653 tests passed (17 integrated gestalt cases); TypeScript, whitespace checks and the production build passed. The build retains its existing non-module script and large-bundle warnings. This calculation-only change did not add UI; the full gestalt browser workflow remains a later completion gate.

## Shared-feature audit: turning and sneak attack

- Cleric and paladin levels previously added both sides' turning advancement. The common `turningClassLevel` now counts one eligible contribution per actual gestalt level: cleric advances from its first class level, paladin only from its fourth. Nonoverlapping advances still accumulate. Standard multiclass remains cleric level plus paladin level minus three (minimum zero). Selected replacements remove only their own class's contributions; Improved Turning, Extra Turning and the single existing daily pool are not duplicated or refunded.
- The shared full-level counter is also reused by monk/Psionic Fist. It validates the recorded plan through the same compiler and does not introduce another progression store. [Paladin turning source](https://www.d20srd.org/srd/classes/paladin.htm#turnUndead); [UA shared-feature rule](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm).
- Sneak attack now has one policy table for existing sources: rogue, assassin and arcane trickster (one die per two class levels), psychic rogue and blackguard (per three), spellthief (per four), and focused lurk (per five, starting at level two). Each source retains its existing initial/delayed grants and class-specific alternate rules. Standard sheets still sum those independent sources exactly as before. Ninja sudden strike and scout skirmish are distinct abilities and remain separate; no precision dice are multiplied on critical hits.
- **Explicit mixed-class interpretation:** `gestaltFeatureLedger` selects the faster underlying rate before looking at rounded grants. Equal rates follow the existing printed-bonus convention: retain the previously selected class when available, then higher class level, then stable class ID. It contributes only that source's earned discrete increase at its current class level. A source with no feature yet cannot suppress an available feature. Neither side placement nor the optional fractional BAB/save method changes feature dice. UA does not uniquely prescribe mixed-class tie resolution; this is the documented sheet convention, not a claim of uniquely mandated RAW. The ledger exposes each selected source, grant and running total for the future preview.
- This avoids taking a rogue's die on one level and a staggered assassin's die on the next to manufacture full-rate sneak progression. Six Monk // Fighter plus four Monk // Psionic Fist still yields effective monk 10; Cleric 6 // Paladin 6 yields turning 6, not 9; Rogue 6 // Spellthief 6 yields sneak attack 3d6, not 5d6. Five Rogue // Wizard levels followed by two Wizard // Arcane Trickster levels retain 4d6 because the later advancement is nonoverlapping. [Rogue](https://www.d20srd.org/srd/classes/rogue.htm), [Assassin](https://www.d20srd.org/srd/prestigeClasses/assassin.htm), [Arcane Trickster](https://www.d20srd.org/srd/prestigeClasses/arcaneTrickster.htm), [Blackguard](https://www.d20srd.org/srd/prestigeClasses/blackguard.htm).
- Cursed Blow removes the spellthief's fifth-level grant, not its first-level grant. Trickster's fixed sneak die stays fixed. Current psionic focus gates Lurk's contribution without changing expenditure. The combat damage path, including Death's Ruin and criticals, consumes the shared result. These calculations never edit character history or class entries.
- Nine new integrated cases cover all cleric/paladin levels, delayed/nonoverlapping turning, replacement/restoration and spent pools, every existing sneak source's class levels in both modes, offset prestige grants, side swaps, optional fractions, alternate spellthief choices, distinct precision abilities, criticals, Death's Ruin and invalid extension policies.
- Still outstanding: overlapping static features (including uncanny dodge), other supplemental shared abilities, persisted custom-class policies, complete variant-family exclusions, paired creation/advancement with pre-level prerequisite checks, safe conversion and end-to-end browser workflow. No claim of complete gestalt availability is made by this milestone.
- Verification: all 662 tests passed, including 26 integrated gestalt cases; TypeScript, whitespace checks and the production build passed. Existing non-module-script and large-bundle warnings remain. No player saves or private exports were changed; complete gestalt browser creation/level-up verification remains outstanding.

## Guided paired advancement: transaction and review foundation

- `previewGestaltLevel` now stages both class selections on a clone and returns a fully recalculated, validated preview without changing the player sheet. Each new prestige class must qualify against the **pre-level** character; the other side cannot supply its entry BAB, spells, feats or ranks during that same level. Existing prestige entries retain the ordinary continuation convention. The same compiler enforces distinct classes/families, one prestige per pair and a scoped named GM approval for every combination-prestige pair; approvals never waive prerequisites.
- The preview reports actual level, both class milestones (after alternate-feature replacements), the larger die, HP/skill grants, before/after BAB and saves, the selected bonus-progression decisions, newly earned feat/ability choices and resulting casting/psionic capacities. One stable new history row records historical Intelligence and the supplied HP roll. Existing HP methods, level adjustment, XP, class notes, spell traditions and expenditure are retained. Standard and paired advancement reuse class-resource initialization.
- `applyGestaltLevel` rejects stale character snapshots and changed class choices, then revalidates the original selection rather than trusting an edited preview character. It applies the uncalculated edit recipe, like `gainLevel`; the existing `CharacterSheet.edit` boundary performs the single final recomputation. A regression test caught the rejected prototype granting HP twice when it installed an already-recomputed preview into that boundary. The fixed test mirrors the real boundary and preserves injuries exactly.
- Fixed a separate eligibility mismatch: Arcane Trickster's sneak-attack requirement still independently summed the old class formulas, allowing overlapping gestalt dice or a Trickster spellthief's surrendered progression to qualify. It now uses the same shared sneak-attack result as combat.
- Nine new integration cases cover mutation-free previews, one actual level and one feat/ability milestone, both sides changing classes, independent casting/manifesting initialization and expenditure, invalid choices/dice/XP/modes, stale/repeated/edited reviews, pre-level prestige checks, scoped approvals, two-prestige rejection, existing prestige continuation, variant dice, optional HP methods, LA, historical Intelligence and save/reload.
- This is the transaction foundation, **not yet a player-facing paired level-up dialog**. The creation mode selector, paired starting levels, review UI, explicit multi-tradition prestige target choices, reviewed mode conversion, remaining class-feature/variant/custom-class work and full browser end-to-end gates are still outstanding. Ordinary one-class level-up continues to reject explicit gestalt sheets until the paired UI is connected. No existing sheet is converted.
- Verification: all 671 tests passed (35 integrated gestalt cases), along with TypeScript, whitespace checks and the production build. The standard advancement suite also passed after extracting shared resource initialization. Browser UI verification is still pending because this milestone adds no new controls. The existing goal was not replaced or modified.

## Guided paired advancement: connected review controls

- The existing level-up notice now routes explicit gestalt sheets to a paired workflow. It defaults each side to the last recorded pair, offers independent class changes, shows new prestige prerequisites, records scoped combination-class approvals, and accepts one roll for the larger effective die. Standard sheets retain their original workflow. Switching saved characters remounts the level-up controls so another character cannot inherit a draft selection.
- Review uses the existing atomic preview without changing saved data. It displays HP and damage, skill grants, before/after BAB and base saves, the selected progression contributions and optional fractional policy, both class milestones, new feat/ability choices and resulting spell/power capacities. Confirmation uses the tested edit recipe and the sheet's single recomputation boundary. Cancelling does not advance; changing a draft input removes its review; changing character data makes the review stale and removes confirmation until refreshed. Feats, abilities and skill allocation remain explicit post-confirmation choices in the existing interfaces.
- The main sheet now identifies standard versus gestalt advancement even when no level-up is available. It describes actual levels and labels the saved printed/fractional convention without converting any existing sheet or changing homebrew settings.
- Browser QA used only the synthetic `Paired Level Up UI QA` character on the localhost production preview. Imported Fighter 2 // Wizard 2 at actual level 2 and 15/18 HP with a spent first-level spell slot. Previewing a d10 roll of 9 showed level 3, +11 HP, +4 skills and one general feat. Cancellation retained the original state. Editing HP during review removed confirmation; refreshing and confirming produced 25/29 HP (four damage) and actual level 3. Saving and reloading retained those values and the spent spell slot.
- Further UI checks rejected Eldritch Knight entry before its spell prerequisite even with a synthetic named approval. A same-class pair was rejected; this test caught raw schema JSON in the error display, which now presents just the readable validation messages. Changing both sides to Cleric 1 // Psion 1 with a roll of 6 previewed one fourth-level ability choice plus the psion bonus feat, then confirmed actual level 4 and 33/37 HP. The browser export was parsed and checked against the real load pipeline: class levels Fighter 3 / Wizard 3 / Cleric 1 / Psion 1, four paired history rows with rolls 4/4/9/6, four damage and the spent wizard slot all survived an idempotent reload.
- Verification: all 671 regression tests passed before browser QA; final TypeScript, production build and whitespace checks passed after the UI-only validation-label refinements. Existing non-module-script and large-bundle warnings remain. No private character exports or player saves were modified, and the synthetic export is outside the repository.
- Remaining gates are unchanged: creation mode selection and paired starting levels; complete custom-class/variant/shared-feature support; guided multi-tradition prestige target selection (the current review shows existing links and results); safe reviewed conversion; and full end-to-end creation/advancement/save/import coverage for the required combinations. This milestone verifies the connected advancement controls, not completion of gestalt support.

## Creation: explicit mode and independent starting pairs

- The existing player/NPC creator now accepts explicit gestalt starting pairs and a versioned bonus method. Standard remains the default; supplying paired settings without selecting gestalt fails rather than silently converting the request. This constructor only builds new characters and never accepts an existing save. It reuses standard blank-character/race/ability initialization, the authoritative paired compiler, shared class-resource initialization, skill history and starting-HP recording. Provisional dice are not rolled; only the finished paired sequence receives one maximized first die and actual later rolls. All final values pass the character schema.
- The creation dialog defaults to standard advancement each time it opens. Selecting gestalt reveals two independently editable class fields for every starting actual level (1-20), with running individual class levels in each row and an explicit optional fractional-bonus setting. HP, cleric specialty and ability generation remain separate controls. A specialty can apply when cleric appears on either side. Monsters keep their existing creation interface.
- Starting rows accept the same base-class catalog as standard creation. Prestige entry uses the already-connected paired level-up flow after players allocate prerequisites; creation does not invent historical skill/feat qualifications or waive entry checks. Races with racial Hit Dice receive an explicit unsupported-policy explanation; LA alone is supported and affects starting XP without adding paired levels. Complete custom-class profiles, variant-family rules and racial-HD occupancy still need separate work.
- Eight automated tests cover Fighter 5 // Wizard 5 actual levels, HP/BAB/saves/skills/choices and empty possessions; Ranger/Rogue skill union; independent Wizard/Cleric and psionic profiles; either side changing classes; invalid plans, rolls, modes and RHD; optional HP/fractions/LA/specialty; every selectable base class on either side; and NPC creation followed by paired advancement plus browser/native persistence with damage, training and expenditures retained. Existing standard creation/default tests also pass.
- Production-browser QA created and exported Fighter 5 // Wizard 5, Wizard 2 // Cleric 2, Ranger 3 // Rogue 3 and a standard Fighter 1 after a rejected identical-class pair. Fighter/Wizard reloaded at actual level 5 and 44 HP with stable recorded dice, BAB +5, base saves +4/+1/+4 and 48 skill points. Wizard/Cleric exported two independent level-2 casting profiles. Ranger/Rogue exported the union of class skills and a 72-point budget with INT 16 and Human. Standard creation retained one Fighter level, 10 HP at CON 10, recorded-roll HP and no paired plan. Every exported character passed the real parse/load pipeline unchanged. Reopening the dialog returned to standard mode. Only synthetic QA sheets were used.
- Verification: all 679 regression tests passed, plus TypeScript, whitespace checks and the production build. Existing script/bundle-size build warnings remain. No player saves or private exports were modified. The broader goal remains incomplete: custom/variant/shared-feature gaps, explicit prestige casting targets, reviewed conversion and remaining complete browser advancement/import scenarios must still be addressed.

## Prestige casting: choices retained at each paired level

- Paired level-up now offers eligible spell, divine and manifesting targets before review and records each choice with that actual level. Choosing a different tradition later does not redirect earlier gains. The existing same-tradition overlap cap and Hierophant's caster-level-only behavior remain intact. Standard characters retain their existing class-wide links.
- New choices require a tradition held before entering the prestige class, not one gained alongside it or afterward. Separate arcane/divine and arcane/psionic roles follow the [Mystic Theurge](https://www.d20srd.org/srd/prestigeClasses/mysticTheurge.htm) and [Cerebremancer](https://www.d20srd.org/srd/psionic/prestigeClasses/cerebremancer.htm) progression rules. Domain pools follow their primary cleric rather than becoming independent targets. Combination-class approvals and pre-entry prerequisites still apply.
- Before advancing, the pending edit snapshots previously unrecorded automatic/class-wide gains without changing their result. This also prevents adding a new caster profile from making an old automatic target ambiguous and removing its earlier grants. Ordinary load does not rewrite history. Ambiguous choices require player input; explicit no advancement is retained; missing recorded profiles are never silently replaced. Previously recorded gains are preserved rather than retroactively requalified.
- Calculations includes a collapsed per-level casting history and explains the limited effect of remaining class-wide controls. Rules configuration now correctly identifies gestalt rather than always displaying standard advancement. Clearing a target selection requires a new choice before review.
- Nine integrated regressions cover alternating targets, historical automatic gains, explicit abstention, invalid/ambiguous roles, same-tradition caps, Cerebremancer, Mystic Theurge/domain expenditure, Hierophant, missing profiles, standard behavior and native reload. Browser QA used only a synthetic Wizard 5 / Sorcerer 5 / Fighter 1 / Loremaster 1 character: directing its next Loremaster level to Sorcerer produced Wizard 6 / Sorcerer 6, retained the previous Wizard grant, and exported/reloaded at actual level 7 with 36/39 HP and spent first-level slots 2/1. Both choices appeared in the history disclosure; the exported file passed the real load pipeline unchanged. No player saves or private exports were modified.
- Remaining goal gates: complete custom-class policies, variant-family restrictions, overlapping static/supplemental features, safe reviewed mode conversion, and remaining end-to-end scenarios. This milestone does not complete the broader gestalt goal.
- Verification: all 688 regression tests passed (44 integrated gestalt cases), with TypeScript, production build and whitespace checks. Browser QA also confirmed that clearing a choice blocks review, switching the following level back to Wizard previews Wizard 7 / Sorcerer 6, and the configuration label identifies gestalt. The usual script and bundle-size build warnings remain.

## Defensive features: Evasion and basic Uncanny Dodge

- Reproduced two failures before implementation: the combat panel did not recognize Monk 2 Evasion, and Rogue 4 with Dexterity 18 displayed flat-footed AC 10 instead of 14. A shared read-only defensive-feature resolver now reports all nine catalog Evasion classes, earned improved grants, independent restrictions and replacement choices. Multiple sources use the best available benefit, never stacked damage reductions or an automatic Evasion upgrade. A restricted ninja source does not disable an eligible rogue source.
- Policies include light/no armor for ordinary Evasion, no armor for ninja, encumbrance and helplessness, earned monk/shadowdancer/swordsage improvements, explicitly selected rogue/psychic-rogue Improved Evasion, Spell Reflection's later downgrade to ordinary Evasion, magic-only Eldritch Grace, and focused True Thief improvements. Sources: [rogue](https://www.d20srd.org/srd/classes/rogue.htm), [monk](https://www.d20srd.org/srd/classes/monk.htm), [ranger](https://www.d20srd.org/srd/classes/ranger.htm), [shadowdancer](https://www.d20srd.org/srd/prestigeClasses/shadowdancer.htm), [swordsage](https://srd.dndtools.org/srd/classes/baseTob/swordsage.html), [ninja](https://srd.dndtools.org/srd/classes/baseCad/ninja.html), [scout / Spell Reflection](https://srd.dndtools.org/srd/classes/baseCad/scout.html), [lurk](https://srd.dndtools.org/srd/classes/baseCpsi/lurk.html), [psychic rogue](https://srd.dndtools.org/srd/classes/baseOther/psychicRogue.html). Free-text aggregate class summaries and similarly named feats do not grant optional special abilities.
- Basic Uncanny Dodge now retains Dexterity and dodge bonuses in flat-footed AC for its eight catalog class sources, plus focused True Thief. Psychic Rogue requires psionic focus. Replacements remove only their own source; duplicate sources never add another Dexterity bonus. Armor caps, negative Dexterity, blinded/stunned conditions, helplessness/immobilization and manual calculation mode remain respected. [Dodge bonuses](https://www.d20srd.org/srd/combat/combatStatistics.htm), [warblade](https://srd.dndtools.org/srd/classes/baseTob/warblade.html), [Fist of the Forest](https://srd.dndtools.org/srd/classes/prestigeCChamp/fistOfTheForest.html).
- The existing `flatFooted` field was actually exposed as a general lose-Dexterity override. Its meaning is preserved. A separate optional `caughtFlatFooted` field and checkbox model genuine flat-footedness, allowing Uncanny Dodge to apply without overriding a player's explicit denial. Old saves do not acquire this field on load. Clearing combat resets both. Battle Clarity recognizes the new condition: retaining Dexterity does not remove flat-footedness or restore its Reflex bonus.
- Combat now explains each defensive source and its current availability. Damage remains player-resolved rather than automatically deducted. Improved Uncanny Dodge's anti-flanking threshold and duplicate-grant timing are **not yet automated**; the panel says so. The user was asked whether gestalt duplicate grants should follow the faster listed improvement or ordinary multiclass upgrade; that choice remains pending. Other shared-feature/custom/variant/conversion gates are unchanged, and the goal remains incomplete.
- Verification: eleven new defensive regressions, 699 full-suite tests passing, TypeScript and production build checks. Synthetic browser Rogue 4 // Barbarian 4 retained AC/touch/flat-footed 14 when flat-footed; explicit denial and helplessness gave 10 and marked Evasion unavailable. Clearing conditions and native export/reload retained actual level 4, three HP damage and all recorded data. No player sheets or private exports were modified.

## RAW policy and Improved Uncanny Dodge (2026-10-27)

- The user's enduring RAW-first instruction is now in [rules-policy.md](rules-policy.md), linked from the README and root `AGENTS.md`. It distinguishes source rules, interpretations, optional variants and table rulings, and requires preservation of existing saves and expenditure. The earlier pending Uncanny Dodge question is resolved: overlapping gestalt grants follow the faster class's progression, not an automatic duplicate-source upgrade. Printed-table BAB/saves remain the user's default, with fractions optional.
- Combat now identifies listed Improved Uncanny Dodge grants: Barbarian 5, Rogue 8, Assassin 5, Shadowdancer 5, Warblade 6 and focused Psychic Rogue 9. Ordinary multiclass characters retain the second-source upgrade and summed qualifying class levels. Replacements remove only their own grant; two replaced improved grants cannot recreate each other. Sources: [barbarian](https://www.d20srd.org/srd/classes/barbarian.htm#improvedUncannyDodge), [rogue](https://www.d20srd.org/srd/classes/rogue.htm#improvedUncannyDodge), [assassin](https://www.d20srd.org/srd/prestigeClasses/assassin.htm#improvedUncannyDodge), [shadowdancer](https://www.d20srd.org/srd/prestigeClasses/shadowdancer.htm#improvedUncannyDodge), [warblade](https://srd.dndtools.org/srd/classes/baseTob/warblade.html), [psychic rogue](https://srd.dndtools.org/srd/classes/baseOther/psychicRogue.html). Scout and Fist of the Forest refer to the barbarian ability; True Thief grants the focused rogue ability, not a separate listed improved milestone: [scout](https://srd.dndtools.org/srd/classes/baseCad/scout.html), [Fist of the Forest](https://srd.dndtools.org/srd/classes/prestigeCChamp/fistOfTheForest.html), [lurk](https://srd.dndtools.org/srd/classes/baseCpsi/lurk.html).
- For a single qualifying source or sources advancing at exactly the same actual gestalt levels, the displayed rogue exception counts those levels once and adds four. Rogue 4 // Barbarian 4 has no improvement; at paired level 5 the barbarian grants it and the attacker needs at least nine rogue levels. Swapping sides changes nothing. Unrelated class levels do not inflate the ordinary multiclass threshold. The panel explains protection against flanking, not universal immunity to sneak attacks, and never changes the player's outgoing attack selections.
- **Still unresolved, explicitly visible:** mixed/staggered gestalt source histories show a DM-review notice rather than an invented combined threshold or duplicate upgrade. Individually earned listed improvements still appear. UA's general faster-class rule does not uniquely specify these detailed interactions. This is an incomplete automation case, not a declared new house rule or a completed shared-feature audit. Opponent abilities and attack resolution remain at the table because this sheet does not hold the attacker's class data.
- Six new tests cover listed boundaries, standard-versus-gestalt duplicate grants, source-specific replacements, focused benefits, unresolved mixed histories and read-only native persistence. All **705 tests passed**, along with TypeScript, production build and whitespace checks. Existing script/bundle-size build warnings remain.
- Browser QA used the existing synthetic Defensive Gestalt UI QA sheet only. At level 4 the panel correctly showed no improved grant. Guided paired advancement with a d12 roll of 7 produced Rogue 5 // Barbarian 5, 53/56 HP and the rogue-level-nine exception. Save/reload retained the result; the actual browser export passed schema and the real load pipeline unchanged, retaining three HP damage. The rendered explanation was visually checked. No player sheets or private exports were changed.
- Remaining goal gates include complete custom-class persistence, same-family variant restrictions, remaining shared/supplemental feature cases, the mixed progression case above, safe reviewed mode conversion and remaining end-to-end scenarios. The full goal is not complete.

## Catalog variant pairs and preserved historical sheets (2026-10-27)

- Added explicit parent-class identities for Erudite/Psion and Psychic Rogue/Rogue. The [Complete Psionic publisher sample](https://d1vzi28wh99zvq.cloudfront.net/pdf_previews/28740-sample.pdf) identifies Erudite as a variant psion; the [Mind's Eye designer text reproduced at Realms Helps](https://www.realmshelps.net/charbuild/classes/psion/psychicrogue.shtml) identifies Psychic Rogue as a psionic version of the core rogue. Applied [UA's prohibition on combining versions of the same class in a gestalt pair](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm). These are source-specific classifications, not name similarity checks. Alternate features already retain their parent catalog class ID and cannot supply a second copy of that class.
- New starting pairs and paired level-up reject either ordering before changing the character. The strict progression compiler also rejects these combinations even if extension metadata renames their families. Existing identical-ID, two-prestige, prerequisite and scoped combination-class checks remain in force. Separate classes such as Psion/Psychic Warrior, Rogue/Ninja and Cleric/Favored Soul are not conflated merely because they have related abilities.
- Old saved pairs previously permitted by the sheet remain readable, editable and exportable. The calculation/load boundary permits only the newly classified historical family conflict; it does not relax structural validation. A prominent sheet warning lists affected actual levels in a collapsed disclosure. No class, level, history row, HP damage or expenditure is deleted, converted or reset. A player can advance a valid new pair while the old rows remain available for DM review. This compatibility treatment is not a claim that the old combination follows RAW, and is not a rules-permission toggle for new levels.
- Scope is pairing at the same actual level. Ordinary multiclass behavior is unchanged; [UA's variant multiclass discussion](https://www.d20srd.org/srd/variant/classes/variantCharacterClasses.htm#multiclassingAndVariantClasses) treats distinct full variants differently from alternative paths inside one class. Do not extend the pair prohibition to all multiclassing without source-specific evidence. Urban Druid's classification still needs verification against the Dragon Compendium text rather than conflating it with similarly named druid alternate features. Custom-class parent identities still need persisted metadata and the broader custom-class integration.
- Six new regression tests cover source classifications, both orderings and later starting rows, atomic rejection, compiler metadata, unchanged native import/reload, valid advancement of historical conflicts, and unchanged standard progression. All **711 tests passed**, plus TypeScript, production build and whitespace checks. Existing build warnings remain.
- Production-browser QA used only synthetic data: imported Psion 2 // Erudite 2 at 9/12 HP with 1/2 power points spent, confirmed the historical warning and rejection of another conflicting pair, then advanced Psion 3 // Fighter 1 while retaining Erudite 2. Save/reload and the actual browser export retained level 3, 17/20 HP, spent points 1/2 and the two historical warnings. The real schema/load path accepted that export without changes. A new Psion // Erudite creation attempt stayed in the dialog with the readable validation error and did not create a character. Private exports and player saves were untouched.
- The preceding RAW/Uncanny Dodge commit `df9a7d0` deployed successfully (Pages run `40589240811`). The overall goal remains incomplete: custom classes, remaining variant-source verification, other shared/supplemental features, mixed Uncanny Dodge cases, reviewed mode conversion and remaining end-to-end gates still require work.

## Dwarven Defender table and defensive grants (2026-10-28)

- Found a source-table mapping defect: the SRD table puts AC Bonus before Special,
  but the importer assumed Special was always the sixth column. Corrected only
  Dwarven Defender in both generated catalogs and its importer. Feature summaries,
  advancement previews and the browser reference now retain the abilities and a
  labeled dodge bonus instead of bare AC numbers.
- Added its missing Uncanny Dodge at class level 2 and Improved Uncanny Dodge at
  class level 6, following the [published SRD class rules](https://www.d20srd.org/srd/prestigeClasses/dwarvenDefender.htm).
  Standard second-source upgrades remain separate from gestalt's shared-feature
  policy. Mixed/staggered gestalt histories still show the documented review
  notice; this change does not invent their missing ruling.
- Existing generated cards repair only an exact old numeric-prefix match. Personal
  additions, counters and sources remain intact; custom descriptions and cards
  too close to their text-size limit are left alone. Calculations do not depend on
  the card's wording. No player saves or private exports were changed.
- Five regressions cover catalog/reference parity, real ordinary and paired
  advancement, level boundaries, AC while flat-footed/immobilized, duplicate
  grants, native reload, narrowly recognized legacy cards, text limits, damage
  and spent stance uses. The full suite passed 716 tests; TypeScript, production
  build and whitespace checks passed. Existing bundle/script warnings remain.
- Browser QA imported only a synthetic legacy Fighter 7 / Dwarven Defender 6.
  The table and repaired feature card displayed all milestones and retained the
  appended player note. Combat showed AC/touch/flat-footed 16 and the rogue-level
  10 exception. Saving, reloading and exporting retained 119/123 HP and two spent
  stance uses; the actual exported file passed the real load pipeline unchanged.
- Remaining audit findings: Trap Sense and Dwarven Defender DR are not yet wired
  to automatic defensive calculations (the existing DR editor is manual). The
  standard Classes tab also retains obsolete guidance to enter gestalt totals
  manually. These are unfinished work, alongside the broader custom-class,
  shared-feature, conversion and end-to-end gates above. The goal is not complete.
- The preceding variant-family fix `40062bf` deployed successfully (Pages run
  `40590238013`).

## Conditional trap defenses and shared progression (2026-10-28)

- Trap Sense now feeds AC and saving throws for Rogue, Barbarian, Dwarven Defender
  and focused True Thief. Separate combat controls identify an incoming trap
  attack and a saving throw against a trap. Only the former adds dodge AC; only
  the latter adds the Reflex bonus. Dexterity denial, Uncanny Dodge and manual
  mode retain their existing behavior. The panel explains sources and distinguishes
  Trap Sense from Trapfinding. Sources: [Rogue](https://www.d20srd.org/srd/classes/rogue.htm#trapSense),
  [Barbarian](https://www.d20srd.org/srd/classes/barbarian.htm#trapSense),
  [Dwarven Defender](https://www.d20srd.org/srd/prestigeClasses/dwarvenDefender.htm#trapSense),
  [True Thief](https://srd.dndtools.org/srd/classes/baseCpsi/lurk.html#true-thief).
- Ordinary multiclass bonuses stack. Gestalt reuses the faster-feature ledger
  and its documented mixed-class/tie interpretation, rather than adding both
  sides or alternating rounded grants. Rogue 6 // Barbarian 6 gives +2, not +4.
  Separate later advances contribute. Fractional BAB/save policy does not change
  this discrete feature. Explicit per-level rates let capped True Thief and
  Dwarven Defender progressions stop competing after their final grants. No early
  grant or extra psionic expenditure is invented. This applies
  [UA's shared-feature rule](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
  using the recorded interpretation, not a claim of uniquely specified mixed-class
  RAW. Replacements such as Death's Ruin remove only their own source.
- Fixed a selector mismatch: the UI saved `trap`, while Dungeon Crasher and
  Relic Hunter checked only `traps`. Both values are accepted without rewriting
  saves. Dungeon Crasher now uses its published competence type, not untyped,
  for trap AC/all saves; Relic Hunter adds only its distinct Reflex bonus.
  Sources: [Dungeon Crasher](https://srd.dndtools.org/srd/classes/baseCore/fighter.html#dungeon-crasher),
  [Relic Hunter](https://srd.dndtools.org/srd/classes/baseCore/cleric.html#relic-hunter).
  The old plural value retains its previous coupled AC behavior until the player
  explicitly sets the separate trap-attack control. The new optional field is
  absent from untouched legacy saves. Clear combat situation resets both contexts.
- Removed obsolete Classes guidance claiming gestalt totals require manual entry.
  No class entries, progression history, ranks, preparations, injury or expenditure
  are migrated or reset by this change.
- Nine new regressions cover published boundaries, ordinary/paired/offset
  progression, slower prestige sources, capped/focused progression, replacements,
  independent contexts, competence stacking, Relic Hunter, manual mode and
  idempotent legacy/native reload. All 725 tests passed, plus TypeScript and
  production build. Existing script and bundle-size warnings remain.
- Browser QA used synthetic sheets only. Dwarven Defender 6 changed AC 16 to 17
  independently of Reflex +8 to +9; Clear combat situation restored both. Its
  exported save retained four damage and two spent stance uses. Rogue 6 //
  Barbarian 6 displayed Trap Sense +2, AC 16 and Reflex +11 with both contexts;
  save/reload/export retained actual level 6, three damage and one spent Rage.
  Both actual browser exports passed the real load pipeline unchanged. No live
  player save or private export was edited.
- `bbf1872` deployed successfully (Pages run `40654299259`). Remaining gates
  include custom-class persistence, further variant/shared-feature cases, mixed
  Uncanny Dodge, class DR, safe reviewed mode conversion and complete end-to-end
  scenarios. The overall goal remains incomplete.

## Earned class damage reduction (2026-10-28)

- Reproduced missing automatic DR for Barbarian and Dwarven Defender with five
  failing regression cases. The existing DR resolver now derives Barbarian's
  non-epic grants at levels 7/10/13/16/19 and Dwarven Defender's grants at 6/10.
  These grants require neither rage nor defensive stance. Sources:
  [Barbarian](https://www.d20srd.org/srd/classes/barbarian.htm#damageReduction),
  [Dwarven Defender](https://www.d20srd.org/srd/prestigeClasses/dwarvenDefender.htm#damageReduction).
- Keep independent sources visible, not summed: the
  [general DR rule](https://www.d20srd.org/srd/specialAbilities.htm#damageReduction)
  selects the best applicable protection per hit. This remains true in standard
  and gestalt mode; no shared-feature ledger invents additive DR. Different
  bypasses remain distinct. Existing explicitly stacking Berserker Strength stays
  separate and its explanation is now available in the summary. Damage and HP
  remain resolved at the table, not automatically applied.
- Reuse source-specific alternate-feature replacement handling. Devil's Luck,
  Streetfighter and Totem Manifestation remove only Barbarian's ordinary DR.
  Replacing rage with Berserker Strength does not remove ordinary DR. Manual
  calculation mode retains only the existing manually controlled sources.
- These are read-only derived rows, not migrations or new saved entries. Preserve
  all old manual class copies, armor links, free-text imports and personal notes;
  explain that a duplicate manual copy is not an additional stacking benefit.
  Armor still grants AC. Combat and the main Sheet summary both show earned DR,
  with collapsible source/condition explanations. Unsupported class DR, spells,
  racial sources and house rules still use the existing manual tracker.
- Five regressions cover every non-epic boundary, replacements/restoration,
  independent sources and bypasses, manual mode, no free-text feature inference,
  gestalt side swaps/fractional settings, ordinary level-up, damage/counters and
  unchanged native reload. All 730 tests passed; TypeScript, production build
  and whitespace checks passed. Existing build script/bundle warnings remain.
- Browser QA reused only Defender Legacy UI QA on localhost. Both Sheet and
  Combat displayed DR 3/— at Dwarven Defender 6, with the source explanation
  checked visually. Save/reload retained actual level 13, 119/123 HP and AC 17.
  A fresh browser export download was not captured during this pass; native
  serialization/load preservation is covered by the regression tests. No private
  exports or player saves were edited.
- The trap-defense commit `40dc1e9` deployed successfully (Pages run
  `40705477295`). Further class DR sources, custom-class persistence, variant
  verification, remaining shared-feature cases, mixed Uncanny Dodge, reviewed
  mode conversion and full end-to-end scenarios remain unfinished. This milestone
  does not complete the goal.

## Typed class DR and Favored Soul choices (2026-10-28)

- Extended the existing read-only DR resolver to the remaining explicit DR grants
  in the current class tables: Warlock, Dragonfire Adept, Monk's Perfect Self and
  Favored Soul. Independent bypasses remain separate; do not add their amounts
  in standard or gestalt mode. This is not a comprehensive audit of every
  supplemental feature whose text grants DR under another name.
- Verified Warlock's cold-iron progression and Dragonfire Adept's magic-bypassed
  grants against the reproduced published text:
  [Warlock](https://srd.dndtools.org/srd/classes/baseCarc/warlock.html),
  [Dragonfire Adept](https://srd.dndtools.org/srd/classes/baseDrm/dragonfireAdept.html).
  Only actual class levels advance these grants. Their supernatural versus
  extraordinary distinction is explained on sheet. Antimagic suppression is
  still resolved at the table, not a newly implemented global magic switch.
- [Perfect Self](https://www.d20srd.org/srd/classes/monk.htm#perfectSelf) requires
  Monk 20. It is not gained early through
  [Psionic Fist's limited monk advancement](https://www.d20srd.org/srd/psionic/prestigeClasses/psionicFist.htm#monkAbilities),
  nor lost merely through armor, helplessness or becoming nonlawful. This change
  adds its DR only; it does not silently replace saved race/creature-type data.
- [Favored Soul](https://srd.dndtools.org/srd/classes/baseCd/favoredSoul.html)
  receives alignment-dependent DR at class level 20: lawful uses silver, chaotic
  uses cold iron, and neither-lawful-nor-chaotic requires a player choice. A
  validated optional `defense.favoredSoulDr` records only that neutral choice.
  It has no schema default, so legacy saves do not acquire an invented choice.
  Recognized abbreviations/full alignment names are accepted case-insensitively;
  arbitrary prose and missing alignment show a review notice, not a guessed grant.
- The selected Favored of Bahamut/Tiamat alternate feature replaces the base
  grant with 10/epic at level 20, following the same source's variant text.
  Existing unrelated alternate features do not suppress these defenses. The
  neutral choice remains saved when alignment or a replacement temporarily makes
  it irrelevant, and returns when applicable again. Imported notes and manual
  copies remain untouched; a duplicate is not an additive benefit.
- Combat provides the neutral selector and a collapsed automatic-source guide;
  the Sheet summary also identifies missing alignment/choice. All added DR uses
  the existing manual-calculation switch and nonstacking guidance. The general
  [special-ability rules](https://www.d20srd.org/srd/specialAbilities.htm#damageReduction)
  still govern bypasses, applicability and extraordinary/supernatural behavior.
- Five new regressions first reproduced the missing grants, then passed. They
  cover non-epic boundaries, actual versus advanced monk levels, alignment forms,
  missing choices, replacements, side swaps, manual mode, optional-field
  validation and unchanged native reload. All 735 tests passed, plus TypeScript,
  production build and whitespace checks; existing bundle/script warnings remain.
- Browser QA imported only synthetic Favored Soul DR UI QA. An unselected neutral
  character showed the prompt; selecting cold iron displayed 10/cold iron while
  retaining 122/126 HP, imported notes and an inactive manual source. Save/reload
  retained the choice. The actual browser export passed the real schema/load
  pipeline unchanged, including four damage, two spent first-level spell slots,
  the manual source and its personal note. Changing alignment to LG displayed
  10/silver; invalid prose showed a review notice; returning to NG restored the
  saved cold-iron choice. The explanation was visually checked. No player save
  or private export was edited.
- `a021c9b` deployed successfully (Pages run `40707323002`). Custom-class
  persistence, remaining supplemental/shared features and variant verification,
  mixed Uncanny Dodge, reviewed mode conversion, and outstanding full end-to-end
  scenarios remain open. The broader goal is not complete.

## Conditional monk styles and shared Expertise checks (2026-10-29)

- Reproduced Undying Way DR and Denying Stance grapple bonuses activating from
  a stale Combat Expertise amount without the feat. Both now use the same
  read-only amount calculation as weapon attacks and dodge AC: an active feat,
  automatic calculations, and a positive amount capped by effective BAB and 5.
  Resolute's BAB reduction is shared; negative BAB cannot invert the penalty.
  Existing `effectiveBab` imports remain compatible through a re-export.
- Sources: [Undying Way and Denying Stance](https://www.d20srd.org/srd/variant/classes/variantCharacterClasses.htm#monkFightingStyles),
  [Combat Expertise](https://www.d20srd.org/srd/feats.htm#combatExpertise).
  Fighting defensively independently triggers either supported benefit; total
  defense independently triggers Undying Way only. The earned sixth-level style
  and recorded historical qualification remain required. Current ranks do not
  erase historical qualification. The DR summary now explains its conditions.
- No migration, feat grant, resource refund or setting reset is performed.
  Stale settings stay saved but cannot manufacture a feat benefit. Six regressions
  cover absent/disabled grants, BAB caps, Resolute, qualification, separate
  defensive actions, standard/gestalt characters and unchanged native reload with
  damage, manual protections, notes and spent counters preserved.
- All 741 tests passed, with TypeScript, production build and whitespace checks.
  Existing build warnings remain. Browser verification was attempted using a
  synthetic fixture outside the repository, but did not run: first approval review
  hit a usage limit, then the resumed browser tool reported local browser use
  disabled in Work settings. No player browser data or private exports were edited.
- Scope is consistency with the existing combat selection model, not a complete
  action-economy or feat-prerequisite validator. The player must actually perform
  the qualifying action; automatic duration/turn tracking, all feat prerequisite
  exceptions, Denying Stance disarm resolution and other style bonuses still need
  their own audit. Custom-class persistence, remaining variant/shared-feature
  cases, reviewed mode conversion and full end-to-end gates remain incomplete.
- The preceding class-DR commit `05f4807` deployed successfully (Pages run
  `40775865197`). The overall goal remains incomplete.

## Saved custom basic-class tables (2026-10-29)

- The compiler's temporary custom-table extension did not survive character
  storage and was unavailable to guided advancement. Added optional, versioned
  character-local profiles and connected the shared class lookup, HP/history,
  BAB/saves, skill union and purchase costs, milestone summaries, standard
  advancement and paired preview/confirmation. No global registry is changed.
  See [the profile contract and remaining work](custom-class-profiles.md).
- The schema requires a complete consecutive table matching explicitly recorded
  standard BAB/save rates, a source citation, class family and prestige policy.
  Catalog collisions, duplicate IDs, inconsistent/gapped tables and unsupported
  data fail instead of being stripped. Unknown legacy classes still use manual
  statistics and receive no invented profile. A missing gestalt definition cannot
  silently discard one side, and temporary metadata cannot replace saved policy.
- The existing [UA gestalt rules](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
  and documented printed/fractional convention remain authoritative. Each pair
  uses the larger die and skill grant, the union of class skills and nonstacking
  base progressions. Catalog casting alongside a custom class remains separate;
  the custom class's name and milestone prose do not grant catalog abilities.
- Custom prestige entry requires review of the entire recorded source because
  the existing catalog-specific prose parser cannot certify arbitrary source
  requirements. This confirmation does not waive the independent per-level GM
  approval, same-family restriction or two-prestige prohibition. Changed source
  text invalidates its matching confirmation. Bounded confirmation keys now hold
  up to 4,000 characters so the complete custom requirements survive saving.
- Classes and guided level-up recognize saved profiles and display their names,
  source tables and approval controls. Classes explains that these profiles
  automate basic progression only. Existing manual counters, personal notes,
  recorded skill purchases, damage and spent casting remain preserved.
- Eight regressions cover standard/paired totals, skills, either-side placement,
  fractional mode, actual advancement, native files, the browser storage API with
  a fresh client, source confirmations, invalid data and unchanged manual legacy
  sheets. These use synthetic classes, not claimed published class definitions.
  The final full suite passed all 749 tests; TypeScript, production build and
  whitespace checks passed. Existing script and bundle-size warnings remain.
- This is a foundation milestone, not complete custom-class support. The profile
  editor and reviewed updates, starting custom selections, custom casting and
  manifesting metadata, proficiencies and source-specific feature automation
  remain to implement. Unsupported fields are rejected explicitly. Browser UI
  verification remains outstanding because local browser use is disabled; the
  storage-API regression is not a substitute for that UI check. No private
  exports or player saves were edited.
- The previous conditional-style fix `caa720e` deployed successfully (Pages run
  `40852607253`). The broader custom-class, variant/shared-feature, reviewed
  mode-conversion and full end-to-end gates are not complete.

## Reviewed custom-class editor (2026-10-29)

- Added a collapsed Classes panel for source-cited basic custom tables. Drafts
  are separate from the character; source acknowledgment opens a before/after
  review before explicit application. New tables add no levels or class entries.
  The editor supports existing manual custom IDs without enabling automation,
  source notes, entry requirements, families, prestige policy, ordinary rates,
  Hit Dice, skills and per-level feature text. It does not infer special powers.
- The transaction rebuilds its result at confirmation, rejecting stale characters,
  altered reviews, missing earned rows and unsupported tables. It refuses to
  clamp or invent historical HP rolls, preserves recorded training/history and
  feature annotations/expenditure, reports skill overspending without deleting
  ranks, and recalculates once through the normal sheet boundary. Existing
  custom feature cards are no longer rewritten by unrelated alternate-feature
  synchronization. Draft state is scoped to the selected character.
- Applied the existing source-verified variant-family restriction to declared
  custom families, including Rogue/Psychic Rogue and Psion/Erudite. This extends
  the same [UA rule](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm),
  not a new stacking convention. New conflicting table edits and advancement
  fail; historical variant conflicts remain readable and visibly warned. Built-in
  restrictions cannot be removed by temporary custom metadata.
- Eight new regressions cover read-only previews, standard/paired application,
  native persistence, damage and spent casting, manual legacy entries, stale and
  tampered reviews, insufficient tables, preserved milestone text/extra columns,
  historical HP rolls, custom personal notes during alternate synchronization,
  and family restrictions with historical compatibility. All 757 tests passed;
  TypeScript, production build and whitespace checks passed. Existing non-module
  script and bundle-size warnings remain.
- Browser UI verification remains unperformed because local browser use is
  disabled in Work settings. No private exports or player saves were modified.
  Custom starting selection, casting/manifesting and source-specific abilities,
  remaining variant/shared-feature cases, reviewed mode conversion and full
  end-to-end gates are still unfinished. The overall goal is not complete.
- The preceding custom-table foundation `bae7e92` deployed successfully
  (Pages run `40854705615`). See [the profile contract](custom-class-profiles.md)
  for supported behavior and limits.

## Custom tables at character creation (2026-10-29)

- The new PC/NPC dialog reuses the source-reviewed custom editor with an isolated
  in-memory library. Applied base-class tables appear in standard starting-class
  and every paired-row selector. Custom labels distinguish name collisions.
  Unfinished table drafts block creation until applied or canceled; reopening
  creation resets its custom library. This neither reads a player save into the
  editor nor creates a temporary stored character.
- Optional creation profiles are validated and cloned before the existing
  starting-class/race setup. Shared lookup and initialization use character-local
  definitions. Custom IDs, not names, select their mechanics, and no global
  catalog is modified. A profile named Wizard does not grant catalog casting.
  Unused supplied profiles remain available for later advancement; no profiles
  are added unless explicitly supplied.
- Standard defaults, first-die maximum/recorded later rolls, class-level bounds,
  existing printed/fractional rules and racial-HD restrictions are unchanged.
  Gestalt uses the final paired sequence for HP/history, independently initializes
  catalog casting, and rejects same-family choices. Custom prestige entry remains
  a guided-level-up step after prerequisites are allocated, not a creation bypass.
- Five regressions cover standard and NPC creation, both gestalt sides, mixed
  starting pairs, class skills/HP/resources, invalid and short tables, prestige
  and family restrictions, name collisions, library isolation, later advancement,
  native save/load and a fresh browser-storage API client. Injuries, training,
  notes and spent spells survive the latter flows. All 762 tests passed, with
  TypeScript, production build and whitespace checks. Existing non-module-script
  and large-bundle warnings remain.
- The previous editor commit `1e9db6e` deployed successfully (Pages run
  `40900147099`). Browser interaction/visual checks are still outstanding because
  local browser access is disabled; API persistence tests are not browser UI QA.
  No private exports or existing player data were changed.
- Custom casting/manifesting, proficiencies and source-specific abilities remain
  incomplete. The remaining variant/shared-feature audit, reviewed mode conversion
  and full end-to-end gates still apply. The overall goal is not complete.

## Casting identity and resource preservation (2026-10-29)

- Reproduced incorrect fallback from explicit unsupported or empty casting links
  to familiar names/spell lists, which could overwrite recorded caster levels and
  slots during recalculation. Explicit casting/manifesting metadata now controls
  identity; older pools without metadata retain their legacy recognition.
- Reproduced missing class resources during advancement when an unrelated pool
  shared a display name, or a domain pool was mistaken for ordinary cleric
  casting. Initialization and Classes controls now compare resolved class links,
  exclude domain books from ordinary casting, and recognize renamed valid pools.
- Axe Brother selection, split-ability save DCs and casting prerequisites respect
  the same boundary. Unsupported pools retain editable recorded values and show
  manual-handling notices. No automatic relinking, preparation reset or refund is
  performed; historical values already overwritten cannot be reconstructed.
- Eight regressions cover unknown/empty links, legacy compatibility, duplicate
  prevention, domain separation, standard/paired advancement, Axe Brother setup,
  save DCs/prerequisites, native reload and a fresh browser-storage API client.
  Preparations, power choices, expenditure, notes, level history and injuries are
  preserved. All 770 tests passed; TypeScript, production build and whitespace
  checks passed. Existing script/bundle warnings remain.
- The preceding creation milestone `1cd7ffb` deployed successfully (Pages run
  `40905899927`). Browser UI verification remains unavailable because browser
  access is disabled; storage API tests are not browser UI checks. No private
  exports or real player saves were changed.
- This does not implement custom casting/manifesting tables. Their schema/editor,
  proficiencies, remaining source-specific/shared features, reviewed mode
  conversion and full end-to-end gates remain unfinished. The RAW policy and
  documented printed-table default/fractional option remain unchanged. The
  overall goal is not complete.

## Class-summary annotations through advancement (2026-10-29)

- Reproduced personal notes being erased by ordinary level-up and full class
  summary refresh; the same shared operation serves paired advancement and
  alternate-feature synchronization. Refresh now replaces only a uniquely
  recognized complete generated block, retaining surrounding annotations,
  customized names/references, counters and other feature fields.
- New cards record optional bounded generated-text provenance. Old cards need
  no migration or default field; exact historical generated blocks can be
  recognized, while unknown, blank, internally rewritten or ambiguous text stays
  untouched. Text exceeding the existing description bound is never truncated.
- Feats & features derives a separate current class summary when saved prose
  cannot safely refresh, with preserved notes in a disclosure. Post card labels
  current and preserved text separately. Calculations still use class identities,
  selected alternatives and levels, not descriptive prose. No RAW mechanic or
  progression convention changes. See [the preservation contract](class-summary-preservation.md).
- Seven new regressions cover standard/paired advancement, legacy recognition,
  alternate selection/restoration, customized names and sources, complete rewrites,
  ambiguous repeats, size limits, reviewed custom tables and subsequent levels,
  native reload and a fresh browser-storage client. Recorded history, injuries,
  spell expenditure and feature counters survive. All 777 tests passed, as did
  TypeScript and the production build. Existing build warnings remain.
- The preceding casting fix `fc18f39` deployed successfully (Pages run
  `40960291716`). No private exports or real player saves were changed. Browser
  UI interaction remains unverified while browser access is disabled; storage
  tests are not a substitute. This cannot recover already-erased notes and does
  not audit independently managed daily-resource or racial-card synchronization.
- Custom casting/manifesting, proficiencies, remaining source-specific/shared
  feature cases, reviewed mode conversion and complete end-to-end gates remain
  open. The broader goal is not complete.

## Source-reviewed custom equipment training (2026-10-30)

- Added optional explicit proficiency metadata to saved custom-class profiles,
  using the existing equipment resolver instead of a second penalty calculator.
  No schema default, automatic migration, inferred class-name grant or feat copy
  is introduced. Unused library profiles confer no benefits.
- The shared creation/Classes editor supports independent simple/martial groups,
  melee-only restrictions, individual catalog weapons and armor, armor groups,
  shield scopes including separate tower-shield permission, and delayed medium
  armor at an actual custom class level. Source acknowledgment and the existing
  stale-review/atomic confirmation safeguards remain required. The review lists
  old/new training and changed proficiency for recorded items. Classes displays
  the saved training description alongside each custom entry.
- Independent training from either gestalt class combines without stacking.
  Existing racial weapon familiarity and feat-prerequisite checks consume the
  same resolver. Manual weapon/gear overrides, all saved equipment, skill history,
  feature notes, injuries and spent casting remain intact. Ordinary armor skill
  penalties and arcane spell failure are not removed by proficiency.
- Rules checked against [UA gestalt class features](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm),
  [weapon proficiency and categories](https://www.d20srd.org/srd/equipment/weapons.htm#weaponCategories),
  [armor nonproficiency](https://www.d20srd.org/srd/equipment/armor.htm#armorCheckPenalty),
  and [dwarf weapon familiarity](https://www.d20srd.org/srd/races.htm#dwarves).
  The test classes are explicitly synthetic source configurations, not claims
  about published classes. Actual class grants must be entered from their source.
- Unknown/duplicate item names, invalid groups, contradictory melee restrictions,
  unsupported fields and a missing table row for delayed armor training fail
  validation. Uncatalogued items, conditional training and other progression
  patterns remain manual rather than guessed. See [the profile contract](custom-class-profiles.md).
- Eight new regressions cover schema boundaries, no-grant defaults, narrow groups,
  individual items, actual attack penalties, delayed training in standard/paired
  advancement, cross-class/feat/racial grants, review and removal, stale changes,
  native reload and a fresh browser-storage client. All 785 tests passed, along
  with TypeScript, the production build and whitespace checks. Existing script,
  bundle-size and build-plugin timing warnings remain.
- The preceding note-preservation fix `93307c1` deployed successfully (Pages run
  `40961490669`). Browser UI verification remains unavailable while browser access
  is disabled; API persistence testing is not a browser interaction test. No
  private exports or player saves were modified. Custom casting/manifesting,
  conditional/shared abilities, remaining variant cases, reviewed mode conversion
  and complete end-to-end gates remain unfinished. The overall goal is not complete.


## Cloud continuation: progression controls and preserved resources (2026-11-01)

- Resumed from GitHub `183213f` against the user's complete goal. Standard defaults,
  paired creation/advancement, independent casting and persistence already exist;
  this continuation reuses those systems. See [current status](gestalt-current-status.md)
  for the acceptance mapping and unresolved gates.
- Found Classes and Skills controls that attempted unsupported independent edits
  to paired progression. They are now read-only/disabled for gestalt, with saved
  paired history and instructions for the existing paired level-up workflow.
  Standard class editing and historical Intelligence/point corrections remain.
  Effective class dice/skills are distinguished from base-table bonuses.
- Reproduced renamed Rage cards being deleted and recreated with zero expenditure,
  and daily/supplemental descriptions being overwritten. Stable rule identities
  now control synchronization; custom names, sources and notes survive. Only a
  uniquely recognized generated block refreshes. Current guidance is separate
  when legacy or rewritten text cannot be safely replaced.
- Optional retained resource records preserve full cards when a class feature is
  replaced. Restoration reuses the original identity and retained spent uses;
  only an explicit daily rest resets them. The Features panel exposes inactive
  records. No legacy empty archive or reset is added. Five regressions cover
  standard/paired advancement, old rewritten notes, replacement/restoration/rest,
  independent counters, native files and a fresh storage client.
- Reproduced duplicate Monk // Ninja AC milestones, a negative Wisdom penalty
  and Monk AC remaining active while helpless. The existing effect calculation
  now consumes one shared, read-only resolver. Use the higher complete monk or
  ninja source; do not add their levels or bonuses. Applicable Psionic Fist
  levels still use the previously verified nonstacking monk advancement.
- Sources: [Monk AC Bonus](https://www.d20srd.org/srd/classes/monk.htm#acBonus)
  grants Wisdom bonus “if any” and loses both bonuses when immobilized/helpless,
  armored, shielded or carrying a medium/heavy load. The
  [Ninja AC Bonus](https://srd.dndtools.org/srd/classes/baseCad/ninja.html) explicitly
  does not stack with the monk's AC bonus ability and repeats those restrictions.
  This source-specific nonstacking rule applies in ordinary and gestalt play;
  it does not invent another mixed-class progression convention.
- Four new defense regressions cover all levels 1–20 and both side placements,
  ordinary multiclass, negative Wisdom, flat-footedness, helplessness, gear/load,
  manual mode and unchanged native persistence with injuries and expenditure.
- All **794 tests passed**, TypeScript passed, and both Pages and Worker production
  builds passed. The initial theme-check failure was an execution-sandbox
  subprocess restriction; it passed with subprocess execution available.
  Rendered React assertions checked the changed controls and retained notes.
  Interactive browser checks remain unavailable and are not claimed complete.
  No private exports or player saves were used. The broader goal remains open.


## 2026-11-02: Explicit custom casting and manifesting tables

The optional custom profile contract now exposes source-reviewed own-class spell
and power tables, including delayed access, split spell abilities, known limits,
and the existing supported level formulas. Metadata and per-level resource rows
validate together; unknown or incomplete mechanics are rejected. The same editor
serves new-character drafts and existing characters.

This extends the existing class lookup, resource initialization, progression,
prerequisites, UI and persistence paths. Custom IDs are resolved exactly; names
cannot adopt unknown pools or grant catalog-specific class powers. Standard and
paired advancement preserve independent traditions, and catalog prestige target
selection honors custom arcane/divine/psionic identity with the existing gestalt
per-level cap. No custom prestige progression is inferred from milestone prose.

Reviewed table changes expose old/new rules, levels, capacities and allowances.
Preparations, spell/power choices, notes, focus, personal settings and expenditure
are protected. Linked manual pools stay manual. Removing a table retains its
pool. Adding a new tradition preserves earlier automatic prestige choices before
candidate ambiguity changes. Missing source rows preserve capacities and block
further automatic use/advancement instead of copying a final row as an estimate.

Published rules checked independently during this continuation:

- [UA gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm):
  separate daily spells for each spellcasting class and the existing prestige
  restrictions. No new interpretation of mixed BAB/save progression was added.
- [Ability modifiers/bonus spells](https://www.d20srd.org/srd/theBasics.htm#abilityScores):
  bonus spells depend on the relevant score and accessible spell levels.
- [Psionic classes](https://www.d20srd.org/srd/psionic/classes/index.htm):
  multiclass power points share a reserve, with tradition-specific manifester
  levels; bonus points use one-half the key ability modifier times ML, rounded down.
- [Psion](https://www.d20srd.org/srd/psionic/classes/psion.htm): separate base
  point/known/maximum-level tables and minimum key ability for a power's level.

The custom formulas are explicit configuration, not claims that all published
classes follow them. Custom prestige advancement of another tradition, exceptional
slot restrictions/formulas, automatic custom whole-list learning and conditional
features remain manual. Existing source-specific catalog implementations remain.
See [the contract](custom-class-profiles.md) for supported metadata and safeguards.
No private saves were used. The overall goal still retains the current handoff's
browser and source-specific gates.


Validation: full regression suite **809 passed** (15 new custom-resource tests),
followed by **108 passing related mechanics tests** for the final missing-table
guards and standard prestige-history preservation. TypeScript and both Pages and
Worker production builds passed. React rendering checked the resource editor,
unavailable spell columns, source guidance, linked spellbook and power limits.
Browser interaction remains unverified; existing bundle/script/plugin-timing and
route-classification notices remain. The final schema bound was also checked by
the custom-resource suite; invalid ML formulas fail rather than being capped.


## 2026-11-02: Explicit custom prestige schedules and reviewed targets

Added optional source-checked existing-tradition metadata and per-class-level
grants to custom profiles. The existing engine now keeps arcane/general spell,
divine and manifesting schedules independent. Missing grants, overlapping target
categories, non-prestige profiles and unmarked combined progressions are refused.
No advancement is inferred from names or milestone prose.

The paired workflow already records per-level targets and now consumes these
schedules. Standard custom prestige levels use the same choice resolver with
optional class-level target records; old class-wide targets keep their existing
meaning. Later choices cannot redirect previous levels. Ordinary gain operations
are now atomic. Prerequisites still use complete custom-source confirmation;
combination approval is named, reasoned and scoped to each gestalt level. Neither
approval bypasses same-family or two-prestige restrictions.

Source evidence independently checked:

- [Loremaster spells](https://www.d20srd.org/srd/prestigeClasses/loremaster.htm):
  advances a prior spellcasting class's daily spells, known spells where applicable,
  and caster level, without granting its other class benefits.
- [Mystic Theurge](https://www.d20srd.org/srd/prestigeClasses/mysticTheurge.htm):
  chooses prior arcane and divine classes separately for each prestige level.
- [Cerebremancer](https://www.d20srd.org/srd/psionic/prestigeClasses/cerebremancer.htm):
  separate prior arcane/manifesting targets, progressing spells/points, known
  powers and caster/manifester levels, excluding other class benefits.
- [UA gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm):
  prior shared-progression policy and prestige restrictions remain unchanged.

The supported contract selects other classes held before entry, using saved
history, and does not invent an additional generic minimum caster level for the
selected class. Source-specific conditional requirements still need explicit
support or manual handling. Per-row grants are zero or one; caster-level-only,
multiple grants to overlapping candidate sets and other exceptions are not
approximated. Existing catalog Hierophant handling remains distinct.

The reviewed table editor captures explicit targets for earned grants, displays
old/new totals, and rejects stale target/profile/source edits. Removed grants keep
their records; missing pools are not reassigned. Standard and paired target
histories are visible in Calculations and persist through native and browser
storage. Preparations, powers, notes, focus, injuries, ranks and expenditure are
preserved. No player files were used and no implicit migration was added.


Validation: all **819 tests passed**, including ten new custom-prestige scenarios
covering separate schedules, standard per-level targets, same-pair caps, source
prerequisites/GM approval, pre-entry eligibility, domain preparation, reviewed
historical changes, stale/tampered previews, retained removed targets, and native
plus fresh-browser-store persistence. TypeScript and final Pages/Worker builds
passed. React rendering verified explicit grant controls, missed levels, and
standard/paired history labels. Full-suite failures exposed two existing-caller
reference regressions in the atomic standard gain recipe; preserving existing
record objects resolved them before the final full passing run. Interactive
browser testing remains unavailable and is not represented by rendering checks.
Existing bundle/script/plugin-timing/route-classification notices remain.


## 2026-11-02: Shared meldshaping limits and explicit essentia rulings

The shared-feature audit checked the existing Evasion restrictions against the
class texts and the general encumbrance rule; those restrictions remain intact.
It then reproduced a missing cross-class Constitution check and unconditional
addition of both gestalt essentia tables in the existing class-system warnings.

Source evidence: *Magic of Incarnum*, p. 20, “Multiclass Meldshapers” and
“Abilities and Meldshapers” ([text reproduction](https://dokumen.pub/magic-of-incarnum-a-new-source-of-power-for-your-d-d-game.html)).
Meld lists, binds and class-specific capacity increases remain independent.
Constitution limits the combined number of shaped melds; the book's Incarnate 6 /
Totemist 6 example requires Constitution 18 for eight melds and has ten essentia.
The [Incarnate](https://srd.dndtools.org/srd/classes/baseMoi/incarnate.html),
[Totemist](https://srd.dndtools.org/srd/classes/baseMoi/totemist.html) and
[Soulborn](https://srd.dndtools.org/srd/classes/baseMoi/soulborn.html) tables supply
the existing individual resource amounts.

The read-only resolver now checks the combined Constitution ceiling. Ordinary
multiclass and nonoverlapping gestalt essentia contributions add normally. For
classes progressing at the same actual levels, a printed progression that is at
least as large at every earned level supplies the shared pool once. This is a
conservative application of [UA's faster shared-feature rule](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
to essentia, not a claim that UA explicitly describes incarnum. Left/right swaps
and the BAB/save bonus method do not affect it. Class capacity increases and
separate meld/bind limits retain their existing meaning.

Mixed or staggered overlapping histories have no inferred combined pool. An
optional total records the GM, sources/reason and reviewed progression; it is
also available for source-specific additional essentia. Advancement retains an
old ruling but marks it stale until reviewed again. No choices, allocations,
binds, notes or spent resources are removed or reset. Warnings never treat an
unresolved total as zero. Fresh/legacy characters acquire no implicit ruling.
Levels missing from the supported tables likewise require source review; the
resolver does not copy the last row or extrapolate new grants.

The existing Magic panel shows the shared total and Constitution limit, explains
class-table reference amounts, and offers the reviewed total controls. A saved
ruling remains visible even after its class is removed. The persisted class-system
schema moved into a module independent of calculations, preserving its public
re-export; rendering exposed an initialization cycle when that entry module was
loaded before Character, and a cold-module regression now covers the fix.

Additional sources for the unchanged defensive audit:
[Rogue Evasion](https://www.d20srd.org/srd/classes/rogue.htm#evasion),
[Monk Evasion](https://www.d20srd.org/srd/classes/monk.htm#evasion),
[Ninja Evasion](https://srd.dndtools.org/srd/classes/baseCad/ninja.html), and
[carrying capacity](https://www.d20srd.org/srd/carryingCapacity.htm). Medium/heavy
loads count as the corresponding armor for armor-restricted abilities; the
ninja's stricter restriction is source-specific. No speculative defense change
was made during this audit.

Validation: the full suite passed **830 tests**. The final missing-table guard
then passed all **31 related tests**, including all twelve new meldshaping
regressions. TypeScript and both Pages/Worker production builds passed. React
rendering verified combined limits, independent table references, unresolved and
saved rulings, removed-class history and missing-table guidance. Native and fresh
storage-client tests retained injuries, other expenditure, over-limit choices,
binds, notes and allocations. Existing build notices remain. Interactive browser
QA and the remaining source-specific cases are still open; no player saves or
private exports were used.


## 2026-11-03: Granted feat preservation and separate advancement choices

Four new regressions first reproduced lost descriptions/counters on alternate
granted feats, a duplicate catalog grant after renaming its card, a style change
reusing the old feat's ID for a different feat, and an alternate-granted feat
being accepted as a separate general advancement selection.

Both existing grant synchronizers now use one shared operation and the existing
retained-resource store. Optional saved feat identity separates the granted rule
and weapon/skill choice from personal display text. Known grants retain their
IDs, names, source annotations, descriptions, formulas and counters. A changed
style, weapon or bonus selection retains the old full card and can restore it
later. Historical choices and legacy duplicate cards remain distinct records;
duplicate copies of one grant contribute that feat only once. Ordinary personal
feats are never adopted or overwritten. No empty archive or identity field is
added by schema defaults.

Existing fixed grants from overlapping classes keep the current source where
possible. Explicitly repeatable choices remain independent: an existing personal
Toughness does not suppress later selected bonus copies. Choice-specific feats
continue to require their own eligible weapon/skill choices. Armor and alternate
feature activation checks retain their existing behavior.

Source evidence independently checked:

- [Fighter bonus feats](https://www.d20srd.org/srd/classes/fighter.htm#bonusFeats)
  distinguish class bonus choices from normal advancement choices.
- [UA monk fighting styles](https://www.d20srd.org/srd/variant/classes/variantCharacterClasses.htm#monkVariantFightingStyles)
  specify feats at class milestones. The Cobra Strike and Undying Way lists
  supply the style replacement/restoration regression cases.
- [Toughness](https://www.d20srd.org/srd/feats.htm#toughness) and
  [Extra Turning](https://www.d20srd.org/srd/feats.htm#extraTurning) explicitly
  permit repeated selections with stacking effects. Existing source lists and
  prerequisite validation still govern which alternate bonus feats can be chosen.

The existing advancement tracker and its selector now exclude both types of
managed class grant. Invalid historical assignments remain saved and show a
review message; no score, feat or old assignment is silently removed. The Feats
panel shows current granted identity, preserved editable alternate-feat notes,
retained counters and inactive historical choices. Rule choices remain managed
through Classes rather than being changed by a personal card label.

Ten new tests cover standard and paired sheets, variable choices, repeatable and
overlapping grants, legacy duplicates, class-level changes, guided paired gain,
native files and a fresh storage client. Injuries, training, spell expenditure
and invalid old assignment records survive; explicit rest resets only the usual
daily counters. All **841 tests passed**, along with TypeScript and both Pages
and Worker production builds. React rendering verified the displayed rule
identity, preserved notes/counters, inactive records and old-assignment review.
Existing build notices remain. No private player saves or exports were used. Browser
acceptance and the remaining source-specific gates are still open.

## 2026-11-03: Ranger combat-style armor and load restrictions

Reproduced ordinary archery and two-weapon styles retaining attack benefits with
a medium load, alternate styles ignoring all loads, and alternate styles ignoring
imported armor stat blocks. A shared read-only restriction now governs ordinary
style attacks and alternate granted feats. It reads the existing equipment and
carrying systems, including effective Strength, size, coins and the character's
independent encumbrance option. Disabling encumbrance does not waive worn armor
restrictions. Imported armor and mithral use their existing saved metadata.

Source evidence independently checked:

- [Ranger Combat Style, Improved Combat Style and Combat Style Mastery](https://www.d20srd.org/srd/classes/ranger.htm#combatStyle)
  require light or no armor at each milestone. The alternate
  [Combat Styles](https://srd.dndtools.org/srd/classes/baseCore/ranger.html#combat-styles)
  lists explicitly use those same three class features and their levels.
- [Carrying capacity](https://www.d20srd.org/srd/carryingCapacity.htm)
  treats medium and heavy loads as the corresponding armor for restricted
  abilities. Overloaded/immobile characters likewise exceed a light load.
- [Mithral](https://www.d20srd.org/srd/specialMaterials.htm#mithral)
  reduces medium armor to light and heavy to medium for these limitations;
  light remains light. Shields alone do not violate the ranger's armor rule.

The helper reads worn gear without invoking proficiency checks: those checks
can themselves depend on a granted feat. It checks every carried, equipped,
nonzero armor item, preserving the alternate-style rule for multiple worn items.
Ordinary style penalties, Rapid Shot and advanced offhand attacks reuse the same
availability check. Independently selected feats retain their own benefits.
This does not add a new feat, change class progression, remove saved choices or
retire temporarily unavailable cards. The existing UI now explains inactivity
beside ordinary style controls, alternate style controls and granted feat cards.

Eight automated cases cover both advancement modes at ranger levels 2, 6 and 11;
light/medium/heavy/overloaded boundaries; optional encumbrance; effective Strength,
size and coin weight; imported armor and mithral; worn state and shields;
independent feats and replaced sources; and native/browser persistence plus
paired advancement. Seven cases reproduced failures before the fix. Loading and
advancing preserve card identity, notes, counters, history, injuries and spell
expenditure; removing the restriction restores the benefit without a refund.

Validation: **849 tests passed**, TypeScript passed, and Pages and Worker builds
passed with the existing bundle/script/plugin-timing/route-classification notices.
React rendering checked both restriction messages, the optional encumbrance
setting and retained personal notes. It does not substitute for interactive
browser acceptance. No private player saves were read or modified. The remaining
source-specific feature audit, mixed Uncanny Dodge histories, reviewed conversion,
racial-HD occupancy policy and browser acceptance gates remain open.

## 2026-11-04: Imported armor and independent armored casting

The Magic interface called `specialSpellFailure` for supported spellbooks and
invocations. That function selected worn equipment through the shared resolver,
then looked it up again using only a catalog ID. Imported stat blocks without
an ID threw; stat blocks overriding a catalog item could use the wrong failure
chance. It now consumes the same resolved equipment as AC and proficiency.
Saved armor/shield values, carried/equipped/quantity flags, material reductions
and independent class exemptions remain in the existing calculation path.

Rules evidence independently checked:

- [Armor and arcane spell failure](https://www.d20srd.org/srd/equipment/armor.htm#arcaneSpellFailure)
  adds armor and shield chances and applies to spells with somatic components.
  The same page's [tower shield](https://www.d20srd.org/srd/equipment/armor.htm#shieldTower)
  rules retain the separate attack penalty.
- [Bard weapon and armor rules](https://www.d20srd.org/srd/classes/bard.htm#weaponAndArmorProficiency)
  waive light-armor failure for bard spells only, retaining shield failure and
  normal failure for spells from another class.
- [Duskblade Armored Mage](https://srd.dndtools.org/srd/classes/basePhb2/duskblade.html)
  advances its medium-armor allowance at class level 4 and heavy-shield allowance
  at 7. [Warmage Armored Mage](https://srd.dndtools.org/srd/classes/baseCarc/warmage.html)
  advances medium armor at 8 and does not extend to heavy shields. Both limit
  their exemption to spells of their own class.
- [Warlock](https://srd.dndtools.org/srd/classes/baseCarc/warlock.html) invocations
  waive light armor but retain shield failure; the
  [Dragonfire Adept](https://srd.dndtools.org/srd/classes/baseDrm/dragonfireAdept.html)
  text explicitly subjects draconic invocations to armor/shield failure. Neither
  source grants its exception to a parallel wizard tradition.
- [Mithral](https://www.d20srd.org/srd/specialMaterials.htm#mithral) supplies the
  existing effective-category and ten-percentage-point reduction rules.

An optional `armorStats.shieldType` uses the existing imported-item record. Gear
can explicitly select buckler/light/heavy/tower; absence keeps old saves intact.
The shared equipment resolver prefers this explicit type, then a known catalog
identity or an exact normalized catalog-name match. It does not infer an
armored-casting exemption from fragments in personal names. An unidentified
shield retains its recorded failure chance and shows a source-review message
where a class shield exemption might apply. Explicit types also govern the
existing tower/buckler and light-shield training checks, so renaming a reviewed
tower shield cannot erase its attack penalty. Existing catalog class policies,
including their buckler handling, are retained; this is not a complete audit of
all armored-casting feats or exceptional class/race combinations.

Thirteen new tests cover custom stats with/without catalog IDs, separate
standard/gestalt traditions, Duskblade/Warmage milestones, material reductions,
independent invocation/divine rules, unknown/explicit/legacy shield identity,
strict saved values, a synthetic Roll20 import, native/browser round trips and
paired advancement. The first nine imported-equipment cases reproduced the
exception before the fix. Tests retain source exports, gear notes, preparations,
spent slots, injuries, prior training and personal text. No actual player files
were used. The new optional field has no default and performs no migration.

All **862 tests passed**, along with TypeScript and both Pages and Worker
production builds. React rendering covered both spellbook traditions, an
imported-armor invocation panel, unknown-shield review and the Gear selector.
The builds retain existing bundle/script/plugin-timing/route-classification
notices. Interactive browser acceptance and the documented remaining goal gates
remain open.

## 2026-11-05: Reviewed mixed Uncanny Dodge histories

The Combat panel previously flagged mixed or staggered Uncanny Dodge histories
without a way to retain the table's decision. It now reviews and confirms an
optional ruling for improvement timing and the minimum attacker rogue level.
A GM name and source/ruling explanation are required. No ruling is inferred for
new or old characters, and no existing save is converted.

Source evidence independently checked:

- [Unearthed Arcana gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
  says features shared by both classes, explicitly including Uncanny Dodge,
  accrue at the faster class's rate. It does not spell out a complete combination
  algorithm for every mixed or staggered history. The new input is therefore
  labeled an explicit table ruling, not a published formula or automatic grant.
- [Rogue](https://www.d20srd.org/srd/classes/rogue.htm#improvedUncannyDodge)
  lists the improvement at class level 8; [barbarian](https://www.d20srd.org/srd/classes/barbarian.htm#improvedUncannyDodge)
  lists it at 5. Both retain the rogue-level exception and ordinary multiclass
  second-source upgrade. Those established automatic paths are unchanged.
- [Psychic Rogue Danger Sense](https://srd.dndtools.org/srd/classes/baseOther/psychicRogue.html)
  requires maintained psionic focus, with Uncanny Dodge at 7 and its improvement
  at 9. A ruling involving this source cannot waive focus. Existing focused
  True Thief restrictions also remain in the shared source resolver.

`classSystems.uncannyDodgeRuling` is optional and versioned. Its scope records the
actual paired class history and relevant replacements. Personal names, entry
ordering, side swaps and the separate BAB method do not affect that scope.
Advancement or a changed source invalidates the decision while retaining the
record. Temporary loss of a required source suspends it; independently available
listed benefits continue to work. The ruling cannot remove a listed improvement
or restore an improvement surrendered by every reviewed source. Semantically
incompatible imported decisions remain visible for review instead of taking
effect. Structurally invalid data is rejected through the existing file schema.

Preview does not mutate a character. Confirmation revalidates the decision and
rejects changed choices, progression or an intervening saved ruling. Injury,
preparation and expenditure changes made during review remain intact. Combat
remounts on character switching so one sheet cannot inherit another's draft.
Clearing the optional record restores the existing automatic explanation without
resetting other state. Daily rest preserves the record and follows the usual
focus/resource rules. Missing sources do not hide an existing ruling.

The threshold remains an explanation for resolving incoming attacks at the
table. It does not infer an opponent's class, change outgoing flanking/sneak
attack selections, or alter basic Dexterity retention. Additional class-specific
exceptions still require source-backed policies; this is not a universal feature
override or a completed audit of all gestalt shared abilities.

Fourteen automated cases cover unchanged standard/parallel behavior, explicit
yes/no decisions, malformed/incompatible imports, cancelled and stale reviews,
replacements, advancement, stable identity, focus loss/restoration, independent
benefits, native files and fresh browser storage. They preserve paired training,
preparations, injuries, notes and expenditure. React rendering checks the actual
form, automatic-control absence, applied provenance/threshold, stale decisions,
removed sources and suspended focus. Interactive browser acceptance remains an
open gate; rendering checks are not a substitute. No private player saves were
used or modified.

Validation: **876 tests passed**, including all fourteen new cases; TypeScript
and the GitHub Pages and Worker production builds passed. Existing bundle,
script, plugin-timing and route-classification notices remain. The standing user
instruction to deploy every finished patch is now recorded in `AGENTS.md`.

## 2026-11-05: Turning feats on existing rebuking resources

The resource audit reproduced three omissions: Extra Turning and Improved
Turning were ignored by Dread Necromancer and Death Master cards; Blackguard's
Command Undead included Extra Turning but omitted Improved Turning from its
effective level. The first three regression tests failed before this correction.

Sources independently checked:

- [Extra Turning](https://www.d20srd.org/srd/feats.htm#extraTurning) grants four
  additional daily attempts per selection, is repeatable, and benefits each
  turning/rebuking ability. [Improved Turning](https://www.d20srd.org/srd/feats.htm#improvedTurning)
  treats the granting class as one level higher for turning or rebuking. It is
  not repeatable and does not grant earlier access to the ability itself.
- [Dread Necromancer Rebuke Undead](https://srd.dndtools.org/srd/classes/baseHoh/dreadNecromancer.html)
  invokes the cleric class feature. [Death Master Rebuke Undead](https://srd.dndtools.org/srd/classes/baseDc/deathMaster.html)
  explicitly grants 3 + Charisma modifier daily attempts and the Knowledge
  (religion) synergy. The existing class-level interpretations are retained;
  this patch applies the published feats to those existing resources.
- [Blackguard Command Undead](https://www.d20srd.org/srd/prestigeClasses/blackguard.htm#commandUndead)
  starts at class level 3 and uses the cleric level two below its own. Improved
  Turning increases that effective level once, without moving the entry gate.

The small shared `turning-feats` helper reuses existing feat identity/counting
and effective Charisma. Cleric/paladin's existing shared gestalt progression and
ordinary multiclass calculation are unchanged. Improved Turning contributes once
after that calculation; duplicate saved copies do not multiply its benefit.
Extra Turning still counts independently selected copies and deduplicates legacy
cards for a single earned grant. Nothing infers extra feat choices from the two
class tracks. This patch neither merges nor creates turning/rebuking pools and
does not establish new cross-class stacking policies for exceptional sources.

Existing resource cards receive corrected maxima and effective-level guidance.
Their IDs, personal names, descriptions, source annotations and expenditure are
preserved. Legacy text with no recognized generated block stays intact; current
guidance appears separately in the same interface. Removing a feat or changing
Charisma never refunds spent attempts, including expenditures above a reduced
maximum. Manual mode retains its saved caps. Only the existing explicit daily
rest clears daily use. Standard and paired advancement preserve old training,
injuries, preparations, casting expenditure and optional settings.

Eleven automated cases cover the published feat effects, delayed/replaced
abilities, Charisma boundaries, renamed/duplicate earned feats, legacy guidance,
manual limits, both advancement modes, native exports, fresh browser clients and
module initialization. React rendering checks the actual feature cards, current
guidance, personal notes and zero remaining uses when over the limit. Interactive
browser QA and the broader documented goal gates remain open. No private player
saves were read or changed.

Validation: **887 tests passed**, including eleven new regressions. TypeScript,
the GitHub Pages build and the Worker production build passed. The existing
script, plugin-timing and route-classification build notices remain.

## 2026-11-06: Desktop continuation and standard prestige form targets

Continued from Cloud Astra's merged `88c9d83` (PRs #32-34) after a clean
fast-forward. The browser audit reproduced a gap between the tested advancement
engine and its standard level-up form: the target selector updated component
state, but the Gain Level callback omitted the fourth `gainLevel` argument.
This silently repeated a previous target, or failed when no default existed.

Reproduction: a synthetic Wizard 3 / Sorcerer 3 / custom Scholar 1 has a recorded
first prestige grant to Wizard, giving caster levels 4 and 3. With enough XP for
actual level 8, select the Scholar's next level and choose Sorcerer. Before the
fix, the saved result was Wizard CL5 / Sorcerer CL3. After the fix it is CL4 / CL4,
and the history lists Wizard at Scholar 1 and Sorcerer at Scholar 2. This uses a
synthetic explicit advancement schedule, not a claimed published class.

The callback now passes every displayed target, keeping an explicit blank
distinct from the default and `none` distinct from a missing choice. Missing or
invalid input reports an inline error; the existing atomic engine and edit clone
preserve the sheet on failure. Successful advancement resets transient targets
and the next die input; changing class/target clears the old error. The existing
character-keyed form continues to isolate drafts. No save migration, change to
prestige eligibility, target policy, progression formulas or RAW interpretation
was introduced. Already misassigned historical targets require player review;
this patch cannot infer their intended destination.

Interactive tests used the local development site and disposable characters,
without reading or modifying production player storage:

- Confirmed the target bug before the fix. Afterward an explicit blank blocked
  advancement and displayed an error; selecting Sorcerer then advanced correctly.
- Exported the actual corrected browser character and checked earlier training,
  preparations, spell expenditure, notes, both recorded targets and three points
  of injury against its pre-advancement synthetic export. A full reload retained
  level 8, CL4/CL4 and 39/42 HP.
- A separate original copy selected "No advancement this level": both CL4/CL3
  remained unchanged, and Scholar 2 recorded No advancement without changing
  the earlier Wizard grant.
- Created a standard Human Fighter with default recorded HP. CON15 produced
  12 initial HP; after taking three damage and entering a d10 roll of 7, level 2
  saved and reloaded at 18/21 HP.
- Created Cleric 1 // Wizard 1 through the actual dialog. Cancel left the level
  unapplied; changing injury after preview disabled stale confirmation. Refresh
  and confirmation produced actual level 2 with both classes/CLs at 2. Save and
  reload retained 8/12 HP (four damage) and separate traditions. This character's
  rolled Wisdom was below casting eligibility; its cleric slot limitation was
  retained, not overridden to manufacture usable spells.

All **887 existing tests passed**, along with TypeScript and both Pages/Worker
builds. Existing script, bundle-size, plugin-timing and route notices remain.
The full browser acceptance matrix, exceptional class rules, racial-HD occupancy
and reviewed mode conversion remain unfinished; this is partial browser evidence,
not completion of the overall goal. No private exports or real player saves were
used. The rules policy and printed-table default/fractional option remain intact.

## 2026-11-06: Shared Wizard/Sorcerer lists and custom paired browser checks

The prior standard prestige form fix (`1d71484`) is deployed: Pages run
`42205433258` succeeded, and its live entry bundle was checked against the CI
build output. This continuation then exercised the actual custom-class creation
and paired advancement forms using only synthetic localhost characters.

The catalog exposed a separate defect: selecting `Wizard` matched only literal
Wizard-only metadata, omitting shared `Sorcerer / Wizard` entries. Magic Missile
returned no matches. Adding a shared spell to that tradition could also fall
through to another class's lowest level (for example, Bard 3 for Scrying).
`spellListLevel` now resolves an explicit Wizard/Sorcerer entry first, then the
shared entry. Filtering, level filtering, initial browsing and adding spells use
the same lookup. Other list names remain exact, Wizard-only entries do not become
Sorcerer entries, and a shared filter does not absorb class-only entries. Level 0
is a valid result. The catalog and existing saved spells are not mutated.

Rules evidence: the [SRD Sorcerer and Wizard class descriptions](https://www.d20srd.org/srd/classes/sorcererWizard.htm) identify their common
sorcerer/wizard spell list. The bundled SRD records Magic Missile at shared level
1, Light at shared level 0, and Scrying at shared level 4/Bard level 3. This is
list resolution, not an inferred casting identity for arbitrary custom classes.
Previously saved incorrect levels require review; this patch does not guess
whether a saved level is an intentional adjustment.

Interactive acceptance evidence:

- Created a two-row synthetic `QA Arcanist` through the New character custom
  editor, with explicit Wizard-list INT prepared casting, d8, medium BAB, poor
  saves and two skill points. This is test configuration, not a published class.
  Paired it with Fighter using INT16/CON14 and recorded-roll HP.
- Reproduced zero Magic Missile matches before the fix; after the fix added it
  from the Wizard filter, set two preparations and one spent use, and inflicted
  three points of damage on the synthetic sheet.
- At actual level 2 changed the left side to Rogue while advancing QA Arcanist
  to 2; recorded d8 roll 5. At actual level 3 changed the right side to Wizard
  while advancing Rogue to 2; recorded d6 roll 4. The resulting pairs are
  Fighter/QA Arcanist, Rogue/QA Arcanist, Rogue/Wizard. HP progressed from 9/12
  through 16/19 to 22/25. The custom caster stayed CL2 and Wizard began at CL1.
- Edited the custom level-2 first-level base slots from two to three with an
  updated synthetic source note. A character-name change invalidated the review
  and disabled Apply. Refreshing and applying changed only the reviewed custom
  capacity (including INT bonus, three to four); preparations, expenditure,
  independent Wizard casting and injury stayed intact.
- Saved, reloaded and exported the actual browser character. Assertions on that
  export confirmed three paired levels, rolls [10,5,4], HP22/25, caster levels
  2/1, Magic Missile level1/prepared2/spent1 and the revised custom row. Imported
  this native export through the actual Import control, saved and fully reloaded;
  the browser retained the same state and one remaining prepared casting.
- Filtered the library to Wizard level4, added the exact Scrying entry and
  verified the spellbook placed it at level4. Casting remained unavailable with
  the existing no-daily-slots explanation; no slot or level was fabricated.

Three new automated regressions cover every shared base-catalog spell, explicit
class overrides including cantrips, exclusive entries, unrelated lists and
nonmutation. All **890 tests passed**, together with TypeScript and both the
Pages and Worker production builds. Existing script, bundle-size, plugin-timing
and route-classification build notices remain.
No private character exports or production saves were used. The larger browser
matrix and the remaining goal gates stay open.

## 2026-11-11: Linked arcane spellbooks

Built-in Wizard and Sorcerer books, including books restored by the confirmed
Roll20 Sorcerer review, store the common list name. The shared-only library
filter hid class-specific catalog entries from these books. The catalog now uses
the recorded casting class when opening that list and choosing the level of a new
spell. The existing shared-list lookup supplies common spells. Explicit lists,
domain books and unlinked traditions continue to use the saved list directly.
Renaming a tradition has no effect on class identity. Players can choose other
filters in the library. The shared base list is documented in the
[SRD class descriptions](https://www.d20srd.org/srd/classes/sorcererWizard.htm).
Specific levels here come from catalog metadata, including entries labeled for
source review.

On the synthetic paired sheet, the older empty Wizard book opened with the
shared-only filter. After the fix it opened with Wizard selected. Adding
Backlash used its recorded Wizard level 2, and the CL1 character had zero slots
available there. On a separate multiclass sheet, Browse opened with Sorcerer
selected and showed the Sorcerer-only Arcane Fusion entry at level 5.

The supplied Sorcerer export was imported, reviewed and reloaded locally in
memory. Its book retained CL2 and found Arcane Fusion at level 5. Comparing the
whole character before and after lookup confirmed the operation was read-only.
Regression coverage includes an already leveled import with spent slots, named
traditions, domain and custom lists, and different class levels on one catalog
entry. The full automated suite passed all 892 tests.

## Paired level review of class resources

The confirmation screen compares active feature counters by their saved IDs.
It shows additions, removals and changes to maximum capacity alongside the
amount already spent. Each casting tradition with a spells-known table shows
its own allowance. Manifesting traditions show their individual contributions
to the shared reserve and their class-table allowances for powers known and
maximum power level when recorded. These are read-only views of the proposed
character. They do not select spells, learn powers or refresh uses.

The Bard // Psion regression starts both classes on an existing paired sheet,
spends bardic music, a spell slot and a power point, and advances both classes
again. It checks the proposed limits, then confirms and reloads the character
to verify that the renamed counter, its notes and all three expenditures survive.

In the local browser the synthetic level-3 multiclass sheet previewed Bard 1
// Psion 1 at actual level 4. It showed one bardic music use, four bard cantrips
known, three powers known, maximum power level 1 and a three-point contribution
to the daily reserve. Wizard and the custom arcanist retained their independent
caster levels of 1 and 2. Cancelling closed the review. All 895 tests passed.

## Spontaneous Cleric casting

The ordinary prepared Cleric book can expend a remaining copy of a prepared spell
for a cure or inflict spell of its level or lower. A Cleric // Wizard spends
only the chosen Cleric preparation. Domain preparations and classes that traded
away spontaneous casting are ineligible. The converted spell uses the Cleric
tradition's caster level, its own spell level and the chosen target's touch
delivery. The catalog fills inherited range, saves and other statistics from
the corresponding light or mass light spell and retains explicit exceptions.
This control covers unmodified cure and inflict spells. The sheet
uses the donor's recorded spell level, including explicit Heighten adjustments.
Good and evil alignments determine the channel. For other alignment entries
the player records the channel permitted by the deity and the character's
turning choice. [Cleric spontaneous casting](https://www.d20srd.org/srd/classes/cleric.htm#spontaneousCasting)

## Spiritual Weapon on subsequent rounds

A Cleric 3 on one side of an 11-level gestalt Fighter can cast Spiritual
Weapon at caster level 3 with BAB +11. With Wisdom 18, the casting round
attacks at +15 for 1d8+1 force damage. On a later round against the same
target it attacks at +15/+10/+5. Redirecting it takes a move action and
makes one attack at +15. Both ongoing actions use the selected spellbook's
damage formula. Only the initial cast spends a preparation or slot. The player tracks the active spell's duration, legal
targets, spell resistance and weapon-form criticals.
[Spiritual Weapon](https://www.d20srd.org/srd/spells/spiritualWeapon.htm)

## Psionic skills and Cerebremancer entry

Fresh player characters include Autohypnosis (Wis), Knowledge (psionics)
(Int), Psicraft (Int) and Use Psionic Device (Cha). The existing skill ledger
prices purchases against the two classes actually taken at the purchase level.
A level-3 Wizard // Psion can buy six ranks each in Knowledge (arcana) and
Knowledge (psionics) over three levels. This satisfies the skill requirements
for the next level of Cerebremancer. Spellcasting, manifesting and the gestalt
combination-class approval are checked separately.
Psions can choose their discipline during character creation or in Classes.
Its additional skills apply at levels that include Psion on either track.
Older sheets can record a discipline later. Previously purchased ranks keep
their historical training price through the ledger's per-level overrides.
The power library opens to the common list and the recorded discipline for
a Psion. Other listed traditions use their own lists. Players can select a
different list for exceptional grants. Newly added powers use the selected
list's level and base cost. Existing known powers keep their recorded values.
[Power point costs by level](https://www.d20srd.org/srd/psionic/psionicPowersOverview.htm#powerPoints)
[Psionic skills](https://www.d20srd.org/srd/psionic/skills/overview.htm) ·
[Psion disciplines and class skills](https://www.d20srd.org/srd/psionic/classes/psion.htm) ·
[Cerebremancer entry](https://www.d20srd.org/srd/psionic/prestigeClasses/cerebremancer.htm)

Guided level-up offers the discipline when a character takes its first Psion
level in standard advancement or on either side of a gestalt pair. The player
chooses before gaining the level. Paired review displays the choice and
recalculates the proposed skill costs. Cancelling leaves the save untouched.
Existing Psions with an unrecorded discipline can still advance and record
their choice in Classes. [Psion discipline at first level](https://www.d20srd.org/srd/psionic/classes/psion.htm#discipline)

Older native sheets can add missing entries individually in Skills. On an
older Roll20 import, opening the sheet recovers missing ranks from its retained
fixed skill fields. Recovered ranks count immediately. When training history
already exists, they remain unassigned until the player records their purchase
levels. Existing skill rows retain their IDs, modifiers and purchases. Repeating
specialties keep their identity, including a player's later name change.
[Roll20 3.5 sheet fields](https://github.com/Roll20/roll20-character-sheets/blob/master/D%26D_3-5/charsheet_3-5.html)

Interactive verification also covered the prestige target choices on a synthetic
level-7 gestalt sheet. Sorcerer // Cerebremancer showed two eligible arcane
and two eligible manifesting traditions. Missing GM approval and an unselected
manifesting target each blocked review. Changing either target cleared the
previous review. Selecting Sorcerer and Wilder advanced each once, including
the overlapping Sorcerer grant. The reloaded native export retained both target
IDs, the approval, 38/42 HP, a spent Wizard slot and two spent Psion points.

On the same saved sheet, Skills offered the three missing psionic skills and
recognized the existing six-rank Knowledge specialty. Adding Psicraft and
spending one point raised its check from +3 to +4. Saving and reloading kept
that rank and the original six Knowledge ranks. All 899 tests passed. Each of
the five supplied Roll20 exports also preserved its serialized character data
through a native save and reload.

### Adding a cleric domain pool after casting

Calculations creates the restricted domain slots with zero uses spent. A
standard cleric and a paired Wizard / Cleric both retain the preparations and
expenditure in their existing books. A level-five cleric with sufficient
Wisdom starts with one domain slot each at levels one through three. Fresh standard and gestalt clerics receive this pool at creation or when they
first take a cleric level. Previously saved clerics can add a missing pool
from Calculations. The new pool also follows this limit when the ordinary book uses manual progression.
See the [cleric domain spell rules](https://www.d20srd.org/srd/classes/cleric.htm#deityDomainsAndDomainSpells).

### Standard prestige casting choices

Guided standard advancement records each new prestige casting or manifesting grant on its class level. The picker uses the character’s level history to identify classes held before prestige entry. Separate arcane and divine grants have independent targets, and levels without a grant skip the picker. Earlier unrecorded levels keep their existing class-wide settings. Opening an older sheet does not write new choices into its history. See the [Mystic Theurge](https://www.d20srd.org/srd/prestigeClasses/mysticTheurge.htm#spellsperDay) and [Loremaster](https://www.d20srd.org/srd/prestigeClasses/loremaster.htm#spellsperDaySpellsKnown) class rules.

## 2026-11-13: Racial Hit Dice before paired class levels

Implemented the recorded conservative interpretation of [monster characters](https://www.d20srd.org/srd/monstersAsRaces.htm#humanoidsAndClassLevels) with [gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm#buildingAGestaltCharacter). The published texts do not explicitly place racial dice on a gestalt track. Retained racial Hit Dice precede pairs; classes on both sides keep their own advancement. This supersedes earlier notes that all racial-HD combinations are unsupported.

Creation, totals, history, skill training, level-up review and casting-history labels use this order. The first racial die receives the first-HD HP and skill treatment; the first class pair receives ordinary later-level grants. HD-based feats, ability increases and rank limits count racial dice plus pairs. XP adds level adjustment. Class casting does not acquire racial levels. Printed racial BAB/saves add normally; the optional fractional method carries the racial fractions before rounding the combined total, using the existing good-save-start convention.

A gnoll with Fighter 1 // Wizard 1 has three HD, ECL4, BAB+2 and base saves +5/+0/+2. With base CON14 and INT16 (racial adjustments enabled), recorded dice 8/4/5 give 26 HP and skill grants 16/4/4. Wizard remains CL1. Advancing the pair at 10,000 XP reaches HD4/ECL5, grants one ability increase, and uses the next class Hit Die once.

Unknown racial progressions and a single retained die are rejected explicitly. Catalog races that replace their single racial die already record zero retained dice. Existing sheets are not converted on load. Changing a saved racial-HD count or switching its racial history requires the still-unimplemented reviewed conversion. Rejected Race edits, including detaching a racial reference, show an alert and leave the save intact. Ordinary races without retained dice can still be changed normally.

Seven regression cases cover the concrete calculations, fractional carry, subsequent advancement, unsupported histories, standard/replacement races, every catalog racial progression's stable creation, and first import save/native reload. The persistence case retains the level-four ability increase, assigned feat, historical training, injury and spent spell slot. All **936 tests** and TypeScript passed; both Pages and Worker production builds passed with existing script, bundle and plugin notices.

Isolated browser QA created the gnoll through the real dialog and checked its actual-level history. A separate synthetic already-leveled import selected Rogue and a new HP roll before its first autosave. Both draft selections survived that save. The resulting level-five confirmation saved/reloaded with the original ability and feat assignments, four earlier history rows, skill ranks, three damage and one spent slot intact. No real player storage or private exports were used.

The broader goal remains open, including reviewed progression/racial-history conversion and the remaining documented class-specific and browser acceptance cases.
