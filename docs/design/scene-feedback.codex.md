# Scene feedback: design card
Status: draft · Tickets: T-014

## Goal (what the player feels)
See the effect of a scene choice immediately through small stat-delta chips and a short mood line, without another AI call.
The owner chose both displays, with creator controls to hide either (`docs/research/owner-answers.md`, scene feedback and judging answers).

## What we have (self-audit, cite docs/map)
`docs/map/README.md`, `docs/map/public.md` and `docs/map/modules.md` locate browser rendering and module logic; the public map names `public/app.mjs` and `public/vn.mjs` but does not explicitly identify a heroine-panel file.
`packages/modules/romance-stats.mjs`: `changeTrust` writes `social.relationships.edges`, clamps Trust, applies the daily gain cap and emits `social.relationshipChanged` with old/value/applied delta; quiet calls still emit when the applied change is nonzero.
`packages/modules/touch-ladder.mjs`: `attemptTouch` calls `changeTrust`, writes per-character Lust and emits `social.touchAccepted`/`social.touchRefused` with trustDelta/lustDelta and verdict; Lust is clamped but lustDelta is the requested amount, so it can overstate actual movement at a bound.
`public/app.mjs`: `characterCards` renders hearts, stage, stats and recent changes into `#characters-list`; generic module panels render into `#panels`; `relationshipFeedback` aggregates old/value events into prose in `#relationship-feedback` and the log.
`public/vn.mjs`: `createVn`/`refresh` renders scene pages, speakers and controls; no generic stat-delta chip renderer appears in these inspected UI files.
The Like writer and server projection are outside these reads; a full implementation must verify their event and visibility contracts.

## Reference games (2–3, one line each)
Our campus: existing relationship prose is event-driven rather than a persistent scene mood; numeric character stats live in the overview (`public/app.mjs`).
rp-master: `.rp-master/src/lib/dating/rapport.ts` has five labels (lighting_up, warming, at_ease, pulling_back, on_edge), picked by `assessRapport` from the last eight nonblank transcript messages plus names/personality via an extra stateless judge call; parse/connection failure returns null to retain the previous read, and no affection is changed.
Venus: `.venus/shared/relationship.ts` supplies colored liked/loved/disliked/hated memory lines and flag-diff milestone wording; `.venus/stores/loop/statusSteps.ts` sequences them with stat movement and milestone screens at scene end, rather than supplying an in-scene rapport chip system in the inspected snapshot.

## Owner decisions (dated; every number lives here)

## Creator option (field, modes, campus default; creator UI screen)
Proposed per-world `gameProject.sceneFeedback = {statChips: true, moodLine: true}`; independent toggles permit both, chips only, mood only or neither; campus defaults to both as already directed.
Place the toggles on the creator's scene/conversation settings screen (proposed placement; no creator code changed).

## Thin slice → full version
All rules and example character wording below are proposals for approval in the report, not settled owner decisions.
Thin: produce a deterministic feedback record for the scene's addressed character after the engine commits the turn; render chips and the mood line beside the dialogue.
Filter events by player visibility and a visible-stat allowlist before aggregation; propose Like, Trust and Lust only. Never show Chemistry, Inhibition or another hidden stat, including through tooltips or hidden-stat mood inputs.
Compute signed chips from actual before/after values, group by character/stat, omit unchanged stats, and deduplicate Trust reported by both touch and relationship events. A capped gain produces no invented positive chip.
Proposed lifecycle: keep chips until the next committed player turn or scene end; do not clear them on VN page advance, polling or narration retry. Attribute each chip to its character.
Mood inputs: visible Like/Trust values before and after the committed turn for that character, scoped to the current scene; Lust does not imply rapport or permission. No transcript judging and no extra AI call.
Proposed ordered tiers, first match wins: both Like and Trust decrease → on_edge (“she seems more guarded”); either decreases → pulling_back (“she's pulling back”); both increase → lighting_up (“she's warming noticeably”); either increases → warming (“she's warming to you”); neither changes → steady (“the mood is steady”).
Loss therefore wins on mixed changes; missing dimensions do not count as increasing or decreasing. With no known rapport dimension, omit the mood line rather than invent a read.
Recompute per committed turn; show steady at scene start only when a rapport dimension is known, and reset on scene/character change. Flat or capped stats do not prove comfort; wording stays cautious.
Feedback is descriptive only: never changes eligibility, acceptance, refusal, consent, departure or character actions; those remain engine outcomes.
Full: expand verified Like event coverage and named per-character rows for group scenes; consider deterministic interpreted-action signals for capped turns only after owner approval.
Implementation acceptance cases: bounded Lust, capped Trust, duplicate Trust events, mixed gains/losses, hidden/invisible events, zero movement, missing dimensions, retries, scene reset and every display mode; add tests when behaviour is built.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: connect choices to actual visible changes; optional displays preserve creator control.
Surprise: a mixed result can show rising Lust beside guarded rapport without suggesting permission.
Payoff: deliver feedback with the committed scene result, even if narration fails.
Repetition: maintain a stable line per turn; avoid timers, page-by-page replay and invented variety in the thin slice.
