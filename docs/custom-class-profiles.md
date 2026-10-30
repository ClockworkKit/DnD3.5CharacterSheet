# Character-local custom class profiles

This supports saved basic tables and a reviewed editor, not complete custom-class
automation.
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
casting traditions. No custom table is added to fresh characters by default.

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

These safeguards do not implement custom casting or manifesting tables. Their
source rules still need explicit supported metadata and reviewed integration.

## Explicit remaining work

Custom casting/manifesting metadata remains unfinished. Version 1 rejects casting
fields rather than discarding them or promising unsupported automation. Manual
spell/power profiles, custom features and counters remain available separately.
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
