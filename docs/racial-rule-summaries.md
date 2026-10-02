# Integrated racial rule summaries

Star Elf and all 273 other remaining selectable races with “use the source rules for conditions and choices” placeholders now use concise mechanical summaries from their linked Ultimate SRD sections. The same paragraphs appear in the Race tab, library preview, generated racial feature card, and portable source snapshot.

Star Elf includes the sunset-to-sunrise and held/worn limits of Otherworldly Touch, extraplanar origin, sleep immunity, enchantment saves, vision, secret-door search, and the absence of racial weapon training. Larger choice lists include shifter and saurian shifter traits, spellscale meditations, and hengeyokai forms. Variant entries include retained parent traits with replaced abilities omitted. Shared source sections are separated for bamboo/mountain spirit folk, hellbred aspects, and mephling elements.

## Editing and rebuilding

Edit lib/race-rule-summaries.json, whose values are arrays of readable paragraphs, then run node scripts/build-character-sources.mjs. The four earlier detailed entries remain in lib/source-detail-notes.ts. Keep legacy trait blocks in lib/ultimate-race-data.json: they identify old generated cards for safe migration. The runtime catalog overlays the reviewed text; tests prevent these placeholders from reaching selectable races.

## Saved characters and limits

Recognized generated cards replace their old contiguous trait block while keeping player prefixes/suffixes, counters, and race-specific setup notes. Custom rewritten cards, monster records, and descriptions that would exceed 20,000 characters remain untouched. Source snapshots still provide the current rules. No numeric automation, selected ancestry, character choices, or combat actions are added by these text updates. Existing source inconsistencies, such as Vril shriek progression, are stated explicitly.

## Validation

All 318 tests pass, including coverage and save/export round trips for all 274 added summaries, idempotent migration with player-state preservation, Star Elf rule checks, and mutually exclusive choice/variant checks. TypeScript and the Pages build pass. Browser verification shows the Star Elf rules directly in the library with no console errors. Local screenshot: work/star-elf-rules-preview.png.
