# Next milestones

Remaining work only. Shipped work and history (the Game tier build, the Fun tier, the P0–P3 rows, the attraction model and past decisions) are in [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md). The design is in [GAME-DESIGN.md](GAME-DESIGN.md).

Rules that hold for every milestone:
- The model tags or proposes. The engine clamps, prices and records, and replay never calls the model.
- A new module has to improve at least one [fun gate](#fun-gate) number on campus.
- Fun comes first and optimisation comes later (owner call 2026-09-30). Keep one model call per normal turn, but don't cut features for context size or call count until the fun gate passes.
- The owner plays on a cloud model (for example the Gemini free tier). Dev and bot runs use the local `qwen/qwen3.8-27b`.

## Current direction (owner clarification 2026-10-04)

This section supersedes the 2026-10-03 polish-only framing and every older execution order below. Build the **reusable creator/editor capable of authoring essentially the whole kind of social/romance experience Venus University offers**: character setup, rules, events and player-facing screens. Functional capability is required; all core systems must be visually configurable, with code optional for extensions. Local Venus evidence informs the architecture/capability map without copying identity/assets or assuming exact mechanic parity.

Confirmed: social/romance template **default** plus explicit blank project; existing prompt/card startup with editable **1–8 NPCs (player excluded) and 1–8 locations**; creator-owned stages, unlocks, boundaries and events; AI improvisation and typed consequences subject to engine validation; automatic memory plus inspect/correct and optional authored facts/secrets/knowers/promises. First usable milestone is the social/romance creator. A tiny generic sample proves author/play/debug/revise/save/reopen without code edits, not a full game. Functional completeness and perceived fun/believability are separate gates.

**Assessment:** owner permission was granted after allowance uncertainty was disclosed. [T-098](research/creator-gap-assessment-2026-10-04.md) completes the systematic engine/control/workflow assessment, with 26 capability rows, source/test/revision evidence, rationale and unknowns. It does not authorize implementation or automatically accept any candidate. [Active board](briefs/BOARD.md#current-priority-2026-10-04) governs task status.

**Holds:** Creator UI = editor; Game UI = player presentation; UI Wizard edits reusable Game UI. Game UI visual redesign and editor chrome redesign remain paused. Weekly specific-over-general rules take priority, but Stage2 remains frozen/unmerged pending independent review/full checks. Installer, full mechanics migration and calendar-picked-date scheduling remain deferred. Preserve all dirty work/sessions. Adventure is LATER: narrative engine-resolved combat first, structured turn-based later; isekai social portability may be tested without RPG completion gates. Historical campus fun/module/model policies below do not authorize calls or set creator completion.

## Creator milestones (2026-10-04)

Planning proposals only; exact acceptance, dependencies, trade-offs and four next-task proposals are in [T-098](research/creator-gap-assessment-2026-10-04.md#dependency-ordered-roadmap-and-completion-gates). No workers dispatched.

| Gate | Required result | Completion evidence |
|---|---|---|
| **G0 Draft trust** | Independently review frozen weekly work; settle remaining raw-buffer/loss/recovery contract. | Exact candidate review/suite and authorized disposition; delayed Save cannot discard newer edits or switch projects; pending invalid data stays recoverable; chosen loss/recovery semantics tested. Candidate guards alone do not close refresh/startup recovery. |
| **G1 First usable creator** | Default social/romance template, explicit blank, existing startup composition and tiny complete loop. | No code/JSON in mandatory path: create/edit characters/places/stage/unlock/boundary/event → Check → play/debug → revise → Save → close/reopen/replay. Generic placeholder sample, mocks; disclosed optional gaps. This does not close G2–G5. |
| **G2 Core visual rules** | Expose existing social rules, nested gates, weekly routines and authored event constraints. | All enabled core social/romance settings editable visually; source references/pickers/diagnostics preserve advanced fields; legal/illegal branches and typed consequences agree after persistence/transfer. Reuse existing schemas/debugger. |
| **G3 Correctable continuity** | Automatic memory, authored facts/secrets/knowers/promises and diagnostics over existing stores. | Source and visibility inspection; correction precedence survives reopen/replay/reassertion; private fact stays isolated; kept/missed promise selects authored follow-up. No new competing truth store. |
| **G4 Reusable output/workflow** | Functional Wizard selection binding, media/transfer and existing player usability/author debugging. | Generic live Game UI reflects selected compatible controls/committed state; custom/legacy retained; keyboard/text/history/save/load checks; revision-bound reports/replay; independent recipient imports project/media. Functional integration needs separate scoped authorization; redesign remains paused. |
| **G5 Capability + experience evidence** | Independent no-code capability coverage, then separately authorized provider/human evaluation. | Every core requirement accounted for; tiny loop and transfer proven; later grounded voice, meaningful recurrence/memory/pacing judged from examples and traces. Mock passes or arbitrary percentages do not prove fun. |

Next proposed batch: **P1** independent Stage2 review (check existing reviewer ownership); **P2** remaining draft-preservation design decision; **P3** template/blank composition contract; **P4** visual stage-unlock + promise-condition slice specification. Sequence shared Studio/server ownership, reuse existing tools and do not launch implementation from this list. These outrank new mechanics/art/combat/installer because they make existing authoring work dependable and useful.

## Current direction (owner clarification 2026-10-03)

**Historical record:** superseded by the 2026-10-04 direction and T-098 assessment above. The pending-permission statements below describe that earlier docs-only task, not the current authorization/status.

This section governs current priority and supersedes the older order and conditional backlog below. The product is the **reusable game creator/editor**. Its end goal for now is to let a creator ship a social/romance game with **Venus University's level of polish**. Venus University is a quality benchmark, not permission to copy its visual identity or assume identical mechanics. Polished player-facing output remains a real later goal.

- **Creator UI (editor):** author and edit content and rules, play and debug, revise, save and reopen a project without editing code. Editor-first does not authorize redesigning editor chrome.
- **Game UI:** the player-facing presentation of a created game. Its existing visual redesign is paused.
- **UI Wizard:** edits reusable Game UI for creator-generated games; it is not the Creator UI. Prior wizard/Game UI implementation plans do not override the pause.
- **Tiny playable sample:** a testing vehicle for creator capabilities and the complete author/play/debug/revise/save/reopen loop, not a separate full game project. Campus evidence remains useful; campus fun is not the product's completion criterion.

**Now:** planning and an evidence-backed assessment of creator gaps before the next implementation batch. A proper systematic gap assessment has **not been completed**; its separate permission request is still pending. Existing portability, campus and UI reports are partial evidence, not that assessment. This documentation update neither performs nor authorizes it, creates implementation tickets, or dispatches work.

**Holds:** existing weekly Stage2 source is frozen and unmerged, pending independent review and full checks. EXE installer and full mechanics migration are deferred. The future creator-proof sample and later output polish remain goals, subject to planning and separate authorization. Preserve completed work and historical evidence; current task/review status is in [BOARD.md](briefs/BOARD.md#current-priority-2026-10-03).

## Prior order (2026-10-01/02; retained for history)

Re-planned 2026-10-01 (owner interview). **v1 done = campus is fun** on a cloud model, for the owner and a few friends. Felt pains: typing doesn't change the world, and characters feel flat. Work is delegated through `docs/briefs/` (see `AGENTS.md`, `docs/roles/`).

Owner decision 2026-10-02: finish Waves 5 and 6, then make sure every mechanic coded for campus ports to the game creator. No new campus-only mechanics until that is done. (Historical baseline: int-6. Reconciled 2026-10-02: int-4 through int-8 and 3483d4b have landed; uncommitted work and verification limits are listed in docs/briefs/BOARD.md.)

1. **Close Wave 5/6 verification.** T-044/T-047 landed in int-4; T-048/T-062/engine T-069 recap/T-065 landed in int-7. The earlier owner prompt update and STAGING re-enable landed in 3483d4b. Review T-043's historical measurement and unfinished T-056 bot validation, then establish current full-suite and fun-gate results. T-077 is a separate uncommitted conversation experiment; historical process termination is not a diagnosed assertion regression.
2. **Creator portability review (next after Wave 6).** T-073 audit is written; T-071/T-072 landed, while T-075 daily-need and T-076 guard patches await review. T-009b Suggest auto-fill can resume after T-080 restored its exact missing design input. For every campus mechanic (route repair, likes clues, endings, recap, planner/clock, typed actions, director, secrecy and agreement, jealousy, anniversaries, weekly wants, outreach), check three things: (a) is it a pack option or Studio control rather than hardcoded campus ids, names or strings; (b) does a pack with no campus data still validate and run; (c) is there a test on a non-campus fixture. Output: a portability table plus one fix ticket per hardcoded item.
3. **Creator-proof (parked by owner 2026-10-02).** When resumed, build a small second world from a template using only Studio, with no code edits, and play a bot run on it. Every blocker goes onto the creator backlog (T-009b Suggest auto-fill, creator leftovers). This is the real test of items 2 and 3 together.
4. **Measure and play:** establish a current campus fun gate; apply the same gate to the second world when creator-proof resumes. If dead turns <=10%, input lost 0 and spotlight spread <x2, the owner plays 1-2 h on a cloud model.
5. **Audit gaps** (only if the gate or play shows the need): director breather policy and recap-note wiring (O5, needs an owner interview); fun-command usage output; campus clues Studio activation and the deduction check (O6); unit conversion and opening hours (O3); stale-plan deadline.
6. **F1 friends-ready:** setup, retries and install doctor shipped; remaining is a packaged installer and update path.
7. Parked: O1 firsts, rest of O3, O4 invented places/items, P1-P4.
8. `after-hours` is retired (fixtures in `tests/fixtures`). Engine T-070 deleted the pack, templates and four background SVGs in cafb57d/int-8. T-074 covers remaining references and tracked-WAL cleanup; its patch is uncommitted. UI prototype work once using T-070 is now T-079.

### Status 2026-10-02 (what the last waves changed)
| Milestone | Now |
|---|---|
| C1 character depth | Shipped: voice and lore, authored outreach, plans and teasing, earned desire, jealousy (tone only), weekly wants. Open: human check that it feels alive. Anniversaries are creator-only on campus. |
| O0 routes never close | Shipped (T-053): route repair thread after rejection, dealbreaker, breakup, rival win; Studio control. Endings reachable (T-054). Open: the fun-gate run. |
| O2 typed actions | Shipped: gated typed touch, mixed actions, in-story refusals and input-delivery guards. Open: full move/buy/invite/extend/wait coverage and refusal-alternative acceptance. T-048 decline is landed; acceptance still belongs in the full typed-flow gate. |
| O3 clock | Shipped: planner slots, targeted waits, time cost labels, pack `tickMinutes` with Studio control. Open: unit conversion, durations, opening hours. |
| O5 director | Audit (T-052): thin-slice items 1/3/4 shipped, 2/5 shipped with gaps. Day recap shipped (T-051); Engine T-069 modes + popup landed (UI button work is T-078; T-064 is prompt slimming). Open: breather policy, recap-note wiring. |
| O6 likes | Opt-in clues, journal grouping (T-050); campus clue content in T-062. Open: deduction gate. |
| M4 | Studio secrecy/agreement forms shipped (T-055). Open: bot validation on campus (T-056) and fun-gate play. |
| F1 | First-run presets and probes (T-044), bounded cloud retries and usage log (T-045), install doctor (T-046). Open: packaged installer. |

## Game tier (what's left)

| Milestone | Remaining | Done when |
|---|---|---|
| **M0. First playable (campus)** | Everything is built. Current automated verification and the human gate remain; shipped mechanics do not establish fun. | The owner plays campus on a cloud model and would rather keep going than switch to Venus, and the [fun gate](#fun-gate) proxies hold. |
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

Retooled 2026-09-30.

**Who plays.** The owner plays campus on a cloud model (Gemini free tier) for 1–2 hours without hitting the free-tier limits, and would rather keep going than switch to Venus. From M2 on, the same gate also applies to a second world.

**When it runs.** After M5, and again after O1, O2 and O5.

**How it's measured.**
- Bots and proxies run on the local `qwen/qwen3.8-27b` through `npm run fun -- --pack packs/campus.json`. Campus should become the default.
- The owner's own run is measured with `npm run fun -- --campaign latest`.
- Items marked *(owner)* are the owner's judgment.

Proxies:

- **Input is never lost.** Typing always works, and no input is discarded, including the one that hits the scene budget.
- **Typed actions happen.** At least half of typed turns change state (money, affection, a memory, a calendar event, a place, a discovery). No more than 1 in 10 turns is dead (no state change and no new information).
- **No says no without a way forward.** No player-facing system error strings. Every refusal gives a reason and at least one alternative. *(From O2.)*
- **Scenes close cleanly.** Every scene closes within its budget (or within its extension, from O3), with a reply to the last input.
- **Early hooks.** The first liked/disliked reason comes within 5 minutes, and the first rung on the ladder of firsts within 15 minutes.
- **Firsts don't feel on-rails** *(owner, from O1)*. No path reaches intimate prose without consent in state, or keeps going after a stop (tests, including typed attempts).
- **The world is never quiet.** The director never leaves more than 1 quiet daypart.
- **Deduction works.** After an hour the player can name 2+ likes per love interest from hints, and say what they're working toward with each without seeing a number *(owner)*.
- **Routes never close.** No test path permanently closes a rung *(from O0)*. A full run reaches an ending, and different play reaches at least 2 different endings.
- **Cost is recorded, not optimised.** Model calls and tokens per hour are logged, so the free-tier budget is known. They only become a target after the gate passes.

## Campaign evaluation gate

Before calling the framework production-ready, run at least three 50-turn campaigns on the local test model and one cloud model. Record contradictions, invalid casts, unresolved requests, retries, context size, repeated prose, save recovery, queued-scene behavior, overdue plans and average latency. Every mechanical outcome must replay identically after export/import.

The request budget is part of this gate:
- A normal continuation uses one model request that returns dialogue, scene summary, character memories and sourced facts together.
- A natural scene ending doesn't trigger a second closing request.
- Deterministic and authored actions use no request.
- An unresolved free-form action may use one classification request before its single scene request.
- Track physical HTTP attempts, including schema fallbacks and repairs.
