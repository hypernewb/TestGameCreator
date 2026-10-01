# Director as DM: design card

Status: decided · Replaces/merges O4 (threads) + O5 (game-master director) from [NEXT-MILESTONES.md](../NEXT-MILESTONES.md)
Source research: [director-as-dm-2026-10-01.md](../research/director-as-dm-2026-10-01.md) · [DRAMA-DIRECTOR.md](../DRAMA-DIRECTOR.md) · [DIRECTOR-V2.md](../DIRECTOR-V2.md)

## Goal (what the player feels)

The world has a mind. Something I did is still unfolding tomorrow, the people I ignore have their own business, and the game is visibly about *these* characters rather than a queue of moments.

## What we have (self-audit)

`packages/modules/director.mjs` is a deterministic tension clock: tension rises on committed events, decays with the clock, and a streak of quiet dayparts draws an authored beat. It has teaser-arming, deck discipline (uses, cooldowns, recent penalty), per-character attention, goal deadlines, intensity tiers, and a `story.starved` signal. `packages/cards/director-library.mjs` holds 12 beat shapes; `role-slots.mjs` and `director-templates.mjs` bake role slots over the cast.

Gaps, verified against the code:

- **A live tease defect.** `adaptiveBeat`'s pool is `[...complications, ...offers]`. The tease block arms whatever `bestOf` returns, including an `offer`. An armed offer is dealt into `state.offers` as an optional card, then filtered out of `adaptivePool` on the next boundary, so it never fires and resolves to `story.teaserPassed`. The player sees a tease, an ignorable card, and a release notice — no drama. The tease is technically honest and still feels broken.
- **Dismissed beats are recorded and ignored.** `story.leave` writes `{scene, beat, tick, status:'dismissed'}` into `story.scenes.history` and emits `story.sceneDismissed`. The director has no handler. Data exists; nothing reads it.
- **No callback memory.** The director cannot quote anything the player did, because it never reads `scenes.history`.
- **The library is romance-only.** All 12 beats need a `lead`; 9 also need a `rival`; roles are hardcoded to `{pool:'dating'}` in `director-library.mjs:41`.
- **No per-character stance, no thread state, no recap.**

`role-slots.mjs:8` already resolves any pool — an explicit ID list, `'dating'`, or `'cast'` (all non-player actors). Studio's director editor only exposes `roles.lead.pool[0]` as one free-text field.

## Reference games

- **Left 4 Dead AI Director** (Hunicke 2005) — maximises drama, not difficulty: builds a curve, then deliberately inserts breathers to reset it.
- **RimWorld storytellers** — Cassandra runs a recognisable ~10.6-day on/off rhythm; Randy is widely considered the better *story* engine because variance produces stories. Threat scales to colony wealth, not elapsed days.
- **AI Dungeon / 2025–26 LLM-DM wave** — the winning pattern is structured memory cards surfaced selectively, so the narrator stays consistent over long arcs.
- **Date Everything!** — ~100 romances, each an authored arc (hook → complication → payoff). Arc *shape* is what makes authored content feel directed.
- **Monster Prom** — every event has an explicit outcome; the player reads the shape before committing.
- **Façade / Versu** — the engine picks the beat, the model only voices it. Already our rule; keep it.

## Owner decisions (dated; every number lives here)

- 2026-10-01 Ignored beats escalate **once**, then resolve or expire, with a repair path. Overrides the "no persistent grievance" rule for director-dealt beats only; authored grudges stay out.
- 2026-10-01 Pacing presets stay **internal**. `toneCeiling` and `textMode` are the only creator dials — both already shipped. Do not expose cassandra/randy/phoebe. *(`GAME-DESIGN.md:147` therefore stands; the research doc's proposal #6 is dropped.)*
- 2026-10-01 Role pool widens to **all NPCs**. Creators define shapes; the code library gains a few defaults.
- 2026-10-01 Threads + moves list + per-character stance + day recap are **one system**, built together.
- 2026-10-01 Day recap is **both** a short visible element and an AI prompt input.
- 2026-10-01 DM stance is **per-character**, not per-world and not derived from `toneCeiling`.
- 2026-10-01 No free-form generation authority: deterministic engine picks when and what shape, authored scenes say what, the model voices it.

## Creator option (field, modes, campus default; creator UI screen)

- `directorRolePools` on library beats: `dating` (default) | `cast`. Non-romance defaults ship as `cast`.
- Per-character stance lives on the character sheet, not the world. Three values: `friendly`, `fair`, `adversarial`. Default `fair`. Missing = `fair`.
- Existing `toneCeiling` and `textMode` remain the only world-level dials. Nothing new at world level.
- Studio: extend the director editor's role field from one free-text ID to a pool picker (`lead` / `rival` / `witness` / `partner` / `bystander`, each with a pool choice), and add the stance field to the character sheet.

## Thin slice → full version

**Thin — `director.mjs` only, no pack changes, no new content:**

1. Never arm or tease an `offer`. Filter `delivery: 'offer'` out of the tease candidate set. Fixes the live defect.
2. Handle `story.sceneDismissed`: a dismissed beat re-arms at `tone+1` **once**, capped, and writes a line into a new `story.scenes`-adjacent note the recap can read. After the cap, the thread resolves or expires. No second escalation.
3. Read `story.scenes.history` to build a callback line (`who, what, day, choice`) and feed one line into `directorContext`. Budget: one line, oldest-dropping, never displacing scene-critical context. *Shipped 2026-10-01, plus the authoring half of the original #3: `{last}` in an authored beat's `text` or `tease` is replaced at deal time with the callback line, so a beat can quote what actually happened ("Remember {last}?") — see `DIRECTOR_NOTE` for drafters.*
4. Spotlight: penalise a second consecutive beat on the same `focus` in `bestOf`. **Shipped 2026-10-01: `lastFocus` tracked on every deal path, and the −12 quiet-mode term is armed with two guards learned from the gates** — it stays dormant while the deck is all-romance (detected per draw from `datingProfiles`; over that deck the penalty only suppressed whoever the player was courting, dropping the planner courtship gate from 4 to 3 rival beats), and it never points away from the most-attended character. Any pack that widens the pool (step 10's non-romance shapes) arms it automatically. `fun-metrics.spotlight` measures the equity.
5. Forced breather: after any tone-3 resolves, the next draw is weighted hard toward tone-1 and draws no complication. Reuse an existing low-tone opportunity or a `hand` beat — **no new content**. *Shipped 2026-10-01: offers first when budget allows, else a hard tone-1 lean; an active focus/recovery arc outranks the reset; the escalation after an ignored beat can itself trigger one.*

**Thin-slice build note (2026-10-01).** Steps 1, 2, 3 and 5 shipped in `director.mjs` (adaptive packs only for the escalation, so legacy fixtures stay frozen), plus two of the owner-directed extras: the callback line also feeds a `glance back at the last thing that happened` opening move in `beatDirection` (a third of openings, when no memory callback fires), and an owed escalation can never fire in the same command that dismissed the beat — leaving releases the clock, and the same-breath boundary would restart the scene the player just walked out of. Tests: `tests/director-dm.test.mjs` (8), full suite 892/892.

**Full — needs a brief, and O4/O5 merge into it:**

6. Threads: 3–5 persistent `{id, cast, question, clock, stakes, tease}`. A clock ticks on related beats, on the player acting, and on elapsed time regardless of play. When full, it resolves into its authored showdown or an off-screen consequence. Deterministic; the model narrates the thread line only.
7. Moves list in code (`complicate, consequence, advance, agenda, world event, reveal, tempt, callback, deadline`), each with an effects allowlist. Target mix ~40% templates / 60% moves, all with provenance.
8. Per-character stance feeds selection bias: adversarial characters weight toward obstacle and temptation beats; friendly ones toward event and goal beats.
9. NPC agendas as state: 1–2 seeded per heroine, advanced by moves, surfaced in the recap.
10. Non-romance defaults in `DIRECTOR_LIBRARY`: `roommate`, `study-partner`, `work`, `world-event`, `witness`. Widen `role-slots` usage in the library from `pool:'dating'`.
11. Day recap: derived from committed state like `directorContext`. Rendered as a short visible card at day start and injected as one context line. Names what changed, which threads advanced, and what is at stake.
12. Story-wealth scaling: replace `tierOf()`'s day basis with a floor, or a parallel wealth axis. `tierOf` currently gates complications *and* opportunities, so a romance-averse player must still have a content path.

## Fun rubric notes (agency, surprise, payoff, repetition)

- **Agency:** the recap must state what is at stake before the deadline, not after. Ignored beats must be announced as consequences, never silent.
- **Surprise:** a tease may promise a *question*, never a specific event it might not deliver. Breathers are predictable by design and should feel like relief, not a lack of content.
- **Payoff:** a filled clock resolves into something the player could have prevented. The repair path after a capped escalation is part of the payoff, not an afterthought.
- **Repetition:** spotlight rotation is only meaningful with a mixed deck. Step 5 without step 10 will produce the same three romance beats with different names.

## Falsification (run before building step 6+)

The research doc proposed none of this. Seed 3× 15-day campus runs and record the instruments `fun-metrics.mjs` already computes: `trailingDrought`, `zeroBeatWindows`, `maxQuietDayparts`, `firstDrama`, `deadRatio`, `repeatedProse`.

**Results (2026-10-01, `scripts/falsify-director.mjs`, no model, 3 seeds × 15 days × 2 profiles, HEAD vs HEAD~1):**

| profile | instrument | baseline (pre-thin-slice) | HEAD (thin slice) |
|---|---|---|---|
| both | `maxQuietDayparts` | 0 on all runs | 0 on all runs |
| both | `zeroBeatWindows` | 0 on all runs | 0 on all runs |
| both | `trailingDrought` | 0.2–0.9m | 0.2–0.9m |
| player | storylets seen | 17–18/112 | 17–18/112 |
| ignorer | storylets seen | 4/112 | 4/112 |
| ignorer | spotlight spread | ×2.8–6.3 | ×2.8–6.3 (one extra escalation beat, seed 3) |

- **The quiet instruments are saturated — they cannot falsify threads.** The world never goes quiet on seeded runs, before or after the thin slice; the card's warning was correct ("it already passes on seeded runs"). The flat-purgatory symptom lives in *typed play patterns* (attention-driven), not in the deterministic driver. `deadRatio` and `repeatedProse` are not-exercised without a model and need a real playtest run.
- **The sensitive instruments are content breadth and spotlight equity.** The ignorer profile collapses storylets to 4/112 — beats keep firing (escalations recycle) but the player sees almost nothing new — and spotlight spread reaches ×6.3 when the player never chooses. If claim 3 (mixed deck fixes starvation) is right, `storylets.seen` is the number that moves, not the drought metrics.
- **Revised falsifiers for step 6+:** threads must be judged on (a) storylets breadth for low-effort play (ignorer storylets rising from 4), (b) spotlight spread falling under the mixed deck once rotation arms, (c) typed-play instruments from a model-backed run. TrailingDrought/zeroBeatWindows stay as tripwires, not targets.

**Typed-play falsification (2026-10-01, `scripts/ai-game-tester.mjs --pack campus.ashford --days 5`, qwen/qwen3.8-27b, 65 turns):**

`fun[measured]: 65 turns 14.1m | dead 16 (25%, streak 8) | typed 41 (73% landed) | quiet max 0 | storylets 7/112 | repeat prose 0% | lost inputs 11 | spotlight jana:8 nova:8 abigail:3 (×2.7)` — gate: dead-turns **NO** · input-lost **NO** · the rest ok.

- **The real typed-play symptom is not drought — it is the scene stall.** Turns 56–67 sat in one free scene for 12 consecutive turns with the clock frozen (`TIME 56→56`), producing the entire dead-turn streak (25% dead vs the ≤10% gate) and the tester's top engine finding ("scene fatigue: after N free turns, force a transition or interruption").
- **That stall is the director's job.** The critic's prescribed fix is precisely `dealNow()` — a mid-scene interruption when a scene runs N free turns with no state change. The director currently only fires on mishaps, witnessed touches and quiet dayparts; a **stall interrupt** (free-turn counter with no committed change → in-scene incident or daypart close) is the evidence-backed next build, ahead of threads.
- **Lost inputs 11/41** is the second gate failure and is an engine/refusal-path issue (e.g. "Finish the current planner activity first" swallowed a turn), not a director issue — but it must be on the same fix list.
- World-quiet held at 0 in typed play too, confirming the quiet instruments are saturated. Spotlight spread ×2.7 with rotation dormant (all-romance deck), as designed.
- Model-layer findings for the prompt pass (not director scope): calendar hallucination ("Tuesday" on Day 5 Friday), player-input echo at Turn 65, NPC-location invention, RESULTS dedup, prop fixation.

Pre-run claims (kept for provenance; the results above supersede them as falsifiers):

- `trailingDrought` and `zeroBeatWindows` are the "flat purgatory" and "starves at the end" symptoms directly. If steps 1–5 move neither, the diagnosis in the research doc is wrong and threads will not fix it either.
- Claim: threads fix it. Falsifier: runs with a thread visible in the recap show no improvement in those two metrics.
- Claim: ignored-beat escalation helps. Falsifier: `maxQuietDayparts` and `deadRatio` unchanged.
- Claim: a mixed deck fixes starvation. Falsifier: `storylets.seen/total` does not rise.

Do not promote "the world never goes quiet" to an acceptance criterion without these numbers. It already passes on seeded runs.

## What NOT to do

- No free-form generation authority. Every rival that gave a director that lost authorial control and hit consent and coherence problems this architecture deliberately avoids.
- No second escalation. One capped consequence with a repair path; never a resentment simulator.
- No armed offers. A tease is a promise of a question, not of a card.
- No recap line that displaces scene-critical context under the token budget.
- No authored grudges. The director's consequence is a clock resolving, not a character nursing a grievance.
