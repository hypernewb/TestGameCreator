# Day planner: design card
Status: decided · Tickets: T-016, T-011, T-018

## Goal (what the player feels)
Know what is worth doing today, choose where to spend time, and understand the remaining opportunities.

## What we have (self-audit, cite docs/map)
[Modules](../map/modules.md) locates social schedules, scenes, dating, economy and stats; the [map index](../map/README.md) separates pack content, engine time and presentation.
The draft identifies schedules/exceptions and active-cast holds, daypart introductions/invitations, offered scenes, timed promises and authored activities with effects.
Campus already has schedules, activities, scene-budget and goodbye-to-day-end settings; the draft reports no campus planner selector or enabled daypart introduction loop.
Promise acceptance remains distinct from planner selection. Optional power energy is not a daily social-action budget.
Avoid overlapping charges from activity duration, travel, scene budgets, goodbye handling and daypart transitions.

## Reference games (one line each)
- rp-master: deterministic Meet/Text/Rest menu, schedule/haunt/home fallbacks and calendar-derived spending; narrative busy status is not our permission contract.
- Venus: obligation-first slot menus, weak-stat activity fillers, timetable presence and date rollover.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Day loop: clock-only is the ideal; a day-planner screen is fine for this iteration if it's simpler to playtest. Make it a creator option (clock | planner).
- 2026-10-01 Planner: campus default = planner; 3 slots/day (morning/afternoon/evening), one activity each; ending a chat doesn't end the day in planner (still does in clock).
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
- 2026-10-01 Slots: 1 activity = 1 slot, including travel and the conversation.
Every mechanic choice is a per-world creator option; ship the simplest mode first ([owner answers](../research/owner-answers.md)).

## Creator option (field, modes, campus default; creator UI screen)
Proposed gameProject.timeMode = clock | planner; campus default planner. Missing settings preserve legacy clock behavior.
Add Day loop beside conversation/calendar settings in public/studio.mjs; retain existing schedule/activity editors.
Clock retains exploration/time commands and goodbye-to-day-end behavior. Planner shows the decided day slots and an activity choice for the current slot.
Show known destination/company, availability and remaining slots; preserve authored location/schedule visibility. Planner knowledge must not reveal undiscovered whereabouts.

## Thin slice → full version
Thin: build a deterministic menu from legal activities, offered scenes and waits, with exploration accessible. No menu-generation call, new energy pool or pending daily-budget decision.
Commit the selected activity through existing actions/effects and consume the current planner slot once. Recheck conditions at commitment/arrival; unavailable choices grant no rewards.
Use the shared world clock for slot transitions, schedules, promise deadlines and daily limits. Activity durations, travel and scene turns must fit that slot accounting without duplicate activity charges; exact duration-to-slot mapping needs an owner decision.
Browsing is free. Ending a chat returns to the planner without ending the day; ending a chat in clock mode still ends the day. Consume remaining slots and roll over through the shared calendar.
Keep active scene, slot progress and committed effects through save/load; retries cannot duplicate rewards or slot spending. Planner selection never creates a promise, teleports an NPC or implies meeting consent.
Full: forecast known opportunities, add accepted/cancellable future reservations and show clashes/missed commitments through the existing promise ledger; retain the decided slot model.
Implementation checks: activity/chat/wait, remaining-day usability, unavailable arrival, rollover, save/load, visibility and correct schedule/deadline effects in both modes.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: show useful choices and remaining opportunities. Surprise: surface new scenes and due commitments without exposing secrets. Payoff: predictable slot use makes choices matter. Repetition: prioritize obligations/new scenes over filler while keeping exploration.
