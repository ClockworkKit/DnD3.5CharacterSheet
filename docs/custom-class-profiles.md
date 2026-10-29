# Character-local custom class profiles

This is the saved-table foundation, not a complete custom-class authoring UI.
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

## Explicit remaining work

The profile editor, reviewed profile updates, starting-character selection and
custom casting/manifesting metadata are unfinished. Version 1 rejects casting
fields rather than discarding them or promising unsupported automation. Manual
spell/power profiles, custom features and counters remain available separately.
Proficiencies, bonus feats, conditional powers and shared-feature mechanics are
not inferred from milestone prose. The Classes view explains these limits.

The overall gestalt goal also retains its independent variant, shared-feature,
reviewed mode-conversion and end-to-end verification gates. See
[the implementation record](gestalt-implementation.md).
