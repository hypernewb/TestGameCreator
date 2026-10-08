// Progression flag: pack.progression.version. It is deliberately outside mechanicsDigest, so shipped digests and old saves never change.
// A save opts in with a cutover stamp (state.progression) written by its first turn under version 1; from that turn on every
// capped gain writes a per-turn marker, and replay reads the marker back. Saves with no stamp replay exactly as before.
export const PROGRESSION_VERSION=1;
export const RULES_MARKER='social.progressionRules';
export const DEFAULT_DAILY_GAIN=6;
export const progressionVersionOf=pack=>pack?.progression?.version;
export function validateProgression(pack){const g=pack.progression;if(g===undefined)return;if(!(g&&typeof g==='object'&&!Array.isArray(g)&&Number.isInteger(g.version)&&g.version>=1))throw new Error('progression.version: expected a whole number, 1 or higher');}
export const cutoverStamp=(world,command)=>({version:PROGRESSION_VERSION,cutover:{turn:command.id,revision:world.revision,tick:world.tick}});
// Generated and published packs that use the social relationship bridge carry the flag; packs that already have one are untouched.
export const withProgression=pack=>pack.progression||!pack.modules?.['social.relationships']?pack:{...pack,progression:{version:PROGRESSION_VERSION}};
// A flagged turn that capped a gain recorded the cap it used; replay uses that value, so a later pack edit cannot rewrite history.
export function replayPack(pack,turn){const m=(turn.events||[]).find(e=>e.type===RULES_MARKER);return m&&Number.isInteger(m.payload?.dailyGain)?{...pack,romanceStats:{...pack.romanceStats,dailyGain:m.payload.dailyGain}}:pack;}
export function assertMarkers(turn){const ms=(turn.events||[]).filter(e=>e.type===RULES_MARKER);if(ms.length>1)throw new Error('Duplicate progression rules marker');for(const m of ms)if(m.payload?.version!==PROGRESSION_VERSION||!(Number.isInteger(m.payload.dailyGain)&&m.payload.dailyGain>0&&m.payload.dailyGain<=100))throw new Error('Unsupported progression rules');}
