// Drama management in the spirit of Façade and Versu: the engine, not the model, picks the kind of beat an NPC plays next
// (answer, tease, push back, confide, ask back, raise something of their own) from the authored profile. A small model left
// to improvise flattens every character into the same agreeable voice; given one concrete instruction it only has to voice it.
import {relevance} from './memory.mjs';
import {briefOf} from '../modules/director.mjs';
const MOVES={flirt:'flirt a little, their own way',ask:'ask the player one specific question back',opinion:'give their own opinion, even one the player may not share',notice:'point out one concrete detail around them',tease:'tease the player lightly',deflect:'dodge with a dry aside before giving a little ground',confide:'admit one small, true thing about themselves',challenge:'disagree with something the player said, with a reason'};
const TEMPERAMENT=[[/teas|joke|wry|dry|playful|sarcas|wit|funny/i,['tease','deflect']],[/guarded|careful|reserved|shy|self-reliant|private|afraid|proud/i,['deflect','challenge']],[/curious|observant|perceptive|nosy/i,['notice','ask']],[/direct|blunt|honest|sincere|impulsive|restless/i,['opinion','challenge']],[/warm|kind|sentimental|gentle|loyal|patient/i,['confide','ask']]];
const QUESTION=/\?\s*$|^\s*(?:(?:i\s+)?ask\b|(?:tell|show|give)\s+me\b|(?:who|what|why|how|when|where|which|do|does|did|are|is|can|could|will|would|have|has)\b)/i,FEELING=/\b(?:sorry|miss|love|sad|scared|afraid|hurt|thank|thanks|proud|happy|excited|nervous|worried|sucks)\b/i;
const STAGE={stranger:{tone:'just met the player: polite, a little guarded',drop:['confide','tease']},familiar:{tone:'knows the player a little: cordial, warming, but not close',drop:['confide']},friend:{tone:'knows the player well: relaxed',add:['tease','confide']},close:{tone:'close to the player: warm, at ease',add:['confide']},
 crush:{tone:'has a crush on the player: a little flustered, tries to hide it',add:['flirt']},dating:{tone:'is dating the player: affectionate, at ease',add:['flirt','confide']},exclusive:{tone:'is dating the player: affectionate, at ease',add:['flirt','confide']},
 strained:{tone:'something with the player is unresolved: a little distant',add:['challenge'],drop:['flirt']},rejected:{tone:'turned the player down: kind but firm',drop:['flirt','confide']},broken:{tone:'things with the player ended badly: cool, guarded',drop:['flirt','confide','tease']}};
// Romance pacing: how far a character may physically or romantically go is the stage's call, not the model's.
// A 9B role-play fine-tune defaults to provocative bar-owner behavior; the boundary line repeats it out of that habit.
const BOUNDARY={stranger:'They have just met the player: keep a first-meeting distance — no touching, no leaning in, no innuendo.',familiar:'They are on cordial terms with the player, nothing more yet: keep it hands-off, no touching, no leaning in.',strained:'They keep things cool and distant until the tension between them is resolved.'};
const MOODS=['in a good mood today','a little tired today','quieter than usual today','restless today','chattier than usual today'];
const hash=s=>[...String(s)].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const content=t=>(t.toLowerCase().match(/\p{L}{5,}/gu)||[]),STOP=new Set(['about','there','their','would','could','should','where','which','thing','think','really','today','right','never','always','going','anyway','something','other','these','those','player']);
// The authored line a question is about ("What made you start drawing?" → "Started drawing on the backs of bus transfers…"),
// matched on 5-letter stems, so a small model answers from canon instead of inventing a past.
export function groundFor(actor,input){
 const stems=new Set(content(input).filter(w=>!STOP.has(w)).map(w=>w.slice(0,5)));
 return [...String(actor.backstory||'').split(/(?<=[.!?])\s+/u),...[].concat(actor.likes||[]).map(x=>`they love ${x}.`),...[].concat(actor.dislikes||[]).map(x=>`they can't stand ${x}.`)].find(t=>content(t).some(w=>stems.has(w.slice(0,5))))||(/\b(?:miss|like|love|favou?rite|enjoy)\b/i.test(input)&&[].concat(actor.likes||[]).length?`they love ${[].concat(actor.likes)[0]}.`:'');
}
// Something of their own to raise, taken only from what the author wrote and not yet touched on this scene.
export function topicSeeds(actor,said=''){
 const seen=new Set(content(said)),fresh=t=>{const w=content(t);return w.length&&w.filter(x=>seen.has(x)).length/w.length<0.5;};
 return [...[].concat(actor.likes||[]).map(x=>[x,`something they love: ${x}`]),...[].concat(actor.dislikes||[]).map(x=>[x,`something they can't stand: ${x}`]),...String(actor.backstory||'').split(/(?<=[.!?])\s+/u).filter(Boolean).map(x=>[x,`a piece of their past: ${x}`])].filter(([t])=>fresh(t)).map(([,s])=>s);
}
export function beatDirection(context,pack,seed=''){
 const cast=context.stagedCast||[],phase=context.scenePhase||'opening',input=String(context.playerAction||'');
 if(!cast.length||phase==='closing'||phase==='solo')return '';
 const actors=cast.map(id=>pack.actors.find(a=>a.id===id)).filter(Boolean),named=actors.find(a=>new RegExp(`\\b${a.name.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(input)),actor=named||actors[0];if(!actor)return '';
 const history=context.sceneHistory||[],said=history.map(h=>`${h.input||''} ${h.text||''}`).join(' ')+' '+input,seeds=topicSeeds(actor,said),ground=groundFor(actor,input);
 // "What's my favourite colour?" is a memory check about the player: answered from what they said, never invented.
 const question=QUESTION.test(input),aboutPlayer=question&&/\b(?:my|mine|remember)\b|\b(?:what|where|when|who|how|why)\s+I\b/i.test(input);
 // How close they are shapes how they talk, as in Persona's ranks or Venus University's trust: a stranger is polite and keeps
 // their secrets, a friend teases and confides, a crush gets flustered and flirts. A dating phase outranks raw trust.
 const stageOf=a=>{const d=(context.dating||[]).find(x=>x.character===a.id);if(d?.strained&&!['rejected','broken'].includes(d.phase))return 'strained';if(d&&d.phase!=='available')return d.phase;
  const trust=context.actor?.id===a.id?context.actor.relationshipToPlayer:null;if(trust==null)return '';
  return trust>=75?'close':trust>=40?'friend':trust<5&&!(context.memories||[]).length&&!(context.pastScenes||[]).length?'stranger':'familiar';};
 const movesOf=a=>{const temper=[a.personality,a.style,...[].concat(a.traits||[]),a.voice].filter(Boolean).join(' '),st=stageOf(a);
  return [...new Set([...TEMPERAMENT.filter(([r])=>r.test(temper)).flatMap(([,m])=>m),'opinion','ask',...(STAGE[st]?.add||[])])].filter(m=>!((question||phase==='opening')&&['deflect','challenge'].includes(m))&&!(STAGE[st]?.drop||[]).includes(m));};
 // The one memory the question is about, picked here rather than left to a 9B model scanning a dozen of them.
 // The player's own words (m.kind) beat a model-written impression that shares the same word, and of "name is Mara, favorite
 // color is teal, and grew up by the harbor" only the clause asked about is passed on.
 const names=pack.actors.map(a=>a.name),focus=t=>{const [,head='',body]=/^(.*?\btold [^:]+:\s*)?(.*)$/su.exec(t),parts=body.split(/,\s*(?:and\s+)?|;\s*/u),hit=parts.filter(x=>relevance(x,input,names));return hit.length&&hit.length<parts.length?head+hit.join(', '):t;};
 // Handed back in second person: shown "Mara grew up by the harbor" beside "where I grew up", a 9B model claims that past as its own.
 const toYou=t=>{const who=/^(.+?) (?:told|promised) /u.exec(t)?.[1];if(!who)return t;const w=who.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return t.replace(new RegExp(`^${w} told [^:]+:\\s*`,'u'),'').replace(new RegExp(`^${w} told .+? about\\b`,'u'),'you told me about').replace(new RegExp(`\\b${w}[’']s\\b`,'gu'),'your').replace(new RegExp(`\\b${w} (is|was|has)\\b`,'gu'),(_,v)=>({is:'you are',was:'you were',has:'you have'})[v]).replace(new RegExp(`\\b${w}\\b`,'gu'),'you');};
 const recalled=aboutPlayer?toYou(focus((context.memories||[]).reduce((best,m)=>{const r=relevance(m.text,input,names);return r&&r+(m.kind?1:0)>=best[0]?[r+(m.kind?1:0),m.text]:best;},[0,''])[1])):'';
 const pool=[...movesOf(actor),...(seeds.length?['topic']:[])];
 // Persona and Venus University characters remember: opening a later scene, every other time they follow up on something the
 // player told or promised them before ("so, how did the gallery opening go?"), which a 9B model given the memory list never does.
 const callbacks=phase==='opening'?(context.memories||[]).filter(m=>(m.kind==='disclosure'||m.promise)&&!/\bname(?:’s| is)\b/u.test(m.text)).slice(-3):[],
  h=hash(`${seed}:cb`),callback=callbacks.length&&h%2===0?callbacks[(h>>>1)%callbacks.length]:null,
  cb=callback&&toYou(callback.text).replace(new RegExp(`\\b(?:${[actor.name,actor.name.split(' ')[0]].map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')})\\b`,'gu'),'me');
 const turn=hash(`${seed}:${actor.id}`)+history.length,move=pool[turn%pool.length];
 // A question the player walked away from outranks the routine beat: the character noticed the non-answer (Façade's beat of re-raising a dropped thread).
 const hang=context.hangingAsk&&context.hangingAsk.by===actor.name?`call back their own unanswered question ("${context.hangingAsk.text}") — the player left the last scene without answering it`:'';
 const beat=hang?hang:callback?(callback.promise?`ask whether the player kept their word ("${cb}")`:`follow up on something the player told them last time ("${cb}")`):move==='topic'?`bring up ${seeds[turn%seeds.length].replace(/[.!?]$/,'')}`:MOVES[move];
 const lead=phase==='opening'?(actor.goal?`start on what they want (${actor.goal.replace(/\.$/,'')})`:'greet the player their own way'):aboutPlayer?(recalled?`remind the player of what they told them: "${recalled.length>160?`${recalled.slice(0,160)}…`:recalled}"`:"answer from what the player has told them (if the player never said, admit not knowing)"):question?(ground?`answer the question directly from what is true (${ground.replace(/\.$/,'')})`:'answer the question directly and specifically'):/\b(?:sorry|apologi[sz]e)\b/i.test(input)?`accept or needle the player's apology their own way (the player is the one who is sorry, not ${actor.name.split(' ')[0]})`:FEELING.test(input)?'respond to how the player feels, their own way':'react to what the player just said';
 const words=input.split(/\s+/).filter(Boolean).length,size=phase==='opening'?'one line of narration at most, then two or three short spoken lines':words<=8?'one or two short lines':'two or three short lines';
 // One authored line, rotating per turn, placed where the model reads last: small models copy a voice, not adjectives.
 // Left out of memory checks, where the model copies the sample's opener instead of recalling.
 const sample=[].concat(actor.examples||[]).filter(Boolean),voice=sample.length&&!aboutPlayer?` Sound like "${sample[turn%sample.length]}" (the voice, not those words).`:'';
 // A group scene where only the addressed NPC ever talks reads as a string of one-on-ones: every other turn, someone else cuts in.
 const others=actors.filter(a=>a!==actor),other=others[Math.floor(turn/2)%Math.max(1,others.length)],om=other&&movesOf(other),chime=other&&phase!=='opening'&&!aboutPlayer&&turn%2===0?` ${other.name} cuts in once, briefly, to ${MOVES[om[turn%om.length]]}.`:'';
 // Like Tokimeki Memorial's daily condition, some days a character is in a mood (authored `moods`, or a mild default), the
 // same all day, so today's Mina is not a copy of yesterday's. Never over an authored scene's mood; two days in three they are just themselves, at no token cost.
 const moods=[].concat(actor.moods||MOODS),dh=hash(`${actor.id}:day${context.day??''}`),mood=context.day!=null&&!context.scriptedScene&&dh%3===0?moods[(dh>>>2)%moods.length]:'';
 const tone=[actor.style,STAGE[stageOf(actor)]?.tone,mood].filter(Boolean).join('; '),boundary=BOUNDARY[stageOf(actor)];
 const under=briefOf(context.director);
 // The engine flags a re-asked question; the character voices the reaction (Venus: prompt the live moment, don't mute it).
 const repeat=context.repeatAsk?` The player just repeated something ${context.repeatAsk} already answered: react to the repetition itself — call it out, tease, or deflect. Do not answer it again.`:'';
 // Reciprocity is what makes chat feel like two people rather than an interview (Venus's "answer, react and move the moment on").
 const carry=phase==='continuation'&&!aboutPlayer?` After answering, move the moment on their own way: ask the player something back, tease, disagree, or pull something happening in the room into it.`:'';
 return `${actor.name}${tone?` (${tone})`:''}: ${lead}, then ${beat}.${chime} Keep it to ${size}. Plain talk, no speeches; don't echo the player.${carry} Find fresh physical business every turn; never reuse a gesture or mannerism from earlier in this scene.${boundary?` ${boundary}`:''}${voice}${repeat}${under?` ${under}`:''}`;
}
