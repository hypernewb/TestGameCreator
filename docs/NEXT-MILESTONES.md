# Next milestones — modular world state

The game harness keeps authored rules separate from AI narration. Mechanics are committed as events and replayed into saves; the model receives only the state relevant to the current scene. This sequence extends the fact ledger and memory manager without tying the framework to one setting.

| Milestone | Scope | Acceptance check | Status |
|---|---|---|---|
| 9. Equipment | Optional named slots; authored item slot and description; equip, replace, remove, and automatic removal on transfer | Equipped items survive export/import and never remain equipped after giving them away | Implemented |
| 10. Relationship dimensions | Optional named 0–100 values; starting values; scripted choice effects and scene/choice requirements | A committed choice changes one dimension; a threshold controls a scene; nearby values enter AI context | Implemented |
| 11. Creator and sample | Forms for slots, item details, dimensions, starting values, event requirements and effects; a playable sample | Copy “The Maker Badge,” equip the token, choose a branch and inspect the resulting values | Implemented; Windows visual check remains |
| 12. Item operations | Stacks, consumables, persistent item attributes, and explicit use effects | No duplication under replay; failed use cannot consume an item; effects remain modular | Planned |
| 13. Social progression | Authored relationship states, promises and milestone transitions, with separate visibility per participant | Missed and kept commitments trigger distinct scripted consequences, without AI granting scores | Planned |
| 14. Campaign evaluation | Longer local-model playtest, context budget metrics, and creator diagnostics | Review 30+ turns for contradictions, irrelevant memories, and repetitive reactions | Planned |

## Try the implemented milestones

Start **The Maker Badge**, go to the Workshop, take the Brass token, and choose **Equip Brass token**. A scripted scene opens. One choice raises Brin’s familiarity, another raises rivalry. The equipment and relationship panels show the committed result. You can copy the sample into the Game Builder to edit its slots, dimension names, and scene conditions. Existing published projects and saves retain their module set.

Equipment is a single item per named slot. Item descriptions are sent when the item is equipped or named in the player’s input. Relationship dimensions for nearby characters enter the scene context; off-screen characters’ dimensions are omitted. AI text does not directly equip items or change scores.
