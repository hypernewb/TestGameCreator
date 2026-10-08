# Ticket board

<a id="current-priority-2026-10-04"></a>
<a id="current-priority-2026-10-03"></a>
<a id="current-priority-2026-10-07"></a>

## Current priority

Updated 8 October 2026. The active sequence is [GC0–GC11](../NEXT-MILESTONES.md); the full backlog and acceptance criteria are in [Game Creator Completion Plan](../GAME-CREATOR-COMPLETION-PLAN.md). This rewrite reconciles planning only. It does not dispatch workers, change file ownership, integrate candidates, or declare new implementation complete.

The owner provisionally accepted the warm author-reference conversation. Preserve it; **character progression is the next player priority**, then intimate scenes, game elements, and other refinements. Quiet-persona improvement stays deferred. Creator/editor/profile work remains in the creator lane. Follow [AGENTS.md](../../AGENTS.md) for reserved/shared files; keep one editor per agreed shared change.

## Reconciliation completed for the current snapshot

See [Current Work Reconciliation](../research/current-work-reconciliation-2026-10-08.md). Main `dab87a88` plus its existing local patches passes the non-browser suite: **2,215 total, 2,205 pass, 0 fail, 10 skipped, 0 TODO**. No source drift across 1,132 captured files. The initial four filesystem-restricted failures disappeared with test-fixture write permission and no code changes. Browser/model quality is not certified.

Ancestry confirms weekly authoring `5d5fc8c`, packages `645bfa9`, creator/recovery/Wizard `9f275eb`, and memory expansion `566c96c` are integrated. The running preview route is available. `integrate/fix-wave` at inspected `8b52aa6` remains separate: 44 changed paths, mostly overlapping local main work. Its head is now `494d724`, which adds T-127 row 8 (`e361c8e`, calm one-reply size on the ordinary calm sentence; no reordering; checkpoint test untouched). Its own non-browser run is 2,123 tests: 2,111 pass, 0 fail, 10 skipped, 2 todo. Keep main's passing intimate-scene test active; do not import the candidate TODO or restore obsolete global touch restrictions. Callback/calm behaviour still needs a scoped comparison against main's local code. No merge or code change was made by this reconciliation.

## Status 2026-10-08 (audit wave and owner decisions)

- **Merged to main (audit/test additions, no product code):** GC2.4 `gc24-trust-policy` (`8957c2a`), GC2.5 `gc25-stage` (`322d668`), GC3.1 `gc31-intimacy-trace` (`4033b75`), GC4.1 `gc41-time` (`dbcb9df`), GC6.2 `gc62-rel-audit` (`506f370`), GC7.1 `gc71-sources` (`0647892`). Each keeps its documented gaps and todos; none of these completes its milestone.
- **Combined non-browser suite on `0647892` (temp worktree):** 2408 tests, 2387 pass, 0 fail, 21 todo.
- **Open GC2 gaps from the audits:** trust/daily cap has no default for flagged packs without `romanceTempoProfiles`; the unflagged director missed-goal path writes edges directly (owner call needed); authored stage in `social.progression` does not reach `relationshipStageOf` (GC2.5); refusal/boundary text reaches the stage prompt.
- **GC6.2 gaps:** no control for initial bonds; romance ranks, hard limits and signal cooldowns are JSON-only in `studio.mjs`; no shared event or stage selector.
- **GC7.1 gaps:** plans and relationship secrets have no creator correction path; promises have no kept/missed outcome record; scene memories are append-only.
- **GC3.1 gaps:** no intimacy-specific scene budget, no player-facing aftercare text, no creator ladder or region-limit editor.
- **Branches awaiting merge:** `missed-cost` (`be39ef6`, positive-integer penalty costs with explicit `kind: "none"`; review its change to three `director-trust-changetrust` tests that now assert a loss at cost 3); `g2g3-prompt` (`1b674d8`, facts selected before budgeting and a budgeted player profile; touches `vendor/venus/scenePrompt.mjs`, so confirm ownership); `gc22-doc` (`39d7b3b`, `6e78e75`, flag decision and U1–U8 tests). `gc22-doc` edits `docs/NEXT-MILESTONES.md`, which has an uncommitted rewrite in the main checkout; merge it after that rewrite lands.
- **Owner decisions recorded (2026-10-08):** keep `pack.progression.version` out of `mechanicsDigest` only with per-turn rule versions and the five compatibility guarantees (CP2 updated in the `gc22-doc` branch); T3 save allows incomplete drafts with visible errors and blocks publish until valid; T5 adds Ignore / Must be true / Must be false; T6 adds bounded nested All/Any with flat conditions read as implicit All, engine grammar before visual editor; T7 adds location selectors with missing-reference errors and reuses the condition editor for quests; G2 relevance before budgeting; G3 concise budgeted player profile; `missed.cost` must be a positive integer with explicit no-consequence form. T3, T5, T6, T7 are not yet dispatched.
- **Resolved investigation:** the recurring `gc5-5-recovery-guarantees` trace is expected output from four `{todo}` cases (`tests/gc5-5-recovery-guarantees.test.mjs` L68, L80, L87, L95), not a failure. Deterministic in 9 of 9 runs across isolated, serial and concurrent modes, with `fail 0`. Report: `docs/research/gc5-5-recovery-trace-2026-10-08.md` on branch `recovery-trace` (`a0eb33a`, not merged). Watch one latent risk: the Studio save revision uses `new Date().toISOString()` (`server.mjs` L174), so two saves in the same millisecond could collide.
- **Studio follow-up:** `public/studio.mjs` line 96 offers only relationship and opportunity for `missed.kind`; a hand-authored `none` can reset on save.

## Next work packages

| Order | Scope | Required result |
|---|---|---|
| 1 | GC0 remaining scope and evidence | Baseline/ancestry/non-browser test health are reconciled. Finish the core capability matrix and relevant browser workflow evidence; retain current source fingerprints. |
| 2 player | GC2 compatibility and mechanical progression | Reconcile the existing per-turn continuation bridge with the approved pack-version contract; finish speech reactions, caps, shared trust writes, and authored stage guidance without changing old saves. |
| 2 creator | GC5 dependable draft workflow | Verify existing Save ownership, raw buffers, recovery, and startup; finish actual gaps and prove the tiny author/play/debug/revise/save/reopen loop. |
| 3 player | GC2 multi-encounter gate | Owner reviews at least three encounters on shipped and generated/custom packs, with state and export/import replay evidence. |
| Following | GC3–GC11 | Proceed using the dependency gates in the detailed plan; do not redispatch historical READY tickets automatically. |

## Game Creator Completion Plan tasks (GC0–GC11)

Source: [Game Creator Completion Plan](../GAME-CREATOR-COMPLETION-PLAN.md) (task IDs are planning references, not dispatch tickets). Every task starts **planned**. Use planned / in progress / implemented pending verification / verified / accepted; a source file, partial report or old test total does not complete a task. Exit gates are in the plan.

### Current status (2026-10-08, plan vocabulary)

No milestone is accepted or verified yet. Statuses: planned / in progress / implemented pending verification / verified / accepted.

| Milestone | Status | Done so far | Still left |
|---|---|---|---|
| GC0 | in progress | Reconciliation and ancestry recorded; combined non-browser suite green on `228f863` (2420 tests, 0 fail, 21 todo); GC2.2 contract decided; capability audits GC6.1, GC6.2 and GC3.1 merged | GC0.2 dispositions of Stage2, T-101 and fix-wave; browser suite not run on merged main; GC0.4 full capability matrix; GC0.5 contracts (CP2 wording lives in unmerged `gc22-doc`) |
| GC1 | provisionally accepted; regression gate not re-run | Examples frozen with manifest (`15a6af5`); continuous paging browser checks reported earlier | Re-run reading-loop and input/retry checks on merged main (GC1.2–GC1.4); GC1.5 quality gate for any prompt change |
| GC2 | in progress (partial) | CP0 trace accepted; speech rules v3 behind versioned marker (`aa1220f`); GC2.4 and GC2.5 audits merged, showing gaps | GC2.2 compatibility contract (`gc22-doc` unmerged; mixed/tampered cases U3, U6–U8 are todo); GC2.4 caps and default for flagged packs; GC2.5 authored stage not wired to `relationshipStageOf`; GC2.6 memories/promises; GC2.7 friendship vs attraction; GC2.8 owner review of three encounters (not started) |

**Dispatched 2026-10-08 to close GC0 and GC1 (worktrees off `4dabfd7`; none merged yet):** `gc0-baseline` (GC0.1–GC0.2 ledger and dispositions); `gc0-browser` (GC0.3 serial browser run and reading-loop suite map); `gc0-matrix` (GC0.4 capability matrix and GC0.5 contracts); `gc1-verify` (GC1.1, GC1.2, GC1.4 pins and todos). GC1.5 is not triggered because no prompt change is planned.

**Results (worker reports, not yet merged):**
- GC0.1–0.2 `gc0-baseline` `68307b5`: ledger at `docs/research/gc0-baseline-ledger-2026-10-08.md`. 59 dirty paths; 72 candidate branches, 19 unmerged; T-105 conflicts with ancestry on T-101 status.
- GC0.3 `gc0-browser` `d983bc3`: browser run on `4dabfd7` = 45 tests, 44 pass, 0 fail, 1 skip (live creator startup, needs a running backend). All reading-loop suites pass. Gap: no browser test covers speaker or expression changes across pages.
- GC0.4–0.5 `gc0-matrix` `62db57f`: 33 capabilities, 68 of 231 cells absent or unverified. Top gaps: no nested AND/OR/NOT, no false-flag control, recovery cases 2–5 todo, GC2.2 contract unmerged.
- GC1.1–1.4 `gc1-verify` `50ae1d1`: 14 pins pass, 5 todo. **GC1.1 is not closed**: the frozen-example manifest lists zero files and no hashes.
- GC0 and GC1 remain open until GC1.1 has real frozen artifacts, GC1.3 has reading-loop evidence beyond mock providers, and the owner accepts GC1.

Everything else (GC3–GC11) is planned, except audits that are merged and documented but not accepted: GC3.1 inventory (`4033b75`), GC4.1 time/presence (`dbcb9df`), GC6.2 relationship audit (`506f370`), GC7.1 source inventory (`0647892`).

### Milestones

| Milestone | Outcome | Lead | Prerequisites | Starting status |
|---|---|---|---|---|
| GC0 | One trustworthy baseline and scope | Both | None | Required reconciliation |
| GC1 | Accepted conversation preserved | Player | GC0 | Provisionally accepted; regression gate |
| GC2 | Encounters produce coherent progression | Player | GC1 + compatibility contract | Partial; immediate player priority |
| GC3 | Optional intimate scenes form a complete loop | Player + creator fields | GC2 | Systems exist; integration unproven |
| GC4 | Activities and events sustain a game loop | Player | GC2; intimate integration after GC3 | Many components exist |
| GC5 | Creator draft and startup are dependable | Creator | GC0 | Implemented in parts; verify and finish |
| GC6 | Core rules are visually authorable | Creator | GC5; relevant GC2–GC4 | Forms exist; coverage unverified |
| GC7 | Continuity is inspectable and correctable | Both | GC2, GC5; GC6 knowledge contracts | Bounded tooling exists |
| GC8 | Authored UI and media work in the player | Creator lead + player | GC5; relevant GC6 | Bounded integration exists |
| GC9 | Games and reusable content transfer reliably | Creator | GC6–GC8 | Partial; reconcile T-101 |
| GC10 | Independent creation and sustained play pass | Both + owner | GC1–GC9 | Not established |
| GC11 | Reproducible local release and handoff | Both | GC10 | Remaining |

### GC0 — baseline and scope
- **GC0.1** Record accepted base, owned dirty-file hashes, candidate branches and running-server version/capabilities; concise baseline ledger.
- **GC0.2** Disposition of Stage2, T-101 packages, continuation bridge, Wizard preview fixes and T-118–T-125 (integrated / awaiting review / superseded / failing).
- **GC0.3** Focused tests plus one full suite on the agreed combined candidate; classify failures; record skipped browser cases; run affected browser workflows.
- **GC0.4** Core capability matrix: creator control, persisted field, runtime consumer, player effect, diagnostic, import/export, fixture; review nested fields.
- **GC0.5** Shared contracts: progression versioning, stage-cue precedence, recovery guarantee, content-package references, UI bindings, schema ownership. No second truth store, bus, rule engine or importer.
- **GC0.6** Evidence format for each report (base, patch, task IDs, commands, browser evidence, limits, owner review).

### GC1 — preserve the accepted conversation
- **GC1.1** Freeze accepted examples (warm Montgomery sample, Leonard/Parker references, inputs, profiles, traces, replies); separate experiments.
- **GC1.2** Typed speech/actions survive assembly, streaming, repair, paging and history; embellishment invents no choice, acceptance or state.
- **GC1.3** Reading loop: long/ordinary replies, speaker changes, last-page input, continuous reading, authored scenes, keyboard, duplicate submit, reload, both entry points.
- **GC1.4** Timeout, cancellation, malformed metadata, disconnect and retry preserve input and apply consequences once; partial prose reported honestly.
- **GC1.5** Narrow quality gate on material prompt/presentation changes; record specific losses; no aggregate score overrides owner judgment.

### GC2 — character progression across encounters
- **GC2.1** Extend CP0 trace to successful narration, authored progression, opening vs continuation; diagnose generated `dating → dating`.
- **GC2.2** Reconcile per-turn continuation markers with the opt-in pack flag; test old, new, mixed, missing-marker, unknown-version and tampered imports. No retroactive points; no casual `schemaVersion` change.
- **GC2.3** Ordinary speech coverage for openings and continuations (one-to-one/group, non-talk, action-only, hypothetical, greetings, repeats); one reaction per event.
- **GC2.4** `changeTrust` for rewards, reactions and director path; daily caps, repeat reduction, cooldowns, negative reactions, promises, disabled modules.
- **GC2.5** Committed progression feeds the next prompt and diagnostics; authored stages first, trust fallback; a friendly label cannot erase a breakup or refusal.
- **GC2.6** Memories and promises affect later behaviour (enjoyable memory, discomfort then repair, kept and missed promise, privacy, correction).
- **GC2.7** Friendship vs attraction stay distinct; invitations, unlocks, firsts, rejection, breakup and repair follow authored conditions; reachable repair under default template; flag restrictive configs.
- **GC2.8** Review ≥3 encounters (development, setback, later response) on shipped and generated/custom packs; export/import and continue; owner accepts.

### GC3 — optional intimate scenes
- **GC3.1** Inventory firsts, intimacy, touch, boundaries, sobriety, budgets, wardrobe/media, aftercare; classify runtime / creator-only / player-only / unverified. Keep character-specific contact direction.
- **GC3.2** Authored vs typed scene selection, prerequisites, checkpoints, custom step identities (targeted decision), stopping, aftermath.
- **GC3.3** Explicit adult declarations, eligibility, refusal, ambiguity, withdrawal, interruption; stop via control and typed input; no accidental resume.
- **GC3.4** Free text, initiative, authored choices, paging, extension, closure, decline alternatives; invalid metadata grants no checkpoint.
- **GC3.5** Commit consequences and presentation separately (milestones, relationship, memory, aftermath, clothing, expressions, CG fallback); reload/retry duplicate nothing.
- **GC3.6** Review mutual, declined, mid-scene stop and later return routes on custom and shipped profiles; owner judges chemistry, pacing, aftercare.

### GC4 — activities and events
- **GC4.1** Duration and cost display; travel, hours, weekly routines, exceptions, arrival presence, missed meetings, daypart rollover; reconcile weekly priority with old docs.
- **GC4.2** Typed action settlement for movement, buying, gifting, invitations, activities, waiting, extending; in-world reasons and alternatives; retries spend nothing twice.
- **GC4.3** Small generic solo and shared activity set with costs, prerequisites, repeat limits; one connects to progression and a later event. Minigames only if scope needs them.
- **GC4.4** Event/route semantics: trigger/condition/effect chains, waits, nesting, branches, unconditional escape, objectives, endings; missed events change the world and are discoverable.
- **GC4.5** Bounded social loop: phone, feed, invitations, plans, gossip, secrecy, witness rules where enabled; privacy checks in consuming mechanics.
- **GC4.6** Jobs and academics limited to supported reusable workflows; decide whether boss dialogue, semester/graduation and richer feed are release-required or extensions.
- **GC4.7** Assess existing director: offers, ignored offers, consequences, callbacks, spotlight, quiet periods; fix dead ends and repeats; no new thread/game-master expansion unless required.
- **GC4.8** Daily loop across several in-game days (conversation, progression, optional intimacy, time/resource choices, setback, recovery); owner judges choices and return reasons.

### GC5 — creator workflow
- **GC5.1** Every entry mode (social/romance template, explicit blank, premise, card, existing project, import); blank works without a provider.
- **GC5.2** Character and location workflow: create, edit, duplicate, rename, remove, profile generation, portraits, poses, backgrounds, exits, home/hangouts, reference repair; stale responses cannot alter another selection.
- **GC5.3** Save and Apply ownership: delayed save, edits, project switch, out-of-order responses; saved revision reported accurately; failed validation keeps last valid save.
- **GC5.4** Raw buffers (valid-unapplied and invalid JSON/rule/profile/weekly/startup); no false Save success; clear Apply/correct/retain/discard path.
- **GC5.5** Recovery: refresh, tab close, browser and server restart, corrupt local recovery, conflicting revisions, abandoned startup; document what survives; fix silent loss.
- **GC5.6** Generation progress, cancel, retry failed sections, resume, compare, explicit accept; manual edits preserved; no duplicate save after lost response; failure never replaces a draft with partial output.
- **GC5.7** Smallest complete loop with placeholder content: start → edit cast/location → stage and unlock → boundary → two-outcome event → Check → play → inspect → revise → Save → reopen → replay; recorded browser actions.

### GC6 — visual authoring of core rules
- **GC6.1** Audit controls against the matrix from the October 5 continuation and later reports; exercise handlers and persisted results; tickets only for remaining gaps.
- **GC6.2** Character/relationship rules: starting relationships, stats/bonds, stages/transitions, attraction, rank gates, reactions, gifts, caps, cooldowns, firsts, boundaries, intimacy settings; shared selectors.
- **GC6.3** Scene condition/effect editing: nested AND/OR, payload matches, participant/location requirements, waits, choices, transitions, objectives, ending gates; preserve unknown advanced values visibly.
- **GC6.4** World and schedule: connections, dayparts, recurring schedules and exceptions, activities, costs, inventory/economy, jobs/academics if included, timed events; disabled modules keep data.
- **GC6.5** Phone/feed, plan outcomes, secrecy/agreements, knowers/reveals, facts, director configuration; authored data separate from campaign-generated memories.
- **GC6.6** Valid-value pickers, duplicate/reference/dependency checks, field errors, pre-play checklist, explained disabled controls; rename/remove reveals affected references first.
- **GC6.7** Nested round trips: edit, save/reopen, export/import, legal and illegal runtime branch; module enable/disable/re-enable; conflicting imports.
- **GC6.8** Close coverage per capability with visual workflow and runtime effect, or owner-approved scope change; not by percentage or source grep.

### GC7 — continuity inspection and correction
- **GC7.1** Map sources (authored facts, generated facts, statements, scene memories, impressions, promises, secrets) to owner, provenance, visibility, persistence, corrections; unify inspection, not stores.
- **GC7.2** Inspector shows the actual prompt for a recorded turn vs current-context preview; selected/omitted/superseded/private/stale/budget-cut with costs; link output to source.
- **GC7.3** Correction support per record type (correct, retire, restore, supersede, resolve in play); preserve evidence; read-only records explain the supported repair.
- **GC7.4** Corrections dominate future factual guidance (summary, later repetition, long-gap retrieval, reimport); no rewriting of historical narration.
- **GC7.5** Audience isolation with ≥2 NPCs: prompts, previews, exports, inspector APIs; correction does not expand knowers.
- **GC7.6** Promise outcomes: kept and missed commitments, status and source, different follow-ups, next encounter acknowledges result; diagnostics fabricate no completed actions.
- **GC7.7** Inspection and correction survive reopen, export/import, branching and truncation; caps keep current facts and pending commitments; measure missed retrievals first.

### GC8 — reusable player presentation and media
- **GC8.1** Distinguish disk code from running backend; check preview/asset/API capabilities before opening the designer; complete the preview-route deployment check without losing drafts.
- **GC8.2** Wizard round trip: Creator/Studio → Wizard → player preview → Apply → Save → reopen → play; Back/return; failed preview recovery; preserve explicit custom/legacy selections.
- **GC8.3** Map every release-required widget to committed state and supported actions (balance, inventory/shop, schedules, relationships, phone/feed, history, saves); explicit limits for unsupported widgets.
- **GC8.4** Keyboard focus, reading order, text size, narrow screens, zoom, long labels, overlays, busy states, rapid actions, retry; free text and Stop reachable. Existing visual design; redesign holds remain.
- **GC8.5** Portraits/poses, backgrounds, UI art, outfits/animations, optional CG; type/size validation; missing-asset fallback; IDs preserved on replacement; orphan detection before export.
- **GC8.6** Reload/replay keep approved dialogue and staging; media or layout failure cannot corrupt the campaign; classic/custom fallback preserved.
- **GC8.7** Same UI on the tiny template and a differently named world with different cast/map size; no hidden campus names, fixed counts or source-machine paths.

### GC9 — portability and reusable content
- **GC9.1** Reconcile T-101 and later candidates against the baseline; keep prior regression probes (dependency closure, colliding IDs, unsupported data, stale previews, rollback); integrate only reviewed owned changes.
- **GC9.2** Whole-project export: schema/module versions, mechanics identity, content, settings, selected UI, media, provenance; exclude credentials, diagnostics, private campaigns; validate manifest first.
- **GC9.3** Subset reuse (character/location/event): dependency closure and media; conflict preview; explicit rename/replace/skip; remap references; no silent package-type expansion.
- **GC9.4** Transactional import: reject malformed, incompatible, oversized or unsafe input before writing; roll back only own created files; no duplicates on repeat.
- **GC9.5** Independent recipient: export, move to a store with no original paths or media, import, Check, play, revise, Save, reopen; collision-heavy merge tested separately.
- **GC9.6** Campaign portability: supported saves replay mechanically with memories, corrections, scene position, plans and prose; unsupported mechanics versions get a clear result and retained original (no full migration).

### GC10 — independent creation and sustained play
- **GC10.1** Unfamiliar tester completes the tiny game from UI and short docs (start, author, validate, play, debug, revise, save, recover, reopen, transfer); fix blockers.
- **GC10.2** Repeat with a different world shape without private fixtures or developer edits; keep it small.
- **GC10.3** Reliability matrix: provider unavailable/malformed/slow/cancelled, stale saves, project switches, corrupt imports, missing media, old saves, partial generation, interrupted retry.
- **GC10.4** At least three 50-turn local campaigns on the specified model (social/progression; boundaries/setback/recovery; exploration/activities/promises); record inputs, replies, events, retries, context, latency; mark invalid infrastructure runs, never substitute mock output.
- **GC10.5** One 50-turn cloud comparison, only with paid-provider authorization; otherwise record an explicit local-only release decision.
- **GC10.6** Owner experience review of complete exchanges and sequences; contradictions and latency counted for diagnosis only.
- **GC10.7** Blockers (data loss, duplicate effects, privacy leaks, broken core authoring, inaccessible essential controls, agreed experience failures): reproduce, repair, rerun.
- **GC10.8** Freeze the candidate with version/hash, suite, browser checks, capability matrix, campaign evidence and owner verdict; later changes need rechecks.

### GC11 — local creator release
- **GC11.1** Reproducible package from the accepted candidate (runtime, launchers, dependencies, starter template, examples, docs); no dirty checkout.
- **GC11.2** Clean Windows setup: first launch, writable data location, occupied port, provider connection, offline mode, diagnostics. Native installer is separate.
- **GC11.3** Backup and restore of projects, media and supported saves; same-format update and rollback; explain incompatible mechanics; no full migration promise.
- **GC11.4** User docs: first-game tutorial, capabilities, creator/player/Wizard distinctions, limits, model setup, debugging, portability, extension boundary; remove stale active help.
- **GC11.5** Package review: asset provenance, third-party notices, no credentials or private projects, license files present.
- **GC11.6** Versioned completion ledger, limitations, supported configurations, recovery instructions, maintenance backlog; complete only after GC10 and clean-machine checks.

### First concrete work package (from the plan)
1. GC0.1–GC0.3: combined baseline; status of progression, test-health and candidate work.
2. Written GC2.2 compatibility contract on the existing per-turn bridge and approved pack-version requirement; no second implementation.
3. GC2.3–GC2.5 in order, keeping accepted conversation prompts except where committed state must enter them.
4. GC5.3–GC5.5 against existing recovery controls, then rerun the GC5.7 authoring loop.
5. Owner review of the GC2.8 three-encounter sequence before intimate-scene experience work.

### Decisions for this plan
- Local test model is `qwen/qwen3.8-27b` (owner Q1, 2026-10-08). The plan's line 68 and `docs/NEXT-MILESTONES.md` line 75 are updated to match; the 9B model is no longer named as a target.
- **GC2.2 compatibility contract (director judgement, 2026-10-08, per owner Q3–Q5):** one gate, the versioned pack opt-in flag. Progression effects (openings and continuations earning trust, the daily cap, stage cues) apply only in packs that carry the flag. The per-turn continuation markers are kept only as a within-flagged-save idempotency record, so a repeated turn cannot award twice; they are not a second gate. Saves without the flag, including mixed or missing-marker saves, replay exactly as before and receive no retroactive points. An unknown flag version loads read-only with no new effects. A GC2.2 worker must document the exact field names it uses and test old, new, mixed, missing-marker, unknown-version and tampered imports.
- GC2 mechanical work is unblocked by this decision.
- **Ordinary draft Save accepts incomplete drafts (owner, 2026-10-08).** Validation stays on Check and Publish. Do not add `validatePack` to the ordinary save path; `tests/studio-ui-storage.test.mjs:44` and `tests/studio-weekly-routines.test.mjs:20` pin this.
- **Ordinary draft Save gets a revision check (owner, 2026-10-08).** The draft's stored `updated` value is the revision token; a stale save is refused with the same "Stale draft revision" wording as the startup path. Fix task: `fix-draft-revision`.
- **Accepted conversation evidence is kept (owner, 2026-10-08).** The accepted-sample briefs and `tests/prose-author-reference.test.mjs` are committed in `15a6af5`, with the GC1.1 manifest at `docs/research/gc1-1-accepted-evidence-manifest-2026-10-08.json`. No raw transcripts or traces exist on disk for the accepted samples; they survive as prose excerpts only.

## Current evidence and decisions

- CP0/T-116 is recorded accepted on base `e4816ed`; its campus trace uses narration fallback. Extend uncovered successful-narration/authored-progression paths; do not repeat the same diagnostic as new work. Triage the generated `dating → dating` event.
- Progression decisions Q3/Q4/Q5/Q7/Q8/Q9 are answered in the gap analysis. This board previously recorded Q6 as answered too: authored stage first, trust fallback. Their implementation/compatibility gates remain in GC2.
- Current source contains an in-progress scene continuation bridge and per-turn replay markers. Reconcile it before building or integrating another path. The exact-quote experience cue is narrative-only and does not establish full progression.
- T-117 recorded 81 failures at `e4816ed`. On the separate fix-wave branch (`494d724`), T-118–T-129 resolve every named failure: 81 pass or are owner-decided, with 2 todos (per-character erotic scene notes at `tests/erotic-fields.test.mjs:30`; the play.mjs journal copy in `tests/stat-gates.test.mjs`). Current main-plus-local code passes 2,205 tests with zero failures. Do not redispatch the old failures or merge the branch wholesale; see the reconciled behavioural differences. Fix-wave reports live on `integrate/fix-wave`, not in main: `docs/briefs/T-126.report.md` through `T-129.report.md`.
- Later creator reports cover template/blank startup, visual rules, recovery, memory controls, live bindings, and media portability. Older gap labels are historical. Candidate presence is not integration evidence.
- Test model: `qwen/qwen3.8-27b` at `http://localhost:1234/v1`, owner-confirmed 2026-10-08; the 9B model is no longer the target. Local runs still need the usual authorization. No one-call limit; record actual requests. Paid calls require bounded authorization.
- Open owner items: (1) whether per-character erotic scene notes belong in GC3 or stay todo; (2) whether the journal scope now includes non-love-interest actors with gate and desire data (from T-129), which needs confirmation; (3) the exact `wantHint` alignment wording (owner item 8); (4) how the fix-wave branch lands: a scoped delta, not a wholesale merge, per the reconciliation above.

## Retained scope and holds

Reusable creator completion includes no-code core authoring, meaningful player experience, continuity, functional UI/media, independent transfer, and a local release. Default social/romance template and explicit blank, editable prompt/card startup, creator-owned stages/unlocks/boundaries/events, and inspectable/correctable memory remain required. A tiny sample demonstrates the workflow, not a full game's storyline.

Game UI/editor chrome redesign, installer, full mechanics migration, calendar-picked dates, and adventure remain deferred. Preserve explicit custom/legacy UI choices. Weekly authoring and content packages are integrated by ancestry; full workflow acceptance and exact historical candidate approval are separate. Preserve outstanding browser and portability gates.

Previous board text is preserved in [the pre-rewrite snapshot](../history/BOARD-2026-10-08-before-rewrite.md). Records below are historical evidence and do not override the active roadmap or establish current worker status.


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
