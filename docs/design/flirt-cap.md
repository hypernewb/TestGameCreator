# Daily flirt cap and departure cue: design card
Status: decided · Tickets: T-015, T-010, T-018

## Goal (what the player feels)
Flirting matters without becoming an endless shortcut. She cues a departure, allows a last exchange, then goes; leaving itself carries no penalty.

## What we have (self-audit, cite docs/map)
[Modules](../map/modules.md) locates social, dating and scene lifecycle systems; the [map index](../map/README.md) separates pack content from engine behavior.
The draft identifies fresh-talk rewards, remembered topics and phrase-specific damping in social, chemistry signals in dating, schedule holds for active scene cast and scene-end cleanup.
Those are integration points, not a shared daily flirt counter or a stored departure countdown. Existing gift pacing and Like/Trust ceilings must not duplicate the new gate.
The creator currently exposes conversation/schedule and damping controls; Social pacing is a proposed addition.

## Reference games (one line each)
- rp-master: same-intent nudges, dampened positive deltas and gift cadence; its separate rapport judge is excluded by the owner decision.
- Venus: recency-weighted memories and milestone tracking; reader deduplication is not a shared daily flirt cap or departure grace mechanism.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Repeat flirting: boredom stat is the ideal; ship a daily cap first (fits the +6/day Like/Trust cap). Creator option (cap | boredom).
- 2026-10-01 Flirt cap: 3 attempts/heroine/day; every attempt counts; after the cap, talk continues with 0 positive gains (negative reactions still apply).
- 2026-10-01 Unwelcome flirting: the reaction depends on her personality (deflect / tease back / shut down), with matching stat changes.
- 2026-10-01 Leaving: she cues ("I should get to class"), you get 1–2 turns for a last move, then she leaves; no penalty unless you were rude.
- 2026-10-01 Leaving cue: 2 player turns after her cue, then she leaves. This fixes the earlier grace range.
- 2026-10-01 Rude exit: per-heroine rules on her sheet (what she finds rude + her reaction); no universal penalty.
- 2026-10-01 Judging (aftercare, rapport): no extra AI calls; the engine judges from state plus the turn's interpreted action. One call per turn stays.
Every mechanic choice is a per-world creator option; ship the simplest mode first ([owner answers](../research/owner-answers.md)).

## Creator option (field, modes, campus default; creator UI screen)
Proposed socialPacing contains flirt.mode (cap | boredom), flirt.dailyLimit and departure.graceTurns. Campus ships cap with the decided allowance and cue/grace behavior.
Add Social pacing beside conversation settings in public/studio.mjs; cap exposes the daily limit and departure exposes farewell turns. Boredom remains unavailable until built.
Departure pacing is independent of flirting. Rude-exit definitions and personality reactions belong on each heroine's sheet. Do not add an unapproved immediate-departure mode or universal penalty.

## Thin slice → full version
Thin: persist a per-player/heroine/calendar-day counter for interpreted flirting across typed input and suggested actions. Every committed attempt counts, including unsuccessful or unwelcome attempts; retries count only the committed turn.
Rephrasing, scene restart, travel and save/load cannot reset the allowance. Use the existing calendar day and Like/Trust ceiling.
Once the allowance is exhausted, conversation continues with no positive flirt gains; negative personality-driven reactions still apply. Gate downstream flirt rewards without blocking ordinary conversation.
When a scheduled obligation requires her departure from the active scene, store its destination and grace state, then cue that obligation. Subsequent committed player turns spend the decided grace; the cue turn does not.
On expiry, move her to the scheduled destination and update scene cast/cleanup. Early exit clears pending scene state; restarting cannot extend the same obligation. Handle each heroine independently.
Polite farewells and departure apply no loss. Rudeness uses authored per-heroine event/condition/effect rules with the interpreted action; no extra judge call or new physical permission.
Full: boredom accumulation/recovery and authored obligations beyond schedules use the same pacing integration; cap and boredom must not silently run together.
Implementation checks: exhausted allowance, negative reactions, next-day reset, repeated phrasing, restart/retry/save-load, actual departure, multi-heroine scenes and polite versus authored rude farewell.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: clear allowance and a last exchange keep departures playable. Surprise: personality shapes unwelcome flirting. Payoff: chips/mood show actual outcomes. Repetition: a shared budget closes wording loopholes while talk stays available.
