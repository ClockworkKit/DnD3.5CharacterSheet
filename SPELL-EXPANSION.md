# Spell library and support button

The library now contains 4,264 distinct spells: 606 existing SRD spells, 261 checked supplemental identities, and 3,397 additional compendium reference identities. Existing spell IDs and SRD descriptions are preserved.

Kelgore's Fire Bolt retains its existing supplemental ID but now includes casting details, a caster-level damage roll capped at 5d6, Reflex-half guidance, and the 1d6 fallback when spell resistance is not overcome. The primary reference is the user-selected [Player's Handbook II page](https://srd.dndtools.org/srd/magic/spells/spells/spellsphb2.html). The provided compilation incorrectly calls this spell Kelgore's Fire Mist; the importer corrects that name. Saves, resistance checks, and damage application remain player-resolved.

## Compendium scope

The user supplied Spells v6.01.pdf, compiled by Zook1shoe in 2013 (814 pages). Its title explicitly includes 3.0 and 3.5 licensed sources. This is a reference expansion, not a claim that every spell is fully implemented or legal in every campaign. Full effect prose is not bundled for the added index entries. Each cites its books and compilation page; class access and edition require DM verification.

The importer extracts 4,247 headings with supported class memberships. Catalog generation collapses aliases and duplicate identities, skips existing SRD/checked entries, and omits conflicting class levels rather than choosing one. Unsupported traditions, domain-only spells, epic spells without ordinary levels, and headings that do not match the recognized format are outside this pass. Compendium entries cannot automatically populate fixed class lists or gain inferred shared-list memberships.

Generate the input index with Python and pypdfium2:

    python scripts/import-spell-compendium.py /path/to/Spells-v6.01.pdf
    python scripts/build-supplemental-spells.py

The generated metadata index is included, so catalog regeneration needs only standard Python. The original PDF is not included.

The library offers catalog filtering and loads results in batches of 100. Indexed references can still be added manually to a spellbook.

## Support

The footer opens [the supplied PayPal payment page](https://www.paypal.com/ncp/payment/A8R6SJUN86M6S) in a new tab. It was checked in a browser and displays “Thank you for supporting the Barrow Ledger Development!” with a supporter-entered amount. No transaction was submitted. The supplied three-page PayPal PDF has blank code-snippet areas, but preserves this hosted button ID. No PayPal SDK is loaded into the character sheet.

## Validation (September 26, 2026)

All 216 automated tests pass. TypeScript checking, ESLint, and the GitHub Pages production build pass. Browser checks covered loading 4,264 spells, wizard filtering, increasing the displayed results from 100 to 200, searching Kelgore, reading Fire Bolt details, adding it to a spellbook, preparing and casting one copy, and rolling its effect into the practice journal. The existing build warnings about classic bridge/theme scripts and large chunks remain. The server-hosted Sites edition was not built or deployed in this pass.
