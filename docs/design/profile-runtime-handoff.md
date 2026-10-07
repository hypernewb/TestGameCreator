# Deep profile → runtime handoff (2026-10-07, T-profile-expansion)

The character deep profile (`actor.profile`, mirrored as `characterSheets[].profile`, vocabulary in
`public/profile-tags.mjs`) is authoring data. **Nothing in the runtime reads it yet** — that is
deliberate. This document tells the runtime agent what to inject, when, and what NOT to do. More
authoring detail must not mean more tokens on every turn.

## Field map

### Always-on (identity/voice — belongs in `profileOf`/`compactProfile` in `packages/ai/context-budget.mjs`)

| Field | Why it is always-on | Notes |
|---|---|---|
| `persona.archetype` | one word that frames every reply | include only the value, not the description |
| `voice.formality/humour/directness/teasing` | defines how every line sounds | four words; render as one clause |
| `voice.vocabulary` | pet topics / register swings | short prose; clip like `style` |
| `everyday.living` + first `everyday.habit` | grounds small talk | one clause, full profile only when relevant |

Everything else in the profile must be **selected by scene relevance**, never dumped.

### Scene-relevant (inject only when matched, and only the matched entries)

| Field | Select when | Where it fits |
|---|---|---|
| `everyday.leisure/habits/circle` | current location, activity, or player input shares a word (reuse `relevance()` from `packages/ai/memory.mjs`) | cast profile extras, LOD 'full' only |
| `everyday.concerns` | trust/stage ≥ friend, or matched | same |
| `persona.private/contradictions/insecurities` | relationship stage ≥ crush, or a memory triggers it; **never for strangers** | treat like the existing `depth.secret` gating |
| `persona.public/strengths/pride` | matched or stage ≥ friend | low rank in the allocator |
| `romance.*` (all) | stage ≥ crush only; `unwelcome` also when the player advances and is rebuffed | pairs with `behaviorCue` |
| `body.posture/tells/space/attention` | pick **at most one tell per scene turn**, deterministic (hash of character+day, like `dailyMood`) — these are possibilities, not per-turn gestures | `style`-adjacent clause |
| `scenes.problems/shared/invitations/unfinished` | matched by words/location/activity, or offered by the director as beats | rides with `wants`/`conversationStarters` |

### Engine-owned (never author-editable via profile)

Attraction scores, consent, region limits, pace pricing stay in `datingProfiles`, `intimacyProfiles`,
`behavior.rules` and `dating.body`. `profile.romance` is manner-only guidance. `romance.unwelcome`
values `deflect|tease_back|guarded` match the existing `unwelcomeStyleOf` fallbacks; `honest` and
`flustered` are authoring-only until `unwelcomeStyleOf` learns them.

## Overlapping / conflicting representations (flagged, not resolved)

1. **Three trait vocabularies**: Venus `CHARACTER_TRAITS` (7 mechanical switches, actor), sheet
   `TRAITS` (28, `personality.traits`), depth `sheetTraits` (12). Profile does not add a fourth;
   pick one canonical list per layer before unifying (open: A17).
2. **`depth.route` vs `profile.romance.pace/initiation`**: route archetype is engine-facing
   (`relationshipProgressions.archetype`); pace/initiation are manner. Runtime must never read pace
   as pacing logic.
3. **`behavior.withCrush/withLover` vs `profile.romance`**: stages are authored prose per stage;
   profile.romance is the cross-stage manner. If both reach the prompt, prefer the stage prose and
   one romance clause.
4. **`speech` profile vs `profile.voice`**: tics/petPhrases stay in `speech`; `voice.vocabulary`
   must not duplicate them (the existing `speechWarnings` pattern should extend).
5. **`identityTags` vs `persona.archetype`**: identityTags gate dating-module matching; archetype is
   prose. Do not conflate.
6. **`depth.arc` vs `profile.persona`**: arc is engine-tracked drift; persona is static self-image.

## Required runtime integration changes (for the runtime agent; none implemented here)

1. Extend `profileOf`/`compactProfile` (`packages/ai/context-budget.mjs`) with the always-on fields
   above at 'full' LOD; compact keeps only archetype+voice enums.
2. Add a relevance gate (word match via `relevance()`/`keyPattern`) selecting scene-relevant entries;
   register each new field in `contextKnowledge.fields` scoping (`packages/ai/context.mjs`).
3. Extend `speechWarnings`-style duplicate detection to `voice.vocabulary` vs `speech` phrases.
4. Optional: teach `unwelcomeStyleOf` (`packages/core/character-sheet.mjs`) the `honest`/`flustered`
   values from `profile.romance.unwelcome` before falling back to traits.

## Compatibility

- `profile` is optional everywhere: legacy actors, legacy sheets and card exports without it keep
  validating and stay byte-stable on unchanged Apply.
- `normalizeCharacter` falls back to an empty profile for pre-profile model replies (old replay
  batches keep working); new generations require it via the strict schema.
- Card export/import carries `profile` in `extensions['story-framework']` losslessly.
