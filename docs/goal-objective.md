# Codex Goal: Implement Gestalt Character Progression and Standard D&D 3.5e Default Rules

## Primary Objective

Expand the D&D 3.5e character sheet to support **gestalt character progression** as defined in *Unearthed Arcana*, while ensuring that all newly created characters default to standard D&D 3.5e rules rather than the developer's custom homebrew settings.

These systems must be modular, configurable, backward-compatible, and fully integrated with existing character creation, leveling, calculations, imports, exports, and character management.

**Important:** Inspect the existing architecture before making changes. Reuse current systems wherever feasible rather than creating competing implementations.

## Phase 1: Standard D&D 3.5e Defaults

Establish standard D&D 3.5e as the baseline for all newly created characters.

### Requirements

1. New characters must default to normal D&D 3.5e rules.
2. Disable all homebrew modifications by default for new characters.
3. Standard armor must provide AC rather than homebrew damage reduction.
4. Standard hit point generation must apply, including maximum hit points at first character level and normal advancement afterward.
5. Standard BAB, saves, skills, feats, XP progression, and class advancement must remain intact.
6. All existing homebrew systems must remain available through optional settings.
7. Existing characters must retain their saved configurations without unexpected changes.
8. Character calculations must respond correctly when optional settings are enabled or disabled.

### Rules Configuration

Implement or extend a configurable rules system that separates:

- Standard D&D 3.5e rules
- Individual homebrew modifications
- Character advancement mode (standard or gestalt)

Homebrew settings must be individually configurable rather than requiring one universal homebrew toggle.

Persist appropriate settings with characters and, if supported by the existing architecture, allow campaign-level defaults.

## Phase 2: Gestalt Character Advancement

Implement optional gestalt progression according to the D&D 3.5e *Unearthed Arcana* rules.

### Class Selection

- Each gestalt character level combines two classes.
- Support independent class selection at every character level.
- Allow either side of the gestalt combination to change classes at subsequent levels.
- Permit valid combinations of base classes and prestige classes.
- Enforce applicable gestalt prestige-class restrictions, including prohibiting two prestige classes at the same character level.
- Handle prohibited or potentially problematic dual-progression prestige classes according to the source rules, with appropriate GM override options where applicable.
- Prevent invalid same-class combinations under standard gestalt rules.

### Advancement Calculations

For each gestalt level:

**Hit Points**

- Use the higher Hit Die of the two selected classes.
- Apply Constitution adjustments once per character level.
- Honor standard or optionally configured HP rules.

**Base Attack Bonus**

- Apply the better BAB progression at each character level.
- Correctly calculate combinations involving multiclass advancement and prestige classes.
- Avoid stacking the BAB contributions of both classes.

**Saving Throws**

- Apply the better Fortitude, Reflex, and Will progressions.
- Ensure multiclass and prestige-class calculations follow gestalt rules correctly.
- Avoid duplicate bonuses from overlapping advancement.

**Skill Points**

- Use the higher skill-point allowance of the two classes.
- Combine both classes' class-skill lists.
- Calculate rank limits and skill-point expenditures correctly.
- Account for Intelligence modifiers and first-level skill-point multipliers.

**Class Features**

- Grant class features from both classes.
- Correctly handle overlapping, duplicate, and nonstacking abilities.
- Maintain individual class-level progression for scaling abilities.

**Spellcasting and Other Progression**

- Track each spellcasting class independently.
- Maintain separate spell slots, spells known, preparation, caster levels, and progression where appropriate.
- Preserve independent advancement of psionics, invocations, and other supported class resources.
- Integrate with the existing consolidated spellcasting and special-abilities interfaces.

### Character Level

A gestalt character's actual character level must equal the number of gestalt levels, not the sum of class levels on both sides.

Character-level benefits, including feats, ability-score increases, XP requirements, and level-dependent calculations, must use actual character level.

Class-specific abilities must use their applicable class progression.

## Phase 3: Character Creation and Level-Up Interface

Update the existing character creation and advancement UI.

### Character Creation

Provide an advancement mode selector:

- Standard D&D 3.5e (default)
- Gestalt D&D 3.5e

Gestalt mode should reveal two class-selection fields per character level.

### Level-Up

When advancing a gestalt character:

1. Prompt for the two classes applicable to the new character level.
2. Validate class and prestige-class prerequisites.
3. Calculate HP, BAB, saves, and skill points.
4. Offer applicable class features and character-level advancements.
5. Advance spellcasting and other class resources correctly.
6. Display a summary of all changes before finalizing the level.

Integrate this functionality into the existing level-up workflow rather than constructing an unrelated progression system.

## Phase 4: Compatibility and Data Integrity

- Ensure standard characters continue functioning exactly as expected.
- Do not automatically convert existing characters to gestalt.
- Preserve previously saved homebrew settings.
- Support saving, loading, importing, and exporting gestalt characters.
- Ensure existing Roll20-related functionality remains compatible where feasible.
- Preserve support for custom classes, alternative class features, prestige classes, and other existing content.
- Clearly distinguish actual character level from individual class levels in data structures and UI displays.
- Ensure switching advancement modes cannot silently destroy progression data.
- Provide safe migration handling for older character data.

## Phase 5: Testing and Validation

Implement automated tests for the new functionality.

At minimum, verify:

- A newly created standard Fighter uses vanilla D&D 3.5e settings.
- An existing homebrew character retains its original settings.
- Fighter 5 // Wizard 5 has five actual character levels.
- Fighter // Wizard calculates BAB, saves, HP, and skills correctly.
- Ranger // Rogue grants appropriate class skills and class features.
- Wizard // Cleric maintains independent spellcasting progressions.
- Multiclass gestalt combinations advance correctly across multiple levels.
- Prestige-class prerequisites and restrictions work correctly.
- Standard feats and ability-score increases are not granted twice.
- Saving and loading preserves both gestalt class tracks.
- Standard character behavior does not regress.

Use published D&D 3.5e / *Unearthed Arcana* gestalt rules as the authoritative mechanical reference. Keep optional variants and house rules clearly separated from baseline behavior.

## Completion Criteria

This goal is complete when:

1. Every fresh character defaults to standard D&D 3.5e rules.
2. Homebrew settings remain accessible but are not automatically enabled.
3. Users can create, level, save, and reload gestalt characters.
4. Gestalt calculations follow the correct rules.
5. Existing characters retain their data and configurations.
6. Automated tests pass without introducing regressions.
7. The UI clearly explains whether a character uses standard or gestalt advancement.

## Implementation Instructions

Work through the phases sequentially, inspecting and adapting the existing codebase.

Prioritize correctness, backward compatibility, and maintainability over speed.

Do not remove existing functionality to simplify implementation. Do not silently substitute approximate calculations for established rules.

Where the official rules are ambiguous or a particular class requires exceptional handling, implement an extensible mechanism and document the decision.

Run relevant tests after each major integration. Resolve failures before proceeding.

The ultimate objective is to make this character sheet suitable for **general-purpose D&D 3.5e use**, while preserving full support for customized campaigns and optional rules.