# NPC and monster sheet foundation

NPCs and monsters share `Character`, `/api/characters`, revision checks, ownership checks,
browser storage, and the version 1 JSON export envelope. This is a backend foundation:
the existing character creation dialog and PC layout do not yet expose creature fields.
No new server or database migration is required. GitHub Pages continues using local browser
storage; the authenticated deployment continues using its existing database routes.

## Model and compatibility

- `sheetKind`: `pc`, `npc`, or `monster`. Old files default to `pc`.
- `creature`: nullable validated profile. Required for monsters; old files default to null.
- Profiles contain type/subtypes, independent numeric CR (including fractions), racial HD,
  die size, good saves, explicit nonabilities, space/reach, additional movement modes,
  natural attacks, special attacks/qualities, senses, immunities, vulnerabilities,
  ecology, advancement text, source, and notes.
- Existing fields remain authoritative for HP, land speed, armor, saves, DR, SR,
  resistances, equipment, feats, skills, casting, powers, and resource usage.
- List/save responses expose `sheetKind` so a future library UI can separate sheet types.
- Monster metadata is preserved by schema validation, export/import and both stores.

## Creation and calculations

`createNpcSheet` accepts the same options as `createPlayerCharacter`, including manual
scores and a supported class/race. It keeps normal class automation. The five traditional
NPC-only classes are not added by this change.

`createMonsterSheet` creates a classless creature with no invented Fighter levels or
sample possessions. Provide its name, creature profile, and six final ability scores.
Use null for a nonability. Constructors default absent Constitution for undead/constructs
and absent Intelligence for oozes/vermin; individual entries can override those defaults
through `nonabilities`. Input scores are final scores, not scores before racial adjustments.

`racialCreatureStatistics` offers racial BAB, base saves and average racial HP from the
Ultimate SRD type progressions. It does not change a saved stat block. Construct size HP
is included. Elementals require a recognized elemental subtype or explicit good saves.
Published exceptions can override the die and good saves. Templates are not applied.
Fractional-HD monsters require explicit printed HP. CR never determines HD, level, or XP.
For fractional HD, the shared integer `level` is a compatibility value rounded up to 1;
`creature.racialHitDice` is the authoritative HD value. Large-creature reach should be
supplied explicitly because it depends on anatomy; the fallback is 5 feet.

The shared numeric ability fields use 10 as a neutral compatibility placeholder for absent
abilities. `creatureAbilityScore` returns null, and `creatureAbilityModifier` returns zero.
`effectiveScore` ignores temporary/other ability bonuses for absent abilities. Future
monster UI must show an em dash and enforce nonability restrictions; legacy PC ability
checks, skill availability and prerequisite screens do not implement all such restrictions.

`naturalAttackRoutine` returns one attack per listed natural weapon, with primary/secondary
penalties, Multiattack, size, explicit attack adjustments, and Strength damage. It never
adds BAB iterative attacks. Pass `withManufacturedWeapon: true` for a mixed routine; callers
must omit natural weapons on limbs occupied by manufactured weapons. Set
`strengthMultiplier: 1.5` explicitly when the entry uses it (such as a sole natural weapon).
The routine does not infer Weapon Finesse, other feats, effects, damage-size advancement,
limb availability, attack alternatives, or special attack DCs. Enter adjustments explicitly.

Monster base statistics remain manual after creation. Recompute/automation activation
cannot overwrite their HP, saves, armor, speed, or spell resistance. Guided class level-up
and automatic class-total application reject monster sheets. Mixed racial/class monsters
can store explicit class entries and published totals, but automatic mixed progression
is deferred. Ordinary NPCs continue using class automation.

## Example

```ts
import {createMonsterSheet,naturalAttackRoutine} from '../lib/creatures.ts';
const skeleton=createMonsterSheet({
  name:'Human warrior skeleton',
  creature:{type:'Undead',racialHitDice:1,challengeRating:1/3,
    naturalAttacks:[{id:'claws',name:'Claw',count:2,damage:'1d4'}]},
  scores:{STR:13,DEX:13,CON:null,INT:null,WIS:10,CHA:1},
  speed:30,
});
skeleton.defense.natural=2;
skeleton.defense.dr='5/bludgeoning';
const attacks=naturalAttackRoutine(skeleton);
// Save through the existing character API or export envelope.
```

## Source and remaining work

Rules source: https://srd.dndtools.org/srd/monsters/monsterTypes.html

Next: dedicated creation/editor/stat-block UI, the NPC-only classes, a source-linked
monster catalog, classed-monster advancement, template application, and encounter instances.
This change does not deploy a new network backend, import a bestiary, or add encounter sharing.
