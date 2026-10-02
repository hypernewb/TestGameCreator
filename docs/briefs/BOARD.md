# Ticket board
Every ticket lists `model:` (the AI that did the work) or `planned:` (before dispatch).

## Todo

### Wave 5 (active; plan PLAN-WAVE-5.md)
  - T-043 Fun-gate measurement · planned: director (local)
  - T-044 First-run setup · T-045 Free-tier guard · planned: codex
  - T-046 Install check · planned: space-bunny
  - T-047 Owner picks on Wave 3 (voice mood, jealousy word, lust hints, anniversaries off) · planned: codex

### Wave 6 (active; plan PLAN-WAVE-6.md)
  - T-048 Decline invite · T-050 Likes clues · T-053 Routes never close · T-054 Endings · T-057 Time cost · T-058 Retire after-hours · planned: codex
  - T-049 Prompt slips 2 · T-051 Day recap · T-052 Director audit · T-055 M4 Studio forms · T-059 Messages polish · T-060 Docs catch-up · planned: space-bunny
  - T-056 M4 bot validation · planned: director (local)

### Parked
  - T-009b Suggest auto-fill · O1 · O3 · creator leftovers · Director-as-DM (owner: after C1 character depth)


## Doing

### codex: T-048 T-058 T-053 T-054 T-055 T-059 T-060 T-061 T-062 T-063 · opencode: T-049 T-051
  - model: codex · dispatched 2026-10-02 via scripts/wt.sh

## Review
  - T-044 First-run setup, T-047 Owner picks: clean (only the 4 known art failures), awaiting merge OK
  - T-048 Decline invite, T-058 Retire after-hours: partial, each waits on a scope question

## Done

### int-3: T-038 T-040 T-041 T-042 (every input lands, her own wants, prompt slips, messages panel)
  - model: gpt-6.1-sol (Codex: T-038) · space-bunny (OpenCode free: rest) · int-3 tests 1076 pass + 4 known worktree art failures; validate PASS · merged 2026-10-02, npm test 1080/1080

### int-2: T-008 T-036 T-035 T-028 T-030 T-031 T-032 T-034 (unwelcome flirt + ladder pace, player identity + lore, mixed actions, distinct voices, she texts first, lust baseline, anniversaries, jealousy)
  - model: gpt-6.1-sol (Codex: T-008) · nemotron-3-ultra / space-bunny (OpenCode free: rest) · merged together 2026-10-02, npm test 1042/1042
  - owner design questions (mixed-action time, mood voice, pre-dating texts, lust visibility, anniversary neglect, jealousy visibility) open; defaults kept

### T-037 Hard limit (no absolute never on trio)
  - model: gpt-6.1-sol (Codex) · tags: [implementer, codex] · O2 · merged 2026-10-01, npm test 941/941

### T-024 T-025 T-027 T-029 T-033 (body limits, hint refusals, trio body maps, daily need, gift repeats) + T-026 UI milestones
  - model: gpt-6.1-sol (Codex) · merged together as int-1 2026-10-01, npm test 935/935 after LF fix

### T-012 Relationship stages + repairable breakups
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: stage settings in save digest
  - merged 2026-10-01

### T-023 Save digest includes socialPacing / timeMode / sceneFeedback
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · found in T-010 review
  - merged 2026-10-01, npm test 868/868

### T-009a Full character sheet: schema + creator tabs (Suggest = T-009b later)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · rounds 2–3: reskin carries sheets, review fixes · round 4: trio trait picks
  - merged 2026-10-01

### T-022 Planner "wait until morning" ends the day
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · owner pick 2026-10-01
  - merged 2026-10-01, npm test 863/863

### T-011 Day-planner mode (creator option: clock | planner)
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: pin clock tests
  - merged 2026-10-01

### T-010 Daily flirt cap + "she has to go" cue
  - model: gpt-6.1-sol (Codex)
  - tags: [implementer, codex] · round 2: allowlist + acts.mjs · round 3: grace countdown, schedule-boundary departures
  - merged 2026-10-01, npm test 844/844

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
