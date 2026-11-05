# Repository working instructions

Before changing game mechanics, read [the rules policy](docs/rules-policy.md).
The user's standing instruction is **rules as written wherever applicable**.
Keep that policy in the repository; conversation summaries are not its authority.

For standard-defaults or gestalt work, also read
[the implementation record and remaining gates](docs/gestalt-implementation.md).
Historical milestone notes are not proof that the whole goal is complete.

Preserve existing player saves, level-ups, skill purchases, damage, preparations,
spent resources and explicitly selected house rules. Do not silently convert
characters or reset them to repair an import. Do not commit private character
exports. Test mechanics changes and persistence before committing.

## Finished patches must be deployed

Standing user instruction (2026-11-05): **Always deploy a finished patch.**
For this project, finish validation, merge the patch into `master`, and use the
existing GitHub Pages workflow. Wait for publishing to succeed and verify the
live application files before reporting the patch complete. Report any actual
deployment blocker explicitly. A saved branch or PR alone is not deployment.
The active site is https://clockworkkit.github.io/DnD3.5CharacterSheet/.
