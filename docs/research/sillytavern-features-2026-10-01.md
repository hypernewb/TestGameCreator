# What to take from SillyTavern (2026-10-01)

Status: **research only.** Companion to [module-gaps-2026-10-01.md](module-gaps-2026-10-01.md) and [module-gaps-round-2-2026-10-01.md](module-gaps-round-2-2026-10-01.md). Audio excluded (owner: later pipeline).

Framing: we already vendor Venus source and ship an ST *host* extension, and we've already taken ST's World Info concepts (BM25 retrieval, keyword scan depth 4, creator-declared links). This is about **player-facing UX and context architecture** we have no equivalent of, plus one architectural lesson that applies before we build the aspects layer.

Sources: ST docs (World Info, Data Bank, Summarize, Regex, Macros, Group Chats, Chat Vectorization, User Settings), the Agent Memory Atlas entry, `integrations/sillytavern/adapter.mjs`, `packages/ai/retrieval.mjs`, `packages/ai/memory.mjs`, `docs/SILLYTAVERN.md`.

---

## The distinction that matters

ST has two categories of feature, and we've been conflating them:

- **Context plumbing** — how lore, memories and summaries get into a prompt. We've taken this seriously already. BM25 retrieval, token budgets, LODs, scan depth 4, no automatic recursion. This is in good shape.
- **Player-facing recovery and exploration** — swipes, branching, rewind, try-before-commit. **We have essentially none of this**, and it's the layer that determines whether a 30–45 minute run feels safe to experiment in.

The second category is the gap. Our runs have real consequences and no undo. A player who types something they regret loses a daypart, and ST's users have never accepted that.

---

## Tier 1 — the recovery layer

### 1. Swipes (alternative responses)

ST's core loop affordance: any AI message can be re-rolled, and *all* previous variants are kept. Issue #1731 asks for the next step — swiping on **any** message, branching the whole tree below it, which is now `chatTree` (PR #4573).

We have none of this. Our nearest equivalents are "Retry writing" (regenerate prose for the latest turn only) and "Branch from here" (a checkpoint mechanism, not a response-variant mechanism).

**The one we can take cheaply is the narrow version**: keep regenerated prose variants for a turn, let the player cycle. Our retry already regenerates; the only change is *keeping* the old one and offering a back arrow. That's a UI + storage change, not a new system, and it directly addresses the owner's replay path.

**The one to resist is the full tree.** PR #4573's own author notes it's a fundamental chat-format change affecting every extension, and the maintainer comments it's "too late to radically change such a fundamental thing." We have the advantage they didn't: our state is a *deterministic engine* with recorded events, not a linear JSONL. Branching mid-run is tractable for us in a way it isn't for them — but it's a large piece of work, and the F1 gate should pass first.

### 2. Prompt Manager: order and toggles

ST's Prompt Manager is a drag-and-drop list where **position is meaning** — prompts near the top are sent early, near the bottom last (Post-History Instructions is the most authoritative position). Defaults can be toggled off but not deleted. Each prompt can declare **which generation types trigger it**: normal, continue, impersonate, swipe, regenerate, quiet.

Two ideas worth taking, both cheap:

- **Position as a knob.** We have LODs and budgets, but a creator can't see or reorder what the model sees. A read-only prompt inspector showing section order and token cost would be a debugging win and a creator win, and it directly serves the P-10 "context diagnostics" item in `NEXT-MILESTONES.md`.
- **Generation-type routing.** This is the interesting one and it's a real gap. Right now our narration, daypart and intent calls each build their own message list. ST's model is: *one prompt assembly, filtered by what you're doing*. That would give us "same context, different instruction" for retry, daypart introduction, and director nudge — and would make the one-call-per-turn rule easier to hold, because context assembly stops being duplicated per call.

### 3. Depth injection (`@ Depth`)

ST can insert content *inside* the chat history at a specified depth, not just at the top or bottom. A late remark is injected 4 messages back so the model has absorbed the exchange before reading it.

This is the mechanism behind two things we named and haven't built: the **callback ledger** (O5 step 3) and **mid-scene complications** (O5 full). "Tell the model about the incident two turns ago" is precisely a depth injection. Worth naming explicitly so the callback work doesn't get built as a flat prepend that overweights recent context.

---

## Tier 2 — retrieval refinements

### 4. Inclusion groups and prioritise-inclusion

ST's World Info lets multiple entries share a **group label**, and when several fire, only one is inserted — chosen either randomly by weight or **deterministically by highest `Order`**. The docs recommend prioritise-inclusion for "creating fallback sequences": if two entries both match, take the more important one.

This solves a problem we have and haven't named. Our `bestOf` picks one beat; our lore retrieval returns a ranked list that all gets injected. With groups, a creator can say "these five entries are alternatives about the same subject — inject the highest-priority one" and stop paying tokens for near-duplicate lore. That's a context-budget win with a better-reading prompt.

### 5. The minimum-activation pass

When too little fires, ST widens its scan depth rather than returning nothing. Bounding and back-filling in one system.

Cheap, and directly relevant to our dead-turn problem: on a turn where the model gets almost no lore, a wider scan is better than an under-informed prompt. It pairs with our existing "flat purgatory" concern from the director card.

### 6. Vector storage — and the caching trap

ST's vector extensions search by embedding similarity and shuffle relevant past messages to the top or bottom of context. Their own docs warn: *"vectorization is often counter-productive [with caching], as the modified prompts rarely hit the cache – effectively making caching useless. You have to choose one or the other."*

We already chose. `packages/ai/retrieval.mjs` is deterministic BM25 — fast, cache-friendly, no embeddings, no model dependency, fully replayable. That's the right call for a local-first game with a one-call-per-turn rule, and it aligns with our non-negotiable that replay is deterministic.

**So: do not adopt vector retrieval.** The research is here to say *why not*, and the reason is cache invalidation. Our deterministic retrieval is a feature, not a limitation. Worth writing down so nobody "improves" it later.

The part of ST's vector work that *is* worth stealing is the **score threshold** (cull below ~0.2–0.5 relevance) and **chunk boundaries** (split on paragraph breaks, not fixed character counts). We do fixed-budget truncation today; boundary-aware splitting is a small quality win.

---

## Tier 3 — authoring and diagnostics

### 7. Summarize with three injection modes

ST's summary is a rolling long-form memory, and the docs are refreshingly blunt: *"the outputs may lose some important details or contain hallucinations, so you're always advised to keep track of the summary state and correct it manually."*

The three modes are the useful part. Raw sends only the summarization prompt plus history (max clarity, no cache reuse). Classic appends the summarization prompt as a trailing system instruction alongside the full prompt (best cache behaviour). Between them sit variants that include the *previous* summary plus new messages.

For us: our `memory.mjs` deliberately avoids LLM summarisation — it rebuilds what the player said from committed turns at read time, because "small local models misattribute first-person text." **That instinct is right and we should not undo it.** But ST's mode choice tells us something useful: a summary is a *context position* problem, not only a generation problem. If we ever add one, "classic" mode is the right default.

### 8. Auto-swipe (quality gate on generation)

ST can auto-reject and regenerate a message that's too short, or that hits blacklisted words, with a configurable minimum length and word count.

We have something adjacent and *better*: `narration-lint.mjs` and `untrusted-output.mjs`. But we validate after the fact and show a retry button. ST's version is a *loop*. Worth checking whether our lint failures could retry internally up to a bounded count rather than surfacing to the player — the owner's complaint about short replies would be fixed invisibly instead of by a button.

### 9. Macros as a creator surface

ST macros (`{{char}}`, `{{user}}`, `{{summary}}`, `{{allChatRange}}`, runtime state like `{{maxPrompt}}` and `{{model}}`) are substituted throughout cards, lorebooks and prompts, with nesting and autocomplete.

We have exactly one of these: `fill()` in `role-slots.mjs`, which does `@role` and `{role.name}` / `{role.they}` for director templates. It's good and narrow.

The generalisation worth taking: **let creators write prompt text with substitution**, rather than only structured fields. A creator who wants a "director voice" instruction referencing `{lead}` and `{daypart}` shouldn't need a new schema field. Risk is real — arbitrary creator text in a prompt is a validation and injection surface — so this needs the same care as any lore entry.

### 10. The injection hazard, stated plainly

The memory atlas's warning about ST is the most important line in this document for our roadmap:

> *"A lorebook is a prompt-injection surface with a distribution channel, and nothing in the data model acknowledges this... `@@activate` fires an entry regardless of keys, so an imported entry can be unconditional."*

We are safer — creator-reviewed packs, and `public/studio.mjs` gates publication on template review. But we have the same structural exposure: `importPack` accepts a JSON file, our lore and aspects run *before* generation, and an aspects layer (the top proposal in round one) will add a new unconditional-injection surface.

**Requirements for the aspects layer, before it ships:**
- No aspect may inject text; aspects may only *gate* engine behaviour. Text injection stays in authored scenes, which are already reviewed.
- Imported projects get validation on load, not just on publish.
- Anything unconditional in a lore or aspect context gets a review marker, not a silent pass.

This is cheap to enforce now and expensive to retrofit.

---

## What I'd take, ranked

1. **Prompt inspector** (order + token cost, read-only) — P-10 partly done, pure debugging win
2. **Swipe variants for the latest turn** — the narrow version, cheap, big feel win
3. **Generation-type prompt routing** — one assembly, filtered per call; helps the one-call rule
4. **Inclusion groups + prioritise-inclusion** — a context-budget win with a better-reading prompt
5. **Depth injection for callbacks** — names the mechanism O5 needs, so it isn't built flat
6. **Minimum-activation widening** — pairs with the dead-turn problem
7. **Lint-retry loop** — fixes the short-reply complaint invisibly
8. **Boundary-aware context chunking** — small quality win on truncation
9. **Creator prompt macros** — needs an injection design first
10. **Full chat-tree branching** — after the F1 gate, if at all

**Explicitly not taking:** vector/embedding retrieval (cache-invalidating, breaks deterministic replay), LLM summarisation as the memory source (our committed-turn rebuild is strictly better and already works around the exact failure ST warns about), and group-chat persona merging (their docs warn it causes "characters confused about themselves, merged personalities" — our one-focus-NPC rule already avoids this).

---

## Questions for the owner

- **Q: Swipes.** Keep regenerated prose variants for a turn and let the player cycle back? A) Yes, latest turn only, cheap version (Recommended) B) Yes, and full chat-tree branching later C) No, retries stay destructive
- **Q: Prompt inspector.** Read-only view of prompt section order and token cost? A) Yes — serves creator UX and P-10 (Recommended) B) No, the turn inspector already covers it C) Yes, plus creator-editable ordering
- **Q: Aspects and injection.** Confirm the rule that aspects gate behaviour but never inject text? A) Yes, hard rule (Recommended) B) Allow text injection, gated by review C) No restriction
