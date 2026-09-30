# Evaluating the text the player sees

`node scripts/prompt-ab.mjs` now runs every arm through `GameService`, deterministic engine processing, persistence, and the same `linesFor` presentation function used by `public/play.mjs`. Judging occurs afterwards. Off-cast filtering, sanitization, first-scene cues, director pages, quiet trust results, highlights, scene closes and ending text all participate. Draft text is retained separately in JSON for diagnosis; it is never submitted as the displayed reply.

The normal game turn does not gain any model calls. The offline evaluation has additional judge calls, and records actual provider request counts separately from scene-generation calls.

## Modes

- `--mode paired --reference ours` is the default when `ours` is present. Before each player input, each arm receives a separate copy of the reference arm's save. Each resulting turn is processed completely before judging. Only the reference result supplies the next common starting state. This is the closer comparison of immediate prompt effects; every arm's displayed results are included.
- `--mode trajectory` keeps a separate campaign for each arm throughout the scenario. The arms start with the same seed and player inputs, but may change scenes, time and relationships differently. This measures the resulting player experience, rather than controlling later state.

Neither mode makes model inference deterministic. Intent classification can take different routes even from identical saves. Reports flag differences in scene phase or cast. Such turns cannot isolate scene-prompt quality. They remain useful evidence about the complete pipeline. Seeds control engine randomness, not model sampling; repeat runs and inspect the transcripts.

The available arms are `ours` (current production prompt), `plain` (current non-hybrid prompt), `venus`, and `hybrid`. Production currently defaults to hybrid, so `ours,hybrid` is rejected as a duplicate comparison. `plain` is not a frozen copy of the historical prompt from the earlier report. Default comparison: `plain,venus,ours`.

## Local example

```powershell
node scripts/prompt-ab.mjs --endpoint http://localhost:1234/v1 --model qwen3.5-text-9b-nsfw-rp-roleplay-i1 --scenario roommate --variants plain,venus,ours --mode paired --reference ours --seed 42 --turns 7 --judge-orders 2 --out artifacts/chat-audit/prompt-ab-paired.md
```

The harness detects the local loaded context window and applies the production context preset. Use `--window N` for an explicit override or `--context-size minimal|default|max` to exercise trimming. Cloud endpoints use production fallback budgets when no window is supplied. `--judge ID` and `--judge-endpoint URL` allow a separate judge. Local requests do not receive the cloud API key.

## Interpreting a report

Every pair is judged in both A/B orders by default. Scores include continuity and stage-appropriate warmth. Missing, nonnumeric, out-of-range scores and invalid winners reject the comparison and produce a judge error. No zero score or synthetic tie is substituted for a malformed verdict. A reversed-order disagreement is reported separately and counted as a conservative tie; it is not evidence that the replies are equally good. `--judge-orders 1` is a cheaper exploratory run without that check.

JSON is now an envelope `{meta, rows}` (`evaluationVersion: 2`), rather than the old bare row array. It contains model and context settings, engine seed, modes, source hashes, scene-prompt hashes, before/after engine records, displayed lines, draft replies, warnings, request counts and raw judge attempts. If hashed source files change during a run, the report is marked invalid and the command fails. Failed judge comparisons also make the command fail, while still saving the report.

The rendered transcript covers the dialogue stream and its marked engine beats. It does not simulate mouse clicks, sprite placement, timing, or every side-panel widget. The judge receives committed events and mechanical context as factual evidence, not as additional dialogue. Model judging is still subjective and can favor a style or length; use a separate judge and human blind reading before choosing a production style.

To measure pipeline fixes themselves, compare runs against separate code snapshots with the same fixtures and configuration. Prompt arms within a single run share the same pipeline code. Their source hashes prevent confusing a prompt comparison with a before/after pipeline experiment.

## Context fixes accompanying this harness

Indirect player instructions such as “Tell her you will go with her to the beach on sunday” now retain the player's ownership in memory. Explicit quotes and first-person dialogue preserve the listener meaning of “you/your.” Existing score-sub-turn and recent-score-event exclusions are preserved and tested. Memory reconstruction applies the pronoun correction to existing saved utterances without rewriting campaigns.

Failed exchanges refund their scene slot through a recorded engine patch, so new saves agree with event replay and import validation. Retrying prose does not refund twice. The service defers safety-cap closure until generation succeeds; failure on the final slot keeps the conversation open. Engine boundary reactions and player exits still apply immediately.

The smoke reports in `artifacts/chat-audit/context-eval-*.md` are infrastructure checks, not enough evidence to select a style. The first smoke caught a malformed judge score. A subsequent two-turn trajectory run caught an order-dependent judgment and differing intent routes. The paired smoke then disagreed on both turns when order was reversed, awarding no style wins. No claim of improved warmth follows from these samples.
