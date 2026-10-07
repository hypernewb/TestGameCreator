// Venus-shaped scene request, adapted from Venus University scenePrompt.ts (PERSONA_LINES, JSON RULES, buildScenePrompt,
// continuation YOUR TURN), snapshot 79301df55bc39a0996229ccc6f12ccce422a80b2. AGPL-3.0-only; see LICENSE.
// Same context and output schema as scenePromptMessages, but prose blocks and a persona instead of a rules list and a
// state dump. Used by scripts/prompt-ab.mjs to compare the two shapes; the SFW persona (no sex direction) is used.
import {scenePromptMessages,soFarBlocks,calendarLine,awayLine,avoidLine,STAY_RULE,ECHO_RULE,PROP_RULE,CONTRAST_RULE,neverLine,INITIATIVE_HEAD} from './scenePrompt.mjs';
import {ordinaryConversation} from '../../packages/ai/conversation.mjs';
const ordinal=n=>n+(['th','st','nd','rd'][n%100>10&&n%100<14?0:n%10]||'th');
const list=a=>(a||[]).filter(Boolean).join(', ');
export const VENUS_PERSONA=[
 'You are RITA, author of reader-POV romance fiction set at fictional universities.',
 'You have a unique style where you use present-tense narration and second-person perspective to put the reader in the action.',
 'You generally make the reader a silent protagonist, though you occasionally describe things they do and say.',
 "You've got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.",
 'You include all cast members in the scene and have them bond, fight... maybe even flirt, keeping their personalities and memories in mind as you write.',
 "You don't jump to romance, you make the women play hard to get, making everything a slow burn.",
 'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
 "You dig messy, sparse prose that's rich with subtext. You never have characters blurt out what's on their mind, instead showing how they feel via actions and body language.",
 'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
 'For dialogue, you write lines that are meant to be said, not read. You use contractions, imperfect grammar, ellipses, filler words like "like", and "um", and avoid overly flowery metaphors and strict sentence structure.',
 "And finally, you're totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly."
].join('\n');
const profileLine=a=>[`${a.name} (${a.id}, ${a.pronouns||'they/them'}): ${a.description||''}`,a.traits?.length&&`Personality: ${list(a.traits)}.${a.personality?' '+a.personality:''}`,a.voice&&`Voice: ${a.voice}`,a.style&&`Style: ${a.style}`,a.goal&&`Wants: ${a.goal}`,a.backstory&&`Backstory: ${a.backstory}`,a.likes?.length&&`Likes: ${list(a.likes)}.`,a.dislikes?.length&&`Dislikes: ${list(a.dislikes)}.`,a.examples?.length&&`Sounds like: ${a.examples.map(e=>typeof e==='string'?e:e.text).join(' / ')}`,neverLine(a)].filter(Boolean).join(' ');
export function venusStyleMessages(context,pack){
 if(ordinaryConversation(context))return scenePromptMessages({...context,sceneWriter:'venus'},pack);
 const cast=context.stagedCast||[],phase=context.scenePhase||'opening',speakers=context.speakers||cast;
 const profiles=context.castProfiles||pack.actors.filter(a=>cast.includes(a.id));
 const reader=pack.actors.find(a=>a.id===pack.playerId),action=context.playerAction||'';
 const bond=id=>{const t=(context.romanceTempo||[]).find(r=>r.character===id),d=(context.dating||[]).find(r=>r.character===id);return [t?.rankName,d?.agreement&&d.agreement!=='uncommitted'&&d.agreement].filter(Boolean).join(', ');};
 const system=[VENUS_PERSONA,'',
  'JSON RULES',
  'Use an empty speaker ("") for narration lines. Otherwise, match who\'s saying what to their character key.',
  "Never mix dialogue and narration on a single line. Split them into two lines instead. An empty text field on a line isn't valid.",
  `Character keys that may speak: ${list(speakers)||'none (narration only)'}. Nobody else is in the scene or can walk in.`,
  cast.length&&STAY_RULE,cast.length&&ECHO_RULE,cast.length&&PROP_RULE,cast.length>1&&CONTRAST_RULE,avoidLine(context)||undefined,
  'Write the summary in third person and refer to the MC as "the reader". Set end_scene only when the characters part ways.',
  'memories: at most one per present character about what they learned about the reader or how the reader made them feel, {charKey,type,desc} with type liked, disliked or neutral; [] when nothing meaningful happened. facts: at most three durable facts said on screen, {subject,text,quote} with quote copied exactly from the action or your lines.',
  context.actTags,context.claimsTags,'',
  'SETTING',[context.gameProject?.setting,context.gameProject?.premise].filter(Boolean).join(' ')
 ].filter(x=>x!==undefined&&x!==null&&x!==false).join('\n');
 const absent=(context.absentCharacters||[]).map(a=>a.name);
 // The same slip lines the SFW prompt carries, reused rather than restated: a second copy would drift.
 const day=calendarLine(context),away=awayLine(context.absentCharacters);
 const memories=[...(context.memories||[]).map(m=>m.text),...(context.facts||[]).map(f=>f.text),...(context.generatedFacts||[]).map(f=>f.text),...(context.lorebook||[]).map(e=>e.text)];
 const past=(context.pastScenes||[]).map(g=>g.summary||g.text).filter(Boolean);
 const context_=[
  'READER',`${reader?.name||'You'}: ${reader?.description||'the protagonist'}`,'',
  ...(profiles.length?['CAST',...profiles.map(a=>profileLine(a)+(bond(a.id)?` With the reader: ${bond(a.id)}.`:'')),'']:[]),
  ...(absent.length?[`NOT HERE (can be talked about, can't show up): ${list(absent)}`,'']:[]),
  ...(day?[day]:[]),...(away?[away]:[]),
  'NOW',`${context.weekday||''} ${context.date||''}, ${context.daypart||''}. ${context.location?.name||''}: ${context.location?.description||''}${context.timeNote?` ${context.timeNote}`:''}`.trim(),
  ...(context.activeEvents?.length?[`Happening: ${context.activeEvents.map(e=>e.text||e.name||e).join(' ')}`]:[]),'',
  ...(past.length?['EARLIER',...past.map(t=>`- ${t}`),'']:[]),
  ...(memories.length?['WHAT THEY REMEMBER',...memories.map(t=>`- ${t}`),'']:[]),
  ...(context.openThreads?.length?['LOOSE ENDS',...context.openThreads.map(t=>`- ${t.text||t}`),'']:[]),
  ...(context.direction?['DIRECTOR\'S NOTE (steer the scene this way, never quote it)',context.direction,'']:[]),
  ...(context.wantHint?[INITIATIVE_HEAD,context.wantHint,'']:[]),
  ...(context.actBrief?.length?['PRIVATE (her hidden likes and limits: let her reactions match, never say them)',...context.actBrief,'']:[]),
  ...(context.intimacyRule?[`BOUNDARY: ${context.intimacyRule}`,'']:[])
 ];
 const stubs=(context.sceneHistory||[]).flatMap(h=>h.compact?[`(earlier) ${h.text}`]:[...(h.input?[`Reader: ${h.input}`]:[]),h.text]);
 const n=(context.sceneHistory||[]).filter(h=>h.input).length+1;
 const solo=!cast.length;
 const tail=solo?['YOUR TURN','Write the reader\'s solo action as a short scene: the place, the effort, one sensory detail, and how it turns out. Anyone in the background minds their own business.','',`Reader's action: ${action}`]
  :phase==='opening'?['YOUR TURN',"Let's rock and roll, RITA! Your mission is to write a kickass scene based on the reader's action.",'Open the scene by rewording what the reader decided to do in a fun narration.','Then, entertain them with wacky hijinx until you feel like letting the player in to crash the party at a natural decision point.','Avoid breaking the fourth wall by directly asking the player what they want to do or suggesting an action for them.',"DON'T set end_scene yet.",'',`Reader's action: ${action}`]
  :[...soFarBlocks(context.sceneSummary||null,stubs,true),'YOUR TURN',
   phase==='closing'?'Alright RITA, this scene is wrapping up. Pick up from where the SCENE SO FAR left off, let the characters part ways in their own style, and set end_scene.':"Alright RITA, you can write now! Let's continue from where the STORY and the SCENE SO FAR have left off.",
   "At the very bottom of this prompt is the reader's action: what they just decided to do or say, in their own words.",'',
   'OPENING LINE',"Your FIRST line must reword the reader's action/words into your own voice, as narration or as their dialogue.",'',
   ...(phase==='closing'?[]:['CONTINUING THE SCENE','If the scene is still going strong, keep the good times going! Steer it into new shenanigans and twists.',"Don't stop writing until you reach a natural decision point.",'','ENDING THE SCENE',"However, if the scene feels like it's drawing to a close, invent an excuse for the characters to need/want to part ways, and send end_scene.",'']),
   'SUMMARY',context.sceneSummary?'Finally, for the "summary" field, fold anything new from SCENE SO FAR into the STORY SO FAR.':'Finally, for the "summary" field, condense the SCENE SO FAR into a single recap.','',
   ...(action?[`Reader's action: ${action}`]:[]),`This is the reader's ${ordinal(n)} action in the scene.`];
 return [{role:'system',content:system},{role:'user',content:[...context_,...tail].join('\n')}];
}
