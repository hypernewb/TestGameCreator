# GC0.3 and GC1.3 browser evidence (2026-10-08)

Status: historical browser evidence for revision `4dabfd7` only. The tested revision and the skipped live-backend case below are kept as recorded; a different working tree cannot inherit these results.

Scope: GC0.3 "establish current test health" (browser part) and GC1.3 "verify the reading loop" from `docs/GAME-CREATOR-COMPLETION-PLAN.md`. Evidence only; no product code or tests were changed.

## Run

- Revision: `4dabfd7` (branch `gc0-browser`, worktree `C:\Users\ckx19\sf-wt\gc0-browser`, created from `main` at `4dabfd7`).
- Command: `npm.cmd run test:browser` (runs `node scripts/test.mjs browser`, `--test-concurrency=1`, serial).
- Timeout: 600000 ms. Wall time reported by the runner: 162.6 s.
- Output log: scratchpad `gc0-browser.log` (not committed).
- Exit code: **0**.
- Runner summary (Node test runner): tests 45, pass 44, fail 0, cancelled 0, skipped 1, todo 0.
- Count check by marker: 44 `✔` lines, 0 `✖` lines, 1 `﹣ ... # SKIP` line. Matches the summary.
- No other browser run was active during this run.

## Failures

None. Zero `✖` lines and zero failed tests, so no failure classification was needed. No browser test was edited or fixed.

## Skipped cases (recorded separately)

1. `read-only 4317 current Creator: fresh/back-return visible designer; missing running backend is explicit`
   - File: `tests/creator-ui-startup-browser.test.mjs` line 15.
   - Marker: `skip: !live`. `live` is `process.env.STORY_UI_STARTUP_BASE`, which was not set for this run, so the case needs a running backend at that base URL.
   - Class: environment-dependent skip, not a failure. Not verified in this run.

No other skip markers appear in the browser log.

## Reading-loop suite map (GC1.3)

Status is the result of the matching test in the run above. Mapping is by test title, since the runner prints titles and not file names.

| Reading-loop aspect | Browser suite (file) | Matching run title | Status |
|---|---|---|---|
| Ordinary and continuous reply as one page, last-page input visible, double `requestSubmit` (duplicate submit), `Page.reload` persistence, both entry points, exact input and transcript | `tests/conversation-workflow-browser.test.mjs` | "Talk and three typed exchanges use exact input, recent transcript and persona in both players" | PASS |
| Late action/retry outcomes ignored after switch; busy ownership (duplicate-action guard) | `tests/player-session-browser.test.mjs` | "both real players ignore late action/retry outcomes after switch and preserve newer busy ownership" | PASS |
| Keyboard navigation (Tab, End) through dialogue, navigation layout | `tests/play-navigation-layout-browser.test.mjs` | "mobile-navigation-clock-clearance" | PASS |
| Refusal/status header and warning scroll reachability (input, Enter) | `tests/play-ui-clearance-browser.test.mjs` | "player-refusal-status-header-clearance"; "landing-planner-warning-scroll-reachability" | PASS |
| Wizard player: dialogue, choices, input, menu; reload | `tests/ui-screen-mode-browser.test.mjs` | "complete Wizard screen: Studio choice reaches the player with working dialogue, choices, input and menu" | PASS |
| Speech and narrator controls in a real browser | `tests/scene-voice-browser.test.mjs` | "speech and world narrator controls warn, apply and reopen in a browser" | PASS |
| Player preview dialogue/input geometry | `tests/ui-player-preview-browser.test.mjs` | "actual player preview hides labelled samples ... matches published dialogue/input geometry" | PASS |
| Authored Wizard layout reaches the real player (dialogue, input) | `tests/ui-live-layout-browser.test.mjs` | "authored Wizard layout reaches the real player with positions, fonts, colours and button states" | PASS |

Non-browser paging coverage (run by `npm test`, not by this command): `tests/continuous-paging.test.mjs` (8 lines, unit-level paging of continuous and staged replies, long and unbroken text, spacing and surrogate pairs). Not part of this browser evidence.

Result: every browser suite that covers the reading loop passed. No browser test exercises paging of long replies directly, so long-reply and page-turn behaviour rests on the unit tests above plus the continuous-reply and last-page checks in `conversation-workflow-browser`.

## Gaps noticed (not fixed)

- No browser test in the run covers speaker changes or expression changes across pages as their own case.
- `continuous-paging` artifacts (`artifacts/continuous-paging/`) were written by the browser run as untracked output. They are not committed.
- `artifacts/character-lab/browser.png` was modified by the browser run. It is not committed.

## Limits

- No live model: the run uses mock providers; no LM Studio or cloud model was called.
- No owner review of the reading experience (GC1.5 and GC10.6 need owner judgement).
- The live-backend case (4317 read-only) was skipped, so the running-server path was not checked.
- Browser suite count: the run executed 45 test cases from 31 `*-browser.test.mjs` files on disk. CLAUDE.md states "23 browser suites"; that figure is stale and was not reconciled here.
- Not checked: failure and retry paths (GC1.4), timeout/cancellation under a real provider, reload of mid-stream replies, and the separate creator-only browser suites beyond what the run covered.
- Browser pass results are from one serial run on this machine on revision `4dabfd7`. A different working tree cannot inherit them.
