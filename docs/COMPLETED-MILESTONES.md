# Completed milestones

Fully shipped milestones (Done when: —), moved out of [NEXT-MILESTONES.md](NEXT-MILESTONES.md) to keep that file focused on remaining work. Read this file only when you need history on a specific shipped system.

## Fun tier

| Milestone | What changed |
|---|---|
| F6. Visible progress and teased next scene | Character cards render hearts, authored route-rank names, and the next rank scene or nearest trust-gated storylet. Numeric trust, chemistry, satisfaction, and thresholds remain available only in creator/test diagnostics. |
| F9. Feedback juice and player-only chrome | Relationship changes render as short human-readable reactions in feedback and backlog. The normal header and VN view contain story controls; memory, backups, exports, journal, creator panels, Studio, and compact harness appear only after enabling Developer view from the game menu. |

## P0 — Critical correctness and recovery

| Milestone | What changed |
|---|---|
| 1. Narration lint pipeline (M-C) | Generalized the unresolved-action truth guard (`packages/ai/scene-boundaries.mjs`) into `lintScene` (`packages/ai/narration-lint.mjs`), run on every narration inside `CompatibleProvider.generateScene`'s existing repair loop: (a) travel/arrival/possession/attendance, (b) knowledge leaks against `knownBy` in `packages/modules/facts.mjs`, (c) content-level overflow against `pack.intimacySettings.contentLevel`. |
| 2. Save migrations and backups | Explicit save-schema migrations, automatic pre-migration backup, migration audit output, and recovery from a corrupt latest save. |
| 3. Atomic streaming boundary | JSON stream readers connected to transport and VN playback; streamed pages are previews until final sanitation passes. |
| 4. Unified cast and location plan | One authoritative scene plan used by classification, attendance, command validation, prompt context, stage rendering, schedule pinning, and scene release. |
| 5. Proactive context budgeting | Model context window discovery/config, request-size estimation, output reservation, documented trim order (LODs, size presets). |

## P1 — Required for a dependable creator

| Milestone | What changed |
|---|---|
| 6. Mechanics/content digest split | `mechanicsShape`/`mechanicsDigest` (`packages/core/engine.mjs`) hash only state-affecting fields (schema, module set, actor locations, exits, shop/hidden item flags, activity effects, schedules, relationships, start options) — prose, names, and presentation are excluded and no longer invalidate a save. `describeMechanicsChange` previews a diff between two packs; `migratePack`/`Store.migratePack` apply a real mechanics change, re-validate the new pack, and append an audit entry to `world.migrations`. `execute()` still hard-fails with "Pack changed: migration required" until a migration runs. |
| 7. Automated test-play mode | `scripts/audit-playtest.mjs` supports command-line audits. Studio now runs every authored opening across three deterministic seeds, reports action failures, orphaned beats, queue evictions, paused/active scenes and never-fired route content, and presents per-scene completion coverage with exact scene IDs. The live-provider playtest separately reports clarifications, context pressure, recall, echoes, and fallbacks. |

## P2 — Core game depth

| Milestone | What changed |
|---|---|
| 22. Cross-setting template packs | Campus Nights, After Hours Bar, and Moonlit Town templates run the same schedule, timed-event, economy, phone, feed, dating, explicit-intimacy, and ending modules. An acceptance test executes equivalent communication and wage flows in all three. |

## P3 — Presentation and player experience

| Milestone | What changed |
|---|---|
| 23. VN playback polish | Searchable full backlog, persistent read tracking, auto-forward, skip-read-only, keyboard controls, per-page transitions, explicit departures, and streamed generation progress are implemented. Auto/skip stop at choices, player input, and adult consent/boundary pages. |
