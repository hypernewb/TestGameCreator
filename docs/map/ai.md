# AI

**Purpose**: Prompt context, budgets, model providers and the typed-turn service.

**Key Files**:
- `packages/ai/context.mjs`: Engine context, bounded player identity/topic-location lore, deduplicated outcomes and optional shared-history/jealousy context (T-032/034/036/041).
- `packages/ai/context-budget.mjs`: Token budgets and stage/daily-mood voice examples (T-028/047).
- `packages/ai/beats.mjs`: Beat directions and speech fingerprint/voice tags with legacy fallbacks (T-028).
- `packages/ai/memory.mjs`: Third-person memories and retrieval.
- `packages/ai/providers.mjs`: Compatible/mock providers and scene generation.
- `packages/ai/service.mjs`: `GameService`; typed interpretation, mixed-operation proposals, refusal narration, `inputLost`, absent NPC locations and wants prompt data (T-035/038/040/041).
- `packages/ai/narration-lint.mjs`: State/prose checks and warn-only echo detection; absent `echoWords` defaults to 8, explicit 0 disables it (T-041/047).
- `vendor/venus/scenePrompt.mjs`: Scene prompt, calendar/away lines, echo/prop rules and wants cue.

**Rules/Invariants**:
- One model call per normal turn; initiative and prompt cues add no calls.
- The engine owns outcomes, consent and cast; the model cannot award state changes.
- Refusals use existing narration or deterministic in-story text without a second narration call.
- Echo warnings do not request repairs. Replay never calls the model.
- `inputLost` is cumulative over the service lifetime, not a per-campaign metric.

**Tests**:
- `tests/voice.test.mjs`, `dialogue-voice.test.mjs`, `lore-window.test.mjs`, `prompt-slips.test.mjs`.
- `tests/mixed-actions.test.mjs`, `input-lands.test.mjs`, `wants.test.mjs`, `owner-picks-1002.test.mjs`.
