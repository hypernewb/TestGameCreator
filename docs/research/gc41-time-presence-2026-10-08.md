# GC4.1 time and presence validation (2026-10-08)

Scope: GC4.1 bullet in docs/GAME-CREATOR-COMPLETION-PLAN.md. Tests: tests/gc41-time-presence.test.mjs.
Method: read the real functions (packages/core/engine.mjs, packages/modules/calendar.mjs, packages/modules/daypart.mjs,
public/calendar.mjs, public/schedule-resolver.mjs) and pin behaviour with the neutral pack. No code was changed.
Existing suites already cover parts of this (time-cost, calendar-world, weekly-routines, studio-tick-minutes);
they were not re-run as part of this item.

Status legend: verified = pinned by a passing test; todo-gap = test.todo with the gap named; unverified-by-reading = not tested here.

## Items

1. Action duration and cost display: verified. timeCost uses pack.tickMinutes (campus default 60), shows `1h 30m`, `45m`, or `N ticks` when no minutes are set. Test: "cost display uses pack minutes...".
2. Wait cost: verified. Plain Wait is 1 tick (durations default); wait-until a daypart costs ticks to that boundary. Test: "wait-until cost...", "a one-hop move and the wait option...".
3. One-hop move cost and actions() cost match the engine advance: verified (move = 1 tick, tick advances by 1).
4. Invitation/hangout cost vs travel distance: todo-gap. acceptHangout arrives after route.length ticks, but its cost is the generic one tick, so distance is not priced there.
5. Travel routing over exits and flag gates: verified. routeBetween honours flags; travel moves step by step and emits core.moved.
6. Blocked travel: verified. Unreachable destination emits core.travelBlocked and leaves the actor in place.
7. Scene travel cost (hops plus one conversation tick): verified via optionCost (2 ticks for one hop).
8. Opening hours as whole-day closures by weekday or date: verified. closedReason returns the authored reason on the closed weekday and null on other days.
9. Opening hours limited to one daypart: todo-gap. Closures are whole-day; closedReason ignores daypart.
10. Weekly routine stops: verified. A weekly stop fires only on its weekday and daypart, only on interval boundaries; off-boundary ticks return null.
11. Periodic stop vs weekly routine precedence: verified. A periodic stop at tick 16 wins over the Monday afternoon routine.
12. Exceptions: verified. An inclusive tick window overrides stops and weekly rules (kind 'exception'); exception IDs are required and unique (validated in packages/modules/social.mjs).
13. Arrival-time presence: verified. nextArrivalTick finds the next tick the schedule places the character at a location, skipping the exception window; scheduledLocation applies the exception.
14. Meeting succeeds only if the character is present at arrival: verified (meetingArrival true when present; routine arrival emits world.actorArrived).
15. Missed meeting: verified for the text path. meetingArrival returns false, emits world.meetingUnavailable to the player with nextArrival tick and a readable line.
16. Missed meeting changes the world beyond text: todo-gap. No flag, relationship or miss state is recorded by world.meetingUnavailable.
17. Scene attendance vs missed scheduled stop: verified. settleSceneAttendance moves a scene character to the scheduled stop that falls inside the scene.
18. Daypart rollover (tick 11 to 12, week boundary at tick 84): verified via calendarFor.
19. Next daypart returns the player to the introduction location: verified (world.nextDaypart).
20. Reconcile accepted weekly priority rules with old documentation: unverified-by-reading. The docs were not compared in this pass; no test or claim is made.

## Evidence limits

- Only the neutral pack fixture was used; campus and holiday/weather combinations are covered by existing suites, not re-tested here.
- Hangout travel (item 4) and missed-meeting state (item 16) are documented as gaps, not fixed (no behaviour change allowed).
- Not run in browser suites; no UI rendering of costs was checked.
