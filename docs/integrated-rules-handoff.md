# Integrated trait and class rules

The source-reference panels added previously did not replace the actual trait placeholders. This correction uses the reviewed Kenku, Illumian, Aquatic Kobold and Mountain Dwarf rules in the race catalog itself, so both Race and race-library previews show those rules directly. Racial feature cards copy the same text.

Factotum, Rogue, Sorcerer, Cleric and Bard class feature cards now include their bundled rules alongside the level milestones. The rules heading distinguishes the full class rules from abilities available at the current level or after alternate-feature trades. Generated class/race cards display readable paragraphs in Feats; their descriptions remain editable.

Opening an existing PC/NPC replaces recognized generated racial text or enriches an existing generated class card. Custom text, counters, statistics and notes are preserved; repeated updates are idempotent. Descriptions already too close to the 20,000-character save limit are left intact, with rules still available on Race and in the source panel. Monster records are unchanged. This correction does not add new automatic combat modifiers or attacks. Lirael's specific elf ancestry is still unconfirmed.

Validation: the full suite passed 313 tests before the final description-length guard; all five focused integration tests pass with that guard. TypeScript and changed-file lint pass. Pages and production builds are checked separately. Browser verification confirms the Kenku trait list, saved racial card, Factotum class card, save/reload and no console errors. GitHub CI runs the full final suite on the pull request.
