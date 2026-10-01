# Evaluating the text the player sees

`node scripts/prompt-ab.mjs` now runs every arm through `GameService`, deterministic engine processing, persistence, and the same `linesFor` presentation function used by `public/play.mjs`. Judging occurs afterwards. Off-cast filtering, sanitization, first-scene cues, director pages, quiet trust results, highlights, scene closes and ending text all participate. Draft text is retained separately in JSON for diagnosis; it is never submitted as the displayed reply.

The normal game turn does not gain any model calls. The offline evaluation has additional judge calls, and records actual provider request counts separately from scene-generation calls.

## Modes

- `--mode paired --reference ours` is the default when `ours` is present. Before each player input, each arm receives a separate copy of the reference arm's save. Each resulting turn is processed completely before judging. Only the reference result supplies the next common starting state. This is the closer comparison of immediate prompt effects; every arm's displayed results are included.
- `--mode trajectory` keeps a separate campaign for each arm throughout the scenario. The arms start with the same seed and player inputs, but may change scenes, time and relationships differently. This measures the resulting player experience, rather than controlling later state.

Neither mode makes model inference deterministic. Intent classification can take different routes even from identical saves. Reports flag differences in scene phase or cast. Such turns cannot isolate scene-prompt quality. They remain useful evidence about the complete pipeline. Seeds control engine randomness, not model sampling; repeat runs and inspect the transcripts.

The available arms are `ours` (current production prompt), `plain` (current non-hybrid prompt), `venus`, `hybrid`, `calm`, and `context-wide`. Production currently defaults to hybrid, so `ours,hybrid` is rejected as a duplicate comparison. `plain` is not a frozen copy of the historical prompt from the earlier report. `context-wide` is a variant of `ours` that uses a 1500-character sliding-window transcript tail and preserves full/tail level-of-detail for any turn whose text or input names a current cast member; it can be added alongside `ours` or `hybrid` (e.g. `--variants ours,context-wide`). Default comparison: `venus,hybrid`.

## Local example

Current local evaluation target: `qwen/qwen3.8-27b` at `http://localhost:1234/v1`, per the owner's 1 October 2026 instruction. Use the 27b model for local generation and model judging. Older 9b reports remain historical results, not the current evaluation target.

```powershell
node scripts/prompt-ab.mjs --endpoint http://localhost:1234/v1 --model qwen/qwen3.8-27b --scenario roommate --variants plain,venus,ours --mode paired --reference ours --seed 42 --turns 7 --judge-orders 2 --out artifacts/chat-audit/prompt-ab-paired.md
```

The harness detects the local loaded context window and applies the production context preset. Use `--window N` for an explicit override or `--context-size minimal|default|max` to exercise trimming. Cloud endpoints use production fallback budgets when no window is supplied. `--judge ID` and `--judge-endpoint URL` allow a separate judge. Local requests do not receive the cloud API key.

The `context-wide` arm (and the `--context-wide` flag in `scripts/ai-game-tester.mjs`) enables a 1500-character sliding-window transcript tail instead of the default 700. It also preserves the full or tail level-of-detail for any transcript turn whose text or input mentions a current cast member by name, so character continuity and recurring dialogue beats survive a tight budget. Non-character turns are still compacted normally. Compare `ours,context-wide` to measure the effect on character-recall quality.

`--verbose` prints the scene-history level-of-detail retained for each variant after budget allocation. Lines marked `[keep]` received the full or tail transcript; `[digest]` was compacted to a one-line summary. This is the primary validation metric for the context window: confirm that character lines show `[keep]` under `context-wide` while non-character lines compact to `[digest]`, and that the tail text length is at most 1501 characters (ellipsis plus 1500 chars) rather than 701 (the old 700-char window).

## Interpreting a report

Every pair is judged in both A/B orders by default. Scores include continuity and stage-appropriate warmth. Missing, nonnumeric, out-of-range scores and invalid winners reject the comparison and produce a judge error. No zero score or synthetic tie is substituted for a malformed verdict. A reversed-order disagreement is reported separately and counted as a conservative tie; it is not evidence that the replies are equally good. `--judge-orders 1` is a cheaper exploratory run without that check.

JSON is an envelope `{meta, rows}` (`evaluationVersion: 3`), rather than the old bare row array. It contains model and context settings, engine seed, modes, source hashes, scene-prompt hashes, before/after engine records, displayed lines, draft replies, warnings, request counts and raw judge attempts. If hashed source files change during a run, the report is marked invalid and the command fails. Failed judge comparisons also make the command fail, while still saving the report.

## Sustained conversations and manual steps

The `calm` arm changes only ordinary continuation policy: it answers and develops the current topic without a mandatory new agenda or forced interjection. Openings, closings, first checkpoints and authored directions retain their baseline behavior. Reply quotas remain unchanged. This arm is an experiment; production does not switch to it.

Three ten-step fixtures (`warmth`, `continuity`, `affection`) include explicit disclosures, later memory checks and a planned goodbye. The affection fixture starts with Jana's trust at 80; it changes the fixture's initial relationship, not her authored boyfriend or biography. Each fixture's first encounter uses an explicit engine command to avoid an intent-classifier routing lottery. Later inputs take the normal service path, including refusal and early closure. Repeats keep the engine seed constant and repeat model inference; they are not different engine worlds.

```powershell
node scripts/prompt-ab.mjs --endpoint http://localhost:1234/v1 --model qwen/qwen3.8-27b --scenario warmth,continuity,affection --variants ours,calm --mode trajectory --repeats 2 --judge-scope conversation --judge-orders 2 --out artifacts/chat-audit/sustained-ours-calm.md
```

`--judge-scope conversation` judges each complete trajectory twice with reversed A/B ordering, rather than judging each exchange independently. The same nine criteria apply, with continuity, warmth and willingness to answer assessed across the whole transcript. Verdicts appear on the final row of each case. `.partial.json` checkpoints retain completed turns during long runs.

Manual steps:

1. Keep the local model server running at the address above. Let other sessions finish editing evaluated files before rerunning, or evaluate a frozen source copy. Source hashes must remain unchanged for a valid comparison.
2. Read the generated `.blind.md` first. Score its twelve transcripts in `.human.csv`: unmotivated topic changes, correct/wrong/missed callbacks, reciprocal care, premature endings, willingness to answer, and a preference for each pair. Include turn numbers and short quotes. High trust means close friendship, not an invented romantic commitment.
3. Open `.key.json` and the model report only after recording human scores. Compare human findings against the model verdicts and order disagreements. Report disagreement rather than averaging it away.
4. Choose whether the calm arm merits adoption only after that review. Test flexible reply length as a separate arm afterwards; stronger romance instructions remain deferred.

`meta.sustainedMetrics` records observed failures, request counts, turns needing multiple calls, and unplanned engine closures. Unplanned closures are candidates for review, not automatic proof of a premature ending. Topic drift and reciprocal care require reading the text; the harness does not pretend lexical matches establish these qualities. The local writer also judges unless a separate judge is configured, so its preferences are not independent human evidence.

The rendered transcript covers the dialogue stream and its marked engine beats. It does not simulate mouse clicks, sprite placement, timing, or every side-panel widget. The judge receives committed events and mechanical context as factual evidence, not as additional dialogue. Model judging is still subjective and can favor a style or length; use a separate judge and human blind reading before choosing a production style.

To measure pipeline fixes themselves, compare runs against separate code snapshots with the same fixtures and configuration. Prompt arms within a single run share the same pipeline code. Their source hashes prevent confusing a prompt comparison with a before/after pipeline experiment.

## Context fixes accompanying this harness

Indirect player instructions such as “Tell her you will go with her to the beach on sunday” now retain the player's ownership in memory. Explicit quotes and first-person dialogue preserve the listener meaning of “you/your.” Existing score-sub-turn and recent-score-event exclusions are preserved and tested. Memory reconstruction applies the pronoun correction to existing saved utterances without rewriting campaigns.

Failed exchanges refund their scene slot through a recorded engine patch, so new saves agree with event replay and import validation. Retrying prose does not refund twice. The service defers safety-cap closure until generation succeeds; failure on the final slot keeps the conversation open. Engine boundary reactions and player exits still apply immediately.

The smoke reports in `artifacts/chat-audit/context-eval-*.md` are infrastructure checks, not enough evidence to select a style. The first smoke caught a malformed judge score. A subsequent two-turn trajectory run caught an order-dependent judgment and differing intent routes. The paired smoke then disagreed on both turns when order was reversed, awarding no style wins. No claim of improved warmth follows from these samples.

## Refusals, agreement changes and winding down

The headless AI tester records denied actions and clarifications as turn-level refusal findings and continues play. It critiques the observed transcript even when coverage is partial; reaching the requested date and critique availability are separate facts. A refusal alone no longer marks the test as an external tester failure. Real tester/provider errors and the turn guard remain visible.

Relationship agreements have a default cooldown of one game day after a change. Renegotiating an existing agreement costs five satisfaction points unless an authored agreement gate specifies its own cost. Initial commitment has no default satisfaction charge. Dating profiles can customize `agreementCooldownTicks` and `agreementSatisfactionCost`; authored agreement changes also start the cooldown, preventing an immediate button reversal. All changes are recorded engine events and patches.

Continuous conversations can wind down before their safety limit when at least six successful narrated turns are followed by a third successive request with the same substantive words. This is a conservative repetition heuristic, not a semantic determination that a subject has nothing left to offer. New words, numbers or a different subject reset it. First-scene checkpoints and pending authored scenes are exempt. The normal model call answers the player and closes gently; the engine ends the scene only after a successful reply. Failure keeps the scene open for retry.
