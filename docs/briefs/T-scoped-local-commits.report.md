Status: done
Files: exact committed path manifests below; shared files staged by scoped patches, not whole-file add
Tests: full-suite evidence reused: T-art-portability reports pass 1842 fail 0 skip 10; owner supplied the same result. No new npm/full-suite/browser run. Newly run checks against disposable index exports: integration 98 pass / 1 fail (99 tests); after retaining the required publication provenance dependency, mechanics + restart 9 pass / 0 fail. The other 91 passing tests were unchanged. Memory expansion + existing memory controls 15 pass / 0 fail. Working-tree recovery regression alone 2 pass / 0 fail. No assertions removed/weakened; git diff --cached --check passed.
Acceptance: reviewed local commits only; no push. Creator/Wizard integration commit 9f275eb includes visual mechanics controls, T-104/T-105 nested forms and specialist foundations, template/blank startup and recovery, Wizard player geometry/full-screen/art, authoring warnings and whole-project UI art transfer. Separate memory commit contains campaign-only impression/scene-memory overlays, effective context/inspection/character-progress views, import validation, immutable audience and correction UI. Exact candidate blobs verified against the index before committing; committed-blob verification and final preservation results are recorded by the task's final response.
Deviations: combined creator and Wizard/art because Studio/server/media validation share dependencies. Fixed a concrete startup Restore defect: the signature included startupEditVersion but the callback comparison omitted it, making every unchanged Restore fail; added a positive regression and retained the stale-edit regression. Kept the two publication provenance fields and restart-test update because the mechanics roundtrip assertion depends on them; unrelated bootstrap filtering and remaining republish work excluded. Updated stale top-level coverage classifications with an explicit nested-coverage limitation. Used standard git apply --cached/commit with approved sandbox escalation after index.lock permission denial. The checkout has no .agents directory; no relevant missing coding skill was needed. Followed the explicit delegation's no-full-suite/no-subagent instructions over generic AGENTS test cadence.
Noticed: reports describe overlapping historical snapshots. T-104's timed-out suite and early Wizard limitations are superseded only where later reports/tests support the implemented behavior; preserved original reports as historical evidence.
Noticed: coverage's schema/mount detection is weak and proves no exhaustive nested-field coverage or runtime/UI parity. Specialist modules remain foundations, with the limits and owner questions in T-105 unchanged.
Noticed: whole-project UI art transfer is included; content-package UI art portability, frozen T-101/weekly candidates, cancelled-import orphan uploads, decorative non-button icons and presets rendering remain outside this commit's claims.
Noticed: memory's HTTP retire operation ignores supplied text rather than rejecting it; overlay import validation does reject text on retirement. The original report's stronger general rejection statement is not claimed here. Original history remains available; no believability/playtest result is claimed. Existing progress test contains a permissive optional-chain assertion, so that assertion alone is not proof of the progress view.
Questions: none for this commit task; existing feature/design questions in authored reports remain pending.

## Preservation and exclusions

Initial HEAD was 4812e7d; initial index was empty. The endings fix was not duplicated. Only public/studio.mjs, tests/creator-recovery-startup-controls.test.mjs and docs/research/studio-coverage.md were edited in the working tree by this task. All other 84 initially inventoried file contents retained their SHA-256 hashes. Scoped index versions removed unrelated hunks while preserving their working-tree bytes.

Excluded tracked hunks/files: .claude/launch.json (line-ending-only status), public/style.css (schedule/asset-audit edits), public/vn.mjs and tests/vn-sprite-animation.test.mjs (animated sprites); animation-related hunks in packages/core/engine.mjs, packages/assets/project-media.mjs, public/studio.mjs and tests/project-media-validation.test.mjs; rename imports/helper/ID-control hunks in public/studio.mjs; asset-audit imports/route/panel in server.mjs/public/studio.mjs; bootstrap republish filtering and provider-probe change in server.mjs; tests/first-run.test.mjs; vn_ui_studio/live-bindings.mjs; expanded-binding hunks in vn_ui_studio/app.mjs, public/ui-live.mjs and tests/ui-live-bindings.test.mjs; tests/ui-live-bindings-browser.test.mjs. Necessary art DOM-mock support is included without the expanded-binding tests.

Excluded untracked paths: .worktrees/, artifacts/content-packages/, artifacts/ui-art/, artifacts/ui-live-bindings/, artifacts/ui-live-layout/, artifacts/ui-screen-mode/, gui-test-screenshots/; packages/assets/asset-audit.mjs, public/studio-asset-audit.mjs, tests/asset-audit.test.mjs, public/studio-rename.mjs, tests/studio-rename.test.mjs, tests/studio-republish.test.mjs; reports T-101, T-103, T-activity-analysis, T-animated-media, T-asset-audit, T-context-inspector, T-creator-parity, T-schedule-preview and T-venus-import. No credentials, personal settings, runtime databases, logs or generated screenshot/art directories were staged. Never opened/wrote data/ai-settings.json or called a real provider.

Temporary verification data: C:/Users/ckx19/AppData/Local/Temp/sf-scoped-commit-review-20261005 contains the explicit manifests, candidate blobs, initial hashes, disposable index-export test snapshot and focused logs; it is not staged.

## Creator/Wizard commit paths

- docs/research/studio-coverage.md
- docs/research/venus-import-candidates-2026-10-05.md
- docs/research/creator-continuation-2026-10-05.md
- docs/briefs/T-creator-mechanics-controls.report.md
- docs/briefs/T-104.md
- docs/briefs/T-104.report.md
- docs/briefs/T-105.md
- docs/briefs/T-105.report.md
- docs/briefs/T-wizard-player-layout.report.md
- docs/briefs/T-wizard-screen-mode.report.md
- docs/briefs/T-wizard-art.report.md
- docs/briefs/T-art-portability.report.md
- packages/ai/startup-authoring.mjs
- packages/assets/project-media.mjs
- packages/cards/creator-template.mjs
- packages/core/engine.mjs
- packages/modules/feed.mjs
- packages/modules/index.mjs
- packages/modules/jobs.mjs
- packages/modules/academics.mjs
- public/calendar.mjs
- public/creator-advanced-contract.mjs
- public/creator-specialist-contract.mjs
- public/creator-systems-contract.mjs
- public/studio-advanced.mjs
- public/studio-systems.mjs
- public/studio-recovery.mjs
- public/studio-rules.mjs
- public/studio.html
- public/studio.mjs
- public/ui-live.mjs
- public/ui-project.mjs
- public/ui-selection.mjs
- public/ui-showcase.css
- public/vn-skin.mjs
- public/ui-art.mjs
- public/ui-art-import.mjs
- public/ui-layout-style.mjs
- public/ui-screen.mjs
- vn_ui_studio/app.mjs
- vn_ui_studio/styles.css
- vn_ui_studio/authoring-warnings.mjs
- tests/creator-restart-roundtrip.test.mjs
- tests/creator-mechanics-controls.test.mjs
- tests/creator-systems-controls.test.mjs
- tests/creator-systems.test.mjs
- tests/creator-advanced-controls.test.mjs
- tests/creator-recovery.test.mjs
- tests/creator-recovery-controls.test.mjs
- tests/creator-recovery-startup-controls.test.mjs
- tests/creator-template.test.mjs
- tests/creator-specialist.test.mjs
- tests/studio-coverage.test.mjs
- tests/studio-activity-controls.test.mjs
- tests/studio-schedule-preservation.test.mjs
- tests/studio-weekly-routines.test.mjs
- tests/studio-rules-controls.test.mjs
- tests/studio-knowledge.test.mjs
- tests/studio-ui-selection.test.mjs
- tests/project-media-validation.test.mjs
- tests/ui-wizard-serving.test.mjs
- tests/ui-live-bindings.test.mjs
- tests/ui-live-layout.test.mjs
- tests/ui-live-layout-fixture.mjs
- tests/ui-live-layout-browser.test.mjs
- tests/ui-screen-mode.test.mjs
- tests/ui-screen-mode-browser.test.mjs
- tests/ui-art.test.mjs
- tests/ui-art-fixture.mjs
- tests/ui-art-browser.test.mjs
- tests/authoring-warnings.test.mjs
- server.mjs

## Memory commit paths

- packages/ai/context.mjs
- packages/ai/inspect.mjs
- packages/ai/memory-controls.mjs
- packages/ai/memory.mjs
- packages/core/character-progress.mjs
- packages/persistence/store.mjs
- public/creator-memory.mjs
- tests/creator-memory-expansion.test.mjs
- docs/briefs/T-memory-correction-expansion.report.md
- docs/briefs/T-scoped-local-commits.report.md
