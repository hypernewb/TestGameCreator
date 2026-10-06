import {containsPrivateAuthoredFact} from './knowledge.mjs';
// Model output is untrusted presentation text. The engine is the only writer of world state, so any
// state-mutating syntax a model borrows from other front-ends (RisuAI/SillyTavern CBS variable macros,
// MVU <UpdateVariable> blocks and _.set(...) patches) is stripped rather than interpreted.
const VAR_MACRO=/\{\{\s*(?:set|add|inc|dec|get)(?:global)?var\b[^{}]*\}\}/giu;
const UPDATE_BLOCK=/<(UpdateVariable|StatusPlaceHolderImpl)\b[^>]*\/>|<(UpdateVariable)\b[^>]*>[\s\S]*?(?:<\/UpdateVariable>|$)/giu;
const PATCH_LINE=/^[ \t]*_\.(?:set|add|insert|remove|assign|delete)\s*\(.*\)\s*;?[^\n]*$/gmu;
export const hasStateSyntax=text=>typeof text==='string'&&[VAR_MACRO,UPDATE_BLOCK,PATCH_LINE].some(r=>(r.lastIndex=0,r.test(text)));
export function stripStateSyntax(text){if(typeof text!=='string')return text;if(!hasStateSyntax(text))return text;return text.replace(UPDATE_BLOCK,'').replace(PATCH_LINE,'').replace(VAR_MACRO,'').replace(/[ \t]{2,}/g,' ').replace(/\n{3,}/g,'\n\n').trim();}
// Enforces the scene plan's speaker slate: a line voiced by anyone off it is dropped, and narration written as
// "Name: words" is reattributed when Name is on the slate or dropped when it is not (an invented off-slate voice).
export function enforceSpeakers(lines,speakers,pack){
 const slate=new Set(speakers),voices=pack.actors.filter(a=>a.id!==pack.playerId).map(a=>({id:a.id,names:[a.name,a.name.split(' ')[0]].map(n=>n.toLowerCase())}));
 const out=[];for(const line of lines){
  if(line.speaker){if(slate.has(line.speaker))out.push(unlabel(line,pack));continue;}
  const m=/^\s*\**([^:*\n]{1,40}?)\**\s*:\s*(\S[\s\S]*)$/u.exec(line.text),who=m&&voices.find(v=>v.names.includes(m[1].trim().toLowerCase()));
  if(!who){out.push(line);continue;}if(slate.has(who.id))out.push({...line,speaker:who.id,text:m[2].trim()});
 }
 return out;
}
// Role-play fine-tunes write a whole beat as narration: *Rowan nods.* "Yes, I got in." The VN needs actions and speech
// apart, so asterisk spans become narration and quoted (or, beside asterisks, bare) words become the speaker's line.
// The speaker is the line's own, else a slate NPC named in its narration, else the only one on the slate; otherwise
// speech stays narration. A short quote with no end punctuation ("Closed") is a sign or title, not speech.
const FIRST_PERSON=/(?:^|[^\p{L}'])(?:I|I'm|I'll|I've|I'd|my|me)(?=$|[^\p{L}'])/u,TAG=/^[,;:]?\s*(?:he|she|they|it|[A-Z][\p{L}-]+)\s+(?:says?|said|asks?|asked|repl(?:y|ies|ied)|whispers?|murmurs?|adds?|mutters?|teas(?:es|ed)|admits?|jok(?:es|ed)|laughs?|sighs?|calls?|offers?)\b[^.!?]{0,30}[.!?,]?$/iu;
const spans=text=>{const out=[];let kind='bare',buf='',close='';const push=k=>{if(buf.trim())out.push({kind,text:buf.trim()});buf='';kind=k;};
 for(const ch of text){if(kind==='act'&&ch==='*'){push('bare');continue;}if(kind==='say'&&(ch===close||ch==='"'&&close==='”')){push('bare');continue;}
  if(kind==='bare'&&ch==='*'){push('act');continue;}if(kind==='bare'&&(ch==='"'||ch==='“')){push('say');close=ch==='“'?'”':'"';continue;}buf+=ch;}
 push('bare');return out;};
const spoken=t=>t.split(/\s+/).length>=3||/[.!?,…—-]$/u.test(t),escape=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Without asterisks a fine-tune still files stage directions under the speaker ("She tugs at her collar."): a sentence
// opening on a third-person subject and a present-tense verb, with no first person, is narration, not speech.
// A body part as the subject ("Her lips bite yours.") is narration whatever the verb's ending.
const BODY='(?:eyes|gaze|voice|lips|mouth|hands?|fingers|face|cheeks|shoulders|jaw|brow|hips|breath|smile|expression|head|arms?|legs|chest|hair|tone|posture)';
// "She was my friend." is speech about someone: was/is/has/does end in s but are not stage-direction verbs.
const VERB='(?!(?:was|is|has|does)\\b)\\p{Ll}+s';
const directions=(line,pack)=>{const name=pack.actors.find(a=>a.id===line.speaker)?.name.split(' ')[0]||'He',subject=new RegExp(`^(?:(?:Then|And|Now|Still|Finally|Slowly|Suddenly|Instead|After a (?:moment|beat|pause)|For a moment),?\\s+)?(?:(?:[Hh]e|[Ss]he|${escape(name)})\\s+${VERB}|(?:His|Her)\\s+\\p{Ll}+\\s+${VERB}|(?:His|Her|${escape(name)}'s)\\s+${BODY}\\s+\\p{Ll}+)\\b`,'u'),out=[];
 for(const t of line.text.split(/(?<=[.!?…])\s+/u)){const speaker=subject.test(t)&&!FIRST_PERSON.test(t)?'':line.speaker;if(out.length&&out.at(-1).speaker===speaker)out.at(-1).text+=' '+t;else out.push({speaker,text:t});}
 return out.map((p,i)=>i?p:{...line,...p});};
export function splitRoleplay(lines,speakers,pack){
 const slate=pack.actors.filter(a=>speakers.includes(a.id)&&a.id!==pack.playerId),out=[];
 for(const line of lines){
  if(!/[*"“”]/u.test(line.text)){(line.speaker?directions(line,pack):[line]).forEach(p=>out.push(p));continue;}
  const parts=spans(line.text).map(p=>p.kind==='say'&&!spoken(p.text)?{kind:'bare',text:`"${p.text}"`}:p),quoted=parts.some(p=>p.kind==='say'),acted=parts.some(p=>p.kind==='act');
  const told=parts.filter(p=>p.kind!=='say').map(p=>p.text).join(' '),mentions=a=>new RegExp(`(?:^|[^\p{L}])${escape(a.name.split(' ')[0])}(?![\p{L}])`,'u').test(told),named=slate.find(mentions);
  const who=line.speaker||named?.id||(slate.length===1&&!pack.actors.some(a=>a.id!==pack.playerId&&!slate.includes(a)&&mentions(a))?slate[0].id:'');
  const said=p=>who&&(p.kind==='say'||p.kind==='bare'&&!quoted&&acted||p.kind!=='say'&&FIRST_PERSON.test(p.text));
  const pieces=[];for(const p of parts){const speaker=said(p)?who:'';if(!speaker&&who&&quoted&&TAG.test(p.text)){if(pieces.length)pieces.at(-1).text=pieces.at(-1).text.replace(/,$/,'.');continue;}const text=p.kind==='say'&&!speaker?`"${p.text}"`:p.text;
   if(pieces.length&&pieces.at(-1).speaker===speaker)pieces.at(-1).text+=(/^[.,!?;:…]/u.test(text)?'':' ')+text;else pieces.push({speaker,text});}
  // A bare stage direction ("*smiles*") reads as a fragment once split off; it belongs to the speaker.
  const name=pack.actors.find(a=>a.id===who)?.name.split(' ')[0],direct=t=>!who||!/^\p{Ll}/u.test(t)?t:/^(?:he|she|they)\b/u.test(t)?t[0].toUpperCase()+t.slice(1):`${name} ${t}${/[.!?…]$/u.test(t)?'':'.'}`;
  pieces.map(p=>({...p,text:(p.speaker?x=>x.replace(/,$/,'.'):direct)(p.text.replace(/\s+/g,' ').replace(/^[,;:]\s*/,'').trim())})).filter(p=>/[\p{L}\p{N}]/u.test(p.text)).forEach((p,i)=>out.push(i?p:{...line,...p}));
 }
 return out;
}
// One choke point for every model-written scene line (previews, JSON and plain answers) before sanitation.
// A model that closes and reopens its JSON inside a string leaves `"} {"` at the end of the text.
const JSON_TAIL=/["\s]*\}\s*,?\s*\{?\s*"?\s*$/u;
export const guardSceneLines=(lines,speakers,pack,context={stagedCast:speakers})=>tidyLines(splitRoleplay(enforceSpeakers(splitLabels((lines||[]).filter(l=>l&&typeof l.text==='string').map(l=>({...l,text:stripStateSyntax(l.text).replace(JSON_TAIL,'')})).filter(l=>l.text.trim()&&!containsPrivateAuthoredFact(l.text,context,pack)),pack),speakers,pack),speakers,pack),pack);
// A label mid-narration ("She sets the cup down. Mina: Took you long enough.") starts that character's line.
const labelNames=pack=>pack.actors.filter(a=>a.id!==pack.playerId).flatMap(a=>[a.name,a.name.split(' ')[0]]).filter(Boolean).map(escape).join('|');
export function splitLabels(lines,pack){const names=labelNames(pack);if(!names)return lines;const at=new RegExp(`(?<=[.!?…”"])\\s+(?=\\**(?:${names})\\**\\s*:\\s*\\S)`,'u');
 return lines.flatMap(l=>l.speaker?[l]:l.text.split(at).map((text,i)=>i?{speaker:'',text}:{...l,text}));}
// A speaker's own name label left on their line ("**Mina:** Hey."); stripped before role-play splitting reads the bold as an action.
const unlabel=(l,pack)=>{const a=pack.actors.find(x=>x.id===l.speaker);return a?{...l,text:l.text.replace(new RegExp(`^\\s*\\**(?:${[a.name,a.name.split(' ')[0]].map(escape).join('|')})\\**\\s*:\\s*\\**\\s*`,'iu'),'')}:l;};
// The finishing pass: a line cut off at a comma or mid-word, and straight quotes in narration (“curly” is the one style the VN shows).
export function tidyLines(lines,pack){
 return lines.map(l=>{if(!l.speaker)return {...l,text:l.text.replace(/"([^"\n]+)"/gu,'“$1”')};
  let text=l.text;text=text.replace(/,\s*$/u,'.');if(/[\p{L}\p{N}]$/u.test(text))text+='.';return {...l,text};}).filter(l=>l.text.trim());}
// Small models loop: a sentence an NPC already said this scene ("I don't need your help.") is dropped when said again.
// Short beats ("Yeah.", "Hey.") may recur. If every spoken line would go, the reply is kept as it is rather than silenced.
const words=t=>new Set(t.toLowerCase().match(/[\p{L}\p{N}']+/gu)||[]),alike=(a,b)=>{if(a.size<4||b.size<4)return false;let n=0;for(const w of a)if(b.has(w))n++;return n/(a.size+b.size-n)>=0.75;};
// The player's own words handed back as the NPC's line ("You said you had news?") are an echo, not a reply. So is a
// clause made only of the player's words with the pronouns mirrored: the question parroted back ("For how long?",
// "What happened to your father's boat?") or the player's line claimed in first person ("I was with Rowan.").
const PRONOUN={i:'P',me:'P',you:'P',my:'Q',your:'Q',mine:'Q',yours:'Q'},mirror=t=>(t.toLowerCase().match(/[\p{L}\p{N}']+/gu)||[]).map(w=>PRONOUN[w]||w);
// A whole earlier line said again ("It's fine. It's a wall.") counts even when its sentences are each too short to.
function freshLines(lines,earlier=[],input=''){
 const whole={},said={},note=(id,t)=>(said[id]||=[]).push(words(t)),sentences=t=>t.split(/(?<=[.!?…])\s+/u),echo=sentences(String(input)).map(words),theirs=new Set(mirror(String(input)));
 const parrot=t=>t.split(/[,;—]\s*|\s+-\s+/u).some(c=>{const w=mirror(c);return w.length>=(/\?\s*$/u.test(c)?3:4)&&w.every(x=>theirs.has(x));});
 for(const l of earlier)if(l.speaker){(whole[l.speaker]||=[]).push(words(l.text));sentences(l.text).forEach(t=>note(l.speaker,t));}else if(l.text)sentences(l.text).forEach(t=>note('',t));
 // A narration beat already used this scene ("She turns the ring on her finger.") is cut when someone still speaks this reply.
 const speaks=lines.some(l=>l.speaker);
 const out=[];for(const line of lines){if(!line.speaker){const kept=speaks?sentences(line.text).filter(t=>{const w=words(t);if((said['']||[]).some(s=>alike(s,w)))return false;note('',t);return true;}):[line.text];if(kept.length)out.push({...line,text:kept.join(' ')});continue;}
  const all=sentences(line.text);let kept=all.filter(t=>{const w=words(t);if(parrot(t)||[...(said[line.speaker]||[]),...echo].some(s=>alike(s,w)))return false;note(line.speaker,t);return true;});
  // Cutting "…right now. But... maybe it's what we both need?" must not leave a bare "But..." behind.
  if(kept.length<all.length)kept=kept.filter(t=>!/^(?:but|and|so|or|yet|well|still|anyway|because|though|then|and then)\W*$/iu.test(t.trim()));
  if(kept.length&&!(whole[line.speaker]||[]).some(s=>alike(s,words(kept.join(' ')))))out.push({...line,text:kept.join(' ')});}
 return out;
}
export const onlyRepeats=(lines,earlier=[],input='')=>lines.some(l=>l.speaker)&&!freshLines(lines,earlier,input).some(l=>l.speaker);
export function dropRepeats(lines,earlier=[],input=''){return onlyRepeats(lines,earlier,input)?lines:freshLines(lines,earlier,input);}
// Role-play fine-tunes escalate to kissing or groping on their own. Outside a pack with an intimacy module, a sentence
// where someone kisses, gropes or grinds on the player is dropped unless the player's own action started it.
const ADVANCE=/\b(?:kiss(?:es|ed|ing)?|grind(?:s|ing)?|grop(?:es?|ing)|straddl(?:es?|ing)|caress(?:es|ing)?|(?:lips|mouth)\s+(?:on|against|bites?|crush(?:es)?|finds?|meets?|claims?))\b|\b(?:grabs?|yank(?:s|ing)?|pull(?:s|ing)?|press(?:es|ing)?)\s+(?:you|your|herself|himself)\b(?:\s+\w+){0,4}\s+(?:into|against|close|closer)\b/iu;
// Role-play fine-tunes pad every beat with the same stock reactions ("a flicker of surprise crossing his features", "a small
// smile tugging at her lips", "His gaze softens."). Trailing stock clauses are cut from narration, and a narration sentence that
// is nothing but a face reacting is dropped when someone speaks this reply. Nothing spoken is touched.
const STOCK_CLAUSE=/,\s*(?:(?:a|an)\s+(?:\p{L}+\s+)?(?:flicker|hint|glint|trace|touch|note|flash|spark|pang|mix)\s+of\s|(?:(?:a|an|his|her|their)\s+)?(?:(?:small|faint|slight|soft|wry|playful|knowing|amused|sly|shy|warm|gentle|fond|sad|nostalgic)\s+)*(?:smile|smirk|grin)\s+(?:playing|tugging|curling|pulling|spreading|forming|creeping)\b|(?:his|her|their)\s+(?:expression|gaze|eyes|features)\s+(?:soften|widen|brighten|darken|flicker|narrow|shift|warm|light|glint|sparkl|twinkl)\p{L}*ing\b|(?:(?:a|an)\s+)?(?:thoughtful|pensive|contemplative)\s+(?:expression|look)\b)[^.!?…]*/giu;
const STOCK_SENTENCE=/^(?:(?:\p{Lu}\p{L}*[’']s|His|Her|Their)\s+)?(?:(?:a|an)\s+)?(?:\p{L}+\s+)?(?:expression|gaze|eyes|face|features|smile)\s+(?:softens?|softening|widens?|brightens?|darkens?|flickers?|shifts?|settles?|grows?\s+\p{L}+|lights?\s+up|narrows?)\b[^.!?…]{0,48}[.!?…]$|\b(?:consider(?:s|ing)|ponder(?:s|ing)|mull(?:s|ing) over|weigh(?:s|ing))\s+(?:your|the|this)\s+(?:question|words)\s*[.!?…]$|^(?:the|your|that|this)\s+(?:question|words?|remark|comment|line|joke|answer|reply|silence)\s+(?:lands?|landed|hangs?|hung|lingers?|settles?|sits?)\b[^.!?…]{0,48}[.!?…]$|\b(?:raw|naked)\s+vulnerability\b|\blaid bare\b/iu;
// avoid: the project's stock-phrase list; a narration sentence using one goes too, while anyone still speaks.
// Narration that authors the player's feelings, thoughts or body ("your heart pounds"); the lint repairs it on strict models.
export const PLAYER_INTERIOR=/\b(?:you (?:feel|realize|sense|think|wonder|hope|fear|want|need|remember|decide|resolve|brace yourself|steel yourself|can'?t quite place|find yourself)|your (?:heart|pulse) (?:pounds?|races?|quickens?)|(?:drawing|pulling|dragging|pulls?|draws?|drags?|lifts?) your (?:gaze|eyes|attention)|your (?:gaze|eyes) (?:being )?(?:drawn|pulled|dragged|drift(?:s|ing)?|travel(?:s|ling)?)|(?:anticipation|dread|excitement|nervous(?:ness| energy)?|relief|desire|longing) (?:courses?|washes?|floods?|surges?) (?:through|over) you|leaves? you feeling|(?:makes?|sends?) your (?:skin|spine|neck|ears|pulse) (?:prickl\w+|crawls?|tingl\w+|burn|ache)|your (?:skin|spine) (?:prickl\w+|crawls?|tingl\w+)|your (?:posture|stance|body language|breathing|breath) (?:\w+ ){0,2}(?:mirror\w*|match\w*|echo\w*|catch\w*|hitch\w*|quicken\w*|settle\w*|soften\w*|tense\w*|relax\w*|still\w*|deepen\w*|ease\w*|straighten\w*))\b/iu;
export function dropStock(lines,avoid=[],{allowPlayerReactions=false}={}){
 const speaks=lines.some(l=>l.speaker&&l.text.trim()),out=[],flat=t=>t.toLowerCase().replace(/[’']/gu,"'"),bad=avoid.map(flat).filter(Boolean);
 for(const line of lines){if(line.speaker){out.push(line);continue;}
  const kept=line.text.replace(STOCK_CLAUSE,'').split(/(?<=[.!?…])\s+/u).filter(t=>t&&(allowPlayerReactions||!PLAYER_INTERIOR.test(t))&&!(speaks&&(STOCK_SENTENCE.test(t)||bad.some(b=>flat(t).includes(b)))));
  if(kept.length)out.push({...line,text:kept.join(' ')});}
 return out.some(l=>l.speaker)||out.length?out:lines;
}
export function dropAdvances(lines,input=''){
 if(ADVANCE.test(input))return lines;
 const out=[];for(const line of lines){const kept=line.text.split(/(?<=[.!?…])\s+/u).filter(t=>!(ADVANCE.test(t)&&/\byou(?:rs?)?\b/i.test(t)));if(kept.length)out.push({...line,text:kept.join(' ')});}
 return out.length?out:lines;
}
