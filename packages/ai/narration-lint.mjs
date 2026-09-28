// Generalizes the truth guard in scene-boundaries.mjs into a full lint pass run on every narration
// before it's shown: attendance, knowledge leaks, and content-level overflow.
import {assertSceneBoundaries} from './scene-boundaries.mjs';
import {onlyRepeats} from './untrusted-output.mjs';
const EXPLICIT=/\b(cock|dick|pussy|penis|vagina|cum(?:ming|s|shot)?|orgasms?|climax(?:es|ed|ing)?|thrust(?:ing|s|ed)?|erections?|clit(?:oris)?|moans? in pleasure)\b/iu;
// A fact's quote is how facts.mjs proves a fact happened in narration; the same quote in a line spoken by
// someone outside that fact's knownBy means the model let a character speak knowledge it was never given.
function assertKnowledgeLeaks(value,context){
 for(const fact of context.knownFacts||[]){
  if(!fact.quote)continue;
  for(const line of value.lines){
   if(!line.speaker||fact.knownBy.includes(line.speaker))continue;
   if(line.text.includes(fact.quote))throw Error(`${line.speaker} should not know: ${fact.text}`);
  }
 }
}
function assertContentLevel(value,context,pack){
 const level=pack.intimacySettings?.contentLevel;
 if(level!=='fade'&&level!=='suggestive')return;
 if(value.lines.some(line=>EXPLICIT.test(line.text)))throw Error(`Content level is "${level}": remove explicit sexual detail`);
}
// Small local models sometimes decorate an otherwise grounded scene with the wrong time of day.
// Limit this to concrete environmental phrases so a character may still discuss plans for tonight.
const TIME_ATMOSPHERE={
 Morning:/\b(?:morning (?:air|light|sun|sunlight|sky)|dawn|sunrise)\b/iu,
 Afternoon:/\b(?:afternoon (?:air|light|sun|sunlight|sky)|midday|noonday)\b/iu,
 Evening:/\b(?:evening (?:air|light|sun|sunlight|sky)|night(?:time)? (?:air|sky)|dusk|sunset|moonlight)\b/iu
};
function assertDaypart(value,context){
 const current=context.daypart;if(!TIME_ATMOSPHERE[current])return;
 for(const line of value.lines)if(!line.speaker)for(const [period,pattern] of Object.entries(TIME_ATMOSPHERE))if(period!==current&&pattern.test(line.text))throw Error(`It is ${current}, not ${period.toLowerCase()}: keep environmental time cues consistent`);
}
// The narrator may report what the player visibly does, but it cannot author their private reaction. This keeps
// free-form play conversational: the player owns their feelings, motives and decisions instead of the model
// supplying stock role-play beats such as "your heart pounds with anticipation."
const PLAYER_INTERIOR=/\b(?:you (?:feel|realize|sense|think|wonder|hope|fear|want|need|remember|decide|resolve|brace yourself|steel yourself|can'?t quite place|find yourself)|your (?:heart|pulse) (?:pounds?|races?|quickens?)|(?:drawing|pulling|dragging|pulls?|draws?|drags?|lifts?) your (?:gaze|eyes|attention)|your (?:gaze|eyes) (?:being )?(?:drawn|pulled|dragged|drift(?:s|ing)?|travel(?:s|ling)?)|(?:anticipation|dread|excitement|nervous(?:ness| energy)?|relief|desire|longing) (?:courses?|washes?|floods?|surges?) (?:through|over) you|leaves? you feeling|(?:makes?|sends?) your (?:skin|spine|neck|ears|pulse) (?:prickl\w+|crawls?|tingl\w+|burn|ache)|your (?:skin|spine) (?:prickl\w+|crawls?|tingl\w+)|your (?:posture|stance|body language|breathing|breath) (?:\w+ ){0,2}(?:mirror\w*|match\w*|echo\w*|catch\w*|hitch\w*|quicken\w*|settle\w*|soften\w*|tense\w*|relax\w*|still\w*|deepen\w*|ease\w*|straighten\w*))\b/iu;
function assertPlayerInterior(value){
 for(const line of value.lines)if(!line.speaker&&PLAYER_INTERIOR.test(line.text))throw Error('Do not invent the player’s feelings, thoughts, motives, memories, decisions, gaze, posture, or bodily reactions; describe only observable action and surroundings');
}
// Role-play fine-tunes open a scene with paragraphs of narration and never let the character talk. Soft: one repair is
// asked for, and a second silent answer is still shown rather than failing the turn.
function assertCastSpeaks(value,context,pack){
 const cast=context.stagedCast||[];if((context.scenePhase||'opening')!=='opening'||!cast.length||value.lines.some(l=>l.speaker))return;
 const who=pack.actors.filter(a=>cast.includes(a.id));throw Object.assign(Error(`${who.map(a=>a.name).join(' and ')} must speak: add their words as ${who.map(a=>`{"speaker":"${a.id}","text":"..."}`).join(' or ')}, after at most one line of narration`),{soft:true});
}
// A reply whose every spoken line was already said this scene (or is an authored example recited) loops the scene.
// Soft, like speech: the second answer stands.
function assertFresh(value,context,pack){
 if(!context.spokenBefore||!onlyRepeats(value.lines,context.spokenBefore,context.playerAction))return;
 const who=[...new Set(value.lines.filter(l=>l.speaker).map(l=>pack.actors.find(a=>a.id===l.speaker)?.name||l.speaker))];
 throw Object.assign(Error(`${who.join(' and ')} already said that: reply to "${context.playerAction||''}" with something new`),{soft:true});
}
// Local models contradict the calendar the context supplies ("a quiet Tuesday" on a Wednesday). Only narration
// is checked: a character may still make plans for another day.
const WEEKDAY_WORDS=/(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
function assertWeekday(value,context){
 if(!context.weekday)return;
 for(const line of value.lines)if(!line.speaker){const said=line.text.match(WEEKDAY_WORDS);if(said&&said[1].toLowerCase()!==String(context.weekday).toLowerCase())throw Error(`It is ${context.weekday}: do not describe today as ${said[1].toLowerCase()}`);}
}
// Exact-match dedup misses a lightly paraphrased rerun of the same beats ("arches an eyebrow… crosses her arms…"
// again). Word-trigram overlap against this scene's earlier narration catches the near-copy; soft, like speech.
const gramsOf=text=>{const words=String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);if(words.length<8)return null;const grams=new Set();for(let i=0;i<=words.length-3;i++)grams.add(words.slice(i,i+3).join(' '));return grams;};
const gramOverlap=(a,b)=>{if(!a||!b)return 0;let shared=0;for(const gram of a)if(b.has(gram))shared++;return shared/(a.size+b.size-shared);};
function assertFreshNarration(value,context){
 const prior=(context.sceneHistory||[]).map(entry=>entry.text).filter(Boolean).slice(-6);if(!prior.length)return;
 for(const line of value.lines){
  if(line.speaker)continue;const grams=gramsOf(line.text);if(!grams)continue;
  for(const old of prior)if(gramOverlap(grams,gramsOf(old))>=0.7)throw Object.assign(Error('This narration repeats what was already shown: write what happens now, in new words and new beats'),{soft:true});
 }
}
// Before the crush stage a character initiating physical contact breaks the pacing contract ("her hands come up
// to frame your face" at first-name terms). Patterns are NPC-initiated forms only: the player reaching out first
// ("you take her hand") never matches. Soft, like speech: one rewrite is requested, then the answer stands.
const NPC_TOUCH=/(?<!\byou )leans? (?:in|closer)\b[^.?!]*\b(?:kiss|cup|frame|touch|brush|whisper)|kiss(?:es)? your (?:cheek|lips|forehead|neck|jaw|hand|wrist)|(?:hand|hands|fingers|fingertips|lips|arms?) (?:come|comes|move|moves|reach|reaches|rise|rises|slide|slides|slip|slips|drift|drifts|curl|curls|crawl|crawls|travel|travels) (?:up |to |toward|across |along |over |against |into |behind )[^.?!]*\byour |(?:cups?|frames?|caress(?:es)?|strokes?|brush(?:es)?|tucks?|touches?|grabs?|takes?|holds?|squeezes?) your (?:face|cheek|chin|jaw|neck|waist|hip|thigh|hair|hand|wrist)|(?:pulls?|draws?|tugs?) you (?:closer|in|into|against|down)|wraps? (?:an arm|her arms|his arms|their arms) (?:around|about) you\b/iu;
function assertStageTouch(value,context,pack){
 const rules=context.touchStage||{};if(!Object.keys(rules).length)return;
 const allAllowed=Object.values(rules).every(Boolean);
 for(const line of value.lines){
  if(!NPC_TOUCH.test(line.text))continue;
  if(line.speaker?rules[line.speaker]!==false:allAllowed)continue;
  const who=line.speaker?pack.actors.find(a=>a.id===line.speaker)?.name||line.speaker:'A character';
  throw Object.assign(Error(`${who} is not close enough to the player to initiate touch: keep the contact one-sided or remove it until the relationship reaches the crush stage`),{soft:true});
 }
}
// A recycled mannerism ("amused glint in her eye" every other turn) is shorter than the paraphrase check's sentences
// and reads as stock animation. Any 5-word run of text already used in this scene asks for fresh business. Soft.
function assertFreshBeats(value,context){
 const seen=new Set();const shingles=text=>{const words=String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(Boolean);const out=[];for(let i=0;i+5<=words.length;i++)out.push(words.slice(i,i+5).join(' '));return out;};
 for(const old of (context.sceneHistory||[]).map(entry=>entry.text).filter(Boolean).slice(-6))for(const gram of shingles(old))seen.add(gram);
 for(const line of value.lines){
  for(const gram of shingles(line.text))if(seen.has(gram))throw Object.assign(Error(`"${gram}" was already used in this scene: find fresh, specific physical business instead of reusing the same mannerism`),{soft:true});
  for(const gram of shingles(line.text))seen.add(gram);
 }
}
const CHECKS=[['attendance',assertSceneBoundaries],['knowledge',assertKnowledgeLeaks],['content',assertContentLevel],['time',assertDaypart],['calendar',assertWeekday],['player-agency',assertPlayerInterior],['touch-stage',assertStageTouch],['speech',assertCastSpeaks],['repeat',assertFresh],['paraphrase',assertFreshNarration],['beats',assertFreshBeats]];
export function lintScene(value,context,pack){
 for(const [check,run] of CHECKS){
  try{run(value,context,pack);}
  catch(error){throw Object.assign(Error(error.message),{lintCheck:check,soft:!!error.soft});}
 }
}
