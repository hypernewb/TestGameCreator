Follow-up regression review (2026-10-06):

| Original failing test/assertion | Classification and resolution |
|---|---|
| conversation-fun: short refusals and emotional statements | Equivalent refusal wording, obsolete literal match. Still asserts no pressure, no repeated offer, same feeling and no unrelated topic. |
| conversation-fun: encouragement develops existing topic; empty conversation draws authored topic | Forced seeded sheet-topic drift and duplicated history snippet in direction are obsolete. Tests supplied transcript retention and no mandatory drift. |
| conversation-fun: fitting moves preserve personality/stage/seeded variation | Seeded personality moves are obsolete. Tests stable meaning, no forced performance, stage escalation limits and no input mutation. |
| conversation-fun: vulnerable reply/another interview question | Forced stock opinion and parser of the old comma-then direction are obsolete. Retains emotion classification, same subject and no forced question/opinion. |
| conversation-fun: refusal answers hanging offer | quick=true was obsolete. Retains refusal/no re-ask; asserts ordinary cap and absent minimum. |
| conversation-fun: brief matching lengths/agency | 2-3 minimum entries and mandatory narrator opener obsolete. Keeps agency, authoritative outcomes, JSON priority and scene exit guidance. |
| conversation-fun: groups get room for every NPC | Cast-sized minima and mandatory participation obsolete. Retains closed cast, all profiles and exact allowed speaker IDs. |
| conversation-fun: questions/feelings/openings keep full replies | 5-7 minima and ordinary/authored conflation obsolete. Preserves developed-answer guidance and explicit authored/first/solo/closing exemptions. |
| conversation-fun: question endings/new agenda optional | Different bounded/continuous quick contracts obsolete. Both use same optional-ending ordinary contract. |
| dialogue-voice: prompt character rule/voiceBlock/example IDs | Capitalization-only assertion mismatch. Case-insensitive rule assertion; exact sample, voice and speaker-ID assertions retained. |
| dialogue-voice: NPC directed voice/sample recitation dropped | Direction-level rotated Sound like sample obsolete. Tests samples in the actual assembled prompt; exact sample recitation still must be dropped. |
| dialogue-voice: engine directs beat deterministically | Old composite direction string, topic/voice rotation and compulsory hanging-question callbacks obsolete. Canonical ground, player-memory recall/ownership/kind priority, voice, authored goal, named targeting and solo/closing checks retained. |
| dialogue-voice: apologies and miss questions | REAL regression: generic lead lost explicit apologizer identity. Restored explicit player-apology cue. Unrelated first-like miss fallback intentionally removed; explicit coffee mention still grounds. |
| dialogue-voice: alternate group interjections | Alternate-turn forced chimes obsolete. Named speaker targeting, deterministic directions and no unsolicited forced chime remain tested. |
| dialogue-voice: closeness sets tone/moves | Stock stage temperament/flirt/confide mandates obsolete. Tests stages, per-NPC trust/memory, rejected/broken/strained boundaries and no prescribed flirt. |
| dialogue-voice: opening follow-up callbacks | Hashed callbacks/promises every other opening obsolete. Supplied disclosures/promises remain visible and no fulfillment is invented. |
| dialogue-voice: moods on some days/authored replacements | REAL regression: authored cues became unavailable except voice-example selection. Restored optional authored moods in full/compact profiles and knowledge projection. Synthetic moods and compulsory performance remain removed. |
| dialogue-voice: sheet topic only with filler | Compulsory seeded topic drift for Go on obsolete. Authored topics and latest substantive input remain supplied without forced switching. |

Additional recorded defects resolved narrowly: ordinary five-word gesture overlap still demanded new physical business despite the prompt change. It now skips that ordinary-only repair; full near-duplicate narration, authored gesture checks and stage-touch checks remain. Added ordinary-only removal of exact orphan player speech tags such as NPC speaker text "you say softly."; legitimate "You say that now." and requested player narration remain unchanged.

Generation/repair/rendering attribution:

- Turn 1 raw generation already filed asterisks/actions under NPC speaker IDs. Existing normalization converted visible actions to narration and removed the initial body clause. Rendering grouped the narration with spoken lines under one character label and quoted only stored spoken entries; it did not invent the text.
- Turn 2 raw generation already contained the premature departure, sweater/body description and coffee demand. No repair occurred. Normalization split the mixed entry into dialogue and narration; rendering only grouped it.
- Turn 4 first draft was rejected for five-word repeated gesture overlap (beats). The repair raw JSON introduced an NPC entry containing "you say softly." and echo text. Echo sanitation removed one current-input echo but kept the orphan tag, which rendering quoted because its stored speaker was the NPC. The new orphan-tag regression replays that exact shape and removes the tag.
- Turn 5 first draft repeated the prior NPC sentence; the repeat repair introduced player-statement echoes, sweater/body narration and twelve fragmented entries. The repaired draft then failed the soft beats check and was accepted by the existing second-attempt soft-error fallback. Normalization removed a repeated teaching sentence and adjusted punctuation; rendering supplied quotes/paragraphs, not the corruption.
- Turn 6 first draft directly answered everyday poems. It was rejected for "her chin in her palm" overlap. Repair replaced it with a shorter answer and a redundant question about why writing stopped. This is direct evidence that the gesture repair worsened relevance in this sample.
- Turn 7 raw generation invented a lateness complaint and omitted end_scene. There was no repair. Neither the renderer nor prompt contains that lateness allegation. The lab bypasses intent classification, so this is not proof of GUI goodbye routing.
- No size-based causal claim is supported. No further real-model runs were used to seek a better sample.

Full unchanged recorded revised transcript follows (includes mild unsolicited body descriptions, no explicit sexual act/genital detail):

## Recorded seven-turn output

### Turn 1 (2.5s)

Player: Hi Dilek. What makes a poem worth arguing about?

Dilek Şahin: “A poem worth arguing about is one that makes you feel something - anger, joy, sadness...something raw and real. Something you can't quite put into words but know exists deep inside you.”

Her gaze meets yours intently for a moment before she looks away again.

“I guess that's why I love teaching literature. It gives me a chance to explore those feelings safely, through the pages of books instead of risking hurting someone else.”

She smiles faintly, almost shyly.

“What about you? Do you have a favorite poem or book that means something to you?”

Dilek Şahin warmed to you.

### Turn 2 (2.6s)

Player: I see.

Dilek Şahin: After a moment, she lets out a soft laugh.

“I suppose that sums it up pretty well.”

She stands up and stretches languidly, the movement making her curves shift under her sweater.

“Well, I'm glad we could chat for a bit. But I think it's time for me to get back to work.”

With a small smile, she turns to leave, pausing briefly at the door.

“Oh, and player? Next time you're in my office... maybe bring some coffee?”

Dilek Şahin warmed to you.

### Turn 3 (0.9s)

Player: I used to write poems, but I stopped because I felt embarrassed showing anyone.

Dilek Şahin: She sits back in her chair, considering you for a moment before speaking softly.

“I get it.”

### Turn 4 (6.7s)

Player: I disagree a little. A poem can be clumsy and still say something true. Maybe the margin notes are overrated.

Dilek Şahin: Dilek raises an eyebrow at your disagreement.

“A clumsy poem can still hit home.”

“you say softly.”

### Turn 5 (3.6s)

Player: Could you explain your point about what makes a poem worth arguing about? I mean your view, not mine.

Dilek Şahin: “A poem can be clumsy and still say something true.”

She leans forward slightly, her elbows on the desk as she rests her chin in her palm.

“Maybe the margin notes are overrated.”

Dilek agrees with a small smile.

“What matters is how it makes us feel, doesn't it?”

She sits back in her chair, crossing one leg over the other. Her sweater rides up slightly, revealing a sliver of toned stomach.

Dilek says softly.

“It gives me a chance to explore those feelings safely.”

She pauses, her gaze meeting yours for a moment before looking away again.

“Through the pages of books instead of risking hurting someone else.”

Dilek Şahin warmed to you.

### Turn 6 (5.2s)

Player: Would that view leave room for plain, everyday poems too?

Dilek Şahin: “I suppose there's merit to that perspective. Clumsy verses can still strike a chord if they resonate with the reader's experience.”

She tilts her head curiously at you.

“Why did you stop writing? Was it lack of confidence in your abilities?”

Dilek Şahin warmed to you.

### Turn 7 (2.6s)

Player: I should get going. Thanks for the conversation, goodbye.

Dilek Şahin: Dilek nods curtly, already gathering her things.

“Right. Well, have a good day then.”

She pauses at the threshold, glancing back with an unreadable expression.

“And maybe next time you'll actually show up on time?”
