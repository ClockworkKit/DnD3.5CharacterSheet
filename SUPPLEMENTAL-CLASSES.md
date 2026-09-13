# Supplemental class support

This expansion adds 34 base classes, bringing the catalog to 50 base classes and 24 prestige classes. Factotum retains its existing dedicated automation.

All additions have levels 1–20, base attack and saves, Hit Dice and HP progression, class-skill training, ordinary weapon/armor proficiencies, feature milestones, and source links. They work with character creation, multiclassing, XP level-up, browser saves, export/import, and existing roll cards. Alignment, prerequisites, codes of conduct, and feature choices require player/DM review.

## Included classes

| Class | Book | Spell/power automation |
| --- | --- | --- |
| [Archivist](https://dndtools.net/classes/archivist/) | Heroes of Horror, p. 82 | INT prepared divine spell slots |
| [Ardent](https://dndtools.net/classes/ardent/) | Complete Psionic, p. 5 | WIS power points and manifester level |
| [Artificer](https://dndtools.net/classes/artificer/) | Eberron Campaign Setting, p. 29 | See automation audit below |
| [Beguiler](https://dndtools.net/classes/beguiler/) | Player's Handbook II, p. 6 | INT spontaneous arcane spell slots |
| [Binder](https://dndtools.net/classes/binder/) | Tome of Magic, p. 9 | See automation audit below |
| [Crusader](https://dndtools.net/classes/crusader/) | Tome of Battle: The Book of Nine Swords, p. 8 | See automation audit below |
| [Divine Mind](https://dndtools.net/classes/divine-mind/) | Complete Psionic, p. 9 | WIS power points and manifester level |
| [Dragon Shaman](https://dndtools.net/classes/dragon-shaman/) | Player's Handbook II, p. 11 | See automation audit below |
| [Dragonfire Adept](https://dndtools.net/classes/dragonfire-adept/) | Dragon Magic, p. 24 | See automation audit below |
| [Dread Necromancer](https://dndtools.net/classes/dread-necromancer/) | Heroes of Horror, p. 84 | CHA spontaneous arcane spell slots |
| [Duskblade](https://dndtools.net/classes/duskblade/) | Player's Handbook II, p. 19 | INT spontaneous arcane spell slots |
| [Favored Soul](https://dndtools.net/classes/favored-soul/) | Complete Divine, p. 6 | CHA spontaneous divine spell slots |
| [Healer](https://dndtools.net/classes/healer/) | Miniatures Handbook, p. 8 | WIS prepared divine spell slots |
| [Hexblade](https://dndtools.net/classes/hexblade/) | Complete Warrior, p. 5 | CHA spontaneous arcane spell slots |
| [Incarnate](https://dndtools.net/classes/incarnate/) | Magic of Incarnum, p. 20 | See automation audit below |
| [Knight](https://dndtools.net/classes/knight/) | Player's Handbook II, p. 24 | See automation audit below |
| [Lurk](https://dndtools.net/classes/lurk/) | Complete Psionic, p. 13 | INT power points and manifester level |
| [Marshal](https://dndtools.net/classes/marshal/) | Miniatures Handbook, p. 11 | See automation audit below |
| [Ninja](https://dndtools.net/classes/ninja/) | Complete Adventurer, p. 5 | See automation audit below |
| [Samurai](https://dndtools.net/classes/samurai/) | Complete Warrior, p. 8 | See automation audit below |
| [Scout](https://dndtools.net/classes/scout/) | Complete Adventurer, p. 10 | See automation audit below |
| [Shadowcaster](https://dndtools.net/classes/shadowcaster/) | Tome of Magic, p. 111 | See automation audit below |
| [Shugenja](https://dndtools.net/classes/shugenja/) | Complete Divine, p. 10 | CHA spontaneous divine spell slots |
| [Soulborn](https://dndtools.net/classes/soulborn/) | Magic of Incarnum, p. 25 | See automation audit below |
| [Spellthief](https://dndtools.net/classes/spellthief/) | Complete Adventurer, p. 13 | CHA spontaneous arcane spell slots |
| [Spirit Shaman](https://dndtools.net/classes/spirit-shaman/) | Complete Divine, p. 14 | WIS spontaneous divine spell slots |
| [Swashbuckler](https://dndtools.net/classes/swashbuckler/) | Complete Warrior, p. 11 | See automation audit below |
| [Swordsage](https://dndtools.net/classes/swordsage/) | Tome of Battle: The Book of Nine Swords, p. 15 | See automation audit below |
| [Totemist](https://dndtools.net/classes/totemist/) | Magic of Incarnum, p. 29 | See automation audit below |
| [Truenamer](https://dndtools.net/classes/truenamer/) | Tome of Magic, p. 198 | See automation audit below |
| [Warblade](https://dndtools.net/classes/warblade/) | Tome of Battle: The Book of Nine Swords, p. 20 | See automation audit below |
| [Warlock](https://dndtools.net/classes/warlock/) | Complete Arcane, p. 5 | See automation audit below |
| [Warmage](https://dndtools.net/classes/warmage/) | Complete Arcane, p. 10 | CHA spontaneous arcane spell slots |
| [Wu Jen](https://dndtools.net/classes/wu-jen/) | Complete Arcane, p. 14 | INT prepared arcane spell slots |

## Casting and psionics

- Archivist uses Intelligence for casting eligibility and DCs, Wisdom for bonus slots, and the Cleric library as a starting point. Other learned divine spells require manual entry.
- Favored Soul uses Charisma for casting eligibility and bonus slots, Wisdom for DCs.
- Spirit Shaman uses Wisdom for casting eligibility and bonus slots, Charisma for DCs. Its spontaneous slot pool represents casting retrieved spells; record daily retrieval choices yourself.
- Hexblade and Spellthief gain their own spells at level 4 with half-class caster level. An unavailable spell level remains unavailable; a zero base allotment can receive ability bonus slots. Stolen Spellthief spells need separate tracking.
- Dread Necromancer has no cantrip slots. Duskblade slots stop at spell level 5.
- Divine Mind includes the two Wild Talent power points and uses class level minus four for manifester level and ability bonus points. Ardent power eligibility follows its current manifester level. Lurk uses Intelligence.
- The spell menu now includes indexed supplemental lists (coverage below). Favored Soul, Hexblade, Spellthief, and Spirit Shaman have known/retrieved-spell count warnings. These are counts, not enforced school, element, order, or mantle choices. Advanced learning and additional divine spells learned by Archivists remain explicit selections.

## Automation audit

The existing catalog contains 50 base classes and 24 prestige classes. This pass covers the 34 supplemental additions; it preserves the core/SRD progression, existing prestige advancement, and dedicated Factotum support. Every supplemental class already had BAB, saves, Hit Dice, skill points, class skills, proficiencies, milestones, and applicable slots or power points. The table below identifies the added support and the remaining work, so “supported” does not imply that every feature is fully automated.

| Class | Added automation / controls | Still requires a choice or adjudication |
| --- | --- | --- |
| Archivist | Scribe Scroll; Dark Knowledge daily counter; Cleric list alias | Prayerbook learning from other divine lists, Dark Knowledge check/outcome |
| Ardent | Existing WIS power-point progression retained | Mantles, granted abilities, individual powers and mantle eligibility |
| Artificer | Granted crafting feats; INT infusion use limits; craft reserve by class level | Infusion selection/effects, item prerequisites, crafting cost/time, retain essence |
| Beguiler | Fixed-list learning button; Silent/Still Spell grants; armored casting | Advanced learning, cloaked casting conditions, surprise casting |
| Binder | Vestige level and simultaneous-binding limits; selections | Binding check, pact outcome, influence, granted abilities and five-round reuse |
| Crusader | Maneuver/stance counts, initiator level, ready/granted/expended state; delayed damage settlement; Furious Counterstrike; Indomitable Soul; smite and Zealous Surge counters | Random grants and recovery timing, maneuvers, smite target/effect, mettle |
| Divine Mind | Existing WIS power points/manifester progression retained | Mantles, psychic auras, aura switching and ranges |
| Dragon Shaman | Breath damage/DC/recharge roll; aura count; Touch of Vitality healing-point pool | Totem, aura choice/effect, breath energy/shape, immunity and condition removal |
| Dragonfire Adept | Breath damage/DC; invocation count/equivalent-level ceiling | Breath effects, invocation grades/prerequisites, scales, immunities and resistances |
| Dread Necromancer | Fixed-list learning; rebuking and listed daily counters; armored casting | Charnel touch, fear aura, familiar, advanced learning, undead control and transformation |
| Duskblade | Combat Casting; quick-cast counter; spell list; evolving armor/shield casting exceptions | Arcane channeling, spell power conditions, spells-known selections |
| Favored Soul | Cleric list alias and spells-known counts | Deity weapon feats, resistance choices, wings, capstone DR |
| Healer | Spell list; Skill Focus (Heal); cleanse counters; weekly New Life tracker | Healing Hands, companion, armor oath, spell resolution |
| Hexblade | Spell list/known counts; curse counter; CHA saves versus spell/spell-like effects; armored casting | Curse target, familiar, aura of unluck effect, mettle |
| Incarnate | CON-limited soulmeld count; shared essentia; capacity increases; chakra-bind counts; DC; Perfect Meldshaper counter | Soulmeld effects, chakra availability, alignment and timed capstone effects |
| Knight | Challenge pool and DC | Challenge type/target, shield block, defensive terrain, loyalty/oath restrictions |
| Lurk | Augment daily pool; focused psionic sneak attack at levels 2/7/12/17 | Augment choices/effects, augment PP cost, focus expenditure |
| Marshal | Minor+major aura total; Skill Focus (Diplomacy); move-action daily counter | Separate aura categories, allies, aura bonuses/range |
| Ninja | Ki pool and remaining-pool Will bonus; unarmored AC; sudden strike; Acrobatics/Great Leap | Ki activation/effects, concealment, nonlethal/vital-target restrictions, evasion |
| Samurai | Improved Initiative grant; Kiai Smite counter | Two-sword style feats/weapon restrictions, staredown, kiai target/effect |
| Scout | Skirmish dice/AC with movement switch; Battle Fortitude; fast movement | Actual movement/terrain/mount eligibility, camouflage, senses, evasion |
| Shadowcaster | Mystery/fundamental choices, uses by category, INT eligibility, CHA DC | Paths, prerequisites, relearning, spell-like/supernatural resolution and bonus-feat choices |
| Shugenja | Indexed spell-menu entries; existing CHA slots | Element/order restrictions, spell selection, sense elements |
| Soulborn | Soulmeld/essentia/bind limits; half meldshaper level; DC; daily smite/incarnum-defense counters | Alignment, immunities, soulmeld effects and smite target/effect |
| Spellthief | Restricted SRD school list plus indexed additions; spells-known counts; sneak attack; armored casting | Stolen spells/energy/abilities, absorption and ownership/duration |
| Spirit Shaman | Druid list alias, retrieved-spell counts; Chastise Spirits uses/damage/DC; listed daily spirit powers | Daily retrieval choices, spirit eligibility, guide, effects and concentration |
| Swashbuckler | Weapon Finesse; Grace; Insightful Strike; designated-target dodge; improved flanking; Lucky counter | Dodge against melee only, reroll decision, critical ability damage, slippery mind |
| Swordsage | Maneuver/stance limits, initiator level, readiness/recovery; Quick to Act; light-armor WIS AC; Dual Boost counter | Discipline focus, maneuvers, recovery actions, sense magic and evasion |
| Totemist | CON-limited soulmelds, combined essentia, totem capacity/level increases, DC; Totem Embodiment counter | Chakra access, soulmeld effects, rebinding and timed capstone changes |
| Truenamer | Utterance total, success counter, Evolving Mind DC and Truespeak roll, save DC; Sending counter | Other lexicons, personal truenames, Law of Sequence and individual utterance effects |
| Warblade | Maneuver/stance limits, initiator level, readiness/recovery; Battle Clarity/Ardor/Cunning/Mastery | Discipline prerequisites, opposed combat checks, maneuver effects and recovery actions |
| Warlock | Eldritch blast damage/touch attack/SR rolls; invocation limits; fiendish resilience counter; armored casting | Invocation grades, shapes/essences, DR/resistance choices, item-creation abilities |
| Warmage | Fixed-list learning; spell list; armored casting including medium armor at 8 | Warmage Edge per-target/per-round application, advanced learning, metamagic selections |
| Wu Jen | Expanded spell menu and existing INT prepared slots | Elemental mastery, spell secrets, taboos and watchful spirit |

Classes → Class abilities & special systems stores player-selected abilities. Limits update when class levels or scores change; warnings preserve out-of-limit selections rather than deleting them. Resource counters appear in Feats. Combat situation switches control skirmish, denied-Dexterity targets, precision immunity, attacks of opportunity, own turn, and helplessness. Check concealment, critical immunity, and movement eligibility before using these switches. The shared Dodge target switch represents the selected opponent; Swashbuckler's class dodge applies only to that opponent's melee attacks.

Daily rest resets daily ability uses, successful utterance counts, and infusion use. It preserves craft reserve, weekly powers, choices, chakra binds, essentia allocation, and unsettled delayed damage. Crusader maneuver grants clear on rest/recovery; random granting remains a table action. Extra essentia from races/feats/items and exceptional progression need player adjustments; the displayed shared pool currently totals the three incarnum classes only.

Known fixed feats are added without duplicates and cannot fill ordinary feat reminders. Restricted bonus-feat selections still require player/DM review. Existing manually entered feats are preserved. If an older sheet already models a newly automated passive through a custom Effect or misc bonus, remove that duplicate adjustment.

Dread Necromancer's chosen martial weapon and Favored Soul's deity weapon require a weapon proficiency override. Dragon Shaman totem skills and Soulborn alignment skills require class-skill overrides. Samurai is the Complete Warrior version. Martial Lore and Truespeak are included in new sheets; existing sheets can add them through Skills.

## Expanded spell menu

The combined catalog contains **867 spells: 606 existing SRD entries and 261 supplemental reference entries**. This does not include the specialty-only Silverbeard entry. Existing SRD text is reused where a supplemental list names the same spell. New reference entries contain the indexed class level and available metadata, a source link, and a conspicuous notice that full effects/saving throws are not bundled. Cast still spends the selected slot and can send the reference card through the existing handoff; it does not invent the missing effect.

| Spell-list filter | Indexed spells |
| --- | ---: |
| Beguiler | 111 |
| Dread Necromancer | 84 |
| Warmage | 87 |
| Duskblade | 72 |
| Hexblade | 42 |
| Healer | 57 |
| Shugenja | 33 |
| Wu Jen | 298 |
| Spellthief | 115 |
| Archivist / Favored Soul (each, Cleric baseline) | 231 |
| Spirit Shaman (Druid baseline) | 169 |

These are indexed entries, **not a claim of complete coverage of every printed spell list**. In particular, the Shugenja index is partial. Each source page and its expected row count is recorded in `lib/supplemental-spell-lists.json`; all 76 level pages and their pagination were checked. Sources use `https://dndtools.net/classes/<class>/spells-level-<level>/`. Spellthief additionally derives Sorcerer/Wizard spells of levels 1–4 in its five allowed schools. The Complete Arcane Wu Jen skips older Oriental Adventures-only listings. Source transcriptions can differ from book revisions/errata; use the cited book when they disagree.

The “Learn available class list” button adds the currently castable indexed spells for Beguiler, Warmage, or Dread Necromancer without duplicates or resetting spent slots. It appears again as higher spell levels become available. Advanced learning is a separate selection. Use Custom spell for missing spells and for full effect text from your own references. Regenerate the extension with `python scripts/build-supplemental-spells.py` after rebuilding the SRD catalog.

## Data and validation

Book/page references and links above identify the rules being modeled. Entries contain numerical progression data, feature names, and original support notes, rather than full supplemental book text. The existing SRD license applies to the SRD reference catalogs; these additions do not designate supplemental books as Open Game Content.

The D&D Tools transcription has Swordsage BAB inconsistencies at levels 13 and 17; these entries use the ordinary three-quarter progression (+9 and +12). Duskblade level 20 includes six fifth-level base slots, omitted from that transcription. Placeholder question marks in unavailable Duskblade slot cells are normalized to unavailable, and Ninja AC progression is kept separate from its feature column.

Regression validation covers all 1,750 base-class/race combinations, every supplemental table's 20 levels and column alignment, split casting abilities, late casting, psionic limits, proficiency restrictions, supplemental skills, bonus-feat reminders, spent-slot preservation, and JSON round trips. The Pages production build and TypeScript check are also run. The new class-system regression tests additionally cover resource preservation, granted feats, armor gates, precision damage, maneuver grants, incarnum limits, mystery uses, catalog merging, and fixed-list learning. These new controls still need a post-merge live browser acceptance pass; the owner's prior confirmation of Roll20 receipt covers the existing delivery integration.
