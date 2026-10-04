# story-framework

Local-first interactive fiction engine: deterministic world state + modules, with an LLM only interpreting input and narrating. Play targets a cloud model (e.g. Gemini free tier); tests run on a local model. Node 24 ESM, `node:sqlite`, Electron desktop shell, no build step, almost no dependencies.

## Current product priority (owner 2026-10-04; supersedes 2026-10-03)
The reusable creator/editor must author essentially the whole kind of social/romance experience Venus University offers: character setup, rules, events and player screens. All core systems are visually configurable; code is optional for extensions. Offer the social/romance template by default and explicit blank projects; retain editable prompt/card startup for 1–8 NPCs (player excluded) and 1–8 locations. Creators own stages, unlocks, boundaries and authored events; AI improvises within validated rules. Automatic memory plus inspect/correct and optional facts/secrets/knowers/promises are required. Venus code/recorded behavior informs capability, without copied identity/assets or assumed mechanic parity.

Follow [current roadmap and holds](docs/NEXT-MILESTONES.md#current-direction-owner-clarification-2026-10-04), [T-098 assessment](docs/research/creator-gap-assessment-2026-10-04.md) and [active guidance](docs/briefs/BOARD.md#current-priority-2026-10-04). Assessment is completed with explicit evidence limits; proposals do not authorize implementation. Creator UI = editor; Game UI = player presentation; UI Wizard edits reusable Game UI. A tiny sample proves author/play/debug/revise/save/reopen without code edits, not a full game. Game UI visual redesign/editor chrome redesign remain paused. Weekly specific-over-general rules take priority; Stage2 remains frozen/unmerged pending independent review/full checks. Installer, full migration and calendar-picked dates remain deferred. Adventure is later: narrative engine-resolved combat before structured turn-based; no RPG completion gates.

## Commands
- `npm test` — `node --test tests/*.test.mjs` (~700 tests, ~7s, must stay green)
- `npm run validate` — pack/schema validation
- `npm run playtest -- --size minimal --filler 12` — live run against LM Studio; prints one line per turn (context used/budget, cuts, over-budget, recall ok/NO, echo) plus a summary. Add `--verbose` for reply text. Uses a throwaway temp DB.
- `npm start` (server.mjs on localhost), `npm run desktop` (Electron), `npm run build:st` (SillyTavern bundle)
- Test model: LM Studio at `http://localhost:1234/v1`, model `qwen/qwen3.8-27b` (the playtest default). The 9b model is no longer the target. The owner plays on a cloud model.

## Code style
- Dense one-liner style: short names, chained expressions, few comments. Match surrounding code; don't reformat files.
- Pure functions over state; modules never mutate state outside `execute`.
- New behaviour needs a test in `tests/`. Fun first, optimise later (owner call 2026-09-30): don't cut features for context size or call count until the fun gate passes, but keep one model call per normal turn and don't pad prompts.
- New modules are allowed, but each must earn its keep on the fun gate (`docs/NEXT-MILESTONES.md`). Current order: creator planning under the current-priority section above; older M5/Open-play ordering is historical. Design is in `docs/GAME-DESIGN.md`; shipped work is in `docs/COMPLETED-MILESTONES.md`. P1–P4 come after. The `after-hours` pack is retired and on a delete list: its tests now use isolated copies in `tests/fixtures/`, so don't extend it and don't point new tests at it.

## Safety rules
- Creating/writing campaigns in the real `data/campaigns.sqlite` is allowed (the user has authorized this). Bulk-destructive ops on it (deleting/wiping campaigns, dropping tables) still need to go through a reviewable script and a heads-up in chat, not an ad hoc inline command.
- NEVER open or write `data/ai-settings.json` (the user's real AI connection settings). Scripts and experiments use `:memory:` or a temp-dir DB (`createApp({dataPath})` puts ai-settings.json next to that DB).
- Other Claude sessions may be editing this repo at the same time. Before committing, check `git status`/`git diff`. Only stage files you changed yourself (`git add <paths>`, never `-A`), and don't revert changes you didn't make.
- Commit only when asked.

## Session habits (token hygiene)
- Use one session per task. After a task lands, start fresh instead of carrying a long transcript.
- While iterating, run only the test files you touched (`node --test tests/x.test.mjs`); run the full `npm test` once before reporting a task done or committing.
- Prefer summary outputs: `npm test 2>&1 | tail -15`, `npm run playtest` (not raw logs), `git diff --stat` before a full diff.
- Run a live playtest only when prompt/context/memory code changed. Otherwise the mock-provider tests are enough.
- Run the playtest in the background and read its summary line first.
- For repo layout, doc index, and large-file sizes, see `docs/AGENTS-REFERENCE.md` (read on demand, not loaded by default).
- Creator rule (owner 2026-10-02): every feature must be a pack option/Studio control that works on a non-campus pack, not hardcoded campus ids/strings. T-076 adds a guard test; a feature isn't done until it passes.
