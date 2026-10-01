# Next milestones

Remaining work only. Shipped work and history (the Game tier build, the Fun tier, the P0–P3 rows, the attraction model and past decisions) are in [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md). The design is in [GAME-DESIGN.md](GAME-DESIGN.md).

Rules that hold for every milestone:
- The model tags or proposes. The engine clamps, prices and records, and replay never calls the model.
- A new module has to improve at least one [fun gate](#fun-gate) number on campus.
- Fun comes first and optimisation comes later (owner call 2026-09-30). Keep one model call per normal turn, but don't cut features for context size or call count until the fun gate passes.
- The owner plays on a cloud model (for example the Gemini free tier). Dev and bot runs use the local `qwen/qwen3.8-27b`.

## Order

1. **Run the M5 fun gate** (M5 is done, social-link unlocks included).
2. **Open-play tier:** O1 free-typed firsts first ([FIRSTS-PLAN.md](FIRSTS-PLAN.md)), with O0 alongside. Then O2 → O3 → O4 → O5 → O6.
3. **Fun gate** runs on campus after M5, and again after O1, O2 and O5 (the milestones that change how play feels).
4. **M4 leftovers**, the **Later** list, then **P1–P4**, where a Game or Open-play milestone needs them.
5. `after-hours` stays a test fixture only. Tests move to campus, then the pack is deleted in a reviewed change.

## Game tier (what's left)

| Milestone | Remaining | Done when |
|---|---|---|
| **M0. First playable (campus)** | Everything is built. Only the human gate is left. | The owner plays campus on a cloud model and would rather keep going than switch to Venus, and the [fun gate](#fun-gate) proxies hold. |
| **M5. Activity depth** | Steps 1–7 of [M5-ACTIVITY-PLAN.md](M5-ACTIVITY-PLAN.md) are done, social-link unlocks (`minRank`) included. | Every campus activity has a minigame. A mishap reliably produces a director beat. Getting handsy in front of a coworker has a consequence. |
| **M2 leftovers** | The looks anchor, touch pacing for guarded heroines, lore consistency across drafted scenes. The Open-play creator additions below. | Done alongside the milestone that needs them. |
| **M4. Secrecy and agreements** | The engine is shipped (uncommitted, see COMPLETED). **Still open:** Studio authoring forms, persona-bot validation on campus, fun-gate play. | Getting caught, negotiating an opening and ripple drama play out on campus, and the gate holds. |

## Open-play tier (2026-09-30)

Design: [GAME-DESIGN.md § Freedom model](GAME-DESIGN.md#freedom-model-2026-09-30). Each open mechanic keeps its authored version as a creator option.

| Milestone | What to build | Reuses | Done when |
|---|---|---|---|
| **O0. Routes never close** | Permanent closers become hurdles you can recover from. The `rejected` phase, `forbiddenFlags` dealbreakers and `blockedStates` get a cooldown plus a repair thread (a per-world setting, on by default). After a rival wins, an affair stays possible. (Her NPC partner catching you is shelved to [Later](#later).) | `dating`, `romance-network` (a rival win already only marks your relationship `broken`) | A test: after every closer (rejection, dealbreaker, breakup, rival win), a route back to each rung exists. |
| **O1. Free-typed firsts** | The talk, date, kiss and first-night rungs become free-typed scenes with 2–3 checkpoints held by the engine, scored best/light/miss from act tags. On the first night the check-in is required and Stop is always there. `authored` stays a creator option (per world and per rung). Plan: [FIRSTS-PLAN.md](FIRSTS-PLAN.md). | `world-assembly` `first()`/`night()`, `beat-library` `RUNGS`/`TONES`/`NIGHT`, `story.scenes` triggers, `social.acts`, `intimacy` gates, the M4 confrontation brief pattern | The owner plays the kiss and first night typed and they don't feel on-rails. No path skips the check-in. Authored worlds play the same as today. Replay is identical. |
| **O2. Typed actions happen** | The scene reply gets world operations: `move`, `buy`, `invite`, `extend`, `wait`. Act tags get a `ref` field (memory, like, place, callback) that sizes up the act, and unmatched acts get a wider clamp. A `refusal` object (reason, alternatives as buttons, a retry count that switches to an in-story redirect) replaces the fixed error strings. | `scene-acts`, `acts.mjs`, `service.mjs` intent path, `providers.mjs` reply format | "Take her to the roof", "buy her a necklace" and "karaoke Saturday" each change state. No player-facing system error strings are left. |
| **O3. Clock** | A tick becomes a fixed number of minutes. Every activity gets a duration and every place gets opening hours. All `*Ticks` fields are converted, and the UI shows the clock and costs like "Gym · 1h". Extending a scene costs minutes. | `daypart`, `calendar`, `public/calendar.mjs`, every module with `*Ticks` | The player can always see what an option costs in time. Validation rejects packs that mix units. |
| **O4. Inventions and threads** | A registry of invented places and items in state, with provenance, clamped to bands set per world. A `story.threads` module for goals, promises and NPC hooks, built on plans (kept or broken), with a cap on open threads. | `plans`, `economy`, `inventory`, `facts` review | An invented place can be revisited and an invented item kept. A promise comes due and changes something. |
| **O5. Game-master director** | A move list in code (complicate, consequence, agenda, world event, reveal, tempt, callback, deadline), each with limits on its effects. About 40% templates and 60% moves. A stance set per world. Mid-scene complications as a one-line brief. NPC agendas (seeded plus invented). A `dm` line type: asides, explaining a "no", and a recap at the end of each day. | `story.director`, `director-library`, `romance-network`, O4 threads | A bot run never goes quiet. Complications land inside live typed scenes. The recap names what changed. |
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
