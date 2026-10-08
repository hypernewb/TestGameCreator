# Character progression gap analysis (2026-10-08)

Status: read-only source analysis. No code, no model calls, no commits. Evidence is the working tree as of 2026-10-08 (dirty with other lanes' changes). Labels: **shipped** (present and wired), **partial** (present, incomplete or not reaching the player), **absent**, **unverified** (not traced yet).

Owner direction it serves: [NEXT-MILESTONES.md — Current direction (2026-10-07)](../NEXT-MILESTONES.md#current-direction-2026-10-07). Roadmap: [Character progression milestones](../NEXT-MILESTONES.md#character-progression-milestones-2026-10-08).

## Baseline

- `npm test` on the current tree: 2205 total, 2195 pass, 0 fail, 10 skipped (about 47s). The 67-failure figure in [T-protagonist-latitude](../briefs/T-protagonist-latitude.report.md) is not current for this tree.
- Browser suites were not run; no UI changed.

## Corrections to earlier notes

- `changeTrust` is not the only Trust writer: `director.mjs:59` writes edges directly (A2).
- The stage cue exists (E). It is partial because thresholds are hard-coded; the earlier "absent" label was wrong.
- The daily-cap default question is answered for shipped packs: `dailyGain: 6` with tempo profiles (D). The open part is packs without tempo profiles.
- The `relationshipStages` override appears inert on the service path (E).
- The `question` memory kind is narrow: it covers "tell me more about…" requests only (H).

## What exists

| # | Area | Status | Evidence |
|---|---|---|---|
| A | Trust writer | **shipped** | `changeTrust` ([romance-stats.mjs:21](../../packages/modules/romance-stats.mjs)) clamps 0–100, applies the daily cap, emits `social.relationshipChanged`. Callers include engine effects ([engine.mjs:318](../../packages/core/engine.mjs)), scenes ([scenes.mjs:89](../../packages/modules/scenes.mjs)), social talk ([social.mjs:107](../../packages/modules/social.mjs)), jealousy ([jealousy.mjs:42](../../packages/modules/jealousy.mjs)), minigames ([minigames.mjs:45](../../packages/modules/minigames.mjs)), touch ladder ([touch-ladder.mjs:87](../../packages/modules/touch-ladder.mjs)), flirt cap ([flirt-cap.mjs:13](../../packages/modules/flirt-cap.mjs)), outreach ([outreach.mjs:52](../../packages/modules/outreach.mjs)), moments ([moments.mjs:37](../../packages/modules/moments.mjs)), dating phase exits ([dating.mjs:107](../../packages/modules/dating.mjs)). `arc.mjs` and `daily-need.mjs` also match `changeTrust(` in grep; not traced. |
| A2 | Direct trust write (correction) | **partial** | The summary said `changeTrust` was the only writer. It is not: [director.mjs:59](../../packages/modules/director.mjs) writes `social.relationships.edges` directly for a missed-goal cost, clamped at 0 with its own event. Negative-only, and it bypasses the daily cap logic, which only gates gains. Decide whether that is intended. |
| B | Talk trust | **partial** | [social.mjs:107](../../packages/modules/social.mjs): +2 for a promise, +1 for fresh substantive talk, once per edge per day key (`--talk--d<day>`), skipped when `flirtSpent`. Runs only on `social.spoke` with `source: 'scene'`. Ordinary non-talk scene exchanges earn no generic trust. |
| C | Authored dialogue reactions | **partial** | [social.mjs:108](../../packages/modules/social.mjs) handles `dialogueReactions` only for `social.spoke` and `core.sceneContinued`. [engine.mjs:306](../../packages/core/engine.mjs) emits `core.sceneStarted` for every non-continue activity; [engine.mjs:307](../../packages/core/engine.mjs) emits `social.spoke` only for `talk` with exactly one present actor and `social.conversation`. So an authored reaction does not fire on the first exchange of a non-talk scene. Shipped `campus.json` and `campus-trio.json` define zero `dialogueReactions`, so this matters for creator-authored packs, not the shipped campus. |
| D | Daily trust cap | **shipped, conditional** | `cappedGain` ([romance-stats.mjs:19](../../packages/modules/romance-stats.mjs)) caps only when `romanceStats.dailyGain` is an integer **and** the character has a `romanceTempoProfiles` entry. Shipped `campus.json` and `campus-trio.json` set `dailyGain: 6` and have tempo profiles (4 and 3 characters). `world-assembly.mjs:41` defaults generated packs to `dailyGain: 6`. A social character without a tempo profile is uncapped. |
| E | Stage cue | **partial** | The summary said no automatic familiar-stage cue exists. That was wrong. `relationshipStageOf` ([character-context.mjs:3–5](../../packages/ai/character-context.mjs)) returns the dating phase first (non-available phases, `strained`), then `relationshipStages[id]` if present, then trust thresholds: ≥75 `close`, ≥40 `friend`, <5 `stranger` if no memories or past scenes involve them, otherwise `familiar`. [beats.mjs:11](../../packages/ai/beats.mjs) gives each stage a tone and move add/drop lists, used at [beats.mjs:52](../../packages/ai/beats.mjs) and [beats.mjs:95](../../packages/ai/beats.mjs). Gap: thresholds are hard-coded, not authored. The `relationshipStages` override (`character-context.mjs:5`) has no authored writer. Its only writer is [service.mjs:130](../../packages/ai/service.mjs), which computes it from the same function. On that path the override is read before the map assigns it, so it appears inert; not confirmed by a run. The Studio "Relationship stages" editor ([studio.mjs:423](../../public/studio.mjs)) edits `relationshipStageSettings` (dating policy), not this override. |
| F | Authored relationship states | **partial** | `social.progression` ([progression.mjs](../../packages/modules/progression.mjs)) has states, transitions and requirements (flags, bonds, stats, goalStep, validated conditions). It is listed as "Relationship states" ([index.mjs:68](../../packages/modules/index.mjs)). It is **not enabled** in `campus.json` or `campus-trio.json` (no module, no `relationshipStates`, no `relationshipProgressions`). It is enabled only for generated packs with a `route` option ([bulk-authoring.mjs:332](../../packages/ai/bulk-authoring.mjs)). The state reaches the context object ([context.mjs:98](../../packages/ai/context.mjs), [context.mjs:136](../../packages/ai/context.mjs)). I did not confirm that it reaches the model prompt text, and it does not feed the stage cue in E. |
| G | Experience cue | **partial, prompt-only** | `packages/ai/relationship-experience.mjs` (untracked) recognises short, exact-quote, first-person company statements as liked/disliked ledger memories and emits a "Recent shared experience" cue. Its test is also untracked. No trust, bond or progression change. The A/B recorded in [T-experience-progression-loop](../briefs/T-experience-progression-loop.report.md) used two scripted turns per arm on the 9b model, not generated multi-encounter conversations. |
| H | Memory | **shipped (classification partly verified)** | `classifyUtterance` ([memory.mjs:22](../../packages/ai/memory.mjs)) returns `question` only for "tell me / us / [player] more about…" requests, plus `meta`, `action` and `statement`. It is applied at [memory.mjs:107](../../packages/ai/memory.mjs) and [memory.mjs:114](../../packages/ai/memory.mjs). The earlier pass listed `promise` and `disclosure` kinds; not re-traced here. Source-line and speaker retention not re-checked. |
| I | Dating and tempo | **unverified** | Exports exist: [dating.mjs:95](../../packages/modules/dating.mjs) `setDatingPhase`, [dating.mjs:89](../../packages/modules/dating.mjs) `changeChemistry`, [dating.mjs:113](../../packages/modules/dating.mjs) `changeSatisfaction`, [dating.mjs:120](../../packages/modules/dating.mjs) `setAgreement`, [romance-tempo.mjs:46](../../packages/modules/romance-tempo.mjs) `addPoints`, [romance-tempo.mjs:67](../../packages/modules/romance-tempo.mjs) `advanceRomanceRank`. I have not traced milestone flags, breakup, settlement or neglect behaviour through a run. Venus-side settlement can break relationships automatically; whether this framework does the same, and how, is a CP0 question. |

## What is missing (against the owner's progression direction)

- **G-b (absent for non-talk first exchanges).** Authored reactions do not fire on `core.sceneStarted` (C). Changing this alters historical command replay, so it needs a versioned pack flag and replay tests first. `schemaVersion` must stay 1 ([engine.mjs:150](../../packages/core/engine.mjs)), so the flag belongs in the mechanics digest ([engine.mjs:204](../../packages/core/engine.mjs)); confirm before adding.
- **G-c (absent for ordinary scenes).** Non-talk exchanges earn no generic trust (B). Owner decision.
- **G-d (partial).** Stage cue is trust-threshold-driven, not authored. Owner decision on whether authored progression state should drive the cue.
- **G-e (owner decision).** Daily cap applies only with tempo profiles (D). Non-romance social packs are uncapped. Keep opt-in or make it default?
- **G-f (absent).** No affection aggregate from memories (Venus-style). Progression is authored transitions over flags, bonds, stats and goal steps (F). Whether to add any aggregate is an owner decision; if added it must be explicit, inspectable and free of imported numeric thresholds, per [T-venus-progression-review](../briefs/T-venus-progression-review.report.md).
- **G-g (absent in shipped campus).** `social.progression` is not enabled in the shipped campus packs (F). The fun gate has been judged on packs without authored progression.
- **G-h (absent).** No multi-encounter evaluation with generated conversations. The experience A/B is two scripted turns per arm (G).
- **G-i (unverified).** Dating/tempo milestones, breakups and settlement (I).
- **G-j (conflict).** Test model: [CLAUDE.md](../../CLAUDE.md) says `qwen/qwen3.8-27b`; [NEXT-MILESTONES.md](../NEXT-MILESTONES.md) previously said `qwen3.5-text-9b-nsfw-rp-roleplay-i1 (owner instruction)`; the experience A/B used the 9b model. Owner must confirm which is current.
- **G-k (direction conflict).** [CLAUDE.md](../../CLAUDE.md) "Current product priority (owner 2026-10-04)" is creator-first. The 2026-10-07/08 notes make chatting → character progression the player-experience lane, with creator/profile authoring owned by another AI. Both cannot be the working priority without a stated split.

## Items not claimed as fixed

- The experience layer is not a progression mechanic and does not change trust, bonds or progression state.
- Campus fun-gate play has not been run against progression on the current tree.
- No live model quality claim is made here. Enjoyment is owner judgment.

## Owner questions

1. Test model: `qwen/qwen3.8-27b` (CLAUDE.md) or `qwen3.5-text-9b-nsfw-rp-roleplay-i1`?
2. Direction: confirm the two-lane split (player experience = chatting → progression; creator/profile = other AI) and whether CLAUDE.md "Current product priority" should be updated.
3. Should authored reactions fire on `core.sceneStarted`? (Requires a versioned flag because of historical replay.)
4. Should ordinary `core.scene` talk earn generic trust?
5. Should the daily trust cap be the default for social packs, or stay opt-in?
6. Should authored progression state drive the stage cue, or should the trust thresholds stay the default?
7. Should exact-quote experience recognition ever drive bounded mechanical trust or bond changes? Recommendation: reuse author-declared `dialogueReactions` rather than add a second recognizer; keep experience narration-only otherwise.
8. Should `director.mjs:59` keep its direct trust write, or route it through `changeTrust`?
9. Should repeated wording alone ever end a conversation automatically? (Carried from [T-doc-direction-reconciliation](../briefs/T-doc-direction-reconciliation.report.md).)

## Decisions (2026-10-08)

- Split: one lane works on the engine, the other on the creator. No further split needed.
- Q4: ordinary scene talk earns generic trust.
- Q3: authored reactions may fire on `core.sceneStarted`, behind a versioned pack flag recorded in the mechanics digest. Packs without the flag keep current replay behaviour.
- Q5: the daily cap becomes the default for social packs, behind the same versioned flag.
- Q7: no second recognizer. Authored `dialogueReactions` drive bounded trust through `changeTrust` with the daily cap. The experience cue stays narration context only.
- Q8: `director.mjs:59` routes its write through `changeTrust`.
- Q9: repeated wording never ends a conversation automatically.
- Q6 (stage cue from authored progression): open. Recommendation stands: authored progression sets the stage when present, trust thresholds are the fallback.
- Q1 (test model): open; CLAUDE.md names `qwen/qwen3.8-27b`.

## Next step

CP0: a read-only multi-encounter trace through `GameService` on a temp DB, no model calls, using a shipped pack and a generated route pack. Record trust, bonds, dating phase, stage, experience cue and memories after each encounter, then check export/import replay. Start there before any engine change.
