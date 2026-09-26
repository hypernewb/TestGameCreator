// Adapted from Venus University src/renderer/stores/stageDisplay.ts,
// commit 79301df55bc39a0996229ccc6f12ccce422a80b2.
// Copyright Venus Dev and contributors. AGPL-3.0-only; see ./LICENSE.
// Retains the deterministic slot override behavior; game-specific wardrobe and CG logic omitted.
export function displaySlotsOf(slots,stageOverride){
 const shown=[...slots];
 for(const [charId,want] of Object.entries(stageOverride)){
  if(want)continue;const at=shown.indexOf(charId);if(at!==-1)shown[at]=null;
 }
 for(const [charId,want] of Object.entries(stageOverride)){
  if(!want||shown.includes(charId))continue;const free=shown.indexOf(null);if(free===-1)continue;shown[free]=charId;
 }
 return shown;
}
