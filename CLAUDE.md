# story-framework

Local-first interactive fiction engine: deterministic world state + modules, with an LLM only interpreting input and narrating. Play targets a cloud model (e.g. Gemini free tier); tests run on a local model. Node 24 ESM, `node:sqlite`, Electron desktop shell, no build step, almost no dependencies.

## Commands
- `npm test` — `node --test tests/*.test.mjs` (~156 tests, must stay green)
- `npm run validate` — pack/schema validation
- `npm run playtest -- --size minimal --filler 12` — live run against LM Studio; prints one line per turn (context used/budget, cuts, over-budget, recall ok/NO, echo) plus a summary. Add `--verbose` for reply text. Uses a throwaway temp DB.
- `npm start` (server.mjs on localhost), `npm run desktop` (Electron), `npm run build:st` (SillyTavern bundle)
- Test model: LM Studio at `http://localhost:1234/v1`, model `qwen/qwen3.8-27b` (the playtest default). The 9b model is no longer the target. The owner plays on a cloud model.

## Code style
- Dense one-liner style: short names, chained expressions, few comments. Match surrounding code; don't reformat files.
- Pure functions over state; modules never mutate state outside `execute`.
- New behaviour needs a test in `tests/`. Fun first, optimise later (owner call 2026-09-30): don't cut features for context size or call count until the fun gate passes, but keep one model call per normal turn and don't pad prompts.
- New modules are allowed, but each must earn its keep on the fun gate (`docs/NEXT-MILESTONES.md`). Current order: finish M5, then the Open-play tier (O1 free-typed firsts first). Design is in `docs/GAME-DESIGN.md`; shipped work is in `docs/COMPLETED-MILESTONES.md`. P1–P4 come after. The `after-hours` pack is retired: keep it only as a test fixture and don't extend it.

## Safety rules
- Creating/writing campaigns in the real `data/campaigns.sqlite` is allowed (the user has authorized this). Bulk-destructive ops on it (deleting/wiping campaigns, dropping tables) still need to go through a reviewable script and a heads-up in chat, not an ad hoc inline command.
- NEVER open or write `data/ai-settings.json` (the user's real AI connection settings). Scripts and experiments use `:memory:` or a temp-dir DB (`createApp({dataPath})` puts ai-settings.json next to that DB).
- Other Claude sessions may be editing this repo at the same time. Before committing, check `git status`/`git diff`. Only stage files you changed yourself (`git add <paths>`, never `-A`), and don't revert changes you didn't make.
- Commit only when asked.

## Session habits (token hygiene)
- Use one session per task. After a task lands, start fresh instead of carrying a long transcript.
- Prefer summary outputs: `npm test 2>&1 | tail -15`, `npm run playtest` (not raw logs), `git diff --stat` before a full diff.
- Run a live playtest only when prompt/context/memory code changed. Otherwise the mock-provider tests are enough.
- Run the playtest in the background and read its summary line first.
- For repo layout, doc index, and large-file sizes, see `docs/AGENTS-REFERENCE.md` (read on demand, not loaded by default).
