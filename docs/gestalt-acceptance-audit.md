# Original standard-defaults and gestalt acceptance audit

Audit date: 2026-11-16. Scope: the user's full five-phase objective in
[goal-objective.md](goal-objective.md), not a reduced release milestone.
Read [rules-policy.md](rules-policy.md) for RAW requirements and recorded table
interpretations. Historical "remaining work" notes describe their date, not the
current acceptance result.

This audit uses the implementation, actual assertion bodies and interactive
browser flows. A green suite alone is not the rationale for any row below.
Final-head CI, publication and live verification are the release gate recorded
at the end; this file does not itself assert that an external deployment passed.

## Phase 1: standard defaults and independent settings

| Original requirement | Inspected implementation and concrete evidence |
| --- | --- |
| New characters use standard 3.5, with homebrew off | `createPlayerCharacter`, `createNpcSheet`, `character-rules.ts`; standard-rules-defaults tests assert rolled HP, normal armor AC, no DR/possessions/effects/specialty/alternate features, normal BAB/saves/skills/feats/XP, encumbrance and LA. Gestalt creation tests exercise every selectable base class on either side without enabling unrelated options. |
| First die maximum; normal later advancement | `recordStartingHitDice` records rolls once. Tests assert d10 sequence 10/1/4/7/10, HP 42 with CON applied once, repeatable recomputation, invalid rolls rejected, later standard level-up not maximized. Browser creation/advancement checks actual fields and stored rolls. |
| Armor supplies AC, optional systems remain available | The named Fighter browser case equips armor and checks AC, keeps DR separate, changes independent HP/encumbrance options, then reloads. Tests also retain independent gear-linked/custom DR and manual overrides. |
| BAB, saves, skills, feats, XP and class advancement remain standard | `standard-rules-defaults.test.mjs` checks numeric Fighter results and a real ordinary level-up. Existing ordinary multiclass, prerequisite, skill, spell, resource and Roll20 suites remain in the full regression gate. |
| Existing configurations retained, options persist/respond independently | Tests compare entire legacy/native/browser records, including maximum HP, ignored LA, disabled encumbrance, overrides, custom training and spent resources. Options change one calculation without resetting others. There is no campaign-defaults service in the browser-local architecture; the objective makes campaign defaults conditional on architecture support. |

The selector separates advancement mode from independent saved calculation,
HP, LA, encumbrance, training and rule choices. There is no universal homebrew
switch. No existing character is implicitly reset to the creation defaults.

## Phase 2: paired progression

| Original requirement | Inspected implementation and concrete evidence |
| --- | --- |
| Two independently selected classes at each level; either side may change | `gestaltLevelSequence` resolves ordered saved pairs to unique class entries. Creation/integration tests and the named browser matrix change both sides across successive levels and assert actual/class totals and saved order. |
| Base and prestige combinations; entry prerequisites | Guided transactions validate the pre-level character. Browser Eldritch Knight entry fails before qualifying, succeeds afterward with the scoped combination approval, and retains the new pair. Custom prestige browser checks real existing-class targets. |
| No two prestige classes; no same-class/variant combination | Compiler and guided transactions reject these independently of GM combination approval. Browser matrix uses independently qualified prestige choices to verify the pair restriction itself. Family tests prevent catalog/custom aliases from bypassing it while retaining historical imported conflicts for review. |
| Problematic combination classes, explicit GM exceptions | Source-policy metadata identifies Arcane Trickster, Eldritch Knight, Mystic Theurge and Cerebremancer. Approval is named, reasoned and scoped per pair, never a waiver of entry, same-class or two-prestige restrictions. Custom profiles expose the corresponding metadata and validate it. |
| Higher Hit Die, CON once, selected HP rules | Each compiled row has the larger effective die. Tests assert exact rolled/average/maximum totals, alternate Hit Dice, historical rolls and injuries. Racial HD precede pairs under the recorded interpretation; only the first actual die receives first-level treatment. |
| Better BAB and each save; multiclass/prestige handling without summing sides | `gestaltBonusLedger` compares rates before rounding, selects one contribution, and uses the saved printed-table convention or explicit fractional alternative. Tests cover all catalog progressions, ties, side swaps, prestige starts, fractional thirds/quarters, subsequent levels and BAB ceiling. The mixed-class tie convention is explicitly documented as interpretation. |
| Higher skill allowance, union of class skills, ranks/costs, INT and first-level multiplier | Compiler rows feed the existing skill ledger/classifier. Tests assert Ranger/Rogue union, one multiplier, exact costs, rank caps, historical INT, explicit class overrides and purchases. Browser Ranger/Rogue spends real points and reloads the resulting history. |
| Both classes' features; overlapping/nonstacking abilities; class-specific scaling | Both source summaries/milestones are retained. Supported mechanics use explicit source policies: shared sneak attack and Trap Sense ledgers; Monk/Psionic Fist advancement; Monk/Ninja AC; Evasion restrictions; Uncanny Dodge; distinct DR bypass sources; shared turning/rebuking; meldshaping. Tests distinguish ordinary multiclass from gestalt, delayed grants, replacement, focus/armor conditions and spent records. Exceptional source effects remain explicit manual/source-review controls, as before; names and milestone prose do not fabricate mechanics. |
| Independent spells, known/prepared lists, slots and caster levels | Wizard/Cleric browser and integration tests assert separate books/domain slots, ability scores, levels and expenditure; custom resource tests assert known tables, delayed casting and split abilities. Prestige targets are per earned level; overlapping grants to one tradition count once. |
| Psionics, invocations and other supported systems | Integration and custom-resource assertions preserve distinct manifesting levels, powers and spent points, with the published shared reserve. They verify invocation-grade/martial allowances, actual-HD initiator/capacity limits, separate meld lists/binds and resource summaries. Existing Magic and Combat interfaces consume these same records. |
| Actual level versus class levels; feats, ability increases and XP once | `characterHitDice` and paired history use one actual level per pair, plus separately supported racial HD. Fighter 5 // Wizard 5 is level 5 with BAB 5, saves 4/1/4, correct HP/skills and one ordinary advancement schedule. LA affects ECL/XP, not paired/class grants. Both UI and native records distinguish them. |

## Phase 3: creation and guided level-up

`qa-progression-acceptance.mjs` operates the real creation dialog: standard is
the default; choosing gestalt reveals both class selectors for each starting
level. It verifies the resulting fields, class levels, totals and exported state.

The paired level-up reuses the existing source/resource/history systems. The
integration tests inspect the full preview before mutation: selected classes,
one die/CON grant, BAB/saves/skills, both milestones, feat/ability choices,
casting/manifesting changes and other class allowances. The UI displays these
before confirmation. Browser flows exercise confirm, cancel, stale review,
changing either side, prerequisite rejection and round trip.

`qa-custom-prestige.mjs` additionally configures the real custom-table editor
for already earned standard and paired prestige levels. It checks required
targets, cancellation, stale-preview rejection, separate Wizard/Cleric grants,
later target selection, same-tradition cap and preserved old targets. The
synthetic class is a test configuration, not represented as a published class.

## Phase 4: compatibility and integrity

| Original requirement | Concrete evidence |
| --- | --- |
| Standard remains functional; no automatic gestalt conversion | Standard regression suites, real ordinary custom-prestige advancement, and old-data tests. Missing mode defaults to standard even when free text says "gestalt". |
| Old homebrew and level-up choices survive | Whole-record native/browser comparisons; explicit old options retained. First-import-autosave browser test holds pending class/HP choices while the first ID is assigned, confirms advancement, then reloads earlier training, injuries and spent slots unchanged. |
| Save/load/import/export both tracks | Native parse/prepare tests and fresh storage clients compare entire paired records. Named browser flows export, reload and compare both tracks. |
| Roll20 compatibility where feasible | Existing importer/exporter and migration regression suites remain in CI. No paired history is invented from Roll20 notes or aggregate class totals. Original exports are retained for source review; current saved advancement is not replaced by an old snapshot. |
| Custom, alternate and prestige content preserved | Custom table/proficiency/resource/target suites, browser editor/advancement checks, and alternate-feature/replacement regressions. Custom profiles are character-local; explicit manual pools and personal notes remain untouched. |
| Actual versus individual class levels visible | Saved paired-history table, class cards, actual-level field, and level-up summary; browser assertions check displayed values against exported records. |
| Mode switches cannot silently destroy data; safe old-data handling | Changing mode or racial history on an existing progression is atomically rejected. Existing single-class editing/reordering paths cannot corrupt paired history. Full automatic conversion is a future enhancement, not a silent partial conversion. The original objective requires safety, not a conversion wizard. |

## Phase 5: each named acceptance case

- New standard Fighter: `standard-rules-defaults.test.mjs` and browser matrix.
- Existing homebrew character: whole-record standard/native/browser checks.
- Fighter 5 // Wizard 5 level, BAB, saves, HP and skills: creation, progression,
  integration and browser assertions with explicit expected numbers.
- Ranger // Rogue skills/features: creation/integration and browser purchases.
- Wizard // Cleric independent casting: creation/integration and browser
  advancement with separate spent-slot/domain records.
- Multiclass changes on either side: progression/integration and browser
  successive changes, cancel and stale-review checks.
- Prestige entry/restrictions: pre-level prerequisite tests and independently
  qualified browser rejection cases; custom targets also exercised in-browser.
- Feats/ability increases not doubled: explicit creation/integration counts and
  actual-level browser assertions.
- Save/load retains both tracks: full native/browser comparisons in the flows.
- Standard regressions: complete CI suite, plus ordinary custom-prestige browser
  advancement and the existing first-import-autosave check.

## Scope and final gate

Ambiguous mixed progressions use the recorded interpretation or explicit,
persisted source/GM review. This includes mixed Uncanny Dodge and essentia,
unknown turning channels, and source exceptions. Unsupported custom mechanics
are not inferred from prose. Manual source-specific actions, conduct/atonement,
and a full reviewed mode/racial-history converter remain possible future work;
they must not be confused with missing named acceptance cases or silently
substituted for the original objective.

The final release must pass the full tests, TypeScript and Pages build; publish
the exact commit; then run the named progression matrix and custom-prestige
browser checks against its CI entry asset. Only after those external checks and
a review of this evidence may the original goal be marked complete.
