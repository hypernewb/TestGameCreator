# GC2.5 Stage guidance: verification (2026-10-08)

Scope: docs/GAME-CREATOR-COMPLETION-PLAN.md GC2.5. Test file: tests/gc25-stage-guidance.test.mjs.
Method: read the code paths and ran focused tests on the real functions. No browser suites, no model calls, no product changes.

## Code path (read)
- `relationshipStageOf` in packages/ai/character-context.mjs picks the stage label. Order: strained (dating, not broken/rejected) > dating phase (anything but `available`) > `c.relationshipStages[id]` > trust (>=75 close, >=40 friend, <5 stranger if no memories, else familiar).
- `service.mjs` (about line 130) fills `context.relationshipStages` by calling `relationshipStageOf` with the engine trust edge. That map is therefore trust/dating-derived, not authored.
- Stage labels reach the prompt through `context-budget.mjs` (castProfiles `relationshipStage`, behaviorCue via `behaviorCueOf`) and `beats.mjs` (`STAGE` moves).
- `context.mjs` emits `relationshipProgression` as `{character,state}` where `state` is a raw state id (e.g. `route-start`). `packages/modules/progression.mjs` owns the authored state machine and its names.

## Rules
| # | Rule | Status | Evidence |
|---|------|--------|----------|
| R1 | Trust 0/40/75 map to stranger/friend/close with no dating phase | verified | test "GC2.5 (b) trust fallback" |
| R2 | Null trust gives empty stage | verified | same test |
| R3 | Dating, exclusive, broken, rejected phase outranks trust 90 | verified | test "dating phase outranks high trust" |
| R4 | Strain shows `strained` in dating and never overrides broken/rejected | verified | test "strain is reported" |
| R5 | Budgeted cast profile carries `relationshipStage` broken at trust 90 | verified | test "budgeted cast profile" |
| R6 | Authored progression state (social.progression names, e.g. Introduction/Connection) drives the stage line | todo-gap | `relationshipStageOf` never reads `social.progression`; test.todo "GC2.5 (a)" |
| R7 | Authored stage absent falls back to trust thresholds | verified | same as R1 (no authored path exists to override) |
| R8 | Refusal and boundary text reaches the stage prompt | unverified-by-reading | no stage-line code reads `agreementGates`/refusal; test.todo "GC2.5 bounds" |
| R9 | Strain/dating facts appear in the prompt as factual text (not only as the label) | unverified-by-reading | strain only changes the label and `mood` in `datingContext`; prompt text not traced |
| R10 | Visible diagnostics (playtest/inspector) show the authored stage | unverified-by-reading | not searched for; out of focused test scope |

## Todo-gap names
- `GC2.5 (a) authored stage (social.progression state name) drives the stage line`
- `GC2.5 bounds: refusal/boundary text reaches the stage prompt`

## Notes
- The raw `relationshipProgression` panel gives ids, not labels, so the model sees `route-start` rather than "Introduction". Fixing this is product behaviour and is left as a todo-gap.
- Counts: 5 verified, 2 todo-gap (test.todo), 3 unverified-by-reading.
- Limits: tests use a minimal pack; no live model run; trust edge fixed at 90 or 0/40/75 values.
