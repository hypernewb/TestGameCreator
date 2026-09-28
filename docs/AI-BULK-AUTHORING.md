# AI-assisted bulk authoring

The bulk authoring script asks a local OpenAI-compatible model for a batch of characters and scripted scenes. Generation produces a review file and never edits the source project.

## Draft one scene in Studio

Studio also includes an interactive assistant under **Scripted scenes → Draft a scene with AI**. Connect the local model under **AI settings**, then describe the scene's purpose, location, cast, tone, and continuity constraints. Studio sends the current unsaved project as context, including character voices, lore, facts, existing scenes, locations, pose IDs, activities, items, and enabled modules.

The result is validated before it appears. You can preview it, edit its JSON, run the project checks again, and choose **Approve and add to draft**. Approval only adds it to the unsaved browser draft; **Save draft** remains a separate action. A failed first result receives one repair attempt using the validator's exact error.

## 1. Write a brief

Create a plain text or Markdown file. Be concrete about the cast's role, the dramatic purpose of the scenes, desired tone, content limits, and recurring story threads. For example:

```md
Create four adult residents for the harbor district. Give each a different immediate goal and speaking rhythm. They should have reasons to cross paths at the workshop.

Create eight short introductory scenes, two centered on each character. Each scene should reveal a useful conflict and offer two materially different responses. Use memory and small trust effects. Do not resolve the central exhibition problem.
```

## 2. Generate a proposal

Start the local model server configured for Story Framework, then run:

```powershell
npm run author:bulk -- generate --pack packs/my-game.json --brief briefs/harbor.md --characters 4 --scenes 8 --model your-model-id --out harbor-proposal.json
```

The default endpoint is `http://127.0.0.1:1234/v1`. Set `STORY_ENDPOINT` and `STORY_MODEL`, or pass `--endpoint` and `--model`.

The script validates the complete generated batch. When validation fails, it sends the exact error to the model for one repair attempt. A second failure stops without writing a proposal.

## 3. Review and approve

Open the proposal JSON. Every character and scene begins with `"status": "pending"`. Edit content as needed and change only wanted entries to `"status": "approved"`. Leave unwanted entries pending or set them to `rejected`.

Approve dependencies together. For example, a scene whose speaker is a generated character requires that character to be approved.

## 4. Apply to a new pack

```powershell
npm run author:bulk -- apply --pack packs/my-game.json --proposal harbor-proposal.json --out packs/my-game-expanded.json
```

Apply refuses to overwrite an existing file, rejects proposals when the source pack changed after generation, and validates the final pack before writing it. Run `npm run validate -- packs/my-game-expanded.json` as an optional final check.

The current generator targets characters and compact, single-part scenes. Multi-beat chains are allowed only when explicitly requested, but are better authored and tested in Studio after import.

## World population (before publish) and world generation (each new game)

The same pipeline drafts things to do in the world. Use `--objects N --items N --activities N` together with or instead of `--characters`/`--scenes`:

```bash
node scripts/ai-bulk-author.mjs generate --pack packs/my-game.json --brief briefs/world.md --objects 8 --items 4 --activities 6 --model MODEL --out proposals/world.json
```

- **Objects** are things to examine. They can be usable (`effectFlag`, `useText`), and the use can be locked behind an item (`requiresItem`).
- **Hidden items** name 2–3 candidate spots (`hideIn`) instead of a fixed `owner`. An item may never hide in the object it unlocks.
- **Activities** raise stats (+1/+2 in a known stat) or money (±20) and may require an object's flag.

Validation rejects any of the following:

- unknown locations or stats;
- ids that are already used;
- out-of-range deltas;
- a key that is locked inside its own lock.

Nothing lands until you approve it.

## Start from a character card

A SillyTavern, JanitorAI, Chub, RisuAI or Pygmalion card (PNG or JSON; V1, V2 or V3) can seed a new pack and then grow it:

```bash
node scripts/ai-bulk-author.mjs seed --card cards/mara.png --locations 4 --model MODEL --out packs/mara.json [--brief notes.md]
node scripts/ai-bulk-author.mjs generate --pack packs/mara.json --card cards/mara.png --locations 2 --characters 3 --scenes 6 --events 3 --model MODEL --out proposals/mara.json
```

- **Seed** drafts a title, a premise, a setting and a connected map, then imports the card as an actor. It writes the pack directly, because it only creates a new file.
- A **group card** gets one actor per member, sharing the card lore. Examples: "Rumi & Mira & Zoey", or "Ann, Bea and Cy".
- Cards often contradict themselves: a Halloween scenario with a Christmas `first_mes`, for instance.
  - Seed follows the **opening scene**, unless your `--brief` says otherwise.
  - Generate follows the **pack's own `gameProject.setting`**.
- `--card` on generate builds a brief from the card. It includes the description, personality, greetings, scenario, lore and tags; example dialogue is skipped. The cast is told the card characters already exist. `--brief` adds author notes on top.
- `--locations N` adds places. Each one must connect to the existing map or another new place, and invented exits are dropped.
- `--events N` adds one-off timed happenings (`story.timed-events`). Each has a day, a daypart, a location, attended text and a missed recap.

Generated scenes may only trigger on these two forms, which are events the engine actually emits:

- `{"event":"core.inspected","match":{"location":id}}`
- `{"event":"core.moved","match":{"to":id}}`

Any other trigger is rejected.

Small models drift in predictable ways, and the normalizer tidies what is unambiguous:

| What the model writes | What it becomes |
| --- | --- |
| A speaker as a display name ("Rumi") | The actor id |
| A prose speaker ("*She laughs*"), or a joint speaker ("Rumi & Mira") | Narration inside the page text |
| A page spoken by the player | Dropped |
| A stage cue as an object (`{characterId}`) | `show:<id>` |
| A stage cue as prose | Dropped |
| A choice without an id | An id made from its label |
| A near-miss id ("Main Party Room") | The matching id, when exactly one matches |

The normalizer also handles copies of existing content:

- **First attempt:** a copy of an existing character or location is an error, so the repair asks for genuinely new ones.
- **Repair:** copies are skipped and reported on stderr instead.
- **If the repair fails too:** the raw reply is saved to `<out>.failed.txt`.

On servers with structured output (LM Studio, llama.cpp, vLLM), both commands send a JSON schema, and the grammar enforces the following:

- the entry counts;
- known ids;
- non-empty prose;
- the trigger forms.

Other servers fall back to `json_object`, or to plain text.

## World generation at game start

The AI runs **once, at authoring time**. When a campaign starts, world generation is seeded and uses no AI. `world.objects` picks one `hideIn` spot per item from the campaign's `initialSeed`, and `/api/new` rolls a random seed. Each playthrough therefore hides the finds differently. The same seed always rebuilds the same world, so replay, recovery and backups stay deterministic. Keep object descriptions neutral ("things fall behind it"), because the find may be somewhere else this run.
