// Shared by the play screen and evaluation: presentation only, no state changes.
import {sceneLines} from '../vendor/venus/sceneText.mjs';
import {firstTurn} from './firsts-ui.mjs';
export const SUB_TURNS=new Set(['social.priceActs','social.scoreFirst','social.resolveConfrontation','core.endScene']);
export function linesFor(data){const {state:s,pack:p}=data,turns=Object.values(s.turns),main=[...turns].reverse().find(t=>!SUB_TURNS.has(t.command?.type))||turns.at(-1),scene=p.scriptedScenes?.find(x=>x.id===s.modules['story.scenes']?.pending),active=scene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||scene,d=data.diagnostics||{};
 const first=firstTurn(s,p),source=first?.source||main;
 const base=source?.command?.type==='story.respond'&&source.sceneLines?.length?source.sceneLines.map(l=>({...l})):active?[{speaker:'',text:active.opening},...(active.pages||[]).map(l=>({...l}))]:source?.sceneLines?.length?source.sceneLines.map(l=>({...l})):source?.narrative?sceneLines(source.narrative,p,source.command.args?.target||source.command.args?.char):[{speaker:'',text:p.locations.find(l=>l.id===s.actors[p.playerId].location)?.description||''}];
 // A director beat is its own marked moment, distinct from the free-typed scene around it.
 if(active?.template)for(const l of base)l.kind=l.kind||'DIRECTOR';
 if(first?.opening&&!base.some(l=>l.text===first.opening))base.unshift({speaker:'',text:first.opening});
 if(first?.cue&&!base.some(l=>l.text===first.cue))base.push({speaker:first.first.character,text:first.cue});
 if(first?.ended&&!base.some(l=>l.text===first.ended.text))base.push({speaker:'',text:first.ended.text,...(first.cg?{cg:first.cg}:{})});
 // Every relationship shift the action caused, in order: first old value → last value per character.
 const shifts=[];for(const t of turns.slice(turns.indexOf(main)))for(const e of t.events||[])if(e.type==='social.relationshipChanged'&&e.payload.toward===p.playerId){const hit=shifts.find(x=>x.actor===e.payload.actor);if(hit)hit.value=e.payload.value;else shifts.push({actor:e.payload.actor,old:e.payload.old,value:e.payload.value});}
 const scores=shifts.map(x=>`${p.actors.find(a=>a.id===x.actor)?.name||x.actor} trust ${x.old} → ${x.value}`).join(' · ');
 // The engine's close text marks the end unless the prose already said goodbye (a model or solo natural close).
 const close=[...turns.slice(turns.indexOf(main))].reverse().flatMap(t=>t.events||[]).find(e=>e.type==='core.sceneEnded'&&e.payload.reason!=='natural')?.payload.text;
 const said=new Set(base.map(l=>l.text?.trim()));return [...base.filter(l=>l.text),...(scores?[{speaker:'',kind:'RESULT',text:scores}]:[]),...(d.highlights||[]).filter(h=>!said.has(h.text?.trim())).map(h=>({speaker:'',kind:'RESULT',text:h.text})),...(close?[{speaker:'',kind:'SCENE END',text:close}]:[]),...(d.ended?[{speaker:'',kind:'THE END',text:`${d.ended.name}. ${d.ended.text}`}]:[])];}
