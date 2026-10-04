# What to take from the Agent Memory Atlas (2026-10-01)

Status: **research only.** Companion to the three module-gap digests. Read the atlas's own framing first — it is unusually honest and it changes the answer.

Source: [Agent Memory Atlas](https://neoneye.github.io/agent-memory-atlas/) — 704 memory systems, commit-pinned, 21 patterns. 10,022 lines of index. This doc is the distillation for our use case, not a summary of the corpus.

---

## Read the meta-layer first, because it changes the answer

The atlas's central finding is not a pattern, it's a *method*:

> **"Every system in this atlas builds the ascent. Almost none completes the descent — which is why correction, not retrieval, is where memory fails."**

And then, on establishment, this — which is the most useful thing in the whole corpus:

> *"64 systems of 704 carry a rejected-value tombstone. Neither is **a best practice**. There is no consensus behind either, no library that gives it to you, and nobody to ask when your implementation has a hole. Adopting one means building it."*

The field's own 107-page survey ([arXiv:2512.13564](https://arxiv.org/abs/2512.13564), 47 authors) **does not contain the words "tombstone", "rejected" or "negative" anywhere**, while asking for "verifiable forgetting and auditable updates" as future work. Two independent derivations (the atlas, and a database paper arriving from the data-management side) is better evidence than one — and the atlas is explicit that this is *still not a practice*.

**What this means for us:** the atlas is not a menu of proven techniques. It is a well-evidenced map of which problems are real, with a "here is what to build if this failure is the one that would hurt you" structure. That's exactly the right artefact for us, because we already know our failure modes and they are unusual.

---

## The stack table names us

The atlas sorts patterns by "what breaks if your memory is wrong." One row:

> **A companion or roleplay agent** → *memory as an editing surface* and *retrieval hysteresis* — because the failure that hurts is **"repeating yourself, or raising something the user asked you to drop"**

That is our product, stated exactly. And it is *not* the row the rest of the corpus is about. We are not multi-tenant, not autonomous, not agent-orchestration. The atlas is 90% solving our non-problems.

**So most of this document is a list of what to skip, and why.** That's the honest shape of the answer.

---

## What we already have, and the atlas confirms it

Three of the four "correctable stack" patterns are already implemented, deliberately, in this repo:

| Pattern | Atlas says | We have |
|---|---|---|
| **Scope as first-class key** | "build this first… adding it to a store that already has data is the hardest migration in this list" | pack, campaign, project, published-version scoping throughout |
| **Evidence before belief** | "persist the source event before deriving the claim" | `memory.mjs` rebuilds from committed turns at read time; `engine.mjs` is the sole mutation path |
| **Governed write gateway** | "every write proposes, gets checked, then commits" | `docs/map/engine.md`: "engine.mjs is the only file allowed to directly mutate game state" |

**This is a stronger position than most of the 704.** The atlas's own caveat applies in our favour: *"a fast CRUD memory for a single user genuinely does not need a tombstone, and saying otherwise would be gatekeeping."*

But the atlas also says the failure is in *correction*, not retrieval, and it identifies the one thing we don't have.

---

## The one real gap: rejected-value tombstones

### The mechanism

Store a durable record keyed on the **value** — not the row — so a rejected belief cannot be re-introduced by a later write.

The atlas is precise about the distinction, and it matters:

| Kind | Keyed on | Purpose |
|---|---|---|
| Cassandra tombstone | a row/cell | propagate a delete across replicas |
| Soft delete | a row, via `deleted_at` | hide a row, keep it recoverable |
| **Rejected-value tombstone** | the **normalised value** | refuse the value when something tries to write it *again* |

Deleting a row doesn't help, because the next write creates a *different* row saying the same wrong thing. The atlas calls this **memory laundering**: *"history that the system already judged wrong re-enters through a different write path."*

Origin story worth knowing, because it explains the shape. Verel built it in June 2026 under red-team pressure, not design. The commit says:

> *"rejection wasn't durable across supersede-then-restate: reject paris → supersede with london (rebuilds CANDIDATE, erasing the verdict) → restate paris + attest → VERIFIED."*

Three subsequent rounds defeated earlier fixes: TTL pruning deleted the tombstone and reopened the hole after ~90 days; NFKC divergence let unicode look-alikes through; key collisions needed an injective `make_key` and a bounded ledger.

### Where we are exposed — and this is real, not hypothetical

We have **three** places where a rejected value can walk back in:

**1. `owner-answers.md`.** Rejected design approaches are recorded as "A) no, B) no" lines. A future AI worker reading the repo could re-derive a rejected approach and present it as new. The atlas's own words: an agent that *"rediscovers the claim in a later conversation"* is exactly the attack. Our answer to a design question routinely contradicts an earlier line in the same file.

**2. `docs/bugs.md`.** Striking through a fixed bug is a tombstone that doesn't work — the text is still there, greppable, and a future worker can re-report it or re-fix it.

**3. Creator veto (`T-NNN.veto.md`).** The writer role ships files for owner veto. A vetoed character beat that gets re-drafted is a rejected value returning.

**4. And the sharpest one:** our memory ledger. Per `SYNTHESIS.md`, "the model writes NPC memories only, straight into state." The model can write a memory, the owner corrects it, and the next extraction re-asserts the original. We have no record that it was wrong.

That fourth one is the atlas's core claim, live in our product. Per `AGENTS.md`: *"Model output is untrusted text where only engine-priced tags/checks/authored effects change numbers or gates. Memories are the one exception."* The exception is exactly where a tombstone belongs.

### What we'd actually build

Per the atlas, the strong form is: value-keyed, normalised, scoped, **consulted on every automated write path**, refused at write not filtered at read, and **explicitly testable**.

Concretely for us:

- Key on `(scope, subject, predicate, normalised value)`. Scope is pack+campaign, which we already thread everywhere.
- **Normalisation is where the work is** — the atlas says this three times. It found the bug by attacking the mechanism, not by reasoning about it. Our `retrieval.mjs` already has a `terms()` stemmer and CJK bigram path; a tombstone key needs its own canonicalisation, and it should be built and then attacked.
- Consulted in `engine.mjs`'s write path, which is the single chokepoint. One insertion point, not many — the atlas is explicit that a bypass "reintroduces the failure the gateway exists to prevent, and does it silently."
- The owner may override with an auditable action, not a flag. Atlas: "the override is an audited act, not a bypass."
- **No expiry.** Round 8: "a tombstone that expires is not a tombstone." The owner lifts one explicitly.

### The part that would bite us

The atlas's sharpest warning, and it's about *tidy-up*:

> *"Add the obvious-looking `AND superseded_by IS NULL` to that lookup during a tidy-up and the guarantee is gone, silently, in the direction this page says failure always looks like success. Which is the argument for the test bullet below rather than against the mechanism: **a tombstone you got for free is one you can lose for free.**"*

So: **write the test that fails if someone adds the filter.** Memory Compiler's worked example makes the point painfully — its check skips rejected values under twelve characters "too noisy," and both of its own example tombstones are ten characters. The mechanism that makes its own example correct is the one the adopter has to remember to write by hand.

**This maps directly onto our own AGENTS.md rule** — "never delete or weaken an existing assertion." The atlas generalises it: a *negative* test (this must not return) is the only thing that survives a well-meaning refactor, and our suite currently has almost none.

---

## The other transferable idea: negative retrieval assertions

**416 of 704 systems** carry this — by far the most common mechanism in the corpus, and the atlas's "one mechanism judged per report" leader.

> *open-cowork* — "Ships a memory benchmark that asserts what recall must **not** surface, not just what it must."

Most systems test that retrieval returns the right thing. Very few test that it fails to return the wrong thing. That asymmetry is why deletion quietly leaks: a read-based test passes forever while the write path stays open.

**This is our highest-value cheap item, and it's a test-writing discipline, not a feature.** It applies to:

- **Consent.** Assert that an intimacy scene cannot resolve when the engine gate is closed — i.e. the *prose path* never substitutes for the state path. `SYNTHESIS.md` states this as a hard rule ("state wins, but the prose should match the verdict") and a Venus playtest found it violated in practice. Is there a test that asserts the prose can't carry it?
- **Secrecy.** Assert `knownBy` is respected — a character never learns a secret they weren't a witness to, across *every* disclosure path, not just the one that was implemented.
- **The tombstone**, once built.
- **Knowledge gaps.** Assert the model is never told a hidden preference, a rejected draft, or an off-screen event the player hasn't discovered.

Each of those is a test we could write this week against existing code. Four of them would probably find something.

---

## Two smaller ones worth taking

### Cache-preserving injection — independent confirmation

> *"a recall block in the system prompt invalidates the prefix cache on every request, and nothing else reports it."*

This is the **third independent source** to reach the same conclusion. SillyTavern's docs warn vectorization "effectively makes caching useless." LivingFeed keeps "a content clock that a read cannot turn into a usage clock." Our BM25 is deterministic and cache-friendly, and `packages/ai/retrieval.mjs` indexes a pack once via a `WeakMap`.

Three sources, one conclusion: **don't swap in embeddings.** Write it down so nobody "improves" it later.

### Decay and reinforcement: four signals we're conflating

> *"Change reachability over time without confusing **age, use, popularity, and truth**."*

We conflate at least three today. `director.mjs` `tierOf()` is pure age. The `recent` array and the −8 penalty are use. Tension is our proxy for popularity. And none of them is truth — whether a beat is *still valid* is a separate question we only answer via `maxUses` and `cooldownTicks`.

The atlas's separation matters for the director specifically: a beat that's been fired recently is suppressed for pacing reasons, not because it stopped being true. Those want different fixes, and we currently treat them as one number.

### Abstention ("gate the expensive path")

Waku's finding: **"irrelevant memory bends the answer"** — it runs a small model to decide *whether to retrieve at all*.

We already have the primitive, and it's the right shape. `adaptiveBeat` returns `false` when nothing is eligible, and `bestOf` returns `null` on an empty pool. Our director *abstains*. But the abstention is invisible: `story.starved` fires as a signal and the player sees nothing, which the O5 card already identifies as a design gap.

The atlas's read is that abstention is a first-class outcome worth surfacing. Which is exactly the "starvation is loud but not useful" complaint.

---

## What to skip, and why

The atlas is 90% about problems we don't have. Saying so explicitly:

| Pattern | Why we skip it |
|---|---|
| **Scope as tenant key** | Single user, local-first. We have pack/campaign scope, which is the part that matters. Multi-tenancy is not a product risk. |
| **Hybrid retrieval fusion** | Three sources now say embeddings break cache and determinism. Our BM25 is the right answer. |
| **Bi-temporal fact validity** (119/704) | Tempting — "when a preference was true" vs "when we learned it" is real for the likes puzzle. But it presupposes derived belief storage, and we deliberately don't have that. Revisit if the ledger ever moves off committed turns. |
| **Append-only audit + hash chains + signed deletion receipts** (Lethe, Aura, Palazzo) | Built for defensibility against a third party. The owner *is* the trust boundary; `docs/SILLYTAVERN.md` already says the local owner can inspect all state. Over-engineering. |
| **Promotion between tiers** | We have LODs and context budgets, not memory tiers. Different problem. |
| **Human review surfaces** (94/704) | We have one — Studio. Already covered by the creator wizard. |
| **Zero-LLM capture** | We already do this. `memory.mjs` reads committed turns; the model never writes the store. Atlas's own framing: "capture depends on conversation length" is the risk, and we don't have it. |

---

## The methodological lesson, which is the real find

The atlas is a **self-audit discipline**. Nearly every entry carries a "Main risk" that is a *bug in the audited system*, and several of those risks are "the test cannot fail":

- *Generative Agents*: "the recency term is inverted, and nothing tests it"
- *A-MEM*: "rank position used as identity, and the evolution test cannot fail"
- *VirtualWife*: "normalize_scores does not normalize"
- *Gini*: "three of five trust states have no writer"
- *Mercury*: "durability split from importance" as a *good* idea, alongside "dismissal without a tombstone" as the risk
- *Memvid*: "the delete test cannot fail"

**This is a pattern.** Systems that build a mechanism and then write a test that *cannot* fail are worse off than systems that build nothing, because the test certifies something false. Several entries say so directly — the atlas flags a "state machine with no transitions" and a "rejection recorded and never consulted again" as *risks*, not features.

**Our risk is the same shape.** `AGENTS.md` says "never delete or weaken an existing assertion" — good, and enforced. But do any of our 805 tests fail when the behaviour they cover is removed? The F1 gate is a real measured suite (`pass 805 fail 0`), so I won't claim it's theatre. But the specific discipline the atlas contributes is:

**For every mechanism we build, write the test that fails when the mechanism is deleted.** Not the test that passes when it works. The tombstone is the clearest case: the guarantee is destroyed by adding a *correct-looking* filter, so only a test that asserts non-return survives.

That is a one-line addition to our ticket template and probably the highest-leverage thing in this document.

---

## Proposal order (revised)

Inserting into the sequence from the previous rounds:

- **Immediately, no dependency: negative retrieval assertions.** Four tests: consent can't ride the prose path, secrecy `knownBy` respected across all disclosure paths, hidden preferences never reach the model, off-screen events never leak. Cheap, and the odds are good that one finds something.
- **Add to every future ticket: "the test that fails when the mechanism is deleted."** One line in the template.
- **After aspects (O5 foundation):** rejected-value tombstones on `owner-answers.md`, `bugs.md`, creator vetoes, and — the live one — the memory ledger. Value-keyed, normalised, consulted in `engine.mjs`, no expiry, owner-override audited.
- **Director, cheap:** record the four signals separately (age / use / popularity / truth) instead of one `recent` array.
- **Director, cheap:** make abstention visible. `story.starved` is already a refusal; the player should see it as "nothing's going on today" rather than nothing.
- **Document:** BM25 over embeddings, with the three citations. Prevents a future "improvement" that breaks determinism.

---

## Questions for the owner

- **Q: Tombstones scope.** Four sites: owner answers, bug log, creator vetoes, and the model's own memory ledger. A) All four, engine-level check (Recommended) B) Design docs only (answers, vetoes) — skip the ledger, it's the model's data C) Ledger only — that's where correction actually bites
- **Q: Negative tests now?** Write the four forbidden-retrieval tests against existing code, before any new feature? A) Yes, before O5a — a bug found now is cheaper (Recommended) B) Yes, but after the O5a bug fix lands C) No, fold into normal feature work
- **Q: Ticket template.** Add "the test that fails when the mechanism is deleted" as a required line? A) Yes, all code tickets (Recommended) B) Only for correction/lifecycle mechanisms C) No, current assertion rule is enough
