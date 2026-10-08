import {spokenLine} from '../../vendor/venus/sceneText.mjs';
// Content words of a line, shared by repeat detection and the trust gate: five-plus letters, lowercased.
export const speechWords=line=>new Set(String(line||'').toLocaleLowerCase().match(/\p{L}{5,}/gu)||[]);
// A question is "the same" as one the target already heard when most content words overlap (Venus voices the
// deflection; the engine only decides the fact).
export function isRepeat(utterance,priorTopics){
 const said=speechWords(utterance);if(said.size<3)return false;
 return (priorTopics||[]).some(topic=>{const was=speechWords(topic);if(was.size<3)return false;let shared=0;for(const word of said)if(was.has(word))shared++;return shared/(said.size+was.size-shared)>=0.6;});
}
const CONDITIONAL=/^(?:if|when|unless|after|once|suppose|imagine|pretend)\b/iu;
const ACT='tease|flirt|sit|stand|walk|run|lean|smile|grin|wink|nod|laugh|touch|kiss|hug|hold|take|give|bring|buy|order|look|watch|wave|step|move|leave|wait|follow|reach|pull|push|brush|stroke|squeeze|pour|show|offer|go|continue|try|attempt';
// ACTION covers narration plus speech verbs (indirect intent); NARRATED is narration alone, so "I tell Mina that..." is not a gesture.
const ACTION=new RegExp(`^(?:I\\s+)?(?:${ACT}|tell|say|ask|reply|whisper|admit|explain)\\b`,'iu'),NARRATED=new RegExp(`^(?:I\\s+)?(?:${ACT})\\b`,'iu');
// A line that is only a gesture (wholly starred, or opening with an action verb) carries no speech for the reaction rules.
export const narratedLine=text=>{const raw=String(text||'').trim();return /^\*[^*]*\*[.!?]?$/u.test(raw)||NARRATED.test(raw);};
// Conservative eligibility for the new trust bridge; action and indirect-intent scenes retain their existing authored reactions.
// Version 3 also reads a first-person report with no "that" ("I tell her I finally fixed it") as the words said; v2 saves keep the old answer.
export function sceneUtterance(text,version=3){const raw=String(text||'').trim();if(!raw||CONDITIONAL.test(raw)||/\bafter (?:her|his|their) (?:response|reply|reaction)\b/iu.test(raw))return null;const quoted=raw.match(/^(?:I (?:say|tell|ask|reply|whisper|admit|explain)(?: to)?(?: [\p{L}]+){0,3}[,:]?\s*)?["“]([^"“”]+)["”][.!]?$/u);if(quoted)return quoted[1];const told=version>2&&raw.match(/^I (?:tell|say|ask|reply|admit|explain|whisper)(?: (?:her|him|them|me|\p{Lu}\p{Ll}+))?,?\s+(I\b[^"“”*]+)$/u);if(told&&!ACTION.test(told[1]))return spokenLine(told[1]);if(/["“”*]/u.test(raw)||ACTION.test(raw))return null;return spokenLine(raw);}
