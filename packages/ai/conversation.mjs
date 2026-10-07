const QUESTION=/\?\s*$|^\s*(?:(?:i\s+)?ask\b|(?:tell|show|give)\s+me\b|(?:who|what|why|how|when|where|which|do|does|did|are|is|can|could|will|would|have|has)\b)/i;
export const isQuestion=input=>QUESTION.test(String(input||''));
export function conversationCue(input){
 const raw=String(input||''),s=raw.toLowerCase().replace(/’/g,"'").trim().replace(/[.!]+$/u,'').trim();
 if(/^(?:go on|keep going|tell me more|say more|and then|what else)$/u.test(s))return 'encourage';
 if(isQuestion(raw))return 'question';
 if(/^(?:no(?: thanks| thank you)?|not now|stop|please stop|i(?:'d| would) rather not|i don't want to|i do not want to)$/u.test(s))return 'refuse';
 if(/^(?:ok(?:ay)?|sure|yeah|yep|yes|right|nice|cool|got it|fair enough|sounds good|thanks|thank you|i see)$/u.test(s))return 'ack';
 if(/\b(?:sorry|sad|scared|afraid|hurt|nervous|worried)\b/u.test(s))return 'emotion';
 if(/\b(?:just kidding|only joking|nice try|very funny|you wish|as if|haha|jok(?:e|ing)|teas(?:e|ing))\b/u.test(s))return 'playful';
 if(/\b(?:i think|i believe|i prefer|i disagree|in my opinion|overrated|underrated)\b/u.test(s))return 'opinion';
 if(/\b(?:sorry|miss|love|sad|scared|afraid|hurt|proud|happy|excited|nervous|worried|sucks)\b/u.test(s))return 'emotion';
 if(/\b(?:i (?:grew up|used to|work|study|collect|like|enjoy|spent)|i(?:'m| am) from|my (?:family|job|home|hobby))\b/u.test(s))return 'disclosure';
 return 'neutral';
}
export const ordinaryConversation=c=>(c.stagedCast||[]).length>0&&!c.scriptedScene&&!c.first&&!['closing','solo'].includes(c.scenePhase);
// Continuing-scene opening adapted from Venus University scenePrompt.ts, ec8f7cee4fd9236e3dbcdc2e4683afba3acab748. AGPL-3.0-only; see LICENSE.
export const conversationProse='Write one connected reply with dialogue and meaningful action interwoven in ordered lines; use at most 12 entries, with no minimum or fixed balance. Do not recap earlier turns or add stat-colored delivery. Then continue the living scene: carry forward unfinished tasks, established objects, positions and interruptions. Actions may take space when they change attention, reveal a response or affect what is said; do not fill gaps with token gestures or introduce props for variety. Keep NPC speech and narration in separate entries. Let characters finish connected thoughts in their own speaking rhythm. Prefer concrete opinions and everyday wording to elaborate repeated metaphors, psychological explanations of the player or a lecture evaluating each input. Personality comes from the supplied voice, attention and wants. Allow teasing, verbal flirtation, reciprocal interest, hesitation or refusal as the relationship and moment support, without forcing attraction or turning every exchange into romance. Small talk is welcome; take acknowledgements at face value. Explain your own point when asked for clarification. Stay with the current subject unless a clear connection motivates a change. Stop at a natural response point; a question is optional, not a required ending. Interweave already-submitted player speech/actions with NPC reactions when the input contains several contributions; no first-position recap or alternating formula. Respond to adult romantic interest with a specific, character-appropriate reaction, including attraction, playful tension, hesitation or a clear boundary; do not turn sincere interest into a lecture or psychological assessment. Never invent player reactions, feelings, speech or decisions beyond the submitted meaning; use committed outcomes for world changes. If the player says goodbye, let them go without a new question or manufactured hook and set end_scene true.';
export function exchangePolicy(context){
 const cue=conversationCue(context.playerAction);if(ordinaryConversation(context))return {cue,quick:false,max:12,ordinary:true};const quick=context.scenePhase==='continuation'&&!context.first&&!context.scriptedScene&&!context.repeatAsk&&(!context.hangingAsk||cue==='refuse')&&(context.stagedCast||[]).length>0&&['ack','refuse','playful'].includes(cue)&&String(context.playerAction||'').trim().split(/\s+/u).length<=12;
 const min=quick?Math.max(2,(context.stagedCast||[]).length+1):context.sceneWriter==='venus'?6:5,max=quick?min+1:context.sceneWriter==='venus'?9:7;
 return {cue,quick,min,max,range:`${min}–${max}`};
}
