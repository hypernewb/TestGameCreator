// Adapted from src/shared/sentences.ts and src/renderer/stores/sceneSanitizer.ts
// in Venus University (AGPL-3.0-only). See NOTICE.md and LICENSE.
const SENTENCE_BREAK=/(?<=[.!?]["'\u2019\u201d)\]]?)(?<!\.\.)(?<!\b(?:Mr|Mrs|Ms|Dr|St|Jr|Sr|Prof|Sgt|Lt|vs|etc)\.)\s+(?=["'\u201c\u2018(]?[A-Z0-9])/u;
export function splitSentences(text){return text.split(SENTENCE_BREAK).map(sentence=>sentence.trim()).filter(Boolean);}
const QUOTE_CHARS=['"','“','”'];
export function unquoteLine(text){const trimmed=text.trim();if(trimmed.length<2||!QUOTE_CHARS.includes(trimmed[0])||!QUOTE_CHARS.includes(trimmed.at(-1)))return text;const inner=trimmed.slice(1,-1);return QUOTE_CHARS.some(quote=>inner.includes(quote))?text:inner.trim();}

// The committed prose is authoritative. This adapter only makes it readable in a VN box.
export function sceneLines(text,pack,actorId){const names=(pack.actors||[]).filter(a=>a.id!==pack.playerId).map(a=>({id:a.id,name:a.name}));const output=[];
 for(const paragraph of String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean)){
  const speaker=names.find(a=>paragraph.toLowerCase().startsWith(a.name.toLowerCase()+':'));
  const body=speaker?paragraph.slice(speaker.name.length+1).trim():paragraph;
  for(const sentence of splitSentences(body)){
   // Cap a page so an unusually long model reply cannot spill under the stage controls.
   const pieces=sentence.match(/.{1,260}(?:\s|$)|.{1,260}/gu)||[sentence];
   for(const piece of pieces)output.push({speaker:speaker?.id||'',text:unquoteLine(piece.trim())});
  }
 }
 return output.slice(0,80).filter(x=>x.text);
}
