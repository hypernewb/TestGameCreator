# Prioritized milestones

This roadmap is ordered by player risk and dependency, not by novelty. Complete P0 before adding major content systems. AI narration remains descriptive: only validated commands and authored effects may change world state.

## Current baseline

Product direction: the first full deliverable is an adult eroge/dating sim with optional NSFW narration. Romance difficulty and route length are authored per character: long scene-gated routes, automatic short routes, casual encounters, and non-romance characters may coexist. Consent and 18+ validation remain mandatory regardless of route difficulty.

Already implemented: deterministic event replay, revision-safe SQLite saves, authoritative inventory and money, generated-fact review, schedules and dayparts, pinned scene casts, structured scene sanitation, scene summaries and closing, scripted multi-beat scenes, trigger priority and a bounded queue, a scene escape hatch, plans with kept/broken events, relationship dimensions, generic character stats, authored relationship-state graphs, player/NPC dating, NPC romance networks and rival turning points, NPC pair simulation, equipment, authored activities, shops, and event diagnostics.

These systems still need real-model, Windows desktop, keyboard, narrow-screen, and long-campaign testing. Automated coverage is strong but does not replace those checks.

Reliability update: save-envelope migration v1→v2, automatic bounded recovery snapshots with restore UI, OpenAI-compatible SSE scene previews with authoritative final sanitation, and a shared committed cast/location scene plan are implemented. Further historical migrations will be added only when a schema actually changes.

## P0 — Critical correctness and recovery

| Milestone | What to change | Done when |
|---|---|---|
| 1. Narration lint pipeline (M-C) — **shipped** | Generalized the unresolved-action truth guard (`packages/ai/scene-boundaries.mjs`) into `lintScene` (`packages/ai/narration-lint.mjs`), run on every narration inside `CompatibleProvider.generateScene`'s existing repair loop: (a) travel/arrival/possession/attendance, (b) knowledge leaks against `knownBy` in `packages/modules/facts.mjs`, (c) content-level overflow against `pack.intimacySettings.contentLevel`. | — |
| 2. Save migrations and backups — **shipped** | Explicit save-schema migrations, automatic pre-migration backup, migration audit output, and recovery from a corrupt latest save. | — |
| 3. Atomic streaming boundary — **shipped** | JSON stream readers connected to transport and VN playback; streamed pages are previews until final sanitation passes. | — |
| 4. Unified cast and location plan — **shipped** | One authoritative scene plan used by classification, attendance, command validation, prompt context, stage rendering, schedule pinning, and scene release. | — |
| 5. Proactive context budgeting — **shipped** | Model context window discovery/config, request-size estimation, output reservation, documented trim order (LODs, size presets). | — |

## P1 — Required for a dependable creator

| Milestone | What to change | Done when |
|---|---|---|
| 6. Mechanics/content digest split — **shipped** | `mechanicsShape`/`mechanicsDigest` (`packages/core/engine.mjs`) hash only state-affecting fields (schema, module set, actor locations, exits, shop/hidden item flags, activity effects, schedules, relationships, start options) — prose, names, and presentation are excluded and no longer invalidate a save. `describeMechanicsChange` previews a diff between two packs; `migratePack`/`Store.migratePack` apply a real mechanics change, re-validate the new pack, and append an audit entry to `world.migrations`. `execute()` still hard-fails with "Pack changed: migration required" until a migration runs. | — |
| 7. Automated test-play mode — **shipped** | `scripts/audit-playtest.mjs` supports command-line audits. Studio now runs every authored opening across three deterministic seeds, reports action failures, orphaned beats, queue evictions, paused/active scenes and never-fired route content, and presents per-scene completion coverage with exact scene IDs. The live-provider playtest separately reports clarifications, context pressure, recall, echoes, and fallbacks. | — |
| 8. Finish scene-plan and graph authoring — **plan forms shipped** | Studio now has typed create/keep/break plan effects with relative deadlines, stable IDs and visibility. Runtime validation accepts exactly one absolute or relative deadline and rejects duplicate pending IDs. Still add cross-scene prerequisite forms, reusable variables, graph visualization, plan-reference analysis, and richer queue/debug explanations. | An author can build and inspect a multi-scene storyline without editing JSON; static analysis identifies missing targets and obvious dead ends. |
| 9. Checkpoints, rewind, and branches | Add named manual saves, automatic scene/daypart checkpoints, branch-from-checkpoint, and a preview of what will be discarded. Keep event history immutable per branch. | A player can safely undo a bad generated scene without replaying mechanical rewards or corrupting the original branch. |
| 10. Context and contradiction diagnostics | Show per-section prompt cost, selected/omitted memories, stale facts, due plans, and conflicting facts. Add recency and salience tuning with a deterministic trace. | A 50-turn test remains inside budget, and a creator can explain why each fact or memory entered the prompt. |
| 11. Creator completeness and validation UX | Replace advanced-JSON-only paths with editors for all supported conditions/effects. Add reference pickers, inline validation, dependency warnings, duplicate-ID checks, and a publish checklist. | Every runtime-supported scene rule can be authored in Studio; invalid references are located before publish. |
| 12. Desktop release safety | Add portable packaging, data-folder selection, backup/restore, log export, runtime/model diagnostics, and a tested update procedure. | A clean Windows machine can install, create, play, back up, update, and restore a campaign without developer tools. |
| M-A. Deterministic speaker plan | Extend the scene plan (`packages/core/scene-plan.mjs`) with an authoritative `speakers` slate for the beat, and have `vendor/venus/scenePrompt.mjs`/`normalizeSceneLines` reject or repair lines from anyone off it. | Group scenes never invent a speaker outside the committed cast — unlike SillyTavern's probabilistic "Natural Order" group-chat speaker selection, which is a per-message coin flip with no engine-side guarantee. |
| M-B. State-conditioned lore with tick timers | Add a shared condition evaluator (flags/stats/relationship-state/time) usable by both `packages/ai/retrieval.mjs` lorebook-style entries and `packages/modules/scenes.mjs` triggers, plus sticky/cooldown/delay timers like SillyTavern World Info. | Lore only surfaces when the deterministic world state actually supports it, instead of the LLM guessing relevance from raw probability/keyword matching. |
| M-D. Reject model-maintained state blocks | Explicitly do **not** adopt RisuAI's CBS-style `{{setvar}}`/`{{addvar}}` pattern: strip/ignore any state-mutating syntax the model emits in narration; `packages/core/engine.mjs` stays the only writer. | Model output is untrusted text; letting it write "variables" makes state forgeable and non-replayable — the opposite of story-framework's deterministic-engine guarantee. Document as a non-goal in `docs/AUTHORING.md`. |

## P2 — Core game depth

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| 16. NPC run-ins, overlays, and gossip (`social.npc` v0.2) | Authored groups, witnessed encounters, rumors with provenance, friendship memories, overlay caps, and creator controls for simulation frequency. | Seeded runs reproduce exactly; witnesses are physically present; unseen information does not reach the player or unrelated NPCs. |
| M-E. Relationship tempo: ceilings, cadence, gifts — **core shipped** | Optional `social.romance-tempo` adds point banks, rank ceilings, authored rank-up scene effects, per-period gift limits, repeat decay, tastes, and chemistry/satisfaction consequences. Runtime state is replayable and enters private AI context. Still add jealousy-specific authoring presets and Studio controls. | Affection can't be maxed by spamming one action; a ceiling only lifts after an authored scene fires, and gifts have bounded, cooldown-respecting returns. |
| M-F. Missable timed events, off-screen resolution — **core shipped** | `story.timed-events` provides authored tick windows, location/character attendance, attended/missed flags, committed recaps, and replay. Schedule exceptions override routine locations during one-off windows. Still add calendar-date authoring and richer recap presentation. | A missed event advances world state deterministically and the player learns what happened without a fabricated replay. |
| M-G. Character-card V2/V3 import/export | Import/export Character Card V2/V3-compatible persona JSON via a new `scripts/import-card.mjs` (or server route) and Studio UI, mapped onto `packages/contracts/index.d.ts` types. | A SillyTavern-authored character card can be imported as a story-framework NPC/persona and re-exported without lossy round-trip on the fields both formats share. |
| 13. Item operations | Stacks, quantities, consumables, recipes, item use, persistent attributes, durability/charges, and explicit failure semantics. | Replay cannot duplicate an item; a failed use consumes nothing; all effects remain authored and validated. |
| 14. Relationship progression | **Foundation implemented:** named per-character states, event/match transitions, flag/bond/stat requirements, direct scripted effects, scene gates, replay, narrator context, and Studio editing. Still add state visibility, plan consequences, cooldowns, witnessed actions, explanation traces, and contradiction review. Keep numeric dimensions optional. | Kept and broken commitments can unlock different scenes without leaking private knowledge or letting prose grant progression. |
| 15. Schedule exceptions and world conditions — **appointments shipped** | One-off tick-window schedule exceptions and missable events now override routines deterministically. Still add holidays, closures, weather, calendar-date authoring, and expanded debugger explanations. | Exceptions override routine deterministically and attendance remains grounded. |
| 17. Character stats and derived traits (`character.stats`) | **Foundation implemented:** pack-defined player/NPC stats, ranges, starting values, visibility, capped scripted changes, scene requirements, relationship-transition requirements, narrator filtering, replay, and Studio controls. Still add reusable progression rules and derived tags. Stats may represent charm, confidence, empathy, creativity, fitness, reputation, or setting-specific qualities; the core does not hard-code their meaning. | Authors can add or remove a stat without code changes; changes replay exactly; private NPC values do not leak into player context. |
| 18. Attraction, romance, and endings | **Core implemented:** eligibility, weighted preferences, chemistry, phases, relationship agreements, maintenance, romance tempo, gifts, and deterministic `story.endings` gates over flags, dating phases, ranks, intimacy history, and completed scenes. Still add richer witness provenance, autonomous partner conversations, and route-ending Studio forms. | The same player can appeal to different characters for different reasons; high stats never override boundaries, and AI prose cannot award an ending. |
| 19. Adult/intimate scenes (`social.intimacy`) | Optional 18+ module layered over dating: consent state, boundaries, relationship/intimacy prerequisites, privacy and interruption checks, content intensity settings, fade-to-black alternatives, aftermath events, memories, and creator-authored scene templates. Generated prose describes only the already-authorized scene and cannot grant consent or change gates. | Packs must explicitly declare adult content and every participating character must be validated as an adult. A declined, withdrawn, disallowed, or ambiguous interaction cannot enter an intimate scene; lowering the content setting preserves mechanics while using a non-explicit alternative. |
| 20. Phone and feed (`social.phone`, `social.feed`) — **core shipped** | `social.phone` provides authorized contacts, persistent threads, unread/read state, replies, event-triggered messages, and expiring meetup offers using normal travel and attendance. `social.feed` provides source-linked posts, unread state, and authored reactions whose committed events can drive dating or story rules. Studio includes focused data editors for both. Still add polished phone/feed presentation and relationship-conditioned content variants. | Messages and posts survive replay, preserve provenance, and cannot bypass relationship, travel, or attendance rules. |
| 21. Economy depth (`world.economy` v0.2) — **foundation shipped** | Added bounded debt, authored purchasable services, event-driven wages with cooldowns, and multiple location-based shops. Gift consequences already route through romance tempo. Still add true quantity/stock after stackable inventory lands; do not fake quantities on unique item ownership. | Services and wages replay without duplicate payment; debt cannot exceed its authored limit. |
| 22. Cross-setting template packs — **shipped** | Campus Nights, After Hours Bar, and Moonlit Town templates run the same schedule, timed-event, economy, phone, feed, dating, explicit-intimacy, and ending modules. An acceptance test executes equivalent communication and wage flows in all three. | Same modules run all three settings without engine branches. |

## P3 — Presentation and player experience

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| 23. VN playback polish — **shipped** | Searchable full backlog, persistent read tracking, auto-forward, skip-read-only, keyboard controls, per-page transitions, explicit departures, and streamed generation progress are implemented. Auto/skip stop at choices, player input, and adult consent/boundary pages. | — |
| 24. Accessibility and responsive UI — **player view shipped** | Visible focus, screen-reader labels/live regions, font and contrast controls, reduced motion, scalable text, and phone layouts are implemented for play. Studio still needs a formal keyboard/narrow-screen QA pass. | Core creator flows pass the same documented keyboard and narrow-screen checklist. |
| 25. Audio and animation — **foundation shipped** | Optional local interface cues, page/speaker transitions, and reduced-motion fallbacks are implemented. Authored music/SFX/voice assets, channel volumes, fades, expression transitions, and creator controls remain. | Authored cues are optional presentation state, never affect replay, and missing media fails silently and safely. |
| 26. Character and asset workflow | Reusable character packages, pose/outfit sets, gallery, batch validation, crop/transparency tools, and provenance metadata. Optional ComfyUI support stays separate from core play and comes after manual asset workflow is dependable. | Assets can be reused and replaced without broken references; failed generation preserves prior art. |

## P4 — Optional expansion modules

Build these only after the creator and recovery path are dependable. Each should be opt-in, data-driven, replay-safe, and removable without changing the core loop.

| Milestone | Possible modules |
|---|---|
| 27. Education (`world.education`) | Classes, attendance, grades/GPA, exam windows, graduation requirements, and authored consequences. Build only when a campus game is an active deliverable; generic activities and schedules remain the shared foundation. |
| 28. Other genre progression packs | Careers, reputation/popularity, survival stats, crafting, combat or powers, and authored endings. |
| 29. Sharing and ecosystem | Pack export with dependency manifests, reusable module presets, compatibility checks, safe asset bundling, content-rating metadata, and optional community distribution. |
| 30. Advanced model adapters | Provider-specific adapters, context-window negotiation, model capability detection, editable retry/reword flows, and separate queues for narration and media jobs. |

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
| Education | **Do not build yet; retain as P4** | It proves modularity for Campus, but Bar and Fantasy Town gain nothing from GPA/exams. The Campus template can initially use generic schedules and activities. |
| NPC overlays and gossip | **Keep; P2 before romance** | Witness and rumor provenance are prerequisites for fair jealousy or social consequences. Replace arbitrary caps with authored budgets rather than simulating everyone. |
| Automated test-play | **Keep; promote to P1** | New modules multiply unreachable content and clarification loops. This is leverage for every later feature. |
| Mechanics/content digest split | **Keep; promote to P1** | Creators must be able to fix prose and art without destroying campaigns. This belongs with migration safety, not content polish. |
| Cross-scene graph upgrade | **Keep; merge into scene-plan authoring** | Priority, queueing, beats, and plan deadlines already exist. Add prerequisites, timers, variables, and analysis rather than building a second event engine. |
| Campus/Bar/Fantasy templates | **Keep; P2 acceptance deliverable** | Three small maintained packs are the clearest proof that modules are setting-neutral. They should demonstrate systems, not become three large games. |
| Streaming parser integration | **Keep; P0** | High player impact for local models, but previews must remain non-authoritative until final sanitation. |
| Checkpoints and rewind | **Keep; P1** | Valuable recovery feature once atomic preview/final boundaries and migrations are defined. |
| ComfyUI, audio, animation | **Defer; P3 and last** | Large surface area and little mechanical value. Manual assets, accessibility, saves, and creator diagnostics matter first. |

Items not carried forward as new milestones: competing-trigger priority, a bounded pending queue, plan deadlines, kept/broken plan events, and a scene escape hatch. They are already implemented; the remaining work is authoring UX, stable IDs/visibility, diagnostics, and long-campaign evaluation.

## Recommended release sequence

1. Ship a reliability release containing milestones 1–5.
2. Ship a creator-safety release containing milestones 6–12.
3. Implement generic item and relationship progression, character stats, schedule exceptions, and NPC witnesses as the foundation for attraction.
4. Implement `social.dating`, then the separately switchable `social.intimacy` layer, with creator controls and non-explicit fallbacks from the start.
5. Add phone first, then the minimal feed, then economy depth; validate romance-aware flows in Campus, Bar, and Fantasy Town templates.
6. Run a 50-turn campaign evaluation before starting education, ComfyUI, or authored media pipelines. Studio now exposes this evaluation directly.

## Immediate implementation order (updated)

1. Finish scene-plan and graph authoring: stable plan IDs, relative deadlines, visibility, plan create/keep/break forms, prerequisite explanations, and cross-scene graph diagnostics.
2. Add checkpoint/rewind branches with immutable original history and discard previews.
3. Finish creator completeness: replace remaining advanced-JSON-only romance, intimacy, phone, feed, ending, economy, and timed-event paths with typed forms.
4. Add context/contradiction diagnostics and run long-campaign real-model evaluation.
5. Complete authored audio/SFX/voice asset channels only after the creator and recovery paths are dependable.
7. Treat the remaining P4 modules as product choices, not framework completeness requirements.

## Campaign evaluation gate

Before calling the framework production-ready, run at least three 50-turn campaigns with a small local model and one stronger compatible model. Record contradictions, invalid casts, unresolved requests, retries, context size, repeated prose, save recovery, queued-scene behavior, overdue plans, and average response latency. Every mechanical outcome must replay identically after export/import.
