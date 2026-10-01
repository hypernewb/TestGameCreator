# Character Sheet: design card
Status: draft · Tickets: T-013

## Goal (what the player feels)
I'm interacting with a whole person. She has a past, preferences, and boundaries that I can learn over time. Her personality is consistent, and she feels alive because she has her own life and schedule outside of our interactions.

## What we have (self-audit, cite docs/map)
Our current `Actor` definition (`packs/campus.json`) is a minimal set of fields for AI flavor (name, description, style, traits, etc.). Most mechanical data is bolted on by modules (`docs/map/modules.md`), scattering stats, relationship scores, and progression across different systems (`packages/modules/stats.mjs`, `social.mjs`, `dating.mjs`). There is no central, rich character concept.

## Reference games (2–3, one line each)
- **rp-master**: Very deep character sheet with structured fields for personality, behavior, social links, touch/kink profiles, and a weekly schedule (`.rp-master/src/lib/characters/cardSpec.ts`).
- **Venus**: AI-generated characters from a detailed prompt, covering personality, appearance, love life, and preferences, but less mechanically deep than rp-master (`.venus/prompts/characterPrompt.ts`).

## "Reference games" (Comparison Table)

| Category | Field | story-framework | rp-master | Venus | Engine Use |
|---|---|---|---|---|---|
| **Identity** | Name, Pronouns | ✓ | ✓ | ✓ | Core |
| | Physical Description | ✗ | ✓ | ✓ | Prompt |
| | Age, Birthday | ✗ | ✓ | ✗ | Schedule, Gifting |
| | Occupation/Workplace | ✗ | ✓ | ✗ | Schedule, Flavor |
| | Social Connections | ✗ | ✓ | ✗ | Social Sim |
| **Personality**| Archetype/Core Premise | `description` | `personality` | `personality`| Prompt |
| | Traits (keywords) | `traits` | `tags` | `traits` | Prompt, Logic |
| | Backstory | `backstory`| `backstory` | `backstory`| Prompt |
| | Goals / Motivation | `goal` | `goals` | ✗ | Prompt, AI Logic |
| | Behavioral Rules | ✗ | ✓ | ✓ (staged) | Prompt, AI Logic |
| **Voice** | Dialogue Examples | `examples` | `mes_example`| ✗ | Prompt |
| | Voice/Dialect Notes | `style`, `voice` | `voiceFingerprint`| `voice` | Prompt |
| **Likes/Gifts**| General Likes/Dislikes| `likes`, `dislikes` | `likes` | `likes`, `dislikes`| Prompt, Discovery |
| | Gift Preferences | ✗ | ✓ (numeric) | ✓ (category) | Gifting Module |
| | Love Language | ✗ | ✓ | ✗ | Prompt, Gifting |
| **Touch/Intimacy**| Kink/Fetish Profile | `intimacy` module | ✓ (detailed) | ✓ | Intimacy Module |
| | Touch Preferences | `intimacy` module | ✓ (regions) | ✗ | Intimacy Module |
| | Sexual History | ✗ | ✗ | ✓ | Prompt |
| **Schedule** | Weekly Schedule | `schedules` | ✓ | ✗ | Schedule Module |
| | Frequented Locations | ✗ | ✓ | ✗ | Schedule, Flavor |
| | Proactive Behavior | ✗ | ✓ (outreach) | ✗ | Ambient AI |
| **Progression**| Story Arc / Stages | `arc` module | `relationshipStarters` | ✗ | Progression Module|
| | Unlockable Gallery | ✗ | ✓ | ✗ | Progression Module|

## Creator option (field, modes, campus default; creator UI screen)
A new "Characters" section in the creator UI would allow editing the full character sheet.
- **UI:** A tabbed interface: Identity, Personality, Appearance, Gameplay (Likes/Gifts/Schedule), and Intimacy.
- **Fields:** Most fields are text inputs. Schedule gets a visual weekly grid. Touch/Kink profiles get a list-based editor or a visual body map.
- **AI Assist:** "Suggest" buttons for fields like traits, likes, and backstory, potentially using Venus's seed-word idea (`.venus/prompts/seedWords.ts`).
- **Campus Default:** Start with a simplified sheet (Identity, Personality text fields) and expand as modules are built. The full sheet is the goal.

## Owner decisions
- 2026-10-01 Personality: closed trait list (2–4, engine-readable) + free notes for the AI.
- 2026-10-01 Gifts: liked/disliked categories per heroine.
- 2026-10-01 Touch prefs: full rp-master body-region map (sensitivity + limits per region).
- 2026-10-01 Sheet rollout: all fields now (creator tabs) + AI "Suggest" auto-fill from seed words; wire mechanics system by system.
## Thin slice → full version
1.  **Thin Slice:** Add all new fields from the `rp-master` spec to our `Actor` definition in `packages/contracts/index.d.ts` and `packs/campus.json`. All fields are simple text/arrays for now. No new engine logic reads them; they only enrich the AI prompt.
2.  **Full Version:** Implement the engine modules that use these new fields mechanically: a deeper Gifting module reading `giftPreferences`, an Intimacy module using the `touchProfile`/`kinkProfile`, and a Schedule module that enables ambient, proactive character behavior based on their `schedule` and `outreach` settings. The creator UI gets visual editors for these complex types.
