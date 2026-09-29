# Prioritized milestones

This roadmap is ordered by player risk and dependency, not by novelty. AI narration remains descriptive: only validated commands and authored effects may change world state.

**Current priority (2026-09-29): the [Game tier](#game-tier--the-venus-style-loop-do-first) (M0 → M2 → M3 → M5; the creator moved ahead of Director v2 on 2026-09-29) comes before all remaining P1–P4 work.** The design is in [GAME-DESIGN.md](GAME-DESIGN.md). It replaces the Fun tier (F1–F12). The Fun tier built a hand-authored storylet game, and a human playtest of it felt far worse than Venus University. The engine and modules are kept and re-aimed at a Venus-style loop, where typed text changes state and authored scenes are used where authoring pays off.

**Module freeze lifted (2026-09-28).** New modules and module versions are allowed again. A new module should make a measurable [fun gate](#fun-gate) number better (dead turns, run length, payoff timing) on at least one showcase pack.

**Conversation economy shipped (2026-09-29), from the AI-playtest findings.** Trust from talk is now novelty-weighted: generic small talk earns nothing (a three-content-word floor the code documented but never enforced), substantive new content pays the once-a-day bump, and repeats never pay. Re-asking something a character already heard is a free 0-tick clarification instead of a paid deflection, and typed conversation no longer breaks with "unavailable action" once the suggestion buttons run dry. The playtest harness gained a `maxConsecutiveSpeak` gate so interview-mode runs fail QA.

## Current baseline

Product direction: the first full deliverable is an adult eroge/dating sim with optional NSFW narration. Romance difficulty and route length are authored per character: long scene-gated routes, automatic short routes, casual encounters, and non-romance characters may coexist. Consent and 18+ validation remain mandatory regardless of route difficulty.

Already implemented: deterministic event replay, revision-safe SQLite saves, authoritative inventory and money, generated-fact review, schedules and dayparts, pinned scene casts, structured scene sanitation, scene summaries and closing, scripted multi-beat scenes, trigger priority and a bounded queue, a scene escape hatch, plans with kept/broken events, relationship dimensions, generic character stats, authored relationship-state graphs, player/NPC dating, NPC romance networks and rival turning points, NPC pair simulation, equipment, authored activities, shops, and event diagnostics.

These systems still need real-model, Windows desktop, keyboard, narrow-screen, and long-campaign testing. Automated coverage is strong but does not replace those checks.

Reliability update: save-envelope migration v1→v2, automatic bounded recovery snapshots with restore UI, OpenAI-compatible SSE scene previews with authoritative final sanitation, and a shared committed cast/location scene plan are implemented. Further historical migrations will be added only when a schema actually changes.

Honest assessment (September 2026): the engine-to-content ratio is badly inverted (about 590 KB of code, 215 KB of docs, largest pack 19 KB). Free text has no mechanical weight, relationship feedback is a raw number diff (`Trust 52 → 55`), the main screen shows developer tools (context report, memory manager, backups, journal), and intimate scenes are gate → unstructured model prose → outcome, with no player decisions during the scene. Dating, rivals, gossip, secret encounters, disclosure and jealousy are implemented, but no shipped pack exercises them together.

Update (2026-09-29): F1–F12 fixed the buttons-and-numbers half of that list, but the owner's human playtest of `after-hours` still felt far worse than Venus. The problems were:
- typing didn't work;
- replies were one sentence long;
- the speaker jumped between characters;
- there was no liked/disliked feedback;
- buying a drink changed nothing.

The content model had drifted into hand-authored storylets. Evidence and scene rules are in [research/venus-university/](research/venus-university/).

## Game tier — the Venus-style loop (do first)

Design: [GAME-DESIGN.md](GAME-DESIGN.md). Order: **M0 → M2 → M3 → M5** (owner call 2026-09-29: the creator is the product, so it comes right after M0; the director is built for what the creator produces). The later items at the end wait until M5 lands.

| Milestone | What to build | Reuses | Done when |
|---|---|---|---|
| **M0. Scene feel + first playable (campus)** | Steps below, in order. The old M1 (first playable) is merged in. | See each step | The owner plays 30 minutes on the local model and would rather keep going than switch to Venus. The proxies in the [fun gate](#fun-gate) pass. |
| M0.1 Scene feel | **Fix typing:** the input box always accepts text; no action is discarded, including the one that hits the budget. **Free-typing scene contract:** one focus NPC, an echo line, 1–3 sentence beats, 3–5 input budget, a closing reply that answers the last input, the narrator in the scene's voice, the model completing the player's action. | `service.mjs` scene path, `beats.mjs`, `scene-boundaries.mjs`, `narration-lint.mjs`, `vendor/venus/` | A 5-scene typed run on the 9b model breaks none of the contract rules; tests cover budget close and no dropped input. |
| M0.2 Free text becomes state | **Tagger → engine pricing:** the model tags acts (flirt, gift, touch, insult, buy, invite…) and size; the engine prices money, affection and calendar invites against hidden likes, prices and caps. Tags ride in the existing structured reply; add a separate end-of-scene pass only if the 9b model tags badly. **End card:** liked/disliked reasons and the heart change. **NPC memories** from the model. Tags are committed events, so replay never calls the model. | `romance-tempo` (banks, caps, tastes, repeat decay), `economy`, `phone` / `timed-events` (invites), `memory.mjs` | "Buy her a drink" bills money and moves affection; "hang out Sunday" lands on the calendar and missing it costs; sweet talk can't exceed the caps; replay is identical. |
| M0.3 Model check (postponed, owner call 2026-09-29) | The owner plays for an hour on a cloud model with the same world, to separate what the 9b model costs from what our systems cost. | — | The findings are recorded, and any 9b-only failures get a prompt or budget fix or become a documented limit. |
| M0.4 Campus world | Built as structured data (the wizard comes in M2): 3–4 romanceable characters plus one warm friend, 5–6 places, basic activities, a fixed calendar and endings. Each love interest gets a likes and limits table, a trait track and a ladder of firsts. | `packs/*.json`, `calendar`, `endings`, `stats` | `npm run validate` passes and a bot run reaches an ending. The campus world replaces `after-hours` as the showcase. |
| M0.5 Deduction and change arc | **Hidden likes and limits**, surfaced only through reasons and a **discoveries journal** (read-only, never raw NPC memory). **Hidden traits plus named stages:** stages change voice, outfits, what she'll say yes to, and unlocked scenes. | `dating` preferences, `intimacy` `knownInterests`, `progression` relationship states, `stats` (hidden) | A player can name 2+ likes per love interest after an hour of play, and a stage change is visible in her voice and options. |
| M0.6 Erotic payoff | **Ladder of firsts:** the first time is authored, with choices that read her cues; repeats are free-typed; each first unlocks a gallery entry. **Mood and moment:** privacy, mood and sobriety state. **Intimacy hard rule:** state wins; the engine blocks before the model writes; "drunk and willing" becomes an "ask me when I'm sober" hook; a pushy advance becomes a remembered rejection. | F5 beats, F7 ladder, F10 gallery, `intimacy.mjs` gates; sobriety state is new | Tests show no path into intimate prose without consent in state, including typed attempts while drunk or at too early a stage. The first romantic payoff lands within 15 minutes. |
| M0.7 Hub | Map plus phone: places show this slot's activities with stat and gold ranges and who might be there; the phone carries texts, invites and rumors; a morning day card. Activities give midpoint results (minigames come in M5). | `daypart`, `calendar`, `phone`, core schedules, F9 player chrome | Every slot offers 3+ things to do plus free text, and the player can always say what they're working toward. Owner call 2026-09-29: the hub states it automatically from engine state, as each love interest's next first plus what gates it, in words, never numbers ("Nova: next is a date. She needs to be more into you."). Talking to someone outside a scene opens a short focused talk scene, so everything said there is priced. Activity yields (owner call 2026-09-29): money exact, your stats as arrows, her trust as a heart (`+$30 · Charm ↑`, `Jana ♥ · Charm ↑`). The goal line lists all four love interests from day one; dislike questions are "Risky": free once, a small minus (−3, decaying) when you keep bringing it up. |
| **M3. Director v2** (acceptance met 2026-09-30, see [M3-DIRECTOR-PLAN.md](M3-DIRECTOR-PLAN.md)) | Generates four kinds from a template library made when the world is created: events and invites, obstacles and rivals, goals with deadlines, temptations. Fully adaptive (nothing happening → drama; losing → an opportunity; one-character focus → a rival or a temptation) under a creator-set tone ceiling. The storyteller presets become internal defaults. | `story.director` (F8), `role-slots.mjs` (F11), `timed-events`, `phone`, `romance-network` | Seeded campus runs never go more than N slots without a director beat. Every beat is a template instance with provenance. A test shows play style changing what the director deals. |
| **M2. Creator wizard** | Input: a one-line premise or ST card(s) first, then a guided form to fill gaps and edit → cast (with act profiles: likes, dislikes, limits) → places and activities → arcs and the firsts ladder from beat templates → director event seeds (M3 consumes them later). The AI drafts each step and the creator approves it before the next. Owner call 2026-09-29: a cloud model drafts, the local model plays. | [GENERATOR-PLAN.md](GENERATOR-PLAN.md) steps 1–6, `card-world`, `character-card`, `route-skeleton`, `intimacy-skeleton`, `bulk-authoring`, `proposal-review` | First proof: rebuild campus from a one-line premise and compare it to the hand-built `packs/campus.json` (same shape, validates, the ladder reaches every rung, fun-gate proxies within range of the original). Then a second world from one of the owner's ST cards. |
| **M5. Activity depth** | A clue or timing minigame for every activity, skippable at the midpoint result. Push your luck: bigger gains with a mishap chance, and mishaps feed the director. Activity encounter procs, with witnesses for touch at work, gym or study. Social-link ranks unlock activities. | F4 checks, `moments`, `gossip`, `npc-social`, `romance-tempo` ranks | Every campus activity has a minigame. A mishap reliably produces a director beat. Getting handsy in front of a coworker has a consequence. |

### Later (after M5)
- **M4. Secrecy and agreements.**
  - Suspicion, evidence and witnesses lead to caught outcomes: a free-typing confrontation (her evidence vs your claims), a breakup or bad ending, negotiating an opening, and ripple drama.
  - Agreements move monogamous → open → poly and secret → public, negotiated in play.
  - NPC-to-NPC relationships and the player's reputation arc.
  - Reuses `gossip`, `dating` agreements, `romance-network` and `npc-social`.
- **Roguelike cards:** deal 3 plus a basics row, built on the F2 hand; deckbuilding after that.
- **Runtime AI director events** as a supplement to the template library.
- **Run-shape presets:** roguelite (isekai) and forever sandbox.
- **after-hours regeneration check (optional):** regenerate an after-hours-like premise through the wizard, to see whether the premise or the old systems were the problem.

### What happens to the Fun tier (F1–F12)
Superseded 2026-09-29. The original table is in [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md#fun-tier-superseded-2026-09-29) and the old rationale in [FUN-PASS.md](FUN-PASS.md), both kept for history.

| Milestone | Verdict |
|---|---|
| F1 after-hours pack | **Retire.** It stays as a test fixture until the campus world replaces it in tests, then gets deleted in a reviewed change. |
| F2 storylet hand | **Demote** to the later roguelike card layer; it is no longer the core loop. |
| F3 run calendar | **Keep.** It is the default run shape. |
| F4 stat checks | **Keep** for authored choices. Its "map typed text onto checks" deferral is superseded by the M0.2 tagger. |
| F5 intimacy beats | **Keep** as the authored first time (M0.6). |
| F6 visible progress | **Keep.** Hearts stay visible (owner's call, 2026-09-29: avoids reading as a Venus copy). The end card animates the heart change. Likes and limits stay hidden. |
| F7 escalation ladder | **Keep** as the ladder of firsts. |
| F8 drama director | **Keep** as the timing core of director v2 (M3). |
| F9 player-only chrome | **Keep.** |
| F10 gallery | **Keep.** It is the collection half of the erotic payoff. |
| F11 role-slot templates | **Keep** as the base for director and first-time templates. |
| F12 fun metrics | **Keep.** Add the typed-turns-that-changed-state metric. |

## P0 — Critical correctness and recovery

All P0 milestones are shipped — see [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md#p0--critical-correctness-and-recovery).

## P1 — Required for a dependable creator

Deprioritized behind the Game tier, except where a Game milestone needs it (for example, the M2 creator wizard reuses Studio forms and validation). Milestones 6 and 7 are shipped — see [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md#p1--required-for-a-dependable-creator).

| Milestone | What to change | Done when |
|---|---|---|
| 8. Finish scene-plan and graph authoring — **variables, prerequisites, and path analysis shipped** | Studio now has named boolean story variables, typed plan effects, and form-based completed-scene prerequisites. Route tests display beat paths and cross-scene unlocks, and detect unreachable beats, missing targets, prerequisite cycles, missing plan creators, and branches that cannot finish. Still add richer queue/debug explanations. | An author can build and inspect a multi-scene storyline without editing JSON; static analysis identifies missing targets and obvious dead ends. |
| 9. Checkpoints, rewind, and branches — **shipped** | Named manual checkpoints, automatic scene/daypart checkpoints, restore-impact previews, and branch-from-checkpoint controls are available in the player UI. Branching opens a new campaign and leaves the source history unchanged; restoring keeps a recovery snapshot of the state it replaces. | A player can safely undo a bad generated scene without replaying mechanical rewards or corrupting the original branch. |
| 10. Context and contradiction diagnostics — **disclosure corrections shipped** | A newer player disclosure of the same slot (name, favorite X, where they live or work, age) now removes the clause it corrects from memory before it reaches a prompt (`slotOf` in `packages/ai/memory.mjs`). Still show per-section prompt cost, selected/omitted memories, stale facts, due plans, and conflicting facts. Add recency and salience tuning with a deterministic trace. | A 50-turn test remains inside budget, and a creator can explain why each fact or memory entered the prompt. |
| 11. Creator completeness and validation UX | Typed appointment and route-ending editors now cover tick windows, attendance/missed results, required locations and characters, story flags, and completed-scene gates. Still replace the remaining advanced-JSON-only conditions/effects and add reference pickers, inline validation, dependency warnings, duplicate-ID checks, and a publish checklist. | Every runtime-supported scene rule can be authored in Studio; invalid references are located before publish. |
| 12. Desktop release safety | Add portable packaging, data-folder selection, backup/restore, log export, runtime/model diagnostics, and a tested update procedure. | A clean Windows machine can install, create, play, back up, update, and restore a campaign without developer tools. |
| 12A. Venus-style player loop — **scene lifecycle, deterministic invitations and Characters view shipped; typed three-day playtest pending** | Make free text the normal response inside scenes and keep authored choices as optional prompts. Let authors explicitly lock input only for menu-only beats. Each Morning, Afternoon, and Evening offers one meaningful activity; that activity either closes the period or continues until the scene reaches an authored or model-proposed natural ending. Add deterministic invitation acceptance/movement, character-initiated exits after disinterest or boundary conflicts, and a single per-character progress view with creator-visible raw trust/love/lust values. | A player can complete a three-day test story mainly by typing; the cast always matches physical attendance, accepted invitations move both characters, and every period ends once without consuming stray actions. |
| ~~M-A. Deterministic speaker plan~~ ✅ | Shipped: `scenePlanForTurn` returns `speakers`; the JSON-schema enum, `normalizeSceneLines` and every service path (preview, final, closing pass) run `guardSceneLines`, which drops off-slate voices and reattributes `Name:` narration. | Group scenes never invent a speaker outside the committed cast — unlike SillyTavern's probabilistic "Natural Order" group-chat speaker selection, which is a per-message coin flip with no engine-side guarantee. |
| ~~M-B. State-conditioned lore with tick timers~~ ✅ | Shipped: `packages/modules/conditions.mjs` is the one `when` evaluator/validator for scenes, choices and lorebook entries; lore adds `when`, `delay`, `sticky` and `cooldown` in ticks, derived from `loreActivations` on committed turns. Scene actions now also key lore retrieval. | Lore only surfaces when the deterministic world state actually supports it, instead of the LLM guessing relevance from raw probability/keyword matching. |
| ~~M-D. Reject model-maintained state blocks~~ ✅ | Shipped: `stripStateSyntax` removes CBS var macros, `<UpdateVariable>` blocks and `_.set` patch lines from scene, plain and daypart output; non-goal documented in `docs/AUTHORING.md`. | Model output is untrusted text; letting it write "variables" makes state forgeable and non-replayable — the opposite of story-framework's deterministic-engine guarantee. Document as a non-goal in `docs/AUTHORING.md`. |

## P2 — Core game depth

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| ~~16. NPC run-ins, overlays, and gossip (`social.npc` v0.2)~~ ✅ | Shipped: `npcGroups`, witnessed `social.npcEncounter`, capped per-day `social.npcRunIn` overlays, pair-private `social.npcFriendship` memories, `{field}` gossip summaries with `sourceEvent` provenance, `npcSimulation` frequency/caps, Studio controls; tests in `tests/npc-life.test.mjs`. Originally: authored groups, witnessed encounters, rumors with provenance, friendship memories, overlay caps, and creator controls for simulation frequency. | Seeded runs reproduce exactly; witnesses are physically present; unseen information does not reach the player or unrelated NPCs. |
| M-E. Relationship tempo: ceilings, cadence, gifts — **core shipped** | Optional `social.romance-tempo` adds point banks, rank ceilings, authored rank-up scene effects, per-period gift limits, repeat decay, tastes, and chemistry/satisfaction consequences. Runtime state is replayable and enters private AI context. v0.2 adds repeatable-signal cooldowns and repeat decay, witnessed-only `jealousy` presets (relaxed/secure/guarded/possessive) with overrides, Stardew-style `birthday` gifts and forgotten-birthday penalties, an opt-in Tokimeki-style `neglect` bomb (warning → defuse or witnessed detonation that gossip can carry), and Studio controls for profiles, gifts, signals and jealousy; tests in `tests/romance-tempo.test.mjs`. ✅ | Affection can't be maxed by spamming one action; a ceiling only lifts after an authored scene fires, and gifts have bounded, cooldown-respecting returns. |
| M-F. Missable timed events, off-screen resolution — **core shipped** | `story.timed-events` provides authored tick windows, location/character attendance, attended/missed flags, committed recaps, and replay. Schedule exceptions override routine locations during one-off windows. Still add calendar-date authoring and richer recap presentation. | A missed event advances world state deterministically and the player learns what happened without a fabricated replay. |
| ~~M-G. Character-card V2/V3 import/export~~ ✅ | Shipped: `packages/cards/character-card.mjs` reads V1/V2/V3 JSON and PNG (`chara`/`ccv3` tEXt) cards, resolves `{{char}}`/`{{user}}`, strips state-mutating syntax, and maps enabled `character_book` entries to character-scoped lore; card-only fields (greetings, `system_prompt`, examples, other extensions) are kept verbatim in `actor.card`, which never reaches a prompt. Export writes V2/V3 JSON or a PNG, with SF-only fields in `extensions['story-framework']` so SF→card→SF is lossless and edits made elsewhere to `description`/`personality` win. `npm run card -- import|export …`, `POST /api/studio/import-card`, `GET /api/studio/export-card`; tests in `tests/character-card.test.mjs`. **Remaining:** Studio import/export buttons (the routes are ready). | A SillyTavern-authored character card can be imported as a story-framework NPC/persona and re-exported without lossy round-trip on the fields both formats share. |
| 13. Item operations — **shipped (`items.inventory` 0.2.0)** | Quantities and stacks landed: ownership is per (item, holder) with counts, transfers move exact units, stack caps bind per holder, shop stock depletes and restocks daily (`world.economy` 0.2.0), consumables apply authored effects (`items.use`), charged items deplete and break, and `items.craft` recipes consume inputs at an authored place. Failure semantics are atomic: every check runs before any state changes, so a failed use consumes nothing, and single-unit items keep the legacy flat save shape. Still open: persistent item attributes. | Replay cannot duplicate an item; a failed use consumes nothing; all effects remain authored and validated. |
| 14. Relationship progression | **Foundation implemented:** named per-character states, event/match transitions, flag/bond/stat requirements, direct scripted effects, scene gates, replay, narrator context, and Studio editing. Still add state visibility, plan consequences, cooldowns, witnessed actions, explanation traces, and contradiction review. Keep numeric dimensions optional. | Kept and broken commitments can unlock different scenes without leaking private knowledge or letting prose grant progression. |
| 15. Schedule exceptions and world conditions — **appointments, holidays, closures, weather shipped** | One-off tick-window schedule exceptions and missable events now override routines deterministically. The new `world.calendar` module adds authored holidays (weekday, dated, or annual), location closures (weekday, date, holiday, or weather triggers) that refuse new scenes and close shops/activities, daily weather rolled from an authored weighted table with `weatherByDate` pins, `when.weather`/`when.holiday` conditions, and `skipHolidays` on weekly schedule stops. Still add expanded debugger explanations. | Exceptions override routine deterministically and attendance remains grounded. |
| 17. Character stats and derived traits (`character.stats`) — **derived stats and milestones shipped** | **Foundation implemented:** pack-defined player/NPC stats, ranges, starting values, visibility, capped scripted changes, scene requirements, relationship-transition requirements, narrator filtering, replay, and Studio controls. Now added: derived stats (`derived: {parts, flat}` recompute deterministically when a source stat moves and cannot change directly) and `statMilestones` that set a story flag once when a stat crosses a threshold. Stats may represent charm, confidence, empathy, creativity, fitness, reputation, or setting-specific qualities; the core does not hard-code their meaning. | Authors can add or remove a stat without code changes; changes replay exactly; private NPC values do not leak into player context. |
| 18. Attraction, romance, and endings | **Core implemented:** eligibility, weighted preferences, chemistry, phases, relationship agreements, maintenance, romance tempo, gifts, and deterministic `story.endings` gates over flags, dating phases, ranks, intimacy history, and completed scenes. Now added: authored NPC–NPC dialogue (`npcDialogue`, matched by group, pair, or a generic pool) makes off-screen encounters and run-ins visible, the Dating panel shows an attraction "why:" trace, and the Relationship-states panel lists every blocked transition with its unmet requirements. Still add richer witness provenance and route-ending Studio forms. | The same player can appeal to different characters for different reasons; high stats never override boundaries, and AI prose cannot award an ending. |
| 19. Adult/intimate scenes (`social.intimacy`) | Gameplay during the scene, escalation and progress visibility now live in F5–F7; this row covers the safety and gating contract. Optional 18+ module layered over dating: consent state, boundaries, relationship/intimacy prerequisites, privacy and interruption checks, content intensity settings, fade-to-black alternatives, aftermath events, memories, and creator-authored scene templates. Generated prose describes only the already-authorized scene and cannot grant consent or change gates. | Packs must explicitly declare adult content and every participating character must be validated as an adult. A declined, withdrawn, disallowed, or ambiguous interaction cannot enter an intimate scene; lowering the content setting preserves mechanics while using a non-explicit alternative. |
| 20. Phone and feed (`social.phone`, `social.feed`) — **core shipped** | `social.phone` provides authorized contacts, persistent threads, unread/read state, replies, event-triggered messages, and expiring meetup offers using normal travel and attendance. `social.feed` provides source-linked posts, unread state, and authored reactions whose committed events can drive dating or story rules. Studio includes focused data editors for both. Still add polished phone/feed presentation and relationship-conditioned content variants. | Messages and posts survive replay, preserve provenance, and cannot bypass relationship, travel, or attendance rules. |
| 21. Economy depth (`world.economy` v0.2) — **foundation shipped** | Added bounded debt, authored purchasable services, event-driven wages with cooldowns, and multiple location-based shops. Gift consequences already route through romance tempo. True quantity/stock has now landed with stackable inventory (`items.inventory` 0.2.0): shops hold real units, buy/sell move exact counts, and shelves restock daily up to the authored maximum. | Services and wages replay without duplicate payment; debt cannot exceed its authored limit. |

Milestone 22 (cross-setting template packs) is shipped — see [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md#p2--core-game-depth).

## P3 — Presentation and player experience

Milestone 23 (VN playback polish) is shipped — see [COMPLETED-MILESTONES.md](COMPLETED-MILESTONES.md#p3--presentation-and-player-experience).

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| 24. Accessibility and responsive UI — **player view shipped** | Visible focus, screen-reader labels/live regions, font and contrast controls, reduced motion, scalable text, and phone layouts are implemented for play. Studio still needs a formal keyboard/narrow-screen QA pass. | Core creator flows pass the same documented keyboard and narrow-screen checklist. |
| 25. Audio and animation — **foundation shipped** | Optional local interface cues, page/speaker transitions, and reduced-motion fallbacks are implemented. Authored music/SFX/voice assets, channel volumes, fades, expression transitions, and creator controls remain. | Authored cues are optional presentation state, never affect replay, and missing media fails silently and safely. |
| 26. Character and asset workflow | The player-facing scene gallery moved to F10; CGs and expressions for the F1 pack are produced manually first. Reusable character packages, pose/outfit sets, batch validation, crop/transparency tools, and provenance metadata. Optional ComfyUI support stays separate from core play and comes after manual asset workflow is dependable. | Assets can be reused and replaced without broken references; failed generation preserves prior art. |

## P4 — Optional expansion modules

Build these only after M0 passes the fun gate and the creator and recovery path are dependable. Each should be opt-in, data-driven, replay-safe, and removable without changing the core loop.

| Milestone | Possible modules |
|---|---|
| 27. Education (`world.education`) | Classes, attendance, grades/GPA, exam windows, graduation requirements, and authored consequences. Build only when a campus game is an active deliverable; generic activities and schedules remain the shared foundation. |
| 28. Other genre progression packs | Careers, reputation/popularity, survival stats, crafting, combat or powers, and authored endings. |
| 29. Sharing and ecosystem | Pack export with dependency manifests, reusable module presets, compatibility checks, safe asset bundling, content-rating metadata, and optional community distribution. |
| 30. Advanced model adapters | Provider-specific adapters, context-window negotiation, model capability detection, editable retry/reword flows, and separate queues for narration and media jobs. |
| 31. Pre-generated dialogue graphs and offline replay | Let one model request author a bounded multi-step dialogue graph (for example three player choices, then two follow-up choices) whose branches can apply different deterministic memories/effects even when prose rejoins. Record approved player-choice/response pairs by context signature so later playthroughs can replay a known branch without a model call. | Replaying a recorded branch in offline mode produces the approved pages and the same committed effects; cache misses remain explicit and can fall back to a configured model. |
| 32. Card-style presentation | Moved to the Game tier's "Later" list as roguelike activity cards (deal 3 plus a basics row, deckbuilding after that). |

## Recommended attraction model

Do not use one universal attractiveness or romance stat. Store an authored attraction profile per character and calculate a transparent readiness result from independent parts:

- **Eligibility:** adult validation, orientation/gender compatibility, relationship availability, hard boundaries, and authored dealbreakers. A failed eligibility gate cannot be offset by points.
- **Personal preferences:** weighted ranges or tags for the stats and traits that character values. Preferences can be positive, negative, neutral, private, or discovered through play.
- **Experienced behavior:** trust, affection, rivalry, familiarity, kept/broken plans, gifts, dialogue choices, witnessed conduct, and recent conflicts. What the player does should matter more than character-sheet optimization.
- **Chemistry and context:** authored pair compatibility, current mood, location/privacy, active events, cooldowns, and relationship phase.
- **Agency:** each character has thresholds and permitted transitions such as stranger → interested → courting → committed. Crossing a score never forces a transition; it makes authored choices or scenes eligible.

The runtime should expose an explanation trace to creators—such as “eligible; confidence preference +4, empathy +6, broken plan −8, insufficient familiarity”—while player-facing UI may reveal only what the pack intends. Emit committed events such as `social.attractionChanged`, `social.crushStarted`, `social.relationshipStateChanged`, `social.consentGranted`, `social.consentWithdrawn`, and `story.endingUnlocked`. AI prose receives the resulting state but cannot emit these events itself.

Stats must remain pack-defined. A Bar game might use confidence, humor, style, empathy, and reputation; a Fantasy Town might use courage, magic, honor, wit, and compassion. Traits and actions can satisfy preferences without every quality becoming a number.

## Decision on the proposed Venus-fidelity modules

| Proposal | Decision | Reason |
|---|---|---|
| Phone and feed | **Keep; P2** | It creates meaningful asynchronous play and replaces the limited invitation stand-in. Phone should land before feed; feed can be a thin event view initially. |
| Romance and adult scenes | **Keep; promote to high-priority P2** | This is a primary product goal. Keep `social.dating` and `social.intimacy` optional and layered over generic stats, bonds, plans, privacy, witnesses, and consent. This preserves modularity while supporting deep romance and explicit adult packs. |
| Economy v0.2 | **Keep, narrowed to P2** | Multi-shop stock, gifts, wages, and bounded debt are reusable. Business ownership is a separate management-game feature and should wait for a game that needs it. |
| Education | **Do not build yet; retain as P4** | It proves modularity for Campus, but Bar and Fantasy Town gain nothing from GPA/exams. The M0 campus world uses generic schedules and activities (Venus-style classes: attend → +1 stat, plus a chance to meet someone). |
| NPC overlays and gossip | **Keep; P2 before romance** | Witness and rumor provenance are prerequisites for fair jealousy or social consequences. Replace arbitrary caps with authored budgets rather than simulating everyone. |
| Automated test-play | **Keep; promote to P1** | New modules multiply unreachable content and clarification loops. This is leverage for every later feature. |
| Mechanics/content digest split | **Keep; promote to P1** | Creators must be able to fix prose and art without destroying campaigns. This belongs with migration safety, not content polish. |
| Cross-scene graph upgrade | **Keep; merge into scene-plan authoring** | Priority, queueing, beats, and plan deadlines already exist. Add prerequisites, timers, variables, and analysis rather than building a second event engine. |
| Campus/Bar/Fantasy templates | **Keep; P2 acceptance deliverable** | Three small maintained packs are the clearest proof that modules are setting-neutral. They should demonstrate systems, not become three large games. |
| Streaming parser integration | **Keep; P0** | High player impact for local models, but previews must remain non-authoritative until final sanitation. |
| Checkpoints and rewind | **Keep; P1** | Valuable recovery feature once atomic preview/final boundaries and migrations are defined. |
| ComfyUI, audio, animation | **Defer; P3 and last** | Large surface area and little mechanical value. Manual assets, accessibility, saves, and creator diagnostics matter first. Exception: the F1 pack's CGs and expressions are content, not pipeline work, and are in scope now. |
| Intimate scenes as unstructured prose | **Replace; F5, then M0.6** | The first time is authored with beats (F5). Repeats are free-typed for replayability, under the intimacy hard rule in [GAME-DESIGN.md](GAME-DESIGN.md#what-the-model-writes): state wins, and the engine blocks before the model writes. |
| Game tier before creator completeness | **Adopt** | A dependable creator for a game nobody enjoys is not worth finishing first. Studio work continues only where a Game milestone needs it. |

Items not carried forward as new milestones: competing-trigger priority, a bounded pending queue, plan deadlines, kept/broken plan events, and a scene escape hatch. They are already implemented; the remaining work is authoring UX, stable IDs/visibility, diagnostics, and long-campaign evaluation.

## Recommended release sequence

1. Ship a reliability release containing milestones 1–5.
2. Ship a creator-safety release containing milestones 6–12.
3. Implement generic item and relationship progression, character stats, schedule exceptions, and NPC witnesses as the foundation for attraction.
4. Implement `social.dating`, then the separately switchable `social.intimacy` layer, with creator controls and non-explicit fallbacks from the start.
5. Add phone first, then the minimal feed, then economy depth; validate romance-aware flows in Campus, Bar, and Fantasy Town templates.
6. Run a 50-turn campaign evaluation before starting education, ComfyUI, or authored media pipelines. Studio now exposes this evaluation directly.
7. Ship the Game tier: M0 (campus first playable), M2 (rebuild campus from a premise, then a second world from an ST card), M3, then M5. Resume P1 creator completeness after that. The Fun tier (F1–F12) shipped the engine pieces this relies on.

## Immediate implementation order (updated 2026-09-29)

1. M0.1 scene feel, starting with the text-box bug. Then M0.2 (free text becomes state).
2. M0.3 model check (the owner, one hour on a cloud model), so later prompt work targets the right bottleneck. Postponed by the owner on 2026-09-29.
3. M0.4 campus world as structured data, then M0.5 (deduction and change arc), M0.6 (erotic payoff) and M0.7 (hub).
4. The fun gate on the campus world. Only then M2 (creator), M3 and M5.
5. `after-hours` stays as a test fixture during M0. Tests move to the campus world, and the pack is then deleted in a reviewed change.
6. P1–P4 only where a Game milestone needs them.

## Fun gate

M0 passes when the owner plays the campus world for 30 minutes with the `minimal` preset on the local model and would rather keep going than switch to Venus. From M2 on, the same gate applies to the second world. The proxies below must also hold, measured by `npm run playtest` / `npm run fun` or recorded by hand:

- Typing always works. No player input is discarded, including the input that hits the scene budget.
- Every free-typing scene closes within its 3–5 input budget, with a reply to the last input.
- At least half of typed turns change state: money, affection, a memory, a calendar event or a discovery. This is the new F12 metric.
- No more than 1 in 10 turns is a dead turn (no state change and no new information).
- The first liked/disliked reason comes within 5 minutes, and the first romantic payoff (a rung on the ladder of firsts) within 15 minutes.
- After an hour, the player can name at least 2 likes or limits per love interest, and say what they're working toward with each one without seeing a number.
- No path leads into intimate prose without consent in state. This is covered by tests, including typed attempts.
- A full run reaches an ending, and different play reaches at least 2 different endings.

## Campaign evaluation gate

Before calling the framework production-ready, run at least three 50-turn campaigns with a small local model and one stronger compatible model. Record contradictions, invalid casts, unresolved requests, retries, context size, repeated prose, save recovery, queued-scene behavior, overdue plans, and average response latency. Every mechanical outcome must replay identically after export/import.

The request budget is part of this gate. A normal continuation uses one model request that returns dialogue, scene summary, character memories, and sourced facts together. A natural scene ending must not trigger a second closing request. Deterministic and authored actions use no model request; unresolved free-form actions may use one classification request before their single scene request. Track physical HTTP attempts, including schema fallbacks and repairs, because those attempts consume provider quota.
