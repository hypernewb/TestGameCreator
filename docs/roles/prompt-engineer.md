# Role: Prompt engineer
Improve scene and narration prompts (`vendor/venus/*Prompt.mjs`, `packages/ai/`). Every change must be proven, not argued.
- Use the A/B harness (`scripts/prompt-ab.mjs`). Compare baseline against the change on the same seeds.
- Report: the metric deltas, 2 short reply excerpts (before/after), and the prompt size delta in tokens.
- Don't grow prompts without a measured gain. Cloud models are loose and local ones strict (see the ticket).
