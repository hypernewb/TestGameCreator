# Character-sheet fixed lists — T-021
Status: draft for owner approval; no mechanics or campus data changed.
IDs below are closed vocabularies. Pick 2–4 unique personality IDs; retain free notes without loss. Meanings describe possible future engine hooks, not current behavior or automatic rewards.
Traits, gift tastes, experience and sensitivity never imply consent; explicit agreements, per-character rules and runtime consent remain separate.

## Personality traits (28)
Source: new campus-derived vocabulary (`packs/campus.json`, actors); `.venus/shared/traits.ts` supplies the closed-switch pattern (warm ≈ Good-natured; exacting ≈ High Standards), not these IDs. `.rp-master/src/lib/characters/traitPresets.ts` generates open archetype/quirk options, not a fixed personality list.
| ID | One-line engine meaning: could affect |
| --- | --- |
| warm | Weight considerate listening and supportive conversation more positively. |
| sporty | Favor physical activities and fitness-related attraction preferences. |
| curious | Favor new topics, questions and discoveries over repeated small talk. |
| homesick | Favor familiar places, traditions and contact with people back home. |
| stubborn | Resist unsolicited direction and favor choices made on her own terms. |
| ambitious | Favor goal support and demonstrated effort in work or study. |
| composed | Favor calm responses and restrained reactions during conflict. |
| dry | Favor understated wit over exaggerated praise or performative jokes. |
| exacting | Favor precision, punctuality and preparation; react to careless execution. |
| guarded | Pace personal disclosure and distinguish private from public teasing. |
| mischievous | Favor reciprocal teasing and harmless surprises in activity reactions. |
| expressive | Favor lively conversation and energetic social settings. |
| creative | Favor engagement with creative work and original activity ideas. |
| flirtatious | Favor reciprocal verbal flirting when welcome under authored rules. |
| rebellious | React poorly to imposed authority and favor independent choices. |
| analytical | Favor clear explanations, evidence and talking plans through. |
| adventurous | Favor unfamiliar outings and exploration within authored availability. |
| practical | Favor useful help and feasible plans over elaborate gestures. |
| low_drama | Favor direct conflict resolution and react poorly to provocation. |
| extroverted | Favor group activities and more frequent social outreach. |
| loyal | Favor keeping promises and supporting established social connections. |
| insecure | Give reassurance and dismissive remarks greater weight in authored reactions. |
| reserved | Favor quiet settings and slower social outreach. |
| patient | Tolerate delays and favor gradual conversation or relationship pacing. |
| spontaneous | Favor last-minute invitations when schedules permit. |
| romantic | Favor sentimental date themes and gestures, independent of gift tastes. |
| competitive | Favor friendly contests and achievement-based activity reactions. |
| generous | Favor sharing resources and offering practical support to others. |

## Gift categories (12)
Source: IDs retained from `.venus/shared/shop.ts`, `GIFT_CATEGORIES` / `GIFT_CATEGORY_DESCRIPTIONS`; `.rp-master/src/lib/characters/cardSpec.ts` has item scores and free-text giftLikes/giftDislikes, not this enum.
| ID | Coverage |
| --- | --- |
| romantic | Flowers, sentimental keepsakes and affectionate gestures. |
| cute | Plushies, mascots and small adorable objects. |
| luxury | Designer goods, precious materials and conspicuous expense. |
| glamour | Fashion, cosmetics, perfume and jewelry. |
| cozy | Home comforts, plants, blankets and calming decor. |
| practical | Useful everyday objects, stationery and activity equipment. |
| nerdy | Puzzles, games, film, technical kits and collectibles. |
| artsy | Music, art, crafts, design and creative tools. |
| treats | Food and drink, including baked goods, coffee and alcohol. |
| edgy | Dark, unusual or subculture-themed objects. |
| vintage | Retro, nostalgic, antique and secondhand objects. |
| novelty | Gag gifts and whimsical conversation pieces. |
Draft contract: liked/disliked sets must be disjoint; omitted categories are neutral only after review. Items may have several tags; an explicit item taste takes precedence over category taste. No score formula proposed here.
Item coverage: latte/cinnamon-roll/energy-bar/pint/cider/whiskey-shot → treats; fountain-pen → practical; puzzle-cube → nerdy; sea-glass pendant → glamour; vinyl-record → artsy + nerdy + edgy; red-roses/sunflowers → romantic. Final tags require review; one flower dislike need not apply to every flower.

## Sexual-experience levels (5, ordered by recurrence)
Source: new taxonomy; `.venus/shared/types.ts` offers datingHistory + isVirgin, and `.venus/shared/relationship.ts` separates authored history from runtime hadSex. No five-level scale exists in the permitted rp-master character files.
| Rank / ID | One-line meaning |
| --- | --- |
| 0 / none | No prior partnered sexual contact, as explicitly defined in authored history. |
| 1 / first_encounter | One prior partnered sexual encounter; individual acts may still be firsts. |
| 2 / occasional | More than one prior encounter, with sexual activity described as occasional. |
| 3 / recurring | Prior recurring sexual activity within one or more relationships. |
| 4 / extensive | A substantial history of recurring sexual activity, explicitly chosen by the owner. |
Null means unassigned, outside the ordered levels; it is not none. Levels summarize frequency, not skill, willingness, partner count or relationship style. Prior kissing/dating alone does not establish a level.
For firsts, the level can support a broad first-partnered-encounter check only when history is explicit; act-specific firsts need authored per-act history plus runtime records. “first-night” in campus is a category, not proof of no previous partners. Never derive a level from openness, casual status or narrative confidence.

## Touch body-region map (29 regions; provisional)
Source: `.rp-master/src/lib/characters/cardSpec.ts`, `touchProfile`, explicitly separates response from filtering. Its imported `src/lib/dating/touch.ts` is absent from this checkout, so exact rp-master IDs/coverage cannot be verified; the following complete head-to-foot proposal and scales are new, pending owner approval.
Closed region IDs: `scalp`, `face`, `ears`, `lips`, `neck`, `shoulders`, `upper_arms`, `forearms`, `wrists`, `hands`, `upper_back`, `lower_back`, `chest`, `breasts`, `nipples`, `abdomen`, `waist`, `hips`, `buttocks`, `groin`, `external_genitals`, `perineum`, `anus`, `outer_thighs`, `inner_thighs`, `knees`, `lower_legs`, `ankles`, `feet`.
Coverage: chest excludes breast/nipple tissue; breasts exclude nipples; groin excludes external genitals/perineum/anus. Use external_genitals for applicable anatomy, described in free notes; paired regions share one entry with optional side-specific notes. These are touch surfaces, not an act menu.
Each region holds sensitivity and limit independently; all 29 entries must be reviewed. Unassigned values stay null, never silently become 0 or ok.
Sensitivity: `0` = no special response; `1` = mild; `2` = strong; `3` = very strong. Response intensity is neither pleasure nor permission; character notes describe its quality. Scale use awaits integration.
Limits: `ok` = authored comfort with touch in this region, subject to runtime consent/context; `ask_first` = requires explicit permission for this touch/context; `never` = authored hard prohibition that runtime permission cannot override. Owner editing the sheet is separate from play.
Rules: a limit wins over sensitivity; traits, arousal and experience cannot bypass it. Campus privacy restrictions and category/agreement requirements remain separate rules, never inferred region permissions.

## Campus coverage (proposals only; all existing text retained)
Source: `packs/campus.json`, actors, items, actProfiles and intimacyProfiles. Arrows normalize authored words; broad category tastes are review proposals, not established facts. No gift-dislike inference from social dislikes.
| Character | Proposed 2–4 traits | Retained trait notes / aliases | Gift-category proposal and evidence | Experience / touch |
| --- | --- | --- | --- | --- |
| Jana | warm, sporty, curious, stubborn | quietly stubborn → stubborn; homesick retained in notes | Liked treats: cinnamon-roll gift +6; other tastes unassigned | Level null; all region values null; retain public-touch −2, slow/self-directed interest, monogamous requirement, talk aftercare. |
| Monique | ambitious, composed, exacting, guarded | dry retained in notes | Liked practical: fountain-pen gift +6; other tastes unassigned | Level null; all region values null; retain exclusive-phase requirement, pace-setting interest, stay aftercare. |
| Nova | mischievous, creative, flirtatious, rebellious | loud → expressive in notes; anti-authority → rebellious | Liked artsy/nerdy/edgy: horror vinyl gift +6; other tastes unassigned | Level null; all region values null; retain casual eligibility, first-night/fling categories, playful interest, talk aftercare. |
| Abigail | analytical, warm, adventurous, practical | low-drama → low_drama retained in notes | Liked nerdy: puzzle-cube gift +6; romantic dislike proposed from red-roses −3, not generalized without approval | Level null; all region values null; retain talk-first interest, stay aftercare and existing eligibility. |
| Kaylee (friend) | warm, extroverted, loyal, insecure | sweet → warm; bubbly retained as expressive notes; a little insecure → insecure | Liked treats proposed from iced lattes; no gift-rule evidence; other tastes unassigned | Level null; all region values null; no intimacyProfile authored; create no intimate preferences or eligibility. |
Coverage does not turn the sea, volleyball, punctuality, karaoke or social dislikes into gift categories: retain them as general likes/dislikes. Item-specific rules and all intimate content remain unchanged until the owner chooses any new sheet values.
