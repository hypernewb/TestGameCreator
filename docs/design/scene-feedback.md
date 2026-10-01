# Scene feedback: design card
Status: decided · Tickets: T-014, T-018

## Goal (what the player feels)
See what a choice changed beside her reply through stat-delta chips and a short mood line.

## What we have (self-audit, cite docs/map)
The [map index](../map/README.md) separates browser presentation from engine/modules; [modules](../map/modules.md) locates social, stats, dating and intimacy.
Both drafts identify event-driven relationship prose in public/app.mjs, character overview/panels and VN dialogue, but no shared scene chip renderer or persistent mood line.
Both identify Trust's applied-change event and touch acceptance/refusal events. The detailed draft warns that touch Lust deltas can be requested rather than applied, and Trust can appear in overlapping events; use actual snapshot differences for honest chips.
The map does not document renderer contents or writer contracts finely enough to settle the heroine-panel/stat-display disagreement. Verify those surfaces and Like/player-stat/money visibility contracts during implementation.
Existing prose and activity yield/end-card cues are integration points, not proof that every required delta is already safely emitted.

## Reference games (one line each)
- rp-master: rapport labels “lighting up”, “warming to you”, “at ease”, “pulling back”, “on edge”; replace its extra transcript judge with engine judgment.
- Venus: durable affection/memory and milestone feedback at scene end rather than a live scene mood read.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Scene feedback: show both stat-delta chips and a short mood line; creator option to hide either.
- 2026-10-01 Chips: romance (Like/Trust/Lust) + player stats + money; hidden stats never shown; chips last until the next turn.
- 2026-10-01 Mood line: 5 tiers with rp-master wording, one line per heroine present, updated in place.
- 2026-10-01 Mood math: by size of change, score bands ≥8 / 3..7 / −2..2 / −7..−3 / ≤−8, privacy/sobriety refusals push down, hysteresis so it doesn't flicker.
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
- 2026-10-01 Mood score: Trust change + 3×Lust change (applied deltas); privacy/sobriety refusal −3; hysteresis 2; every heroine starts at the middle tier.
Every mechanic choice is a per-world creator option; ship the simplest mode first ([owner answers](../research/owner-answers.md)).

## Creator option (field, modes, campus default; creator UI screen)
Proposed gameProject.sceneFeedback = {statChips: true, moodLine: true} on the creator's scene/conversation screen. Independent toggles allow both, chips only, mood only or neither; campus starts with both.
Apply visibility policy before aggregation/rendering, including tooltips and mood inputs. Chemistry and other hidden stats do not leak through either surface.

## Thin slice → full version
Thin: after a committed turn, compute actual visible before/after changes; aggregate by character/stat, deduplicate overlapping Trust events, omit unchanged stats and include visible player stats and money.
Keep chips until the next committed player turn; VN paging, polling or narration retry must not replay or clear them. Deliver feedback with the committed result even if narration fails.
Render a named mood row for every heroine present from the start; update it in place. Use the owner's bands in descending order with the reference labels above.
Engine judgment uses state plus the interpreted action, change size and downward privacy/sobriety-refusal adjustments. Hysteresis stabilizes tier changes.
Score inputs/weights, refusal adjustment size, hysteresis width and initialization/no-change behavior remain owner questions; discard invented weights, bonuses, alternate wording and the sign-only tier rule.
Feedback describes outcomes; it never changes consent, eligibility, acceptance, refusal or departure. Lust and a positive mood never imply permission.
Full: extend verified event coverage and reuse shared rows across scene surfaces while preserving all-present heroine coverage and visibility.
Implementation checks: bounded Lust, capped gains, duplicate events, mixed changes, hidden events, player stats/money, unchanged turns, group scenes, retries, transitions and every display mode.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: choices connect to actual changes. Surprise: desire can rise while rapport worsens. Payoff: feedback arrives with the result. Repetition: hysteresis and in-place rows prevent flicker and clutter.
