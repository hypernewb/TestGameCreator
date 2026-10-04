Status: done
Files: vendor/venus/scenePrompt.mjs, packages/ai/beats.mjs, tests/player-delivery.test.mjs, docs/research/player-delivery.report.md
Tests: focused tests pass 80 fail 0 skipped 1. Full npm test was attempted; stopped after a prolonged director-test run without a final summary (408 passing checks, no reported failures at interruption).
Acceptance: opening and continuation prompts briefly recast submitted speech in indirect second-person narration; supplied ranks slightly color delivery without changing meaning. Framework and Venus writers, neutral delivery without stats, and provider transport have regression coverage. The beat's no-echo instruction is explicitly limited to NPC speech.
Deviations: direct owner request, no numbered brief assigned. Expanded cloud A/B with a judge was rejected by automatic approval review; used the approved two-turn DeepSeek prompt test and the local runPromptAB harness with in-memory campaigns and manual review. No automated judge scores claimed.
Noticed: the local 9B model did not reliably follow either prompt. Existing tests titled as forbidding all player-action restatement still pass because their assertions match the narrower NPC prohibition; assertions were preserved. DeepSeek still occasionally implies private deliberation despite the explicit restriction.
Questions: none

DeepSeek V4.1 Flash, identical flirting inputs and beat seed 42, synthetic stranger trust 0: original smoke test (Charm 4) explicitly recounted speech in 0/2 opening narration entries; changed smoke test (Charm 0) did so in 2/2, with awkward delivery in both. These are observed compliance counts, not a controlled stat comparison or a general quality score. Both changed replies had no provider lint warnings. Approximate prompt growth: 166 tokens for the smoke-test opening, including the beat clarification.

Before: "You drop your bag by the door and lean against the kitchen counter, and the line lands clean..."
After: "You open with a confession — that you meant to play it cool and she's making that surprisingly hard — then turn it into a question about whether teasing her new roommate counts as one of her hobbies."
Before continuation: "Jana's pen stops mid-tap against the table edge..."
After continuation: "...if she keeps smiling at you like that, you're going to ask her out for coffee. The last part comes out a touch too fast..."

Local qwen3.5-text-9b-nsfw-rp-roleplay-i1, final paired runPromptAB verification, seed 42, Charm 0 and 8, two turns per case: explicit submitted-speech retelling 0/4 baseline versus 0/4 changed. No improvement demonstrated on that model; the prompt change is verified on DeepSeek only. The local replies also invented movements/history. No production DB or AI settings file was read or changed; no commit made.
