# Prioritized milestones

This roadmap is ordered by player risk and dependency, not by novelty. Complete P0 before adding major content systems. AI narration remains descriptive: only validated commands and authored effects may change world state.

## Current baseline

Already implemented: deterministic event replay, revision-safe SQLite saves, authoritative inventory and money, generated-fact review, schedules and dayparts, pinned scene casts, structured scene sanitation, scene summaries and closing, scripted multi-beat scenes, trigger priority and a bounded queue, a scene escape hatch, plans with kept/broken events, relationship dimensions, generic character stats, authored relationship-state graphs, player/NPC dating, NPC romance networks and rival turning points, NPC pair simulation, equipment, authored activities, shops, and event diagnostics.

These systems still need real-model, Windows desktop, keyboard, narrow-screen, and long-campaign testing. Automated coverage is strong but does not replace those checks.

Reliability update: save-envelope migration v1→v2, automatic bounded recovery snapshots with restore UI, OpenAI-compatible SSE scene previews with authoritative final sanitation, and a shared committed cast/location scene plan are implemented. Further historical migrations will be added only when a schema actually changes.

## P0 — Critical correctness and recovery

| Milestone | What to change | Done when |
|---|---|---|
| 1. Unresolved-action truth guard | Carry unresolved destinations, actors, and items into narration context. Refuse or repair prose that claims travel, arrival, possession, or attendance contradicted by committed events. Show a clear player-facing explanation instead of silently acting in place. | Requests for invented or ambiguous places never move the player and never produce prose claiming arrival. Tests cover local-model malformed and plausible-looking replies. |
| 2. Save migrations and backups | Add explicit save-schema migrations, automatic pre-migration backup, migration audit output, and recovery from a corrupt latest save. Stop relying only on exact pack digests for upgrade safety. | An older fixture upgrades without losing events; a failed migration leaves the original usable; recovery is available from the UI. |
| 3. Atomic streaming boundary | Connect the existing JSON stream readers to transport and VN playback. Treat streamed pages as previews until the final response passes sanitation; remove previews on cancellation or invalid final JSON. | Aborting, retrying, or reloading cannot duplicate a turn or retain uncommitted dialogue. Replay matches the final accepted pages exactly. |
| 4. Unified cast and location plan | Produce one authoritative scene plan used by classification, attendance, command validation, prompt context, stage rendering, schedule pinning, and scene release. Eliminate remaining fallback decisions made independently in different layers. | Every turn has one inspectable cast/location decision; no off-stage speaker or narrator-only move can survive validation. |
| 5. Proactive context budgeting | Discover or configure each model's context window, estimate the complete request before sending, reserve output space, and trim in a documented order. Preserve authoritative current state before optional history, lore, and flavor. | A small-context model receives a valid request on the first attempt; the trace shows estimated tokens and every omitted section. |

## P1 — Required for a dependable creator

| Milestone | What to change | Done when |
|---|---|---|
| 6. Mechanics/content digest split | Hash state-affecting rules, IDs, module versions, and schemas separately from prose and presentation content. Allow safe content edits; route real mechanics changes through a previewable migration. | Correcting dialogue or replacing art does not invalidate a save; changing an item ID or rule requires and records a migration. |
| 7. Automated test-play mode | Run deterministic stub/provider-replay campaigns for N turns and report dead-end beats, unreachable choices, never-firing triggers, queue evictions, attendance failures, repeated clarifications, and context pressure. | A creator receives a reproducible report linked to the exact scene/rule that caused each problem. |
| 8. Finish scene-plan and graph authoring | Add Studio controls for creating, keeping, and breaking plans; relative deadlines; stable plan IDs; visibility; duplicate handling; and debugger explanations. Add cross-scene prerequisites, timers, variables, precedence, queue eviction diagnostics, and a graph view. | An author can build and inspect a multi-scene storyline without editing JSON; static analysis identifies missing targets and obvious dead ends. |
| 9. Checkpoints, rewind, and branches | Add named manual saves, automatic scene/daypart checkpoints, branch-from-checkpoint, and a preview of what will be discarded. Keep event history immutable per branch. | A player can safely undo a bad generated scene without replaying mechanical rewards or corrupting the original branch. |
| 10. Context and contradiction diagnostics | Show per-section prompt cost, selected/omitted memories, stale facts, due plans, and conflicting facts. Add recency and salience tuning with a deterministic trace. | A 50-turn test remains inside budget, and a creator can explain why each fact or memory entered the prompt. |
| 11. Creator completeness and validation UX | Replace advanced-JSON-only paths with editors for all supported conditions/effects. Add reference pickers, inline validation, dependency warnings, duplicate-ID checks, and a publish checklist. | Every runtime-supported scene rule can be authored in Studio; invalid references are located before publish. |
| 12. Desktop release safety | Add portable packaging, data-folder selection, backup/restore, log export, runtime/model diagnostics, and a tested update procedure. | A clean Windows machine can install, create, play, back up, update, and restore a campaign without developer tools. |

## P2 — Core game depth

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| 13. Item operations | Stacks, quantities, consumables, recipes, item use, persistent attributes, durability/charges, and explicit failure semantics. | Replay cannot duplicate an item; a failed use consumes nothing; all effects remain authored and validated. |
| 14. Relationship progression | **Foundation implemented:** named per-character states, event/match transitions, flag/bond/stat requirements, direct scripted effects, scene gates, replay, narrator context, and Studio editing. Still add state visibility, plan consequences, cooldowns, witnessed actions, explanation traces, and contradiction review. Keep numeric dimensions optional. | Kept and broken commitments can unlock different scenes without leaking private knowledge or letting prose grant progression. |
| 15. Schedule exceptions and world conditions | One-off appointments, holidays, temporary closures, weather, event overlays, timed invitations, and schedule conflict explanations. | Exceptions override routine deterministically and the debugger explains attendance and expiry decisions. |
| 16. NPC run-ins, overlays, and gossip (`social.npc` v0.2) | Authored groups, witnessed encounters, rumors with provenance, friendship memories, overlay caps, and creator controls for simulation frequency. | Seeded runs reproduce exactly; witnesses are physically present; unseen information does not reach the player or unrelated NPCs. |
| 17. Character stats and derived traits (`character.stats`) | **Foundation implemented:** pack-defined player/NPC stats, ranges, starting values, visibility, capped scripted changes, scene requirements, relationship-transition requirements, narrator filtering, replay, and Studio controls. Still add reusable progression rules and derived tags. Stats may represent charm, confidence, empathy, creativity, fitness, reputation, or setting-specific qualities; the core does not hard-code their meaning. | Authors can add or remove a stat without code changes; changes replay exactly; private NPC values do not leak into player context. |
| 18. Attraction and romance (`social.dating`) | **Core implemented:** hard identity/flag/state/exclusivity eligibility, per-character weighted preferences, hidden/discoverable knowledge, event-driven chemistry, crush/date thresholds, phases, cooldowns, explanation traces, context privacy, date requests, negotiated monogamous/open/polyamorous/casual agreements, asymmetric satisfaction, witnessed and agreement-specific boundary reactions, strain/repair/breakup events, optional decay, replay, and Studio controls. Still add gifts, richer witness provenance, autonomous partner conversations, and ending gates. | The same player can appeal to different characters for different explainable reasons; high stats never override orientation, boundaries, dealbreakers, consent, or authored story gates. |
| 19. Adult/intimate scenes (`social.intimacy`) | Optional 18+ module layered over dating: consent state, boundaries, relationship/intimacy prerequisites, privacy and interruption checks, content intensity settings, fade-to-black alternatives, aftermath events, memories, and creator-authored scene templates. Generated prose describes only the already-authorized scene and cannot grant consent or change gates. | Packs must explicitly declare adult content and every participating character must be validated as an adult. A declined, withdrawn, disallowed, or ambiguous interaction cannot enter an intimate scene; lowering the content setting preserves mechanics while using a non-explicit alternative. |
| 20. Phone and feed (`social.phone`, `social.feed`) | Contacts, persistent threads, unread/read-time state, flirting and relationship-aware messages, requests, expiring hangout offers, event-triggered posts, and optional feed interactions. Reuse attendance and dating rules rather than inventing a second relationship system. | Messages and posts survive import/export, use authorized contacts, respect relationship/privacy state, and resolve offers through committed events and existing attendance checks. |
| 21. Economy depth (`world.economy` v0.2) | Multiple shops and stock, gifts, preferences, repeatable/scheduled wages, services, bounded debt, and authorable price/reward curves. Treat business ownership as a later submodule unless the first game requires it. | No action duplicates money or stock; authors can rebalance the economy without code changes; gift consequences route through relationship and attraction events. |
| 22. Cross-setting template packs | Campus, Bar, and Fantasy Town packs using the same modules and no setting-specific engine branches. Include opt-in romance examples with distinct preferences and content settings. Keep templates small enough to maintain as executable examples. | One acceptance script runs equivalent phone, schedule, plan, shop, attraction, and social flows in all three packs. |

## P3 — Presentation and player experience

| Milestone | Feature currently missing or incomplete | Done when |
|---|---|---|
| 23. VN playback polish | Backlog search, auto/skip/read modes, per-line stage transitions, explicit mid-scene departures, better choice layout, and granular generation progress. | Long scenes are comfortable by mouse and keyboard and retain the exact accepted transcript. |
| 24. Accessibility and responsive UI | Full keyboard navigation, visible focus, screen-reader labels/live regions, font and contrast controls, reduced motion, scalable text, and phone/tablet layouts. | Core play and creation flows pass a documented keyboard and narrow-screen QA checklist. |
| 25. Audio and animation | Authored music/SFX cues, volume controls, sprite transitions, expression changes, and reduced-motion fallbacks. | Cues are optional presentation state, never affect replay, and missing media fails silently and safely. |
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
6. Run a 50-turn campaign evaluation before starting education, ComfyUI, audio, or animation.
7. Treat the remaining P4 modules as product choices, not framework completeness requirements.

## Campaign evaluation gate

Before calling the framework production-ready, run at least three 50-turn campaigns with a small local model and one stronger compatible model. Record contradictions, invalid casts, unresolved requests, retries, context size, repeated prose, save recovery, queued-scene behavior, overdue plans, and average response latency. Every mechanical outcome must replay identically after export/import.
