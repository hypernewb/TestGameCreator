# Module gap research, round two — deduction, memory, meta (2026-10-01)

Status: **research only.** Companion to [module-gaps-2026-10-01.md](module-gaps-2026-10-01.md). Audio ruled later-in-pipeline by the owner, so excluded below.

Round one covered aspects, history lines, legacy, VN ergonomics, turns-since, clothing, pregnancy, needs, acts, decay. This round goes after **deduction UX, AI memory architecture, and cross-run narrative** — the three areas where our design docs have named a goal but no mechanism.

---

## 1. Delayed batch confirmation (Return of the Obra Dinn)

This is the most directly applicable idea in either round, and it lands squarely on our unbuilt **likes puzzle** (`NEXT-MILESTONES.md` O6: "Hints only, never exact answers... The player can name 2+ likes per love interest from hints alone").

### The problem it solves

Every dating sim with hidden preferences faces the same trap: the moment you confirm a correct guess, the deduction dies. Let the player brute-force, and the game becomes a lottery. Never confirm, and the player has no evidence their reasoning worked, so it feels arbitrary.

Obra Dinn's answer is the **rule of three**: a fates are only validated in batches of three. Get three right, the game confirms all three at once. The consequences are elegant:

- **Immediate confirmation is gone**, so brute force by spam fails — you cannot cycle through a list one entry at a time.
- **The player still gets feedback**, and in fact gets *more*, because unconfirmed-but-entered entries are now known-wrong. A triple confirmation implicitly invalidates everything else you guessed.
- **The player lives with the answer.** You committed before you knew, which makes the judgment feel like a judgment.
- It scales: two wrong and one right, or one wrong and two right, and the batch never confirms, so you keep thinking.

The academic framing ([diva-portal](https://uu.diva-portal.org/smash/get/diva2:2077985/ATTACHMENT01.pdf)) calls it "cumulative confirmation" — the game shifts authority from *per-entry* to *per-batch*, which is what stops the input method leaking the answer.

### The critique, honestly

The same researchers document the exploit: late in the game, when the unsolved pool is small, the guardrails thin out and players *do* brute force by cycling. The design concedes the endgame rather than solving it. Worth knowing before we copy it — a small endgame pool plus batch confirm is exactly where a player feels cheated.

### What we'd take

Our likes puzzle has a natural triple: three characters, or three preferences on one character. Rules I'd propose:

- A preference deduction is **only** confirmed when three are correct together.
- A wrong-but-entered entry is **marked wrong only once a batch confirms**, never earlier.
- The player sees their own hypotheses held pending — Obra Dinn's logbook deliberately shows blurred faces and typed-but-unconfirmed entries. Ours would show the player's guess as a guess.
- **Clamp the endgame**: cap the number of unconfirmed candidate preferences per character. If the pool is exhausted, the character reveals. Never let a 2-candidate pool be brute-forceable.

That last rule is ours, not Obra Dinn's, and it fixes the exploit they conceded.

---

## 2. Activation vocabulary, not tuning constants (SillyTavern World Info)

There's a [memory architecture atlas](https://neoneye.github.io/agent-memory-atlas/systems/sillytavern/) entry that reaches a conclusion worth taking seriously: *"The most transferable thing here for a builder of automatic systems is the activation vocabulary. Sticky, cooldown, delay, negative keys and bounded recursion are answers to problems that extraction-based systems also have and mostly express as tuning constants, if at all."*

We already have most of this vocabulary — `cooldownTicks`, `maxUses`, `minTick`, `when` conditions, `repeatable`. What we're **missing** is:

| Feature | What it does | We have |
|---|---|---|
| **Sticky** | fired entry stays in context for N messages | no |
| **Cooldown** | fired entry is silent for N messages after | yes, per-beat |
| **Delay** | entry won't fire until N messages in | ~`minTick`, in ticks not turns |
| **Negative keys** | fire only when X present **and Y absent** | no |
| **Bounded recursion** | entry A can pull in entry B, capped at N | no, and we deliberately said "creator-declared links only" |
| **Minimum-activation pass** | widen the scan when too little fired | no |
| **Order / insertion position** | later in prompt = more influence | LODs, different concern |

Two of these are genuinely ours to take now:

**Sticky.** This is the missing half of the callback ledger. A beat fires at a boundary; the *next* scene's prompt should still know about it. A sticky window keyed to the beat, expiring after N turns, is exactly right — and it's one integer, not a new subsystem.

**Negative keys.** We hard-restricted recursion ("only creator-declared links, no automatic recursion") per `owner-answers.md`. But negative keys are orthogonal to recursion — they're about *when not to fire*, and we have a live use: **a jealousy beat should not fire when the player is already in a confrontation scene about exactly that.** Today the gate is "is a scene pending", which is cruder than "is a scene pending *about this*".

**The atlas also flags a real hazard we share.** SillyTavern's lorebook is a prompt-injection surface with a distribution channel: entries are downloaded from strangers and fire on keyword match, with `@@activate` bypassing keys entirely. Our packs are creator-published and reviewed, so we're safer — but `public/studio.mjs` accepts imported projects, and our lore context runs before generation. Any aspect/lore layer we add inherits this. Worth a validation rule when we build it.

---

## 3. Cross-run narrative that isn't NG+ (Hades)

Hades is the strongest answer to a problem we don't know we have yet. The roguelite structure is repetition; narrative is progression; putting them together normally makes players skip the story.

Supergiant's answer has three parts, and only the third is the one usually cited:

1. **Death is diegetic.** You come home, everyone has an opinion about your failure. Death becomes a scene, not a reset.
2. **Dialogue is a tagged deck, not a script.** Each character has a large pool of lines, each tagged with conditions: what you carried, who you last spoke to, *how you died*, how many runs, what you already heard. The game queues the most contextually specific unfired line and burns it. The write-up's claim is that this gives ~40–50 non-repeating runs. The mechanism is mundane: they wrote a lot of cards and dealt them intelligently.
3. **Relationship is the reward, not a stat.** Nectar is scarce and found mid-run; gifting it is the *only* way to unlock a character's story. Keepsakes mechanically reflect who gave them — Achilles' keepsake is a last-second save, mirroring his refusal to accept an ordinary death. You cannot optimise without also deepening a bond.

The uncomfortable part for us: Hades writes 20,000+ voiced lines and admits the unglamorous work is the volume. We have an AI narrator, which is precisely the resource that makes this cheap for us — the *tension* is the tagged conditioning, not the writing. And we'd need the same `director-as-dm` groundwork: a callback ledger reading `story.scenes.history` is the minimum viable version of "what did you do last time."

**What to take now, cheap:** Hades' *conditioning tags* are a spec for our `callback` field in O5 step 3. Instead of "who, what, daypart, choice", the useful tags are the ones a DM would use: *how the last scene ended, which promise is still open, what you gave her, what she gave you, how long since you spoke.* That's a better answer to "what should the director say tonight" than tension numbers.

**What to take later:** Nectar. A scarce, found-in-play, spend-only-on-relationship currency. We have money (`world.economy`) and no reason to spend it on intimacy. A second currency that *only* buys story is a cheap way to make affection feel earned rather than accumulated.

**What to skip:** God Mode's "keep getting stronger so the story unlocks." That serves a roguelite's power fantasy. Our runs are 30–45 minutes with real endings, and a difficulty assist that erases stakes is wrong for the genre.

---

## 4. Pre-generated history as texture (Dwarf Fortress)

Toady's quote is the most useful sentence I've read about world generation: *"Procedurally generating stories by recording a log of a simulation is a valid enough approach, though it has drawbacks. It's a lot of work, you need to do post-processing or investigation to find any good moments you'd like to highlight, and if you don't have enough dynamics and mechanisms, the output can be boring."*

That last clause is the warning. DF generates 250 years of dynasties, wars and artifact lineages before you play, and **the player must go hunting for the good bits** in Legends mode. The pre-history is texture for the curious, not plot for the player.

Where this applies to us, carefully: the owner's fantasy is a **world that was there before the player** (Venus's hidden NPC schedules, off-screen lives). A cheap version — a handful of generated off-screen events at campaign start, about characters the player may never meet, discoverable by asking or by gossip — would add texture for free and could feed `social.npc`'s pair history.

But DF is explicit that the world *continues* to simulate during play, and that a *point* on the map progressing while unseen is dramatically better than watching it. Our "off-screen" NPCs are coarse (`npc-social.mjs` settles pairs per slot). This is a Tier-2 idea with a real cost and a real failure mode.

**The steal is smaller than the system:** DF's *expedition* pattern. Send someone away, they become a point, and you learn the outcome on return. We have no travel-away mechanic at all, and it's a natural fit for a date sim — a weekend away, a trip home, a week at a conference. It converts time passing into consequence without a scene.

---

## 5. Two things this round changed my mind about

**On the likes puzzle.** I previously thought hints-not-answers was enough. Batch confirmation says the *verification* needs as much design as the hints. A puzzle with excellent hints and immediate confirmation is still brute-forceable. O6 as written under-specifies the hard part.

**On the memory architecture.** I'd been treating "AI memory ledger job" as a data-retention problem. The SillyTavern entry reframes it: the vocabulary of *when to fire and when to stay silent* is the actual intellectual content, and we already have most of it. Our unbuilt piece is sticky and negative keys, not a bigger store.

---

## Revised proposal order

1. **Aspects + history lines** (unchanged — everything composes)
2. **Batch confirmation for the likes puzzle** (moved up — it's the difference between a real puzzle and a lottery, and it specifies O6)
3. **Callback tags, Hades-style** (amends O5 step 3 — conditions beat strings)
4. **Sticky + negative keys** on the lore layer (two integers, big robustness win)
5. **Turns-since queries** (unchanged)
6. **Text speed / skip / history log** (unchanged, pure comfort)
7. **Legacy / NG+** (unchanged)
8. **Nectar-style relationship currency** (new — cheap, makes affection earned)
9. **Player-facing timeline** (unchanged)
10. **Expeditions** (new — time-passing as consequence; also the cheapest SFW intimacy escalation we don't have)
11. **Pre-generated off-screen history** (new — texture only, and only after 1–10)

---

## Questions for the owner

- **Q: Batch confirmation for likes.** Confirm a deduction only when three are right together? A) Yes — and clamp the endgame candidate pool so small pools can't be brute-forced (Recommended) B) Yes, plain batch of three, accept the endgame exploit C) No, confirm immediately, keep the puzzle easy
- **Q: Relationship currency.** A second scarce currency that only buys story — the Hades Nectar idea? A) Yes, and it should also be spendable on unlocks (Recommended) B) No, fold it into existing money C) No, one currency only
- **Q: Expeditions.** Time-away-as-consequence — weekend trips, week-long absences? A) Yes, a strong SFW escalation path we lack (Recommended) B) Only as a date-scene variant, no separate mechanic
