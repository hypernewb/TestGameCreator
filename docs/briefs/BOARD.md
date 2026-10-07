# Ticket board
Every ticket lists `model:` (the AI that did the work) or `planned:` (before dispatch). Reconciled 2026-10-02 against main 3483d4b, remaining worktrees and reports. All previous workers have stopped; no entry below implies a worker is running. Historical test counts are not today's suite certification.

## Conversation quality (2026-10-06b; Wave A launched 2026-10-06)

The owner played two chats (the second on a restarted 4317) and conversation still "feels off" next to VU. Diagnosis and owner answers: [conversation-quality-2026-10-06](../research/conversation-quality-2026-10-06.md#revision-2026-10-06b-owner-answers-and-the-revised-plan-supersedes-7-items-1-3-4-6-9-10-8-order-10-11-d3d4). Dispatch needs the owner's go.

- **Wave A** (can run in parallel now; disjoint files):
  - [T-107](T-107.md) Character Chat Lab. in progress: zai (owner-dispatched)
  - [T-110](T-110.md) Character goals/quests. in progress: codex (worktree sf-wt/T-110)
  - [T-111](T-111.md) Route Map editor + archetypes (absorbs P4). in progress: codex (worktree sf-wt/T-111)
  - [T-114](T-114.md) Context hygiene + local speed. in progress: Claude (worktree sf-wt/T-114)
- **Wave B** (unblocked: T-conversation-workflow landed in 44abf5a):
  - [T-108](T-108.md) Scene voice. planned: codex
  - [T-109](T-109.md) Delivery verdict (after T-108). planned: codex
  - [T-112](T-112.md) Reaction flash + scene summary. planned: codex; owner to confirm it is compatible with the Game UI redesign pause.
- **Wave C:** [T-113](T-113.md) Generated depth. model: codex; landed 8e0cc46 ([report](T-113.report.md)). Main 2026-10-07: npm test 1976 pass/0 fail/10 skip. Open: owner-approved cloud generation sample (acceptance item; not yet run).
- **Later:** CQ6 (more random encounters, walk-ins, two heroines), plus the CQ7 leftovers.

## Current priority (2026-10-04)

Owner approved the proper evidence-backed creator gap assessment after allowance uncertainty disclosure. **T-098 assessment/doc task complete; no implementation dispatched.** The goal supersedes polish-only wording: a reusable creator capable of authoring essentially the whole kind of Venus University social/romance experience, including character setup, rules, events and player screens. All core controls visual; code optional for extensions. [26-capability assessment](../research/creator-gap-assessment-2026-10-04.md), [dependency roadmap](../NEXT-MILESTONES.md#creator-milestones-2026-10-04), [T-098 report](T-098.report.md).

- Confirmed: social/romance template default plus explicit blank; editable prompt/card startup (1–8 NPCs/player excluded, 1–8 locations); creator-owned stages/unlocks/boundaries/events; engine-validated typed consequences; automatic memory with inspect/correct and optional facts/secrets/knowers/promises.
- Tiny sample proves author/play/debug/revise/save/reopen without code edits, not a full game. Creator UI/editor, Game UI/player presentation and UI Wizard/Game UI editor remain distinct. Game UI/editor chrome redesign remain paused.
- Main verified `ff45d413`; focused isolated creator checks 112/0. Fresh isolated full suite 1412 pass/5 fail/10 skip: two archive-without-Git failures (targeted rerun 3/0 after Temp git init), three CDP enable timeouts before browser layout checks. **No fresh all-green certification.** Historical 1417/0/10 remains historical. No model calls or implementation changes.
- Weekly specific-over-general rules prioritized. All six frozen Stage2 manifest source/test hashes matched, but independent Stage2 review, aggregate suite and merge remain pending. Author 106 focused/10 browser results are candidate evidence, not accepted main.
- Proposed next batch only: P1 check reviewer ownership and independently review exact frozen Stage2; P2 remaining draft-loss/recovery contract; P3 template/blank composition contract; P4 visual stage-unlock/promise-condition specification. See assessment for bounded acceptance, overlap/dependency review and ordinary-language priority rationale. No historical READY or proposal authorizes dispatch.
- Installer, full mechanics migration and calendar-picked-date scheduling deferred. Adventure later: narrative engine-resolved combat first, structured turn-based later. Eventual isekai social/party setting does not add RPG gates now. Preserve all dirty patches/sessions and separate arrival-predictor scope.

## Current priority (2026-10-03)

**Historical record:** superseded by 2026-10-04 above. Pending assessment permission and “this docs task performs no audit” below describe the earlier documentation-only task; they do not describe T-098.

The owner's latest direction supersedes READY/resume/dispatch/running statements in the dated records below and older briefs; those records retain history, not current dispatch authority. Prioritize the **reusable game creator/editor**, enabling a creator to ship a social/romance game with **Venus University's level of polish** (quality benchmark, not copied identity or assumed mechanics). See [current roadmap direction](../NEXT-MILESTONES.md#current-direction-owner-clarification-2026-10-03).

- Creator UI = editor; Game UI = player-facing presentation; UI Wizard = editor of reusable Game UI. Game UI visual redesign is paused, and editor-first does not authorize editor chrome redesign.
- Target creator loop: create/edit content and rules, play/debug, revise, save/reopen without editing code. A tiny playable sample tests that loop; it is not a separate full game. Later polished output remains the goal.
- Current priority is planning and evidence-backed creator gap assessment before another implementation batch. Proper systematic assessment is not completed; separate permission remains pending. Prior audits/analyses do not close it. This docs task performs no audit and authorizes no implementation dispatch.
- Existing weekly Stage2 source remains frozen and unmerged pending independent review/full checks. No completed or merge-ready claim is implied. EXE installer and full mechanics migration are deferred.
- Preserve existing patches, completed work and verification limits. Historical task readiness below does not resume paused work; new execution requires a scoped authorization after planning.

## Prior todo / readiness (historical; subject to current priority)
- T-009b Suggest auto-fill: implementation not started. Worker stopped on the missing design card; T-080 restored the exact input to ../sf-wt/T-009b/docs/design/suggest-autofill.md (SHA-256 verified). The ticket's 2026-10-02 owner override governs intimate suggestions; the unchanged card is older. No implementation redispatch in this record task.
- T-056 M4 two-timer validation: partial uncommitted persona patch in ../sf-wt/T-056; no report or acceptance test. Review/recover before resuming.
- T-074 retired-reference cleanup: partial uncommitted patch in ../sf-wt/T-074. Tracked WAL removal remains blocked; preserve the local data. Missing-art worktree failures and remaining script references are reported, not fixed here.
- T-043 measurement: report/runs exist in ../sf-wt/T-043; review findings before any rerun. Report claims a Wave-4/int-3 baseline, while its worktree now points to 6023c00. It reports inputLost=1, dead-turn/spotlight failures and a metrics discrepancy; these are historical findings.

## Review / uncommitted
- T-075 daily-need seeding: patch/report in ../sf-wt/T-075. Earlier reconciliation targeted check: 6 pass, 0 fail; historical full-suite result has four missing-art failures. No commits ahead of main.
- T-076 portability guard: test/document/report in ../sf-wt/T-076. Earlier targeted check: 2 pass, 0 fail; historical full-suite result has four missing-art failures. Neutral-turn coverage is not proof of every configured romance mechanic. No commits ahead of main.
- T-073 portability audit: completed document/report untracked on main; review output, not a pending Z Code dispatch.
- T-064 prompt slimming: owner-direct work is present on main; supporting tests, explanation tooling/report and A/B artifacts remain partly dirty/untracked. Preserve this bundle; historical 1195/0 is not current certification.
- T-077 conversation experiment: uncommitted main patch/report. Historical full run 1278 pass, 1 fail, 10 skipped came from terminating tests/endings-reachable.test.mjs, without a reported failing assertion. Quality improvement remains unproven.
- T-066/T-067/T-068 UI prototype: reports and vn_ui_studio bundle untracked on main; reported completion is not a commit or engine integration.
- T-078 independent UI buttons/presets/state editor (formerly collided with engine T-069): prototype brief/report consolidated under T-078.
- T-079 responsive UI tools/connection map (formerly collided with engine T-070): prototype brief/report consolidated under T-079.
- Main still contains unrelated dirty docs, tooling, research and playtest artifacts/deletions. Previous workers are stopped; preserve changes until reviewed and attributed.

## Parked
- Creator-proof second world through Studio: parked by owner 2026-10-02. T-009b itself is ready to resume after input recovery, not parked.
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

## Planned follow-ups 2026-10-02 (T-081; no workers launched)
- T-081 planning complete: T-082 through T-087 drafted; matrix/questions in T-081.report.md. Histories above preserved. Main currently 3483d4b with 112 status entries; combined ac56ee5 remains unmerged with main's untracked Suggest-card conflict. Earlier counts are historical.
- T-082 READY TO DISPATCH: minimal mobile navigation/clock CSS repair, existing appearance retained; no Studio direction implied.
- T-083 READY TO DISPATCH: mock diagnosis of reported 238px review column. T-087 BLOCKED pending reproduction, allowlist confirmation and candidate/conflict disposition; appearance choices also BLOCKED ON OWNER.
- T-084 BLOCKED ON OWNER: adapter direction, exact appearance/export and controls. Reuse T-078/T-079 capabilities; no implicit renderer/persistence expansion.
- T-085 READY TO DISPATCH for options only; restoration/versioning of 76 files BLOCKED ON OWNER. Artist policy forbids committing images; no asset changes/uploads authorized here.
- T-086 READY TO DISPATCH for comparison only; reconciliation/merge BLOCKED ON OWNER. Preserve both cards; no automatic overwrite.
- Prepared assignments: A T-082; B T-083; C T-085 then T-086. Disjoint writes; one live browser playtest at a time. No implementation workers launched in this planning task. Later code needs free reviewer and separate owner merge approval.

## Approved reusable UI direction 2026-10-02 20:22:34 UTC (supersedes T-081's earlier pending UI rows)
- Owner approved reusable wizard integration for all compatible creator-generated games, first dialogue/input/clock-location/navigation/feedback scope, current copper/brass/ivory baseline, additive selectable UI options with the new option default, and preservation of existing options/assets/custom layouts. No campus hardcoding.
- T-082 implementation and T-083 diagnosis are running in parent-managed child tasks; this planning worker did not launch them. Preserve their file ownership; browser checks remain serialized.
- T-088 READY TO DISPATCH: first generic v1 export validator/loader/device-geometry contract; writes only new public/vn-skin.mjs, public/ui/default-layout.json, tests/vn-skin-contract.test.mjs and its report. Independent of T-082/T-083 writes and asset/Suggest decisions.
- T-089 READY TO DISPATCH: narrow creator save/export/publish/default contract analysis; produces exact follow-up Apply/select implementation allowlist, without repeat audits or storage guesses.
- T-084 now approved in direction and scope; awaits T-088/T-089 and T-082 review. Runtime binding is generic, not an Ashford-specific exported file. Creator persistence follows a separately bounded brief after T-089.
- T-085 asset policy and T-086 Suggest reconciliation remain BLOCKED ON OWNER for application; do not repeat completed audits. Existing unselected-game default migration remains an explicit question if behavior would change; explicit legacy/custom selections cannot be overwritten.

## Creator Apply/select follow-ups (T-089 analysis complete)
- T-089 DONE: docs/research/analysis-T-089.md identifies whole-pack draft JSON/save/export/publish, missing skin metadata and game-server wizard hosting gap; no API/browser saves or suite runs.
- T-090 READY AFTER T-088 REVIEW: additive gameProject.ui selection/schema and storage tests. Server plus engine/shared public/ui-selection.mjs ownership; new blank projects default to wizard, existing absent/custom/legacy selections unchanged pending migration choice.
- T-091 READY AFTER T-090: creator file import/review/Apply/select using normal Save/export/publish; no public/style.css/sheet-editor changes. Can run with T-084 runtime binding after shared contract review; disjoint write sets.
- T-092 READY AFTER T-090: same-origin existing wizard hosting, exact reviewed dependency serving allowlist; server writes serialized. T-091 adds wizard link only once serving passes. No new cross-window editing protocol or old-layout reset.
- Existing unset-game default migration is one material owner question in T-089.report.md; explicit custom/legacy choices always preserved. No re-opening approved generic direction/current identity.
- Owner approved local Git packaging of the 76 artwork files; parent already dispatched packaging and T-088. Do not duplicate those workers or treat earlier asset-blocked rows as current.
- Future art route is LOCAL ComfyUI, not NovelAI (subscription ended). Separate inspection already running; no duplicate service inspection or art generation task drafted here. Suggest conflict remains parent-owned.
