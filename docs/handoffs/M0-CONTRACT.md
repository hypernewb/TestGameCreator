# M0 contract: shared shapes for the three lanes

Status: 2026-09-29. Three agents work on M0 **in the same checkout** at the same time, so this file fixes the interfaces between them. Change a shape here only after asking the owner in chat, and note the change at the bottom.

Design: [../GAME-DESIGN.md](../GAME-DESIGN.md). Roadmap: [../NEXT-MILESTONES.md](../NEXT-MILESTONES.md#game-tier-whats-left).

## Lanes and file ownership
Only edit files your lane owns. If you need a change in someone else's file, write it under "Requests" at the bottom of this file and tell the owner in chat.

| Lane | Who | Owns |
|---|---|---|
| **A: scene + model side** | the main session | `packages/ai/**`, `vendor/venus/**`, `packages/modules/intimacy.mjs`, `packages/core/**`, `server.mjs`, `docs/NEXT-MILESTONES.md`, `docs/GAME-DESIGN.md`, this file |
| **B: engine modules** | helper 1, [lane-b-engine.md](lane-b-engine.md) | new `packages/modules/acts.mjs`, `arc.mjs`, `sobriety.mjs`; the registration lines in `packages/modules/index.mjs`; appended types in `packages/contracts/index.d.ts`; a one-line `export` of `addPoints` in `romance-tempo.mjs`; `tests/acts*.test.mjs`, `tests/arc*.test.mjs`, `tests/sobriety*.test.mjs`; new `docs/SOCIAL-ACTS.md` |
| **C: campus world + UI** | helper 2, [lane-c-campus-ui.md](lane-c-campus-ui.md) | new `packs/campus.json`; `public/**`; `tests/campus*.test.mjs`, `tests/ui-*.test.mjs`; the cards in `data/cards/campus/` (gitignored, never committed) |

Everyone:
- Nobody edits `package.json`, `CLAUDE.md` or another lane's tests. Ask instead.
- Nobody commits unless the owner asks. When asked, stage only your own paths (`git add <paths>`, never `-A`).
- `npm test` runs every lane's tests. A failure in a file you don't own is another lane's work in progress: report it, don't fix it.
- Never open `data/ai-settings.json`.

## 1. Acts: what the model tags, what the engine prices (lane B builds, lane A calls)

**Command** `social.priceActs`, executed by lane A after a scene reply is accepted, and recorded as a normal turn so replay never calls the model.
```js
{type:'social.priceActs', actorId:playerId, args:{
  character:'mia',            // focus NPC; must have an actProfile
  sceneId:'s-12',             // world.scene.id at the time
  source:'turn-40',           // turn whose reply produced the tags
  acts:[{kind:'compliment', target:'looks', size:'medium'}, {kind:'buy', target:'coffee', size:'small'}]  // 0–4 acts
}}
```
- **Kinds** (closed list, v1): `flirt`, `compliment`, `gift`, `touch`, `insult`, `buy`, `invite`, `tease`, `listen`, `boast`, `pushy`. `target` is a short free string (`looks`, `hair`, `coffee`, `waist`, `saturday-evening@cafe`…), max 40 chars, lowercased. `size` ∈ `small|medium|large`.
- An optional `landed:true|false` per act is the model's own read. It is used **only** when no profile entry matches.
- Unknown kinds are dropped silently. The command never throws on bad model data, since the data is untrusted and lane A pre-filters it anyway.

**Pack** `actProfiles` (module `social.acts` v0.1.0, requires `social.dating` and `social.romance-tempo`):
```js
{character:'mia',
 entries:[ // likes and limits in one table; the sign of points says which
   {id:'likes-sketches', kind:'compliment', target:'art', points:6, reason:'you noticed her sketchbook'},
   {id:'hates-ex-talk', kind:'tease', target:'ex', points:-8, reason:'you brought up her ex', memory:'He joked about my ex.'},
   {id:'no-public-touch', kind:'touch', target:'*', points:-5, reason:'you touched her in front of people', when:{private:false}}
 ],
 fallback:{landed:2, missed:-2},     // unmatched acts, clamped to these
 sizeMultiplier:{small:1, medium:1.5, large:2},
 sceneCap:12,                        // max total |points| per scene
 repeatDecayPercent:50}              // the same entry again in the same day
```
- Matching: exact `kind`, then `target`. `'*'` matches any target, and the more specific entry wins. `when.private` is checked against lane A's scene flag (args `private:true|false`; default `true` when only the focus NPC is present).
- Points go through romance-tempo's `addPoints`, so rank ceilings still cap them. Sweet talk can't jump a rank.
- `buy:<item>`: if `<item>` is a pack item with a price and the player can pay, bill it through the economy module and give the item to the NPC as a gift, which also prices the gift preference. If the player can't pay, emit the event with `verdict:'unpaid'` and no points.
- `invite:<when>@<place>`: create a pending plan the player can keep or break. Lane B reuses what the codebase already has for plans and date invites; document the choice in `docs/SOCIAL-ACTS.md`. Breaking it costs points.

**Events** (lane C's end card reads these, and lane A reads them for the narrator):
- `social.actPriced` `{character, sceneId, source, act, entry:id|null, points, verdict:'liked'|'disliked'|'neutral'|'unpaid', reason}`. `reason` is the entry's reason, or `'that landed'` / `'that fell flat'` for the fallback.
- `social.actDiscovered` `{character, entry, reason}` fires the first time an entry is matched and adds the entry to `runtime.known`. This drives the journal.

**Exports** from `acts.mjs`:
- `actProfileOf(pack, character)`
- `knownActs(state, pack, character)` → known entries `{id, kind, target, reason, liked:boolean}`, for the journal.
- `narratorBrief(state, pack, character)` → at most 4 short lines of **private** likes and limits (unknown ones included), for lane A's prompt. Keep the total under 60 tokens.
- `sceneVerdicts(state, sceneId)` → `[{character, reason, points, verdict}]`, folded from `social.actPriced` in turns of that scene. This feeds the end card.

## 2. Change arc: hidden traits, named stages (lane B builds)

**Pack** `arcTracks` (module `character.arc` v0.1.0):
```js
{character:'mia',
 traits:[{id:'boldness', label:'Boldness', initial:10}, {id:'openness', initial:20}],   // 0–100, hidden
 drift:[{act:'flirt', target:'*', trait:'boldness', delta:2}, {event:'social.intimacyCompleted', trait:'openness', delta:5}],
 stages:[
   {id:'reserved', name:'Reserved', when:{}, voice:'guarded, short sentences'},
   {id:'curious', name:'Curious', when:{boldness:30}, voice:'teasing, asks questions back', flag:'mia_curious'},
   {id:'bold', name:'Bold', when:{boldness:60, openness:50}, voice:'forward, suggestive', flag:'mia_bold'}
 ]}
```
- Stages only move forward. Reaching one sets its `flag`, so scenes, activities and intimacy categories can gate on it with the existing `when.flags`.
- Events: `character.traitChanged {character, trait, delta, value}` (hidden, never shown with a number) and `character.stageReached {character, stage, name, text}` (visible).
- Exports: `stageOf(state, pack, character)` → `{id, name, voice}` for lane A's narrator brief, and `traitsOf(...)` for tests and debugging only.
- A stage **never grants consent**. It only makes content eligible.

## 3. Sobriety (lane B builds, lane A enforces)
- Module `character.sobriety` v0.1.0. Pack `sobriety:{drinkItems:['beer','wine'], tipsyAt:2, drunkAt:3, soberPerDaypart:1}`.
- Giving or buying a drink item for an NPC (including `buy:<drink>` through acts) adds 1. The count drops by `soberPerDaypart` whenever the daypart advances.
- Export `sobrietyOf(state, pack, character)` → `'sober'|'tipsy'|'drunk'`.
- **The rule lane A enforces, which is not configurable:** `drunk` blocks every intimacy category. `tipsy` blocks it unless the category sets `allowTipsy:true`. A block produces the "ask me again when I'm sober" hook, never intimate prose.
- Lane A enforcement (done): `social.requestIntimacy`/`beginIntimacy` defer with the sober hook. In typed scenes on any pack with `social.intimacy`, prose is capped at suggestive (a hard lint error even on `contentLevel:'explicit'`) unless a cast member has an **active** encounter in state. The prompt gets a BOUNDARY line, and a sober reminder for tipsy or drunk cast members.

## 4. Scene flags lane A provides
- Budgets are **opt-in per pack**: `gameProject.sceneBudget` (int 1–10), overridden per activity by `activities[i].inputBudget`. Packs without either keep the old open-ended scenes.
- A budgeted scene gains `focus` (`activity.character`, else the first present character), `budget` and `inputs` (count used, starts at 1). The campus pack should set `sceneBudget:4`.
- A scene closes on the input that reaches `budget`. The closing reply answers that input, then the end card shows.
- **End card data** = `sceneVerdicts(state, sceneId)` plus the heart change: romance-tempo points before vs after, which lane C renders as ♥+ / ♥−.
- **Act memories** (done): an entry's `memory` rides on the `social.actPriced` payload (with `verdict`), and the context builder reads it like a scene ledger row ("Ada liked: …"). Nothing extra is stored, and replay stays model-free.

## Requests (append; newest last)
- **A → B** (2026-09-29): `social.actPriced` payload should also carry `text`, a one-line player-visible verdict ("She liked that you noticed her sketchbook."). The service shows the joined `text` of visible events as the rules turn's narration; without it the turn reads "Action completed." Emit the events to `[playerId]` only.
- **A → B** (2026-09-29): lane A sends one extra arg, `private:true|false` (true when the focus is the only character present). Use it for `when.private`; `validate` must accept it. Lane A pre-filters acts with `sceneActs` in `packages/ai/scene-acts.mjs`; you may import it instead of re-implementing the filter.
- **A → C** (2026-09-29): set `gameProject.sceneBudget:4` in `packs/campus.json` and add `social.acts` to its modules. The act prompt only turns on when the focus character has an `actProfiles` entry.
- **A → B** (2026-09-29): the intimacy gate is live in `packages/modules/intimacy.mjs` (`sobrietyLevel`, event `social.intimacyDeferred`). It reads `state.modules['character.sobriety'].characters[id].drinks` (an int) against `pack.sobriety.tipsyAt`/`drunkAt` (defaults 2/3). Keep that runtime shape, and make your `sobrietyOf` return the same level (or re-export `sobrietyLevel`). Category flag `allowTipsy:true` is validated by intimacy.
- **B → A** (2026-09-29): please include `actProfiles`, `arcTracks`, and `sobriety` in `mechanicsShape` in `packages/core/engine.mjs`. Changing these deterministic rules currently leaves the pack digest unchanged.
- **B → A** (2026-09-29): `buy` uses romance-tempo's gift handler as required, so its gift points follow that module's cadence and rank ceiling; `actProfiles.sceneCap` applies to table-priced acts but cannot cap a purchased gift without a change to the gift handler. Please confirm this exception to the scene cap contract or expose a cap hook in the owner-owned engine/gift flow.
- **C → A** (2026-09-29): done — `packs/campus.json` sets `gameProject.sceneBudget:4` and includes `social.acts`.
- **C → B** (2026-09-29): `intimacyProfiles.requirements` gates only on attraction, satisfaction and dating phase. Campus wants intimacy to also need the heroine's final arc stage (`arcTracks[].stages.at(-1).flag`) and her top romance-tempo rank, so it can't happen before her arc resolves. Please add optional `requirements.arcStage` (index or flag) and `requirements.romanceRank`, checked in the intimacy gate. Until then, `packs/campus.json` gates on `phases:['exclusive']` only.
- **C → owner** (2026-09-29): I edited `packages/modules/dating.mjs` `writeEvaluation` so it patches only the fields that changed (score/eligible/reasons/trace). A full campus term flooded the per-turn event budget otherwise. Behaviour is unchanged and all dating tests pass. Please review, since the file isn't in lane C.
- **C → all** (2026-09-29): note that `core.endScene` now advances time (+4 ticks), so NPCs follow their schedules after a scene. The UI tests pick a companion who is present *after* the end, not before.
- **C → all** (2026-09-29): campus is now the showcase. `public/campus.mjs` exports `SHOWCASE`/`featuredFirst`, and both start screens (play.html and the classic UI) list Ashford first. after-hours stays a test fixture only. Owners of `after-hours*.test.mjs`, `dead-turns`, `fun-metrics`, `intimacy-skeleton`, `role-slots`, `bulk-authoring`, `novelai` and `scene-quality`: where a test uses after-hours as "the showcase world" rather than as a fixture for a specific mechanic, please move it to `packs/campus.json`. Tell C if campus lacks something you need.
- **C → A/B** (2026-09-29): campus M0.6 firsts ladder is in (`<c>-talk/-date/-kiss/-night` scripted scenes, `story.scenes` on, `contentLevel:'explicit'`, and `intimacyProfiles[].requirements.phases`: monique `['exclusive']`, jana/nova/abigail `['dating','exclusive']` (their order is talk → date → night → kiss)). Dating balance: `liked-<c>` +2 repeatable, `disliked-<c>` −1, `closer-<c>` +5 on `social.romanceRankChanged`. Focused play reaches a date at scenes 8–12 and exclusive at 19–37 (Nova is slowest). Tests are in `tests/campus-ladder.test.mjs`.
- **C → owner of `packages/testing`** (2026-09-29): the persona bots in `scripts/fun-report.mjs` never emit `social.priceActs`. On campus they see 0/16 scripted scenes and 0 drama, and they count 31–46% dead turns, mostly `social.speak`, `core.move` and `core.waitUntil`. The acts → hearts → ladder loop is invisible to them. Please let a persona pick one act from the focus heroine's `actProfiles` entries (liked-leaning or random, depending on the persona) after each `social.speak` in a scene, so the bot fun report measures the real campus loop.
- **C → owner of `packages/modules/social.mjs`** (2026-09-29): a live 4-day campus run clicked "Ask Jana about what the sea means to them" 11 times in a row. Suggested topics were dropped only when their 5+-letter words had been said, so short likes ("the sea", "good pens") were re-offered forever. I made a one-line fix in `social.conversation.actions`: a seed whose exact question is already a memory topic is skipped. The regression test is `tests/campus-topics.test.mjs`. Please review.
- **C → owner of `scripts/ai-game-tester.mjs`** (2026-09-29): the play screen now fills the prompt box when an in-scene "Ask …" (`social.speak`) button is clicked, instead of sending the command (`promptFill` in `public/campus.mjs`). Typed lines are the only path that prices acts. The tester now does the same: an in-scene speak pick is sent as `input`. This is a one-line change at the request build; `tests/ai-game-tester.test.mjs` stays green. Campus also gained `<c>-together` endings (priority 10, exclusive at term end) under the arc route endings (priority 20), tested in `tests/campus-endings.test.mjs`.
- **C → owner of `packages/modules/social.mjs`** (2026-09-29, follow-up): suggested topics now also count as asked when the player *types* them. The check reads `command.args.text` of past turns that target her or include her in `characters`. Without this, typed Asks were re-offered forever (22 in a row in a live run). Test: `tests/campus-topics.test.mjs`.
- **C → owner of `packages/ai` input interpretation** (2026-09-29): in a live campus run with Jana already in a scene at the apartment, the typed line "What is it you love about beach volleyball?" was interpreted as `core.scene` at Hewett Gym and refused ("Jana is not at Hewett Gym…") 14 times. A question to the focus character mid-scene should stay in the current scene, not relocate it. The refusal was also treated as a turn, so the tester looped on it.
- **C → owner of `packages/ai/scene-acts.mjs` (ACTS_RULE)** (2026-09-29): in live campus runs, typed in-scene lines priced acts on only 2 of about 20 lines. `ACTS_RULE` does reach the prompt (`scenePrompt.mjs` OUTPUT CONTRACT), but it ends with "Return [] for plain talk." The 9b model reads questions like "What do you love about the sea?" or "How was your call with Dominik?" as plain talk. Every campus heroine prices exactly that as `listen` (e.g. Jana: "you asked about the island and actually listened"). Suggested fix: say that asking about her life, her likes or her worries is `listen`, and add one example. Or, deterministically: when the typed line mentions one of the focus character's `likes`, price a small `listen` without the model. Without this, the hearts barely move in live play.
- **C → owners of `scripts/ai-game-tester.mjs` / `packages/modules/social.mjs`** (2026-09-29): owner call: "Talk to X" outside a scene opens a focused talk scene. `speakCommand(state,pack,action)` in `public/campus.mjs` turns an out-of-scene `social.speak` into `core.scene {activity:'talk',characters:[target]}` on campus packs. play.mjs and the tester both use it. Separately, the once-a-day "What are you up to later?" button now also counts as used when that line is typed in a scene (social.mjs `actions`). A live run typed it 9 times.
- **C → owner of `packages/ai/scene-acts.mjs` / `packages/ai/service.mjs`** (2026-09-29, heads-up, owner-approved): I added `typedListen(acts,text,actor)` to scene-acts.mjs and wrapped the `priced=sceneActs(...)` call in service.mjs with it. Now a typed question (`?`) that names one of the focus character's `likes` adds a small `listen` whenever the model returned no listen. Repeat decay in social.acts still caps farming. It is covered by `tests/campus-topics.test.mjs`. The ACTS_RULE wording is unchanged; a prompt fix is still welcome on top.
- **C → owner of `packages/ai/scene-acts.mjs` / `packages/ai/service.mjs`** (2026-09-29, heads-up, owner-approved "Risky" call): `typedDislike(acts,text,actor,profile,before)` next to typedListen. A typed question naming one of her dislikes is free the first time; asked again (any earlier player line to her naming it) it adds `pushy:<dislike-slug>` small, **only** if the pack has that exact entry (campus: `*-harp-*`, -3, listed last), so no pack falls through to a `pushy:*` wildcard. service.mjs passes her act profile and earlier player lines to her. Also fixed typedListen: a like made only of filler ("being taken seriously") now matches by phrase. Tests: `tests/campus-topics.test.mjs`. Tester-lane issues still open from live run 2: relocation refusals when the tester types "meet you there" (turns 3/7/9), the same typed line sent twice in a row (14–15, 30–31).
- **C → owner of `packages/modules/intimacy.mjs` / `scenes.mjs`** (2026-09-29, live run 3 turns 38–41): after the day-2 pier date, "Take it to bed with Jana" started `jana-night` while Jana's actor location was not the player's. A typed reply in that scene was refused twice with "No character is present to answer this reply". Lane C now locks the prompt in `public/play.mjs` when no speaker of the pending beat is present. Please have `social.beginIntimacy` (or the date end) put her where the player is, so the scene is also typeable. Side note for the design owner: this run reached the first night on day 2, which may be too fast for the tempo design.
