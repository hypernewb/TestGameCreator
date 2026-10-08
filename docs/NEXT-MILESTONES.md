# Next milestones

<a id="current-direction-owner-clarification-2026-10-04"></a>
<a id="current-direction-owner-clarification-2026-10-03"></a>

## Current direction (2026-10-07)

Codex owns the player experience in this order: **fun chatting -> fun character progression -> fun erotic scenes -> fun game elements -> others**. Owner decision (2026-10-08): the warm conversation reads decent enough to retain temporarily and unblock other systems. **Character progression is next.** The quiet persona remains unsatisfactory and deferred. This is provisional owner acceptance of the reviewed conversation, not proof that all voices are solved or that Venus parity has been established. Tests establish technical behaviour, not enjoyment.

Flirting is essential to the erotic dating-sim experience and differs by character. Individual exchanges may instead build interest, reveal personality, establish trust or tension, or make time together enjoyable. Neither constant flirting nor romantic escalation on every turn is required. Evaluate purposeful ordinary conversation and character-specific flirting in complete exchanges; neither compensates for poor writing in the other.

The other AI owns creator/editor and profile authoring. Exact reserved and shared files are in [AGENTS.md](../AGENTS.md#owner-direction-and-file-ownership-2026-10-07-takes-precedence). Coordinate shared files; preserve all existing dirty work. Creator completeness is not a prerequisite for the chatting quality gate. Do not build a full sample game's storyline.

## Immediate work

- Retain the accepted temporary author references: Leonard fallback, explicit Parker selection, and Montgomery without extra wordplay for the tested warm-socialite persona. Quiet-persona improvement remains a later refinement.
- Character progression is next. Start with CP0, a read-only trace of the existing path from interactions through remembered events, relationship changes and follow-up opportunities; see [Character progression milestones (2026-10-08)](#character-progression-milestones-2026-10-08) and the [gap analysis](research/progression-gap-2026-10-08.md). Reuse existing systems; check actual runtime behavior before selecting fixes.
- Judge progression through coherent playable sequences and owner review, alongside state/persistence checks. Do not substitute score changes or green tests for enjoyable progression.
- Preserve creator ownership, shared-file coordination and other existing holds. Broader feature work follows the stated priority order.
- Review [comparison preparation](briefs/T-venus-framework-comparison.report.md) before any claim of faithful Venus parity; the author tests are not that comparison.

## Execution constraints

- The one-call-per-turn restriction is removed. Separate classification, narration and closing calls may be evaluated; record total physical requests, cost and latency.
- Paid inference requires bounded approval. Existing preparation authorizes no calls. No provider is assumed free.
- If local testing is authorized: http://localhost:1234/v1. Model: **owner to confirm**. This document previously named qwen3.5-text-9b-nsfw-rp-roleplay-i1 (owner instruction); [CLAUDE.md](../CLAUDE.md) names qwen/qwen3.8-27b. No local model call is authorized by this document until the owner confirms which is current.
- Preserve deterministic state validation and replay. Do not infer that good writing requires discarding them.
- Existing Game UI/editor chrome redesign holds remain; this task changes documentation, not those holds. Weekly Stage2 disposition needs coordination with its owner. Adventure, installer, full mechanics migration and calendar-picked dates remain deferred.

## Character progression milestones (2026-10-08)

Codex order item 2: fun character progression. Evidence, file references and the owner questions are in the [progression gap analysis](research/progression-gap-2026-10-08.md). Only CP0 is authorized for implementation work now; the others start after the owner answers the question marked for them. Owner judgment of complete exchanges is the completion test. Trust, bond and stage values are evidence, not the gate.

| Milestone | Scope | Done when |
|---|---|---|
| **CP0. Read-only progression trace** | Scripted `GameService` run on a shipped pack (campus) and a generated route pack, in a temp DB or `:memory:`, with no model calls. After each encounter record trust, bonds, dating phase, stage label, experience cue and memories. Trace the dating/tempo milestones and breakup/settlement paths, which are unverified in the gap analysis. | Trace report lists each signal per encounter with file:line evidence; export/import replay is identical; no code change. Not a fun claim. |
| **CP1. Reaction coverage** (owner decision) | Decide whether authored `dialogueReactions` fire on `core.sceneStarted`, and whether ordinary `core.scene` talk earns generic trust. | Decision recorded. No implementation before CP2. |
| **CP2. Versioned pack flag** | Any new trust-earning path sits behind an opt-in pack field included in `mechanicsDigest`, default off for existing packs. `schemaVersion` stays 1. | Historical command replay is unchanged in tests; flag-on and flag-off replay tests exist; `npm test` is green. |
| **CP3. Experience-to-mechanics** (owner decision) | Decide whether exact-quote experience may drive bounded mechanics. Recommendation: author-declared `dialogueReactions` is the only mechanical route; the exact-quote recognizer stays a prompt cue; no second recognizer. | Decision recorded. If accepted, only CP2-flagged paths use it. |
| **CP4. Authored stage cue** (owner decision, then build) | Decide whether authored progression state feeds `relationshipStageOf` and the beats `STAGE` tones, which currently use trust thresholds. The `relationshipStages` override is inert on the service path. Pack authoring fields touched here stay with the creator lane per [AGENTS.md](../AGENTS.md#owner-direction-and-file-ownership-2026-10-07-takes-precedence). | Prompt-visible stage label follows the decision; tests cover precedence over dating phase and trust thresholds. |
| **CP5. Owner-reviewed multi-encounter exchanges** | Complete exchanges across at least three encounters, on a shipped pack and on a generated pack, with state checks and export/import replay. No weighted score. | Owner judgment on the transcripts; state checks pass; replay is identical. |
| **CP6. Daily trust cap default** (owner decision) | Decide whether social packs without `romanceTempoProfiles` get the daily trust cap by default. Opt-in until decided. | Decision recorded. If the default changes, it goes behind the CP2 flag so historical replay is unchanged. |

Order: CP0 first. CP1, CP3, CP4 and CP6 wait for owner answers. CP2 precedes any engine change. CP5 is the completion check for the whole section.

## Creator milestones (2026-10-04)

Creator-owned capability reference, not Codex execution order. Exact acceptance, dependencies, trade-offs and earlier task proposals are in [T-098](research/creator-gap-assessment-2026-10-04.md#dependency-ordered-roadmap-and-completion-gates). Current worker status is not established by this dated assessment.

| Gate | Required result | Completion evidence |
|---|---|---|
| **G0 Draft trust** | Independently review frozen weekly work; settle remaining raw-buffer/loss/recovery contract. | Exact candidate review/suite and authorized disposition; delayed Save cannot discard newer edits or switch projects; pending invalid data stays recoverable; chosen loss/recovery semantics tested. Candidate guards alone do not close refresh/startup recovery. |
| **G1 First usable creator** | Default social/romance template, explicit blank, existing startup composition and tiny complete loop. | No code/JSON in mandatory path: create/edit characters/places/stage/unlock/boundary/event → Check → play/debug → revise → Save → close/reopen/replay. Generic placeholder sample, mocks; disclosed optional gaps. This does not close G2–G5. |
| **G2 Core visual rules** | Expose existing social rules, nested gates, weekly routines and authored event constraints. | All enabled core social/romance settings editable visually; source references/pickers/diagnostics preserve advanced fields; legal/illegal branches and typed consequences agree after persistence/transfer. Reuse existing schemas/debugger. |
| **G3 Correctable continuity** | Automatic memory, authored facts/secrets/knowers/promises and diagnostics over existing stores. | Source and visibility inspection; correction precedence survives reopen/replay/reassertion; private fact stays isolated; kept/missed promise selects authored follow-up. No new competing truth store. |
| **G4 Reusable output/workflow** | Functional Wizard selection binding, media/transfer and existing player usability/author debugging. | Generic live Game UI reflects selected compatible controls/committed state; custom/legacy retained; keyboard/text/history/save/load checks; revision-bound reports/replay; independent recipient imports project/media. Functional integration needs separate scoped authorization; redesign remains paused. |
| **G5 Capability + experience evidence** | Independent no-code capability coverage and separately authorized provider/human evaluation. | Every core requirement accounted for; tiny loop and transfer proven; Chat quality is evaluated now in the Codex lane; broader recurrence/memory/pacing require their own evidence. Mock passes or arbitrary percentages do not prove fun. |


## Deferred design reference

The following feature definitions retain earlier design decisions. They are not the current work order, current implementation verification, or prerequisites for enjoyable chatting. Dated shipped claims require their original reports and current source before reuse. No new work is authorized by this backlog.

## Game tier (what's left)

| Milestone | Remaining | Done when |
|---|---|---|
| **M0. First playable (campus)** | Everything is built. Current automated verification and the human gate remain; shipped mechanics do not establish fun. | The owner plays campus on a cloud model and would rather keep going than switch to Venus, and the owner judges the [fun gate](#fun-gate) exchanges enjoyable. |
| **M5. Activity depth** | Steps 1–7 of [M5-ACTIVITY-PLAN.md](M5-ACTIVITY-PLAN.md) are done, social-link unlocks (`minRank`) included. | Every campus activity has a minigame. A mishap reliably produces a director beat. Getting handsy in front of a coworker has a consequence. |
| **M2 leftovers** | The looks anchor, touch pacing for guarded heroines, lore consistency across drafted scenes. The Open-play creator additions below. | Done alongside the milestone that needs them. |
| **M4. Secrecy and agreements** | The engine is shipped; COMPLETED retains its original historical status. **Still open:** persona-bot validation on campus (T-056), fun-gate play. Studio authoring forms shipped (T-055). | Getting caught, negotiating an opening and ripple drama play out on campus, and the gate holds. |

## Open-play tier (2026-09-30)

Design: [GAME-DESIGN.md § Freedom model](GAME-DESIGN.md#freedom-model-2026-09-30). Each open mechanic keeps its authored version as a creator option.

| Milestone | What to build | Reuses | Done when |
|---|---|---|---|
| **O0. Routes never close** | Permanent closers become hurdles you can recover from. The `rejected` phase, `forbiddenFlags` dealbreakers and `blockedStates` get a cooldown plus a repair thread (a per-world setting, on by default). After a rival wins, an affair stays possible. (Her NPC partner catching you is shelved to [Later](#later).) | `dating`, `romance-network` (a rival win already only marks your relationship `broken`) | A test: after every closer (rejection, dealbreaker, breakup, rival win), a route back to each rung exists. |
| **O1. Free-typed firsts** | The talk, date, kiss and first-night rungs become free-typed scenes with 2–3 checkpoints held by the engine, scored best/light/miss from act tags. On the first night the check-in is required and Stop is always there. `authored` stays a creator option (per world and per rung). Plan: [FIRSTS-PLAN.md](FIRSTS-PLAN.md). | `world-assembly` `first()`/`night()`, `beat-library` `RUNGS`/`TONES`/`NIGHT`, `story.scenes` triggers, `social.acts`, `intimacy` gates, the M4 confrontation brief pattern | The owner plays the kiss and first night typed and they don't feel on-rails. No path skips the check-in. Authored worlds play the same as today. Replay is identical. |
| **O2. Typed actions happen** | The scene reply gets world operations: `move`, `buy`, `invite`, `extend`, `wait`. Act tags get a `ref` field (memory, like, place, callback) that sizes up the act, and unmatched acts get a wider clamp. A `refusal` object (reason, alternatives as buttons, a retry count that switches to an in-story redirect) replaces the fixed error strings. | `scene-acts`, `acts.mjs`, `service.mjs` intent path, `providers.mjs` reply format | "Take her to the roof", "buy her a necklace" and "karaoke Saturday" each change state. No player-facing system error strings are left. |
| **O3. Clock** | A tick becomes a fixed number of minutes. Every activity gets a duration and every place gets opening hours. All `*Ticks` fields are converted, and the UI shows the clock and costs like "Gym · 1h". Extending a scene costs minutes. | `daypart`, `calendar`, `public/calendar.mjs`, every module with `*Ticks` | The player can always see what an option costs in time. Validation rejects packs that mix units. |
| **O4. Inventions and threads** | A registry of invented places and items in state, with provenance, clamped to bands set per world. `story.threads` for goals, promises and NPC hooks, built on plans (kept or broken), with a cap on open threads. **Thread state is now part of O5** (see [design/director-dm.md](design/director-dm.md)); this row keeps only invented place/item provenance. | `plans`, `economy`, `inventory`, `facts` review | An invented place can be revisited and an invented item kept. A promise comes due and changes something. |
| **O5. Game-master director** | **Merged with O4 into [design/director-dm.md](design/director-dm.md).** Threads and the moves list are one system, not two milestones. Ship the thin slice first (`director.mjs` only): never arm/tease an offer; capped ignored-beat escalation reading `story.scenes.history`; history-fed callback line; spotlight weight; forced tone-1 breather reusing existing content. Then the full version: threads with clocks, moves list, per-character stance, NPC agendas, non-romance library shapes over a widened role pool, and the day recap. | `story.director`, `director-library`, `role-slots`, `romance-network` | Thin slice: no tease is ever followed by an ignorable card; a dismissed beat produces exactly one capped consequence with a repair path. Full: a bot run never goes quiet, complications land inside live typed scenes, and the recap names what changed. Falsify with `trailingDrought` / `zeroBeatWindows` / `maxQuietDayparts` over 3 seeded 15-day runs before promoting any of it. |
| **O6. Likes puzzles** | Hints only, never exact answers. Each character's likes list is open or closed, set by the creator. Clues come from acts that land, friends' gossip, the recap, and surprise discoveries. | `dating` preferences, journal, `gossip` | The player can name 2+ likes per love interest from hints alone (fun gate). |

Creator (M2) additions, done alongside the milestone that needs each one: the freedom dial, the firsts mode, checkpoint cues, per-world bands, open or closed likes, agenda seeds, and the game-master stance.

## Later

- **Rival check (shelved 2026-09-30):**
  - her NPC partner can grow suspicious of you and catch the two of you;
  - it builds on O0 plus `social.secrecy` suspicion, with the partner as the watcher.
- **Roguelike cards:** deal 3 plus a basics row, built on the F2 hand; deckbuilding after that.
- **Runtime AI director events** as a supplement to the template library (partly covered by O5).
- **Run-shape presets:** roguelite (isekai) and forever sandbox.
- **Reputation arc and NPC-to-NPC relationships** beyond what M4 shipped.
- **after-hours regeneration check (optional):** regenerate an after-hours-like premise through the wizard, to see whether the premise or the old systems were the problem.

## P1–P4 (after the Game and Open-play tiers)

Work these only where a Game or Open-play milestone needs them. Shipped rows are in COMPLETED.

| # | What's left | Done when |
|---|---|---|
| 8. Scene-plan authoring | Richer queue/debug explanations (variables, prerequisites and path analysis are shipped). | An author can build and inspect a multi-scene storyline without JSON. |
| 10. Context diagnostics | Per-section prompt cost, selected/omitted memories, stale and conflicting facts, due plans. Recency/salience tuning with a deterministic trace (slot corrections are shipped). | A 50-turn run stays in budget, and a creator can explain why each fact entered the prompt. |
| 11. Creator validation UX | Replace the remaining conditions/effects that are only editable as advanced JSON. Reference pickers, inline validation, dependency and duplicate-ID warnings, a publish checklist. | Every runtime rule can be authored in Studio, and bad references are located before publish. |
| 12. Desktop release safety | Portable packaging, data-folder selection, backup/restore, log export, model diagnostics, a tested update path. | A clean Windows machine can install, play, back up, update and restore without dev tools. |
| 12A. Venus-style loop | The typed three-day playtest (the lifecycle, invitations and Characters view are shipped). Mostly overtaken by M0/O2. | A three-day story completes mainly by typing. |
| M-F. Timed events | Calendar-date authoring and a richer recap presentation. Folds into O3. | A missed event advances the world, and the player learns what happened. |
| M-G. Card import/export | Studio import/export buttons (the routes are ready). | — |
| 13. Items | Persistent item attributes. | — |
| 14. Relationship progression | State visibility, plan consequences, cooldowns, witnessed actions, contradiction review. | Kept and broken commitments unlock different scenes without leaking private knowledge. |
| 15. World conditions | Expanded debugger explanations. | — |
| 18. Attraction and endings | Richer witness provenance, Studio forms for route endings. | Different characters are drawn to the same player for different reasons, and prose can't award an ending. |
| 19. Intimacy contract | Holds as the safety rule for M0.6 and O1: explicit adult declaration, consent state, fade-to-black alternatives. Keep its tests green. | Declined, withdrawn or ambiguous consent never enters an intimate scene. |
| 20. Phone and feed | Polished presentation, relationship-conditioned content variants. | — |
| 24. Accessibility | A keyboard and narrow-screen QA pass for Studio. | Creator flows pass the checklist. |
| 25. Audio and animation | Authored music/SFX/voice, channel volumes, fades, expression transitions. | Cues never affect replay, and missing media fails safely. |
| 26. Asset workflow | Reusable character packages, pose/outfit sets, batch validation, provenance. ComfyUI comes after the manual workflow works. | Assets can be replaced without broken references. |
| 27. Education | Classes, grades, exams. Only if a campus game needs more than generic activities. | — |
| 28. Genre progression packs | Careers, survival, crafting, combat or powers. | — |
| 29. Sharing | Pack export with manifests, compatibility checks, rating metadata. | — |
| 30. Model adapters | Provider adapters, context negotiation, capability detection, retry/reword flows. | — |
| 31. Dialogue graphs and offline replay | One request authors a bounded branch graph, and recorded branches replay without a model. | An offline replay produces the approved pages and effects. |


## Fun gate

The owner reviews complete exchanges for enjoyable VN-style writing, character-specific voice, purposeful conversation, and fitting flirting. Expressions/actions should support the dialogue; player contributions may be interwoven. Incidental embellishment is allowed, but consequential player decisions and authoritative state must not be invented. No weighted score, mandatory topic churn, question quota, state-change frequency or forced escalation can certify fun.

Non-numeric invariants (restored from the 2026-09-30 gate; the owner's judgment still decides):

- **Input is never lost.** Typing always works, including the input that hits the scene budget.
- **No says no without a way forward.** No player-facing system error strings. Every refusal gives a reason and at least one alternative.
- **Scenes close cleanly.** Every scene closes within its budget or extension, with a reply to the last input.
- **Firsts don't feel on-rails.** No path reaches intimate prose without consent in state, and none continues after a stop (tests, including typed attempts).
- **Routes never close.** After any closer, a test path can return to each rung.
- **Cost is recorded, not optimised.** Model calls and tokens per hour are logged. They become a target only after the gate passes.
- **Deduction and endings are owner judgment.** The owner decides whether the player can name what they like about each love interest, and whether different play reaches different endings.

Retired numeric proxies (2026-10-08, proposed; owner to confirm): at least half of typed turns change state; no more than 1 in 10 turns is dead; first liked/disliked reason within 5 minutes; first ladder rung within 15 minutes; no more than 1 quiet daypart; 2 or more likes per love interest; 2 or more endings. These were counts, not evidence of enjoyment. They are replaced by owner review of complete exchanges.

## Campaign evaluation gate

The owner provisionally accepted chatting on 2026-10-08, so character-progression evaluation is the next player-experience priority. Whole-campaign evaluation remains a separately scoped task. Preserve checks for continuity, cast, unresolved requests, repeated prose, save recovery, queued scenes, plans and latency. Verify mechanical replay across export/import when evaluating those features. Record model calls, repairs and retries rather than enforcing a one-call architecture.

Before calling the framework production-ready, run at least three 50-turn campaigns on the local test model and one on a cloud model. Record, without enforcing: contradictions, invalid casts, unresolved requests, retries, context size, repeated prose, save recovery, queued-scene behaviour, overdue plans and average latency. Every mechanical outcome must replay identically after export/import.

Request budget, recorded per turn:
- A normal continuation uses one model request that returns dialogue, scene summary, character memories and sourced facts together.
- A natural scene ending does not trigger a second closing request.
- Deterministic and authored actions use no request.
- An unresolved free-form action may use one classification request before its single scene request.
- Track physical HTTP attempts, including schema fallbacks and repairs.
