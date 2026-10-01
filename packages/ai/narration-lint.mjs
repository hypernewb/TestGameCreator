// Generalizes the truth guard in scene-boundaries.mjs into a full lint pass run on every narration
// before it's shown: attendance, knowledge leaks, and content-level overflow.
import {assertSceneBoundaries} from './scene-boundaries.mjs';
import {onlyRepeats} from './untrusted-output.mjs';
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
// Narration is second person. Once a named player turns up in memories, small models drift to "Cael vows to protect her",
// which authors the player from outside and dodges the "you" checks above. Characters may still say the name. Soft: one repair.
function assertPlayerPerson(value,context,pack){
 const name=pack.actors?.find(a=>a.id===pack.playerId)?.name;if(!name||/^you$/i.test(name))return;
 const re=new RegExp(`(?<![\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![\\p{L}\\p{N}])`,'iu');
 if(value.lines.some(l=>!l.speaker&&re.test(l.text)))throw Object.assign(Error(`Narration calls the player "you", never "${name}" or he/she: rewrite those lines in second person. Characters may still say "${name}" in dialogue`),{soft:true});
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
// Only a claim about today counts ("it is Sunday", "Sunday morning"); a plan ("the beach on Sunday", "next Friday") is fine.
const NOT_TODAY=/\b(?:on|next|last|until|till|by|before|after|since|from|every|coming|for|this|that)\s+$/i,TODAY=/\b(?:it'?s|it is|it was|today is|another|a)\s+$/i;
export const todayClaims=text=>[...text.matchAll(new RegExp(`\\b${WEEKDAY_WORDS.source}\\b`,'gi'))].filter(m=>{const before=text.slice(Math.max(0,m.index-16),m.index),after=text.slice(m.index+m[0].length);return !NOT_TODAY.test(before)&&(TODAY.test(before)||/^(?:'s)?\s+(?:morning|afternoon|evening|night)\b/i.test(after)||!text.slice(0,m.index).trim());}).map(m=>m[1].toLowerCase());
function assertWeekday(value,context){
 // A day the player named ("the beach on Sunday") is their plan, not a claim about today. Soft: a second miss keeps the reply.
 if(!context.weekday)return;const named=new Set((String(context.playerAction||'').match(new RegExp(WEEKDAY_WORDS.source,'gi'))||[]).map(d=>d.toLowerCase()));
 for(const line of value.lines)if(!line.speaker)for(const day of todayClaims(line.text))if(day!==String(context.weekday).toLowerCase()&&!named.has(day))throw Object.assign(Error(`It is ${context.weekday}: do not describe today as ${day}`),{soft:true});
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
 // Narration only (a spoken line keeps just its present-tense stage business, "She watches…"): characters may repeat themselves, and the player's own phrasing ("the beach on Sunday") is fair to echo back.
 const own=new Set([context.playerAction,...(context.sceneHistory||[]).map(entry=>entry.input)].filter(Boolean).flatMap(shingles));
 for(const old of (context.sceneHistory||[]).map(entry=>entry.text).filter(Boolean).slice(-6))for(const gram of shingles(old))if(!own.has(gram))seen.add(gram);
 for(const line of value.lines){
  const text=line.speaker?(String(line.text).match(/[^.!?]+[.!?]*/g)||[]).filter(x=>/^\s*(?:she|he)\s+[a-z]+s\b/i.test(x)).join(' '):line.text;
  for(const gram of shingles(text))if(seen.has(gram)&&!own.has(gram))throw Object.assign(Error(`"${gram}" was already used in this scene: find fresh, specific physical business instead of reusing the same mannerism`),{soft:true});
  for(const gram of shingles(text))seen.add(gram);
 }
}
// Last open agency frontier from the small-model runs: during a typed activity the narrator scripts the player
// performing engine-owned transactions the turn never committed ("you buy a round", "you pocket the tip jar").
// Purchases, transfers and signatures are the engine's decisions; the player only said what they said. Soft,
// like speech: one rewrite is requested, and the verb the player themselves typed is always allowed.
const PLAYER_TRANSACTION=/\byou (buy|purchase|order|pay for|pay|steal|sell|sign|trade|swap|pocket|swipe|snag|smuggle|hand over|give)\b/iu;
function assertPlayerTransactions(value,context){
 if(!context.typedActivity)return;
 const said=String(context.playerAction||'').toLocaleLowerCase();
 for(const line of value.lines){
  if(line.speaker)continue;
  const m=line.text.match(PLAYER_TRANSACTION);if(!m)continue;
  if(said.includes(m[1].toLocaleLowerCase()))continue;
  throw Object.assign(Error(`Do not narrate "you ${m[1]} ..." during a typed activity: purchases, sales, trades and item transfers are committed by the engine, not by prose. Describe the scene or have a character speak instead`),{soft:true});
 }
}
const CHECKS=[['attendance',assertSceneBoundaries],['knowledge',assertKnowledgeLeaks],['time',assertDaypart],['calendar',assertWeekday],['player-agency',assertPlayerInterior],['player-person',assertPlayerPerson],['player-transactions',assertPlayerTransactions],['touch-stage',assertStageTouch],['speech',assertCastSpeaks],['repeat',assertFresh],['paraphrase',assertFreshNarration],['beats',assertFreshBeats]];
// Style checks a strong model may break without a repair call; attendance, knowledge, content, player-person,
// touch-stage and speech stay hard for every model.
export const STYLE_CHECKS=new Set(['time','calendar','player-agency','player-transactions','repeat','paraphrase','beats']);
// A character asking the same question twice in one scene reads as not listening. Warn only: rewording is the model's job.
const QSTOP=new Set('the and you your are was were did does what how who why where when that this for with have has about just really so do is it to of a an in on me my i'.split(' '));
const qWords=q=>new Set(q.toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>1&&!QSTOP.has(w)));
const questionsOf=text=>String(text||'').match(/[^.!?]*\?/g)?.map(s=>s.trim()).filter(Boolean)||[];
export function repeatedQuestions(lines,before=[]){
 const same=(a,b)=>{if(!a.size||!b.size)return false;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n)>=0.6;};
 return (lines||[]).filter(l=>l.speaker).flatMap(l=>{const old=(before||[]).filter(b=>b.speaker===l.speaker).flatMap(b=>questionsOf(b.text)).map(qWords);return questionsOf(l.text).filter(q=>{const w=qWords(q);return old.some(o=>same(w,o));});});
}
// The typed run echoed the player's own words back as narration (Turn 65). Warn only: a reply is never blocked and the
// player never sees this; it lands in the turn trace so the prompt pass can be judged on runs. Off without a pack field.
const wordRun=t=>String(t||'').toLowerCase().match(/[\p{L}\p{N}']+/gu)||[];
export function echoedRun(text,input,min){
 const theirs=wordRun(input);if(!Number.isInteger(min)||min<1||theirs.length<min)return null;
 const runs=new Set();for(let i=0;i+min<=theirs.length;i++)runs.add(theirs.slice(i,i+min).join(' '));
 const mine=wordRun(text);for(let i=0;i+min<=mine.length;i++){const run=mine.slice(i,i+min).join(' ');if(runs.has(run))return run;}
 return null;
}
export function lintScene(value,context,pack,{lenient=false}={}){
 const warnings=[];
 for(const [check,run] of CHECKS){
  try{run(value,context,pack);}
  catch(error){if(lenient&&STYLE_CHECKS.has(check)){warnings.push({check,message:String(error.message).slice(0,200)});continue;}throw Object.assign(Error(error.message),{lintCheck:check,soft:!!error.soft});}
 }
 // Warn only, never repair: in a group scene someone who gets no line or beat reads as a prop.
 const cast=context.stagedCast||[],silent=cast.length>1?cast.filter(id=>{const name=pack.actors.find(x=>x.id===id)?.name;return !value.lines.some(l=>l.speaker===id||(name&&!l.speaker&&l.text.includes(name)));}):[];
 if(silent.length)warnings.push({check:'ensemble',message:'No line or beat for '+silent.map(id=>pack.actors.find(x=>x.id===id)?.name||id).join(', ')});
 const again=repeatedQuestions(value.lines,context.spokenBefore);
 if(again.length)warnings.push({check:'repeat-question',message:'Asked again: '+again.join(' | ').slice(0,200)});
 const echo=echoedRun(value.lines.map(l=>l.text).join(' '),context.playerAction,pack.slipGuard?.echoWords);
 if(echo)warnings.push({check:'echo',message:`Echoed ${pack.slipGuard.echoWords}+ words of the player: "${echo}"`});
 return warnings;
}
