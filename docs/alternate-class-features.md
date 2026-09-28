# Alternate class features

Manage replacements in **Classes → Alternate class features** on PC and NPC sheets. Search by feature, class, surrendered feature, or option. Filter to your classes, all classes, selected choices, or reference collections.

## Source coverage

The catalog accounts for all **322 entries indexed under Alternative Class Features on 66 Ultimate SRD base-class pages**, audited September 27, 2026. Twenty additional cards expose independent level-specific learning trades and individual Skilled City-Dweller swaps. The interface therefore contains **342 cards: 305 replacement choices, 22 optional rules, and 15 reference collections**. The eight indexed base classes not implemented by the sheet have no ACF entries.

This is complete coverage of that index, not a claim that every published D&D 3.5 variant or every effect has been automated. Racial substitution levels, variant classes outside the index, and rules absent from Ultimate SRD are outside this catalog. The original six supported options retain their existing IDs, calculations, and expenditure.

Reference collections are visible with direct source links but cannot be selected as a single ability. They include companions, familiars, special mounts, natural-born racial packages, improved domain powers, peripheral beliefs, gnome paladin, criminal specialists, rogue special abilities, elemental mantles, substitute powers, and psicrystal enhancements. Their individual choices require manual recording; selecting a heading must not grant an entire collection.

## Choices and replacement rules

- Each selectable record identifies its class, minimum level, original features surrendered, and any choice of replacement level, domain slot, skill, or named option.
- Overlapping trades are rejected in both selection and persisted-data validation. A fighter cannot trade a Dungeon Crasher bonus-feat slot again. Wild-shape and domain packages overlap their individual components. Replacing a feature from one class normally preserves another class's contribution.
- Choose an option when the surrendered feature is gained. The sheet verifies current class level and modeled skill prerequisites; it does not reconstruct whether a historical choice was legal. New options require confirmation that the linked source's race, alignment, ability, feat, school, deity, and campaign conditions have been checked. Those conditions are not all machine-validated.
- Below the required class level, selections become inactive without losing settings or spent uses. Removing a selection restores the ordinary feature. Re-selecting does not refill its resources.
- Settings hold the selected level/option, rule notes, applicable context toggle, bonus-feat/weapon/stunt choices, historical style qualification, ability timers, and up to twelve custom use trackers. Old sheets gain empty settings automatically. Imports reject unknown feature IDs, duplicate selections, conflicting trades, invalid option values, and malformed trackers. Legacy free-text monk/ranger styles remain loadable, but must be changed to a recognized style to receive its grants.
- Generated class summaries omit matched surrendered milestones. Generated ACF cards display the saved option and notes. User-authored feature cards, spell choices, feat choices, and personal notes are preserved.

## Calculation coverage

Automatic calculations must be enabled for calculated bonuses. Custom entries and manual numeric overrides remain under the player's control.

| Area | Implemented behavior |
| --- | --- |
| Original paladin/cleric options | Charging Smite conditional damage; Divine Spirit daily pools; Divine Counterspell checks and shared pool; Curse Breaker weekly pool; Detect Undead replacement |
| Feature losses | Modeled turning, divine grace, smite, rage, wild shape, wholeness of body, flurry, fast movement, ranger style, scout skirmish, swashbuckler grace/dodge, and matching supplemental resource losses |
| Bonus-feat trades | Fighter, wizard, psion, and psychic-warrior budgets deduct the actual selected replacement levels; already recorded feats are retained for player review |
| Casting trades | Removing class spellcasting zeros its progression/slots and blocks casting from that class, including manual profiles; other traditions remain intact; spell selections and expenditure are preserved |
| Specific casting changes | Cleric domain-slot removal and Pool of Healing slot cost; sorcerer Domain Access, Poltergeists, and Stalwart known-spell reductions; Blood of Siberys casting threshold/bonus spells; Trickster Spellthief bard slots/known spells and full caster level |
| Class statistics | Golarion Cleric full BAB and d10 HD; Stalwart Sorcerer extra HP; Golarion Fighter and Trickster skill-point bases; corresponding class-skill changes; Skilled City-Dweller swaps; sorcerer bloodline skill lists |
| Rage variants | Whirling Frenzy and Ferocity replace ordinary rage modifiers while the Rage effect is active, sharing retained expenditure. Whirling Frenzy's extra attack and attack penalty have an explicit toggle |
| Conditional bonuses | Eagle/Fox/Wolf spiritual totems, Devil's Luck, hit-and-run initiative/damage, underground Underdark Knight movement/skills, cleric No Turning skills, and Smiting Arrow's 30-foot limit |
| Equipment | Removed class armor/shield/weapon training; hit-and-run's cross-class restrictions; dragonscale husk armor-proficiency loss; six regional druid lists and three alternate monk lists, including their special monk weapons |
| Resources | Existing original pools, alternate rage/wild shape, Underdark Knight spell-like pools, Immediate Magic, Metamagic Specialist, and user-configured trackers |

## Granted choices and ability actions

The source-derived selectors expose 23 monk fighting styles, five ranger combat styles, and fourteen cleric No Turning paths. Monk/ranger style feats are granted at their class-level milestones. Ranger style grants stop providing benefits in medium/heavy armor. Monk sixth-level benefits require a separate confirmation that prerequisites were met **when level 6 was gained**; changing the style clears that confirmation.

Stalwart Sorcerer grants martial weapon proficiency and Weapon Focus for the selected melee weapon. City Brawler grants Improved Unarmed Strike; Scribe and Wanderer grant Scribe Scroll and Endurance. Holy Warrior, Champion of the Wild, and Soulknife Bonus Feats expose level-specific slots with allowed-list and prerequisite checks for feats in the existing library. Other source feats still need manual recording. Source-granted feats have separate ownership from generated daily counters and user-entered feats.

Supported abilities now have controls for formula/DC, pool cost, uses remaining, duration, and recharge. Pools include variable healing-point expenditure, existing ninja Ki, shared Immediate Magic and Arcane Stunt uses, and Destroy Undead (including turning prerequisite eligibility). Destroy Undead inherits spent turning uses when first selected; a multiclass paladin's remaining turning pool is tracked separately. Counter corrections remain available. A failed roll post does not spend a use. Round advancement ages all effects; rest clears action timers and daily expenditure. Target saves, eligibility, action economy, range, and effects on other creatures still require table resolution.

| Area | Added automatic behavior |
| --- | --- |
| Fighter actions | Dungeon Crasher collision damage; Armor of God AC/Will trade; Resolute BAB/Will trade including attacks, grapple, and iterative count; Elusive Attack dodge AC; Overpowering Attack damage multiplication; heavy-armor Fortification check; elemental warrior SLA uses/formulas |
| Monk actions | Decisive Strike routine, attack penalty and damage multiplication; Invisible Fist invisibility attack bonus/recharge and blink duration; Draconic Fist damage, Soulwarp Strike DC/uses, Wholeness of Others healing pool, qualified Franciscan Friar SLA uses |
| Other actions | Spell Reflection, spirit-world vision, Lion roar, Lore Song, cleric path abilities, Blasphemous Incantation, Destroy Undead, Pool of Healing, Gaze of Truth, Stand Fast, Sword of Celestia, Immediate Magic, ninja Ki alternatives, Flamewreath, drow-warlock poison, Adrenaline Boost, Shield of Blades, Arcane Stunt |
| Passive calculations | Berserker Strength HP-triggered Strength/saves/AC/DR; Bardic Knack effective ranks; Mystic's moving bonus slot; Bear manifestation HP and Eagle progression; cleric path skills/class skills; Trap Expert class skill |
| Style benefits | Style skill bonuses, Cobra Strike dodge, Denying Stance grapple, Wee Jas UMD, Wushu feint, Kyokushinkai HP, Undying Way DR, Heironeous/Hextor special monk weapons |

Temporary bonuses respect bonus types; damage multipliers combine additively and leave extra damage dice unmultiplied. Decisive Strike's own-turn routine requires a special monk weapon or unarmed strike; subsequent damage doubles until the effect ends. Use End ability at the source's turn boundary or after a one-use benefit such as Glimpse Peril. Only the listed numeric effects are calculated; an action card may automate its resources/formula while describing the remaining resolution.

## Manual setup and remaining work

A catalog entry is not a complete rules simulator. For options without calculation support, record the selected benefit, limits, and prerequisites in rule notes, then configure Effects or the relevant sheet tab. In particular:

- Add granted or substituted feats and weapon choices not covered above, plus spells, powers, domains, maneuvers, companions, and familiars manually. Trading a bonus-feat slot changes the budget; it does not delete a feat the user entered.
- Resolve collision/attack outcomes, immediate-action timing, special spell effects, positioning, target conditions, saving throws, ally effects, and DM adjudication at the table. Timers do not enforce action economy or automatically apply effects to other sheets.
- Focused Specialist's school-restricted slots, unmodeled granted feat effects and monk sixth-level benefits, dragonscale husk defenses/resistances, many transformation statistics, and optional dead-level benefits are not automatically applied. Reference collections have no individual selector yet.
- Trickster Spellthief uses bard progression automatically; choose its expanded spells manually. Golarion Cleric's favored-weapon proficiency is manual.
- With automatic calculations disabled, values remain manual; the established turning-resource cleanup still applies. Review existing Effects and custom cards after a trade so manually entered benefits do not remain in use accidentally.
- A class-skill or skill-budget change may make existing purchases invalid. The history ledger retains ranks and reports inconsistencies instead of deleting character data.

Daily rest resets daily ACF pools and daily custom trackers. Weekly, encounter, and manual trackers retain expenditure until separately reset. Inactive selections retain their custom trackers and notes. Posting an ability roll must succeed before its use is spent; expenditure fields allow corrections.

## Catalog maintenance

`scripts/data/alternate-feature-rules.json` contains reviewed mechanical metadata. `scripts/data/alternate-feature-coverage.json` records all 66 source pages, including pages with zero ACFs. `lib/alternate-feature-data.json` is generated from the curated records. Source prose is not copied into the distributed catalog.

Cache the source pages using filenames with URL slashes replaced by underscores, then run:

```sh
python scripts/import-ultimate-alternate-features.py --cache /path/to/ultimate-srd-cache --check
```

The importer verifies every indexed entry, cross-page anchor, source URL, name, class mapping, and page count. It fails on unmapped entries, removed entries, missing pages, or output drift. Run without `--check` to regenerate after updating the reviewed rules. Keep stable IDs; add focused calculation tests for new automation.

`tests/alternate-feature-catalog.test.mjs` exercises every selectable card through schema validation, JSON persistence, and repeated calculation, plus exact-slot conflicts, restoration, multiclass behavior, conditional bonuses, custom recovery periods, and casting changes.

`tests/alternate-rules.test.mjs` covers grants, feat prerequisites, armor gates, historical qualification, shared pools, overdraw, action expiry, damage multiplication, BAB/save trades, legacy style loading, and new passive calculations.
