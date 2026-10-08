# GC0 baseline ledger (2026-10-08)

Worker: Haiku, worktree `C:\Users\ckx19\sf-wt\gc0-baseline` (branch `gc0-baseline`). Read-only on the main checkout. No code, tests, installs, merges or pushes. Source plan: `docs/GAME-CREATOR-COMPLETION-PLAN.md` (GC0.1, GC0.2; main checkout, untracked). Ahead/behind uses `main` = `a4f06b9`, which is one commit past the requested base.

## Base

- Requested base: `4dabfd7` "docs: BOARD current milestone status and recovery-trace verdict". Worktree HEAD = `4dabfd7`.
- `4dabfd7` is an ancestor of current `main` (`a4f06b9` "docs: BOARD records GC0/GC1 dispatch"). Use `a4f06b9` as the moving main reference; use `4dabfd7` as the accepted base for this ledger.
- Main checkout `C:\Users\ckx19\story-framework` is on `main` at `a4f06b9`, with uncommitted work from other sessions.

## Dirty-file ledger

- Main checkout `git status --short`: 59 paths (17 modified, 42 untracked). Expanded to individual files (`-uall`): 77 files (17 modified, 60 untracked files, 0 missing).
- Per-file SHA-256 (Get-FileHash) and the path list: `docs/research/gc0-dirty-hashes-2026-10-08.txt` in this worktree. That file is written as input for later checks and is intentionally NOT committed.
- Untracked directories containing files: `Temp/` (venus-inspect), `artifacts/continuous-paging/`, `artifacts/rei-model-comparison/dialogue-audit/`, `docs/history/`. Also `packages/modules.zip`, `artifacts/profile-expansion.zip`.
- Owner note: this ledger does not own any dirty file. No dirty file was read for content, changed or staged.

## Candidate branches

- Local branches: 72. Merged into `main`: 53. Unmerged: 19.
- Columns: `ahead` = commits only on the branch; `behind` = commits only on `main`.

| Branch | Tip | ahead | behind |
|---|---|---|---|
| integrate/fix-wave | 494d724 | 24 | 79 |
| t-118 | 9fd5c6f | 1 | 80 |
| t-119 | 7876056 | 1 | 80 |
| t-120 | e6791fe | 1 | 80 |
| t-121 | 0b87d1e | 1 | 80 |
| t-122 | dd361bc | 1 | 80 |
| t-123 | 44c375f | 1 | 80 |
| t-124 | 21bae23 | 1 | 80 |
| t-125 | 666b4e0 | 1 | 80 |
| t-127 | e361c8e | 18 | 79 |
| t-128 | 37abbe1 | 17 | 79 |
| t-129 | 866c731 | 17 | 79 |
| gc22-doc | 6e78e75 | 2 | 19 |
| recovery-trace | a0eb33a | 1 | 7 |
| candidate/T075-reviewed-integration-20261003 | 5049751 | 1 | 137 |
| integration/T009b-combined-20261002 | ac56ee5 | 3 | 143 |
| integration/T075-20261002 | 651abda | 2 | 143 |
| worktree-agent-a6466b8bcf9db5522 | 30a2def | 1 | 65 |
| worktree-agent-af03eae3d2c2ba7a5 | 1a0bb07 | 1 | 21 |

- Merged examples (ancestors of `main`): `T-101` (ff45d41), `T-102`, `candidate/T092-wizard-hosting-20261003` (b9d5d27), `gc22-compat-contract` (24192f1), `gc9-import`, `gc53-save-ownership`, and the `gc0-*`/`gc1-verify` branches (0 ahead, at `4dabfd7` or older).
- Not found as branches: `t-126`, any `Stage2` branch. Named stage2 directories exist under the Windows temp folder (`sf-stage2-*`, `sf-weekly-routines-stage2-20261003`, `sf-weekly-stage2-integration-20261004`), not in `git worktree list`.
- Nothing was deleted.

## Running server

- `curl.exe http://127.0.0.1:4317/` and `http://localhost:3000/` both return HTTP 200 with the Story Framework HTML shell.
- Listeners (Get-NetTCPConnection): port 4317 = `node server.mjs` (PID 53996); port 3000 = `node server.mjs` (PID 75080). Both listening.
- `server.mjs` default port is 4317 (`PORT` env). Version and checkout of each process not determined: no version route checked and the working directory was not read. Treat the running server version as unverified.
- LM Studio at `http://localhost:1234/v1/models` returns 200.
- No server was started or stopped.

## Disposition table (GC0.2)

Marks: integrated = ancestor of `main`; awaiting review = unmerged branch or doc hold; superseded; failing; unverified.

| Item | Mark | Evidence |
|---|---|---|
| Stage2 (weekly, frozen) | awaiting review (frozen, unmerged) | `docs/GAME-DESIGN.md:14`, `docs/research/creator-continuation-2026-10-05.md:17`, `docs/briefs/T-105.report.md:8` say frozen/unmerged pending independent review. Branch identity unverified (see Unverified). |
| T-101 content packages | integrated; independent-review acceptance unresolved (owner, 2026-10-08) | `645bfa9` ("import and export portable content packages", 2026-10-05) and branch tip `ff45d41` are ancestors of `main`. Do not list as awaiting merge. `docs/briefs/T-105.report.md:8` still says T-101 portability retains an independent-review hold; that acceptance question stays open until GC9.1. Hash ledger `docs/research/gc0-dirty-hashes-2026-10-08.txt` (uncommitted by design, in this worktree) is preserved and referenced here. |
| Continuation bridge (per-turn markers) | awaiting review (contract); code unverified | BOARD "Current evidence and decisions" section: in-progress bridge in current source. Contract commits `39d7b3b`, `6e78e75` on `gc22-doc` (unmerged; `gc22-doc` must follow a NEXT-MILESTONES rewrite that is dirty in the main checkout, per BOARD status). |
| Wizard preview fixes | integrated (umbrella); specific fix commits unverified | BOARD line 17: `9f275eb` (creator controls and Wizard screen art, 2026-10-05) integrated; running preview route available. `candidate/T092-wizard-hosting-20261003` is an ancestor of `main`. |
| T-118 to T-125 (test-health) | awaiting review via `integrate/fix-wave` | Each branch tip is an ancestor of `integrate/fix-wave` (`494d724`), not of `main`. BOARD line 201 claims all named failures resolved there. Not re-run in this pass. |
| integrate/fix-wave (T-126 to T-129 reports) | awaiting review (scoped delta only) | 24 commits ahead / 79 behind. BOARD lines 17, 201: do not merge wholesale. Reports live on this branch, not `main`. |
| T-127, T-128, T-129 | awaiting review via `integrate/fix-wave` | Tips are ancestors of `494d724`. Not merged to `main`. |
| T-126 | unverified | No branch named `t-126`. Report claimed on `integrate/fix-wave` only; not opened here. |
| recovery-trace (GC5.5 trace) | awaiting review | `a0eb33a` (unmerged). BOARD "Resolved investigation": expected todo output, not failure. |
| missed-cost and g2g3-prompt | integrated | Merges `c3b7d34` and `228f863` are ancestors of `main`. BOARD's "Branches awaiting merge" status (2026-10-08 section) still lists them (stale). |
| Failing items | none evidenced | No failing result cited from a current run. `T-117` recorded 81 failures at `e4816ed` (BOARD line 201), superseded by the fix-wave claim, not re-verified. |

## Unverified items

1. Stage2 branch or worktree identity and content. Candidate temp directories exist, but no branch or commit was found.
2. Whether the continuation bridge code is on `main` or only in a dirty file.
3. Specific Wizard preview fix commits beyond `9f275eb`.
4. T-118 to T-125 and T-126 reports: not opened; fix-wave claim not re-run.
5. T-101 hold conflict: BOARD (integrated) vs T-105 report (independent review pending).
6. Version and working directory of both `node server.mjs` processes (4317 and 3000).
7. Browser suite was not run on `main`.
8. `gc22-doc` depends on the uncommitted `docs/NEXT-MILESTONES.md` rewrite in the main checkout.

## Evidence format (GC0.6)

Each report must state:
- Base: commit hash and branch (for example `4dabfd7`, `main`).
- Patch: commit hash(es) or the dirty-file hash list path.
- Task IDs: the T-/GC- IDs covered.
- Test commands and results, with the command as run and pass/fail/skip counts.
- Browser evidence: URL, screenshot or trace path, and whether the run used a live server (port and PID).
- Exact workflow: steps the owner or tester followed, in order.
- Remaining limits and owner-review status.

This ledger: base `4dabfd7` (ancestor of main `a4f06b9`); patch = none (docs only); task IDs GC0.1, GC0.2; commands = git read commands and PowerShell Get-FileHash and Get-NetTCPConnection; no test runs; browser evidence = HTTP 200 probes only; limits as listed above.
