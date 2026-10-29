# Standard defaults and gestalt progression

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
