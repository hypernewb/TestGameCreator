# Module gap research — rivals, sandboxes, and engines (2026-10-01)

Status: **research only. Nothing decided, nothing built.** Feeds the O5 design card at [design/director-dm.md](../design/director-dm.md) and any future system briefs.

Method: enumerated our 28 registered modules from `packages/modules/*.mjs`, grepped the tree for terms covering the gaps below, then read reference wikis and engine docs. Every "we have it / we lack it" claim was checked against our source, not inferred from docs.

## Baseline: what we already have

28 modules, verified by id: `character.arc`, `character.sobriety`, `character.stats`, `items.equipment`, `items.inventory`, `powers.abilities`, `social.acts`, `social.bonds`, `social.dating`, `social.feed`, `social.firsts`, `social.gossip`, `social.intimacy`, `social.phone`, `social.progression`, `social.romance-network`, `social.romance-tempo`, `social.secrecy`, `social.touch-ladder`, `story.director`, `story.endings`, `story.facts`, `story.scenes`, `story.timed-events`, `world.calendar`, `world.daypart`, `world.minigames`, `world.moments`, `world.objects`.

That is a genuinely deep dating-sim core: multi-axis relationships, secrecy and suspicion, gossip propagation, an activity minigame layer, a director, endings, a calendar. The gaps below are mostly *sandbox and prose* gaps, not *dating-sim* gaps.

---

## Tier 1 — structural, cheap, high leverage

### 1. Character **aspects** (Wildermyth)

Wildermyth's data model is `Aspects`: named markers on an entity ("human", "missingLeftArm", "attractedToMen", "Inhabited") that can carry stat modifiers and effects. Almost everything dynamic is an aspect rather than a bespoke field. A special subcategory, **hooks** (personality flaws seeded at generation), gates quests.

We have the raw material — `social.firsts`, `character.arc`, `story.facts`, the `traits` list, the 28-trait catalogue from T-009 — but no unified queryable marker layer. Today a beat gate must name a specific system (`datingPhases`, `trust`, `plans`); with aspects, a beat could gate on "has been betrayed" or "was seen with a rival" without either system knowing about it.

This is the single most reusable idea in this document. It is the difference between N condition vocabularies and one.

- Wildermyth splits targets into **prime vs secondary** and **gameplay vs personality** stats. Our `relationshipDimensions` is already close to a secondary-stat system; the missing piece is personality stats being *used as targeting*, not just displayed.
- **Effects/Outcomes** are the universal verb: an effect has a trigger, a set of targets, and branching outcomes. Ours are scattered per-module.

### 2. Player-facing **history lines** (Wildermyth)

Every consequential thing that happens writes a line of player-facing text pinned to an entity — Wildermyth calls this a **History Line**, and it is the primary way permanent change is made and displayed. It combines with aspects, stat gains and hooks in one record.

We generate history lines *for the director and the inspector* (`story.scenes.history`, `turns`) but the player never reads a running record of "what happened to me." Our journal is discoveries-only by owner decision, which is correct for the deduction game — but that leaves a real gap: there is no narrative timeline.

This is cheap. We already have the events; nobody renders them as prose.

### 3. **Legacy / New Game Plus** (Wildermyth)

Wildermyth's Legacy is a persistent, cross-campaign store: heroes you promoted, equipment you unlocked, achievements, and "have you ever beaten X" facts that stories can query. Heroes you loved come back in later campaigns at a higher tier.

We have zero equivalent — `grep` for achievements/trophy finds nothing, and no module persists across campaigns. This is the standard roguelite NG+ layer and we don't have it at any tier. It is also the natural home for unlocks once the creator ships more than one world.

### 4. Ren'Py-grade **player-facing ergonomics**

We are a dating sim with an AI narrator, not a VN engine, but these are table stakes and we have none of them:

| Feature | Ren'Py | We have |
|---|---|---|
| Rollback (rewind and re-choose) | core | **no** — we have branch-from-checkpoint instead |
| Unlimited save slots | yes | backup/checkpoint system |
| Skip-read text | yes | no |
| Auto-advance / text speed | yes | no |
| Dialogue history log | yes | turn inspector only |
| Achievements | yes, Steam-synced | no |
| Image gallery / replay scenes | yes | gallery (F10) |
| Screenshots | yes | no |
| Separate voice / music / SFX volume | yes | **no audio at all** |
| Text scaling, contrast, reduced motion | yes | DESIGN.md lists as design intent, not built |

**Rollback is the interesting one.** Our save system is autosave-after-commit, which means a bad choice is a lost daypart. `NEXT-MILESTONES.md` has "Branch from here" but that's a checkpoint mechanic, not rewind-and-retry. For a game where consequences are the point, irreversibility is defensible — but we should be clear it's a choice, not an oversight, because players of any VN will try to scroll up and rewind.

**Audio is the elephant.** `grep` finds no audio module. Every mature VN has it; our target (adult dating sim) has CGs, gallery, expressions — all the art pipeline — and no sound. Given a local-model-first, asset-light, creator-driven design, audio is probably a deliberate scope exclusion, but it should be an explicit one.

### 5. **Turns-since / seen-content** queries (inkle ink)

Ink exposes `TURNS_SINCE(-> knot)`, `CHOICE_COUNT()` and "have you seen this" booleans as first-class author-facing queries. Wildermyth has the same idea with its 1/4-decay-per-seen event weighting.

We approximate this with flags and `maxUses`/`cooldownTicks` on beats, which works for director cards but cannot answer "how long since the player was last in this room" or "has the player ever seen this text." The director card explicitly wants a callback ledger (O5 step 3) — this is the general form of that need.

---

## Tier 2 — sandbox systems with no equivalent here

### 6. **Clothing / outfits**

Degrees of Lewdity runs 7–9 slots (over/outfit, top, bottom, under×3, legwear, shoes) with per-item traits, warmth, reveal level, integrity, wetness, and buyable upgrades. We have *outfit* as an AI authoring field (`character-authoring.mjs`, `character-sprites.mjs`) and poses/sprites in the asset pipeline — so clothing is a **presentation** concept for us, not a **systems** one.

The gameplay idea worth stealing is smaller than the wardrobe: **clothing as a modifiable state that changes outcomes**. Reveal level affecting who notices you, warmth affecting where you can go, a specific outfit being a remembered gift. That plugs into our existing `touch-ladder`, `secrecy` and `objects` systems rather than replacing them.

### 7. **Pregnancy / fertility** (DoL, and the whole genre)

DoL has three pregnancy modes (realistic / fetishised / silly), per-source sperm tracking with a 4–8 day lifespan, a fertile window driven by a cycle, and — the interesting part — **knowledge as a mechanic**: in realistic mode the player may not know they're pregnant, may not know the father, and can only find out via a test or by noticing a changed body.

`ADULT-GAME-DESIGN.md` mentions pregnancy only as "if later authored." For an adult dating sim where routes never close and consequences persist, this is a real content pillar that is entirely unbuilt. The knowledge mechanic is the interesting part and fits our engine's philosophy: state is authoritative, the player is not necessarily told.

### 8. **Needs / condition state** (Needy Streamer Overload, DoL)

NSO runs three emotional stats that *interact*: stress, affection, mental darkness. Sleep reduces two; drugs reduce stress and raise darkness; activities trade between them. Crucially:

- Stats have **visible tier bands with authored wording** at each threshold ("Please kill me" at 80+ stress).
- Some stats have **capacity that permanently grows** when you fail badly enough (stress cap 100 → 120 after two breakdowns).
- **Warning signs** shake and go red before a game-over.

We have `character.sobriety` and a mood line with hysteresis (per `owner-answers.md`) — that last part is genuinely NSO-shaped. What's missing is the **multi-axis trade-off**: a way for the player to relieve one axis by worsening another, with no dominant strategy. Our mood line is a readout, not a resource.

### 9. **Long-form campaign structure** (Wildermyth chapters, DDLC acts)

Two different and useful structures:
- **Wildermyth** splits a campaign into chapters with per-chapter limits (max 2 hook quests per chapter, spacing floors of 65–145 days). It paces by *scarcity of a resource* rather than by a global clock.
- **DDLC** restructures the *game itself* per act — each act is an independent playthrough with different rules, and the player cannot get moderate or major branches. The research is blunt: DDLC is "a vector with side branches and a maze," and the player never escapes the main branch.

We have `run` blocks with a hard day end (F3) and Wildermyth-style escalation. We do not have **acts with changed rules**, and that is a much stronger structural tool than a longer run — it's how a creator ships 30 minutes of distinct content without writing 30 minutes of new systems.

### 10. **Event decay by repetition across runs** (Wildermyth)

Each time an event fires it becomes 1/4 as likely in the next campaign, and the multipliers stack. Two straight campaigns means 1/16. This is anti-familiarity enforced by the *engine*, not by the author. Our `maxUses` and `recent` penalty do this within a run; nothing does it across runs.

---

## Tier 3 — presentation and polish

- **Tweeter-style double account** (NSO): the NPC posts about you publicly and privately, and the public/private gap *is* the gossip mechanic made visible. We have `social.feed` and `social.gossip` doing this in state; the player-facing rendering of "what she said about you when you weren't listening" is missing and would be cheap.
- **Public/private post asymmetry**: high value for our genre, since our whole premise is secrets.
- **Chat window with no choice** (NSO's JINE): sometimes the interaction is *responding to a message*, with no mechanical choice at all. Our `social.phone` has replies; making some contacts message-only, with nothing you can do but answer, would vary texture.
- **Director-sourced ambient dialog** (Wildermyth `npcDialogue`, our `social.npc`): we simulate off-screen NPC groups but a creator has to author dialogue by hand. A generated fallback would let groups talk in any world.
- **Text speed / auto-advance / skip**: pure UI, big comfort win, and cheap.
- **Achievements** (Ren'Py, Wildermyth Legacy): gives the player a reason to replay without touching game balance.

---

## What I'd actually propose, in order

Ranked by leverage per unit of work, not by how interesting they are.

1. **Aspects + history lines.** One marker layer beats N condition vocabularies. Everything else in Tier 1 composes with it. This is the foundation.
2. **Turns-since queries.** Small, unblocks the callback ledger O5 already needs, and generalises.
3. **Text speed / auto-advance / skip-read / history log.** Pure comfort, no design risk, players will expect it.
4. **Legacy / NG+.** Unlocks the multi-world creator story and gives replay a reason.
5. **Player-facing narrative timeline.** Renders events we already emit. Closes the loop on "the world has a mind."
6. **Knowledge-as-mechanic.** The one idea from Tier 2 that fits our engine's philosophy and needs no new system — state is authoritative, the player isn't told. Applies to pregnancy, gossip, and secrets alike.
7. **Needs with trade-offs.** Only after 1–6. It needs a real multi-axis design or it's a mood readout with extra steps.
8. **Acts with changed rules.** Big structural win for creators, big cost. Post-OGM.

**Explicitly not now:** audio (a whole asset pipeline and licensing surface), clothing as a wardrobe sim (presentation concept, not systems), pregnancy (large and consent-sensitive — needs an owner ruling, and per `AGENTS.md` never a worker guess).

---

## Questions for the owner

- **Q: Audio.** We have a full art pipeline and zero sound. Is that a deliberate scope exclusion or an oversight? A) Explicit exclusion, document it B) C) Minimal SFX + music loop, no voice
- **Q: Rollback.** Our autosave-after-commit means a bad choice is a lost daypart. Is irreversibility a design choice? A) Yes, keep it, but say so in the docs (Recommended) B) Add rewind-and-retry within a scene
- **Q: Aspect layer.** One unified queryable marker layer, replacing per-system condition vocabularies? A) Yes, and let beats gate on aspects (Recommended) B) No, keep conditions per-system and add aspects only for beats
- **Q: NG+ / Legacy.** Cross-campaign persistence? A) Yes, later, as part of the creator story (Recommended) B) No, each campaign is self-contained C) Only achievements, no carried state
