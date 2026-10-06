# Why conversation still feels boring: diagnosis and plan (2026-10-06)

Status: research and proposal, written after the owner's 2026-10-06 Semester1 playtest. The owner's verdict was that conversation "still feels like shit" and chatting is boring next to Venus University (VU), even after the conversation fixes. This doc does not authorize implementation, dispatch or merges. It follows the director workflow: Claude plans, writes briefs and reviews; workers implement in worktrees; merges need the owner's OK. Evidence limits are in §2.

Related: [T-conversation-workflow report](../briefs/T-conversation-workflow.report.md), [current roadmap](../NEXT-MILESTONES.md#current-direction-owner-clarification-2026-10-04), [board](../briefs/BOARD.md#current-priority-2026-10-04), [T-098 creator gap assessment](creator-gap-assessment-2026-10-04.md), [player-delivery research](player-delivery.report.md).

## Revision 2026-10-06b: owner answers and the revised plan (supersedes §7 items 1, 3, 4, 6, 9, 10; §8 order; §10; §11 D3/D4)

The owner answered after the first version. A second chat, **on a restarted 4317** (new build live), still "feels so off", and local generation is too slow even for casual chat. So the stale build explains the first session, not the feeling: the causes in §3 stand, and the T-conversation-workflow fixes alone don't fix it.

### Owner answers (2026-10-06)

| Topic | Owner position | Plan consequence |
|---|---|---|
| Puppeting | Likes the narration deciding the player's reactions | Allowed. The narration may write the player's reactions and the action they asked for. Decisions that change state (accepting an invitation, consent, promises, travel, spending) stay the player's and the engine's. |
| Stat colouring | "If your charm sucks your flirt sucks; weak fitness, the touch is less effective." Asked: can't we just send "You answer awkwardly: …"? | **Yes, that's the design.** Before the call, the engine picks a delivery verdict from the relevant stat and sends one line, e.g. "Your delivery this turn: Charm 2, fumbled. Write the player's actual flirt as a clumsy line, then she reacts to that." The same verdict scales the act's reward, so the text and the hearts agree. **D4 is reversed:** stats colour delivery. The fix is concrete written lines instead of vague "awkwardness", non-floor starting stats, and visible growth. → T-109 |
| VU prose and exits | Loves VU's overwritten prose; its exits are good | The default narrator persona is lush and VU-like (a pack option; "lean" is available). NPC exits with a hook are allowed and honoured. → T-108 |
| Random encounters | "GREAT" | Keep them, and add more later (CQ6). Not a VU flaw. |
| PROHIBITED_CONTENT | A Gemini Flash issue | Not a VU flaw. |
| Tics | Every character should have a distinct way of speaking | Each character gets a speech profile. The check is that **no two characters share a tic**, not that tics are absent. VU's flaw is shared tics, not tics. → T-108, T-113 |
| Slow burn and routes | Fast escalation is fine, but VU routes are samey. Slow burn can be rewarding for *some* characters. Routes should differ, with different unlock conditions. Asked for a route GUI like other VN creators. | A Route Map editor (a per-character graph of stages, gates, firsts, goal steps and events) with route archetype presets: fast burn, slow burn, goal-first, trust-first, push-pull, rival. A sameness check across the cast. It absorbs P4. → T-111 |
| NPC agenda | A goal she wants to achieve that you help with; a quest-marker feel is fine. Right now there are no goals at all. | Character goals: multi-step quests on the sheet, raised in her voice, tracked with a marker, gating route stages. Builds on `wants.mjs` (weekly wishes) and the conditions schema. → T-110 |
| Feedback | VU's visual flash in chat when you do something she likes, and a summary at the end | Reaction flash on the line, plus a scene-end summary card. These replace the ledger lines. → T-112 |
| Depth | Generated character and world depth is too low | Confirmed. → T-113 |
| Test harness | Wants to chat with one character from start to finish without playing the game | Character Chat Lab. This replaces CQ0 as the first deliverable. → T-107 |
| Local speed | Casual chat takes far too long locally. Log: `common_fit_params: failed to fit params to free device memory: n_gpu_layers already set by user to 999999, abort` | Likely, though unverified: GPU offload is forced to max, so llama.cpp skipped its memory check, and a 27B model with a 16k context spills out of VRAM into shared memory. Prompt reading is the other cost (streaming already exists). Owner side: lower the offload or context, or use a smaller quant; judge fun on cloud. Our side: put the prompt's stable prefix first so the KV cache is reused, and measure time-to-first-token in the Lab. → T-107, T-114 |

### Revised §7 (VU lacking)

- **Dropped as flaws:** puppeting (3), prose (6, overwritten half), random encounters (9), PROHIBITED_CONTENT (10).
- **Reframed:**
  - Tics (1): the flaw is that heroines *share* tics and surrender phrasing.
  - Uniform escalation (4): the flaw is that every route has the same shape and gates. Slow burn for some characters is the goal.
- **The rest stand:** continuity, persistence, fiction vs gates, the hidden action box, play-god memory, duplicate reasons, call count, one world.

### Revised plan and briefs

| Brief | What | Wave | Depends on |
|---|---|---|---|
| [T-107](../briefs/T-107.md) | Character Chat Lab: chat with one character from stranger to the last stage (lab time controls, stage jump, stat sliders, live state, latency, build stamp), plus a headless scripted-arc runner with transcripts and metrics | A | — |
| [T-108](../briefs/T-108.md) | Scene voice: lush narrator persona, speech profiles, interview rules removed, NPC exits honoured, new modes on during firsts, prop tracker reads dialogue | B | T-conversation-workflow reviewed and landed |
| [T-109](../briefs/T-109.md) | Delivery verdict: stat-coloured player actions written out; the verdict scales the reward; starting stats are not all floor | B (after T-108) | T-108 |
| [T-110](../briefs/T-110.md) | Character goals (quests) with steps, marker, raised in her voice, and gating stages | A | — |
| [T-111](../briefs/T-111.md) | Route Map editor with archetype presets and a sameness check (absorbs P4) | A | — (reads T-110 goals once landed) |
| [T-112](../briefs/T-112.md) | Reaction flash and scene-end summary card; ledger cleanup | B | T-conversation-workflow landed |
| [T-113](../briefs/T-113.md) | Generated depth for characters and worlds, with an "Enrich" action for existing projects | C | T-108/T-110/T-111 schemas |
| [T-114](../briefs/T-114.md) | Context hygiene and speed: memory intent instead of raw commands, no JSON blocks, location sanity, stable prompt prefix | A | — |

**Order:**
1. **Wave A** can be dispatched in parallel now (disjoint files): T-107, T-110, T-111 and T-114.
2. **Wave B** waits for the uncommitted T-conversation-workflow patch (scenePrompt, service, beats, play, vn, turn-presentation) to be reviewed and committed. The owner must OK that merge.
3. **Wave C** comes after the schemas.
4. **Later:** CQ6 (more random encounters, walk-ins, two heroines) and the CQ7 items (FACTS line, inventory for inventions).

**Measurement.** Every Wave B and C change is run through the Chat Lab's headless runner (mock for plumbing; local and cloud only with the owner's OK) before the owner plays. The owner judges fun in the Lab on cloud first, then in the full game.

**Decisions:**
- D1 answered: local LM Studio for both sessions.
- D3 answered: yes; briefs written.
- D4 answered: stats colour delivery.
- D2 is still open; the default is parallel with P1–P3, with P4 folded into T-111.

## TL;DR

Three causes, in order of weight.

**1. Selma had nothing to say, and the prompt forbade her to find anything.**
- The generated Semester1 cast is thin. Selma has no goal, traits, backstory, topics or secrets.
- The pack lacks 27 top-level keys that the campus pack has, including outreach texts, wants, gossip, scene feedback and like clues.
- With no `goal`, the initiative injector never fires (`packages/ai/service.mjs:138`), and the opening lead falls back to "greet the player their own way" (`packages/ai/beats.mjs:81`).
- Meanwhile the prompt says "never invent news, letters, secrets, relationships or past events". In the same prompt it asks that "at least one character acts on their own plan". She has no plan in the prompt.
- So the model had one safe topic, her job, and stayed on it for five turns.
- Campus depth (C1: voice, goals, initiative) shipped as hand-written campus content, not as generator output. This playtest was therefore the first human check of C1 in a world that has no C1.

**2. The conversation fix wasn't running, and where it would run, it switches itself off.**
- The 4317 server started at 03:55, the fix files changed at 11:06–11:13, and the backend has no hot reload.
- The played t0/t1 prompts still contain PLAYER DELIVERY and "aim questions at them". The new code removes both on these turns.
- Even after a restart, the new conversational mode requires `!context.first`, and calm continuation requires that no first be active. A first became ready after the second input, so 3 of the 5 turns would still run the old prompt.

**3. The prompt demands an interview and forbids a scene.**
- Every NPC line must "aim questions at them" and end "waiting on the reply".
- NPCs may "never announce plans to leave", yet the pack says they "leave when they have somewhere to be".
- The player's flirt may never be written ("Do not invent player dialogue…"), although the owner decided the model completes the player's action.
- Every recast is coloured by `Charm: Awkward (2)`.

What that produced:
- Selma ends 4 of 5 replies on a question, and 3 of those are "A or B?" binaries.
- She makes 0 moves of her own.
- Three flirt commands produced zero lines of the player flirting.
- 3 of 5 recasts make the player awkward or hesitant.

VU heroines ask questions just as often (17/19 replies), but only 2/19 replies end on one. VU replies end on what she feels, wants or does, or on an accusation.

**On top of that, the mechanics leak into the scene.**
- After one hand-touch, a 14-line ledger exposed hidden Chemistry three times.
- It spliced an after-hours rain paragraph into a Monday-morning scene.
- A kiss she froze at was answered with "took that in stride" and "Action completed."

**Why VU still wins.** In VU's loop everyone may author: narrator, heroine and director all invent freely. In ours, nobody may. The engine supplies little and the prompt bans invention.

**Why VU still loses.** Continuity, verbal tics (71% of heroine lines carry um/uh/filler "like"), puppeting the player, uniform escalation, no persistence, one world, no creator. We already lead on all of these, so the job is to add generative supply without giving up the lead.

**The plan.**
1. CQ0 makes the build visible and builds a blind replay A/B.
2. The A/B decides whether CQ1 (generative prompt) or CQ5 (depth parity) goes first.
3. Then CQ2 (NPC agenda) and CQ3 (scene shape), with CQ4 (hygiene) in parallel.
4. Then CQ6 (multi-NPC) and CQ7 (beat VU).

Every item ships as a pack option with a Studio control and passes the non-campus guard (T-076).

How the track maps to the creator gates:
- CQ5 belongs to G1/G2 (P3/P4).
- CQ2's promises and CQ4's memory hygiene belong to G3.
- CQ0 is G5 evidence tooling.

The metrics in this doc are diagnostic alarms. Per G5, "arbitrary percentages do not prove fun". The gates are a blind owner pick, then an owner session, then the 1–2h fun gate.

## 1. What was played

| Turn | Input | Prompt path | How Selma's reply ends | Ledger after it |
|---|---|---|---|---|
| t0 | Go talk to selma | full framework + PLAYER DELIVERY | a binary question: night sky, or "just a job"? | 5 lines |
| t1 | Touch her hand while you flirt with her | full framework + PLAYER DELIVERY | a binary question: the quiet or the loud parts of the universe? | 14 lines |
| t2 | flirt with her a bit more | full framework + FIRST MOMENT + "Stay in this moment" | a statement: "…we're both in trouble." (a question mid-reply) | 1 line + "Action completed." |
| t3 | Tell me more about your worries, im here to listen | same as t2 | a question: how do you handle it? | 2 lines + first checkpoint |
| t4 | Flirt with her then kiss her softly on the lips | same as t2 | the first's authored cue, verbatim: the plan, or the person? | 2 lines + "Action completed." |

Session facts:
- Campaign `426adae7-b1f6-45f6-8ebc-d6b91e744861`, played 2026-10-06 11:27–11:40.
- Player "Ari Kesler". Pack `the-counsellors-semester-d0a64e8e` (published `e7bed17c-…`).
- Provider label "Configured model"; context window 8192 at t0, then 16384.
- No retries, fallbacks, over-budget or truncation.
- 6 calls for 5 turns; 15,677 prompt tokens and 3,226 completion tokens.

**Sentence by sentence, the prose is fine.** At t4 Selma freezes, covers her mouth, flushes and says the kiss was "very forward. And very nice, actually". That is a decent beat.

**The failure is that nothing moves from turn to turn.**
- One topic for five turns: Hubble filters, then old light, a steam metaphor, the nebula, "the data is lying to me", and finally "a nebula that is currently mocking me".
- The same props recur: the bracelet (t0, t3, t4 and the t1 ledger), cold tea (t2–t4), filters and chip (t0–t2).
- She never makes a move of her own.

## 2. Evidence limits

- **One session, five turns, one heroine, a generated pack.** The model is unknown. The label is "Configured model", and the 8192/16384 windows suggest a local or strict-tier provider rather than the cloud tier the owner normally plays on. D1 asks which it was.
- **Mechanisms, not weights.** I can see prompt text and code paths but not how much each contributes. The ranking below is a hypothesis until the CQ0 replay A/B tests it.
- **The new build has never been played.** The T-conversation-workflow report itself says its fixture responses are "not evidence that dialogue is enjoyable".
- **VU is not a like-for-like comparison.** Its content is hand-authored and it uses 2+ model calls per action. Its Livvie opening is an established sexual relationship, so only Gwen, Florentine and Ingrid are fair comparisons for an early-stage Selma. The VU log's reply blocks sometimes span scene boundaries, so its counts are approximate (±1–2).
- **The ledger and emitter tables come from grep.** An emitter that builds a key dynamically could be missed.
- **Liveness is unknown for dff6301 (04:27) and 1e8e6c8 (06:09).** Both were committed after 4317 started, and no scene-facing prompt string distinguishes them.
- VU text is paraphrased here, never quoted. Our own game's text is quoted.

## 3. Ranked causes

Each cause lists evidence, mechanism, confidence, a counter-check that could falsify it, and the plan phase that fixes it.

### 3.1 Nothing to say: a bare cast, and a prompt stricter than the owner's design

**Evidence**

Selma's whole card:
- 29, an astrophysics lecturer.
- Likes research questions and quiet company; dislikes family plans and being interrupted.
- A constellation bracelet.
- Voice: "careful sentences that crack into delight".
- 4 reactions.
- No `goal`, `traits`, `backstory`, `conversationStarters`, `style` or poses.

The pack around her:
- Campus heroines (Jana, Monique, Nova, Abigail, Kaylee) each have a goal, 5 traits and 3–4 conversation starters, about 1–1.9k characters of card each.
- Semester1 lacks 27 top-level keys that campus uses (Appendix F). At least 8 of those keys, plus the per-heroine `conversationStarters`, have no emitter in the creator path (Appendix G).
- The 112 scripted scenes and 40 phone messages are all locked behind `story.directorDealt`, and there are 0 moments.

The initiative injector (`service.mjs:138–139`) filters the cast on `a.goal`, so it never fires for Selma. The opening lead at `beats.mjs:81` falls back to "greet the player their own way".

The played prompt bans supply…
- "never invent news, letters, secrets, relationships or past events that the prompt does not give"
- "never invent shared history between characters"
- "no entrances, departures, surprise visitors or location changes unless committed outcomes record them"

…and then asks for exactly that:
- "INITIATIVE: at least one character acts on their own plan"
- "they speak in character, pursuing their own goal" (the t0 opening task)

The owner's freedom interview (2026-09-30) allows the model to invent places, items and **plot threads**, meaning player goals, promises, plans and NPC-driven hooks, as long as they persist. It forbids only new NPCs and free character facts. The prompt is stricter than the design.

**Mechanism.** The model has no supplied material and is banned from making any, so it uses the only safe material in the prompt (her job) and paraphrases it every turn.

**Confidence.** High that this is the largest single factor. Medium on how the blame splits between the bans and the missing supply.

**Counter-check.** Run the campus Jana pack (full depth) under the same as-played prompt.
- If Jana is just as static, the prompt dominates.
- If she isn't, content dominates.

CQ0 runs exactly this.

**Fix.** CQ5 (depth parity and emitters), CQ1 (replace bans with supply), CQ2 (daily wants).

### 3.2 The fix wasn't live, and it turns itself off during firsts

**Evidence**

- **Timeline.** 4317 (pid 94840) started at 03:55:56. The fix files were modified at 11:06–11:13 and the playtest ran 11:27–11:40. The backend keeps its imported modules until restarted; the fix report says so itself.
- **The played prompts are the old code.** t0 and t1 are non-first turns in a `conversationStyle:'continuous'` pack. On the new code they would take `liveLength` and drop PLAYER DELIVERY (`vendor/venus/scenePrompt.mjs:79`, `:90`). Both played prompts contain PLAYER DELIVERY and "aim questions at them" (Appendix B).
- **The new gating.** Conversational mode requires `!context.first` (`scenePrompt.mjs:79`). Calm requires `!world.modules['social.firsts']?.active` (`service.mjs:125`). A first ("A Constellation in the Office Light") was active from t2, so t2–t4 run the old full framework even on the new build.
- **No build identity.** `promptVersion` is the static `scene_structured_v1`, and `packages/ai/context.mjs:132` stamps a static `'0.8'`. Nothing in a saved turn says which code produced it.

**Mechanism.** The owner played the old prompt and judged it as "after all the fixes". After a restart, the part of the game where romance happens (firsts) still runs the old prompt.

**Confidence.** Certain that t0/t1 ran old code. Certain that the gating behaves as written.

**Counter-check.** Restart 4317 and replay the same five inputs; t0/t1 should then lose DELIVERY and t2–t4 should keep it.

**Fix.** CQ0 (build stamp and stale-server banner). CQ1 (remove the `!context.first` gate; run firsts conversationally, with the checkpoint as intent).

### 3.3 Interview mode: every reply hands the turn back with a question

**Evidence.** The played contract says every NPC line "addresses the player — react to how they said it, answer in the authored voice, pursue the beat direction, aim questions at them — and ends still in the conversation, waiting on the reply". Five sources push questions:

- (a) that contract;
- (b) `MOVES.ask` (`beats.mjs:8`): "ask the player one specific question back";
- (c) the first's cue, injected verbatim, which Selma spoke word for word at t4, right after a kiss;
- (d) the PRIVATE FIRST MOMENT check-in, `waitingFor: tease/flirt/listen`. The engine needs a qualifying player input, so the model hands the turn back;
- (e) no goal: without a want of her own, a question is the only move left.

**The corrected metric.** Asking isn't the problem; VU heroines ask a question in 17/19 replies (89%). Ending on one is:

| | Ours | VU |
|---|---|---|
| Replies ending on a question | 4/5 (80%) | 2/19 (11%), both rhetorical tags |
| Of those, "A or B?" binaries | 3 | 0 |

A binary is homework for the player. The other VU replies end on her feeling or desire (7), narrated action (5), her move (1, locking a door), an accusation (1), a thank-you (1), or narration that puppets the player (2).

**Mechanism.** A question ending hands the whole burden of the next beat to the player. Five in a row is an interview, and since she never does anything, nothing changes.

**Risk of the fix.** If we only delete the question rules, calm continuation may swing to passive: answers with no agenda. So CQ1 pairs "end on her move" with CQ2's supply.

**Confidence.** High.

**Counter-check.** Remove the question rules alone in the replay. If replies get flatter rather than livelier, supply was the real problem.

**Fix.** CQ1: remove "aim questions" and "waiting on the reply". New craft rule: end on her move, feeling, want or decision more often than on a question, and a question is optional. CQ2 supplies the wants.

### 3.4 NPCs may not leave, so scenes have no shape

**Evidence.** Four rules contradict each other, and one owner decision is unimplemented.

| Source | What it says |
|---|---|
| Pack guidance (`packages/cards/beat-library.mjs:47`, copied into Semester1 `gameProject.ai.scene`) | characters "leave when they have somewhere to be" |
| Prompt (`scenePrompt.mjs:82–83`) | "never announce plans to leave, never open by saying you were about to leave, never walk out mid-beat" |
| Prompt (`scenePrompt.mjs:88`) | no departures "unless committed outcomes record them" |
| Engine (`service.mjs:321–322`) | in a continuous pack a scene ends only through `core.endScene`; the model's `sceneEnded` is ignored |
| Director (`packages/modules/director.mjs:191`) | records only the **player's** farewell via `LEAVING`; no NPC leave signal exists anywhere |
| Owner decision (2026-10-01) | she cues, then leaves after 1–2 turns, with no penalty unless the player was rude |

The engine's only exits are budget or annoyance lines (`packages/core/engine.mjs:72`: "has had enough for now and leaves", "Time is up. … says goodbye"). Those are not dramatized exits with a hook.

**Mechanism.** With no exit, a scene has no shape and no reason to make the moment count. It becomes an endless Q&A in one room. VU scenes have a premise, 3–6 exchanges, an exit and a hook.

**Confidence.** High that the contradiction exists. Medium on how much it hurts within five turns; it hurts more over a whole day.

**Fix.** CQ3: a beat clock, an NPC-initiated leave signal the engine honours, and an exit with a hook. CQ1 removes the contradictory rules, and the pack's guidance wins (creators own rules).

### 3.5 The player's fantasy is refused

**Evidence**

- **The ban.** "Do not invent player dialogue, gestures, touching, travel, feelings, thoughts, motives, memories, decisions…", enforced by the PLAYER_INTERIOR lint (`packages/ai/narration-lint.mjs:32`, used at `packages/ai/untrusted-output.mjs:103–107`).
- **Three flirt commands, zero player flirt lines.** The commands were "Touch her hand while you flirt with her", "flirt with her a bit more" and "Flirt with her then kiss her softly on the lips". The touch and the kiss were narrated as actions; the flirt itself never was. The narration only recasts indirectly ("your gaze holding hers just a fraction longer than polite office small talk usually allows"), and Selma reacts to a flirt the player never sees.
- **Awkward by default.**
  - The YOU line (`scenePrompt.mjs:128`) prints `Charm: Awkward (2)` in all five prompts.
  - Every new player starts at 2 on every stat (`packages/cards/world-structure.mjs:77`), which reads "Awkward / Slow / Soft / Scattered".
  - The t0 opening asks to "recast the submitted speech or action with slight stat-ranked delivery flavor", and PLAYER DELIVERY adds the low-Charm rule.
  - Recasts: t0 "the slight hesitation of someone still finding their footing"; t1 "a slight, awkward pause"; t2 "letting the awkwardness settle".
  - t2 had no DELIVERY block, so the YOU line and the earlier transcript alone carried it on.
- **Owner decision.** The model completes the player's action (venus-playtest preferences). The prompt contradicts it.
- **The DELIVERY research** (`player-delivery.report.md`, DeepSeek V4.1 Flash) shows a cloud model obeys the rule (awkward 2/2, recast 2/2). That proves the rule works as designed, not that the design is fun.

**Mechanism.** Free-text romance is wish fulfilment. When I type "flirt", I want to see a good flirt and her reaction to it. We show neither, and the awkward colouring makes the player a clumsy observer of their own scene.

VU narrates awkward moments too (after Gwen rebuffs a flirt, the narrator lets the awkwardness stretch). But there it is a consequence of what she did, not a permanent property of the player stamped on every turn.

**Confidence.** High.

**Where the line sits (embellishing vs puppeting).** Perform what the player asked for, in the tone they asked for: the flirt, the kiss, the listening. Never add decisions, consent, promises, travel or feelings beyond the request. The owner's word is *complete*, not *invent*.

**Fix.** CQ1 adds `gameProject.ai.playerVoice: 'perform'|'literal'`, defaulting to perform. D4 decides how stats colour the scene.

### 3.6 Mechanics contradict the fiction

**Evidence**

- **t1: 14 ledger lines after one hand-touch-and-flirt.**
  - Chemistry 12→14→19→21: a hidden stat, shown three times in one turn.
  - "Attraction … changed" ×3.
  - "A defining moment … is ready" and "A romantic possibility has opened".
  - "Familiar Face".
  - A spliced paragraph of after-hours rain inside a Monday-morning scene.
- **t0.** "liked that you let her finish without steering her", awarded for merely arriving, plus Chemistry 10→12.
- **t2 and t4.** "took that in stride" (neutral reaction text, `packages/modules/acts.mjs:28`) followed the t2 flirt. At t4 it came twice, right after she froze, covered her mouth and flushed at the kiss. On both turns the `social.scoreFirst` step then printed "Action completed.", the engine's generic fallback (`engine.mjs:417`; also `packages/testing/scenarios.mjs:101`).
- **Owner decision (2026-10-01).** Chips plus one mood line per heroine; hidden stats never shown; chips last until the next turn. Semester1 has no `sceneFeedback` key, so the verbose default ran.

**Mechanism.** Every mechanical line that contradicts the prose tells the player "this is a spreadsheet", and it lands right after the best moment.

**Confidence.** High, and this one is a plain bug against an existing owner decision.

**Fix.** CQ4.

### 3.7 Firsts take over the chat

**Evidence**
- The first became ready after t1's hand-touch flirt and was active from t2.
- From then on the prompt adds the PRIVATE FIRST MOMENT JSON, "Stay in this moment, don't skip past it…" (`service.mjs:146`), step 2/2, the authored cue and `waitingFor`.
- Selma speaks the cue verbatim at t4.
- The first is titled "A Constellation in the Office Light", but the scene state is the player's studio flat.
- Firsts also switch off the new conversational mode (§3.2).

**Mechanism.** The first turns the scene into a checkpoint-waiting machine: the model must hold the moment open and hand back the cue, so it cannot move on. It also became ready after only two inputs, before any rapport exists. Part of why VU's escalation feels earned is that there is scene before it.

**Confidence.** Medium-high.

**Fix.**
- CQ1: run firsts in conversational mode, with the checkpoint as intent, never verbatim.
- CQ3: a pack option for the minimum number of exchanges before a first can begin.

### 3.8 Garbage context

**Evidence** (the t4 prompt, 17,965 bytes)

- **Corrupted memories.** "Ari Kesler told Selma Aydın Go talk to selma" and "…Tell Ari Kesler more about Selma Aydın's worries…". `packages/ai/memory.mjs:36`/`:45` store meta-commands as speech and rewrite them in third person.
- **Raw JSON blocks.** The intimacy JSON (`scenePrompt.mjs:121`), npcLines (`:124`), PRIVATE FIRST MOMENT, and `stage: crush — {"active":null,…}`.
- **Location contradictions.**
  - The scene is "My Studio Flat: A one-room flat above a laundry", the player's home.
  - Selma's location is `my-studio-flat`. The generator placed her at the player's home, and the start location falls back to the first heroine's morning spot (`world-structure.mjs:64–65`).
  - Dilek is listed both as "not here (can be talked about, can't show up)" and as "AWAY: … My Studio Flat: Dilek Şahin", which is the room the scene is in.
  - The premise puts these meetings in "your office", but the scene ran in the player's studio flat. The pack's only office location is East Wing Offices, where Rebecca is listed.
  - The model followed the premise: "You push open the office door."
- **Daypart.** The spliced after-hours rain contradicts the morning, and it leaked into the narration: "The rain taps a steady rhythm against the windowpane" (t3), "the rain-streaked window" (t4). At t4 the kiss also happens "between your desks". The model followed the contaminated context over state.

**Mechanism.**
- Faced with contradictions, the model trusts the premise and ignores state.
- Corrupted memories teach it that the player speaks in commands rather than lines.
- JSON blocks spend attention on bookkeeping.

**Confidence.** Medium. Each item is real; together they add noise rather than causing the boredom directly.

**Fix.**
- CQ4: memory stores intents; prose instead of JSON; location sanity checks plus a Studio repair action.
- CQ7: a FACTS line with a post-check.

### 3.9 The motif tracker misses props in speech

`usedBeats` (`scenePrompt.mjs:74`) keeps only narration lines (`!l.speaker`): the first sentence, 12 words, last 6. It is used only in the continuation phase (`:130`). Props mentioned in her dialogue are never tracked, so the bracelet, the cold tea and the filters keep coming back.

**Confidence.** High. **Fix.** CQ1: a motif tracker over all lines, with a per-scene budget per prop or tell.

### 3.10 One overloaded call

**The load.** One call must interpret the input, adjudicate it (intimacy JSON), narrate in voice, satisfy dozens of rules, play a first's checkpoint and stay within budget. VU splits classifying from narrating.

**The constraint.** The owner's rule is one model call per normal turn, so keep it.

**What to move.** Whatever can be deterministic goes out of the call. A pre-scan of the input (flirt, kiss, touch, ask, leave) plus the touch ladder and consent can decide the escalation verdict before the call. The prompt can then say "this turn: she accepts a soft kiss, hesitantly" instead of asking the model to decide and narrate at once.

**Confidence.** Medium. **Fix.** CQ3.

### 3.11 Only one heroine in focus

- Only Selma was present.
- Dilek was listed as unable to show up.
- The chime (another NPC interjecting) runs every other turn but is switched off under calm (`beats.mjs`).

VU's liveliest stretches are triangulation: Gwen and Ingrid reacting to each other.

**Confidence.** Low-medium for this session. **Fix.** CQ6.

### 3.12 We measure plumbing

Tests check transport, gates, budgets and lints. The T-conversation-workflow acceptance was "three alternating typed exchanges" with fixture replies. Nothing measures whether a reply is interesting, or whether the build being played is the build that was fixed. **Fix.** CQ0.

## 4. Why the fixes kept failing

1. **The ban ratchet.** Each bad output added a "never", and no ban ever added supply.
   - The played system prompt is about 7k characters, and 41–44% of its sentences are restrictive by a crude regex. An earlier figure of "95% bans" was wrong.
   - The share isn't the problem. The bans contradict each other and nothing replaces what they remove.
2. **Tuned on local models.** Most bans were written to stop small local models from inventing. The cloud-loose rule makes style *lints* warn-only on cloud, but prompt *bans* ship to cloud unchanged.
3. **Mechanical acceptance.** "Three exchanges pass" was the bar, and it was met. Nobody owned "is it interesting".
4. **No gold transcript.** There is no reference for what a good Semester1 scene reads like, so no fix could be measured against one.
5. **The fix wasn't live and nobody could tell.** There is no build stamp and no stale-server warning.
6. **Depth shipped for campus only.** The C1 work (voice, initiative, goals) landed as campus content, not as generator emitters. Creator worlds never got it, which goes against the T-076 creator rule.
7. **The firsts gate.** The fix was scoped to non-first turns, and firsts are where romance happens.

## 5. The deeper why

- **A. Defensive, not generative.** The architecture is built to stop a model from breaking state. That part works: our continuity beats VU's. But nothing was ever built to make the model *bring* something to the scene.
- **B. Bans without supply.** A "never invent X" is safe only when the engine supplies X. We ban news, secrets, history and arrivals, and supply none of them in Semester1.
- **C. Authorship denied.** VU lets everyone author; we let nobody. The sweet spot:
  - the engine owns the truth;
  - the writer authors colour, moves and the player's stated intent;
  - each NPC pursues a supplied agenda;
  - the director adds at most one complication per scene;
  - inventions persist as threads, or they didn't happen.
- **D. Mechanics shown, not dramatized.** We print the spreadsheet beside the prose instead of letting her react.
- **E. Thin content.** Generated worlds get a card and a list; campus got a person.
- **F. No scene shape.** No premise, no complication, no exit, no hook.
- **G. Garbage in.** Corrupted memories, JSON blocks and contradictory locations.
- **H. Tests measure plumbing.** Transport and gates are tested; fun is not.

## 6. What to take from VU

Everything below is paraphrased from the owner's VU log (`C:\Users\ckx19\VU playtest.txt`, 19 inputs, 75 heroine lines) and the vendored VU style prompt (`vendor/venus/venusStylePrompt.mjs`).

| # | VU strength | How we'd do it (deterministic, as pack options) |
|---|---|---|
| 1 | Mid-activity premises: she's already doing something when the scene opens (shopping, a shift, a meal) | `scenePremise` from routine × location × time (CQ3) |
| 2 | She acts every reply and usually ends on her own move, feeling or want | craft rule plus supplied wants (CQ1, CQ2) |
| 3 | Meta-commands are performed: "flirt with her" becomes an actual flirt | `playerVoice: 'perform'` (CQ1) |
| 4 | The recast carries a physical beat, not a judgement of the player | recast describes the body, never stat rank (CQ1, D4) |
| 5 | Signature tells and motifs, although VU overuses them | tells on the card with a per-scene budget (CQ5, CQ1) |
| 6 | Yes-and on the player's claims ("I dreamt about you" gets built on) | claims about the player's own inner life are accepted; claims rewriting shared history are checked against facts (CQ7) |
| 7 | Likes hinted, never stated | existing like clues; Semester1 lacks `likeClueSettings` (CQ5) |
| 8 | Invitations with conditions | promise/calendar entries (CQ2, CQ7) |
| 9 | Jobs and shifts give scenes a setting and dares | routine premises (CQ3) |
| 10 | Triangulation: two heroines react to each other | walk-ins, `changeNpcAttraction`, chime (CQ6) |
| 11 | Scene shape: a few exchanges, an exit and a hook | beat clock (CQ3) |
| 12 | An energetic narrator persona | `gameProject.ai.persona` (CQ1) |
| 13 | Classify, then narrate | a deterministic pre-scan inside our one call (CQ3) |

## 7. Where VU is lacking

> Revised by the owner on 2026-10-06b (see the revision section at the top). Puppeting, the overwritten prose, random encounters and PROHIBITED_CONTENT are not flaws. Tics and escalation are reframed as sameness across characters.

1. **Verbal tics.**
   - um/uh/filler "like" appear in 71% of heroine lines (53/75 strict; 83% by a crude count that includes the verb).
   - The source is an explicit filler-words instruction in the vendored style prompt (`venusStylePrompt.mjs:18`).
   - Gwen clicks her tongue 7 times in one session.
   - Different heroines share the same surrender phrasing.
   - The narrator picks up fillers too.
2. **Continuity.**
   - A 3 a.m. scene that clashes with the gala timeline.
   - Exam details drift.
   - A condition she set is forgotten.
   - A day-1 NPC references a lecture that never happened (`docs/research/venus-university/findings.md:46`).
3. **Puppeting.** Narration decides the player's reactions and choices without being asked (two of 19 reply endings).
4. **Uniform escalation.** Every heroine escalates at about the same pace whatever the relationship. The style prompt asks for slow burn; the runtime doesn't deliver it.
5. **Inventions don't persist.** Items appear in the fiction with no inventory behind them.
6. **Purple prose and formulaic exits.**
7. **Fiction and gates out of sync.** The text says one thing while hearts and gates say another.
8. **Hidden action box** (findings `:39`).
9. **Random encounters override the player's plans** (`:47`).
10. **Raw `PROHIBITED_CONTENT` errors** shown to the player (`:48`).
11. **The edit-memories dialog** (`:49`). The owner rejected this as "playing god".
12. **Duplicate reasons** (`docs/research/venus-university/playtest-transcript.md:82`).
13. **2+ model calls per action**, costing latency and money.
14. **One world, no creator.**

Where we are already ahead:
- a creator and many worlds;
- deterministic state with clamped inventions;
- a consent engine;
- one call per turn;
- memory with knowers;
- no god-mode memory editor;
- local-first.

The plan must add supply **without** giving up these leads. That is why every invention persists, every rule is a pack option, and the FACTS line is in CQ7.

## 8. The plan: CQ0–CQ7

Every item:
- is a pack option with a Studio control;
- passes the T-076 non-campus guard;
- comes with tests;
- is measured on the CQ0 replay before the owner sees it.

Each phase is gated in this order: a blind replay pick, then a 30–60 min owner session on cloud, and finally the 1–2h fun gate.

### CQ0 (S): make it live and measurable

**Stale-build check**
- On bootstrap, compare the server start time with the mtimes of `packages/**` and `vendor/venus/**`.
- `/api/bootstrap` returns `stale:true`.
- Play and Studio then show a banner: the engine code changed since this server started; restart to play the new build.

**Build stamp**
- Every turn records `build:{sha, dirty, promptHash}`, where `promptHash` hashes the prompt-module sources.
- Diagnostics show it.
- The static `promptVersion` / `'0.8'` stay for compatibility only.

**Replay A/B harness**
- A script reusing `packages/testing/prompt-ab.mjs`, `packages/testing/fun-metrics.mjs` and the arms in `scripts/prompt-ab.mjs`.
- Uses a temp-dir DB via `createApp({dataPath})`.
- Provider comes from `REPLAY_*` environment variables, or LM Studio by default. It never reads `data/ai-settings.json`.
- Prompt arms:
  - *as-played* (reconstructed from the 03:55 HEAD);
  - *calm* (the current build);
  - *venus* (the vendored style prompt);
  - *lively* (the CQ1 draft).
- Content arms:
  - Semester1 as-is;
  - Semester1 with an enriched Selma (a hand-written goal, 5 topics, one secret with knowers, one tell);
  - campus Jana (full C1 depth).
- Inputs: the owner's five, plus a standard set for the non-campus guard.
- Design: partial factorial, about 40 calls.
  - All four prompt arms × Semester1 × 5 inputs.
  - Enriched Selma and Jana × {as-played, lively} × 5 inputs.
- Output: a blind, shuffled HTML page (labels A/B/C…), a separate answer-key file, and the warn-only metrics from Appendix D.

**Decision rule**
- Content arms separate more than prompt arms → CQ5 first.
- Prompt arms separate more → CQ1 first.
- Neither → the bottleneck is the model or config, and D1 matters most.

**Acceptance**
- A stale server shows the banner.
- Every saved turn names its build.
- One command produces the blind page.

**Gate mapping.** G5 evidence tooling. Not itself a fun gate.

### CQ1 (M): a generative prompt

**Add**
- `gameProject.ai.persona`, the narrator persona. It is a Studio text field: the template default is an energetic romance-novelist voice; a blank pack gets a neutral one.
- A positive craft block of at most 10 lines:
  - open on her doing something;
  - react to *how* it was said;
  - make one move of her own: a want, a tease, a confession, a decision or a physical action;
  - end on her move, feeling or decision more often than on a question;
  - give one concrete sensory detail;
  - vary props.
- Hard rules of at most 8 lines, truth only: state, facts, cast, consent, the touch ladder, no new NPCs, no rewriting the player's decisions, and no new shared history unless it is persisted.
- `gameProject.ai.playerVoice: 'perform'|'literal'`, defaulting to perform.
  - Perform writes the player's requested line or act in the player's tone, so a flirt is a flirt.
  - It still never adds decisions, consent, promises, travel or feelings.
  - In perform mode the PLAYER_INTERIOR lint exempts the performed request only.
- A motif tracker over all lines, including NPC speech, with a per-scene budget.
- Tiering: strict on local (lints stay hard on loopback), lean on cloud (fewer words).

**Remove**
- the entry quotas (5–7 and 6–9);
- "aim questions at them" and "waiting on the reply";
- the contradictory departure rules (replaced by CQ3's exit semantics);
- the forced `ask` move (kept as one move among many, weighted down);
- rank words in the YOU line (pending D4);
- the `!context.first` gate.

**Acceptance on the replay** (diagnostic alarms, not proof of fun)
- Question endings ≤40%, against VU's 11% and our 80%.
- NPC move in ≥60% of replies.
- 0 awkward recasts at starting stats.
- Every flirt input produces a player flirt line.
- Prompt tokens no higher than as-played.

**Gate.** The owner picks the lively arm in at least 3 of 5 blind comparisons against as-played.

**Gate mapping.** Persona and playerVoice are Studio controls (G2).

### CQ2 (L): NPC agenda

- **TODAY WANTS.** At most one per NPC per day. Sources:
  - the card's goal;
  - director templates (the 40%);
  - scripted scenes and texts behind `story.directorDealt`;
  - routines and likes;
  - invented wants (the 60%), allowed only if persisted as a thread with knowers, per the freedom interview.
- **Outcomes.**
  - Accepted: becomes a promise or calendar entry.
  - Declined: remembered, and it shapes her next want. No penalty unless the player was rude.
- **An in-chat director move.** At most one complication per scene (`directorProfile.inChat`): a text arrives, someone passes by, she gets called away.
- **Topic rotation.** Each NPC has a topic list. When the current topic is spent, the prompt names one fresh topic.
- **Options.** `gameProject.ai.dailyWants`, `directorProfile.inChat`.
- **Acceptance.**
  - Diagnostics: at least 3 topics per 5 turns; NPC-move rate up.
  - Required: a want accepted in chat appears in the calendar or promises, and keeping or missing it selects an authored follow-up. This is the G3 "kept/missed promise selects authored follow-up" criterion and the P4 promise-condition slice.

### CQ3 (M): scene shape

- **Premise.** Routine × location × time gives "she's in the middle of X".
- **Beat clock** (`gameProject.scenePacing`). Establish (1–2 exchanges), then a complication (1), then an exit offer with a hook.
- **Leaving.**
  - She signals that she is leaving, then leaves 1–2 turns later (owner decision), unless the player gives her a reason to stay.
  - Staying is paid in clock time (freedom interview).
- **NPC-initiated leave.** A structured `npcLeaving` field the engine settles like `core.endScene`.
- **`minExchangesBeforeFirst`.** A pack option, so a first can't become ready after only two inputs.
- **Pre-call escalation verdict.** A deterministic pre-scan of verbs, plus the touch ladder and consent, decides whether she accepts, hesitates or declines before the call (§3.10).
- **`goodbyeEndsDay`.** Check its interaction with NPC exits.
- **Acceptance.**
  - Replayed scenes end with an exit and a hook.
  - No first starts before N exchanges.
  - The pacing options work on a non-campus pack.
- **Gate mapping.** G2 (visual rules), P4.

### CQ4 (S–M, in parallel): hygiene

- **Scene feedback.** Make the default `sceneFeedback` chips plus a mood line (owner decision): hidden stats never shown, deduped, at most 3 lines per turn.
  - This is feedback policy, not the paused Game UI visual redesign.
  - Still flag it to the owner before dispatch.
- **No "Action completed."** in player-facing text (`engine.mjs:417`, `scenarios.mjs:101`).
- **No "took … in stride"** when the narrated reaction is strong; reaction strength comes from the escalation verdict.
- **No spliced paragraphs** across dayparts. Act tags need evidence (no "let her finish" for arriving).
- **Memory stores intents** ("Ari asked Selma about her worries"), not commands rewritten as speech (`memory.mjs:36`, `:45`).
- **Prompt cleanup.** Prose instead of JSON; one stage label.
- **Location sanity.**
  - An NPC can't be AWAY at the scene's own location.
  - A heroine's default location can't be the player's private home unless authored.
  - When the premise names a workplace, the start scene and the relevant heroines' daytime spots use that location.
  - Studio gets a "repair locations" action.
- **Acceptance.**
  - The t1 replay prints at most 3 ledger lines.
  - No hidden stat names in player-facing text.
  - No contradictory location lines in the prompt.
- **Gate mapping.** G3 diagnostics, G4 player usability.

### CQ5 (L, creator critical path): depth parity

- **Emitters for every campus-depth field:**
  - goal, traits, backstory;
  - 5+ conversation starters and topics;
  - style, voice moods, tells with a budget, motif;
  - humour and flirt style;
  - boundaries (hard to earn, never "never");
  - secrets with knowers.
- **System emitters:** `likeClueSettings`, `outreachMessages`, `wantSettings`, `gossipRules`, `sceneFeedback`, `socialPacing`, `unwelcomeFlirt`, `dayRecap` (Appendix G).
- **Cast diversity check.** No two heroines share a tell, voice or flirt style.
- **"Enrich cast."** Suggest drafts card fields from three words. The owner delegates sheet content, with a veto table.
- **Studio controls** for every field.
- **Parity guard test.** A generated world's actor and system keys must include campus's, minus fields explicitly marked campus-only (in the style of T-076).
- **Gate mapping.** G1 (template composition, P3), G2.

### CQ6: multi-NPC

- Walk-ins when the director commits them.
- Triangulation via `changeNpcAttraction` (`packages/modules/romance-network.mjs:13`).
- Gossip rules.
- A chime option (`gameProject.ai.chime`: off, or every N turns), no longer switched off by calm.

### CQ7: beat VU where it's weak

- **A FACTS line.** At most 8 truths the reply must not contradict, plus a post-check.
- **Repetition and filler lints.** Warn on cloud, hard on local.
- **No puppeting.** The decision lint stays.
- **Saying no** per the freedom interview: explain why, offer the closest alternative, ask again.
- **Persistent hooks.** An invitation becomes a calendar entry; a missed one becomes a text (outreach).
- **Inventory** for invented items (clamped).
- **Memory inspect/correct** as a creator and debug tool (G3), never a player god-mode.

## 9. Self-grill

1. **Is it just the model?** Possibly in part (D1). But t0/t1 show the model obeying the prompt exactly: recasts, questions, awkwardness. A better model would obey it *better*. Swapping models is CQ0's "neither" branch.
2. **Content or prompt?** Both, and one session can't separate them. That's why CQ0 runs first and its decision rule picks the next phase.
3. **Won't removing bans make local models regress?** It may, so the tiering is strict on local and lean on cloud. Hard truth rules stay, and lints stay hard on loopback.
4. **Where does embellishing the player end and puppeting begin?** Perform the requested act in the requested tone. Never add decisions, consent, promises, travel or feelings. `playerVoice:'literal'` exists for packs that want the old behaviour.
5. **Won't agendas feel gamey ("Quest: help Selma")?** Wants are spoken in voice, one per day, optional; declining is remembered, not punished.
6. **Do exits contradict "routes never close"?** No. Leaving a scene isn't closing a route; she leaves with a hook (a text later, a place to find her).
7. **Novelty bias?** The owner may be comparing a fresh VU session with the tenth Semester1 one. The blind A/B controls for some of that, and the owner's verdict is the gate either way.
8. **Is a first after two inputs a bug?** It's content: the conditions were met. But pacing should be a creator option (CQ3), not a constant.
9. **Will all this bloat the prompt?** Persona, craft, wants and FACTS add words. Quotas, contradictory rules, JSON blocks and the duplicate recast instructions come out. The net must be at most the as-played size, and the replay checks it.
10. **Does this crowd out the creator priority?** CQ5 *is* creator work (G1/G2). CQ2's promises and CQ4's memory are G3, and CQ0/CQ1 are small. Recommended: run them in parallel worktrees with file sets disjoint from P1–P4. The owner decides (D2).
11. **Why should this work when the last fix didn't?** The last fix was never played, was gated off during firsts, and changed transport and length, not supply. This plan measures before shipping and goes after supply.
12. **What if no arm is fun?** Then the problem is deeper. Try cloud models (D1), richer authored content (VU's strength is hand-authored scenes), and move the 40/60 template/invention ratio toward more templates.
13. **Will calm become passive?** Without CQ2 it can: it answers the subject but has no agenda. Calm stays an A/B arm, not the default, until measured.
14. **Overfitting to five inputs?** The replay adds a standard input set across packs and keeps the non-campus guard.
15. **Is the ledger a design question?** No. It's a bug against the owner's own decision (chips plus mood line), so just fix it in CQ4, flagging the UI-redesign hold.
16. **Meta-commands?** "Go talk to selma" and "flirt with her" are intents, not speech. Memory must store them that way, and the narration should perform them as VU does.
17. **VU uses 2 calls; should we?** The owner's rule is one call. The pre-scan is deterministic, so we keep it to one.
18. **Could lints have made it bland?** No. There were no retries or fallbacks, so the blandness is first-draft output, not rejection damage.
19. **Was the "95% bans" claim right?** No. 41–44% of sentences are restrictive. The problem is contradiction and missing supply, not the ratio.
20. **Does removing DELIVERY reverse an owner-era decision?** It came from owner-era research (3483d4b, 2026-10-02). That research showed the rule *works* (awkward 2/2), not that it's *fun*, which is why it's D4 rather than a silent removal.
21. **Who wins on departures, the framework or the pack?** `gameProject.ai.scene` says NPCs leave when they have somewhere to be; the framework says never. Creators own rules, so the pack should win.
22. **Does the new build fix the awkward recasts?** No. Calm mode still prints `Charm: Awkward (2)`, so awkward recasts would continue after a restart unless D4 changes it.
23. **Is the prose bad?** No. Sentence-level quality is fine; the sequence is static.
24. **Are questions the problem?** No; ending on them is. VU asks as often and ends on them rarely.
25. **Is the VU comparison fair?** Livvie's scene is an established relationship, so compare Gwen, Florentine and Ingrid. The question-ending gap holds for those too.
26. **Does our prompt contradict the owner's decisions?** In two places. It forbids completing the player's action, and it forbids persisted plot threads the freedom interview allows.
27. **Do the CQ1 percentages prove fun?** No; G5 says they can't. They are alarms. The gate is the blind owner pick.
28. **Am I over-trusting one session?** Yes, that's this doc's main risk. CQ0 is cheap and exists to falsify it.

## 10. The plan from now on

1. **Owner:** answer D1–D4 (§11) and restart 4317 the usual way. Claude does not restart it.
2. **Claude:** write the briefs T-CQ0 (build stamp, stale banner, replay harness), T-CQ4a (ledger, feedback, memory and location hygiene) and T-CQ5 (depth-parity spec), following the director workflow.
3. **Dispatch** to workers in worktrees, in parallel with P1–P4 if D2 allows, with disjoint file sets:
   - CQ0: scripts, testing and bootstrap;
   - CQ4a: feedback, memory and acts;
   - CQ5: cards and the creator.
4. **Run the CQ0 replay.** The blind pick decides whether CQ1 or CQ5 goes first.
5. **Then CQ2/CQ3**, then an owner session, then CQ6/CQ7, then the fun gate.

Rules from now on:
- No playtest on a stale build; the banner makes this checkable.
- Every prompt change is measured on the replay before the owner sees it.
- Every feature is a pack option with a Studio control and passes the non-campus guard (T-076).
- No ban without supply: any new "never" comes with what to do instead.
- Fixture tests prove plumbing, never fun.
- Keep T-conversation-workflow's transport and UI fixes. Calm is an A/B arm, not a verdict.

## 11. Decisions

**Already decided** (no need to ask again):
- The model completes the player's action (venus-playtest preferences).
- Chips plus a mood line; hidden stats never shown (owner answers, 2026-10-01).
- She cues, then leaves after 1–2 turns (owner answers, 2026-10-01).
- Invented threads are allowed if they persist; no new NPCs (freedom interview, 2026-09-30).
- One model call per normal turn.
- Fun first.

**Open**

| # | Question | Default / recommendation |
|---|---|---|
| D1 | Which model or provider did you play on this session? | Assume local/strict tier (8192/16384 windows); CQ0 tests both tiers |
| D2 | Run the CQ track in parallel with P1–P4, after them, or before them? | Parallel, with disjoint files |
| D3 | Restart 4317 now and let Claude write the T-CQ0 / T-CQ4a / T-CQ5 briefs? | Yes |
| D4 | How should stats colour a scene? | Stats colour outcomes and NPC reactions, never the player's own delivery, with neutral starting labels. Alternatives: keep as is; make it a pack option defaulting off |

## Appendix A. Inputs, excerpts and metrics

**Our replies (Semester1, Selma, 5 turns)**

| Turn | Topic | Props | Recast flavour | Player line written? |
|---|---|---|---|---|
| t0 | Hubble spectral filters, old light | filters, bracelet | "slight hesitation of someone still finding their footing" | n/a (go talk) |
| t1 | steam metaphor; "you're paying attention… a little bit terrifying" | filters/chip | "a slight, awkward pause" | no (flirt) |
| t2 | specific attention; "is it a crime to want to talk about something…" | filter chip, cold tea, nebula | "letting the awkwardness settle" | no (flirt) |
| t3 | "the data is lying to me…", "guessing with very expensive equipment" | cold tea, bracelet, nebula | neutral | no (indirect recast) |
| t4 | the kiss: freezes, covers mouth, "very forward. And very nice, actually" | cold tea, bracelet, nebula | neutral | no (flirt); the kiss is narrated |

**VU vs ours**

| Metric | Ours (5 replies) | VU (19 replies, approximate) |
|---|---|---|
| Replies containing a heroine question | 5/5 (100%) | 17/19 (89%) |
| Replies ending on a question | 4/5 (80%) | 2/19 (11%), both rhetorical tags |
| … of which "A or B?" binaries | 3 | 0 |
| Replies ending on her feeling, desire, move or accusation | 1/5 (t2) | 9/19 |
| Replies ending on narrated action | 0/5 | 5/19 |
| Narration puppets the player at the end | 0/5 | 2/19 |
| Distinct topics across the replies | 1 (her research) | not comparable (player-driven) |
| Recurring tell or prop | bracelet ×3 replies, cold tea ×3, filters ×3 | Gwen's tongue-click ×7 |
| Heroine lines with um/uh/filler "like" | ~0 | 53/75 (71%) strict |
| Player flirt lines for flirt commands | 0/3 | flirt commands performed in the recast |

## Appendix B. Prompt anatomy markers (played prompts)

Y means the marker string is present in that turn's system and user prompt.

| Turn | DELIVERY | "aim questions" | pack "leave when…" | "never announce plans to leave" | "no entrances, departures" | "Do not invent player dialogue" | STAGING | INITIATIVE | VENUS STRUCTURE | FIRST MOMENT | "Stay in this moment" | "Charm: Awkward" | "briefly recast" | "never invent news" |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| t0 | Y | Y | Y | Y | Y | Y | Y | Y | – | – | – | Y | Y | Y |
| t1 | Y | Y | Y | Y | Y | Y | Y | Y | – | – | – | Y | Y | Y |
| t2 | – | Y | Y | Y | Y | Y | Y | Y | – | Y | Y | Y | Y | Y |
| t3 | – | Y | Y | Y | Y | Y | Y | Y | – | Y | Y | Y | Y | Y |
| t4 | – | Y | Y | Y | Y | Y | Y | Y | – | Y | Y | Y | Y | Y |

On the new build:
- t0 and t1 would drop DELIVERY, "aim questions", STAGING, INITIATIVE and the quotas (conversational mode).
- t2–t4 would stay as above, because a first is active.
- The YOU line stays on every turn.

**Context reports**

| Turn | Window | Used | Reply budget |
|---|---|---|---|
| t0 | 8192 | 2552 | 1639 |
| t1 | 16384 | 2819 | 1800 |
| t2 | 16384 | 2887 | 1800 |
| t3 | 16384 | 3244 | 1800 |
| t4 | 16384 | 3632 | 1136 |

The system prompt is about 6.9–7.1k characters, and 41–44% of its sentences are restrictive (crude regex).

## Appendix C. Symptom → source map

| Symptom | Source |
|---|---|
| Ends on questions | contract text (framework length, `vendor/venus/scenePrompt.mjs:82–83`); `MOVES.ask` (`packages/ai/beats.mjs:8`); first cue and `waitingFor` (PRIVATE FIRST MOMENT block) |
| No initiative | `packages/ai/service.mjs:138–139` (requires `goal`); `beats.mjs:81` (greet fallback) |
| Fix inactive in firsts | `scenePrompt.mjs:79` (`!context.first`); `service.mjs:125` (calm needs no active first) |
| Awkward recasts | `scenePrompt.mjs:128` (YOU line); `:84` (PLAYER DELIVERY); `packages/cards/world-structure.mjs:11`, `:77` (ranks, start value 2) |
| No player flirt lines | the player ban in the prompt; `packages/ai/narration-lint.mjs:32`; `packages/ai/untrusted-output.mjs:103–107` |
| No exits | `scenePrompt.mjs:82–83`, `:88`; `service.mjs:321–322`; `packages/modules/director.mjs:191`; vs `packages/cards/beat-library.mjs:47` |
| Props repeat | `scenePrompt.mjs:74` (narration only), `:130` (continuation only) |
| Ledger floods and hidden stats shown | no `sceneFeedback` in the pack; `packages/modules/acts.mjs:28` ("in stride"); `packages/core/engine.mjs:417` ("Action completed.") |
| Corrupted memories | `packages/ai/memory.mjs:36`, `:45` |
| Wrong location | `packages/cards/world-structure.mjs:64–65`; the generated pack places Selma and Dilek at `my-studio-flat` |
| No build identity | `packages/ai/context.mjs:132`; static `promptVersion` (`service.mjs:288` and neighbours) |
| Firsts take over | `service.mjs:146`; first cue injection |

## Appendix D. Fun proxies (diagnostic only)

Computed per reply by the replay harness, warn-only. None of them is a gate.

| Proxy | Definition | Alarm |
|---|---|---|
| Question-ending rate | the last NPC sentence ends in "?" | > 40% |
| Binary question | an ending question containing " or " | any repeat |
| Question rate | any NPC "?" | informational |
| NPC move | the reply contains a want, decision, tease, confession or physical action initiated by the NPC (rubric, model-graded or hand-tagged) | < 60% |
| Topics per 5 turns | distinct topic labels | < 3 |
| Prop repeats | the same noun phrase in 3+ replies of a scene | any |
| Meta-command as speech | memory or narration quotes a command as dialogue | any |
| Ledger lines per turn | player-facing mechanical lines | > 3 |
| Contradictions | state vs narration (location, daypart, presence) | any |
| Player voice | a flirt or ask command yields a performed player line (perform mode) | missing |
| Filler density | um/uh/filler "like" per NPC line | > 15% |
| Stat words in recast | rank names or awkwardness at starting stats | any (if D4 accepted) |

## Appendix E. Replay harness spec

- **CLI.** `node scripts/conversation-replay.mjs --pack <id|path> --inputs <file> --arms as-played,calm,venus,lively --content as-is,enriched,jana --out <dir>`.
- **Isolation.**
  - Temp-dir DB via `createApp({dataPath})`.
  - Packs copied, never written in place.
  - Never opens `data/ai-settings.json`.
  - Provider from `REPLAY_BASE_URL`, `REPLAY_MODEL` and `REPLAY_KEY`, else LM Studio `qwen/qwen3.8-27b`.
- **Arms.** Prompt arms are swapped in through the same seam `scripts/prompt-ab.mjs` uses. The as-played arm is reconstructed from the 03:55 HEAD prompt module.
- **Output.**
  - `blind.html`: shuffled per input, labelled A/B/C, with a pick control per input.
  - `key.json`: the answer key.
  - `metrics.json`: Appendix D.
  - `prompts/`: every system and user prompt, for audit.
- **Budget.** About 40 calls per run. Runs in the background, one live run at a time.

## Appendix F. Campus vs Semester1 depth

Per heroine:
- **Campus** (Jana, Monique, Nova, Abigail, Kaylee): a goal, 5 traits, 3–4 conversation starters, about 1.0–1.9k characters of card.
- **Semester1** (Selma, Dilek, Rebecca, Priya): no goal, no traits, no starters, no backstory, no style.

Top-level keys campus uses that Semester1 lacks (27):
- `subtitle`, `tickMinutes`, `sceneFeedback`, `slipGuard`, `dayRecap`
- `routeRepair`, `relationshipStageSettings`, `anniversarySettings`
- `giftRepeatScale`, `giftSettings`, `jealousySettings`, `jealousyProfiles`
- `wantSettings`, `dailyNeeds`, `unwelcomeFlirt`, `socialPacing`, `declinePenalty`
- `outreachSettings`, `outreachMessages`
- `suspicionSettings`, `suspicionProfiles`
- `gossipRules`, `reputation`, `lustBaseline`, `characterSheets`
- `likesOpen`, `likeClueSettings`

Other Semester1 facts:
- 16 firsts.
- 112 scripted scenes and 40 phone messages, all behind `story.directorDealt`.
- 0 moments.
- Director profile: quiet dayparts 1, max 2 per day, 2 opportunities per day, first tick 4, tone ceiling grounded, adaptive.
- 76 complications in 7 templates, all gated on trust. Obstacles: bad-day (trust 20, 36-tick cooldown), saw-you, rumor and showdown (two heroines at trust 20–30). Temptations: spark, late-text (evenings, 36-tick cooldown) and close-call (trust 15–35).

## Appendix G. Emitter grep (creator path)

| Field | Emitted somewhere | Notes |
|---|---|---|
| `goal`, `traits`, `backstory` | yes | not populated for Semester1's cast |
| `characterSheets`, `jealousyProfiles` | yes | absent from Semester1 |
| `conversationStarters` | no | |
| `outreachMessages` | no | |
| `wantSettings` | no | |
| `gossipRules` | no | |
| `sceneFeedback` | no | |
| `likeClueSettings` | no | |
| `socialPacing` | no | |
| `unwelcomeFlirt` | no | |
| `dayRecap` | no | |

The table is grep-based: a key built dynamically could be missed. CQ5's parity guard test replaces this with a real check.
