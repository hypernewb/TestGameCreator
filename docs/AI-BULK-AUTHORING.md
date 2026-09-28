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

The script validates the complete generated batch. When validation fails, it sends the exact error to the model for one repair attempt. After the repair, entries that still fail are dropped and listed in the proposal. If nothing usable is left, no proposal is written (see "Start from a character card" for the details).

## 3. Review and approve

Open the proposal JSON. Every character and scene begins with `"status": "pending"`. Edit content as needed and change only wanted entries to `"status": "approved"`. Leave unwanted entries pending or set them to `rejected`.

Approve dependencies together. For example, a scene whose speaker is a generated character requires that character to be approved.

### Review in Studio

In the Game Builder, open the project, then choose **Review AI drafts** and pick the proposal file. The **AI drafts** section has these parts:

- **Per-draft lint** (Ren'Py's lint). Validation errors are pinned to the draft that causes them: the draft whose removal changes the error, preferring one the error names. Playability warnings are pinned by the `scene <id>` prefix or the id. Rejected drafts are left out. A draft that depends on a broken one (`completedScenes: unknown scene rumi-kiss`) is flagged too, so fix or regenerate the first one.
- **Status, JSON and regenerate.** Each draft has a status select, an **Edit JSON** box and **Regenerate** with an optional note. The note goes to the model as an `AUTHOR NOTE` (up to 600 characters). Regenerate needs a connected local model. It writes one entry of that kind against the rest of the proposal (same id, one repair). For a route rung, it redraws that love interest's whole ladder with one prose request, plus their endings and tastes. The new draft goes back to pending.
- **Route map** (Twine's story map). Rows are love interests; columns are the rungs. Each cell shows the status (P/A/R), ✕ errors, ! warnings, and ▶ when the bot playtest reached it. Click a cell to jump to its draft.
- **Calendar heatmap.** Day × daypart, shaded by the number of different cards offered to the bots. A 0 is dead time; the target is 2–4.
- **Re-check**, **Approve all without errors**, **Apply approved**, **Download proposal** and **Close**. Apply works on the unsaved project; save afterwards. When the project changed since the proposal was made, an **Apply anyway** box re-stamps it (same pack id only); validation still runs. Opening a pack in Studio fills its default fields, so for no staleness, export the project from Studio before running the CLI on it.

The **Character cards** section imports a SillyTavern or JanitorAI card (PNG or JSON) as a new character and exports any character as a V3 or V2 card. Both save the draft first.

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

### Scenes are hand cards

A place where nothing fires by itself yet keeps its first new scene on its trigger, as the place's intro. Every other generated scene becomes a **hand card** at its place: it is offered while the player is there, and it plays when chosen. This works like Persona's social links or Stardew's heart events, so scenes no longer play back to back.

### Role templates

`--templates N` drafts role-slot templates (see `packages/cards/role-slots.mjs`). A template names one or two roles, such as `["rival"]`. Its pages use `"@rival"` as the speaker or effect character, and `{rival}`, `{rival.they|them|their|theirs}` or `{Rival.they}` in the text.

When you approve a template, it becomes one hand card for each casting from the cast:

- The card plays at the home of its people. A casting whose unscheduled people live in different places never meets, so it is left out. A template that no casting can play is dropped by the repair.
- The hand shows only one casting of a template at a time.
- Every casting shares a `<id>.done` flag, so a template plays once.

A placeholder that names no role (`{boss}`) fails the entry. A one-role template may use the literal word (`{role}`, `"@role"`); it means that role. With two roles, the literal word is ambiguous and fails the entry.

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
| Every choice has a `when` condition | The last choice loses its condition, so the scene cannot stick |
| A choice effect other than `memory`, `trust`, `flag` or `chemistry` (e.g. `money`) | Dropped (the schema offers `trust` only when `social.relationships` is on) |
| A `chemistry` effect | Kept when the pack has `social.dating`, the character has a dating profile, and it has a `reason` (shown to the player); the delta is clamped to ±5 |
| A check `{stat, difficulty, fail}` | `{stat, target, fail: {result}}`: the stat by id or name, the target from the stat's range and the difficulty (easy 15%, medium 25%, hard 40%). Offered only with `character.stats`. A check with no fail text or an unknown stat is dropped; the choice stays |
| A flag id with spaces or capitals ("Met Rumi!") | A slug (`met-rumi`) |
| A variant copy of an existing character ("Rumi (Christmas Edition)", id `rumi-festive`) | Skipped; scenes and events that use its id (any case) or `show:` it point at the original |
| Pronouns with commentary ("She/Her, though on stage…") | The first standard set (`she/her`); a missing value fails the first attempt and is left out after the repair |
| Any scene after the first at a place (see "Scenes are hand cards") | A hand card there (`offer: "hand"`, `when.location`), offered while the player is at that place |
| A scene set away from its speakers (Zoey talks in the kitchen scene but stays on the porch) | The scene moves to where its unscheduled speakers stay. A scene only starts when every speaker is with the player, and `show:` only draws them. Speakers from two places never meet: the first attempt fails, the repair drops the scene |
| A speaker who is nobody in the cast ("HUNTR/X", a band), after the repair only | A narrated line, `HUNTR/X: …` (an id-shaped speaker or a dropped character still drops the scene) |

When a request mixes places or people with scenes or events, generation runs in **two steps**:

1. Locations, characters and world things.
2. Scenes and events, written against a pack that already contains step 1.

In step 2 the schema pins every location, speaker and event character to a known id, so a new person cannot be misspelled. Each step gets its own repair.

Names must be proper names. A role-only name such as "Security Guard" or "The Bartender" is rejected ("Officer Kim" is fine).

The first attempt of each step is strict:

- a copy of an existing character or location is an error, so the repair asks for genuinely new ones;
- any invalid entry fails the whole attempt.

The repair is lenient:

- **Copies** are skipped and reported on stderr.
- **New places with no way in** (for example two rooms linked only to each other and an invented hallway) are dropped, together with anything that stands in them.
- **A short reply** (fewer entries than asked for, or a missing array) keeps what it has, and the gap is listed under `"dropped"` (`templates: wrote 0 of 2`).
- **Characters, events and scenes** are validated one at a time. An entry that still fails is dropped, and the rest are kept. Dropped entries and their errors are listed on stderr and under `"dropped"` in the proposal. (A scene that needs a dropped character is dropped too.)
- **If nothing survives, or the batch as a whole is broken** (for example a disconnected map), the raw reply is saved to `<out>.failed.txt`.

A 5xx response, or a connection the server drops mid-reply, is retried once after a short pause.

On servers with structured output (LM Studio, llama.cpp, vLLM), both commands send a JSON schema, and the grammar enforces the following:

- the entry counts;
- known ids (speakers too, when no new people are requested in the same step);
- non-empty prose;
- the trigger forms.

Other servers fall back to `json_object`, or to plain text.

## Romance routes

Loose scenes make a world; a route makes a game. The `route` command writes, for each love interest, a ladder of hand cards plus the structure that turns a run into a dating sim (`packages/cards/route-skeleton.mjs`):

```
node scripts/ai-bulk-author.mjs route --pack packs/huntrix.json --route rumi,mira --days 14 --model MODEL --out proposals/route.json [--card cards/huntrix.png] [--brief notes.md]
```

**Code builds the structure; the model writes only prose.** Ids, gates, checks, numbers and effects never come from the model.

| Rung | When it is in the hand | Bold choice | Safe choice |
| --- | --- | --- | --- |
| hangout | Morning or afternoon, always | chemistry +2 | trust +2 |
| flirt | Once | charm 3 check; a fail still gives chemistry | trust, a little chemistry |
| charged | After flirt, from ~15% of the run | wit 4 check (+1 after a landed flirt) | trust, chemistry |
| kiss | After charged, from ~35% of the run | nerve 5 check; success starts dating, a fail is a kiss on the cheek | "not yet" |
| properly | After a cheek kiss or "not yet", 6 hours later | nerve 5 check (+2 either way); both outcomes kiss | trust |
| night | Evenings, after the kiss, from ~50% of the run | no check; fades out | goodnight |
| again | Evenings, after the night | chemistry | trust |

Each card is offered at the love interest's home while they are there. Every check fails forward: the ladder still moves, and the chemistry effect carries a `reason`. Intimacy is never behind a check.

The proposal also carries a `route` frame, which `apply` and `check` apply before the scenes:

- the modules the route needs;
- `charm`, `nerve` and `wit`, each starting at 2;
- a dating profile per love interest;
- `run: {days, defaultEnding: "route-solo"}`;
- a `route-last-day` scene that sets `last-day` on the last day;
- endings: `<id>-ending` (kissed and a night), `<id>-close` (kissed), and `route-solo`. All of them wait for `last-day`.

Anything the pack already has is kept. To leave the frame out, delete `"route"` from the proposal.

**One model request per love interest.** The reply is a prose-only JSON of the rungs × `title, opening, says, boldChoice, boldWorks, boldFails, safeChoice, safeResult`, plus an ending and a close. The prompt names each rung's beat and the pacing rule: nothing more than a touch on the arm before the kiss. A slot the model leaves empty, or copies from another rung, keeps a placeholder line and is listed under `"warnings"`. More than 12 such slots triggers one repair. A `says` line loses a `Name:` prefix and wrapping quotes. `--placeholder` skips the model and writes a skeleton with stand-in lines.

Measured on the HUNTR/X fixture (route `rumi,mira`, romancer and explorer bots; the pack alone is 79% dead):

| Days | Turns | Dead | Hand per daypart | Route scenes played | Endings reached |
| --- | --- | --- | --- | --- | --- |
| 3 | 120 | 18% | 3.05 | 14/14 | mira-close, mira-ending |
| 7 | 120 | 27% | 1.97 | 14/14 | rumi-ending, mira-close |
| 14 | 400 | 35% | 1.74 | 14/14 | rumi-close |

Every run had 0 errors. With two love interests, a 14-day run sits just under the 2–4 hand target, because each character offers about one card per daypart once their ladder is climbed. More love interests, or loose hand cards from `generate`, fill the rest.

**Tastes.** The prose reply also names 2–4 things the character loves and 1–3 they can't stand. They fill an actor who has none (authored likes and dislikes are kept) and become the canned "What is it you love about…" talk topics. Learning one in conversation pays chemistry once: +2 for a like, +1 for a dislike, with the reason "you asked about ramen". This is Stardew's loved gifts, as talk.

**Which model.** Route prose is one request per love interest, so a bigger model is affordable. On HUNTR/X, qwen 27b took 3m58s for two love interests against 32 s for the 9b, and kept the pacing rule better. Use the 27b when quality matters and the 9b to iterate.

Director slots are not built yet.

## Playability dry run

Content can validate and still not play. After generating, the script lists what the new content breaks under `"warnings"` in the proposal (problems the pack already had are left out). To check a pack, or a pack plus every non-rejected proposal entry:

```bash
node scripts/ai-bulk-author.mjs check --pack packs/my-game.json [--proposal proposals/batch.json]
```

It warns about:

- a scene or event in a place the player cannot reach from any start;
- two scenes on the same trigger, which play back to back;
- a scene (or beat) whose choices all have conditions, so it can stick;
- a speaker who stays somewhere else and has no schedule, so the scene never starts (`show:<id>` does not help; it only draws them);
- an event whose character never comes to its place (only scheduled characters move; a `scheduleExceptions` entry also counts);
- events that overlap in different places, or with the same character in both.

## Replaying failed replies

When a repair fails, the raw reply is saved as `<out>.failed.txt`. To re-run it through the current normalizer without calling the model (counts default to what the reply contains):

```bash
node scripts/ai-bulk-author.mjs replay --pack packs/my-game.json --reply proposals/batch.json.failed.txt [--out proposals/batch.json]
```

To keep a reply as a regression test, trim the pack and copy both into `tests/fixtures/bulk-replies/`. Then add a case to `cases.json` with the expected kept, skipped and dropped counts. `tests/bulk-replay.test.mjs` checks that strict mode rejects each reply, that lenient mode keeps what is expected, and that the result validates.

## Robustness runs

To compare models, or to see how often one model lands a clean proposal, run `generate` repeatedly:

```bash
node scripts/ai-bulk-robustness.mjs --pack packs/mara.json --card cards/mara.png --models model-a,model-b --runs 3 --dir runs/mara --watch Christmas,Halloween --locations 2 --characters 3 --scenes 6 --events 3
```

Each run prints one line: success, seconds, repairs, retries, kept entries, drops, warnings and `--watch` word counts (useful for spotting setting drift). A per-model summary follows. The proposals, any `*.failed.txt` replies, and `summary.json` stay in `--dir`.

A proposal can validate and still be dull, so each run also plays it. The script applies every non-rejected entry and runs the `romancer` and `explorer` persona bots for `--play-turns` turns (default 120; `0` skips this step). The row then ends with a `play:` segment:

- **dead**: the share of turns where nothing happened;
- **hand**: distinct hand cards offered per daypart (the target is 2–4);
- **played**: how many of the new scenes and templates either bot reached, out of the number proposed;
- **payoff**: minutes to the first payoff;
- **endings**: the endings either bot reached.

The bots are seeded, so the same proposal always plays the same way.

## World generation at game start

The AI runs **once, at authoring time**. When a campaign starts, world generation is seeded and uses no AI. `world.objects` picks one `hideIn` spot per item from the campaign's `initialSeed`, and `/api/new` rolls a random seed. Each playthrough therefore hides the finds differently. The same seed always rebuilds the same world, so replay, recovery and backups stay deterministic. Keep object descriptions neutral ("things fall behind it"), because the find may be somewhere else this run.
