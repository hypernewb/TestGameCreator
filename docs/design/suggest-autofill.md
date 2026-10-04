# Suggest: sheet auto-fill from seed words — design card
Status: draft · Tickets: T-009b (schema + tabs shipped in T-009a)

## Goal (what the creator feels)
Typing three seed words ("quiet, pre-med, night shifts") hands her a complete, reviewable character sheet in one click. Every field arrives as a proposal the creator accepts or vetoes individually; consent, limits and intimate choices are never proposed — the owner picks those, always.

## What we have (self-audit)
- Owner decisions in [character-sheet.md](character-sheet.md) (2026-10-01): "Suggest = full draft from 3 seed words, per-field review, owner always picks consent/limits/intimate choices."
- Sheet schema, closed lists, validation and the Studio editor live in `public/sheet-editor.mjs`: `createSheet`/`importCharacterSheet`, closed `TRAITS` (28) / `GIFT_CATEGORIES` (12) / `EXPERIENCE` (5) / `REGIONS` (10 shipped; the 29-region map in [character-sheet-lists.md](character-sheet-lists.md) is still owner-pending — Suggest targets the shipped 10), `validateCharacterSheets`. The module is DOM-free at import and already tested from `tests/character-sheet.test.mjs`, so the AI layer can import the lists and validator directly.
- Prompt/normalize patterns to copy: `packages/ai/character-authoring.mjs` (system+user messages, strict `json_schema`, one repair pass) and `packages/ai/bulk-authoring.mjs` (`normalizeCandidate`: tolerant per-field cleanup with a `dropped` notes list instead of all-or-nothing failure).
- Server wiring to copy: `server.mjs` `/api/studio/ai-character` — asserts `service.provider instanceof CompatibleProvider`, builds messages, calls `complete()`, normalizes, returns JSON. No writes to `data/ai-settings.json`.
- The veto-review interaction already exists in spirit in `public/studio.mjs` (ai-character candidate card: review, edit, approve, discard) and per-entry statuses in `packages/ai/proposal-review.mjs`.

## Reference games (one line each)
- Venus: seed-word generation drafts a whole character card, but review is all-or-nothing.
- rp-master: per-section AI fill with explicit owner confirmation on intimate fields.

## Owner decisions (dated; every number lives here)
- 2026-10-01 Suggest creates a full reviewable draft from the decided seed input; review is per field; owner explicitly chooses consent, limits and intimate content before acceptance.
- 2026-10-02 (this card, pending owner OK) One model call per Suggest press: no automatic repair retry; "Suggest again" is the creator's explicit second call.
- 2026-10-02 (this card, pending owner OK) Owner-only fields the model is never asked and never allowed to fill: `dating.experience`, `dating.body[*].limit`, `dating.body[*].sensitivity`, `dating.policyOverrides`, `dating.limitsNotes`, `dating.history`, `dating.repairTrustBar`, `behavior.rules`, `lore.authorNotes`. They render in the review panel as "choose yourself".
- 2026-10-02 (this card, pending owner OK) Suggested `behavior.rules` are out of scope for T-009b (typed event→condition→effect rows touch engine semantics); prose `behavior.notes` only. Rules and `wants` come later.

## Prompt shape
One request, two messages, built by `sheetSuggestMessages(pack, sheet, seeds)` in the new `packages/ai/sheet-suggest.mjs`:

- **System** (short, imperative): "You fill one adult character's sheet for a Story Framework project from seed words. Return one JSON object matching the schema exactly. Use only the listed trait, gift-category and location IDs. Write concrete, specific, contradictory-in-a-human-way content — not archetype summaries. The character is an adult (18+); if the seeds suggest otherwise, set age null and say so in lifeNotes. Never fill limits, sexual experience or consent fields — they are absent from the schema on purpose. Voice examples are exact spoken lines, no speaker labels."
- **User**: compact JSON (no pretty-printing, mirrors `intentMessages` style): `{seeds (the 3 seed words, ≤120 chars total), project:{premise,setting,writingStyle} from `pack.gameProject`, locations:[{id,name}…] (the pack's location list), cast:[actor ids+names] (existing characters the links may reference), existing:{name,pronouns,age,traits,voice,style,likes,dislikes,backstory,goal} (what `importCharacterSheet` already pulled from the actor, so Suggest extends rather than contradicts), lists:{traits:TRAITS,giftCategories:GIFT_CATEGORIES}}`.
- **Response format**: `{type:'json_schema',json_schema:{name:'sheet_suggestion',strict:true,schema:suggestSchema(pack)}}` via `provider.complete(messages, undefined, format)` — the same call signature as `/api/studio/ai-character`. `CompatibleProvider.performComplete` already degrades json_schema → json_object → bare for servers without structured output; that transport fallback is inside the one call.

Prompt tokens stay under ~1,200: closed lists dominate, and the full sheet is *not* echoed back.

## JSON schema (model-facing; strict)
Only fillable, non-owner-only fields. Every enum pinned server-side; every array bounded.

```
{ type:'object', additionalProperties:false, required:[all keys],
  properties:{
    identity:{ name, pronouns, occupation, year, birthday (MM-DD string or ''), lifeNotes,
               age: integer 18–120 or null, workplace/home: enum ['', ...locationIds],
               haunts: array of location ids, maxItems 4 },
    personality:{ traits: minItems 2 maxItems 4, enum-pinned to TRAITS,
                  notes, voice, fingerprint: string,
                  examples: array of 2–4 strings },
    appearance:{ description, style, notes: string },
    tastes:{ likes, dislikes: arrays of strings maxItems 8,
             likedCategories, dislikedCategories: enum-pinned, maxItems 12,
             notes: string },
    dating:{ preferences: string },              // the only dating field offered
    routine:{ weekly: array maxItems 21 of {weekday enum, daypart enum, location enum},
              notes: string },
    social:{ links: array maxItems 6 of { id: string,
              actorId: enum ['', ...castIds] | externalName: string, relation, notes } },
    arc:{ goal, notes: string },
    lore:{ backstory: string }
  }}
```
Absent by construction: everything the owner picks (see decisions), plus `behavior.rules`, `wants`, `arc.tracks/payoffs`, `lore.entries`, `tastes.itemOverrides`, `routine.exceptions`, `appearance.portrait/poses` (art metadata, not prose).

## Normalization (`normalizeSuggestion(raw, pack)` → `{values, dropped}`)
Mirrors `normalizeCandidate`'s style: never throw on a half-good answer; return a flat map of `path → normalized value` plus a `dropped` notes list. Per field: trim strings; clamp to the same maxima the sheet validator enforces; filter `traits`/categories to the closed lists (a wrong count or an unknown id drops the whole array with a note — partial trait sets fail `validateCharacterSheets` anyway); resolve `workplace`/`home`/`haunts`/`weekly.location` against pack locations and drop unknowns; weekly slot conflicts keep the first row and note the rest; links keep either a known `actorId` or a non-empty `externalName`, never both; age `< 18` or non-integer → `null` + note (never clamp upward into a shipped age). Owner-only keys arriving anyway are deleted and noted — the model cannot smuggle a limit past review. If `values` ends up empty, the call fails with the joined `dropped` list.

## Veto flow (Studio UI)
1. The sheet editor header gains a **Suggest from seed words…** button (next to *Apply sheet to draft*). It prompts for the three seed words inline; the button disables while the call runs, with the provider's busy/timeout errors surfaced verbatim in the existing status line.
2. The reply renders as a **review panel** above the tabs, grouped by sheet tab. Each proposed field is one row: field label, current value (or "empty"), suggested value (long text truncated to ~2 lines, expandable), and a checkbox. Prose and descriptive fields default **accepted**; identity `name`/`age` default accepted only when the sheet's current value is empty (Suggest never silently renames her); `routine.weekly` rows and `social.links` default accepted individually.
3. A pinned banner reads: "Not suggested — choose yourself: sexual experience, body sensitivity and limits, consent policy, behavior rules." The owner-only fields stay exactly as they are.
4. **Apply N accepted fields** deep-merges only checked paths into the editor's `draft` object (arrays replaced wholesale), then runs `validateCharacterSheets` on a cloned pack. On validation failure the merge is rolled back and the error shows in the status line; on success the normal existing flow takes over — the creator inspects the tabs and presses *Apply sheet to draft* to persist, then saves the project. Veto is one click per field; nothing reaches the pack un-vetoed.

## Cost: one model call
One Suggest press = one `provider.complete()` generation (at most three HTTP attempts inside `performComplete` only when the server rejects a response-format tier — not new prompt work). No hidden repair loop: a validation-failed answer is normalized field-by-field instead, and what survives is what the creator reviews. A re-roll is a deliberate second press by the creator. At ~1,200 prompt + ~2,500 output tokens (`maxTokens: 3000`), a local model pays nothing but time; a cloud key pays one call — consistent with the project's quota discipline (no per-turn judging calls; Suggest is authoring-time only).

## Failure cases
| Case | Behavior |
| --- | --- |
| No model connected (`service.provider` not `CompatibleProvider`) | Route asserts like `/api/studio/ai-character`: "Connect a local AI model in AI settings" — no silent MockProvider drafts |
| Unparseable / non-JSON reply | `parseModelObject` throws; error text (first 180 chars) shown; draft untouched |
| Valid JSON, garbage fields | Normalizer drops bad fields with notes; review panel shows survivors + "Dropped: …" list |
| Everything dropped | Route fails with the joined notes; "Suggest again" is the retry |
| Model fills owner-only fields | Deleted during normalization, noted in the panel |
| Minor-coded age | `null` + note; seeds-to-minor requests are refused by prompt instruction |
| Unknown location / actor refs | Row dropped with note; refs can never be invented (enums in schema) |
| Weekly schedule conflict | First row wins, later rows dropped with note (same rule as `validateCharacterSheets`) |
| Model busy / timeout | Existing `modelBusy` error propagates; button re-enables; nothing applied |
| Creator edits the draft while reviewing | Diff rows re-read the live draft at apply time; apply overwrites only checked paths; validation is the backstop |
| Merged draft fails validation | Merge rolled back, error shown — the editor's draft is never left invalid |

## Test plan (`tests/sheet-suggest.test.mjs`, pure functions — no server, no model)
1. `sheetSuggestMessages`: system forbids limits/experience/consent; user carries seeds, location ids, cast ids and both closed lists; schema has `additionalProperties:false` and no owner-only key anywhere.
2. `normalizeSuggestion` happy path: a full valid answer maps every fillable path; traits/categories survive only when on-list.
3. Guardrails: unknown trait/category/location/actor dropped + noted; weekly conflict keeps first slot; model-sent `dating.body` / `experience` / `rules` deleted + noted; age 17 → `null` + note; oversize strings clamped.
4. Empty-survivor set throws with the dropped notes joined.
5. Veto merge (`applySuggestion` exported for tests): unchecked paths leave old values byte-identical; checked arrays replace wholesale; merged draft passes `validateCharacterSheets`; a deliberately invalid accepted value (e.g. 3 traits) rolls the draft back unchanged.
6. Existing suite stays green; `tests/character-sheet.test.mjs` untouched.

## Implementation (file-by-file, sized for T-009b — one ticket)
1. **`packages/ai/sheet-suggest.mjs`** (new, ~120 lines): `sheetSuggestMessages`, `suggestSchema`, `normalizeSuggestion`, `applySuggestion(draft, values, acceptedPaths)`; imports `TRAITS`, `GIFT_CATEGORIES`, `REGIONS`, `validateCharacterSheets` from `../../public/sheet-editor.mjs` and `parseModelObject` from `./json.mjs`.
2. **`server.mjs`** (+12 lines): `/api/studio/suggest-sheet` POST beside `/api/studio/ai-character` — provider assert, brief-length assert, one `complete()`, `normalizeSuggestion`, `send({values, dropped, provider})`.
3. **`public/sheet-editor.mjs`** (+~60 lines inside `mountSheetEditor`): the Suggest button, seed input, review panel with per-field checkboxes, apply/veto merge via `applySuggestion`; `changed()` fired only after the creator's normal Apply. No signature changes.
4. **`tests/sheet-suggest.test.mjs`** (new): the six cases above.
5. **`docs/briefs/T-009b.md`** (new): points at this card; acceptance = tests pass + manual Studio run against a local model produces a reviewable diff.

Not in this ticket: behavior rules / wants generation, re-suggest per tab, proposal-file persistence across sessions (the diff lives in the open editor only), 29-region map (awaiting owner approval in [character-sheet-lists.md](character-sheet-lists.md)).

## Fun rubric notes (creator-facing)
Agency: the owner vets every field, so the cast stays theirs. Surprise: seed words plus project premise produce contradictions and agendas the owner didn't think to type. Payoff: a full sheet in one review pass instead of forty empty inputs. Repetition: closed lists keep suggestions engine-readable; re-rolls change prose, never vocabulary.
