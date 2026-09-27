# Rumors and gossip

`social.gossip` is an optional layer over `social.npc`. It converts selected committed events into bounded rumors and moves them through actual character contact. It does not give every NPC global knowledge.

Each `gossipRule` defines:

- the source event and optional payload match;
- a short, authored summary;
- whether initial knowers come from event witnesses or visibility;
- an optional subject payload key;
- lifetime, maximum social hops, spread rate, and minimum NPC affinity.

Rumors retain their source event, initial tick, expiry, current holders, and a bounded transmission history. During time advancement, a holder can tell a co-located character when their affinity meets the rule. The player is excluded from automatic spread and may explicitly ask a present character what they have heard.

## Hearing is not believing

Every holder has a separate stance: `verified`, `unverified`, `believed`, or `dismissed`. Initial witnesses are verified. A later NPC evaluates hearsay from the rule's base credibility, affinity with the source, authored skepticism, and belief/dismissal thresholds. Only verified or believed holders spread a rumor further. The player receives hearsay as unverified and explicitly chooses whether to believe or dismiss it.

This distinction is important for narration: knowing that “Ada said X” is not the same as knowing X is true. AI context receives both stance and confidence, while `social.rumorBelieved` and `social.rumorDismissed` provide deterministic scene triggers.

The AI context contains only rumors held by its current viewer. A creator can trigger scenes from `social.rumorCreated`, `social.rumorLearned`, or `social.rumorExpired`, including matches on `to`, `subject`, `rule`, or `sourceEvent`.

This creates a useful ladder:

1. an action is witnessed;
2. a source-linked rumor exists among those witnesses;
3. local social contact spreads it a bounded number of hops;
4. authored scenes decide whether it becomes confrontation, reassurance, leverage, or nothing at all.

The design is deliberately smaller than a universal reputation score. It takes inspiration from the witnessed-secret-to-scandal progression—and the option to believe or dismiss a secret—in [The Sims 4's scandal system](https://help.ea.com/es-mx/articles/the-sims/the-sims-4/scandals/) while retaining deterministic, viewer-specific context similar to [SillyTavern World Info and timed effects](https://docs.sillytavern.app/usage/core-concepts/worldinfo/). It also fills the generic rumor slot identified in the local Venus University audit without copying Venus-specific characters, story data, or fixed rules.
