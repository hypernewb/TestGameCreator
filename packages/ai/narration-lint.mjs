// Generalizes the truth guard in scene-boundaries.mjs into a full lint pass run on every narration
// before it's shown: attendance, knowledge leaks, and content-level overflow.
import {assertSceneBoundaries} from './scene-boundaries.mjs';
const EXPLICIT=/\b(cock|dick|pussy|penis|vagina|cum(?:ming|s|shot)?|orgasms?|climax(?:es|ed|ing)?|thrust(?:ing|s|ed)?|erections?|clit(?:oris)?|moans? in pleasure)\b/iu;
// A fact's quote is how facts.mjs proves a fact happened in narration; the same quote in a line spoken by
// someone outside that fact's knownBy means the model let a character speak knowledge it was never given.
function assertKnowledgeLeaks(value,context){
 for(const fact of context.knownFacts||[]){
  if(!fact.quote)continue;
  for(const line of value.lines){
   if(!line.speaker||fact.knownBy.includes(line.speaker))continue;
   if(line.text.includes(fact.quote))throw Error(`${line.speaker} should not know: ${fact.text}`);
  }
 }
}
function assertContentLevel(value,context,pack){
 const level=pack.intimacySettings?.contentLevel;
 if(level!=='fade'&&level!=='suggestive')return;
 if(value.lines.some(line=>EXPLICIT.test(line.text)))throw Error(`Content level is "${level}": remove explicit sexual detail`);
}
const CHECKS=[['attendance',assertSceneBoundaries],['knowledge',assertKnowledgeLeaks],['content',assertContentLevel]];
export function lintScene(value,context,pack){
 for(const [check,run] of CHECKS){
  try{run(value,context,pack);}
  catch(error){throw Object.assign(Error(error.message),{lintCheck:check});}
 }
}
