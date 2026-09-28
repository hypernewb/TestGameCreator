# story-framework

Local-first interactive fiction engine: deterministic world state + modules, with an LLM (usually a small local model) only interpreting input and narrating. Node 24 ESM, `node:sqlite`, Electron desktop shell, no build step, almost no dependencies.

## Commands
- `npm test` — `node --test tests/*.test.mjs` (~156 tests, must stay green)
- `npm run validate` — pack/schema validation
- `npm run playtest -- --size minimal --filler 12` — live run against LM Studio; prints one line per turn (context used/budget, cuts, over-budget, recall ok/NO, echo) plus a summary. Add `--verbose` for reply text. Uses a throwaway temp DB.
- `npm start` (server.mjs on localhost), `npm run desktop` (Electron), `npm run build:st` (SillyTavern bundle)
- Local model: LM Studio at `http://localhost:1234/v1`, model `qwen3.5-text-9b-nsfw-rp-roleplay-i1` (4k-window target on the `minimal` preset).

## Code style
- Dense one-liner style: short names, chained expressions, few comments. Match surrounding code; don't reformat files.
- Pure functions over state; modules never mutate state outside `execute`.
- New behaviour needs a test in `tests/`. Keep prompts small: every token added to context must justify itself on the `minimal` preset.
- Module freeze: no new modules until the F1 vertical slice passes the fun gate (`docs/NEXT-MILESTONES.md`). Fun-tier work (F1–F12) comes before P1–P4.

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
