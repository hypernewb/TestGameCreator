# T-art-portability: whole-project export/import carries Wizard art

Date: 2026-10-05. Status: **done** (code uncommitted, per repo practice). Completes the deferred "UI art portability" item from `T-wizard-art.report.md` and reconciles the shared-file ownership that blocked it.

Tests: pass 1842 fail 0 skip 10 (npm test, 1852 tests).

## Ownership reconciliation

`packages/assets/project-media.mjs` and `public/studio.mjs` were frozen by T-wizard-art because they carried another agent's uncommitted animated-media edits. Those edits (actor `idleAnimation`/`idleStill` in `mediaReferences`, the export path list and the import remap keys) are present on main, so the freeze is lifted. This task edited both files additively around those hunks.

One more conflict surfaced and was resolved: T-wizard-art's uncommitted `server.mjs` CSP change (`img-src 'self' blob:` for `studio.html` only, for SVG rasterisation) contradicted the stale assertion in `tests/ui-wizard-serving.test.mjs` (`img-src 'self';` for every player/creator document). The assertion was updated to pin the documented contract: `studio.html` = `img-src 'self' blob:;`, everything else stays `img-src 'self';`; `data:` remains refused everywhere. No assertion was weakened: the `doesNotMatch data:` and `script-src 'self';` checks are unchanged and still run for all five paths.

## What changed

- `packages/assets/project-media.mjs`: `mediaReferences(pack)` now appends `uiMediaReferences(pack)` (imported from `public/ui-art.mjs` — packages→public imports are established convention, e.g. `calendarFor`). Every Wizard art carrier (appearance frames, utility assets, button state art, presets) is now validated by `validateProjectMedia`, so save/check/publish/import refuse drafts whose UI art is missing, malformed or path-traversal, with `gameProject.ui.<id>…` reference labels.
- `public/studio.mjs`:
  - Export: the collected media-path set now includes `uiMediaReferences(pack)` paths, so whole-project export embeds every referenced Wizard image; the studio-current guards cover the added fetches.
  - Import: after uploading embedded media and remapping location/actor paths, `remapUiMedia(pack,remap)` rewrites UI art paths to the fresh uploads (`pack` binding changed from `const` to `let`).
- Content packages (`packages/cards/content-package.mjs`) were deliberately NOT touched — per the dispatch, package support for UI art follows separately.

## Tests

- `tests/project-media-validation.test.mjs`: `mediaContext` injects `ui-art.mjs` source (export-stripped) so the sliced handlers resolve `remapUiMedia`/`uiMediaReferences`. Two new tests:
  1. A pack with `gameProject.ui` Wizard art (built on the real `authored()` wizard export fixture): missing upload → 400 naming `gameProject.ui.wizard.appearance.dialogue.frame`; path traversal → 400; valid upload → validate/save/publish 200; asset bytes round-trip.
  2. The real sliced import handler remaps both UI carriers (frame + button state art) to fresh uploads while the input pack stays untouched; the real sliced export handler then re-embeds them with correct bytes and validates server-side.
- `tests/ui-wizard-serving.test.mjs`: studio.html CSP expectation updated as above.
- VM-harness-only change in 6 files (no assertion changes): full-source studio harnesses now evaluate the export-stripped `ui-art.mjs` before `studio.mjs`, because the handlers reference its functions and the harnesses strip imports: `studio-activity-controls`, `studio-schedule-preservation`, `studio-weekly-routines`, `studio-rules-controls`, `studio-knowledge`, `creator-systems-controls`.

## Acceptance

A project authored with Wizard art exports with that art embedded and re-imports into a fresh environment with all UI art remapped to new uploads and validating — verified by the two new server-level handler tests plus the existing `ui-art-browser` flow. Full suite: **pass 1842 fail 0 skip 10** (1852 tests, 64s).

## Deviations

- Used the intended hooks (`uiMediaReferences`/`remapUiMedia` from `public/ui-art.mjs`) rather than a generic deep-walk of the pack, so reference labels and the art contract stay single-sourced in `ui-art.mjs`.
- Fixed the stale CSP assertion (ownership conflict, documented above) instead of leaving the suite red.

## Noticed

- `remapUiMedia` clones the pack; the import handler now reassigns `pack` — other callers should not assume identity.
- Content packages still do not embed UI art (`artCarriers` is not in their reference walk) — next step per dispatch.
- Orphan uploads on cancelled Wizard-layout import (noted in T-wizard-art) remain.

## Questions

none
