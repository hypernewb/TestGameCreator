Status: done (two record types end to end; remaining types inventoried as read-only follow-up)
Files: packages/ai/memory.mjs (impressionId, sceneMemoryId, memoryEditIndex, effectiveImpressions, effectiveSceneMemories, sceneMemoryLines); packages/ai/context.mjs (ledger loop, recentActions/outcomes memory lines and memories use the effective views); packages/ai/inspect.mjs (scene memories use the effective view); packages/core/character-progress.mjs (effective scene memories/impressions); packages/ai/memory-controls.mjs (correctableMemories, validateMemoryEdits, snapshot `records`, impression/scene-memory branch in applyMemoryEdit, preview `memories`, limits text, MECHANICAL regex repair); packages/persistence/store.mjs (validateImport validates and carries `memoryEdits`); public/creator-memory.mjs (new records section, metadata line, original source, next-turn memory preview rows); tests/creator-memory-expansion.test.mjs (new, 7 tests); docs/briefs/T-memory-correction-expansion.report.md. .claude/launch.json got a temporary `iso-mem` entry for the walkthrough and is back to its committed content (`git diff` empty).
Tests: focused only, per the brief; full `npm test` was not run. New file + creator-memory-controls: pass 15 fail 0. Earlier focused set (new file, creator-memory-controls, context-inspector*, studio-knowledge, *memory*, character-progress*): pass 54 fail 0. Adjacent set (context-budget, prompt-slim, scene-*, plus ledger/import/knowledge/roundtrip matches): pass 172 fail 0. No existing assertion was changed or removed.
Acceptance:
- Inventory:
  - Authored truth (project.facts, lorebook): read-only here; edited in the project forms.
  - Generated facts and player statements/disclosures: already editable; unchanged and still pass their tests.
  - Runtime memories:
    - NPC impressions (turn.ledger liked/disliked rows): selected.
    - Scene memories (story.scenes.memories): selected.
    - Act memories: read-only.
    - NPC friendship memories: read-only.
    - Rumors/feed: read-only.
  - Beliefs: impressions and scene memories are treated as NPC beliefs.
  - Relationship secrets (social.secrecy): read-only.
  - Promises/questions (statement kinds), plans (story.scenes.plans): read-only.
  - Summaries/history/dialogue: never rewritten.
- Selected types and semantics:
  - Each record shows the following metadata:
    - subject;
    - source (turn id + AI scene ledger, or scripted scene id + memory effect; "scene id not recorded" when absent);
    - knowers ([player, owner], or the stored knownBy);
    - status;
    - recorded time (tick; otherwise "time unavailable (not stored)", never guessed);
    - last edit time;
    - scope "this campaign only".
  - Correct changes only the wording. Kind, owner and knowers are locked. Text is 8–240 chars with no game-state claims.
  - Retire removes one record from the effective view. It is not a ban, and the NPC can form the belief again later.
  - Edits are an append-only overlay journal `memoryEdits` (last edit wins; restore = correcting back to the original). Turns, events, modules and dialogue are never mutated. Promises are not fulfilled, plans not advanced, actions not reversed.
  - Each edited record carries `original` + `edited:true`, and the UI shows "Original source".
- A belief is not world truth: corrections never enter facts. Precedence is unchanged (newer disclosures keep slot precedence).
- Derived data is invalidated by recomputation. Context ledger/memories/recentActions/outcomes, inspect and character-progress all read the effective views, so superseded text never appears as current.
- Stale edits: the snapshot token includes `memoryEdits` (only when non-empty, so existing tokens and fixtures are unchanged). The server rejects a mismatched token with 400 "Memory changed; reload campaign" and leaves the data unchanged.
- Invalid edits leave data unchanged and return useful errors:
  - text too short, too long or mechanical;
  - unknown record;
  - kind mismatch;
  - extra fields;
  - retire with text;
  - repeated no-op edit.
- Persistence: survives Store reopen and is validated on import (a tampered `memoryEdits` is rejected). Another campaign on the same pack is unaffected.
- The HTTP API requires the creator capability token.
- Privacy: Brin's context never contains Ada's impressions or scene memories, and vice versa. Conflicting impressions about the player from Ada and Brin coexist.
- Mocked next-turn context test: after the correction, `contextFor(ada)` contains the corrected impression and not the original; after the retire, the red-archive memory is absent from memories and recentActions. No real model calls; mock provider only.
- Browser walkthrough (temp-dir DB, mock AI, http://localhost:3023/studio.html, campaign `memory-walkthrough`):
  - The records section rendered subject, tick, knowers and "last edit: none".
  - Saved a correction to Ada's impression. It showed "impression · correct", the new text, "last edit: 2026-10-05T01:48:42.745Z", "Original source: the player is careful with the old ledgers" and status "Memory saved. Game state and original history retained."
  - Retired Ada's red-archive scene memory ("scene memory · retire").
  - The remembered-context preview for Ada showed "Ada liked: Ada thinks the player rushes through the old ledgers — next-turn memory (ledger:hello)" and no red archive.
  - The preview for Brin showed only "Brin disliked: the player is careless with workshop tools — next-turn memory (ledger:tools)".
  - After reload the UI said "Choose a campaign first" (honest empty state). No console errors.
  - Screenshot failed because the pane was hidden, so the evidence is page text/DOM.
- Storage/UI correctness vs believability: everything above is storage/UI/context correctness, verified by tests and the DOM. Whether corrected beliefs make NPCs more believable in play is not measured. It needs a live playtest on the owner's model, which was out of scope (no real model calls).
Deviations: none from scope. The UI shows tick as the recorded time because no wall-clock time is stored for these records. Scene memories without a stored scene id say so instead of inferring one.
Noticed:
- `MECHANICAL` in memory-controls.mjs held literal backspace (0x08) bytes instead of `\b`, so the game-state-claim check never fired for these records. It is fixed to a real `\b` word boundary. validateStatementEdits has its own inline copy of the regex that was not affected. A byte scan finds no other 0x08 bytes in packages/ or public/ .mjs files.
- Studio has two "Context owner" selects (context inspector and memory panel). They are easy to confuse in automation; distinct labels would help.
Questions:
- Q: Next record type to make correctable? A) act memories (same overlay pattern, lowest risk) B) relationship secrets' knowers (privacy-sensitive, needs an audience-edit design) C) plans/promises status (needs rules that never auto-fulfil)
