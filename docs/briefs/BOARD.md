# Ticket board

<a id="current-priority-2026-10-04"></a>
<a id="current-priority-2026-10-03"></a>

## Current priority (2026-10-07)

Codex: enjoyable VN-style chatting, then character progression, erotic scenes, game elements and others. Owner decision (2026-10-08): the warm conversation is decent enough to keep temporarily and the chatting gate is unblocked. Character progression is now the next priority: CP0 is a read-only trace ([roadmap](../NEXT-MILESTONES.md#character-progression-milestones-2026-10-08), [gap analysis](../research/progression-gap-2026-10-08.md)). Quiet-persona writing remains unsatisfactory and deferred; no universal voice-quality or Venus-parity claim is made. Creator/editor and character-profile work belongs to the other AI. See [file ownership](../../AGENTS.md#owner-direction-and-file-ownership-2026-10-07-takes-precedence) and [roadmap](../NEXT-MILESTONES.md#current-direction-2026-10-07).

Flirting is essential overall, character-specific and appropriate to the scene; purposeful non-flirtatious exchanges also belong. Evaluate complete conversations without weighted success scores. The one-model-call constraint is removed; paid calls still need bounded approval.

## Current authorized work and evidence

- Owner acceptance (2026-10-08): retain the warm author-reference conversation temporarily; move on to character progression. Montgomery without added wordplay is retained for the tested warm-socialite persona alongside the previous Leonard/Parker approach. Quiet-persona work is deferred. Detailed progression changes require current-source inspection and existing ownership coordination; this does not lift unrelated holds or authorize paid inference, restarts or commits.
- Next step: CP0 read-only progression trace (no model calls, temp DB, export/import replay). Dispatched as [T-116](T-116.md) (codex, worktree `sf-wt/T-116`, branch `t-116`, base e4816ed). Test model: owner confirmed qwen/qwen3.8-27b (2026-10-08); local runs still need the usual authorization.
- CP0 accepted by owner 2026-10-08: [T-116 trace](../research/cp0-progression-trace-2026-10-08.md) and [report](T-116.report.md) copied into the main checkout, uncommitted. Known follow-up not yet triaged: the generated route reports a dating → dating phase change (see trace).
- Baseline health: [T-117](T-117.md) (claude/Haiku, worktree `sf-wt/T-117`, branch `t-117`, base e4816ed) triages the 84 failing `npm test` cases at e4816ed. Diagnosis only; no fixes until the owner decides.
- Progression decisions recorded 2026-10-08 in the [gap analysis](../research/progression-gap-2026-10-08.md#decisions-2026-10-08): Q3, Q4, Q5, Q7, Q8, Q9 are answered. Q6 (authored stage cue, CP4) answered 2026-10-08: authored first, trust thresholds as fallback.
- [Venus comparison](T-venus-framework-comparison.report.md): offline preparation only. Frozen inputs/profiles/source retained. Rubric revised to qualitative whole-exchange review; harness fidelity and live execution remain unverified/pending.
- [Conversation evidence](../research/conversation-quality-2026-10-06.md): condensed historical observations, not an active feature programme or proven causal diagnosis.
- [Post-processing audit](T-dialogue-postprocessing.report.md): no demonstrated harmful transformation in its accepted current fixtures; limited coverage, not universal proof.
- T-107–T-114: previous assignments/plans are not current worker-status evidence. Check actual ownership before touching their files; do not redispatch from old Wave A/B/C text. T-113 was reported landed at 8e0cc46; its cloud sample remained unrun in that record. Historical test counts are not current certification.
- T-098: creator assessment completed; use its report for that dated evidence. No current Stage2 review/merge claim is made here.

## Retained creator decisions and holds

Template default plus explicit blank; editable startup with 1–8 NPCs and locations; visual authoring of stages/unlocks/boundaries/events; inspectable/correctable memory. A tiny sample proves the creator, not a full game. Creator UI, player Game UI and UI Wizard remain distinct. Existing redesign holds remain. Stage2 needs owner coordination; installer, full migration, calendar-picked dates and adventure remain deferred.

Earlier reusable-UI approval called for generic creator output, preservation of existing/custom layouts, and additive selectable UI. Explicit legacy/custom selections must not be overwritten. The earlier decision for existing projects with no UI selection was unresolved; do not guess migration policy. Artwork packaging approval and the local ComfyUI direction were recorded previously; this review authorizes no asset work. Shared server/UI files require coordination under AGENTS.md.

## Dated ticket evidence (2026-10-02; status unverified today)
- T-009b Suggest auto-fill: implementation not started. Worker stopped on the missing design card; T-080 restored the exact input to ../sf-wt/T-009b/docs/design/suggest-autofill.md (SHA-256 verified). The ticket's 2026-10-02 owner override governs intimate suggestions; the unchanged card is older. No implementation redispatch in this record task.
- T-056 M4 two-timer validation: partial uncommitted persona patch in ../sf-wt/T-056; no report or acceptance test. Review/recover before resuming.
- T-074 retired-reference cleanup: partial uncommitted patch in ../sf-wt/T-074. Tracked WAL removal remains blocked; preserve the local data. Missing-art worktree failures and remaining script references are reported, not fixed here.
- T-043 measurement: report/runs exist in ../sf-wt/T-043; review findings before any rerun. Report claims a Wave-4/int-3 baseline, while its worktree now points to 6023c00. It reports inputLost=1, dead-turn/spotlight failures and a metrics discrepancy; these are historical findings.

## Reported patches at that snapshot
- T-075 daily-need seeding: patch/report in ../sf-wt/T-075. Earlier reconciliation targeted check: 6 pass, 0 fail; historical full-suite result has four missing-art failures. No commits ahead of main.
- T-076 portability guard: test/document/report in ../sf-wt/T-076. Earlier targeted check: 2 pass, 0 fail; historical full-suite result has four missing-art failures. Neutral-turn coverage is not proof of every configured romance mechanic. No commits ahead of main.
- T-073 portability audit: completed document/report untracked on main; review output, not a pending Z Code dispatch.
- T-064 prompt slimming: owner-direct work is present on main; supporting tests, explanation tooling/report and A/B artifacts remain partly dirty/untracked. Preserve this bundle; historical 1195/0 is not current certification.
- T-077 conversation experiment: uncommitted main patch/report. Historical full run 1278 pass, 1 fail, 10 skipped came from terminating tests/endings-reachable.test.mjs, without a reported failing assertion. Quality improvement remains unproven.
- T-066/T-067/T-068 UI prototype: reports and vn_ui_studio bundle untracked on main; reported completion is not a commit or engine integration.
- T-078 independent UI buttons/presets/state editor (formerly collided with engine T-069): prototype brief/report consolidated under T-078.
- T-079 responsive UI tools/connection map (formerly collided with engine T-070): prototype brief/report consolidated under T-079.
- Main still contains unrelated dirty docs, tooling, research and playtest artifacts/deletions. Preserve changes until reviewed and attributed; current worker activity is unknown.

## Earlier deferred items
- Creator-proof second world through Studio: parked by owner 2026-10-02. T-009b input recovery was reported; this is not authority to resume.
- O1 firsts, remaining O3/O4, broader creator leftovers and P1-P4 remain parked/conditional under NEXT-MILESTONES. Director-as-DM expansion follows the approved character-depth/fun priorities.

## Landed integrations (git ancestry verified)
- int-4 5c48b34: T-044 first-run setup and T-047 owner picks. Remove their stale awaiting-merge status.
- int-5 a1a7bf1: T-045 T-050 T-057 T-046 T-052.
- int-6 e280e8c: T-049 T-051 T-053 T-054 T-055 T-058 T-059 T-060 T-061 T-063.
- int-7 0e1edd8: T-048 decline invite, T-062 campus clues, engine T-069 recap modes/popup, T-065 docs.
- int-8 5268aed: engine T-070 retired-pack deletion, T-071 bare-pack smoke, T-072 Studio coverage. T-072's dailyNeeds gap has a pending T-075 patch; director-deck reference question is retained for review.
- 3483d4b: owner's earlier scenePrompt/beats update and STAGING-test re-enable landed. Newer T-077 prompt changes remain uncommitted; do not repeat that historical staging task.

## Verification snapshot (read-only reconciliation before this record task)
- Main targeted groups: 58/0 conversation/prompt/context/delivery; 56/0 art/prompt-slim/UI; 2/0 first two endings tests. The four historical worktree art failures do not reproduce on main.
- Entire endings probe completed the focused bot (jana-stays, tick 336, 108 turns), then was stopped for prompt reporting. Full endings file and full npm suite remain unverified; no new failing assertion was established.
- This documentation task runs no tests. T-075/T-076 reviews and endings diagnosis are separate tasks; their results must be recorded by those workers.

## Done
Historical per-ticket details below are retained. Earlier question/test-state notes are source history; the reconciled current state is above.

### int-3: T-038 T-040 T-041 T-042 (every input lands, her own wants, prompt slips, messages panel)
  - model: gpt-6.1-sol (Codex: T-038) · space-bunny (OpenCode free: rest) · int-3 tests 1076 pass + 4 known worktree art failures; validate PASS · merged 2026-10-02, npm test 1080/1080

### int-2: T-008 T-036 T-035 T-028 T-030 T-031 T-032 T-034 (unwelcome flirt + ladder pace, player identity + lore, mixed actions, distinct voices, she texts first, lust baseline, anniversaries, jealousy)
  - model: gpt-6.1-sol (Codex: T-008) · nemotron-3-ultra / space-bunny (OpenCode free: rest) · merged together 2026-10-02, npm test 1042/1042
  - owner design questions (mixed-action time, mood voice, pre-dating texts, lust visibility, anniversary neglect, jealousy visibility) open; defaults kept

### T-037 Hard limit (no absolute never on trio)
  - model: gpt-6.1-sol (Codex) · tags: [implementer, codex] · O2 · merged 2026-10-01, npm test 941/941

### T-024 T-025 T-027 T-029 T-033 (body limits, hint refusals, trio body maps, daily need, gift repeats) + T-026 UI milestones
  - model: gpt-6.1-sol (Codex) · merged together as int-1 2026-10-01, npm test 935/935 after LF fix

### T-012 Relationship stages + repairable breakups
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: stage settings in save digest
  - merged 2026-10-01

### T-023 Save digest includes socialPacing / timeMode / sceneFeedback
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · found in T-010 review
  - merged 2026-10-01, npm test 868/868

### T-009a Full character sheet: schema + creator tabs (Suggest = T-009b later)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · rounds 2–3: reskin carries sheets, review fixes · round 4: trio trait picks
  - merged 2026-10-01

### T-022 Planner "wait until morning" ends the day
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · owner pick 2026-10-01
  - merged 2026-10-01, npm test 863/863

### T-011 Day-planner mode (creator option: clock | planner)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: pin clock tests
  - merged 2026-10-01

### T-010 Daily flirt cap + "she has to go" cue
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: allowlist + acts.mjs · round 3: grace countdown, schedule-boundary departures
  - merged 2026-10-01, npm test 844/844

### T-007 Stat chips + mood line on heroine panel
  - model: gpt-6.1-sol (Codex) · review: gemini-2.5-pro (OpenCode/Vertex)
  - tags: [implementer, codex]
  - merged 2026-10-01, npm test 805/805

### T-019 Heartmorrow analysis (steal list)
  - model: gpt-6.1-sol (Codex); 1st pass gemini-2.5-pro rejected
  - merged 2026-10-01

### T-020 RisuAI analysis (steal list)
  - model: gpt-6.1-sol (Codex); 1st pass gemini-2.5-pro rejected
  - tags: [researcher, codex] · redo after Gemini pass failed review
  - merged 2026-10-01

### T-021 Character-sheet fixed lists (owner approves)
  - model: gpt-6.1-sol (Codex)
  - tags: [analyzer, codex]
  - merged 2026-10-01 · owner picked 10 body regions (see owner-answers batch 9)

### T-013..T-018 Design cards: character-sheet, scene-feedback, flirt-cap, day-planner, stages
  - model: gpt-6.1-sol (Codex) · earlier drafts gemini-2.5-pro
  - merged 2026-10-01 · docs/design/

### T-001 Venus skill digest · T-003 Action ladder · T-004 rp-master analysis · T-005 Synthesis
  - model: gemini-2.5-pro (T-001, T-004), gemini-2.5-flash (T-005)
  - merged 2026-10-01, npm test 798/798

### T-002 Codebase map
  - tags: [doc-keeper, openrouter-gemini-flash]

### T-006 Weekly model scout
  - tags: [researcher, claude-haiku]
  - output: docs/research/models-weekly.md · owner reruns manually
