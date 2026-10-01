# RisuAI: character depth steal list
Local snapshot analysis for T-020; source mechanics below are observed, adoption sketches are proposals. Our matches are documentation claims, not a fresh implementation audit. Normal turns retain exactly one model call; replay uses recorded state.

## Core loop (8 lines)
1. Select the character/chat and tokenizer; create named prompt blocks (`.risuai/src/ts/process/index.svelte.ts`, `sendChat`).
2. Parse system/author notes and card description, personality and scenario through CBS.
3. Merge character, chat and module lore; scan recent messages, optionally recurse over activated lore, then apply its token budget (`.risuai/src/ts/process/lorebook.svelte.ts`, `loadLoreBookV3Prompt`).
4. Place lore around description/history; add the selected player persona and role-labelled dialogue examples (`.risuai/src/ts/process/exampleMessages.ts`).
5. Run start triggers; apply `editprocess` scripts to history and parse substitutions (`.risuai/src/ts/process/triggers.ts`, `.risuai/src/ts/process/scripts.ts`).
6. Reserve response tokens plus 50; invoke the selected memory system when enabled, otherwise trim oldest history. Memory may make additional requests.
7. Order blocks with the prompt template, run request edits, recount tokens and remove eligible history; send the generation request.
8. Apply output scripts/triggers and save the reply; triggers, group replies and auto-continuation can generate again. Those are outside our normal-turn contract.

## Steal list — ranked by expected campus fun per effort
Each item states source → existing match → concrete extension; every adoption adds **0 normal-turn model calls**.

1. **Preserve voice demonstrations separately from biography** — fun high / effort low.
   Mechanic: card v2/v3 separate `description`, `personality`, `scenario`, `mes_example`, `first_mes`, `alternate_greetings`, `creator_notes`, `system_prompt`, `post_history_instructions`, `character_book` (`.risuai/src/ts/characterCards.ts`, `exportCharacterCard`); examples split at `<START>` and become user/assistant messages (`.risuai/src/ts/process/exampleMessages.ts`, `exampleMessage`).
   Matches card [character-sheet](../design/character-sheet.md): existing `examples`, `style`, `voice`, and the decided full sheet. Extend `buildPrompt` ([AI map](../map/ai.md)) to retain role-labelled examples as a separately budgeted voice block; keep creator notes out of dialogue and review imported instruction fields before mapping them.

2. **Topic-triggered, bounded character lore** — fun high / effort medium.
   Mechanic: comma-separated primary keys use OR; selective secondary keys add a required second match. `scanDepth`, `alwaysActive`, exclusion keys and per-entry whole/partial-word matching control activation; recursive scanning defaults true. Entries are admitted by descending priority under `tokenBudget`, then ordered separately (`.risuai/src/ts/process/lorebook.svelte.ts`, `searchMatch`/`loadLoreBookV3Prompt`).
   Match: `buildPrompt`/budgeting ([AI map](../map/ai.md)); no authored trigger schema documented. Extend their optional-lore block with creator-authored topic facts, state eligibility, stable IDs and a bounded scan window; log match/drop reasons for creators. Facts enrich replies without keyword matches unlocking actions or disclosing journal entries.

3. **State-selected voice and callback snippets** — fun high / effort low–medium.
   Mechanic: CBS `#if` renders only when its evaluated condition is `true` or `1`; `#when` supports conditional branches and `#each` iterates. Parser `runVar` defaults false (`.risuai/src/ts/parser/parser.svelte.ts`, `blockStartMatcher`/`risuChatParser`); character/persona substitutions live in `.risuai/src/ts/cbs.ts`.
   Matches card [stages](../design/stages.md): existing phase/graph gates; card [character-sheet](../design/character-sheet.md): behavioral rules/voice. Extend `context.mjs` ([AI map](../map/ai.md)) with read-only predicates selecting authored voice snippets from committed phase, known facts and breakup history; current engine verdicts remain authoritative.

4. **Summaries with provenance and durable importance** — fun high / effort medium.
   Mechanic: HypaV3 summaries store `text`, a set of source `chatMemos`, `isImportant`, optional `categoryId` and `tags`; serialization preserves source IDs, and orphan cleanup handles removed chats. Compression starts above context capacity, targets `maxContextTokens × (1 − extraSummarizationRatio)`, and batches up to `maxChatsPerSummary` (`.risuai/src/ts/process/memory/hypav3.ts`).
   Match: third-person memories ([AI map](../map/ai.md)); retained breakup history matches card [stages](../design/stages.md). Extend `memory.mjs` records with scene/event IDs and importance; augment the existing end-of-scene bookkeeping pass with one concise summary, at most once per completed scene. **Extra calls: 0**; no turn-time compression/repair pass, and deterministic event memories remain usable if bookkeeping fails.

5. **Reserve memory space for both recent and relevant callbacks** — fun medium–high / effort medium.
   Mechanic: HypaV3 admits important summaries first, then splits remaining tokens by `recentMemoryRatio` and `similarMemoryRatio` (sum ≤1); the remainder is random. Query weights increase with recency as `(i+1)/(n(n+1)/2)`, divided across paragraph queries; selected summaries are excluded from subsequent buckets (`.risuai/src/ts/process/memory/hypav3.ts`, memory selection).
   Match: relevance-first `retrieveMemories` ([AI map](../map/ai.md)). Extend retrieval with important → recent → topic-relevant buckets, stable ID deduplication and chronological presentation; use deterministic tags/keywords and recency weights, with no random remainder or embedding requests. Budget split awaits owner choice.

6. **Recount the fully assembled prompt** — fun medium / effort low–medium.
   Mechanic: Risu reserves `maxResponse + 50`, tokenizes parsed lore, then recounts after request edits; final overflow removes `removable` messages and errors if protected content cannot fit (`.risuai/src/ts/process/index.svelte.ts`, token calculation/rechecking; `.risuai/src/ts/process/lorebook.svelte.ts`, admission).
   Match: LOD/size presets and `budgetContext` ([AI map](../map/ai.md)). Extend `context-budget.mjs` with a final count after snippet expansion: protect current input, engine verdict and core identity; shrink optional lore/examples/old history first. Use local counting and a reserved reply budget, avoiding remote tokenizer calls; surface overflow before generation.

7. **Explicit player identity in its own prompt block** — fun medium / effort low.
   Mechanic: persona records contain `name`, `icon`, `personaPrompt`, `note`, `id`; switching saves the old persona by default and loads the chosen identity. `personaPrompt` is a distinct template block (`.risuai/src/ts/persona.ts`, `changeUserPersona`; `.risuai/src/ts/process/index.svelte.ts`, persona assembly).
   Match: prompt assembly ([AI map](../map/ai.md)); none for persona persistence in permitted docs. Extend `context.mjs` with player-authored identity/appearance notes keyed to the campaign, so NPC narration uses declared facts; keep stats, possessions, agreements and consent in engine state. Editing/switch timing awaits owner choice.

8. **Small declarative hooks, with regex confined to presentation** — fun medium / effort medium–high.
   Mechanic: triggers have start/input/output/manual/display/request phases, variable comparisons (`=`, `!=`, `<`, `>=`, etc.), chat-index conditions and strict/loose/regex existence checks over `depth` messages; effects can inject at start/historyend/promptend (`.risuai/src/ts/process/triggers.ts`). Regex has separate editinput/editprocess/editoutput/editdisplay modes (`.risuai/src/ts/process/scripts.ts`).
   Match: action/trigger modules ([module map](../map/modules.md)), existing stage gates in card [stages](../design/stages.md). Extend `scenes.mjs` with event/state predicates selecting once-per-event authored prompt cues; allow display-only text cleanup after validated output. Neither regex nor arbitrary scripts write relationship values, player actions or permissions; use recorded event IDs for replay.

## Anti-list
- No HypaV3 turn-time summarization or embedding queries: they add requests and failure points; borrow provenance/budgets with item 4's once-per-scene timing.
- No arbitrary Lua/Python/CBS mutation or nested `runLLM`/`sendAIprompt` effects (`.risuai/src/ts/process/triggers.ts`, `.risuai/src/ts/process/scriptings.ts`): bypasses engine ownership and the request limit.
- No raw card instruction overrides or lore `disable_ui_prompt` (`.risuai/src/ts/characterCards.ts`, `.risuai/src/ts/process/lorebook.svelte.ts`): imported flavor must not suppress authoritative state/verdicts.
- No unseeded probability lore or random memory leftovers (`.risuai/src/ts/process/lorebook.svelte.ts`, `.risuai/src/ts/process/memory/hypav3.ts`): callbacks should be reproducible and relevant.
- No per-speaker group generation or auto-continue loops (`.risuai/src/ts/process/index.svelte.ts`): the campus focus-NPC scene and one normal-turn request already define the interaction.

## Owner decisions still needed
See `docs/briefs/T-020.report.md`, Questions: lore window/recursion, memory allocation, and player identity editing. These are proposed choices, not source defaults or replacements for decided cards.
