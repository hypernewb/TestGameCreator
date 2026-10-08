# GC7.1 continuity source map (2026-10-08)

Scope: every source that can reach the scene prompt, where it is produced, where it is rendered, what drops it, and which test pins it. Product code was read only. Test file: `tests/continuity-source-map.test.mjs` (12 tests, all green).

Pipeline, as read: `contextFor` (packages/ai/context.mjs 76-139) gathers candidates. `prepareSceneRequest` (packages/ai/service.mjs 126-168) builds `sceneHistory`, `openThreads`, suspicion and direction lines, then `budgetSceneContext` (packages/ai/context-budget.mjs 115-171) allocates pools. `scenePromptMessages` (vendor/venus/scenePrompt.mjs) renders. The renderer gate `rel()` (scenePrompt.mjs 118-119) admits a record when it names the cast or player, or shares 2+ 3-character words with the player action or scene history. It applies to REMEMBERED, KNOWN, BEFORE THIS, LOOSE ENDS and WORD AROUND. LORE is unfiltered.

Evidence labels: **tested** = the test asserts the rendered prompt or context. **pinned gap** = the test asserts current behaviour that is a gap, so a fix flips the assertion. **static** = read from code only; no test yet.

## Source table

| # | Source | Origin | Prompt location | Drop condition | Test | Status |
|---|---|---|---|---|---|---|
| S1 | Authored facts, public and naming cast | story.facts; context.mjs contextFor | KNOWN | knownBy not public or not cast-visible; renderer `rel()` gate | authored facts | tested |
| S2 | Authored fact kept by allocator, names no cast, shares <2 query words | story.facts; context-budget.mjs keeps it | none (dropped by renderer) | `rel()` gate in scenePrompt.mjs 118-119 | GAP authored fact auth-cellar | pinned gap G2 |
| S3 | Generated facts (subject-known) | turn.generatedFacts; context.mjs 92 | KNOWN | knownBy excludes player/subject; `rel()` | generated facts | tested |
| S4 | Lorebook entries, public | pack.lorebook; selectLore context.mjs 40-74 | LORE | knownBy private to another character; BM25 selection | lore | tested |
| S5 | Player disclosures (statements, `classifyUtterance`) | memory.mjs 22-45, capturedStatements 99-119 | REMEMBERED | playerStatements 120-134 keeps lasting disclosures; `rel()` | disclosures and promises | tested |
| S6 | Promises | memory.mjs; service.mjs openThreads (last 4 promise memories) | LOOSE ENDS | openThreads cap of 4; budget KIND promise 9 | disclosures and promises | tested |
| S7 | Plans (story.scenes.plans) | service.mjs openThreads (kind plan) | LOOSE ENDS | status, deadline, visibility | plans | tested |
| S8 | Scene memories, public | story.scenes.memories | REMEMBERED | knownBy private to others; `rel()` | scene memories | tested |
| S9 | Impressions (turn.ledger) | context.mjs 88-90 `effectiveImpressions` filtered to ones naming the player; newest 8 complete turns | prompt impressions | impression not naming player (intentional) | impressions | tested |
| S10 | Scene transcript | context-budget.mjs sceneTranscript 41-73; returns [] on core.sceneStarted, core.moved, world.daypartStarted, world.hangoutStarted | SCENE SO FAR | scene-start event on probe or prior turn; sceneId mismatch | scene transcript | tested |
| S11 | Corrections overlay | memory-controls.mjs 10-37; applyMemoryEdit; read-time effectiveSceneMemories, playerStatements | REMEMBERED (replaced or retired) | correct replaces text; retire removes; statement id is `heard:<source>` for social.conversation and `turn:<id>` for scene turns | corrections | tested |
| S12 | recentActions (recent events, `slice(-10)`) | context.mjs 120-122 | none | no consumer in renderer, budget or service | GAP recentActions | pinned gap G1 |
| S13 | Player block (context.player, player.description) | actor record | none | not rendered in scene prompt | GAP player block | pinned gap G3 |
| S14 | Secrecy suspicion and confrontation lines | service.mjs 139 (suspicionLinesFor, confrontationFor) | suspicion lines | not tested; secrecy edges themselves not rendered as facts | none | static, G4 |
| S15 | Dialogue (last 6 completed social.spoke turns) | context.mjs 138 | none | computed, no consumer; overlaps SCENE SO FAR in-scene | none | static, G5 |
| S16 | Dormant knowledge classes: romanceTempo, romanceNetwork, touchLadder, unlockedEndings, relationshipProgression, anniversary, socialFeed, npcFriendshipMemories, characterGoals (only goalPrompt renders), phone (daypart only) | packages/ai/knowledge.mjs PROMPT_CLASSES | not in scenePrompt, service or context-budget | absent from renderer and allocator pools | none | static, G6 |

Totals: 16 sources. 10 tested as live behaviour (S1, S3-S11). 3 pinned gaps with tests (S2, S12, S13). 3 static with no test (S14, S15, S16).

## Gap list

- **G1 recentActions** (S12). Computed at context.mjs 120-122, never rendered. Pinned by the GAP recentActions test. Fix: render or drop the field.
- **G2 allocator-retained authored fact dropped by renderer** (S2). The budget keeps `auth-cellar` but `rel()` drops it because it names no cast or player and shares <2 query words. Pinned. Judgement: this may be intended for off-topic facts; confirm.
- **G3 player block not rendered** (S13). `context.player.description` is in the request context but absent from the scene prompt. Pinned. Judgement needed: second-person narration may be intentional.
- **G4 secrecy edges not rendered as facts** (S14). Only suspicion and confrontation lines reach the prompt. Static evidence only, no test.
- **G5 dialogue computed with no consumer** (S15). Static evidence only. Overlaps SCENE SO FAR for in-scene turns, so the gap may be cross-scene only.
- **G6 dormant knowledge classes** (S16). Nine classes in knowledge.mjs PROMPT_CLASSES never reach scenePrompt, service or the budget. Static evidence only, needs confirmation with a fixture per class.

Gap count: 6 (G1-G6). Three are pinned by tests; three are static.

## Evidence limits

- Line numbers are from reads at the time of writing; they may drift.
- G4-G6 are static. A fixture per row would confirm or refute each.
- Intended filter: impressions not naming the player are dropped (context.mjs 90 comment). Tested as intentional.
- Not verified here: GC7.4 summary and repetition (out of scope).
- No live model calls and no browser suites were run.
