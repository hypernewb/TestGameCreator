# AGENTS.md — rules for every AI worker (Codex, OpenCode/GLM, Cline, Cursor, Claude)

You are a worker on story-framework: a local-first adult dating-sim engine (Node 24 ESM, `node:sqlite`, no build step). Deterministic engine + modules; the LLM only interprets input and narrates.

## Current product priority (owner 2026-10-04; supersedes 2026-10-03)
Build the reusable creator/editor capable of authoring essentially the whole kind of social/romance experience Venus University offers: character setup, rules, events and player-facing screens. Functional no-code authoring is the goal, not polish alone; code is optional for extensions. Follow [current direction and holds](docs/NEXT-MILESTONES.md#current-direction-owner-clarification-2026-10-04), [assessment](docs/research/creator-gap-assessment-2026-10-04.md) and [active guidance](docs/briefs/BOARD.md#current-priority-2026-10-04) over older execution order. T-098 completes the authorized assessment; proposals are not dispatch authority. Template default plus explicit blank, editable prompt/card startup (1–8 NPCs and locations), creator-owned stages/unlocks/boundaries/events and inspectable/correctable memory are confirmed. A tiny sample proves the creator loop, not a full game. Game UI redesign and editor chrome redesign remain paused. Weekly specific-over-general rules take priority; Stage2 remains frozen/unmerged pending independent review/full checks. Adventure, installer, full migration and calendar-picked dates stay later/deferred. Historical READY tickets do not authorize dispatch.

## Start of every task
1. Read your role card: `docs/roles/<role>.md`.
2. Read your ticket: `docs/briefs/T-NNN.md`. Open ONLY the files it lists. Don't explore the repo.
3. Do the ticket. Nothing outside its scope: put extra findings in the report's "Noticed" line.

## Hard rules
- NEVER open or write `data/ai-settings.json`. Experiments use `:memory:` or a temp-dir DB.
- Never `git add -A` / `git add .`. Stage only files you changed. Don't revert others' changes. Commit only if the ticket says so.
- New behaviour needs a test in `tests/`. Never delete or weaken an existing assertion to make tests pass. Report it instead.
- Code style: dense one-liners, short names, few comments. Match the surrounding code; don't reformat files.
- Tests: `node --test tests/<file>.test.mjs` while iterating; `npm test 2>&1 | tail -8` once at the end.
- Keep output short: summary lines, not logs.

## End of every task: write `docs/briefs/T-NNN.report.md`
```
Status: done | blocked | partial
Files: <changed files>
Tests: <npm test summary line, e.g. "pass 812 fail 0">
Acceptance: <the ticket's acceptance check: result>
Deviations: <none | what differs from the brief and why>
Noticed: <out-of-scope issues, one line each>
Questions: <none | for the director>
```
Questions for the owner (design calls you can't make) go on the `Questions:` line as multiple choice: `Q: <question>? A) <recommended> B) … C) …`. Never guess on actions, consent or character content.
