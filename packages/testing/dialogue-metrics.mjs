// Mechanical dialogue metrics over the shared play presentation ({lines,engine} from presentationFor/linesFor).
// Tripwires for the known VN failure modes — interview cadence (every NPC line ends in a question), monologue
// walls, mannerisms recycled across the conversation ("amused glint in her eye" x3), broken typed-input echoes,
// engine glue between character lines — never a definition of good prose. Never optimize prose against these.
const QUESTION=/\?\s*["'”’)]*\s*$/,WALL_WORDS=40,NARRATION_WALL_WORDS=60,GRAM=5;
const SELF_REF=/^\s*(i ask|i say|i tell|i reply|i respond|i wonder)\b/i;
const wordsOf=t=>String(t||'').trim().split(/\s+/).filter(Boolean);
const median=xs=>{if(!xs.length)return null;const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
export function dialogueMetrics({lines,engine=[]},{playerId=''}={}){
 const spoken=lines.filter(l=>l.speaker&&l.speaker!==playerId),player=lines.filter(l=>l.speaker&&l.speaker===playerId),narration=lines.filter(l=>!l.speaker);
 const questionRate=spoken.length?+(spoken.filter(l=>QUESTION.test(String(l.text).trim())).length/spoken.length).toFixed(2):null;
 const walls=spoken.filter(l=>wordsOf(l.text).length>WALL_WORDS).length,narrationWalls=narration.filter(l=>wordsOf(l.text).length>NARRATION_WALL_WORDS).length;
 const spokenWords=spoken.reduce((s,l)=>s+wordsOf(l.text).length,0),narrationWords=narration.reduce((s,l)=>s+wordsOf(l.text).length,0);
 // Repeated >=5-word phrases across the whole conversation (player echoes excluded — callbacks the player made
 // are the player's business). A phrase coming back twice in one conversation is how stock beats feel recycled.
 const grams=new Map();
 for(const l of [...spoken,...narration]){const w=wordsOf(l.text).map(x=>x.toLowerCase().replace(/[^a-z']/g,'')).filter(Boolean);for(let i=0;i+GRAM<=w.length;i++){const g=w.slice(i,i+GRAM).join(' ');grams.set(g,(grams.get(g)||0)+1);}}
 const recycledGrams=[...grams.values()].filter(n=>n>1).length;
 // The echo-wrap failure: the typed line's self-reference survives inside the wrapper ("You tell Jana: \"I ask
 // Jana, ...\"") or its quotes come out unbalanced. Checked on player-echo lines only.
 const echoViolations=player.filter(l=>{const text=String(l.text||''),inner=text.slice(text.indexOf('"')+1);
  return SELF_REF.test(inner)||(text.includes('"')&&(text.match(/"/g)||[]).length%2===1);}).length;
 const characterLines=spoken.length+player.length;
 return {lines:lines.length,spoken:spoken.length,narration:narration.length,glue:engine.length,characterLines,
  questionRate,walls,narrationWalls,medianWords:median(spoken.map(l=>wordsOf(l.text).length)),
  dialogueRatio:spokenWords+narrationWords?+(spokenWords/(spokenWords+narrationWords)).toFixed(2):null,
  recycledGrams,echoViolations,glueDensity:characterLines?+(engine.length/characterLines).toFixed(2):null};
}
export function dialogueLine(m){return m?`dialogue: npc questions ${m.questionRate==null?'—':Math.round(m.questionRate*100)+'%'} · walls ${m.walls+m.narrationWalls} · glue/char line ${m.glueDensity??'—'} · recycled phrases ${m.recycledGrams} · echo breaks ${m.echoViolations} · median ${m.medianWords??'—'}w · D/N ${m.dialogueRatio??'—'}`:'dialogue: —';}
