# Handoff: lane C, campus world + player UI

You are one of three AI agents working **in the same checkout at the same time**. Read these first, in order:
1. `CLAUDE.md`: commands, code style and safety rules.
2. [M0-CONTRACT.md](M0-CONTRACT.md): the shapes the other lanes are building, and the file-ownership table. **It is binding.**
3. `docs/GAME-DESIGN.md`: the whole thing, because you're building the world a player actually touches.
4. `docs/research/venus-university/`: the reference game. We borrow the loop, not the look or the names.

## Goal
The first playable world (M0.4) and the player-facing screens for M0: the hub, the day card, the end card and the journal (M0.7, and the UI half of M0.2 and M0.5). `packs/after-hours.json` is **retired**: don't copy from it, extend it or delete it.

## Files you own (edit nothing else)
- New: `packs/campus.json`. Leave `packs/template-campus.json` alone; it's a template fixture.
- `public/**`: the player UI, both `public/play.*` and `public/app.mjs` / `index.html`. Check which one `npm start` serves for play and put the game screens there.
- New tests: `tests/campus*.test.mjs`, `tests/ui-*.test.mjs`. **Don't edit** existing tests such as `player-chrome`, `lead-panel`, `vn-stage` or `gallery`. If your UI change breaks one, ask in chat before touching it.
- `data/cards/campus/`: the owner's SillyTavern cards (gitignored). Read them, never commit them.

If you need anything else (a server route, service field, engine change or module), add a line under "Requests" in M0-CONTRACT.md and tell the owner.

## Work, in order
1. **Cast from the owner's cards.** The owner is putting 3–5 SillyTavern cards (PNG or JSON) in `data/cards/campus/`. If the folder is empty, stop and ask. Don't invent the cast. Import each card with
   `node scripts/card.mjs import packs/campus.json data/cards/campus/<card> --id <id> --location <loc> --out packs/campus.json`,
   starting from a copy of `packs/template-campus.json` with new ids and titles. Pick 3–4 love interests and **one warm friend** (not romanceable, always glad to see you). Every actor must be an explicit adult (`age` ≥ 18 plus the `adult` identity tag). If a card implies otherwise, skip it and tell the owner.
2. **The world** (M0.4):
   - 5–6 places with exits.
   - Schedules, so each love interest is findable in 2+ places across dayparts.
   - Activities in every slot (work, gym, study, café, bar, club…), each with stat and gold ranges. Look at `packs/activity-workshop.json` for the shape.
   - A fixed calendar (a 4–6 week term) and 2–3 endings.
   - Per love interest: a `datingProfiles` entry with preferences (mix public, discoverable and private), a `romanceTempoProfiles` entry (ranks with names and ceilings, gift tastes), and an `intimacy` profile with categories gated on rank and stage.
   - Modules: add `social.romance-tempo`, `calendar`, `stats`, `story.director` and `moments` as needed. Look at how other packs list them.
3. **Likes and limits + arcs.** Wait for lane B's modules to exist, then check that `node -e "import('./packages/modules/index.mjs').then(m=>console.log(Object.keys(m.registry)))"` lists `social.acts`, `character.arc` and `character.sobriety`. For each love interest, write:
   - `actProfiles`: 6–10 entries. Liked and disliked reasons must be concrete and in-character ("you noticed her sketchbook", not "she liked that"), and some must be surprising but consistent with the card.
   - `arcTracks`: 2–3 traits and 3 named stages with a `voice` line each.
   - Bar drinks in `sobriety.drinkItems`.

   Until the modules exist, keep the blocks in a scratch file under `data/` and merge them later.
4. **Day card** (M0.7). At the start of each day, show the date, days left, weather (if any), a callback to yesterday (last end-card verdict or event) and one rumor that names a place and a character.
5. **Hub** (M0.7). The map lists places with this slot's activities, their stat and gold ranges, and who might be there. The phone shows texts, invites and rumors. The free-text box is **always** available alongside.
6. **End card** (M0.2 UI). When a scene closes, list each `sceneVerdicts(state, sceneId)` row as "She liked that you noticed her sketchbook ♥+" / "…♥−", with the romance-tempo heart change animated. Hearts are **visible**: the owner chose hearts over Venus's star flash so the game doesn't read as a copy. Don't show point numbers. The reasons are the only window into the hidden table.
7. **Journal** (M0.5). Per character: known likes and limits from `knownActs(...)`, current stage name from `stageOf(...)`, and discovered dating preferences. **Never** show raw NPC memory, trait numbers or unknown entries. Read-only.

## Data you get from other lanes
- Events `social.actPriced`, `social.actDiscovered`, `character.stageReached` and `social.romancePointsChanged` appear in turn events. Look at how `public/play.mjs` already reads `s.turns` for the shape.
- If the page needs a helper result (`sceneVerdicts`, `knownActs`, `stageOf`) and the state the client gets isn't enough, ask lane A for a server field via "Requests". Don't edit `server.mjs`. Until the modules land, build against a fixture state you write in your test.

## Style
- Match the existing UI code (vanilla ES modules, the `el()` / `$()` helpers, dense style). No frameworks, no build step, no new dependencies.
- Mobile-width friendly. Use the existing themes (`theme-*.css`).
- Flirting in authored text stays suggestive, not explicit. Explicit content only comes through gated intimacy scenes.

## Tests (required)
- `tests/campus.test.mjs`: the pack validates; every love interest has dating, tempo, act and arc profiles; every actor is an adult; every slot offers 3+ activities; a scripted bot run (`execute` commands, no model) reaches an ending.
- `tests/ui-*.test.mjs`: follow `tests/player-chrome.test.mjs` for how UI modules are tested without a browser. Cover the end-card rows (reason plus ♥± and no numbers) and a journal that never lists unknown entries.
- Run `npm test 2>&1 | tail -15` and `npm run validate`. Failures in other lanes' files: report them, don't fix them.
- For visual checks, the owner can run `npm start`. Don't start servers from Bash.

## Rules
- Don't commit unless the owner asks. When asked, `git add` only your own paths. Never commit anything under `data/`.
- Never open `data/ai-settings.json`.

## When you're done
Reply with: the files changed, the cast you picked and why, open questions for the owner (tone, missing card info), and any requests to other lanes.
