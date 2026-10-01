# Scene feedback: design card
Status: draft · Tickets: T-014

## Goal (what the player feels)
Every move lands: what it cost and what she made of it, in the same beat as her reply.

## What we have (self-audit, cite docs/map)
- Trust has exactly one writer: `changeTrust` (`packages/modules/romance-stats.mjs:11`) clamps 0..100, applies the daily cap, and emits `social.relationshipChanged` with `{actor,old,value,delta,capped,text}`. It returns the *applied* delta, so capped gains are already honest.
- The touch ladder emits its own pair (`packages/modules/touch-ladder.mjs:60,64`): `social.touchAccepted` / `social.touchRefused`, both carrying `trustDelta`, `lustDelta`, plus a refusal `reason` and `verdict`. Deterministic, no AI call — exactly the input a chip and a mood line need.
- The only renderer today is prose, not chips: `relationshipFeedback(events,pack)` (`public/app.mjs:13`) folds events per actor+stat, calls |delta|≥5 "strong", and returns sentences ("Mika warms considerably toward you. ♥") into `#relationship-feedback` and the log. No shared chip component exists anywhere in `public/` (`docs/map/public.md`).
- Nearest existing widget: `endCard` rows of ♥+/♥− per priced act, and `yields` (arrows for player stats, a heart for trust, exact money) in `public/campus.mjs:54,63`. Stat numbers are deliberately not shown there — a creator-facing, pre-scene surface.
- Panels are plain text lines: module `panel(s)` (`Lust N`, touch-ladder.mjs:76) rendered by `public/play.mjs:95` and `public/app.mjs:32`. The heroine card (`characterCards`, `public/app.mjs:23`) shows hearts, stage, availability, teaser — nothing about this turn.
- Net: every number this card needs is already emitted per turn; what is missing is one chip layer and one mood line, both pure functions of the turn's events.

## Reference games (2–3, one line each)
- rp-master `dating/rapport.ts`: five tiers — `lighting_up / warming / at_ease / pulling_back / on_edge` — labelled "lighting up", "warming to you", "at ease", "pulling back", "on edge", tones up-strong/up/flat/down/down-strong; one cheap judge call per turn over the last 8 turns; returns null on failure so the previous read stays.
- rp-master `dating/relationshipAssist.ts`: the per-turn scoring it *suppresses* during a live date — 7 dimensions, deltas clamped to −2..2, difficulty scaling, `dampenRepeatedDeltas` (×0.4 on repeated positives), a <12-word `reason`. Their split — no numbers mid-scene, one qualitative read — is the model.
- Venus `shared/relationship.ts` + `statusMark.ts`: no live read at all. An affection *tier* (`dispositionOf`, floors 50/30/15/−15/−30), a contact-sheet tag, milestone sentences, and a coloured run inside the sentence (`markedLine`, gain/loss). Durable state, not per-turn — the opposite of a mood line.

## Owner decisions
- 2026-10-01 Chips: romance (Like/Trust/Lust) + player stats + money; hidden stats never shown; chips last until the next turn.
- 2026-10-01 Mood line: 5 tiers with rp-master wording, one line per heroine present, updated in place.
## Mood line rule (draft — engine-picked, zero AI calls)
Input is only this turn's player-visible events. Score = Σ `trustDelta` + 3·Σ `lustDelta`; −3 when a refusal `reason` is `privacy` or `soberty`, −1 when it is only `trust`, +2 when a `hesitate` landed instead of a refusal. Bands, with hysteresis — the current tier holds until the score leaves its own band by 2:

| tier | score | wording (pick one per character) |
| --- | --- | --- |
| up-strong | ≥ 8 | "she's all in" · "she can't stop smiling" |
| up | +3..+7 | "she's warming to you" · "she's leaning into you" |
| flat | −2..+2 | "she's comfortable" · "she's holding steady" |
| down | −7..−3 | "she's pulling back" · "she's keeping her distance" |
| down-strong | ≤ −8 | "she's on edge" · "she's shutting it down" |

Wording is rp-master's labels in second person, ≤4 words, no numbers, no stat names, no scene summary — the mood, not the outcome. One line per character present, replacing itself in place rather than appending, so a scene shows a mood, not a log. Nothing renders when the score is flat *and* the tier did not change.

## Creator option (field, modes, campus default; creator UI screen)
`pack.sceneFeedback: {chips:'on'|'off', mood:'on'|'off'}` — campus default `on`/`on`, non-campus default `off`/`off` (today's behaviour, unchanged). Two selects beside the existing relationship editors in `public/studio.mjs`; per-world, per owner-answers 2026-10-01.

## Thin slice → full version
Thin: chips + mood line computed from the events that already exist, one `sceneFeedback` pack field, one renderer in `public/campus.mjs` shared by `play.mjs` and `app.mjs`, no engine change. Full: per-character port so the panel tracks her where she is, and a mood line that falls back to her existing `stage` name on a turn where no delta fired.

## Fun rubric notes (agency, surprise, payoff, repetition)
Agency: the chip names what the choice bought before the player leaves the beat. Surprise: a refusal chip (−1 Trust, −1 Lust, reason `privacy`) turns a blocked ladder rung from mysterious into legible. Payoff: the strong tiers are the "she noticed" beat the prose feedback only approximates. Repetition: hysteresis plus in-place replacement kill the flicker and log-clutter a per-turn line would otherwise cause.
