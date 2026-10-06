// What the player has told characters, rebuilt from committed turns at read time (no save migration).
// Small local models misattribute first-person text ("my name is Mara") to whoever speaks next, and questions
// ("Ask Brin what he does on rest days") carry nothing worth remembering. So each player utterance is classified,
// questions are dropped, and the rest is phrased with an explicit speaker: the player told Brin: “…”.
import {terms} from './retrieval.mjs';

const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const FIRST_PERSON=/\b(?:i|i'm|im|i've|i'd|i'll|my|me|mine|myself)\b/i;
const ASKING=/^\s*(?:i\s+)?(?:ask|asks|wonder|quiz|question)\b/i;
const INTERROGATIVE=/^\s*(?:what|where|when|who|whom|whose|why|how|which|whether|if|do|does|did|are|is|was|were|can|could|will|would|should|have|has|had)\b/i;
const PROMISE=/\bpromise[sd]?\b|\b(?:i'll|i will|i swear|i vow)\b/i;
// Physical moves typed as commands ("Touch her hand while you flirt with her") are things the player did, not words:
// stored raw they read as the player ordering the listener about. Meta-commands ("Go talk to Selma") steer the engine
// and are not remembered at all. (T-114)
const ACTS='touch|kiss|hug|hold|take|grab|walk|run|sit|stand|lean|look|smile|grin|wink|nod|laugh|flirt|follow|wait|move|give|hand|reach|pull|push|brush|stroke|squeeze|put|pour|buy|order|show|wave|step|pat|caress|cuddle|dance|bring|watch|offer|lift|carry|kneel|tease|poke|nudge|tickle|wrap|stare|glance|shrug|sigh|lead|pick';
// Imperative ("Kiss her cheek"), but not "Hold on" / "Wait, …"; with "I" only when an object follows ("I lean closer"), so "I watch anime" stays a disclosure.
const ACTION=new RegExp(`^(?:${ACTS})(?:s|es)?\\b(?!\\s*,)(?!\\s+(?:on|up)\\b)`,'i');
const ACTION_I=new RegExp(`^i\\s+(?:${ACTS})(?:s|es)?\\s+(?:her|him|them|his|their|the|a|an|at|over|up|down|back|closer|close|in|into|on|onto|out|across|around|toward|towards|beside|next|by|to|with|for|your|you)\\b`,'i');
const META=/^(?:let['’]?s\s+|i\s+)?(?:(?:go|head|walk|run)\s+(?:over\s+)?(?:and\s+|to\s+)?(?:talk|speak|chat)\s+(?:to|with)|(?:go\s+(?:and\s+)?)?(?:find|look for|go see|visit|meet up with|check on))\s+\S/i;

/** Classifies one player utterance: question | promise | disclosure (about the player) | statement | action | meta. */
export function classifyUtterance(input,names=[],{player=''}={}){
 const text=String(input||'').trim();if(!text)return {kind:'statement',said:''};
 // "Tell me more about…" (or the player's own name) asks the narrator for something: a question, not a line said.
 const self=['me','us',...(player&&player!=='You'?[player,player.split(' ')[0]]:[])].map(escape).join('|');
 if(new RegExp(`^tell\\s+(?:${self})\\s+(?:more\\s+|all\\s+)?about\\b`,'i').test(text))return {kind:'question',said:text};
 if(META.test(text))return {kind:'meta',said:text};
 if(!/["“]/.test(text)&&(ACTION.test(text)||ACTION_I.test(text)))return {kind:'action',said:text.replace(/^i\s+/i,'').replace(/[.!]+$/,'')};
 const who=[...names.filter(Boolean).map(escape),'her','him','them'].join('|');
 // Strip the addressing wrapper players type in scene mode: "Tell Brin (that) …", "Talk to Brin: …".
 let said=text.replace(new RegExp(`^\\s*talk to (?:${who})\\s*:\\s*`,'i'),'')
  .replace(new RegExp(`^\\s*(?:i\\s+)?(?:tell|tells|say|says|mention|explain|admit|confess|reveal|share|whisper|remind|inform|reply|answer)(?:\\s+to)?\\s+(?:${who})\\b[\\s,:]*(?:that\\s+)?`,'i'),'').trim();
 // In an indirect instruction, "you" is the player: "Tell her you would love coffee".
 // Explicit quotations and colon-addressed dialogue keep "you" as the listener.
 const indirect=new RegExp(`^\\s*(?:tell|say|whisper|remind|inform|explain)(?:\\s+to)?\\s+(?:${who})\\b\\s+(?:that\\s+)?(?!["“])`,'i').test(text);
 if(indirect&&!FIRST_PERSON.test(said.replace(/"[^"]*"|“[^”]*”/gu,''))){
  said=said.split(/("[^"]*"|“[^”]*”)/u).map((part,i)=>i%2?part:part.replace(/\byou['’]re\b/gi,"I'm").replace(/\byou['’]ve\b/gi,"I've").replace(/\byou['’]ll\b/gi,"I'll").replace(/\byou['’]d\b/gi,"I'd")
   .replace(/\byou are\b/gi,'I am').replace(/\byou were\b/gi,'I was').replace(/\byou have\b/gi,'I have')
   .replace(/\byour\b/gi,'my').replace(/\byou\b/gi,'I')).join('');
 }
 if(ASKING.test(text))return {kind:'question',said};
 if(PROMISE.test(said))return {kind:'promise',said};
 if(/\?\s*$/.test(said)||INTERROGATIVE.test(said))return {kind:'question',said};
 return {kind:FIRST_PERSON.test(said)?'disclosure':'statement',said};
}

// Third person, not quotes: a 9B model reads “my favorite color is teal” as its own line even inside quotation marks.
const PRESENT=/\bI (love|like|hate|want|need|think|feel|know|live|work|prefer|miss|play|enjoy|believe|remember|mean|hope|wish|study|own|keep|promise|swear|vow)\b/gi;
function thirdPerson(text,player,listener){
 return text
  .replace(/\bI(?:'m| am)\b/gi,`${player} is`).replace(/\bI was\b/gi,`${player} was`).replace(/\bI(?:'ve| have)\b/gi,`${player} has`)
  .replace(/\bI'd\b/gi,`${player} would`).replace(/\bI'll\b/gi,`${player} will`).replace(/\bI do\b/g,`${player} does`)
  .replace(PRESENT,(_,verb)=>`${player} ${verb}${/(?:s|sh|ch|x|o)$/i.test(verb)?'es':'s'}`)
  .replace(/\bI\b/g,player).replace(/\b(?:my|mine)\b/gi,`${player}’s`).replace(/\b(?:me|myself)\b/gi,player)
  .replace(/\byour\b/gi,`${listener}’s`).replace(/\byou\b/gi,listener);
}
const IRREGULAR={run:'ran',take:'took',hold:'held',sit:'sat',stand:'stood',give:'gave',buy:'bought',bring:'brought',put:'put',lead:'led',kneel:'knelt'};
const DOUBLE=/^(?:hug|pat|nod|step|grab|wrap|grin|poke)$/i;
const stem=v=>{const w=v.toLowerCase();return IRREGULAR[w]||DOUBLE.test(w)||!/s$/.test(w)||/ss$/.test(w)?w:/(?:sh|ch|x|ss)es$/.test(w)?w.slice(0,-2):w.slice(0,-1);};
const past=v=>{const w=stem(v);return IRREGULAR[w]||(DOUBLE.test(w)?w+w.at(-1)+'ed':/e$/.test(w)?w+'d':/[^aeiou]y$/.test(w)?w.slice(0,-1)+'ied':w+'ed');};
const ing=v=>{const w=v.toLowerCase();return DOUBLE.test(w)?w+w.at(-1)+'ing':/[^e]e$/.test(w)?w.slice(0,-1)+'ing':w+'ing';};
/** A command-shaped move, told as something the player did: "With Selma, Ari touched her hand while flirting with her". */
function actionText(said,listener,player){
 const [,verb,rest='']=said.match(/^(\S+)\s*(.*)$/)||[,said];
 const body=rest.replace(/\b(while|as|and)\s+you\s+(\w+)/gi,(_,c,v)=>`${c} ${ing(v)}`).replace(/\byour\b/gi,`${player}’s`).replace(/\byou\b/gi,player).replace(/\bmy\b/gi,`${player}’s`).replace(/\bme\b/gi,player);
 return `With ${listener}, ${player} ${past(verb)}${body?` ${body}`:''}`;
}
/** Phrases a classified utterance so a small model cannot take the player's "I" and "my" as its own. */
export function memoryText(kind,said,listener,player='the player'){
 if(kind==='action')return actionText(said,listener,player);
 const verb=kind==='promise'?'promised':'told';
 // "Thank Brin and promise to bring him coffee" keeps only the promise itself.
 const text=(kind==='promise'&&!/^i\b/i.test(said)?said.replace(/^.*?\bpromise[sd]?\s+(?:(?:him|her|them)\s+)?/i,''):said).replace(/^[“"]|[”"]$/g,'');
 const direct=FIRST_PERSON.test(text.split(/\s+/)[0]||'');
 return `${player} ${verb} ${listener}${direct?':':''} ${thirdPerson(text,player,listener)}`;
}

/** True when a model-written impression is about the player rather than the character's own habits. */
export function mentionsPlayer(text,playerName=''){
 const d=String(text||'');if(/\b(?:player|you|your|yours|user)\b|\{\{\s*user/i.test(d))return true;
 return Boolean(playerName&&playerName!=='You'&&new RegExp(`\\b${escape(playerName)}\\b`,'i').test(d));
}

const sceneCast=turn=>turn.events?.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.characters||[];

/**
 * Player statements visible to actorId, newest last. Sources: the conversation module's memories (social.speak and
 * scene "talk" turns) plus completed scene turns that recorded none ("continue" turns and group scenes).
 * Original records retain their source and knowers; correction journals are applied by playerStatements.
 */
export function capturedStatements(state,pack,actorId=pack.playerId){
 const nameOf=id=>pack.actors.find(a=>a.id===id)?.name||id;
 const visible=knownBy=>actorId===pack.playerId||knownBy.includes(actorId);
 const out=[],covered=new Set();
 for(const m of state.modules['social.conversation']?.memories||[]){
  if(!visible(m.knownBy||[]))continue;
  const listeners=(m.knownBy||[]).filter(id=>id!==pack.playerId),names=listeners.flatMap(id=>[nameOf(id),nameOf(id).split(' ')[0]]);
  const raw=String(m.text||'').replace(/^You (?:tell|talk to) [^:]+:\s*/,'').replace(/^“|”$/g,'');
  const c=classifyUtterance(raw,names,{player:nameOf(pack.playerId)});covered.add(String(m.source).split('.')[0]);
  out.push({id:`heard:${m.id||m.source}`,knownBy:m.knownBy||[],original:raw,source:m.source,tick:m.tick||0,kind:m.promise&&c.kind!=='question'?'promise':c.kind,said:c.said,listener:listeners.map(nameOf).join(' and ')||'someone'});
 }
 for(const turn of Object.values(state.turns||{})){
  if(turn.status!=='complete'||covered.has(turn.id)||turn.command?.type!=='core.scene')continue;
  const cast=sceneCast(turn);if(!cast.length||!(actorId===pack.playerId||cast.includes(actorId)))continue;
  const input=turn.input||turn.command.args?.text||'';if(!input)continue;
  const c=classifyUtterance(input,cast.flatMap(id=>[nameOf(id),nameOf(id).split(' ')[0]]),{player:nameOf(pack.playerId)});
  out.push({id:`turn:${turn.id}`,knownBy:[pack.playerId,...cast],original:input,source:turn.id,tick:turn.events?.[0]?.tick||0,kind:c.kind,said:c.said,listener:cast.map(nameOf).join(' and ')});
 }
 out.sort((a,b)=>a.tick-b.tick);
 return out;
}
export function playerStatements(state,pack,actorId,{keep=40,statements=4,audience=null}={}){
 const name=pack.actors.find(a=>a.id===pack.playerId)?.name,player=name&&name!=='You'?name:'the player',edits=new Map((state.statementEdits||[]).map(e=>[e.statementId,e]));
 const out=capturedStatements(state,pack,actorId).filter(m=>!audience||audience.every(id=>m.knownBy.includes(id))).flatMap(m=>{const e=edits.get(m.id);return e?.action==='retire'?[]:[{...m,said:e?.action==='correct'?e.text:m.said}];});
 // A correction replaces what it corrects: after "actually my favorite color is red", the older "…is teal" clause leaves
 // every prompt, or a small model recalls whichever of the two it reads first. Other clauses of that disclosure stay.
 const seen=new Set();
 for(const m of [...out].reverse()){if(m.kind!=='disclosure')continue;const parts=clauses(m.said),kept=parts.filter(c=>{const s=slotOf(c);if(!s)return true;const old=seen.has(s);seen.add(s);return !old;});
  if(kept.length<parts.length)m.kept=kept.join(', ');}
 const lasting=out.filter(m=>m.kind==='promise'||m.kind==='disclosure').slice(-keep),plain=out.filter(m=>m.kind==='statement'||m.kind==='action').slice(-statements);
 const chosen=new Set([...lasting,...plain]);
 // Once this character has heard the player's name, later memories use it: "Mara promised Ada…" reads as a person.
 let known=player;
 return out.flatMap(m=>{const label=known;if(player==='the player'&&m.kind==='disclosure')known=disclosedName(m.said)||known;
  const said=m.kept??m.said;return chosen.has(m)&&said?[{source:m.source,...(audience?{knownBy:m.knownBy}:{}),kind:m.kind,promise:m.kind==='promise',text:memoryText(m.kind,said,m.listener,label)}]:[];});
}
const clauses=said=>String(said).split(/,\s*(?:(?:and|but)\s+)?|;\s*|\s+(?:and|but)\s+(?=(?:my|i|i'm|im|i've)\b)/iu).map(c=>c.trim()).filter(Boolean);
/** What a first-person clause states about the player ("favorite color", "name", "live"), or '' when it is not a restatable fact. */
export function slotOf(clause){
 const c=String(clause).toLowerCase().replace(/[’]/g,"'").replace(/favourite/g,'favorite').replace(/colour/g,'color');
 if(/\b(?:call me|i go by)\b/.test(c))return 'name';
 const my=/\bmy ((?:[a-z']+\s+){0,2}?[a-z']+) (?:is|are)\b(?!\s+not\b)/.exec(c);if(my)return my[1];
 const verb=/\bi (live|grew up|work|study)\b/.exec(c);if(verb)return verb[1];
 return /\bi(?:'m| am|m)\s+\d{1,3}\b/.test(c)?'age':'';
}

const NOT_A_NAME=new Set('not just only still also really so very here back the a an whatever anything'.split(' '));
/** The name a player gives in "my name is Mara" / "call me Mara", or ''. */
export function disclosedName(said){
 const m=/\b(?:my name(?:'s| is)|call me|i go by)\s+([a-z][\w'-]{0,23})/i.exec(String(said||''));
 return m&&!NOT_A_NAME.has(m[1].toLowerCase())?m[1][0].toUpperCase()+m[1].slice(1):'';
}

/** Rank bonus for memories that share words with what the player is asking right now (0–6). */
// Words every memory shares with every request ("ask Ada", "the player told") say nothing about the topic.
const FILLER=new Set(terms('ask asked tell told say said player promise promised remember'));
export function relevance(text,query,names=[]){
 if(!query)return 0;const ignore=new Set([...FILLER,...names.flatMap(n=>terms(n))]),wanted=new Set(terms(query).filter(t=>!ignore.has(t)));if(!wanted.size)return 0;
 let hits=0;for(const t of new Set(terms(text)))if(wanted.has(t))hits++;return Math.min(6,hits*2);
}

/** Removes SillyTavern-style placeholders that role-play fine-tunes leak into prose. */
export function stripPlaceholders(text,player='you',character='they'){
 return String(text).replace(/\{\{\s*user\s*\}\}/gi,player).replace(/\{\{\s*char\s*\}\}/gi,character);
}

// Creator corrections to NPC impressions and scene memories live in an overlay journal (state.memoryEdits): turns and
// module state stay as recorded so replay/import still match. The last edit per record wins; retired rows drop out.
export const impressionId=(turnId,i)=>`impression:${turnId}:${i}`,sceneMemoryId=i=>`scene-memory:${i}`;
export function memoryEditIndex(state,kind){const m=new Map();for(const e of state.memoryEdits||[])if(e.kind===kind)m.set(e.recordId,e);return m;}
/** A turn's ledger rows with corrections applied; each row keeps its stable id and original text. */
export function effectiveImpressions(turn,edits){return (turn.ledger||[]).flatMap((m,i)=>{const id=impressionId(turn.id,i),e=edits.get(id);return e?.action==='retire'?[]:[{...m,id,...(e?.action==='correct'?{desc:e.text,original:m.desc,edited:true}:{})}];});}
/** Scene memories with corrections applied; retired memories are omitted, history keeps the original wording. */
export function effectiveSceneMemories(state){const edits=memoryEditIndex(state,'scene memory');return (state.modules['story.scenes']?.memories||[]).flatMap((m,i)=>{const id=sceneMemoryId(i),e=edits.get(id);return e?.action==='retire'?[]:[{...m,id,...(e?.action==='correct'?{text:e.text,original:m.text,edited:true}:{})}];});}
/** Maps an old `story.memoryRecorded` line to its corrected text, or null when retired, so history can't re-assert it. */
export function sceneMemoryLines(state){const edits=memoryEditIndex(state,'scene memory'),out=new Map();if(!edits.size)return out;(state.modules['story.scenes']?.memories||[]).forEach((m,i)=>{const e=edits.get(sceneMemoryId(i));if(e)out.set(`${m.tick}|${m.character}|${m.text}`,e.action==='retire'?null:e.text);});return out;}
