# Rules-as-written policy

## Standing user direction

Confirmed 2026-10-27: use published D&D 3.5 rules as written (RAW) wherever
applicable. This is an enduring repository requirement, not a temporary chat
preference. Read this document before changing calculations, class features,
imports, creation or advancement. Keep it and its links when reorganizing docs.

Standard D&D 3.5 is the baseline for new characters. Gestalt is an explicitly
selected Unearthed Arcana variant, not the default. Optional variants and house
rules remain available and clearly identified; they must not silently replace
the baseline or overwrite existing saved settings.

## Evidence and ambiguity

- Verify the applicable published rule and errata, using the original source or
  a faithful reproduction of its rules text. Link the specific rule in the
  implementation record. Existing code, tests, forum advice and remembered
  mechanics are not independent rules authority.
- Distinguish a stated source rule from an implementation interpretation, an
  optional published variant and an explicit table ruling. Never describe an
  unresolved interpretation as unambiguous RAW.
- Do not invent grants, silently approximate established mechanics or change a
  rule simply to make a test pass. If text is unavailable, request the relevant
  passage. If text genuinely leaves a consequential choice unresolved, document
  the evidence and obtain a table ruling or expose a clearly labeled choice.
- Test source-backed boundary cases, replacements, overlapping abilities and
  standard/gestalt differences. Source restrictions still apply when another
  class grants a similar ability.

## Recorded decisions

### Gestalt shared features

[Unearthed Arcana's gestalt rules](https://www.d20srd.org/srd/variant/classes/gestaltCharacters.htm)
say shared features, explicitly including Uncanny Dodge, advance at the faster
class's rate. Apply that governing rule to overlapping gestalt grants. Merely
receiving Uncanny Dodge on both sides must not automatically grant Improved
Uncanny Dodge early. This resolves the earlier pending duplicate-grant question.

Keep ordinary multiclass handling distinct: the
[barbarian](https://www.d20srd.org/srd/classes/barbarian.htm) and
[rogue](https://www.d20srd.org/srd/classes/rogue.htm) rules explicitly upgrade
Uncanny Dodge from a second class. Do not remove that ordinary rule while fixing
gestalt. Mixed/staggered gestalt progressions and scaling interactions still need
their own documented evidence or labeled interpretation; the general instruction
is not permission to invent detailed rules for them.

### BAB and saves

The user chose **printed-table progressions by default, fractional bonuses
optional**. Preserve that choice. The versioned mixed-class/tie policy in
[the implementation record](gestalt-implementation.md) is an implementation
interpretation of the better-progression rule, not a claim that Unearthed Arcana
specifies every rounding and tie case. Never double-count both sides.

### Compatibility is part of correctness

RAW defaults do not authorize rewriting existing characters. Preserve explicit
house-rule settings, later level-ups, allocated ranks, current damage, prepared
spells and spent resources. Corrections must be narrow, repeatable and tested
through save/load and import/export. Do not reset expenditure or reimport an old
snapshot over a player's newer progress. Unsupported or ambiguous data must be
visible for review rather than silently discarded.

## Continuing work

[The gestalt implementation record](gestalt-implementation.md) records verified
milestones and unfinished gates. Update it with the rules evidence, behavior,
tests and limitations of each mechanics change. Keep remaining gaps explicit;
passing a subset of tests does not establish completion of the full goal.
