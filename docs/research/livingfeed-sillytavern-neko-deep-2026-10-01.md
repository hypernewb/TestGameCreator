# Deep Code-Specific Synthesis: LivingFeed, SillyTavern, Project N.E.K.O.

Status: **research only.** Companion to `agent-memory-atlas-2026-10-01.md` and `livingfeed-sillytavern-synthesis-2026-10-01.md`.

Sources: Agent Memory Atlas commit-pinned reports for [LivingFeed](https://neoneye.github.io/agent-memory-atlas/systems/livingfeed/) (`732d8bed`), [SillyTavern](https://neoneye.github.io/agent-memory-atlas/systems/sillytavern/) (`06bde939`), [Project N.E.K.O.](https://neoneye.github.io/agent-memory-atlas/systems/neko/) (`bcdd5c2f`).

This document maps each system's patterns to specific code locations in story-framework and proposes concrete changes.

---

## Part 1: LivingFeed — Memory as Tunable Physics

### 1.1 The Three-Layer Fabric vs Our Two Layers

**LivingFeed:**
| Layer | Store | Lifetime | Mutability |
|---|---|---|---|
| Working | Redis list per `(world_id, actor_id)` | 6-hour TTL, 50 entries | Append-only |
| Episodic | Event store (permanent) | Forever | Append-only |
| Semantic | Qdrant vector index | `decay_at` (1–30 days) | Points expire, never deleted |

**Ours:**
| Layer | Store | Lifetime | Mutability |
|---|---|---|---|
| Episodic | Committed turns (`state.turns`) | Forever | Append-only |
| Semantic | BM25 index (`retrieval.mjs`) | Forever | Rebuilt from turns |

We have the episodic layer. We lack the semantic layer's **decay**. Our lore entries don't expire — they just get ranked lower by BM25. LivingFeed's insight: **expiry should be a query predicate, not a sweeper**.

**Concrete gap:** `retrieval.mjs:30-33` — `loreIndex` builds a BM25 index from `pack.lorebook`. Entries are indexed once and never expire. There is no `decay_at` field, no query predicate for expiry.

**Proposed change:** Add an optional `decayAt` field to lore entries. In `bm25Score`, filter by `decayAt > now` before ranking. No sweeper, no background job.

### 1.2 Stored Composite Score Components

**LivingFeed:** Every consolidated memory stores `factors: {emotion, relationship, goal, rarity}` — all four components, not just the total. The schema describes this as *"the material for coefficient tuning (offline replay evaluation)."*

**Ours:** `director.mjs:49` — `bestOf` computes a single `score` from `weight + jitter - recentPenalty + scoreBonus`. The components are computed inline and discarded. When a beat is picked, we cannot inspect *why* other than reading the code.

**Concrete gap:** `director.mjs:49` — `bestOf` returns `{c, score, delivery}`. The `score` is a single number. The components that produced it (weight, jitter, recent penalty, score bonus, tone tilt, focus bonus) are lost.

**Proposed change:** Return `{c, score, delivery, components: {weight, jitter, recentPenalty, scoreBonus, toneTilt, focusBonus}}`. Store `components` on the beat record in `state.modules['story.director'].uses[pick.id]`. This turns "why did the director pick this beat?" from an argument into a regression.

### 1.3 The Deterministic Embedder

**LivingFeed:** Uses a deterministic hash n-gram vector at 256 dimensions, explicitly *"so that real similarity search works in dev/CI and replays reproduce."* Model embeddings are deferred behind the same interface.

**Ours:** `retrieval.mjs:15-19` — `bm25Index` is deterministic. `terms()` stems words and generates CJK bigrams. The index is built once per pack via `WeakMap` cache. This is already the right design.

**Validation:** Three independent sources (SillyTavern docs, LivingFeed, the atlas's cache-preserving injection pattern) all reach the same conclusion: **deterministic retrieval is not a compromise, it's a design property.** Our BM25 is correct. The gap is not the algorithm — it's the lack of expiry and the lack of component storage.

### 1.4 The Replay Verdict: Three Values, Not Two

**LivingFeed:** `verify_digest` compares the context digest recorded at a decision against one reassembled from the event log. `DigestVerdict` has three values: `MATCH`, `MISMATCH`, `UNVERIFIABLE`. The function **refuses to compare hashes at all across assembler versions**, because reporting a mismatch would make the entire past look divergent every time the assembler is fixed.

**Ours:** `fun-metrics.mjs` measures pacing outcomes (`trailingDrought`, `zeroBeatWindows`, `deadRatio`). When a metric regresses, we currently have no way to distinguish "the director logic changed" from "the measurement changed."

**Concrete gap:** No replay verification. When `fun-metrics` reports a regression, we cannot tell if it's a real regression or an artifact of the measurement changing.

**Proposed change:** Add a `verifyDigest` function to `fun-metrics.mjs` that compares the context digest recorded at a decision against one reassembled from the event log. Return `MATCH`, `MISMATCH`, or `UNVERIFIABLE`. This is the difference between "the director got worse" and "the measurement changed."

### 1.5 The Swallowed Failure

**LivingFeed:** `recall` wraps its Qdrant call in a bare `except Exception`, logs *"recall failed (bypassing with empty recall)"*, and returns `[]`. An unreachable index produces an actor with no memories rather than an error.

**Ours:** `director.mjs:95` — `adaptiveBeat` returns `false` when nothing is eligible. `story.starved` fires as a signal. The player sees nothing.

**Concrete gap:** `director.mjs:224` — `story.starved` fires with `{quiet, text}`. But the player never sees this. The O5 card already identifies this as a design gap: "starvation is loud but not useful."

**Proposed change:** When `story.starved` fires, surface it in the UI as "Nothing's going on today" — a visible abstention, not a silent one. This is a UI change, not an engine change.

### 1.6 The Recall Floor Below the Write Gate

**LivingFeed:** `RECALL_MIN_IMPORTANCE = 0.3` sits **below** the consolidation gate of `0.4`. Recall returns things the gate would not have admitted today. *"A threshold that moved should not orphan what it already wrote."*

**Ours:** `director.mjs:65-74` — `eligible` checks `used < maxUses`, `tick - last >= cooldownTicks`, `intensity <= tier`, `tone <= ceiling`. These are the same thresholds for both writing (dealing) and reading (eligibility). If we ever raise `maxUses` or `cooldownTicks`, we strand already-committed beats.

**Concrete gap:** No separation between write-gate and read-gate thresholds.

**Proposed change:** Add a separate `recallMaxUses` and `recallCooldownTicks` that are always >= the write-gate values. This ensures that raising the write gate never strands already-committed beats.

---

## Part 2: SillyTavern — Activation as a Timed State Machine

### 2.1 The Richest Activation Logic in the Atlas

**SillyTavern:** World Info is 6,408 lines of JavaScript with mechanisms no research system possesses:

| Mechanism | What it solves |
|---|---|
| Four logic modes (`AND_ANY`, `AND_ALL`, `NOT_ALL`, `NOT_ANY`) | "Relevant to X unless Y is also being discussed" |
| Sticky | Stay active for N messages after firing |
| Cooldown | Refuse to fire again for N messages |
| Delay | Refuse to fire until N messages into the chat |
| Recursive activation | Activated entries are themselves scanned for keys |
| Token budget + cap | Bound context as percentage and absolute |
| `MIN_ACTIVATIONS` pass | Widen scan depth when too little fired |
| `@@activate` / `@@dont_activate` | Force or suppress irrespective of keys |

**Ours:** `director.mjs:65-74` — `eligible` checks `maxUses`, `cooldownTicks`, `minTick`, `intensity`, `tone`, `when` conditions. This is a flat eligibility check, not a state machine.

### 2.2 Cooldown and Sticky: A Hysteresis Band

**SillyTavern:** Sticky keeps an entry active for N messages after firing. Cooldown suppresses it for N messages after sticky ends. Together they form a **hysteresis band** around activation. The state lives in `chat_metadata.timedWorldInfo`, which survives a reload.

**Ours:** `director.mjs:65-74` — `cooldownTicks` is flat. A beat that fired once is suppressed the same as a beat that fired five times. There is no "sticky" concept — a beat that just fired is immediately eligible for cooldown.

**Concrete gap:** `director-library.mjs:20-31` — beat templates have `maxUses` and `cooldownTicks` but no `stickyTurns` or `delayTurns`. The director has no way to say "this beat should stay eligible for 2 turns after firing, then be suppressed for 5."

**Proposed change:** Add `stickyTurns` and `delayTurns` to beat templates. In `eligible`, check:
- `stickyTurns`: if the beat fired within the last `stickyTurns` turns, it stays eligible (returns true)
- `delayTurns`: if the beat was armed within the last `delayTurns` turns, it is not eligible (returns false)
- `cooldownTicks`: after sticky ends, suppress for `cooldownTicks`

This prevents both repetition (cooldown) and dropped threads (sticky).

### 2.3 Negative Keys: "Must Not Surface When X"

**SillyTavern:** `NOT_ANY` and `NOT_ALL` let an entry declare conditions under which it must *not* fire. *"Almost every retrieval system in this atlas can only express similarity; this one can express 'relevant to X unless Y is also being discussed', per entry, authored by hand."*

**Ours:** `director-library.mjs:20-31` — beat templates have `when` (positive preconditions) but no `suppresses` (negative preconditions). A beat that requires "Mara is single" fires even if Mara is currently dating someone.

**Concrete gap:** `director.mjs:72` — `conditionReasons(c.when, tx.state, tx.pack).length` checks positive preconditions. There is no check for negative preconditions.

**Proposed change:** Add a `suppresses` field to beat templates. In `eligible`, check `conditionReasons(c.suppresses, tx.state, tx.pack).length === 0`. This is cheap, authorable, and expressible in no embedding model.

### 2.4 Recursion with a Bound and an Opt-In

**SillyTavern:** Activated content is rescanned for keys, so an entry about a city can pull in the entry about its ruler. `world_info_max_recursion_steps` bounds the cascade, and `delayUntilRecursion` lets an author mark an entry as reachable *only* through recursion.

**Ours:** `director-library.mjs:37-49` — `directorTemplates` bakes beat templates with role substitutions. But it's single-hop: a beat references a role, and that's it. There is no two-hop design where a beat references a role, and that role's lore entry pulls in related lore.

**Concrete gap:** No recursive activation. A beat about "Mara's confession" cannot automatically pull in "Mara's backstory" lore.

**Proposed change:** Add a `recursesTo` field to beat templates. When a beat fires, the engine also activates the referenced lore entries. Bound the recursion at 2 hops. This is how you get emergent narrative depth without an LLM call.

### 2.5 The Minimum-Activation Pass

**SillyTavern:** When too little fired, the system **widens its own scan depth** rather than returning nothing. *"A better failure mode than returning nothing, and it pairs naturally with a budget bounding the other end."*

**Ours:** `director.mjs:95` — `adaptiveBeat` returns `false` when nothing is eligible. `story.starved` fires. The player sees nothing.

**Concrete gap:** `director.mjs:91` — `adaptivePool` returns an empty array when nothing is eligible. `adaptiveBeat` returns `false`. There is no fallback ladder.

**Proposed change:** Implement a fallback ladder in `adaptiveBeat`:
1. Strict match (all conditions met)
2. Relaxed match (ignore `when` conditions)
3. Any eligible beat (ignore `maxUses` and `cooldownTicks`)
4. Visible abstention ("Nothing's going on today")

This is strictly better than returning `false` and firing `story.starved`.

### 2.6 The Interchange Format

**SillyTavern:** The lorebook JSON travelling inside character cards is why this design outlived its own application. *"A character card with an embedded lorebook carries its memory with it between applications."*

**Ours:** `director-library.mjs:19-32` — `DIRECTOR_LIBRARY` is a JavaScript array. A creator can't export a beat pack and share it. There is no JSON interchange format.

**Concrete gap:** No JSON interchange format for beats, roles, or lore.

**Proposed change:** Design a JSON beat pack format:
```json
{
  "beats": [
    {
      "id": "cafe-argument",
      "kind": "obstacle",
      "tone": 2,
      "roles": ["lead"],
      "gate": {"lead": 20},
      "suppresses": {"relationshipStatus": "dating"},
      "stickyTurns": 2,
      "cooldownTurns": 5,
      "maxUses": 3
    }
  ]
}
```

### 2.7 The Missing Tests

**SillyTavern:** *"Seven interacting mechanisms and no fixture asserting what fires is a regression surface, however well the manual experience has been tuned."* Two committed tests exist, but they assert that a rename retargets a binding, not that a chat and a lorebook produce an activation set.

**Ours:** `director-library.mjs` has 12 authored beat templates. `director.mjs` has `eligible` with 7 interacting conditions. Do we have a test that asserts which beats fire given a specific game state?

**Concrete gap:** No table-driven activation tests. If we change `eligible`, we cannot easily verify that the same beats fire.

**Proposed change:** Add `tests/director-activation.test.mjs` with table-driven tests:
```js
const cases = [
  { state: { mood: 'tense', relationshipStatus: 'single' }, expected: ['cafe-argument'] },
  { state: { mood: 'tense', relationshipStatus: 'dating' }, expected: [] },
  { state: { mood: 'calm', relationshipStatus: 'single' }, expected: ['coffee-chat'] }
];
```

---

## Part 3: Project N.E.K.O. — Memory That Must Not Reopen a Wound

### 3.1 Dual-Clock Evidence: Reinforcement ≠ Disputation

**N.E.K.O.:** `evidence_score(entry, now) = effective_reinforcement - effective_disputation`. Two separate counters on two separate decay clocks. `rein_last_signal_at` and `disp_last_signal_at` advance independently.

**Ours:** `romance-tempo.mjs` — `addPoints` modifies a single `trust` or `chemistry` scalar. When a player commits a faux pas, subtracting a flat 10 trust points turns an established girlfriend into an acquaintance.

**Concrete gap:** `romance-tempo.mjs` — single scalar. No separation between "long-term warmth" and "active friction."

**Proposed change:** Add `grievance` counter to `romance-tempo.mjs`. `effective_trust = trust - grievance`. `grievance` decays quickly (half-life of a few ticks). `trust` decays slowly or not at once rank rungs are locked. This lets the NPC act cold while still acknowledging the history.

### 3.2 The Hard Filter Before Every Ranker

**N.E.K.O.:** `MemoryRecallReranker._hard_filter` drops rows with `score < 0`, rows flagged `suppress`, terminal reflections, and protected persona. The recall tool path applies it **before ranking**, so a disputed entry is not scored, not fused, and not offered to a model that would weigh it.

**Ours:** `retrieval.mjs:22-27` — `bm25Score` returns `{score, matched}`. There is no hard filter. A lore entry is either in the index or it isn't.

**Concrete gap:** No hard filter. A lore entry that is "disputed by the player" cannot drop out of recall without being deleted.

**Proposed change:** Add a `disputed` flag to lore entries. In `bm25Score`, return `{score: 0, matched: []}` if `doc.disputed`. This is a third state between present and absent.

### 3.3 Ban-Topic Directives: The Closest Thing to a Tombstone

**N.E.K.O.:** When a user says "stop mentioning X," it stores an active directive with a repetition-scaled TTL: `min(3 days × hit_count, 30 days)`. The directive reaches the system prompt, the context cache, and the proactive chat gate.

**Ours:** `owner-answers.md` records rejected design approaches. But there's no mechanism to prevent a future AI worker from re-deriving one.

**Concrete gap:** No tombstone mechanism. A rejected design approach can be re-derived and presented as new.

**Proposed change:** Add a `tombstone` field to `owner-answers.md` entries. When a design approach is rejected, record it as `{value: "vector embeddings", status: "rejected", reason: "breaks cache and determinism"}`. A future worker checking the repo would see the tombstone and not re-derive the approach.

### 3.4 Anti-Repetition: BM25 Over the AI's Own Output

**N.E.K.O.:** `anti_repeat.py` maintains a per-character rolling BM25 corpus over recent **assistant** prose. *"The LLM tends to circle back to the same topic"* and SequenceMatcher similarity *"is useless against rephrased but still on the same topic."*

**Ours:** `narration-lint.mjs` checks for repeated phrases. But it's string matching, not topic matching.

**Concrete gap:** No topic-level repetition detection. An NPC can say "I love coffee" and then "Coffee is my favorite" and we wouldn't catch it.

**Proposed change:** Add a `BM25Corpus` over the last 15 assistant turns. Before displaying an NPC reply, compute similarity against the corpus. If similarity > 0.5, flag for re-sampling.

### 3.5 Speaker Trust as a Privilege Boundary

**N.E.K.O.:** `trust_store.py` holds a server-authoritative pool keyed by account id. `resolve_trust` returns a float or `None`. Three tests defend the attribution channel: `test_llm_output_cannot_spoof_speaker_provenance`, `test_message_body_cannot_forge_a_segment_boundary`, `test_speaker_label_cannot_forge_a_segment_boundary`.

**Ours:** `memory.mjs:14-32` — `classifyUtterance` classifies player utterances. But the LLM can hallucinate a quote. There is no verification that the quote exists in the transcript.

**Concrete gap:** No quote verification. The model can write "Mara said she hates me" when Mara was actually talking about someone else.

**Proposed change:** Add a `verifyQuote` function to `memory.mjs` that greps the quote against the turn's sanitized input/output transcript. If the quote is missing or misattributed, reject the candidate or downgrade it from a `fact` to an unverified `perception`.

### 3.6 The Event Log: Append-Only, Per-Character

**N.E.K.O.:** `event_log.py` — *"per-character append-only audit + replay log."* The views (`facts.json` / `reflections.json` / `persona.json`) are the only record of state transitions, so there is no ordered history.

**Ours:** `engine.mjs` is the sole mutation path. But we don't log mutations — we just apply them.

**Concrete gap:** No event log. We cannot replay a session and see exactly why the director made each decision.

**Proposed change:** Add an append-only event log to `engine.mjs`. Every mutation is logged before it is applied:
```js
function applyMutation(mutation) {
  eventLog.append({
    timestamp: now(),
    type: mutation.type,
    payload: mutation.payload,
    context: assembleContext()
  });
  state = mutation.apply(state);
}
```

### 3.7 Scope Before Ranking: A Security Property

**N.E.K.O.:** `hybrid_recall.py:1165` — *"Security boundary: scope filtering happens before any BM25/cosine/RRF"* — because filtering afterwards hides results rather than excluding them.

**Ours:** `retrieval.mjs:30-33` — `loreIndex` builds a BM25 index from `pack.lorebook`. The index is pack-scoped by construction (each pack has its own index). But within a pack, there is no scope filtering after ranking.

**Concrete gap:** `retrieval.mjs` — no scope filtering after ranking. If a pack has lore entries from multiple campaigns, they are all in the same index.

**Proposed change:** Add a `campaign` field to lore entries. In `bm25Score`, filter by `doc.campaign === currentCampaign` before ranking. This is a security property and a correctness property.

---

## Part 4: Cross-System Patterns

### 4.1 The Three Systems Form a Complete Stack

| Concern | LivingFeed | SillyTavern | N.E.K.O. | We Have | We Need |
|---|---|---|---|---|---|
| **Scoring** | Stored components | — | Dual-clock evidence | Opaque scalars | Component storage |
| **Activation** | Importance gate | Sticky/cooldown/delay | Hard filter | `maxUses`/`cooldownTicks` | Hysteresis band |
| **Negative conditions** | — | `NOT_ANY`/`NOT_ALL` | Dispute filter | None | `suppresses` field |
| **Repetition** | — | Cooldown | BM25 over output | String matching | Topic matching |
| **Provenance** | `source_event_ids` | — | Speaker trust | None | Event log |
| **Forgetting** | `decay_at` predicate | — | Archive shards | None | Query predicate |
| **Interchange** | — | Lorebook JSON | — | None | Beat pack JSON |
| **Testing** | 429 tests | 2 tests (weak) | 17,479 tests | 805 tests | Negative assertions |

### 4.2 The Shared Insight: Retrieval Is a State Machine

All three systems treat retrieval as a **state machine with memory**, not a stateless query:

- **LivingFeed**: importance → decay → expiry (temporal state)
- **SillyTavern**: sticky → cooldown → delay (activation state)
- **N.E.K.O.**: reinforcement → disputation → archive (evidentiary state)

Our `retrieval.mjs` is stateless. Every query is independent. This is the single biggest architectural gap.

### 4.3 The Shared Discipline: Filter Before Rank

Both SillyTavern (budget → activation → prompt) and N.E.K.O. (scope → hard filter → rank) filter **before** ranking. We rank before filtering. This is a security property in N.E.K.O. and a correctness property in both.

### 4.4 The Shared Honesty: Degradation Is Visible

- LivingFeed: `recall` returns `[]` on failure — *"a total memory outage looks exactly like a world where nothing memorable happened"*
- SillyTavern: no activation tests — *"a regression surface, however well the manual experience has been tuned"*
- N.E.K.O.: ban-topic TTL expires — *"a suppression a user cannot inspect or revoke, that lapses on its own"*

All three systems have a failure mode where **the system silently does less than it should**. Our `story.starved` is the same shape.

---

## Part 5: Concrete Module Proposals

### 5.1 `packages/modules/director.mjs` — Component Storage

```js
// Before (line 49):
const score=(c.weight??10)+settings.jitter*tx.random()-(deck.recent.includes(c.id)?8:...)+...;

// After:
const components={
  weight:c.weight??10,
  jitter:settings.jitter*tx.random(),
  recentPenalty:deck.recent.includes(c.id)?8:0,
  scoreBonus:scoreBonus(c,current,mode,kind||delivery,settings,rotate)
};
const score=components.weight+components.jitter-components.recentPenalty+components.scoreBonus;
```

Every director decision stores its sub-scores. This turns "why did the director pick this beat?" from an argument into a regression.

### 5.2 `packages/modules/director.mjs` — Hysteresis Band

```js
// Before (line 70):
return scene&&(recycle?scene.repeatable:used<(c.maxUses??1))&&!(c.minTick&&tx.state.tick<c.minTick)
  &&(last==null||tx.state.tick-last>=(c.cooldownTicks??0))&&...;

// After:
const sticky=c.stickyTurns??0,delay=c.delayTurns??0;
const firedRecently=last!=null&&tx.state.tick-last<=sticky;
const coolingDown=last!=null&&tx.state.tick-last>sticky&&tx.state.tick-last<(c.cooldownTicks??0)+sticky;
const delayed=c.minTick&&tx.state.tick<c.minTick+delay;
return scene&&(recycle?scene.repeatable:used<(c.maxUses??1))&&!delayed
  &&(firedRecently||last==null||!coolingDown)&&...;
```

A beat that fired stays eligible through its scene (sticky), then falls quiet for a cooldown period counted from the end of sticky.

### 5.3 `packages/cards/director-library.mjs` — Negative Preconditions

```js
// Before (line 43):
when:{trust:Object.fromEntries(Object.entries(L.gate).map(([r,v])=>[`@${r}`,v])),...};

// After:
when:{trust:Object.fromEntries(Object.entries(L.gate).map(([r,v])=>[`@${r}`,v])),...},
...(L.suppresses?{suppresses:L.suppresses}:{}),
```

In `director.mjs:72`, add:
```js
&&!conditionReasons(c.suppresses,tx.state,tx.pack).length
```

### 5.4 `packages/ai/retrieval.mjs` — Filter Before Rank

```js
// Before (line 22-27):
export function bm25Score(index,id,query){
  const doc=index.entries.get(id);if(!doc)return {score:0,matched:[]};
  let score=0;...
}

// After:
export function bm25Score(index,id,query,{filter=null}={}){
  const doc=index.entries.get(id);if(!doc)return {score:0,matched:[]};
  if(filter&&!filter(doc))return {score:0,matched:[]};
  let score=0;...
}
```

Scope filtering happens before ranking, not after.

### 5.5 `packages/ai/retrieval.mjs` — Query-Predicate Expiry

```js
// Add to loreIndex:
const entries=docs.map(d=>{
  const tf=new Map();const words=terms(d.text);
  for(const w of words)tf.set(w,(tf.get(w)||0)+1);
  return {id:d.id,tf,length:words.length,decayAt:d.decayAt||null};
});

// In bm25Score:
if(doc.decayAt&&doc.decayAt<now)return {score:0,matched:[]};
```

No sweeper, no job, no window where an expired entry is still returned.

### 5.6 `packages/ai/memory.mjs` — Dual-Clock Evidence

```js
// In romance-tempo.mjs, add:
export function addGrievance(tx,character,amount,reason){
  const current=tx.state.modules['social.romance-tempo']?.characters?.[character]||{};
  const grievance=Math.min(10,(current.grievance||0)+amount);
  tx.set(['modules','social.romance-tempo','characters',character,'grievance'],grievance);
  tx.emit('social.grievanceChanged',{character,old:current.grievance||0,value:grievance,delta:amount,reason},[tx.pack.playerId,character]);
}

export function effectiveTrust(character){
  const c=character;
  return (c.trust||0)-(c.grievance||0);
}
```

`grievance` decays quickly (half-life of a few ticks). `trust` decays slowly. The NPC's mood reads `effectiveTrust`.

### 5.7 `packages/ai/retrieval.mjs` — Hard Filter for Disputed Entries

```js
// In bm25Score:
if(doc.disputed)return {score:0,matched:[]};
```

A third state between present and absent. The owner can dispute a lore entry and have it drop out of recall without losing it.

### 5.8 `packages/ai/retrieval.mjs` — Anti-Repetition Over Output

```js
// New file: packages/ai/anti-repeat.mjs
import {terms,bm25Index,bm25Score} from './retrieval.mjs';

export class AntiRepeat {
  constructor(windowSize=15){
    this.windowSize=windowSize;
    this.turns=[];
  }
  add(text){this.turns.push(text);if(this.turns.length>this.windowSize)this.turns.shift();}
  similarity(text){
    if(!this.turns.length)return 0;
    const index=bm25Index(this.turns.map((t,i)=>({id:i,text:t})));
    const scores=this.turns.map((_,i)=>bm25Score(index,i,text).score);
    return Math.max(...scores);
  }
}
```

Before displaying an NPC reply, compute similarity against the last 15 assistant turns. If similarity > 0.5, flag for re-sampling.

### 5.9 `packages/core/engine.mjs` — Append-Only Event Log

```js
// In engine.mjs, add:
const eventLog=[];
function applyMutation(mutation){
  eventLog.push({
    timestamp:now(),
    type:mutation.type,
    payload:mutation.payload,
    context:assembleContext()
  });
  state=mutation.apply(state);
}
```

An append-only event log lets us replay a session and see exactly why the director made each decision.

### 5.10 `packages/cards/director-library.mjs` — JSON Interchange Format

```json
{
  "beats": [
    {
      "id": "cafe-argument",
      "kind": "obstacle",
      "tone": 2,
      "roles": ["lead"],
      "gate": {"lead": 20},
      "suppresses": {"relationshipStatus": "dating"},
      "stickyTurns": 2,
      "cooldownTurns": 5,
      "maxUses": 3
    }
  ]
}
```

A creator can export a beat pack and share it. The format travels with a character card.

---

## Part 6: The Testing Gap

The atlas's sharpest criticism of SillyTavern applies to us: *"Seven interacting mechanisms and no fixture asserting what fires is a regression surface."*

Our `director-library.mjs` has 12 authored beat templates. Our `retrieval.mjs` has BM25 with scope filtering. Our `director.mjs` has adaptive beat selection with 7 interacting conditions. Do we have a test that asserts which beats fire given a specific game state?

If not, we have the same gap. And the fix is table-driven tests:

```js
// tests/director-activation.test.mjs
const cases = [
  { state: { mood: 'tense', relationshipStatus: 'single' }, expected: ['cafe-argument'] },
  { state: { mood: 'tense', relationshipStatus: 'dating' }, expected: [] },
  { state: { mood: 'calm', relationshipStatus: 'single' }, expected: ['coffee-chat'] }
];

for (const { state, expected } of cases) {
  const fired = selectBeats(state);
  assert.deepEqual(fired, expected);
}
```

---

## Part 7: Priority Order

1. **Filter before rank** in `retrieval.mjs` — trivial, immediate correctness gain
2. **Component storage** in `director.mjs` — trivial, massive debuggability gain
3. **Negative preconditions** in `director-library.mjs` — cheap, prevents false activations
4. **Hysteresis band** in `director.mjs` — moderate, prevents repetition and dropped threads
5. **Dual-clock evidence** in `memory.mjs` — moderate, enables nuanced relationship modeling
6. **Hard filter for disputed entries** in `retrieval.mjs` — cheap, third state for lore
7. **Anti-repetition over output** in `narration-lint.mjs` — moderate, kills topic looping
8. **Append-only event log** in `engine.mjs` — moderate, enables replay and debugging
9. **JSON interchange format** for beat packs — moderate, enables creator sharing
10. **Table-driven activation tests** — cheap, prevents regressions

---

## Questions for the Owner

- **Q: Dual-clock evidence.** Replace single `trust` scalar with `affinity` + `grievance` on all relationship tracks? A) Yes, all tracks (Recommended) B) Yes, but only on `social.dating` C) No, single scalar is simpler and sufficient
- **Q: Negative preconditions.** Add `suppresses` field to beat templates? A) Yes, all beats (Recommended) B) Yes, but only for romance beats C) No, keep it simple
- **Q: Anti-repetition.** Implement BM25 over assistant output in `narration-lint.mjs`? A) Yes, before O5a (Recommended) B) Yes, but after O5a C) No, string matching is enough
- **Q: Event log.** Add append-only event log to `engine.mjs`? A) Yes, all mutations (Recommended) B) Yes, but only director decisions C) No, current logging is sufficient
- **Q: Interchange format.** Design JSON beat pack format? A) Yes, before O5a (Recommended) B) Yes, but after O5a C) No, code is the format
