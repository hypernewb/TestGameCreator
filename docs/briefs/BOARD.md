# Ticket board
Every ticket lists `model:` (the AI that did the work) or `planned:` (before dispatch).

## Todo

### T-008 Per-heroine ladder + unwelcome-flirt reactions by personality
  - tags: [writer, opencode-longcat-free]
  - waits on: T-003 merge

### T-012 Relationship stages + repairable breakups
  - planned: gpt-6.1-sol (Codex)
  - tags: [implementer, codex]

## Doing

### T-009a Full character sheet: schema + creator tabs (Suggest = T-009b later)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex]

### T-010 Daily flirt cap + "she has to go" cue
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: allowlist + acts.mjs

### T-011 Day-planner mode (creator option: clock | planner)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: pin clock tests

## Review

## Done

### T-007 Stat chips + mood line on heroine panel
  - model: gpt-6.1-sol (Codex) · review: gemini-2.5-pro (OpenCode/Vertex)
  - tags: [implementer, codex]
  - merged 2026-10-01, npm test 805/805

### T-019 Heartmorrow analysis (steal list)
  - model: gpt-6.1-sol (Codex); 1st pass gemini-2.5-pro rejected
  - merged 2026-10-01

### T-020 RisuAI analysis (steal list)
  - model: gpt-6.1-sol (Codex); 1st pass gemini-2.5-pro rejected
  - tags: [researcher, codex] · redo after Gemini pass failed review
  - merged 2026-10-01

### T-021 Character-sheet fixed lists (owner approves)
  - model: gpt-6.1-sol (Codex)
  - tags: [analyzer, codex]
  - merged 2026-10-01 · owner picked 10 body regions (see owner-answers batch 9)

### T-013..T-018 Design cards: character-sheet, scene-feedback, flirt-cap, day-planner, stages
  - model: gpt-6.1-sol (Codex) · earlier drafts gemini-2.5-pro
  - merged 2026-10-01 · docs/design/

### T-001 Venus skill digest · T-003 Action ladder · T-004 rp-master analysis · T-005 Synthesis
  - model: gemini-2.5-pro (T-001, T-004), gemini-2.5-flash (T-005)
  - merged 2026-10-01, npm test 798/798

### T-002 Codebase map
  - tags: [doc-keeper, openrouter-gemini-flash]

### T-006 Weekly model scout
  - tags: [researcher, claude-haiku]
  - output: docs/research/models-weekly.md · owner reruns manually
