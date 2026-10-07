# Report — T-profile-expansion (reusable character-profile authoring)

Status: done
Files:
- `public/profile-tags.mjs` (new) — shared vocabulary, profile shape, validation, contradiction flags, section-merge
- `packages/ai/character-authoring.mjs` — deep profile in the generation schema + prompt guidance; `profileSectionMessages`, `profileResponseFormat`; `normalizeCharacter` now carries a normalized `profile`
- `public/sheet-editor.mjs` — `profile` in sheet default/import/apply/validate; new "Deep profile" tab (11th) with enum picks, tag chips with custom values, contradiction flags, per-section Regenerate
- `packages/core/character-sheet.mjs` — re-exports unchanged (impl lives in sheet-editor)
- `server.mjs` — new `POST /api/studio/ai-profile-sections` (stateless; regenerates chosen sections, merges, preserves everything else, 2-attempt validation-retry like ai-character)
- `packages/cards/character-card.mjs` — `profile` added to the card extension field list (export/import lossless)
- `public/studio.mjs` — sheet editor wired to the section-regeneration endpoint; Japanese names added to suggestion pool
- `tests/profile-tags.test.mjs` (new, 10 tests), `tests/character-sheet.test.mjs` (tab count 10→11), demo `scripts/profile-expansion-demo.mjs`, artifacts `artifacts/profile-expansion/`, docs `docs/design/profile-runtime-handoff.md`

Tests: focused runs only per ticket (no full suite). All touched areas green: character-authoring, character-sheet, character-card, character-context, startup-authoring, bulk-authoring, studio-ai-authoring, character-lab, dialogue-voice, goals, route-*, scene-voice, card-world, authoring-warnings, character-author-cli, profile-tags = 176 pass / 5 fail; **the 5 fails are pre-existing** in `tests/scene-voice.test.mjs` and trace to `vendor/venus/scenePrompt.mjs` / `narration-lint.mjs` / `creator-template.mjs`, all modified in the working tree by other in-flight tasks before this session started; none of my changed files appear in their failure paths (no model calls, no settings touched).

## Venus University: what was actually inspected (fetched from github.com/venus-uni-dev/venus-university, main)
- `src/shared/characterRules.ts` — Character record (schemaVersion 3): personality prose, 5 relationship behavior keys (withStrangers/Friends/Crush/Lover/Enemy), backstory, datingHistory, datingPreference, kinks, isVirgin, likes/dislikes, giftPreferences (closed categories), traits (closed 7 switches with descriptions), preferredStat (single attraction pick), appearance/outfit tag groups, expression tags per emotion, roomPrompt, voice pitch tier; upgrade path v2→v3.
- `src/shared/tags.ts` — closed Danbooru-style tag enums (expression groups, hair color/length/style/bangs/texture, skin, makeup, outfit skin exposure) — rendering-oriented.
- `src/renderer/prompts/characterPrompt.ts` — RITA persona; cached invariant preamble; PERSONALITY as 6 questions (archetype opening, presented self, guard-drop self, need from others, flaw that pushes away, quirks); BEHAVIOR naming each stage in third person; LOVE LIFE as four separate answers; concrete likes ("pizza" not "cold pizza for breakfast"); closed enums in a strict schema; seed-word block; name-suggestion with culture-matched halves.
- `src/renderer/prompts/characterCard.ts` — composed card export sections.
- `src/renderer/views/characterFields.ts` — field order, sheet placeholders teaching prose shape ("X presents herself as... but actually she's..."), one-per-line lists, behavior placeholders "Around strangers, {name}...".
- `src/shared/regenTags.ts` — stored per-target regen edits (image-side).
- Reuse policy: ideas and structures adapted; code not copied except where already vendored (our `character-authoring.mjs` was previously adapted from `characterPrompt.ts` at snapshot 79301df, AGPL-3.0-only — that attribution header remains). No Venus artwork or characters.

## Existing fields reused (not duplicated)
age/pronouns/description/personality/behavior(5)/backstory/goal/likes/dislikes/voice/style/examples/conversationStarters/flaws/routine (actor); speech profile, sheet traits, dating boundaries, wants, goal (characterSheets); depth.route/speech stay engine-facing. `profile` adds only what was missing.

## Added: the deep profile (`actor.profile`, 6 sections)
- **everyday**: living situation (8 enums), social circle, leisure, habits, practical concerns
- **persona**: archetype (16 described fictional VN archetypes, varied per anti-monoculture rule), public persona vs private behaviour, strengths, insecurities, pride, deliberate contradictions
- **voice**: formality, humour, directness, teasing (each 5–7 described options), vocabulary notes — dimensions, no compulsory tics (tics stay in `speech`)
- **romance**: shows interest, attractedBy, discouragedBy, initiation (5), pace (4), receiving compliments, receiving unwanted attention (5, superset of `unwelcomeStyleOf`), once-close
- **body**: posture, tells, personal space (5), how attention changes — authored as possibilities, never per-turn requirements
- **scenes**: small problems, shared activities, invitations, unfinished matters
Enums are small closed picks with one-line descriptions; specifics are bounded free-text lines (≤6 × 160 chars). All lists accept custom values.

## Creator workflow shipped
- Studio sheet editor: new **Deep profile** tab with per-section blurbs, described enum selects, add/remove/custom tag chips, contradiction flags (advisory), and **per-section Regenerate** that merges only that section and preserves all other edits and authored values.
- `POST /api/studio/ai-profile-sections`: stateless, takes current actor + sections, returns merged profile; provider-validated with one correction retry.
- AI autofill: `characterMessages` schema now requires `profile`; guidance demands everyday details, public/private contrast, at least one defended contradiction, connected manner-based romance, boundaries left to the engine, anti-monoculture rule (no default academics/tech/therapists/sarcasm), Japanese and other names supported (suggestion pool extended).
- Compatibility: `profile` optional everywhere; legacy packs/sheets validate byte-stable on unchanged Apply; legacy model replies get an empty profile; card export/import round-trips it; nothing in `data/ai-settings.json` touched; Dilek/campus cast data untouched.

## Acceptance: three original adult profiles (29/26/31) — `artifacts/profile-expansion/`
Aihara Yuki (tugboat deckhand, gentle-grump: deadpan/blunt/sharp-but-kind, slow, invites, honest), Tachibana Mio (ramen-stand heir, competitive-rival: slangy/teasing/brutally-honest/relentless, eager, makes-moves, tease_back), Kawaguchi Sota (piano tuner, old-soul-homebody: shifting/wordplay/hedges/gentle, measured, hints, flustered). All validate through `normalizeCharacter`; **all 4 voice dimensions differ across the three**, with distinct everyday lives and romantic manners. Diff vs previous output: `artifacts/profile-expansion/diff-vs-previous.md` (previous flat fields vs new six-section profile; sample lines show the voices). `scripts/profile-expansion-demo.mjs` reproduces it (no model calls).

## Outstanding runtime wiring (see `docs/design/profile-runtime-handoff.md`)
Nothing in the scene writer/context pipeline reads `profile` yet, by design. The handoff doc specifies: always-on fields (archetype, voice enums, vocabulary) for `profileOf`/`compactProfile`; scene-relevant gating for everything else (word-match via `relevance()`, stage gates for persona-private and romance, ≤1 body tell per turn, deterministic); engine-owned boundaries stay separate; six flagged overlapping representations (three trait vocabularies, depth.route vs pace, behavior stages vs romance manner, speech vs voice vocabulary, identityTags vs archetype, arc vs persona); and four required integration changes for the runtime agent to implement.

Deviations:
- `tests/character-sheet.test.mjs` asserts `SHEET_TABS.length===10`; adding the Deep profile tab makes it 11. Updated the expected value to match the intended new behaviour (assertion not weakened); no other existing assertion changed.
- The section-regeneration server route required touching `server.mjs` (additive route + imports only); flagged here as the shared-file change the ticket asked to be coordinated — the endpoint is isolated next to `/api/studio/ai-character` and follows its exact retry/validation pattern.
- Browser-based tests were not run (focused node tests per ticket); the Deep profile tab is covered through the existing DOM-stub harness in `tests/profile-tags.test.mjs`.

Noticed:
- Venus's `preferredStat` (single attraction pick) has no SF equivalent; `depth.route` partially covers it. Worth an owner decision before runtime wiring.
- Venus sheet placeholders ("X presents herself as... but actually she's...") are a cheap, high-value addition to our forms if wanted.
- `unwelcomeStyleOf` fallbacks only know deflect/tease_back/guarded; `honest`/`flustered` are authoring-only until wired.

Questions: none — design calls above are listed as Noticed items for the owner.
