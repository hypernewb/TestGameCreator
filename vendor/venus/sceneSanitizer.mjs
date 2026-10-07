// Adapted from Venus University src/renderer/stores/sceneSanitizer.ts,
// commit 79301df55bc39a0996229ccc6f12ccce422a80b2.
// Copyright Venus Dev and contributors. AGPL-3.0-only; see ./LICENSE.
// The original game-specific character, outfit, CG and dating stores are replaced by a
// per-turn allowlist. This sanitizer affects presentation only, never world state.
import {parseAction,showAction} from './sceneActions.mjs';
import {splitSentences,unquoteLine} from './sceneText.mjs';

export function splitOverflow(line,maximum=260){
 if(['playerSpeech','playerAction'].includes(line.type))return [line];
 if(line.text.length<=maximum)return [line];
 const sentences=splitSentences(line.text);if(sentences.length<2)return [line];
 const chunks=[];for(const sentence of sentences){const grown=chunks.length?`${chunks.at(-1)} ${sentence}`:sentence;if(chunks.length&&grown.length<=maximum)chunks[chunks.length-1]=grown;else chunks.push(sentence);}
 return chunks.map((text,i)=>i?{speaker:line.speaker,text}:{...line,text});
}
// remote: cast members talking by phone; they may speak but never appear on stage.
export function sanitizeSceneResponse(raw,pack,state,cast,remote=[]){
 const location=state.actors[pack.playerId].location,far=new Set(remote.filter(id=>cast.includes(id)&&state.actors[id])),allowed=new Set(cast.filter(id=>state.actors[id]?.location===location||far.has(id))),backgrounds=new Set(pack.locations.map(l=>l.background).filter(Boolean));
 const visible=new Set([...allowed].filter(id=>!far.has(id)).slice(0,4)),seen=new Set(visible),lines=[];
 const values=Array.isArray(raw?.lines)?raw.lines:[];
 for(const entry of values.slice(0,80)){
  if(!entry||typeof entry.text!=='string')continue;
  if(typeof entry.speaker==='string'&&entry.speaker&&!allowed.has(entry.speaker))continue;
  const text=unquoteLine(entry.text.trim());if(!text||text.length>1000)continue;
  let speaker=typeof entry.speaker==='string'&&allowed.has(entry.speaker)?entry.speaker:'';
  const line={speaker,text,...(entry.type?{type:entry.type}:{}),...(entry.source!==undefined?{source:entry.source}:{}),...(entry.pending!==undefined?{pending:entry.pending}:{})},background=entry.background??entry.bg;
  if(typeof background==='string'&&backgrounds.has(background))line.background=background;
  const stage=[];
  if(speaker&&!far.has(speaker)&&!visible.has(speaker)&&!seen.has(speaker)&&visible.size<4){visible.add(speaker);seen.add(speaker);stage.push(showAction('show',speaker));}
  for(const instruction of Array.isArray(entry.stage)?entry.stage:Array.isArray(entry.actions)?entry.actions:[]){
   if(typeof instruction!=='string'||instruction.length>120)continue;
   const action=parseAction(instruction,(id,pose)=>Boolean(pack.actors.find(a=>a.id===id)?.poses?.some(p=>p.id===pose)));
   if(!action||!allowed.has(action.charKey)||far.has(action.charKey))continue;
   if(action.kind==='show'){if(visible.has(action.charKey)||visible.size>=4)continue;visible.add(action.charKey);seen.add(action.charKey);stage.push(instruction);}
   if(action.kind==='hide'){if(!visible.has(action.charKey))continue;visible.delete(action.charKey);stage.push(instruction);}
   if(action.kind==='sprite'&&visible.has(action.charKey))stage.push(instruction);
  }
  if(stage.length)line.stage=stage;
  if(line.speaker&&!visible.has(line.speaker)&&!far.has(line.speaker))line.speaker='';
  lines.push(...splitOverflow(line));if(lines.length>=80)break;
 }
 if(!lines.length)throw Error('Scene response has no usable lines');
 return {lines:lines.slice(0,80),summary:typeof raw.summary==='string'?raw.summary.trim().slice(0,500):'',end:raw.end_scene===true};
}
