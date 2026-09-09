# Barrow Ledger

A D&D 3.5 character-sheet website built with Astra for ClockworkKit.

[Character sheet](https://barrow-sheet-demo.clockworkkit.chatgpt.site) · [Source status](SOURCE-STATUS.md)

## Character sheet

- Multiple private characters, autosave, explicit Save, revision conflict protection, and JSON import/export.
- Abilities, combat, the complete core skill list, custom specialties, equipment, feats, daily resources, and campaign notes.
- 606 SRD spells, 110 SRD feats, 286 psionic powers, 15 base classes (11 core and 4 psionic), 24 prestige classes, and 35 races.
- Searchable references, separate casting traditions, prepared copies, spontaneous slots, domain pools, custom spells and powers, and daily reset.
- Local practice rolls and Beyond20 handoff to Roll20, with copyable macros in the roll journal.

## Automatic calculations

Open **Calculations** to review progression, equipment and load, casting choices, daily ability numbers, and house-rule adjustments. New characters calculate automatically. Existing characters retain their entered totals through visible additive adjustments; remove an adjustment when you want the standard result.

The calculation engine connects:

- Race, class levels, abilities, base attack, saves, HP, skill-point grants, rank limits, feat budgets, and experience thresholds.
- Equipped armor, shields, masterwork and magic weapons, maximum Dexterity, check penalties, spell failure, carrying capacity, movement, and running.
- Attack routines, critical threats and damage, off-hand attacks, monk flurry, Rapid Shot, Haste, common combat feats, and selected situational bonuses.
- Class and prestige spellcasting progression, available slots, bonus spells, spells-known limits, caster levels, save DCs, power points, and manifester limits.
- Common buffs and conditions, bonus-type stacking, timed effect expiry, daily ability limits, and custom arithmetic formulas.

Changing Constitution or Hit Dice preserves damage already taken. Changing spell progression preserves preparations and spent uses. Recalculation does not refund daily resources. Recorded Hit Die rolls and historical Intelligence stay attached to their levels. Temporary ability effects affect current checks, HP, and DCs; lasting scores determine bonus daily slots and power points.

You still choose ability increases, feats, skill purchases, class levels, targets, equipment, preparations, and power augmentation. Select the relevant situation in Combat to apply conditional modifiers. Prestige prerequisites, form changes, unusual feat/spell exceptions, and custom classes require a ruling or manual adjustment. Gestalt and fractional progression use overrides. The skill allocation estimate uses current class-skill flags; historical purchase costs need review when multiclassing.

Fixed overrides and additive adjustments are available for house rules. Casting and manifesting can also be set to manual progression. Custom effects accept bounded arithmetic and dice formulas; they do not execute JavaScript.

## Classes, races, and reference data

Classes include progression tables, prerequisites, full SRD reference text, multiclass entries, and reusable feature summaries. In Calculations, choose which tradition a prestige class advances when more than one qualifies. Assassin and Blackguard have their own spell lists. Psionic traditions share a power-point reserve while observing their own manifester limits; Soulknife begins with Wild Talent's 2 PP and no powers.

Race ability adjustments and trait bonuses are separate layers, so selecting a race repeatedly cannot accumulate bonuses. Existing sheets preserve manually included racial adjustments. Racial Hit Dice and level adjustment are recorded separately; LA changes effective character level without adding Hit Dice or class progression. The library includes the seven core races, common subraces, planetouched and psionic choices, and concise summaries of Changeling, Warforged, Goliath, and Whisper Gnome.

## Roll20 connection

Enable the sheet's URL in Beyond20's custom-site settings and keep Roll20 open in the same desktop browser. Use **Roll20 setup → Send test roll** to verify your game connection.

The sheet sends generic chat macros through [Beyond20's custom-site API](https://beyond20.here-for-more.info/api#integrating-with-beyond20). That API provides no delivery acknowledgement, so the app labels a successful handoff accordingly. Initiative posts to chat; token HP, turn-tracker entries, inventory, and character attributes are not synchronized. No live Roll20 delivery test was performed for this update.

## Development

React/Vinext with a Cloudflare Worker and a D1 binding named `DB`. Use a current Node.js release with native TypeScript support (Node 24 works), Linux or WSL, and the committed dependency lockfile.

```sh
npm run install:ci
npm run dev
```

Verification commands:

```sh
node --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

In a Sites workspace, run production builds with the installed Sites `scripts/build-site.mjs` helper. `npm test` also builds before running the tests.

The 60 automated tests cover calculation interactions, all 525 base-class/race combinations with automation enabled, export/import, legacy characters, dice parsing, reference data, Beyond20 message safety, and the character API against SQLite. No browser walkthrough was performed for this update.

The API uses the authenticated identity supplied by Sites and includes the owner key in database queries. Writes require same-origin JSON; updates and deletes require the current revision. Failed saves retain edits and offer retry, export backup, and save-as-new. Character switching flushes pending edits before loading another character.

Database schema: `db/schema.ts`. Generated migrations: `drizzle/`. Migrations are applied through the hosting pipeline. This calculation update changes the saved character JSON and requires no new database migration.

The Sites configuration identifies the existing character-sheet Site. A separate installation needs its own authentication, database bindings, and migrations. A GitHub push does not deploy the application or transfer saved characters.

## Sources and licensing

The SRD catalogs are plain-text conversions of the [revised SRD mirror](https://github.com/olimot/srd-v3.5). Their Open Game Content notice, full OGL 1.0a, and original copyright notice are included in [OPEN-GAME-LICENSE.txt](public/data/OPEN-GAME-LICENSE.txt) and linked from the sheet. Book-race entries use concise original summaries and source links. Reference HTML is never rendered as executable HTML.

Calculation references include the SRD's [basic ability and stacking rules](https://www.d20srd.org/srd/theBasics.htm), [carrying capacity](https://www.d20srd.org/srd/carryingCapacity.htm), [movement](https://www.d20srd.org/srd/movement.htm), and [special materials](https://www.d20srd.org/srd/specialMaterials.htm), along with the class, feat, spell, and equipment sources in the catalogs.

Importer scripts retain the source directory structures:

```sh
python scripts/import-srd.py /path/to/srd-source
python scripts/import-classes.py /path/to/class-source
python scripts/import-races.py /path/to/race-source
python scripts/import-equipment.py /path/to/equipment-source
```

Run the class importer after the base spell importer to restore prestige spell-list levels. Each script names its required source files. The Blackguard list's older “Protection from Elements” name maps to “Protection from Energy”; Corrupt Weapon uses the source's reversed Bless Weapon effects.
