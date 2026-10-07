import {ordinaryConversation} from './conversation.mjs';
const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function narratedExit(lines,c,p){
 if(!ordinaryConversation(c))return false;const cast=p.actors.filter(a=>(c.stagedCast||[]).includes(a.id));if(cast.length!==1)return false;const names=[cast[0].name,cast[0].name.split(' ')[0],'She','He','They'].map(escape),narration=lines.filter(l=>!l.speaker&&!['playerSpeech','playerAction'].includes(l.type)&&!/^You\b/u.test(l.text)).map(l=>l.text).join(' ');
 if(/\b(?:if|unless|would|could|might|may|will|perhaps|maybe|suppos\w*|imagin\w*|temporar\w*|briefly|momentarily|return\w*|re-?enter\w*)\b|\b(?:comes?|steps?|walks?)\s+back\b|\bback\s+(?:inside|in|into)\b|\bfor\s+(?:a\s+)?moment\b|\bto\s+(?:fetch|get|collect|retrieve)\b/iu.test(narration.replace(/\bas if\b/giu,'')))return false;
 const exit=new RegExp(`^(?:${names.join('|')})\\s+(?:(?:quietly|finally|silently)\\s+)?(?:steps?\\s+out|walks?\\s+out|exits?|departs?|leaves?\\s+the\\s+(?:room|flat|office|conversation|scene))(?=[.!?,]|$)`,'iu');
 const last=narration.split(/(?<=[.!?])\s+/u).at(-1)||'';return exit.test(last)&&!/\b(?:if|unless|not|never|but|until|to|for|then|and|back|rejoin\w*)\b/iu.test(last);
}
