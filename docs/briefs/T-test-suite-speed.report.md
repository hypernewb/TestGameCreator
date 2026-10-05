Status: done
Files: scripts/test.mjs; tests/test-runner.test.mjs; tests/anniversary.test.mjs; tests/after-hours.test.mjs; tests/framework.test.mjs; tests/context-inspector.test.mjs; tests/content-package.test.mjs; rename tests/play-navigation-layout.test.mjs → tests/play-navigation-layout-browser.test.mjs; rename tests/play-ui-clearance.test.mjs → tests/play-ui-clearance-browser.test.mjs; rename tests/ui-screen-fidelity.test.mjs → tests/ui-screen-fidelity-browser.test.mjs; this report.
Tests: final npm test pass 1851 fail 0 cancelled 0 skipped 10 (1861 total, 42231.6651 ms); focused optimization group pass 180 fail 0; deduplication group pass 33 fail 0; renamed browser files pass 4 fail 0 (12041.7778 ms).
Acceptance: four redundant tests removed while canonical assertions remain; one tautological assertion strengthened; three unchanged browser files correctly separated from default tests; expensive setup reduced without changing production behavior; runner all-mode preserves every file exactly once with concurrent non-browser tests and serial browser tests.
Deviations: Direct owner request is the brief. Its explicit permission to reduce redundant/outdated tests supersedes AGENTS/role prohibitions on test edits/deletions. No unique assertions removed. No production, prompt, pack, consent or character-content changes. No commits or staging in this follow-up. Browser verification used approved unrestricted execution so Edge could start, using isolated profiles/servers. Full browser suite not rerun: only three renamed files needed verification; runner partition behavior has dedicated tests.
Noticed: Full-term endings remain the main runtime cost and are intentionally retained. Concurrent CLAUDE.md and tests/content-package-browser.test.mjs edits appeared during this task and were not touched. A staged deletion of the old ui-screen-fidelity filename also appeared externally; its index state was preserved. Existing launch, Comfy, package scripts and cleanup work preserved; package.json's already-present test/test:browser/test:all commands are reused. Never opened data/ai-settings.json.
Questions: none

## Changes and evidence

| Change | Evidence / retained coverage |
| --- | --- |
| Remove three copies from context-inspector.test.mjs | Test blocks were byte-for-byte identical to context-inspector-core.test.mjs: selectLore privacy/cap/truncation, inspectContext included/excluded pools, and committed budget cuts. Core file and its assertions remain unchanged. API capability and panel tests remain in the integration file. |
| Remove repeated server-route case from content-package.test.mjs | Review-file version shares the same API setup and every original assertion, adding an invalid duplicate-choice import and a media-directory unchanged check. The stronger version remains in content-package-review.test.mjs. Other export, dependency, collision and malformed-manifest tests remain. T-101.report.md identifies that review suite as the independent regression probes. |
| Faster anniversary day advancement | Use real core.wait with until:Morning for each next day, retaining ordinary one-tick waits while a conversation is active. All 16 original tests remain; new parity test compares modules, actors, flags and ticks with the old one-tick path across two mark closures, both with and without an initial conversation. T-032.md requires 28-day marks, once-only rewards/penalties and replay; all those assertions remain. |
| Strengthen no-reward assertion | like(s) === like(s) could never fail. Capture chemistry after the acknowledged first mark and compare it at the next unacknowledged mark. |
| Faster hand-offer matrix | Request only story.startOfferedScene previews instead of previewing every unrelated action at every location and sampled boundary. All original route/daypart combinations remain. New parity test compares exact hand IDs with full enumeration at opening and late-route boundaries. Existing action-type-filter contract is documented in T-endings-reachable.report.md. |
| Mock provider backoff | Inject no-op sleep into the existing mocked HTTP retry test; still require the chosen core.wait action and exactly two HTTP calls. Free-tier guard tests already explicitly assert backoff schedules and Retry-After handling. |
| Three browser-only filename corrections | Original and renamed files verified byte-identical. All four checks run in test:browser/test:all instead of starting Edge inside npm test. New runner test prevents direct Chromium tests from silently entering the default set. |
| Faster comprehensive runner | Existing all-mode forced test-concurrency=1 on the entire suite. Now execute concurrent non-browser files first, then serial browser files. Two runner tests verify default selection, mode validation, serial browser arguments, complete/disjoint all-mode membership and current repository browser classification. |

## Measured timings

Same focused command before and after, with four new checks included afterward:

| Check | Before | After |
| --- | ---: | ---: |
| Anniversary + after-hours + framework group | 24.94 s / 176 passed | 3.60 s / 180 passed, including runner checks |
| Three anniversary marks plus off-mark days | 12.27 s | 0.083 s |
| Hand-offer boundary matrix | 2.84 s | 0.642 s |
| Mocked transient HTTP retry | 2.01 s | 0.0005 s |

Prior reconciliation's filename-filtered run took 46.55 s. Final npm test took 42.23 s. These full-suite runs differ in membership and machine load: four browser checks moved out, four parity/runner checks added, and four duplicate cases removed. The isolated focused comparison is the clearer evidence of setup savings. No full test:all benchmark was run, so no speed ratio is claimed for that command.

## Commands

- npm test: all 219 non-browser files, including long gameplay reachability checks.
- npm run test:browser: all 23 browser files, serially.
- npm run test:all: both groups; every test file remains discoverable.
- node --test tests/<file>.test.mjs: narrow iteration.

The slower endings-reachable tests are not duplicates of campus-endings: the latter seeds an ending-ready state and checks selection, whereas reachability runs actual mocked gameplay through a full term and demonstrates that routes can get there. T-054.md explicitly requires focused/spread/neglectful runs and distinct endings. They should remain comprehensive regression coverage.

## Line / byte counts

Counts compare tracked files to task-start HEAD; runner baseline is its task-start untracked content. Renames preserve bytes exactly.

| File | Lines before → after | Bytes before → after |
| --- | --- | --- |
| scripts/test.mjs | 8 → 12 | 519 → 949 |
| tests/test-runner.test.mjs | 0 → 12 | 0 → 1483 |
| tests/anniversary.test.mjs | 222 → 227 | 11998 → 12631 |
| tests/after-hours.test.mjs | 299 → 302 | 37315 → 37956 |
| tests/framework.test.mjs | 626 → 626 | 144655 → 144673 |
| tests/context-inspector.test.mjs | 83 → 43 | 9909 → 6461 |
| tests/content-package.test.mjs | 157 → 118 | 15973 → 11678 |
| play-navigation-layout renamed browser file | 39 → 39 | 10844 → 10844 |
| play-ui-clearance renamed browser file | 40 → 40 | 9834 → 9834 |
| ui-screen-fidelity renamed browser file | 21 → 21 | 6445 → 6445 |
