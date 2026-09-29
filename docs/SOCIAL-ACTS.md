# Social acts, change arcs, and sobriety

Add `social.acts: "0.1.0"`, `character.arc: "0.1.0"`, and `character.sobriety: "0.1.0"` to a pack's `modules` map as needed. Acts also require `social.dating`, `social.romance-tempo`, and `items.inventory`.

## Likes and limits

`actProfiles` contains one table per character. Each entry has a unique `id`, a kind, a target (`*` for any), signed `points`, and a nonempty `reason`. Positive points are likes; negative points are limits. `when:{private:false}` matches only a public scene. Optional `memory` is copied into the act event for the scene service to store. `fallback:{landed:2,missed:-2}` prices unmatched tags; `sizeMultiplier`, `sceneCap`, and `repeatDecayPercent` control scale, scene total, and same-day repeats. Points pass through romance-tempo's rank ceiling.

The `social.priceActs` command accepts a focus `character`, `sceneId`, `source`, optional `private`, and up to four `{kind,target,size,landed}` tags. Unknown kinds and overlong targets are ignored. The module emits `social.actPriced` for each accepted tag and `social.actDiscovered` when an entry first matches. `knownActs` exposes discoveries; `narratorBrief` exposes up to four private hints; `sceneVerdicts` folds priced events for the scene card.

For `buy:coffee`, the item must be sold at the player's current location and affordable. One unit moves from the shop to the player, then to the character, and the economy charges once. Romance-tempo's existing gift preference prices the transfer; the act table does not add points a second time. Bought gifts follow romance-tempo's cadence and rank ceiling; the act table's scene cap applies to other acts. An unaffordable or unavailable purchase emits an `unpaid` verdict and changes no money or affection.

For `invite:afternoon@cafe`, `invite:tomorrow-evening@cafe`, or `invite:saturday-evening@cafe`, the module stores a pending plan with a calendar deadline. When `story.scenes` is enabled, it also writes the plan to that module's existing plan ledger, so `when.plans` can read it. A meeting scene with that character at the named place keeps it. After its daypart passes, the plan becomes broken and costs three romance points. The place must be a pack location. These plans use the same calendar clock as daypart and phone offers; the invitation does not move either character immediately.

## Change arcs

`arcTracks` lists hidden `traits` (`id`, `initial` from 0 to 100), `drift` rules (`{act,target,trait,delta}` or `{event,trait,delta}`), and ordered `stages` (`id`, `name`, `when` threshold map, `voice`, optional `flag`). Drift is clamped to 0–100. Stages advance once and set their flag in `state.flags`, where scene conditions already read it. A stage can make content eligible; it never grants consent.

## Sobriety

`sobriety:{drinkItems:['beer'],tipsyAt:2,drunkAt:3,soberPerDaypart:1}` tracks drinks given to a character, including drinks bought through an act. `sobrietyOf(state,pack,character)` returns `sober`, `tipsy`, or `drunk`. The count falls when the calendar crosses a daypart boundary. The intimacy module enforces consent restrictions separately.
