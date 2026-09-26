# Venus University source attribution

Upstream: https://github.com/venus-uni-dev/venus-university
Snapshot: `79301df55bc39a0996229ccc6f12ccce422a80b2`
License for the adapted code: AGPL-3.0-only (included in `LICENSE`).

- `scenePrompt.mjs`: adapts `soFarBlocks` from `src/renderer/prompts/scenePrompt.ts`. The surrounding builder follows its opening/continuation/solo separation and explicit reader action structure with framework-specific world data and prose instructions.

- `lorebook.mjs`: adapted `keyPattern` and `absentNote` from `src/renderer/prompts/lorebook.ts` and `escapeRegExp` from `src/shared/sentences.ts`. Removed TypeScript annotations; supplied per-game keys instead of its fixed setting lore; made the absent-character note gender neutral.
- `sceneActions.mjs`: adapted `parseAction`, `showAction`, `spriteAction` from `src/shared/sceneActions.ts`. Removed TypeScript annotations and the upstream emotion/CG dependencies; pose IDs are checked against the current game's uploaded images.
- `stageDisplay.mjs`: adapted `displaySlotsOf` from `src/renderer/stores/stageDisplay.ts`. Shows and hides actors in four stage cells. Wardrobe and CG systems remain outside this setting-neutral renderer.
- `sceneText.mjs`: adapted `splitSentences` from `src/shared/sentences.ts` and the wrapped-quote cleanup from `src/renderer/stores/sceneSanitizer.ts`. The local scene-page adapter converts committed prose to small speaker/narration pages; it does not import Venus University's game state or dialogue content.
- `openaiResponse.mjs`: adapted completion response handling from `src/shared/llm/openaiAdapter.ts`, including content part extraction, server error, refusal, truncated output, and empty final response checks.
- `retry.mjs`: adapted retryable HTTP status classification, HTML error gist, and bounded backoff from `src/shared/llm/httpStatus.ts` and `src/renderer/stores/silentRetry.ts`. Delays are shortened for interactive local play; cancellation remains available.
- `openaiResponse.mjs` also adapts `modelIdsOf` to filter advertised models that explicitly lack structured response capability.
- `sceneClassifier.mjs`: adapts the roster, mentioned-only cast, location IDs, structured output, and normalization pattern from `src/shared/classifier.ts` for per-project character and location lists. Its activities are specific to this framework; Venus's course and job classifiers are omitted.
- `ledger.mjs`: adapts the allowlisted character memory sanitation in `ledgerMemories` from `src/renderer/stores/sceneSanitizer.ts`. Only on-screen cast members can receive a bounded memory; scoring and intimate-act systems are not included.

The modules are imported by the AI lore context, scripted scene validator, and visual-novel renderer. Neither the upstream game's characters, lore text, sound, nor image assets are included. The remainder of the harness was implemented separately. This is a personal, undistributed build. Distribution or network service use would require review of the AGPL obligations for the combined program.
- `sceneSanitizer.mjs`: adapts `createSceneSanitizer`, `splitOverflow`, and `sanitizeScene` behavior from `src/renderer/stores/sceneSanitizer.ts` for a project-specific cast and asset allowlist. It drops unknown speakers, backgrounds and sprite actions, caps the stage at four, inserts a missing first entrance, and carries stage actions only on the first split page. It omits the upstream game's wardrobe, CG, dating, and relationship effects.

- `scenePrompt.mjs` also adapts `shortenSceneSoFar` from `src/renderer/prompts/scenePrompt.ts`. The framework's scene summary, closing call, attendance settlement, and save replay are independently implemented against its modular world state.

- `jsonStream.mjs`: adapted `createArrayExtractor`, `objectElement`, and `stringElement` from `src/renderer/stores/jsonStream.ts`. `sceneStream.mjs` and `textingStream.mjs` adapt the respective upstream extractor factories. These are available for future transport/playback integration; parser tests alone do not constitute streamed gameplay.
- `requestQueue.mjs`: adapts serial chaining from `src/renderer/stores/llmQueue.ts`, scoped to each provider and extended with queued cancellation.
- `npcRelationships.mjs`: adapts the pure pair/affinity/friendship functions from `src/shared/npcRelationships.ts`. This framework supplies authored roster data, a seeded event-driven settlement module and a generic trait predicate in place of Venus's fixed trait file.
- `money.mjs`: adapts formatting helpers and constants from `src/shared/money.ts`. Shop commands, pricing, rewards and the optional economy module are original framework code.
