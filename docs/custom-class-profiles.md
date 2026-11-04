# Character-local custom class profiles

This supports saved basic, equipment, spellcasting and manifesting tables through
a reviewed editor. Exceptional class abilities still require source-specific support.
Follow [the RAW policy](rules-policy.md); a custom profile is an explicit source
configuration, never evidence that invented mechanics are published rules.

## Version 1 contract

`Character.customClasses` is optional and has no default. Existing manual custom
entries retain their entered statistics and notes unless the player explicitly
provides a matching profile. Native files and browser storage retain profiles
with that character, not in a mutable global class registry.

Each profile contains:

- `version: 1`.
- `definition`: a unique lowercase `custom-...` ID, name, kind (`Core`,
  `Supplemental` or `Prestige`), Hit Die, skill points, class-skill text,
  alignment, entry requirements, table headers, source citation, and consecutive
  levels beginning at 1. Optional description and book fields retain source text.
  Each level records level, BAB, Fortitude, Reflex, Will, special milestone text
  and extra text columns. Names do not confer the abilities of catalog classes.
- `policy`: an explicit class-family ID, combination-prestige flag and BAB/save
  progression profile. BAB is full/medium/poor; each save is good/poor. The whole
  supplied table must match that profile. Short tables therefore never need a
  guessed rate. Irregular tables require a separately implemented policy.

IDs cannot overwrite catalog definitions. Duplicate IDs, gaps, invalid dice,
inconsistent tables, unknown fields and unsupported versions fail validation;
they are not silently stripped or replaced with approximations. Missing tables
cannot cause a saved gestalt side to disappear. Temporary compiler metadata
cannot replace a saved custom policy.

## Connected behavior

The shared class lookup, totals, Hit Die/history, class-skill union and point
costs, milestone summaries, standard level-up and paired preview/confirmation
consume the saved definition. Gestalt keeps the larger die and skill allowance,
uses the existing printed/fractional policy, and retains independent catalog
and explicitly configured custom casting traditions. No custom table is added to fresh characters by default.

Custom prestige prerequisites require confirmation of the complete source text;
the catalog-specific prose parser must not certify a custom class after checking
only one recognizable clause. Changing the citation or requirements invalidates
the matching confirmation. Combination-class approval remains a separate,
per-level named GM decision; it cannot waive source prerequisites, same-family
restrictions or the two-prestige prohibition. Confirmation keys support up to
4,000 characters to retain the complete bounded custom requirement text.

## Reviewed editor

Classes contains a collapsed **Custom class tables** panel. Start a new table,
edit a saved profile, or define a table for an existing manual custom entry. The
draft does not change the sheet. Its initial values are an explicitly unverified
template; a name, source citation and source-review acknowledgment are required
before previewing. The editor generates ordinary BAB/save tables from selected
rates and preserves milestone text and extra columns when regenerating.

Review displays actual character level, BAB, base saves, current/maximum HP and
skill allowance before and after the proposed edit. Adding an unused profile
adds no class levels. Manual sheets remain manual. Applying never changes class
identity or advancement mode, and existing class-entry names and notes remain.
Existing custom summary cards are not rewritten by unrelated alternate-feature
synchronization; the class reference shows the updated source table. Explicit
Add / update class features remains a separate, player-requested action.

Confirmation revalidates against the current character and original reviewed
profile. Stale previews, changed profile identities, tables shorter than earned
levels, unsupported data and invalid pairings fail atomically. Shortening a table
cannot silently erase milestone or extra text. Recorded HP rolls are neither
clamped to smaller dice nor invented for missing historical rolls. Changes that
would rewrite existing level history, skill ranks, feature descriptions or spent
feature uses are blocked for separate review. Lower skill budgets display
overspending without deleting purchases. The normal sheet edit boundary performs
one recalculation, preserving damage and avoiding a second HP adjustment.

Custom families use the existing source-verified catalog variant families too:
for example, declaring a Rogue family cannot evade the Psychic Rogue restriction.
New conflicting edits/advancement are refused. Previously saved variant conflicts
remain readable with warnings; no class or earned level is silently removed.

## New-character setup

The new PC/NPC dialog reuses the same reviewed editor in a separate, in-memory
creation library. Apply a source-checked base-class table there, then choose it
as the standard starting class or in any gestalt starting row. Custom choices
are labeled and selected by ID, so a custom class named Wizard cannot acquire
the catalog Wizard's casting. An unfinished editor draft must be applied or
canceled before character creation; closing/reopening the dialog starts an empty
custom library. No existing player character is used as the draft holder.

Only explicit supplied profiles are copied into the created character. Tables
are validated and cloned, not installed in the global catalog or shared by
reference between characters. Standard rules remain the default; neither
gestalt nor optional HP settings are enabled by adding a custom table. Starting
HP/history uses the final class sequence. Catalog casting on another gestalt
side remains independent. Unsupported levels, invalid families, malformed
profiles and prestige starting classes are rejected before a sheet is saved.
Prestige entries still use guided advancement after their prerequisites exist.

## Casting identity safeguards

A saved casting/manifesting class link is authoritative, including an empty link
that leaves a pool unlinked. Unsupported links do not fall back to a familiar
display name or spell-list label. Their recorded levels, capacities, preparations,
notes and expenditure remain intact and editable; automatic-but-unsupported
profiles display a manual-handling notice. Older profiles with no linking metadata
retain their existing name/list recognition for compatibility.

Adding or advancing a catalog class matches existing pools by resolved class
identity, not display name. A different custom pool with the same name cannot
suppress the proper resource; a domain pool is not an ordinary cleric spellbook.
Renaming a correctly linked pool cannot create duplicates. Axe Brother selection,
save-DC ability selection and typed casting prerequisites use the same identity
boundary. No automatic relinking or resource reset is performed. This prevents
future overwrites; it cannot reconstruct values already lost in an older save.

Custom spellcasting and manifesting now use the explicit source tables described
below. A matching custom display name never resolves an unknown saved class ID.

## Explicit remaining work

Exceptional caster-level formulas, restricted/specialist slot grants, conditional
prestige grants and automatic learning of an entire custom spell list remain
manual. Explicit existing-tradition prestige schedules are supported below. Unknown fields still fail validation. Manual spell/power
profiles, custom features and counters remain available separately.
Bonus feats, conditional powers and shared-feature mechanics are not inferred
from milestone prose. Equipment training uses only the explicit configuration
below. The Classes view explains these limits.
Browser interaction and visual verification of this editor remain outstanding
while local browser access is disabled. Automated transaction and persistence
tests are not a substitute for that UI check.

The overall gestalt goal also retains its independent variant, shared-feature,
reviewed mode-conversion and end-to-end verification gates. See
[the implementation record](gestalt-implementation.md).

## Explicit equipment training

Version 1 accepts an optional `definition.proficiencies` object; it has no
default and no existing profile is changed automatically. The reviewed editor,
including the new-character draft, supports:

- Simple and martial weapon groups, each independently all or melee-only.
- Exact catalog weapon choices, including individual exotic weapons.
- Cumulative light/medium/heavy armor groups and exact individual armor choices.
- Bucklers only, bucklers/light shields, standard shields excluding tower
  shields, or all shields including tower shields.
- An optional class-level threshold for gaining medium armor from a lower
  initial group. It uses this class's own levels, never doubled gestalt levels.

Selecting none is an explicit absence of that class grant, not a removal of
another class, feat or racial benefit. The existing proficiency resolver combines
independent sources in standard and gestalt modes. Manual weapon and gear
overrides take precedence. No equipment, feat, class level or resource is added.
An unused table confers no training, even if named after a catalog class.

Draft review describes old/new class training and changed proficiency for recorded
items before applying. Stale or malformed changes are rejected. Equipment flags,
notes, skill purchases, current injuries and expenditure remain intact. Only
nonproficiency penalties change; ordinary armor skill penalties, spell failure,
movement restrictions and other class restrictions still apply.

Item-specific choices must use existing catalog names. Unknown items, conditional
training and progression other than the supported medium-armor threshold require
manual handling; they are not guessed from prose. Invalid groups, duplicate or
unknown item names, contradictory restrictions and unsupported fields fail
validation. Removing the configuration is an explicitly reviewed change.


## Explicit spell and power tables (2026-11-02)

Optional `definition.casting` uses the existing caster contract: eligibility
`ability`, optional `bonusAbility` and `dcAbility`, prepared/spontaneous `mode`,
arcane/divine `type`, spell `list`, explicit `startLevel`, and `halfLevel`.
Caster level is zero before the start, then full progression or half progression
rounded down. These are configurable formulas, not claims about an unspecified
custom class. Each level must include ten `slots` values for spell levels 0–9:
`null` means unavailable, while `0` permits ability bonus slots only. Before the
start level all slots must be null. Optional ten-column `spellsKnown` allowances
must be supplied for every row or omitted entirely; they do not add or delete
spell choices. Unlimited spellbooks/list access require source-based manual
spell selection rather than an invented finite known allowance.

Optional `definition.manifesting` specifies `ability`, `startLevel`,
`levelOffset` and fixed `bonusPoints`. Every row must supply `powerPoints`,
`powersKnown` and `powerLevel` (0–9). These are zero before the declared start.
After that, manifester level is progression plus offset, bounded below by zero.
The existing lasting-ability bonus-point calculation applies, along with any
existing source-specific restrictions. Known-power allowances are displayed;
powers and personal notes are never deleted to enforce a limit.

The editor exposes each row and requires the existing complete-source review.
Generating new BAB/save rows preserves resource data, and extending a table adds
empty resource rows that must be source-checked. Shortening cannot erase recorded
resource tables. Incomplete paired metadata/tables and unknown fields fail
validation. A custom progression beyond its supplied table preserves recorded
capacities and displays a warning; guided advancement and automatic casting or
manifesting are blocked until the missing row is supplied or the player explicitly
chooses manual handling. The last available row is never silently substituted.

Creation and ordinary/paired advancement initialize traditions once by exact
class ID, including delayed access. All subsequent progression uses the existing
caster/manifesting engine and authoritative gestalt history. Catalog prestige
classes can target eligible custom traditions, with the existing one-grant-per-
pair rule. Custom prestige prose cannot itself grant another class progression.
Typed spell prerequisites, split save abilities and divine arcane-failure exemption
resolve the saved custom definition. A custom name cannot borrow catalog powers.

Review shows old/new rules and changes to existing caster/manifester levels,
capacities and known allowances. Adding metadata to an earned class can create a
new tradition; linked manual traditions remain manual. Existing tradition names,
abilities, mode, list, adjustments, spell/power choices, preparations, notes, focus
and expenditure are protected. Source metadata defaults apply to new traditions;
existing player-selected settings remain and are explained in the editor. Removing
a table retains its pool for manual handling. Spent counts may exceed a reduced
allowance; they are not reset or clamped.

Before new traditions change target ambiguity, existing automatic prestige choices
are recorded using the old character, both for standard class-wide choices and
per-level gestalt targets. Reviewed edits reject stale character/profile state.
Native exports and fresh browser-storage clients retain all tables and resources.
No profile is installed globally and no legacy sheet acquires metadata by default.

Rules references: [UA gestalt](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
requires separate daily spells for separate classes; [ability bonus spells](https://www.d20srd.org/srd/theBasics.htm#abilityScores)
use class spell access; [psionic classes](https://www.d20srd.org/srd/psionic/classes/index.htm)
combine power-point reserves while retaining each tradition's manifester level.
The [psion](https://www.d20srd.org/srd/psionic/classes/psion.htm) supplies separate
base points, powers known, maximum power level and ability requirements. Custom
source-specific grants require the player's complete source; synthetic regression
profiles are configuration tests, not additional published classes.


## Explicit prestige advancement (2026-11-02)

A prestige definition may supply `advances: {spell, divine, psi}`. `spell` is
`none`, `arcane`, or `any`; `divine` and `psi` enable separate existing divine
and manifesting targets. Every table row must then supply boolean grants for all
three keys. True grants one progression level; false grants none. Separate
schedules are independent, including missed caster levels. An unrestricted
`any` spell target cannot be combined with a second divine target, because those
candidate sets overlap; such a source needs a separate policy. Unknown fields,
non-prestige definitions, missing rows and unconfigured grants fail validation.

Advancing multiple traditions, or combining a separate own-class resource table
with existing-tradition advancement, requires `combinationPrestige: true`. This
retains the named GM approval for every gestalt pair, including rows without a
casting grant. Other combination classes still need the source-reviewed policy
flag. Approval never waives source entry requirements, same-family restrictions,
or the prohibition on two prestige classes in one pair.

The existing target resolver and progression engine consume these grants. Targets
are other supported spellcasting/manifesting classes held before prestige entry,
using the saved level sequence; a manually added pool with no matching class
history is insufficient. New classes gained alongside or after entry are not
eligible. The generic existing-class clause does not invent an additional minimum
caster-level requirement for the selected class: complete source prerequisites
still require review. Source-specific exceptions and conditional target restrictions
remain manual. Domain pools follow the primary cleric and cannot be selected
as a separate ordinary class progression.

Paired level-up stores targets in the existing `castingTargets` records. Ordinary
custom-prestige advancement uses optional `ClassLevel.castingAdvances`, with
`{level, kind, traditionId}` records using the same target schema. The existing
standard workflow prompts for each granted type, including an explicit No
advancement choice. These records override class-wide settings only at their
recorded levels; legacy class-wide targets retain their previous meaning.
Existing standard catalog advancement is not automatically migrated. Inactive
paired data on a standard sheet cannot constrain its choices.

Recalculation uses each selected level's grant. One level can advance Wizard and
a later level Sorcerer without redirecting the first. Simultaneous base/prestige
advancement of the same gestalt tradition still counts only the better side.
Slots, known allowances and caster/manifester levels advance; unrelated class
features, familiar abilities, bonus feats and other class resources do not.
Manual pool settings remain manual. Standard level-up now constructs its edit
atomically, so an invalid target or unsupported resource table cannot leave a
partly incremented class.

The existing class editor exposes target types and every row's grants. For earned
custom prestige levels, it requires review of each applicable historical target
and displays changed resource totals. Missing/ambiguous targets require a choice;
sole eligible targets are shown in the review. Stale source, profile or target
selections fail before applying. Removing a grant retains its recorded target;
missing/ineligible pools are not silently replaced. No history metadata is added
on ordinary load. Invalid or missing choices produce calculation notices.

Preparations, powers, notes, focus, HP damage, skill purchases and expenditure
remain protected by the same review and persistence boundaries. Standard and
paired targets survive native exports and fresh browser-storage clients.
Interactive browser acceptance of these controls remains outstanding.

Authoritative examples of this contract are the SRD
[Loremaster](https://www.d20srd.org/srd/prestigeClasses/loremaster.htm),
[Mystic Theurge](https://www.d20srd.org/srd/prestigeClasses/mysticTheurge.htm), and
[Cerebremancer](https://www.d20srd.org/srd/psionic/prestigeClasses/cerebremancer.htm).
They describe existing classes, individual level choices, resource progression,
and exclusion of other class benefits. The
[UA gestalt restrictions](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
remain in effect. Synthetic test profiles exercise the configurable contract;
they are not new published classes or blanket approval of a source's exceptions.
