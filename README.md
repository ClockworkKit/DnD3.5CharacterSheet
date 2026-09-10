# Barrow Ledger

A D&D 3.5 character-sheet website built with Astra for ClockworkKit.

[Character sheet](https://barrow-sheet-demo.clockworkkit.chatgpt.site) · [Source status](SOURCE-STATUS.md)

## Character sheet

- Multiple private characters, autosave, explicit Save, revision conflict protection, and JSON import/export.
- Abilities, combat, the complete core skill list, custom specialties, equipment, feats, daily resources, and campaign notes.
- 606 SRD spells, 110 SRD feats, 286 psionic powers, 15 base classes (11 core and 4 psionic), 24 prestige classes, and 35 races.
- Searchable references, separate casting traditions, prepared copies, spontaneous slots, domain pools, custom spells and powers, and daily reset.
- Local practice rolls and Beyond20 handoff to Roll20, with copyable macros in the roll journal.
- Skill-point purchases by character level, automatic class/cross-class costs, rank limits, and refunds.
- Parchment, dark purple Amethyst, and black-and-white Classic 3.5 page themes.

## Skill points and themes

Open **Skills** and choose the level where you are spending points. The sheet calculates that level's grant from the class, recorded Intelligence, first-level multiplier, and human bonus. Spending a point adds one class-skill rank or half a cross-class rank; refunds reduce ranks immediately. Check bonuses and skill synergies follow the resulting ranks. Purchases cannot exceed that level's points or the applicable rank limits.

For multiclass characters, the advancing class determines the purchase cost. Classes already held can provide the higher class-skill rank limit. New levels append to the character's history; use **Level order, Intelligence, and point grants** to correct the order or historical inputs. Later Intelligence increases do not add points to earlier levels, and enhancement bonuses such as a headband do not grant skill points. Points are tracked separately for each level. Per-level training and grant overrides support house rules.

Existing characters keep every entered rank. **Fit existing ranks to levels** assigns those ranks to available legal purchases without adding them twice. Review the proposed allocation; ranks that cannot fit remain visible as unassigned and still count in checks. Removing a level preserves its purchases as unassigned ranks for review. Manual calculation mode retains direct rank entry.

Use **Page theme** in the header to choose **Parchment**, **Amethyst · dark purple**, or **Classic 3.5 · black & white**. Classic uses boxed fields, bold black section bars, and a traditional paper-sheet layout. The choice is remembered in this browser and applies to every character.

## Automatic calculations

Open **Calculations** to review progression, equipment and load, casting choices, daily ability numbers, and house-rule adjustments. New characters calculate automatically. Existing characters retain their entered totals through visible additive adjustments; remove an adjustment when you want the standard result.

The calculation engine connects:

- Race, class levels, abilities, base attack, saves, HP, skill-point grants, rank limits, feat budgets, and experience thresholds.
- Equipped armor, shields, masterwork and magic weapons, maximum Dexterity, check penalties, spell failure, carrying capacity, movement, and running.
- Attack routines, critical threats and damage, off-hand attacks, monk flurry, Rapid Shot, Haste, common combat feats, and selected situational bonuses.
- Class and prestige spellcasting progression, available slots, bonus spells, spells-known limits, caster levels, save DCs, power points, and manifester limits.
- Common buffs and conditions, bonus-type stacking, timed effect expiry, daily ability limits, and custom arithmetic formulas.

Changing Constitution or Hit Dice preserves damage already taken. Changing spell progression preserves preparations and spent uses. Recalculation does not refund daily resources. Recorded Hit Die rolls and historical Intelligence stay attached to their levels. Temporary ability effects affect current checks, HP, and DCs; lasting scores determine bonus daily slots and power points.

You still choose ability increases, feats, which skills to buy, class levels, targets, equipment, preparations, and power augmentation. Select the relevant situation in Combat to apply conditional modifiers. Prestige prerequisites, form changes, unusual feat/spell exceptions, and custom classes require a ruling or manual adjustment. Gestalt and fractional progression use overrides.

Fixed overrides and additive adjustments are available for house rules. Casting and manifesting can also be set to manual progression. Custom effects accept bounded arithmetic and dice formulas; they do not execute JavaScript.

## Classes, races, and reference data

Classes include progression tables, prerequisites, full SRD reference text, multiclass entries, and reusable feature summaries. In Calculations, choose which tradition a prestige class advances when more than one qualifies. Assassin and Blackguard have their own spell lists. Psionic traditions share a power-point reserve while observing their own manifester limits; Soulknife begins with Wild Talent's 2 PP and no powers.

Race ability adjustments and trait bonuses are separate layers, so selecting a race repeatedly cannot accumulate bonuses. Existing sheets preserve manually included racial adjustments. Racial Hit Dice and level adjustment are recorded separately; LA changes effective character level without adding Hit Dice or class progression. The library includes the seven core races, common subraces, planetouched and psionic choices, and concise summaries of Changeling, Warforged, Goliath, and Whisper Gnome.

## Roll20 connection

Enable the sheet's URL in Beyond20's custom-site settings and keep Roll20 open in the same desktop browser. Use **Roll20 setup → Send test roll** to verify your game connection.

The sheet sends generic chat macros through [Beyond20's custom-site API](https://beyond20.here-for-more.info/api#integrating-with-beyond20). That API provides no delivery acknowledgement, so the app labels a successful handoff accordingly. Initiative posts to chat; token HP, turn-tracker entries, inventory, and character attributes are not synchronized. No live Roll20 delivery test was performed for this update.

## GitHub Pages edition

A second build runs the complete sheet on GitHub Pages with browser storage. The original Sites build continues to use authenticated server storage.

In the Pages edition, each visitor's characters stay in that browser profile on that device. They are not committed to GitHub or shared with other visitors. Saves do not follow you between devices, and clearing site data removes them. Export backups regularly; use Export on the original Site and Import on Pages to move a character. Private browsing and blocked/full storage can prevent persistence. A current browser over HTTPS is required for safe saves across multiple tabs.

See [GitHub Pages setup](GITHUB-PAGES.md) for the one-time repository settings. After Pages is enabled, pushes to `master` build and deploy automatically. While Pages is disabled, pushes only verify and package the application.

```sh
npm run build:pages
npm run preview:pages
```

The static output is `dist-pages/`, and the default project path is `/DnD3.5CharacterSheet/`. Set `PAGES_BASE_PATH` when building for a renamed repository or custom domain. The Pages build contains public assets and client code only; it does not contain the Worker, database, or saved character data.

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

The 74 automated tests cover calculation interactions, all 525 base-class/race combinations with automation enabled, skill-point purchases and refunds, multiclass training, historical Intelligence, old ranks, export/import, legacy characters, dice parsing, reference data, Beyond20 message safety, the character API against SQLite, and browser-save conflicts and storage failures. No browser walkthrough was performed for this update.

The API uses the authenticated identity supplied by Sites and includes the owner key in database queries. Writes require same-origin JSON; updates and deletes require the current revision. Failed saves retain edits and offer retry, export backup, and save-as-new. Character switching flushes pending edits before loading another character.

Database schema: `db/schema.ts`. Generated migrations: `drizzle/`. Migrations are applied through the hosting pipeline. This calculation update changes the saved character JSON and requires no new database migration.

The Sites configuration identifies the existing character-sheet Site. A separate installation needs its own authentication, database bindings, and migrations. A GitHub push does not redeploy the original Site or transfer saved characters; the Pages workflow deploys its browser-storage edition once Pages is enabled.

## Sources and licensing

The SRD catalogs are plain-text conversions of the [revised SRD mirror](https://github.com/olimot/srd-v3.5). Their Open Game Content notice, full OGL 1.0a, and original copyright notice are included in [OPEN-GAME-LICENSE.txt](public/data/OPEN-GAME-LICENSE.txt) and linked from the sheet. Book-race entries use concise original summaries and source links. Reference HTML is never rendered as executable HTML.

Calculation references include the SRD's [basic ability and stacking rules](https://www.d20srd.org/srd/theBasics.htm), [carrying capacity](https://www.d20srd.org/srd/carryingCapacity.htm), [movement](https://www.d20srd.org/srd/movement.htm), and [special materials](https://www.d20srd.org/srd/specialMaterials.htm), along with the class, feat, spell, and equipment sources in the catalogs.

Skill training follows the SRD's [skill purchase rules](https://www.d20srd.org/srd/skills/skillsSummary.htm), [multiclass advancement](https://www.d20srd.org/srd/classes/multiclass.htm), and [headband of intellect restriction](https://www.d20srd.org/srd/magicItems/wondrousItems.htm#headbandOfIntellect). Restricted specialties such as the Archmage's [Craft (alchemy)](https://www.d20srd.org/srd/prestigeClasses/archmage.htm) retain their own training costs.

Importer scripts retain the source directory structures:

```sh
python scripts/import-srd.py /path/to/srd-source
python scripts/import-classes.py /path/to/class-source
python scripts/import-races.py /path/to/race-source
python scripts/import-equipment.py /path/to/equipment-source
```

Run the class importer after the base spell importer to restore prestige spell-list levels. Each script names its required source files. The Blackguard list's older “Protection from Elements” name maps to “Protection from Energy”; Corrupt Weapon uses the source's reversed Bless Weapon effects.
