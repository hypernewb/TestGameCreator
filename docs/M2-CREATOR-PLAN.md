# M2 creator plan

Goal: a premise or a SillyTavern card becomes a playable Venus-style world. Code owns ids, gates, triggers and numbers. The cloud model fills text. The local model plays.

## Layers

| Layer | File | Owner | What it holds |
|---|---|---|---|
| Beat library | `packages/cards/beat-library.mjs` | code | Temperaments (torn, guarded, prickly, practical): arc trait, gates, drift and act rows with role slots. Paces (slow, steady, easy, casual). Rung triggers, tone → numbers, the night skeleton, ending priorities, model guidance defaults. |
| World spec | JSON, drafted then reviewed | AI + owner | Names, ages, places, items, topic/looks/quirk/gift targets, reasons, rank and stage names, scene prose, choice labels with a tone, ending text. |
| Assembler | `packages/cards/world-assembly.mjs` | code | `assemble(spec) → {pack, missing}`. A blank text slot becomes `[[path]]` and its path goes into `missing`, so a structure-only spec still validates and plays. `specFromPack(pack,{cast})` pulls text back out of a hand-built pack. |

Hard rules in the assembler: every character, the player included, has an integer age of 18 or more. Unknown temperament, pace or tone is refused. Every rung has at least one best or good choice. Every night beat has a stop that withdraws consent and costs nothing.

## Proof 1: campus round trip (done)

`assemble(specFromPack(campus, {cast}))` validates with no blank slots. Scene ids and triggers, rank ids, arc gates and ending requirements match the hand-built pack. All four heroines climb talk → date → kiss → night in their own order, a stopped night replays, and fallback, together and route endings are reachable (`tests/world-assembly.test.mjs`).

Known same-shape drift from the hand-tuned pack: a few points differ by 1–2 (night `more`, `rush`, one talk choice, some gift prices, two want weights). Templates win, since that tuning is what every world will get.

## Next steps

**Proof 1 live (2026-09-29):** campus stripped to its picks, then drafted by `deepseek/deepseek-v4.1-flash`: valid, 0 blank slots, 22 calls (one slot needed round 2), 16.5k in / 24.6k out tokens ≈ $0.035, 161 s. Voices hold per temperament, choice wording matches its tone, reasons read as "you …", stops are warm and guilt-free, and the rush beat lands badly without being coercive. Scene text averages ~300 chars (max ~460). A timeout mid-run no longer kills the run: the client retries it and a failed batch stays missing for the next round.

1. **Draft pass (done).** `packages/cards/world-draft.mjs` (`structureOnly`, `batches`, `draftWorld`) + `packages/cards/openrouter.mjs` (owner pick: OpenRouter, `deepseek/deepseek-v4.1-flash`, key in `.env` as `OPENROUTER_API_KEY`). `node scripts/draft-world.mjs` strips campus to its picks and drafts every slot (~21 calls); `--dry` runs offline. Take a premise (or a card) and cast picks, fill the `missing` paths in small batches with a cloud model, and re-run `assemble` until `missing` is empty. Each batch is one prompt listing its paths, the world summary so far, and the slot's role (for example "`heroines.ava.reasons.topic`: why talking about {topic} lands with a practical woman"). Output is JSON keyed by path. The same code path serves a card: the card's description and first message seed the premise and one heroine's voice.
2. **Structure pass (done).** `packages/cards/world-structure.mjs`: `proposeWorld(premise,{complete,heroines,style})` asks the drafter for an editable proposal (title, player, premise, setting, places with a kind, items with a price word and drink flag, activities with where/gives/done-with, weather, and heroines with name, age, temperament, pace, topic, home, hangouts, wants, gifts, likes/dislikes, quirk, looks). `structureFromProposal(proposal)` turns it into a spec. Code assigns ids, exits, prices and yields, and refuses ages under 18. Anything it had to fix goes into `notes`.
   **Premise proof (2026-09-29):** `node scripts/draft-world.mjs --premise "..."` produced "Ferry to Saltwind" (7 places, 9 items, 9 activities, 4 heroines with distinct temperaments). It was valid, with 0 notes, 0 blank slots, 22 calls, ≈ $0.044 and 385 s serial. The wizard now drafts up to 6 cards in parallel.
3. **Creator wizard (done): `/creator.html`.** It is a new page and does not edit `public/studio.mjs`. Owner calls:
   - The AI proposes and the owner edits.
   - Draft everything first, then review.
   - Each scene card can be edited or redrafted on its own.
   - Save makes a new campaign.
   - The heroine form shows the essentials, with a "More" fold for the rest.

   The steps are Premise → Proposal (every field is editable, and lists have add and remove) → Draft (one button with a progress pill per card, and Stop/resume; it drafts the world first, then the profiles, then the scenes 6 at a time, over 2 passes) → Review & save (cards grouped by heroine, tone badges on choices, blank fields flagged as "AI improvises"; Save keeps them and the game improvises them). The draft lives in localStorage, and saved worlds can be reopened from step 1.
   The API lives in `packages/cards/creator-routes.mjs`:
   - `POST /api/creator/propose`, `structure`, `check`, `fill` and `save`.
   - `fill` takes `batch` or up to 6 `batches` and runs them in parallel. With `redo`, it blanks those cards first. A failed card stays missing and is listed in `errors`.
   - `GET /api/creator/options`, `worlds` and `world?id=`.
   - The drafter is OpenRouter when `OPENROUTER_API_KEY` is set. Otherwise the routes return an error that says how to set the key.
   - Tests: `tests/creator-routes.test.mjs`.
4. **Card input (done).** Owner call: the card's character becomes love interest 1 and keeps her voice, the card's scenario becomes the premise, and the AI proposes the rest of the cast (which the owner can delete). Step 1 of the wizard takes a PNG/JSON card. `cardSeed` in `world-structure.mjs` reads it locally with no model call, resolves `{{char}}`/`{{user}}`, strips markdown images, links, HTML and rules, and caps the text (description 3000, personality 600, opening 400; the card text only reaches the cloud drafter, never the local model). It refuses cards with a minor tag, or whose stated ages are all under 18 (backstory ages such as "age 10 she ran away" pass when an adult age is also stated). `POST /api/creator/card` returns `{name,text,premise}`, and `propose` takes `card`. The card text is kept in `spec.source.card`, so every draft batch for her (and the world batch, trimmed) sees it. A proposal with no love interest named after the card gets a note and ignores the card. The Play and Studio headers link to the creator.
5. **Proof 2:** a new world from an adult-only ST romance card, played on the local model.
   **Draft (2026-09-29):** `node scripts/draft-world.mjs --card yvette.png` (a public chub.ai card: "Yvette, Mage Hunter", 24, grimdark; the card's scenario became the premise). Proposal: "Jale: The Mana Cull", 7 places, 10 items, 8 activities, and Yvette (guarded/slow) plus three AI heroines (torn, prickly, practical), with 0 notes. The result had 0 blank slots, 22 calls, 22.3k in / 36.2k out ≈ $0.050, and took 537 s serial. Her voice carried over: a blunt, dry line in `voice`, her looks, and the card's opening (three weeks tracking you) turned into the talk rung. The grimdark city became a dating-sim hub (black market, tavern, chapel). One lore slip: the kiss rung flips who hunts whom. The first run failed validation because the pack id was `jale:-the-mana-cull`. `idFor` now drops every character the engine's `safeKey` refuses (test in `world-structure.test.mjs`). `scripts/ai-game-tester.mjs --pack` now also takes a JSON file (a pack, or a draft-world/creator output with `{pack}`).
   **Play (local 9B, 4k context):**
   - What worked: a 3-day `ai-game-tester` run reached the tick target. The drafted rung text lands well and hearts move (Sable 25 → 27 on a flirt she waves off, Mireille's hymn reveal). First choice came at 1.3 min and first payoff at 0.3 min.
   - Tester run weaknesses: 66% of turns were dead (look/wait loops) and there was no drama. That run never visited Yvette.
   - Yvette driver run (straight to her): free-text replies keep her sarcasm ("like leeches on a pig") but drift in three ways. Her looks change (emerald eyes and an apron, while the card says dusk blue). She touches the player on first meeting, although she is guarded and slow. After three turns the model narrates the player in the third person by name ("Cael vows to protect Yvette"). The proposal gave the player a name, the memory ledger uses it, and the player-invention lint only catches "you".
   - Owner call: keep player names. A new soft `player-person` check in `narration-lint.mjs` asks for one repair when a narrator line names the player; dialogue may still use the name (`tests/agency-lint.test.mjs`). In the rerun the third-person drift is gone and Yvette says "Cael" in dialogue. Still open: the prompt-turn prose path can write the player's reactions and words ("pulse quickening despite yourself"), which the interior regex misses.
   - **M2 verdict:** both proofs pass, so M3 is next (owner call). Left for later: the looks anchor, touch pacing for guarded heroines, and lore consistency across drafted scenes.

## Out of scope for M2

New temperaments beyond the four, friend routes, secrecy and agreements (M4), and CG generation for new worlds.
