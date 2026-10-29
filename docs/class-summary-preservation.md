# Class summaries and personal notes

Class-summary cards share the existing Feats & features interface. Players can
edit their description, name, reference and counters. A generated card ID alone
does not authorize replacing those edits during advancement or recalculation.

## Refresh contract

- New generated cards retain an optional bounded `generatedSummary` snapshot of
  their generated description, name and source. It is recognition metadata, not
  a grant of abilities or another class progression.
- A refresh replaces only one complete, uniquely recognized generated block.
  Text before and after that block stays intact. Names and sources update only
  when they still match the recognized generated values. Counters, choices and
  formulas are not reset.
- Existing cards without this metadata remain compatible. Exact generated
  catalog/table text can be recognized at previous supported levels; an available
  pre-edit character also supplies the previous alternate-feature context.
  Unknown, blank, internally edited or ambiguously repeated descriptions are
  preserved, not guessed at. Untouched old saves do not acquire a schema default.
- A replacement that would exceed the existing 20,000-character description
  limit is not applied. Text is never truncated to make a save pass validation.
- When saved text cannot be refreshed, Feats & features shows the current
  generated class summary separately and labels the saved description as
  preserved text that may contain older rules. Post card includes both with
  separate labels. Mechanics continue using class levels and selected features,
  never prose from this card.
- Source-reviewed custom table edits preserve existing feature records. The
  derived view can show their new milestones immediately; subsequent explicit
  summary refresh or advancement can update a recognized generated block while
  retaining annotations.

This prevents future loss; it cannot recover notes already overwritten in an
older save. Daily-resource card descriptions, racial references and other
independently managed cards have their own synchronization rules and are not
claimed covered by this change.

Tests cover standard and paired advancement, source review, alternate-feature
selection/restoration, legacy/no-metadata cards, customized names and references,
ambiguous text, length limits, native reload and a fresh browser-storage client.
Actual browser interaction remains a separate verification gate.
