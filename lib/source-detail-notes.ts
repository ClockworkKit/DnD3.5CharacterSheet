// Mechanical summaries checked against the linked Ultimate SRD entries.
// These are reference text, never additional grants or calculation inputs.
export const classDetailNotes:Record<string,string>={
 factotum:`Inspiration: refresh the level-based pool each encounter.

Cunning Insight: 1 point before an attack, damage or save; add Intelligence modifier as a competence bonus, without an action.
Cunning Knowledge: 1 point; add class level to a trained skill check, once daily per skill.
Trapfinding: Search DCs above 20; disarm magical traps.

Arcane Dilettante (level 2): daily sorcerer/wizard selections; each costs 1 point and is usable once after eight hours’ rest. Only one highest-level selection; no duplicates or XP costs. Supply material components. Caster level = class level; DC = 10 + spell level + Intelligence modifier. Apply known metamagic when choosing spells.

Level 3: Brains over Brawn adds Intelligence bonus to Strength/Dexterity checks and skills. Cunning Defense costs 1 point: Intelligence-bonus dodge AC against one foe, one round, free action.
Level 4: Cunning Strike costs 1 point before attacking for +1d6 sneak attack.
Level 5: Opportunistic Piety costs 1 point and a daily use; standard-action healing/undead damage = twice level + Intelligence modifier, or turn as a cleric of your factotum level (never command undead). Daily uses: 3 + positive Wisdom modifier, plus one at levels 10, 15 and 20.
Level 8: Cunning Surge, 3 points, extra standard action.
Level 11: Cunning Breach, 2 points, free action, ignore one foe’s DR/SR for one round.
Level 13: Cunning Dodge, 4 points, immediate action, ignore damage reducing HP to 0 or less; once daily.
Level 16: Improved Cunning Defense grants Intelligence-bonus dodge AC in light/no armor.
Level 19: Cunning Brilliance: choose three extraordinary standard-class abilities available by level 15; 4 points and a free action activate one for a minute at your factotum level, once daily each.

Source discrepancy: Ultimate SRD prints d6 in its introductory Hit Die line. This sheet retains its existing d8 progression; this reference update does not change HP. Dungeonscape, pp. 14–17.`,
};

export const raceDetailNotes:Record<string,string>={
 kenku:`Great Ally (Ex): successful aid another on a skill check or attack grants +3 rather than +2 when the kenku aids or receives aid. Flanking attacks gain +4 rather than +2. These replace the ordinary bonuses; do not add both.

Mimicry (Ex): reproduce familiar sounds, voices and accents. This grants no new languages. Impersonating a particular voice uses Bluff opposed by a familiar listener’s Sense Motive.

Natural weapons: two claws, 1d3 damage each for a Medium kenku. Add them in Creature/Combat if desired; this reference does not create attacks.

Racial skills: +2 Hide and Move Silently. Low-light vision. Common and Kenku; bonus languages Auran, Dwarven, Gnome, Goblin and Halfling. Favored class: rogue. Monster Manual III.`,
 illumian:`Luminous Sigils (Su): candlelight; suppress as a standard action, restore as a free action. Suppression removes sigil and word benefits. Sigils survive form changes that retain supernatural abilities.

Glyphic Resonance (Ex): against glyph/rune/sigil/symbol spells, immune if character level reaches the incoming caster level; otherwise −4 racial saves. Shadow-descriptor spell saves gain +2.

Power Sigils (Su): choose one initially; a second distinct sigil and +2 bonuses require level 2 in a single class. Aesh affects Strength checks/skills; Hoon Wisdom/Constitution; Naen Intelligence; Uur Dexterity; Vaul Charisma. Krau adds caster level, capped at character level. Initially bonuses are +1. Spot DC 10 distinguishes a power sigil; Knowledge (arcana) DC 15 identifies it.

Two sigils form a word. Only your selected combination applies:

Aeshkrau / Uurkrau: use Strength / Dexterity for bonus spells only, in any selected spellcasting traditions.
Aeshoon: twice daily, swift action and one turn/rebuke attempt; Wisdom-bonus weapon damage with Weapon Focus weapons until your next turn.
Aeshuur: after sneak attack or a critical hit, +2 dodge AC against that target until your next turn.
Hoonkrau: twice daily, swift action and one turn attempt for +1d8 cure healing, or one rebuke attempt for +1d8 inflict damage; lasts through the end of your next turn.
Hoonvaul: twice daily, swift action and an unprepared spell slot; slot-level bonus to turning checks/damage and smite attack/damage until your next turn.
Naenaesh: during preparation, leave up to two slots empty; other prepared spells of those levels can use Still Spell until next preparation.
Naenhoon: twice daily, swift action; pay turn/rebuke attempts equal to a known metamagic feat’s level adjustment to apply it without changing casting time or effective spell level. Heighten costs one attempt per increased level, maximum spell level 9.
Naenkrau: during preparation, reserve up to two slots at different levels; +1 spell save DC for those levels across all classes until next preparation.
Uurhoon: twice daily, swift action and an unprepared slot; Wisdom-bonus insight to Reflex saves and Dexterity-bonus insight to SR checks, lasting one minute per slot level.
Uurnaen: reserve a level 1 or 2 slot during preparation; slot-level insight bonus to unarmed/sneak attack rolls until next preparation.
Vaulaesh: twice daily, swift action and an unprepared slot; slot-level insight to AC and Weapon Focus weapon damage until next turn.
Vaulkrau: twice daily, immediate action and an unprepared slot; slot-level insight on the next save before your next turn.
Vaulnaen: twice daily, spend an unprepared slot to cast a prepared spell of the same level, using the prepared spell’s caster level.
Vauluur: twice daily, swift action and an unprepared slot; +1d6 per slot level on unarmed/sneak damage until next turn.

Reserved slots stay empty until next preparation. An unprepared slot cannot contain a prepared spell.

Always literate; Speak Language is always a class skill. Final Utterance lasts one round per Hit Die after death. Favored class: any; monks/paladins may leave and return without multiclass restriction. Human subtype grants no human bonus feat or skill points. Races of Destiny.`,
 'aquatic-kobold':`Apply the ordinary kobold traits plus the aquatic variant. Swim speed 40 ft.; +8 Swim, take 10 while threatened, and run while swimming straight. Breathe water, not air; outside water, hold breath for twice Constitution score in rounds before suffocation checks.

Kobold basics: Small, land speed 30 ft., darkvision 60 ft., +1 natural armor; +2 Craft (trapmaking), Profession (miner), and Search. Light sensitivity dazzles in bright sunlight or daylight. Automatic languages: Draconic; bonus languages Common and Undercommon. Favored class: sorcerer. Ability adjustments: −4 Strength, +2 Dexterity, −2 Constitution.

Unearthed Arcana suggests optional LA +1 for mixed aquatic/non-aquatic underwater or ship campaigns; the sheet retains the selected LA until you change it. Optional kobold web enhancements and Dragonwrought are separate choices.`,
 'mountain-dwarf':`Mountain dwarves retain the standard dwarf racial traits. Constitution +2, Charisma −2; Medium; land speed 20 ft., unaffected by armor or carried load; darkvision 60 ft.

Stonecunning: +2 Search for unusual stonework; automatic check within 10 ft.; find stonework traps like a rogue and estimate underground depth.
Weapon familiarity: dwarven waraxe and dwarven urgrosh count as martial weapons.
Stability: +4 against bull rush/trip while standing on the ground.
Racial saves: +2 against poison, spells and spell-like abilities.
Combat: +1 attacks against orcs/goblinoids; +4 dodge AC against giants, lost when denied Dexterity to AC.
Crafts: +2 Appraise and Craft for stone/metal items.

Automatic languages: Common and Dwarven. Bonus languages: Giant, Gnome, Goblin, Orc, Terran and Undercommon. Favored class: fighter. Revised 3.5 SRD; mountain ancestry does not add another set of dwarf bonuses.`,
};
