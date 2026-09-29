# Venus University playtest transcript (2026-09-29)

Web build v0.2.0 on itch.io, Gemini via the user's own key. Adult content not used.
Each `>` line is what the player typed. Each bullet is one click-to-advance box (the game splits a reply into beats).
`[engine]` lines are observations, not game text.

## Scene 1: Move-in day, garden → library (Ingrid Gingham)

Scripted intro (no LLM): tram arrival, walk through the Loop, gardens. Week/day counter "WK 01, 1/19, MON, DAY".
[engine] First LLM call returned HTTP 400 INVALID_ARGUMENT (bad key). The error dialog offered Retry / Return to main menu and said no progress would be lost; Continue on the main menu resumed the scene.

- (narration) She has light orange hair pulled up into a messy bun, and she keeps clutching a heavy paperback novel against her chest like it is a tiny shield against the rest of the campus.
- ??? : Um... excuse me. Do you, like... have any idea where the, you know. The library is? Or are we just supposed to wander around until we starve?
- (narration) She glances up through her tortoiseshell glasses for a brief second before immediately staring back down at her platform boots. Her fingers are already nervously tangling themselves into a strand of her bright hair.
- (player action, typed by the user before I took over, rewritten in 2nd person) You just, um. Shrug a little and tell her you are heading that way anyway. She gives a tiny, stiff nod, keeping a very deliberate three-foot distance between you as the crowd starts to shuffle along the stone path.

> I grin and bump her shoulder lightly with mine. "Starving's not an option, you're way too cute to waste away. Come on, I'll walk you there. What's your name, bookworm?"

- (echo) You grin and bump your shoulder lightly against hers, telling her starving is not an option and calling her a bookworm while asking for her name.
- (narration) She literally jumps like you just startled a deer in the middle of traffic, her eyes going wide behind her tortoiseshell glasses. [surprised sprite]
- Ingrid: Um. I... oh. Wow, okay. Um. My, like, name? It is... I mean, I am Ingrid. Ingrid Gingham. [nameplate goes from ??? to Ingrid]
- (narration) Her fingers twist even tighter into that bright orange strand of hair, pulling it into a tiny knot until her knuckle[s whiten].
- Ingrid: And I am not, um. Cute. I am just, you know. Existing. In the vicinity of everyone else.
- (narration, puppets the player) You chuckle softly and motion for her to follow as the crowd of lost freshmen finally spills off the grass and toward the grand entrance of the library. [background switches to the library]
- (narration) The heavy oak doors swing open to reveal rows of glowing screened terminals inlaid into ancient wooden shelves, smelling faintly of old paper and ozone.
- Ingrid: Oh. Oh wow. This is, um. Actually really incredible? Like, look at the spine embossing on thos[e]...
- (2 boxes skipped while advancing)
- (narration) She finally lets go of her hair, her shoulders dropping about an inch as she steps a little closer to one of the map terminals, peering down at the interface.

> I step up right behind her, lean in close over her shoulder to look at the screen, and rest my hand on the small of her back. "Existing in my vicinity is working out pretty great for me so far."

- (echo) You step right up behind her, leaning in close over her shoulder to peer at the glowing map interface.
- (narration) Your hand rests heavy and warm against the small of her back through the thick fabric of her cardigan.
- (echo, part 2) You tell her that existing in your vicinity is working out pretty great for you so far.
- (narration) Ingrid freezes completely, her breath catching in her throat like someone just pressed pause on her entire nervous system.
- Ingrid: Um. I, like... you are standing, um. Really close. In my personal space?
- (narration) Her fingers immediately fly back to her orange hair, twisting a stray lock so tightly her knuckles turn completely bloodless.
- Ingrid: And... I mean. That is just objectively a very bold thing to say to someone you met, like, five minutes ago in a crowd?
- (narration) She peers sideways at you through her tortoiseshell glasses, her pale cheeks flushing a faint, nervous pink that matches the spark of an ember.
- Ingrid: Not that... you know. I am complaining or anything. But the terminal, um. It has a database of floor plans if you actually want to find the rare manuscript section.

[engine] The echo is split in two: the physical action first, then the spoken line as indirect speech ("You tell her that..."). The player's quoted words are never shown back verbatim.
[engine] She pushes back on the touch in character ("personal space", "very bold") but doesn't shut it down, then ends on a hook (the manuscript section) that gives the player an obvious next move. Every reply so far ends on a hook or question.
[engine] Settings screen: Gemini 3.5 Flash Lite as primary, thinking "minimal"; a secondary model for solo scenes, exams, intros and texts; a toggle for ending-scene warnings; saves live in browser storage; the chat log is editable (pencil icon on each line).

> I laugh, take her hand and lace my fingers through hers. "Rare manuscripts it is. Lead the way, Ingrid, I'm not letting you get lost in here."

- (echo) You let out a low laugh and just grab her hand, weaving your fingers straight through hers before she can object.
- (echo, part 2) You tell her rare manuscripts it is and ask her to lead the way, adding that you are definitely not letting her get lost in here.
- (narration) Ingrid gasps softly at the sudden contact, her hand going totally stiff in yours for a second.
- Ingrid: Um. Oh. My hand? Like, you are just... holding it? Without asking?
- (narration) She tries to pull away for half a heartbeat before her fingers slowly, hesitantly curl back around yours.
- Ingrid: I mean. Fine. Whatever. But if we get turned around in the third-floor labyrinth and end up living off ancient parchment, it is entirely on you. [sprite switches to a small smile]

[engine] The echo adds intent the player didn't type: "before she can object" makes the grab sound more forceful than written. The narrator editorializes the player's action.
[engine] Consent beat, then acceptance: the character names the boundary ("without asking?") and then yields. The pattern (resist, then warm up) repeats twice in a row, so it's a template, not a character choice.
[engine] Streaming stalled mid-word ("Um. Oh. My") for about 40 s, with no spinner or error. The UI also lagged: clicks on LOG and Close took effect several seconds late. There was a brief frame with the background alone (sprite gone) during a transition.
[engine] Correction: the stall and the laggy clicks were most likely the browser pane throttling a hidden page (document.visibilityState was "hidden"), not the game. Don't count them against Venus.
- (narration) She turns back toward the glowing terminal with a faint, breathless huff, dragging you along by the hand while her thumb nervously brushes your knuckles.

> (no input; clicked past the last box)

- (narration) You walk side by side down the towering aisles, the hum of the library fading into a quiet, comforting stillness around you.

[engine] Clicking past the end of a reply without typing makes the narrator continue the scene on its own and move the player (auto-continue). The player is never stuck staring at a finished reply.
- Ingrid: We, um. Actually made it. Like, without getting hopelessly lost in the stacks.

> I give her hand a squeeze and pull her a little closer so our shoulders touch. "Told you I'd get you here. Now, since I'm your official library escort, what's my reward?"

[engine] The input was never sent. Pressing Return opened an "Interrupt the ending?" dialog: "Bookkeeping prompts have already been sent. They'll be thrown away if you interrupt now." (Cancel / Interrupt, plus "Don't warn me again"). I clicked Cancel and the typed action was discarded. The engine had already decided the scene was over after the auto-continue beat, even though the player was mid-flirt. Ending is engine-decided (probably a turn or beat budget), not player-decided.

- (narration) She gives your hand one last, quick squeeze before gently slipping her fingers out of yours as you reach the heavy oak doors of the archive.
- Ingrid: I should probably, like, actually check in with my orientation group before they send out a search party. But, um. Thanks. For not letting me wander off.
- (narration) She offers a small, shy smile, pulling her oversized sleeves over her hands before turning on her heel and heading back toward the main lobby. [sprite fades out]
- (narration) You watch her go, standing alone in the quiet corridor as the weight of the sprawling campus settles back down around you.
- (system) Heart went up by 1.
- (system) Ingrid liked that Ingrid liked that you held her hand.
- (system) Your Brain needs to be at least Good to catch Ingrid's interest.
- [transition card] Monday / EVENING, WEEK 1, 1/19 / Freshman Orientation

[engine] End-of-scene bookkeeping: a separate LLM pass ("bookkeeping prompts") reads the scene and emits (a) stat deltas ("Heart went up by 1"; Heart is a player stat, not per-NPC affection), (b) one-line "X liked that ..." reasons, and (c) a deterministic gate check against a player stat ("Brain needs to be at least Good"). The gate is what actually decides romance progress; four turns of flirting that the narrator received warmly still hit a hard wall.
[engine] Bug: the reason line duplicates the subject ("Ingrid liked that Ingrid liked that..."). Template + LLM output both prefix the name; nobody sanitizes it.
[engine] Critique: the narrator's warm reactions and the gate disagree. The player gets smiles and hand-squeezes, then a system line saying she isn't interested. The LLM is never told about the gate during the scene, so the fiction and the rules diverge. Better: feed the gate into the scene prompt ("she's polite but not into you yet") or surface it before the scene.
[engine] Scene was short: 4 player inputs + 1 auto-continue, then the engine closed it. Scene length is budgeted, not open-ended, which is why a playthrough feels paced.
[engine] Time advances in slots (DAY → EVENING) with a full-screen day card and a scene title. One scene per slot.

## Hub: Monday evening, dorm

[engine] Planning hub, not a scene. It shows "Monday 1/19 · Evening", Balance $100, and a Brain/Body/Heart triangle (all "Unremarkable"). "What would you like to do?" offers three suggestions, one per stat:
- Improve Brain by learning about marine life at the Aquarium at Riverside.
- Improve Body by swimming laps in the Palestra pool.
- Improve Heart by watching a rom-com movie at Future Cinema.
[engine] It also has a free-text "Something else?" box and Bunnyboard, Calendar and Log buttons. Every suggestion names a place, an activity and a stat, so the choice is readable at a glance.

> Go to the campus bar, find a cute girl and buy her a drink

[engine] Blocked. Full-screen "Something went wrong", code LLM_BLOCKED: "Google (Gemini) refused the prompt (PROHIBITED_CONTENT). Try wording the action differently." There were two buttons, "Manually edit prompt" and "Change it". It was probably a college-freshman-plus-alcohol trigger on the provider side, not a game rule, and the game has no content layer of its own to rephrase the request before sending it. I clicked "Change it".

## Scene 2: café with Ami (and Lili)

[engine] The log's YOU entry shows what was actually sent. The original text plus two appended engine lines:
  "Go to the campus bar, find a cute girl and buy her a drink / They happen to run into someone they don't know. / They happen to run into two people they don't know."
"Change it" didn't rewrite my text. It appended a random-encounter directive, and the retry appended a second one. The bar became a tea café (CuteTea) and the drink purchase disappeared. Balance was never touched.

- (narration) The afternoon air smells like brewed jasmine and damp pavement, classic Veridan spring. You slide into the booth opposite Ami, fingers brushing against the chilled edge of your ceramic cup.
- Ami: Um. You actually, like, made it. I was starting to think you ghosted for another study session at the library?
- (narration, puppets the player) You shake your head, offering a quiet, lopsided smile as you trace the rim of your tea.
- Ami: Good. Because I just, um. Felt this... buoyancy. Like, I don't have to be so energetic anymore? I dunno.
- (narration) The bell above the café door chimes, and Lili slides into the seat beside you, dropping her heavy canvas tote with a soft thud. [second sprite enters; background swaps to a board-game table]
- Lili: Don't start without me. The line at the counter was, like, a literal crime scene.
- Ami: We were just talking about how you always manage to look put together after a three-hour lecture.

> (typed twice, neither was sent) I slide your cup closer and nudge your knee with mine under the table. "Ghost you? Not a chance. Next round's on me, what are you drinking, gorgeous?"
> I scoot over so Lili fits, which puts my thigh right against Ami's. "Hey Lili. ... I'm buying you both a drink, my treat..."

[engine] Neither input reached the log. The action box is hidden ("HOVER TO SHOW ACTION BOX") while beats are playing. My typing went to the page, and Return just advanced the beat, so the narrator kept puppeting me ("You shake your head, offering a quiet, lopsided smile"). Part of this is the automation, since hover is unreliable in a throttled pane. But a human would hit the same trap: there's no visible input focus, and Return does two different things depending on whether the box is open.
[engine] Continuity errors in four lines:
  - The clock says NIGHT and the narrator says "afternoon".
  - The directive says strangers, yet Ami greets me as a friend who might have "ghosted" her and Lili acts like a regular ("Don't start without me").
  - It's Week 1, day 1 of orientation, and they reference "a three-hour lecture".
  - I asked for a bar and got a café.
  The scene prompt doesn't carry the time slot, the relationship state (never met), or the calendar position strongly enough to win over the model's defaults.
[engine] Voice sameness: Ami (leather jacket, choker, "cool" look) talks exactly like Ingrid ("Um.", "like,", "I dunno."). Both NPCs share the same verbal tic set, so the costume and the sprite do the characterization and the dialogue doesn't.
[engine] Ami's "buoyancy... don't have to be so energetic" line answers nothing. It reads like a leaked trait/mood directive spoken aloud.
[engine] 1-on-1 got broken by the engine's own random encounter (the "two people" roll). That made a planned flirt into a group hangout without the player asking.

[engine] Handover: from here the user clicks and types; I read the chat log after each stretch.

### Scene 2, continued (user playing)

- Lili: Please. My brain is basically fried oatmeal right now. But... seeing you two helps.
- (narration) You feel the heat radiating off both of them across the small wooden table, a heavy, unspoken current humming beneath the clatter of porcelain cups.

> Flirt with them

- (echo/expansion) You lean across the table slightly, dropping your voice into something a little lower and letting a slow, easy grin spread across your face.
- (narration) Ami taps her fingernails against the scarred wood in a sharp, syncopated rhythm, her dark yellow eyes narrowing just a fraction as she looks you over.
- Ami: Oh. Okay, Mr. Smooth. Like, watch out before you actually start a fire in here or something.
- (narration) Lili gasps softly behind her hand, her blue eyes widening as she tilts her head and flashes a bright, practiced smile straight at your phone camera.
- Lili: Wait, hold on, say that again for the livestream chat? Because my followers are literally going to pass out from this.

[engine] A three-word meta command ("Flirt with them") works. The engine turns it into a concrete physical beat (lean in, lower voice, grin). Low-effort input still gives a scene, which is a big part of why it feels smooth. Cost: no actual line is spoken, yet Ami reacts as if she'd heard a great line ("Mr. Smooth"), and Lili asks me to "say that again". The prose refers to dialogue that doesn't exist.
[engine] "Mr. Smooth" assumes the player's gender. Nothing in character setup that I saw fixed it.
[engine] Lili "flashes a practiced smile straight at your phone camera", but she's the one streaming, so this should be her phone. Ownership slip.
[engine] Characterization does show up here, through a hook: Lili is the streamer, and the livestream gives the player an obvious next move (say it again, play to the audience, or ask her to turn it off). That's the ends-on-a-hook rule again, but it comes from her trait, not a generic question.
[engine] Heat line ("a heavy, unspoken current humming beneath...") fires before the player flirted. The narrator escalates romantic tension by itself, ahead of the player.

- (narration) The steam rising from the ceramic cups seems to thicken, carrying the sweet scent of jasmine and the heavy, buzzing energy of too many thoughts left unsaid.

> tell them you would love to hang out with them on sunday

- (echo) You tell them you would love to hang out on Sunday, keeping your voice low and casual.
- Ami: Sunday, huh. Like, that's bold. I usually spend Sundays just, um, sleeping off the weekend... but maybe I can make room for you.
- Lili: Oh, wow. Okay, Sunday stream collab? Wait, no, just hanging out. That is, like, super sweet of you to suggest.
- (narration) The atmosphere at the table shifts, feeling less like a random café encounter and more like a challenge thrown down between the three of you.
- Ami: Anyway. My tea is practically ice at this point. We should probably, you know, get moving before they kick us out.
- Lili: True. Plus my phone battery is dying and my DMs are blowing up. But, um, text me later, okay?
- (narration, background → Stanchion Street) You all step out onto the damp Stanchion Street pavement, the neon signs reflecting in the puddles as the two girls head off in opposite directions into the Veridan night.
- (narration) You stand alone on the damp pavement of Stanchion Street, watching the last of the neon glare blur against the wet asphalt.
- (narration) The hum of the highway overhead fades into a dull, rhythmic pulse, leaving you with just the quiet chill of the Veridan night and the faint taste of jasmine still lingering in the air.
- (end card) Heart went up by 1. / You spent $12. (balance panel: $100, -$12)

### Scene 2 end: memory editor (user screenshot)
"Edit memories?" dialog: "Add anything else the characters should remember after this scene... injected in every scene the character is in. Use past-tense and refer to yourself as 'the reader'."
- Ami | liked | that "the reader joined her at the café"
- Lili | liked | that "the reader flirted with them"
- ??? (pink-haired sprite, never appeared in the log) | liked | (empty)

### Friends panel (user screenshot)
Discover people: Ingrid Gingham @ingrid_gingham, Lili Milderose @lili_milderose, Ami Holloway @ami.holloway, each with an Add button. Contacts · 0: "No friends yet. Try adding people you know."

### Scene 3: Attend Global Survey of Art History: Antiquity to Renaissance (user playing, Tue day)
- (narration) You slide into a cramped wooden seat near the back of the lecture hall just as Professor Johnson clears his throat into the microphone, launching right into a brutally fast overview of the syllabus.
- (narration) A girl a few rows up with aqua hair and pastel pink tweed adjusts her gold pendant necklace, her eyes darting nervously toward the giant projector screen flashing neoclassical columns and terrifying midterm weightings.
- Celest: Oh, um... forty percent for just the final? Boje moj. That is, like, so much heavier than I thought...
- (narration) To your left, a senior in a sharp dark blue dress sighs softly, running a manicured fingernail down her lower lip while she stares at the syllabus with cool, practiced disdain.
- Isabelle: Honestly. If people can not handle basic Greco-Roman iconography by week two, they really ought to just switch to communications.
- Celest: Um, excuse me? Are you... talking about the reading list? Because it looks sort of gigantic, da?
- Isabelle: It is only gigantic if your attention span peaks at picture books. Though I suppose some freshmen need the extra hand-holding.
- (narration) The aqua-haired girl shrinks back into her pastel jacket, offering a tight, apologetic little bow to the empty air between them while she furiously starts sketching tiny ionic capitals in the margins of her notebook.

> Introduce yourself and ask for their names

- (echo) You lean forward slightly, clearing your throat to offer your name and ask who they are.
- Celest: Oh! Um. Hello. I am... well, my name is Celest. It is very, like, nice to meet you?
- (narration) Celest dips her head in a quick, overly formal bow while offering a nervous, blindingly bright smile.
- Isabelle: Isabelle Carmen. Senior. And unless you have something actually insightful to contribute about Hellenistic sculpture, I suggest we let Professor Johnson drone on in peace.
- (narration) Professor Johnson's raspy voice cuts through the hall again as he clicks to the next slide, detailing an endless reading list that smells faintly of old paper and anxiety.
- (narration) Professor Johnson's monotonous drone fills the remaining minutes of class until the lecture finally ends, prompting the room to erupt into the rustle of papers and snapping notebook binders.
- Celest: Um. Well. Good luck with the reading, da? I am going to go find some jasmine tea before my head explodes.
- Isabelle: Try to keep up next time. Some of us actually have standards to maintain.
- (narration) You pack your notebook away in silence as the students file out into the hallway, leaving you alone with the faint scent of old paper and the lingering chill of the lecture hall.
- (end card) Turns out going to class pays off! Brain went up by 1. / Celest liked that you introduced yourself to her during class. / Your Heart needs to be at least Good to catch Celest's interest. / Isabelle disliked that you interrupted her while she was listening to the lecture.

### Scene 4: Attend Pilates Mat Work and Core Stability (user playing, Tue night)
- (narration) You just, um. Drag your tired legs into the campus gym for Pilates. Like, it is Tuesday night and your core is already screaming? I dunno.
- (narration) The rubber mat feels cold beneath your socks. Across the polished floor, two girls who clearly hate each other's guts are stretching in dead silence.
- (narration) The one with the dark wolf cut clicks her tongue. She refuses to even look in the other's direction, glaring right through the wall.
- (narration) Meanwhile, the blonde senior keeps checking her own pulse. She breathes in and out with this weird, porcelain perfection that feels kind of terrifying.
- (narration) You set your mat down a few feet away. You just, um. Try to blend into the background. Like, maybe if you don't make eye contact, nobody will notice you exist.

> Work hard and pay attention while introducing yourself to the two of them and ask for their names

- (echo) You just, um. Dive into the plank work and try to look useful. Like, your abs are burning, but you turn to the two girls and mutter your name.
- (echo) You ask what they're called while trying not to shake during the side crunch.
- Gwen: Gwen. Whatever.
- (narration) She snaps the word out like it's a piece of trash. Then she immediately goes back to staring at the baseboard with this murderous intensity.
- Winter: Oh... hello. I am Winter.
- (narration) Winter offers this terrifyingly serene, porcelain smile that doesn't reach her light blue eyes at all. Like, her fingers brush her wrist to check her pulse again while she holds the pose.
- (narration) Coach Everhart wanders past your group, muttering something about pelvic alignment and breathing through the filament of your spine. Like, she doesn't even notice the sheer hostility vibrating between the two girls.

> Help winter with her form while telling gwen her posture is amazing

- (echo) You just, um. Reach out to adjust Winter's shoulder alignment while telling Gwen her posture is, like, legitimately amazing.
- (narration) Winter freezes up completely. Her light blue eyes widen just a fraction, and she presses her fingers against her wrist again like her heart might literally jump out of her chest.
- Winter: Oh... um. Thank you. I suppose I was, like, curving a bit too much there...
- (narration) Across the gap, Gwen makes this sharp, clicking sound with her tongue. She doesn't look up from the floor, but her jaw clenches so hard a muscle twitches in her cheek.
- Gwen: Shut up.
- (narration) She spits the words out into her yoga mat. Like, the sheer venom in her voice could probably strip paint off the wall.
- (narration) Winter pulls back immediately, smoothing down her off-shoulder sweater with trembling fingers and wearing that empty, porcelain mask again.
- Winter: Some people simply lack basic... spatial etiquette. Don't mind her. Or do. It doesn't matter.
- (narration) Coach Everhart blows a shrill plastic whistle that echoes off the high rafters, yelling about core endurance and pelvic tilt. Like, thank god for the interruption.

> Continue working hard to ensure good form

- (echo) You just, um. Keep your head down and focus on keeping your form tight. Like, every muscle in your core is burning like hell, but you refuse to let up.
- (narration) Winter glances over at you from her mat, her expression softening just a tiny fraction before she quickly pulls that porcelain mask right back on.
- Winter: You are, um. Working quite hard. Most freshman tend to give up by now...
- (narration) She murmurs the words softly, her slender fingers tracing a slow circle over her wrist like she is trying to count every single beat of her pulse.
- (narration) Across the space, Gwen makes a harsh, wet sound in the back of her throat. She shifts into a side plank with so much force her mat slides an inch across the polished floor.
- Gwen: Stop talking. Just... do the damn exercise.
- (narration) She spits the words right into the rubber flooring, her dark red wolf cut hiding her eyes completely as her jaw works in tight, jerky rhythms.
- (narration) You ignore the hostility and just keep grinding through the hundred series, breathing out on the exertion while your abs feel like actual jelly.
- (narration) Coach Everhart finally calls out the end of the set over the gym speakers, telling everyone to grab their water bottles and clear the floor for the next rotation.
- (narration) Winter grabs her bag without a word, slipping away toward the locker rooms while keeping her gaze locked firmly on the floor. Like, she doesn't even look back.
- (narration) Gwen practically stomps past you on her way out, her jaw still locked tight and her dark red hair swaying with aggressive energy. She doesn't spare you a single glance.
- (narration) You just, um. Stand there in the quiet gym for a second, letting your burning muscles finally relax. Like, what a brutal start to the semester.
- (end card) Turns out going to class pays off! Body went up by 1. / Winter liked that you helped her adjust her shoulder alignment. / Your Heart needs to be at least Good to catch Winter's interest. / Gwen disliked that you tried to talk to her and complimented her posture.

### Day card: Wednesday morning
January 21, Wednesday day. Day 3 of the semester.
- The rain taps a dull, heavy rhythm against the single-pane window of your Lowrise 4 room, pulling you slowly from a tangled, half-remembered dream about core workouts and art history syllabi.
- You sit up on the edge of the narrow mattress, rubbing the sleep from your eyes while the radiator hisses a dry, metallic heat into the chilly air.
- Outside, the campus looks washed out and grey under the constant drizzle, the colorful stone pathways glistening with puddles as hooded figures dash between buildings with heads ducked low.
- Your muscles still ache from yesterday's Pilates session with Gwen and Winter, a lingering, tight burn that keeps your mind replaying the awkward silence in the gym.
- Down in the Lowrise 2 common kitchen, a rumor is already spreading through the group chat that someone smuggled a whole case of imported matcha treats from the city and is trading them for favors before the lunch rush hits.
