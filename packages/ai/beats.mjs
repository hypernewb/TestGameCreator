import {relationshipStageOf,exampleTexts} from './character-context.mjs';
// Drama management in the spirit of Façade and Versu: the engine, not the model, picks the kind of beat an NPC plays next
// (answer, tease, push back, confide, ask back, raise something of their own) from the authored profile. A small model left
// to improvise flattens every character into the same agreeable voice; given one concrete instruction it only has to voice it.
import {relevance} from './memory.mjs';
import {briefOf} from '../modules/director.mjs';
import {conversationCue,exchangePolicy,isQuestion,ordinaryConversation} from './conversation.mjs';
const MOVES={flirt:'flirt a little, their own way',ask:'show curiosity through a specific observation; a question is optional',opinion:'give their own opinion, even one the player may not share',notice:'point out one concrete detail around them',tease:'tease the player lightly',deflect:'dodge with a dry aside before giving a little ground',confide:'admit one small, true thing about themselves',challenge:'disagree with something the player said, with a reason'};
const TEMPERAMENT=[[/teas|joke|wry|dry|playful|sarcas|wit|funny/i,['tease','deflect']],[/guarded|careful|reserved|shy|self-reliant|private|afraid|proud/i,['deflect','challenge']],[/curious|observant|perceptive|nosy/i,['notice','ask']],[/direct|blunt|honest|sincere|impulsive|restless/i,['opinion','challenge']],[/warm|kind|sentimental|gentle|loyal|patient/i,['confide','ask']]];
const FEELING=/\b(?:sorry|miss|love|sad|scared|afraid|hurt|thank|thanks|proud|happy|excited|nervous|worried|sucks)\b/i;
const STAGE={stranger:{tone:'just met the player: polite but quick to spar — banter and teasing pushback welcome, confiding not',drop:['confide']},familiar:{tone:'knows the player a little: warming up, easy banter, not close yet',drop:['confide']},friend:{tone:'knows the player well: relaxed',add:['tease','confide']},close:{tone:'close to the player: warm, at ease',add:['confide']},
 crush:{tone:'has a crush on the player: a little flustered, tries to hide it',add:['flirt']},dating:{tone:'is dating the player: affectionate, at ease',add:['flirt','confide']},exclusive:{tone:'is dating the player: affectionate, at ease',add:['flirt','confide']},
 strained:{tone:'something with the player is unresolved: a little distant',add:['challenge'],drop:['flirt']},rejected:{tone:'turned the player down: kind but firm',drop:['flirt','confide']},broken:{tone:'things with the player ended badly: cool, guarded',drop:['flirt','confide','tease']}};
// Romance pacing: how far a character may physically or romantically go is the stage's call, not the model's.
// A 9B role-play fine-tune defaults to provocative bar-owner behavior, so the physical wall stays hard — but charm is
// decoupled from it: eye contact, banter, teasing pushback and flustered reactions belong to every stage.
const BOUNDARY={stranger:'They have just met the player: no touching and no leaning in yet — but first-meeting spark is in play, so eye contact, wit and teasing pushback are welcome.',familiar:'Physical moves wait for a closer bond: hands-off, no leaning in. Flirtation, banter and charged looks are fair game.',strained:'They keep things cool and distant until the tension between them is resolved.'};
const MOODS=['in a good mood today','a little tired today','quieter than usual today','restless today','chattier than usual today'];
const hash=s=>[...String(s)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const content=t=>(t.toLowerCase().match(/\p{L}{5,}/gu)||[]),STOP=new Set(['about','there','their','would','could','should','where','which','thing','think','really','today','right','never','always','going','anyway','something','other','these','those','player']);
// The authored line a question is about ("What made you start drawing?" → "Started drawing on the backs of bus transfers…"),
// matched on 5-letter stems, so a small model answers from canon instead of inventing a past.
export function groundFor(actor,input){
 const stems=new Set(content(input).filter(w=>!STOP.has(w)).map(w=>w.slice(0,5)));
 return [...String(actor.backstory||'').split(/(?<=[.!?])\s+/u),...[].concat(actor.likes||[]).map(x=>`they love ${x}.`),...[].concat(actor.dislikes||[]).map(x=>`they can't stand ${x}.`)].find(t=>content(t).some(w=>stems.has(w.slice(0,5))))||'';
}
// Something of their own to raise, taken only from what the author wrote and not yet touched on this scene.
export function topicSeeds(actor,said=''){
 const seen=new Set(content(said)),fresh=t=>{const w=content(t);return w.length&&w.filter(x=>seen.has(x)).length/w.length<0.5;};
 return [...[].concat(actor.likes||[]).map(x=>[x,`something they love: ${x}`]),...[].concat(actor.dislikes||[]).map(x=>[x,`something they can't stand: ${x}`]),...String(actor.backstory||'').split(/(?<=[.!?])\s+/u).filter(Boolean).map(x=>[x,`a piece of their past: ${x}`])].filter(([t])=>fresh(t)).map(([,s])=>s);
}
// A conservative, deterministic exhaustion signal: only a long scene with the same substantive request
// three times in succession winds down. New information or a different subject resets the signal.
export function topicExhaustion(context){
 const history=context.sceneHistory||[];
 if(context.scenePhase!=='continuation'||history.length<6)return false;
 const tokens=text=>String(text||'').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[],names=new Set((context.castProfiles||[]).flatMap(a=>tokens(a.name))),filler=new Set(['the','and','but','this','that','you','your','her','him','his','tell','ask','can','what','how','why','who','are','was','our','some','more','please','could','would','asked','asking','tells','telling','share','explain']),signature=input=>{
  const words=tokens(input).filter(w=>(w.length>=3||/^\d+$/u.test(w))&&!STOP.has(w)&&!names.has(w)&&!filler.has(w));
  return [...new Set(words)].sort().join(' ');
 };
 const tail=[...history.slice(-2).map(h=>h.input),context.playerAction].map(signature);
 return Boolean(tail[0]&&tail.every(s=>s===tail[0]));
}
export function beatDirection(context,pack,seed=''){
 const cast=context.stagedCast||[],phase=context.scenePhase||'opening',input=String(context.playerAction||'');
 if(!cast.length||phase==='closing'||phase==='solo')return '';
 const actors=cast.map(id=>pack.actors.find(a=>a.id===id)).filter(Boolean),named=actors.find(a=>new RegExp(`\\b${a.name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(input)),actor=named||actors[0];if(!actor)return '';

 const history=context.sceneHistory||[],said=history.map(h=>`${h.input||''} ${h.text||''}`).join(' ')+' '+input,seeds=topicSeeds(actor,said),ground=groundFor(actor,input);
 // "What's my favourite colour?" is a memory check about the player: answered from what they said, never invented.
 const question=isQuestion(input),aboutPlayer=question&&/\b(?:my|mine|remember)\b|\b(?:what|where|when|who|how|why)\s+(?:did\s+)?I\b/i.test(input),responsive=phase==='continuation'&&!context.scriptedScene,cue=responsive?conversationCue(input):'neutral',policy=exchangePolicy(context);
 // How close they are shapes how they talk, as in Persona's ranks or Venus University's trust: a stranger is polite and keeps
 // their secrets, a friend teases and confides, a crush gets flustered and flirts. A dating phase outranks raw trust.
 const stageOf=a=>relationshipStageOf(context,a);
 const movesOf=a=>{const temper=[a.personality,a.voice,a.fingerprint,...[].concat(a.traits||[])].filter(Boolean).join(' '),st=stageOf(a);
  return [...new Set([...TEMPERAMENT.filter(([r])=>r.test(temper)).flatMap(([,m])=>m),'opinion','ask',...(STAGE[st]?.add||[])])].filter(m=>!((question||phase==='opening')&&['deflect','challenge'].includes(m))&&!(STAGE[st]?.drop||[]).includes(m));};
 // The one memory the question is about, picked here rather than left to a 9B model scanning a dozen of them.
 // The player's own words (m.kind) beat a model-written impression that shares the same word, and of "name is Mara, favorite
 // color is teal, and grew up by the harbor" only the clause asked about is passed on.
 const memoryQuery=aboutPlayer?input.replace(/\bgrow up\b/iu,'grew up'):input,names=pack.actors.map(a=>a.name),focus=t=>{const [,head='',body]=/^(.*?\btold [^:]+:\s*)?(.*)$/su.exec(t),parts=body.split(/,\s*(?:and\s+)?|;\s*/u),hit=parts.filter(x=>relevance(x,memoryQuery,names));return hit.length&&hit.length<parts.length?head+hit.join(', '):t;};
 // Handed back in second person: shown "Mara grew up by the harbor" beside "where I grew up", a 9B model claims that past as its own.
 const toYou=t=>{const who=/^(.+?) (?:told|promised) /u.exec(t)?.[1];if(!who)return t;const w=who.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return t.replace(new RegExp(`^${w} told [^:]+:\\s*`,'u'),'').replace(new RegExp(`^${w} told .+? about\\b`,'u'),'you told me about').replace(new RegExp(`\\b${w}[’']s\\b`,'gu'),'your').replace(new RegExp(`\\b${w} (is|was|has)\\b`,'gu'),(_,v)=>({is:'you are',was:'you were',has:'you have'})[v]).replace(new RegExp(`\\b${w}\\b`,'gu'),'you');};
 const recalled=aboutPlayer?toYou(focus((context.memories||[]).reduce((best,m)=>{const r=relevance(m.text,memoryQuery,names);return r&&r+(m.kind?1:0)>=best[0]?[r+(m.kind?1:0),m.text]:best;},[0,''])[1])):'';
 if(ordinaryConversation(context)){
  const ground=groundFor(actor,input),stage=relationshipStageOf(context,actor),boundary={stranger:'They just met the player: no touching or leaning in.',familiar:'Physical moves wait for a closer bond: no touching or leaning in.',strained:'Keep physical distance until the unresolved tension is resolved.',rejected:'Respect the rejection; no romantic or physical escalation.',broken:'Respect the ended relationship; no romantic or physical escalation.'}[stage],cue=conversationCue(input);
  const lead=cue==='refuse'?'acknowledge what the player declined without pressure or repeating the offer':cue==='ack'?'give a natural brief reaction on this same subject; take the acknowledgement at face value, without treating it as cryptic or demanding an explanation':cue==='encourage'?'develop the last conversational point using the supplied exchange':aboutPlayer?(recalled?`remind the player of what they told you: ${recalled}`:'answer from what the player has told you; if they never said, admit not knowing'):isQuestion(input)?'answer the actual question; distinguish questions about the player from questions about yourself, and admit when the supplied information does not answer it':/\b(?:sorry|apologi[sz]e)\b/i.test(input)?`respond to the player's apology in your own voice (the player is the one who is sorry, not ${actor.name.split(' ')[0]})`:cue==='emotion'?'respond to how the player feels on this same subject':'respond to what the player means in the supplied exchange';
  return [actor.name+': '+lead+'.',!aboutPlayer&&ground&&'Relevant authored detail: '+ground,boundary,context.repeatAsk&&'If the player is clarifying or repeating a question, explain the answer more clearly; do not dismiss the request.',briefOf(context.director)].filter(Boolean).join(' ');
 }
 // Encouragement continues the existing thread; sheet topics fill an empty conversation only.
 const threaded=history.some(h=>h.input||h.text),drift=responsive&&cue==='encourage'&&!threaded;
 // An opening is one thread. Until they know the player well it is a greeting and a reaction to the moment, not their life goal plus a topic from their sheet.
 const opening=phase==='opening',first=opening&&['stranger','familiar'].includes(stageOf(actor)),pool=[...movesOf(actor).filter(m=>!first||['notice','ask'].includes(m)),...(seeds.length&&drift?['topic']:[])];
 // Persona and Venus University characters remember: opening a later scene, every other time they follow up on something the
 // player told or promised them before ("so, how did the gallery opening go?"), which a 9B model given the memory list never does.
 const callbacks=phase==='opening'?(context.memories||[]).filter(m=>(m.kind==='disclosure'||m.promise)&&!/\bname(?:’s| is)\b/u.test(m.text)).slice(-3):[],
  h=hash(`${seed}:cb`),
  // The director's callback line (what just played out or was walked away from) fills the slot when no memory does.
  callback=callbacks.length&&h%2===0?callbacks[(h>>>1)%callbacks.length]:(!callbacks.length&&context.director?.lastBeat&&h%3===0?{text:context.director.lastBeat,beat:true}:null),
  cb=callback&&!callback.beat?toYou(callback.text).replace(new RegExp(`\\b(?:${[actor.name,actor.name.split(' ')[0]].map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`,'gu'),'me'):callback&&callback.text;
 const turn=hash(`${seed}:${actor.id}`)+history.length,lastAsked=/\?\s*$/u.test(String(history.at(-1)?.text||'')),preferred={playful:['tease','deflect'],disclosure:lastAsked?['opinion']:['ask'],opinion:['opinion','challenge']}[cue]||[],fitting=pool.filter(m=>preferred.includes(m)),move=(fitting.length?fitting:pool)[turn%(fitting.length||pool.length)];
 // A question the player walked away from outranks the routine beat: the character noticed the non-answer (Façade's beat of re-raising a dropped thread).
 const hang=context.hangingAsk&&context.hangingAsk.by===actor.name?`call back their own unanswered question ("${context.hangingAsk.text}") — the player left the last scene without answering it`:'';
 const calm=phase==='continuation'&&context.continuationStyle==='calm';
 const reaction=cue==='refuse'?'give a brief reaction to the refusal, without repeating the offer or asking them to justify it':cue==='emotion'?'give a specific reaction to that feeling on this same subject':cue==='encourage'&&threaded?`develop the last conversational point ("${String(history.at(-1)?.text||'').slice(-160)}"), using only the supplied scene`:cue==='ack'?'give a brief reaction on this same subject; no new question or agenda is required':'';
 const beat=reaction?reaction:hang?hang:calm?'give a specific reaction on this same subject, without requiring a new plan or question':callback?(callback.promise?`ask whether the player kept their word ("${cb}")`:callback.beat?`glance back at the last thing that happened between you ("${cb}") — one light line, only if it fits the moment`:`follow up on something the player told them last time ("${cb}")`):move==='topic'?`bring up ${seeds[turn%seeds.length].replace(/[.!?]$/,'')}`:cue==='disclosure'?`${MOVES[move]} about what the player just shared; use only the supplied profile and scene`:MOVES[move];
 const lead=opening?(first?'greet the player their own way and react to what they said':actor.goal?`start on what they want (${actor.goal.replace(/\.$/,'')})`:'greet the player their own way'):cue==='refuse'?'acknowledge what the player declined without pressure':aboutPlayer?(recalled?`remind the player of what they told them: "${recalled.length>160?`${recalled.slice(0,160)}…`:recalled}"`:"answer from what the player has told them (if the player never said, admit not knowing)"):question?(ground?`answer the question directly from what is true (${ground.replace(/\.$/,'')})`:'answer the question directly and specifically'):/\b(?:sorry|apologi[sz]e)\b/i.test(input)?`accept or needle the player's apology their own way (the player is the one who is sorry, not ${actor.name.split(' ')[0]})`:FEELING.test(input)?'respond to how the player feels, their own way':'react to what the player just said';
 const size=calm?'one connected reply mostly in direct dialogue, with brief meaningful actions only as needed':policy.quick?`${policy.range} visual-novel entries total, one brief narration entry and concise character replies`:context.sceneWriter==='venus'?`${policy.range} visual-novel entries total, with brief narration and substantial character replies`:'one brief narration entry, then four or five entries mostly in the character’s own spoken voice';
 // One authored line, rotating per turn, placed where the model reads last: small models copy a voice, not adjectives.
 // Left out of memory checks, where the model copies the sample's opener instead of recalling.
 const sample=exampleTexts(actor.examples),voice=sample.length&&!aboutPlayer&&!reaction?` Sound like "${sample[turn%sample.length]}" (the voice, not those words).`:'';
 // A group scene where only the addressed NPC ever talks reads as a string of one-on-ones: every other turn, someone else cuts in.
 const others=actors.filter(a=>a!==actor),other=others[Math.floor(turn/2)%Math.max(1,others.length)],om=other&&movesOf(other),chime=other&&!calm&&!reaction&&!policy.quick&&phase!=='opening'&&!aboutPlayer&&turn%2===0?` ${other.name} cuts in once, briefly, to ${MOVES[om[turn%om.length]]}.`:'';
 // Like Tokimeki Memorial's daily condition, some days a character is in a mood (authored `moods`, or a mild default), the
 // same all day, so today's Mina is not a copy of yesterday's. Never over an authored scene's mood; two days in three they are just themselves, at no token cost.
 const moods=[].concat(actor.moods||MOODS),dh=hash(`${actor.id}:day${context.day??''}`),mood=context.day!=null&&!context.scriptedScene&&dh%3===0?moods[(dh>>>2)%moods.length]:'';
 // Speech tag: authored fingerprint first, then the voice note. A pack with neither is legacy: it keeps the old tag
 // text, the personality line older sheets keep in `style` (never clothing, which new packs put in `voice`/`fingerprint`).
 const tone=[actor.fingerprint||actor.voice||actor.personality||actor.style,STAGE[stageOf(actor)]?.tone,mood].filter(Boolean).join('; '),boundary=BOUNDARY[stageOf(actor)];
 const under=briefOf(context.director);
 // The engine flags a re-asked question; the character voices the reaction (Venus: prompt the live moment, don't mute it).
 const repeat=context.repeatAsk?` The player just repeated something ${context.repeatAsk} already answered: react to the repetition itself — call it out, tease, or deflect. Do not answer it again.`:'';
 // Reciprocity without an interview: stay on what the player raised; a forced closing question every turn reads as a quiz (chat audit 2026-10).
 const carry=phase==='continuation'&&!aboutPlayer?` Stay on what the player brought up and change the subject only through a clear link to it. A short reply is fine, and it need not end on a question.`:'';
 return `${actor.name}${tone?` (${tone})`:''}: ${lead}, then ${beat}.${opening?' Keep to that one thread.':''}${chime} Keep it to ${size}. Plain talk, no speeches; don't echo the player. ${calm?'Respond to the actual player words without recasting them in a compulsory narration beat.':'That no-echo rule is for NPC speech: start with one short narration clause briefly recasting what the player actually said, with slight stat-ranked delivery flavor, preserving meaning.'}${carry} Gestures only when they add something; never reuse a gesture or mannerism from earlier in this scene.${boundary?` ${boundary}`:''}${voice}${repeat}${under?` ${under}`:''}`;
}
