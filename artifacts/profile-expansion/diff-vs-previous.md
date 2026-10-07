# Deep profile demo — diff vs previous generation output

All three profiles pass `normalizeCharacter` (the exact path a generated draft takes), so they are exactly what the new schema elicits. No model calls were made.

## Previous output fields (per character)

- name
- pronouns
- age
- description
- personality
- behavior(5)
- backstory
- goal
- traits
- likes
- dislikes
- voice
- style
- examples
- conversationStarters
- flaws
- routine
- year
- major
- dorm
- depth

## New output fields (added by this ticket)

- profile.everyday(living,circle,leisure,habits,concerns)
- profile.persona(archetype,public,private,strengths,insecurities,pride,contradictions)
- profile.voice(formality,humour,directness,teasing,vocabulary)
- profile.romance(shows,attractedBy,discouragedBy,initiation,pace,compliments,unwelcome,close)
- profile.body(posture,tells,space,attention)
- profile.scenes(problems,shared,invitations,unfinished)

## Voice contrast (the point: three clearly different speakers)

| Character | Archetype | Formality | Humour | Directness | Teasing | Pace | Initiation | Unwelcome | Space |
|---|---|---|---|---|---|---|---|---|---|
| Yuki Aihara | gentle-grump | casual | deadpan | blunt | sharp-but-kind | slow | invites | honest | arm-s-length |
| Mio Tachibana | competitive-rival | slangy | teasing | brutally-honest | relentless | eager | makes-moves | tease_back | close |
| Sota Kawaguchi | old-soul-homebody | shifting | wordplay | hedges | gentle | measured | hints | flustered | untouchable |

Voice dimensions where all three differ: formality, humour, directness, teasing (4 of 4).

## Everyday-life contrast
- **Yuki Aihara** (29) — living: workplace-housing; leisure: restoring a derelict sloop she will not explain; open-water swimming before the market opens; concerns: the chain marina lease vote in March; her father's medical bills arriving from a town she left
- **Mio Tachibana** (26) — living: with-family; leisure: Street Fighter tournaments; entry fee scrupulously earned; beach volleyball with whoever's playing; concerns: the food hall undercutting her lunch rush; grandpa's hands shaking worse every month
- **Sota Kawaguchi** (31) — living: alone; leisure: collecting door-hinge recordings on a handheld recorder; chess by post with a man he has never met; concerns: the concert hall board may sell the Bösendorfer instead of restoring it; rent going up on the workshop he just soundproofed

## Romantic-behaviour contrast (manner only; scores/consent stay engine-owned)
- **Yuki Aihara** — shows interest: rewrites their gear list in her own handwriting; attracted by: people who admit what they don't know without grovelling; discouraged by: being managed; once close: Builds small rituals and never names them: the 4pm coffee, the same bench, your own key to the tool locker.
- **Mio Tachibana** — shows interest: invents competitions tailored so they might win; attracted by: people who actually try to beat her; discouraged by: letting her win; once close: Puts them in the standings list ('us' division), defends their rank against all comers, and lets them see her quiet half hour after close.
- **Sota Kawaguchi** — shows interest: composes an eight-bar motif from their name; attracted by: people who ask a second question about his work and wait for the answer; discouraged by: 'you could have gone professional'; once close: Repairs things in their home without being asked, learns their silences, and plays for them with the windows open, which is his version of a key.

## Sample lines (from examples, one per character)
- Yuki Aihara: “Tide turns at four. If you want your stuff, it's on the dock at four, not four-forty.”
- Mio Tachibana: “Two bowls, one egg, best broth on the pier — eating here is the correct choice, declining it is a ranking you'll have to live with.”
- Sota Kawaguchi: “This piano is a half-step flat and a tragedy; let us begin with the tragedy.”
