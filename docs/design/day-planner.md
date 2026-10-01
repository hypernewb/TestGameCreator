# Day planner: design card
Status: draft · Tickets: T-016, T-011

## Goal (what the player feels)
Know what is worth doing today, choose where to spend time, and see that choice matter without guessing how to advance the day.
Owner direction: clock-only is the long-term ideal; a planner is acceptable for this iteration if simpler to playtest, selected per world (see `docs/research/owner-answers.md`).

## What we have (self-audit, cite docs/map)
- Scope: `docs/map/README.md`, `docs/map/modules.md`, and `docs/map/packs.md`; the module registry exposes relevant systems beyond the map's short list.
- `packages/modules/social.mjs`: `world.schedule` moves NPCs on committed time advances, supports repeating/weekly routines and exceptions, holds scene participants, and offers wait-until-arrival; conversation can reveal the next scheduled stop.
- `packages/modules/daypart.mjs` (named by `packages/modules/index.mjs`): next-daypart returns the player to an intro location, then exposes eligible invitations from the completed intro artifact; accepting uses travel and meeting-arrival checks.
- `packs/living-world.json`: enables schedules and daypart introductions. This is an existing day-loop example, not a blank slate.
- `packs/campus.json`: enables schedules, authored activities with durations and effects, and scripted scenes; defines `gameProject.sceneBudget` and `goodbyeEndsDay`, but does not enable `world.daypart` or author `daypart` settings.
- `packages/modules/scenes.mjs`: offered scenes already expose who/where/time-cost hints and locked reasons; persistent promises have deadlines and kept/broken outcomes. These promises are distinct from a daily activity menu.
- `packages/modules/dating.mjs`: attraction preferences can react to kept/broken promises; planner selection alone must not create a promise or award relationship progress.
- `packages/modules/economy.mjs` and `stats.mjs`: deterministic money/stat effects already exist; campus activities author these rewards, so planner should reuse them.
- `packages/modules/abilities.mjs` (named by the registry): an optional named energy pool buys powers and refills at a rest location; it is not a daily social-action budget and campus does not enable it.
- Gap in the audited surface: no registered day-planner module or campus planner selector; the research digest's claim that ours has no day loop overlooks the systems above. Core time handlers were outside this audit's file scope.
- Overlap risk: activity duration, scene budget, goodbye-to-day-end, daypart intros, and power energy must not become competing charges for the same selection.

## Reference games (2–3, one line each)
- rp-master: `.rp-master/src/lib/world/dayPlanner.ts` offers Meet/Text/Rest without a menu-generation call; meet location falls back from schedule to frequented place to home, and busy status is narrative rather than a hard gate; `world/calendar.ts` derives energy from day/phase and advances on spending.
- Venus: `.venus/stores/slotActions.ts` prioritizes today's plans, classes, shifts, and projects, then fills with weak-stat activities; `timetable.ts` resolves current obligations/presence, and `gameStore.ts` advances alternating slots with date rollover.

## Owner decisions (dated; every number lives here)

## Creator option (field, modes, campus default; creator UI screen)
- Proposed pack field: `gameProject.timeMode`, enum `clock | planner`; absent field means `clock` for compatibility. Both use the same deterministic world clock and schedule state.
- `clock`: existing exploration, activities, and continuous conversation advance through existing commands; no planner landing screen.
- `planner`: a “Plan today” screen groups existing legal opportunities by daypart, showing destination, known company, time cost, and availability; choose an activity now rather than booking a whole day.
- Proposed campus default: `planner` for the thin-slice playtest, pending report Q1; today's pack has no explicit mode. No pack change in this ticket.
- `public/studio.mjs`: add “Day loop” to the existing “Game project” section in `render()`, alongside “Conversation gameplay” and calendar settings; keep schedule/activity authoring in their existing editors. Explain planner's time accounting beside the selector.
- Preserve creator location/schedule visibility settings: undiscovered whereabouts must not appear just because the planner knows the schedule. Show only authored/known information and ordinary availability hints.

## Thin slice → full version
- Thin slice: build a deterministic menu from existing available activities, offered scenes, and waits; keep free exploration accessible. Do not require AI-generated daypart invitations or introduce an energy pool merely to render the menu.
- Selecting dispatches the existing action; retain its duration and effects pending Q2. Check conditions again at commitment/arrival, report unavailable choices without rewards, and never teleport an NPC or imply agreement to meet.
- Browsing is free. Return to the planner when a scene ends; use existing time-boundary reactions for schedules, promises, and daily limits. Pending Q3, ending a conversation should leave the rest of the day usable in planner mode.
- Carry the active scene and committed clock through save/load; selecting or reloading must not duplicate rewards/time charges. Keep `clock` behavior compatible and do not add model calls.
- Full version: forecast known opportunities across the day, add editable future reservations with explicit acceptance and cancellation, and show clashes/missed commitments through the existing promise ledger.
- Only after the menu is useful, consider a creator-tunable daily activity budget derived from the same clock; settle numerical costs separately, keep it distinct from power energy, and avoid double-charging travel and scene turns.
- Implementation acceptance: play through an activity, conversation, wait, day rollover, unavailable arrival, and save/load in both modes; verify matching committed effects, correct schedules/deadlines, free browsing, and a usable remaining day.

## Fun rubric notes (agency, surprise, payoff, repetition)
- Highest impact: unclear next move; evidence is the split across schedule waits, activities, scene offers, and intro invitations. Cheap experiment: surface existing actions together and compare hesitation before the next choice.
- Next: opaque time loss; campus authors activity duration, scene budget, and goodbye-to-day-end settings. Cheap experiment: preview committed time cost and test whether players can predict their remaining opportunities.
- Next: repetitive filler; menus can flatten authored surprises into repeated grind. Cheap experiment: put due commitments and newly available scenes ahead of repeat activities, retain exploration, and compare repeat selections and new-scene encounters.
