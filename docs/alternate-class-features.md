# Alternate class features

Manage supported replacements in **Classes → Alternate class features** on PC and NPC sheets. Choose an option when its original feature is gained; later changes are character edits that need the DM's agreement.

The initial catalog contains paladin Charging Smite, Divine Spirit, Detect Undead, Divine Counterspell and Curse Breaker, plus cleric Divine Counterspell. Rules references link to the [Ultimate SRD paladin page](https://srd.dndtools.org/srd/classes/baseCore/paladin.html). This is an initial subset, not the complete alternate-feature, variant-class or substitution-level catalog.

## Replacement model

- Each definition identifies its class, minimum level, selection requirements and original features replaced. Two choices cannot spend the same original feature from the same class. Conflicts are rejected by both the selector and persisted-data schema.
- Selections live separately from feature descriptions. Old sheets default to no selections. Generated class summaries omit replaced milestones, while unrelated custom notes remain intact.
- Lowering a class below the required level suspends its choice without deleting it or its spent uses. Removing a choice restores the standard feature. Removing and reselecting does not refill resources.
- Turning calculations and feat eligibility account for which class supplied turning. Replacing paladin turning preserves cleric turning and vice versa. Selecting both versions of Divine Counterspell does not duplicate its daily pool.
- Skill prerequisites are checked when selecting a choice. They are not continuously revoked by subsequent rank edits.

## Automation and limits

Charging Smite contributes to damage with automatic calculations enabled and the charge, smite and evil-target context selected for a melee weapon. Mark ordinary smite uses manually after resolving the hit; a missed charging smite does not spend a use.

Divine Counterspell provides a check roll and consumes an attempt when that roll is posted successfully. Resolve the opposing spell at the table. Divine Spirit tracks each unlocked summon independently; positioning, durations, healing allocations and effects on allies remain table-managed.

Curse Breaker tracks a shared weekly resource. Daily rest restores daily ACF resources but preserves weekly expenditure. **Reset weekly uses** restores Curse Breaker separately. Editable expenditure fields allow corrections.

Generated ACF cards in Feats are read-only references; Classes owns their tracked resources. Manual custom cards and imported prose are not interpreted as supported replacements. Full class-library tables remain the standard reference tables.

## Extending the catalog

Add a stable ID and definition in `lib/alternate-feature-schema.ts`. Use stable original-feature keys, scoped by class. Implement affected calculations and resource behavior in `lib/alternate-features.ts` and the relevant calculation module, and cover replacement conflicts, restoration, multiclass interactions, expenditure and round-trip persistence in tests. Adding a description alone does not automate a new option.
