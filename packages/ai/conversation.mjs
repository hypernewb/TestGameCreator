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
export function exchangePolicy(context){
 const cue=conversationCue(context.playerAction),quick=context.scenePhase==='continuation'&&!context.first&&!context.scriptedScene&&!context.repeatAsk&&(!context.hangingAsk||cue==='refuse')&&(context.stagedCast||[]).length>0&&['ack','refuse','playful'].includes(cue)&&String(context.playerAction||'').trim().split(/\s+/u).length<=12;
 const min=quick?Math.max(2,(context.stagedCast||[]).length+1):context.sceneWriter==='venus'?6:5,max=quick?min+1:context.sceneWriter==='venus'?9:7;
 return {cue,quick,min,max,range:`${min}–${max}`};
}
