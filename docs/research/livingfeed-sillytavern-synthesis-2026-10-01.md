# Living Feed & SillyTavern Feature Adaptation Analysis

Status: **research only.** Companion to `agent-memory-atlas-2026-10-01.md`, `module-gaps-2026-10-01.md`, and `sillytavern-features-2026-10-01.md`.

Source material: LivingFeed architecture patterns (actor simulation, component storage) and SillyTavern lorebook/macro/depth-injection engine.

---

## Part 1: LivingFeed Patterns for Story Framework

LivingFeed treats characters as **autonomous state-holders with discrete scoring components stored on records**, rather than flat LLM prompts. 

### 1. Stored Composite Score Components (`packages/modules/director.mjs`)
- **Current Limitation:** Our director uses opaque scalar weights or single-variable thresholds (e.g., `tension > 5`, `quietDayparts >= 2`). When a beat fails or succeeds, we cannot inspect *why* other than checking logs.
- **LivingFeed Adaptation:** Store sub-score components directly on active beat or memory records:
  ```json
  {
    "beatID": "cafe-argument-01",
    "components": {
      "recencyPenalty": -0.8,
      "affinityBonus": 1.2,
      "tensionWeight": 0.5,
      "cooldownRemaining": 0
    },
    "score": 0.9
  }
  ```
- **Benefit:** Makes director telemetry, prompt inspection, and fun-metrics completely explainable and auditable.

### 2. Actor Simulation Loops Without LLM Overhead
- LivingFeed runs background character schedule/intent ticks without invoking an expensive language model for every NPC every turn.
- **How we use it:** Our `packages/modules/` background modules (like character wandering, schedule ticking, unprompted text generation) should be entirely deterministic math over state flags, reserving the LLM solely for the **active scene narrator and dialogue delivery**.

---

## Part 2: SillyTavern Mechanics & UX to Adapt

SillyTavern remains the gold standard for prompt assembly, character card expression, and context engineering.

### 1. Swipes / Alternate Generations
- **Concept:** SillyTavern allows the user to swipe left/right to regenerate alternative assistant replies without altering the conversation history.
- **Story Framework Equivalent:** Since our engine enforces a strict single-model-call-per-turn rule, "swipes" can be implemented as **ephemeral alternative branch draws**:
  - The model generates a candidate completion.
  - If the player clicks "Regenerate", the engine re-runs the single model call with an alternate seed or temperature bump, presenting the new narrative block while keeping engine state mutations rolled back until accepted.

### 2. Depth Injection & Macro Scoping
- **Concept:** ST injects lorebook entries at specific prompt depths (e.g., 2 turns back, system prompt start, or right before user input) and provides macro substitution (`{{user}}`, `{{char}}`, `{{last_message}}`).
- **Story Framework Equivalent:** Our `packages/ai/retrieval.mjs` and prompt builder (`packages/ai/prompt.mjs`) should allow explicit depth/tier placement for world lore vs. character memory vs. active scene state.

### 3. Inclusion Groups & Lorebook Logic
- **Concept:** Lorebook entries can be grouped so that only one entry in a mutually exclusive group fires, or logical expressions (`AND`/`OR`/`NOT`) govern activation.
- **Story Framework Equivalent:** Our `director-library.mjs` and `role-slots.mjs` can adopt inclusion groups so that mutually exclusive narrative beats (e.g., two alternative street encounters) cannot trigger simultaneously in the same daypart.

---

## Summary Recommendation

1. **Adopt Component Storage**: Store breakdown sub-scores on director beats for full explainability.
2. **Deterministic Background Simulation**: Keep actor ticks pure JS; reserve LLM calls strictly for active turns.
3. **Alternate Candidate Draws ("Swipes")**: Implement uncommitted alternative generations for narrative variety without corrupting engine state.
