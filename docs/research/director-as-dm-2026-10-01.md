# Director as DM — rival research + innovation proposals

Date: 2026-10-01. Status: **superseded for design by [design/director-dm.md](../design/director-dm.md).** Rival research below stands. The proposal section is retained for provenance but several claims did not survive code review — see the Corrections block at the end, which wins where the two disagree.

Framing: the director should function like a D&D dungeon master. This doc analyzes the gap between the current director and a DM, surveys rival games, and proposes ranked innovations. Nothing here is decided or implemented.

## TL;DR

The current director is a **timing system**: it schedules *when* drama happens (tension, quiet detection, teases, decks), but the drama itself is pre-authored. A real DM does something different: they maintain **living questions**, remember everything, escalate what you ignore, and balance the spotlight across the cast. The biggest upgrade isn't a new mechanic — it's giving the director **memory and intent between beats** (PbtA-style "fronts/threads" with countdown clocks) and **off-screen consequences** for beats you ignore. Everything else follows from those two.

## What the director already is (current state)

`packages/modules/director.mjs` (269 lines) + `packages/cards/director-library.mjs` (12 beat shapes: `invite, hand, crowd, bad-day, saw-you, rumor, showdown, promise, big-night, spark, late-text, close-call`; kinds `event|obstacle|goal|temptation`, tone 1–3). Packs bake via `withDirector()` / `readPack()` (`packs/director/<world>.json`). Design docs: `docs/DRAMA-DIRECTOR.md`, `docs/DIRECTOR-V2.md`, `docs/M3-DIRECTOR-PLAN.md`.

- Tension 0–100 with `decayPerTick`; `core.timeAdvanced` counts quiet dayparts when tension < `activeThreshold`; after `quietDayparts` boundaries (or a Randy "whim" roll, or recovery/focus adaptation) `adaptiveBeat()` draws a beat → `story.incident`.
- Tease-arming one daypart ahead (`armed`, binding); per-deck recent-memory (last 5, no-immediate-repeat in `bestOf`); attention meter per character (feeds `when.attention`); goals with `deadlineTicks` → `missedGoal()` costs / `offerBlockedUntilTick`; tier escalation by campaign day (`tierOf()`); `story.starved` when nothing eligible; spent decks fall back to `repeatable:true`.
- Mid-scene incidents via `dealNow()` (mishaps, witnessed touches) rendered as model-played scenes with the arrival cue as opening; authored-only close; `sceneBudget` closes typed scenes.
- Prompt surface: `directorContext()` (tension/quiet/tier/adaptation/focus/armed), `briefOf()` one dramatic-pressure line via `beatDirection()` (Façade-style dialogue moves).

That is an experience-manager skeleton in the L4D/RimWorld lineage — but comparing against what a DM actually does:

| DM skill | Current state | Gap |
|---|---|---|
| Maintains dramatic questions ("will they find out?") | Tension is a scalar | No legible, persistent *question* the player can feel advancing |
| Consequences for ignored hooks | Beat dismissed on leave | Ignored beats vanish; the world doesn't move without you |
| Callbacks ("remember what you promised?") | Flags/plans exist but beats can't quote history | "Teaser lies" / disjointed feel from playtests live here |
| Spotlight management | Attention meter per character | Nothing *enforces* rotation or rescues a starving NPC |
| Pacing curve with breathers | Tension decays numerically | No authored low-tone "breather" content deliberately dealt after peaks |

## Rival research

**Left 4 Dead AI Director** (Hunicke, Game Developer Magazine, Nov 2005) — runs a *dramatic intensity curve*: builds tension, then deliberately inserts **breathers** to reset the curve. Job is maximizing drama, not difficulty. Reads player stress signals in real time. Academic analyses (AAAI 2019 experience-management study) classify it as choosing between predefined pacing states, not open-ended generation.

**RimWorld storytellers** — Cassandra runs a recognizable ~10.6-day on/off rhythm, deterministic across reloads, scaling threats to colony wealth; Randy uses the same threat budget but stochastically distributed, and much of the community considers him the better *story* engine precisely because of the variance. Takeaway: pacing personas are cheap, valuable, creator-facing.

**AI Dungeon / NovelAI / 2025–26 LLM-DM wave** (DungeonsDeep, Friends and Fables, AI Realm, RoleForge) — winning pattern is **structured memory cards injected selectively**: facts about characters and plot threads stored out-of-band, surfaced into the prompt only when relevant, so the LLM stays consistent over long arcs. Research (CALYPSO: LLMs as DM assistants; LLM meta-controller / world-model papers) converges on hybrid: deterministic state engine + LLM as narrator.

**Suck Up!** — LLM NPCs with goal-oriented persuasion and escalating trust per NPC; drama comes from *states the NPC remembers between conversations*, not moment-to-moment chat.

**Date Everything!** — not LLM, but structurally instructive: ~100 romances each with a clear authored arc (hook → complication → payoff). Lesson: arc *shape* per character is what makes authored content feel directed.

**Façade** — already borrowed for dialogue moves; its other lesson is drama must interrupt *at the right moment* (our mid-scene `dealNow()` does this).

## Proposed innovations, ranked

**1. Threads (fronts with countdown clocks) — the big lever.** Replace decorative tension with 3–5 persistent dramatic questions as engine data: `{id, cast, question, clock[4], stakes, tease}`. A clock ticks when a related beat is dealt, when the player acts on it, and on time ticks even when the player does nothing. When a clock fills, it resolves: the thread spawns its showdown beat or a consequence fires off-screen. Deterministic data, no LLM at deal time; the LLM narrates the thread line. Kills two known problems: decorative tension and teaser lies.

**2. Ignored beats escalate instead of vanishing (fail-forward / off-screen consequences).** Leaving an incident scene currently dismisses it. DM move: a dismissed beat returns next day at tone+1 with consequence text ("Riko noticed you walked away"). Untouched beats feed their thread's clock. Cost of ignoring = *more interesting drama later*, not silence. Also attacks dead-turns.

**3. Callback ledger + "last time on…" recap.** Every resolved beat writes one line (`who, what, daypart, player choice`). Beat templates get a `callback` field rendering a real past line into tease and scene prompt; optional one-line recap enters context at scene start. AI Dungeon story-card pattern applied here; cheapest fix for the disjointed-continuity diagnosis.

**4. Authored breathers.** Add a low-tone `cozy` beat family. Rule: after any tone-3 beat resolves, next draw is weighted hard toward tone-1 with no complication. L4D's curve made explicit; fixes "flat purgatory" via *shaped rhythm*, not more content.

**5. Spotlight rotation as a hard rule.** Never two consecutive beats on the same lead; a "starving" NPC (lowest attention, highest promise) gets priority for the next cheap low-tone beat. One-line change in `bestOf()` weighting.

**6. Pacing personas.** `directorProfile.pacing: "metronome" | "chaos" | "crescendo"` — Cassandra (rhythmic, quiet-boundary driven, as now), Randy (whim roll cranked up, tension-independent), ramping profile for short runs. Trivial since the roll exists; creator-facing like RimWorld's storyteller picker.

**7. Scale intensity to "story wealth", not just ticks.** RimWorld scales threats to colony wealth; ours scales by campaign days (`tierOf()` + `minTick`). Scaling tier to total relationship wealth (sum of trust+chemistry across cast) means drama escalates because the *story* got rich, not because time passed.

**Later / optional:** player-facts ledger (extract facts the player volunteers in chat into flags beats can require — real "DM notes"; needs LLM extraction + validation); rival-advance simulation (NPCs take one off-screen action per tick — really thread clocks applied to the rival role).

## What NOT to do

Don't give the director free-form generation authority — every rival that did loses authorial control and hits consent/coherence problems this architecture deliberately avoids. The current split (deterministic director decides *when and what shape*, authored scenes decide *what is said*, LLM only voices it) is the same hybrid the research converges on; these innovations strengthen the split rather than blur it.

## Implementation sizing

- Small, director.mjs only, no pack changes: #2 (escalating ignored beats), #5 (spotlight rule), #6 (pacing personas).
- Needs a design brief first: #1 (threads), #3 (callback ledger touches beat schema + packs), #4 (needs authored cozy content).
- #7 touches tier logic + balance; medium.

## Sources

- [RimWorld wiki — AI Storytellers](https://rimworldwiki.com/wiki/AI_Storytellers)
- Hunicke, *The AI Director: The Story Behind Left 4 Dead's Dynamic Pacing*, Game Developer Magazine, Nov 2005 (via ResearchGate's AI-in-games study)
- AAAI 2019, *A Structured Analysis of Experience Management* (L4D as constrained experience manager)
- CALYPSO: *LLMs as Dungeon Master's Assistants* (ResearchGate)
- IEEE, *GPT for Games: An Updated Scoping Review (2020–2024)*
- [Date Everything! — Wikipedia](https://en.wikipedia.org/wiki/Date_Everything!)
- Suck Up! coverage: Naavik.co, Gamefile.news, ACM *Player Perceptions on Generative Non-Player Characters*
- 2026 LLM-DM tool comparisons: DungeonsDeep, Friends and Fables, AI Realm, RoleForge benchmarked on memory/rules/coherence

## Corrections (code review, 2026-10-01 — these win)

Verified against `director.mjs`, `scenes.mjs`, `role-slots.mjs`, `fun-metrics.mjs` and `owner-answers.md`. Where this disagrees with the proposal section above, this block is right.

1. **The tease bug is real but is not "dishonesty".** Teaser *honesty* is already enforced: `adaptivePick` re-uses the armed beat, and `story.teaserPassed` announces release instead of silently swapping. The actual defect is narrower and mechanical — `adaptiveBeat`'s pool mixes complications with offers, the tease block arms an `offer`, `deal()` turns it into an optional card, and `adaptivePool` then filters it out on the next boundary, so it resolves to `teaserPassed`. Result: tease, ignorable card, release notice, no drama. Threads do not fix this. Excluding `delivery:'offer'` from the tease candidate set does.

2. **"Ignored beats vanish" is right, and cheaper than stated.** `story.leave` already persists `{scene, beat, tick, status:'dismissed'}` into `story.scenes.history` and emits `story.sceneDismissed`. The director has no handler. This is a read of existing state, not a new subsystem. It also gives proposal #3 its callback source for free.

3. **"Escalating ignored beats attacks dead turns" is wrong.** `fun-metrics.mjs` scores a turn dead when it is neither `live` nor `fresh` — no state change, no new content. Escalating improves a *later* turn and cannot retroactively fix a dead one. Dead turns are already gated at ≤10% and the F1 pack passes.

4. **Proposal #6 contradicts a standing decision.** `GAME-DESIGN.md:147` states pacing presets are not player-facing and that `PRESETS` are internal defaults. Owner confirmed 2026-10-01: presets stay internal, `toneCeiling` and `textMode` are the only creator dials, and both are already shipped. #6 is dropped at zero cost.

5. **Proposal #2 as written builds the resentment simulator the owner rejected.** `owner-answers.md` 2026-10-01 forbids persistent grievances. Owner ruled: escalate **once**, then resolve or expire, with a repair path. Director-dealt beats only; authored grudges stay out.

6. **The callback ledger has an unbudgeted prompt cost.** `CONTEXT-BUDGET.md` and `context-budget.mjs` enforce LODs under a one-call-per-turn non-negotiable. A per-beat injected line is not free and must be capped at one line, oldest-dropping, never displacing scene-critical context.

7. **The largest gap is absent from the proposals: the library is romance-only.** All 12 beats need a `lead`; 9 need a `rival`; roles are hardcoded `{pool:'dating'}` at `director-library.mjs:41`. Spotlight rotation (#5) over a deck where every card is a love interest can only shuffle which character is neglected — it cannot fix starvation. `role-slots.mjs:8` already resolves explicit ID lists, `'dating'`, and `'cast'`, so widening is mostly a library change plus a Studio pool picker. Non-romance shapes are a bigger content gap than any of the seven proposals.

8. **Proposal #4 (breathers) is under-rated and needs no new content.** `after-hours` already ships a low-tone "quiet evening" opportunity. A forced post-tone-3 cooldown can reuse it.

9. **No falsification plan.** `fun-metrics.mjs` already computes `trailingDrought`, `zeroBeatWindows`, `maxQuietDayparts`, `firstDrama` and `deadRatio` — `trailingDrought` and `zeroBeatWindows` *are* the "flat purgatory" and "starves at the end" symptoms this doc describes. Measure before building proposal #1, or "the world never goes quiet" becomes another criterion that passes on seeded runs and fails in play.
