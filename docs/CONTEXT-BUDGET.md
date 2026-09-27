# Context budget

Every scene turn's prompt is fitted to the connected model's context window by one deterministic allocator,
instead of per-pool count caps. Code: `packages/ai/budget.mjs` (generic) and `packages/ai/context-budget.mjs`
(story pools). Tests: `tests/context-budget.test.mjs`.

## Flow per turn

1. `contextFor(..., {wide:true})` gathers every candidate (lore and facts are no longer pre-capped at 1200/650 chars).
2. `sceneTranscript` returns the whole current scene (up to 120 turns), each turn with an engine digest.
   `closedScenes` returns every closed scene involving the cast, with its model summary and an event digest.
3. `budgetSceneContext` renders the prompt with all pools empty to measure the fixed part (rules, current state,
   committed outcomes, player action). This is tier 0 and is never trimmed.
   Pool budget = `window × 0.94 − reply tokens − fixed part`.
4. `allocate` fills the pools, and the turn stores the result as `turn.contextReport`.

## Tiers

| Tier | Pool | Floor | Ceiling | Detail levels |
|---|---|---|---|---|
| 1 | cast profiles | 15% | 35% | full → compact → name (never dropped) |
| 2 | active scene transcript | 25% | 55% | full → last 700 chars → digest |
| 3 | generated facts, authored facts, memories | 8% | 25% | full → 140-char memory |
| 4 | lore | 6% | 20% | full → 220 chars |
| 5 | closed-scene recaps (rolled up by calendar) | 5% | 20% | summaries + digest → clipped summaries → digest |
| 6 | NPC-pair relationships | 0 | 8% (hard) | full |

The allocator runs in four passes:

1. Each tier's floor is covered at the cheapest detail level.
2. The same is repeated up to each tier's ceiling.
3. Items are upgraded, highest rank first, up to the ceiling.
4. Budget other tiers left unspent is shared out, except to tier 6.

"Breadth before depth" means an old turn keeps a 20-token digest instead of disappearing. The transcript is
*monotone*: detail never increases going back in time, and a cut item cuts everything older than it. So the
verbatim part is always a contiguous recent tail.

## Digests are engine-authored

`turnDigest` and `sceneDigest` are rendered from committed events (item transfers, bond/money changes, flags,
quests), not from model prose. The model's rolling `summary` is still sent as flavor, but the record of what
happened can't drift.

## Recap roll-ups

`recapGroups` groups closed scenes by the calendar: today's scenes stay individual, earlier days of this week merge into
one `day:N` entry, and earlier weeks into one `week:N` entry. A merged entry carries every summary plus a de-duplicated
event digest, so nothing is lost while the budget allows, and a whole week shrinks to one digest line when it doesn't.
A semester of play costs a handful of entries instead of one per scene. The grouping is derived at read time, so saves need
no migration.

## Ranking

- **BM25** (`packages/ai/retrieval.mjs`, no dependencies): lore is scored against the player's words by term specificity.
  An entry can be selected by its text even when no tag matched (reason `text: …`), but a tag hit (10 per tag) always
  outranks a text match (at most 9). Chinese, Japanese and Korean text is split into character pairs, since it has no spaces.

- **Stickiness:** a fact or matched lore entry that was included on the previous turn gets +4 rank, so entries at
  the boundary don't flicker in and out. That keeps the model consistent and the prompt prefix cacheable.
- **Freshness:** location/world lore and NPC tidbits that nobody asked about lose rank if they surfaced recently
  (−6/age over the last 8 turns). Ambient color rotates instead of repeating, which targets "same-iness".
- Lore is emitted in id order, not score order, so identical selections produce identical prompt text.

## Window and token estimate

- The token estimate is `chars/4` for Latin text and 1 per CJK/kana/hangul character. There is no tokenizer
  dependency.
- `CompatibleProvider` corrects it with a moving average of `usage.prompt_tokens / estimate` (`provider.calibration`).
  Streamed requests ask for `stream_options.include_usage`, so the large scene prompt is calibrated too.
- The reply reserve is `max_tokens` (1800) or a fifth of the window, whichever is smaller (at least 512), until five
  replies have been seen. After that it is 1.5× the longest of the last 30 replies, with a minimum of 512 (`replyReserve`).
  On a 4K window the first turns reserve about 820 instead of 1800.
- Each request's `max_tokens` is capped to what the window leaves after the prompt, with a minimum of 256
  (`CompatibleProvider.outputCap`). Ollama and LM Studio drop the start of a prompt when prompt + `max_tokens`
  overflows the window. That start holds the system rules and cast.
- `detectContextWindow` probes, in order: llama.cpp `/props`, LM Studio `/api/v0/models/{id}`, Ollama `/api/show`,
  then `/v1/models` metadata.
  - Ollama's OpenAI route uses `num_ctx`, not the model's maximum, and drops the *start* of an over-long prompt. Without an explicit
    `num_ctx` it is budgeted at 4096.
  - LM Studio loads models just in time. An unloaded model reports only its trained maximum, so detection returns nothing until
    the first reply has loaded it. After that the provider re-detects, up to three times.
  - `STORY_CONTEXT_WINDOW` overrides detection.
  - The default when nothing is known is 8192.
- `GET /api/ai/config` reports `contextWindow`, `contextSource` and `tokenRatio`.

## Context size setting

AI settings → **Context size** picks how much of the window each turn may use. It is saved in `ai-settings.json`,
kept when you switch models, and applies from the next turn (`POST /api/ai/context-size {size}`).

| Preset | Window used | Trade-off |
|---|---|---|
| Minimal | up to 4096 | Fastest local replies; 6 turns word for word, older ones as digests |
| Default | up to 16384 | Balanced; 16 turns word for word |
| Maximum | the model's full detected window | Most verbatim history; slowest on local hardware |

The window used is `min(preset cap, detected window)`, via `effectiveWindow` in `local-settings.mjs`. With no detected window it
is 8192 for every preset, because going past a window the server doesn't report risks silent truncation.
`STORY_CONTEXT_WINDOW` replaces the detected window, and the preset still caps it.

## Memory on a small model

Tested on a 4K window with a 9B role-play model (LM Studio). Recall of six facts planted 20+ turns earlier went from 0/6 to 6/6.
The budget was never the problem: the facts were in the prompt, but in a form the model misread. Code: `packages/ai/memory.mjs`.

- **What the player said is rebuilt from turns at read time** (`playerStatements`). Before, only scene turns classified as `talk`
  were remembered, so every `continue` turn was forgotten. This needs no save migration.
- **Utterances are classified** (`classifyUtterance`): questions are dropped, and promises and self-disclosures are kept long-term
  (newest 40). Only the newest 4 plain statements are kept.
- **Memories are written in the third person** (`memoryText`): "the player told Brin: the player’s name is Mara". Quoted first person
  ("my favorite color is teal") was repeated back by the model as the character's own.
- **Relevant memories move next to the action.** A memory that shares a topic word with the player's action (ignoring names and
  words like ask or tell) is ranked higher, and it is rendered under `RELEVANT MEMORY` right after `PLAYER ACTION` instead of inside the
  CURRENT STATE JSON. It costs the same tokens in a place the model reads.
- **Model impressions must be about the player.** Ledger entries that never mention the player ("Brin likes his own habits") are
  dropped, and `{{user}}`/`{{char}}` placeholders are replaced.
- **The Minimal preset keeps 6 turns word for word, and Default keeps 16** (`verbatim`), even when more would fit. Older turns become
  digests. Given 25 full turns, the 9B model answered a question from six turns earlier.
- **Conversations stay one scene.** A line led by a speech verb ("Ask Brin what he does on rest days") continues the scene instead of
  being read as an action. Characters who are only talked about ("nervous about the meeting with Ada") are not summoned, and a
  failed summons does not restart the scene. Before this, the transcript was reset every few turns.
- **The prompt sends text, not bookkeeping.** Memories, facts and lore render as plain strings, without source UUIDs or ranking
  reasons, and empty fields are dropped. Absent characters share one rule (`absentView`) instead of one copy each.
  `promptView` is shared by the renderer and the cost estimate, so the budget measures what is actually sent.
- **Scene replies are repaired, not rejected** (`normalizeSceneLines`). Speaker names map to IDs, player or narrator speakers become
  narration, and lines by anyone outside the cast are dropped. A repair round resends the prompt with a short note instead of
  appending the rejected answer, which would overflow a tight window. If a reply still fails, the turn says so and offers a retry,
  instead of echoing the player's words as the story.

## Reasoning models

Thinking models such as Qwen 3.x spend `max_tokens` on hidden reasoning and return empty content. Every request sends
`reasoning_effort: "none"`, which LM Studio honors. A server that rejects the parameter (400/422 naming `reasoning`) gets
one retry without it, and the provider stops sending it.

## Reading a report

```
turn.contextReport = {v:1, window, reply, ratio, budget, base, poolBudget, used, overBudget,
                      included:[[key, level, cost]], cut:[[key, reason]]}
```

Keys are `cast:`, `history:`, `fact:`, `authored:`, `memory:`, `lore:`, `past:` and `npc:`.
`overBudget` means the fixed part plus name-only cast still exceeded the window. The model is too small for this
scene, and the prompt was sent anyway rather than dropping committed outcomes.

The play log shows it under each turn ("Context used/budget tokens", expandable to per-pool detail levels and cuts).
`contextReport` is debug data: exports and imports don't carry it, so stickiness restarts after an import.

## Not done yet

- An opt-in recall pass (the model picks topic IDs from a menu) or embeddings, for packs that outgrow BM25.
- Recaps across terms: a term level on top of week roll-ups once campaigns run that long.
