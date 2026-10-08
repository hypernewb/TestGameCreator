// Shared by the play screen and evaluation: presentation only, no state changes.
import {sceneLines} from '../vendor/venus/sceneText.mjs';
import {firstTurn} from './firsts-ui.mjs';
export const SUB_TURNS=new Set(['goals.reveal','goals.advance','social.priceActs','social.scoreFirst','social.resolveConfrontation','core.endScene']);
// One player action spans its main turn and the sub-turns after it (act pricing, first scoring, the scene close).
export const actionTurns=s=>{const turns=Object.values(s.turns||{}),i=turns.findLastIndex(t=>!SUB_TURNS.has(t.command?.type));return turns.slice(i<0?Math.max(0,turns.length-1):i);};
export const freeConversation=data=>Boolean(data.pack.gameProject?.conversationStyle==='continuous'&&data.state.scene?.characters?.length&&!data.state.modules['story.scenes']?.pending&&!data.state.modules['social.firsts']?.active&&!data.diagnostics?.ended);
export function conversationCommand(data,command){return data.pack.gameProject?.conversationStyle==='continuous'&&!data.state.scene&&!data.state.modules['story.scenes']?.pending&&!data.state.modules['social.firsts']?.active&&!data.diagnostics?.ended&&command?.type==='social.speak'?{type:'core.scene',args:{text:command.args.text||`Talk to ${data.pack.actors.find(a=>a.id===command.args.target)?.name||command.args.target}`,location:data.state.actors[data.pack.playerId].location,characters:[command.args.target],activity:'talk'}}:command;}
// Keep authored pages; split oversized prose losslessly, with staging at the start and boundaries at the end.
export function playerLines(data){return linesFor(data).flatMap(raw=>{const line=raw.type==='playerSpeech'?{...raw,speaker:data.pack.playerId}:raw;if(line.text.length<=260)return [line];const pages=[];let text=line.text;while(text.length){let n=Math.min(260,text.length);if(n<text.length){const space=text.slice(0,n).search(/\s+\S*$/u);if(space>0)n=space+1;if(/[\uD800-\uDBFF]/u.test(text[n-1])&&/[\uDC00-\uDFFF]/u.test(text[n]))n--;}const page={...line,text:text.slice(0,n)};if(pages.length)for(const field of ['stage','background','cg'])delete page[field];text=text.slice(n);if(text.length)for(const field of ['pause','consent','adultBoundary'])delete page[field];pages.push(page);}return pages;});}
// Relationship results read as one reaction per character, not a page per stat. gameProject.reactionDisplay:
// 'hints' (default: warmed/cooled plus the authored clue), 'reasons' (the authored like/dislike reason) or 'numbers' (every stat line).
const SHIFTS={'social.relationshipChanged':x=>x.delta??x.value-x.old,'social.romancePointsChanged':x=>x.delta,'social.chemistryChanged':x=>x.delta,'social.attractionChanged':x=>x.to-x.from,'social.bondChanged':x=>x.delta,'social.actPriced':x=>x.verdict==='unpaid'?0:x.points};
const NOTABLE=new Set(['social.crushStarted','social.romanceRankReady','social.planMade','social.planKept','social.planMissed','social.departureCued','social.departed']);
export function reactionsFor(events,p){
 const mode=p.gameProject?.reactionDisplay||'hints',who=x=>x.character||x.actor,rows=new Map(),other=[];
 for(const e of events){const x=e.payload||{},id=who(x);if(e.type==='social.actPriced'&&x.verdict==='unpaid'){other.push(x.text);continue;}
  if(SHIFTS[e.type]&&(e.type!=='social.relationshipChanged'||x.toward===p.playerId)&&id&&id!==p.playerId){const r=rows.get(id)||{id,sum:0,clue:'',reason:'',lines:[]};rows.set(id,r);r.sum+=Number(SHIFTS[e.type](x))||0;if(e.type==='social.actPriced'&&x.entry&&x.reason&&!r.reason)r.reason=x.reason;if(e.type!=='social.actPriced'&&x.text)r.lines.push(x.text);}
  else if(e.type==='social.likeClueAdded'&&id){const r=rows.get(id)||{id,sum:0,clue:'',reason:'',lines:[]};rows.set(id,r);r.clue||=x.text;}
  else if(x.text&&NOTABLE.has(e.type))other.push(x.text);}
 const name=id=>p.actors.find(a=>a.id===id)?.name||id,said=new Set(),out=[];
 for(const r of rows.values()){const mood=r.sum>0?'up':r.sum<0?'down':'';if(mode==='numbers'){for(const t of r.lines)out.push({speaker:'',kind:'REACTION',mood,character:r.id,text:t});continue;}
  const head=r.sum>0?`${name(r.id)} warmed to you`:r.sum<0?`${name(r.id)} cooled a little`:'',why=mode==='reasons'&&r.reason?r.reason:'',text=head?`${head}${why?`: ${why}`:''}.${!why&&r.clue?` ${r.clue}`:''}`:r.clue;
  if(text)out.push({speaker:'',kind:'REACTION',mood,character:r.id,text});}
 for(const t of other)if(t&&!said.has(t)){said.add(t);out.push({speaker:'',kind:'RESULT',text:t});}
 return out;}
export function linesFor(data){const {state:s,pack:p}=data,turns=Object.values(s.turns),main=[...turns].reverse().find(t=>!SUB_TURNS.has(t.command?.type))||turns.at(-1),scene=p.scriptedScenes?.find(x=>x.id===s.modules['story.scenes']?.pending),active=scene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||scene,d=data.diagnostics||{};
 const first=firstTurn(s,p),source=first?.source||main;
 // A scene the close of this action set off (time passed, someone turned up) plays after the reply, not instead of it.
 const after=active&&source?.sceneLines?.length&&turns.slice(turns.indexOf(main)+1).some(t=>t.events?.some(e=>e.type==='story.sceneStarted'))?[{speaker:'',text:active.opening,...(active.template?{kind:'DIRECTOR'}:{})},...(active.pages||[]).map(l=>({...l,...(active.template?{kind:l.kind||'DIRECTOR'}:{})}))].filter(l=>l.text):[];
 const base=after.length||source?.command?.type==='story.respond'&&source.sceneLines?.length?source.sceneLines.map(l=>({...l})):active?[{speaker:'',text:active.opening},...(active.pages||[]).map(l=>({...l}))]:source?.sceneLines?.length?source.sceneLines.map(l=>({...l})):source?.narrative?sceneLines(source.narrative,p,source.command.args?.target||source.command.args?.char):[{speaker:'',text:p.locations.find(l=>l.id===s.actors[p.playerId].location)?.description||''}];
 // A director beat is its own marked moment, distinct from the free-typed scene around it.
 if(active?.template&&!after.length)for(const l of base)l.kind=l.kind||'DIRECTOR';
 if(first?.opening&&!base.some(l=>l.text===first.opening))base.unshift({speaker:'',text:first.opening});
 if(first?.cue&&!base.some(l=>l.text===first.cue))base.push({speaker:first.first.character,text:first.cue});
 if(first?.ended&&!base.some(l=>l.text===first.ended.text))base.push({speaker:'',text:first.ended.text,...(first.cg?{cg:first.cg}:{})});
 const sexCg=turns.slice(turns.indexOf(main)).flatMap(t=>t.events||[]).find(e=>e.type==='social.intimacyCompleted'&&e.payload.cg);if(sexCg)base.push({speaker:'',text:sexCg.payload.text,cg:sexCg.payload.cg});
 // Every relationship shift the action caused, summed into one reaction per character.
 const reactions=reactionsFor(turns.slice(turns.indexOf(main)).flatMap(t=>t.events||[]),p);
 // The engine's close text marks the end unless the prose already said goodbye (a model or solo natural close).
 const close=[...turns.slice(turns.indexOf(main))].reverse().flatMap(t=>t.events||[]).find(e=>e.type==='core.sceneEnded'&&e.payload.reason!=='natural')?.payload.text;
 const said=new Set(base.map(l=>l.text?.trim()));const felt=reactions.filter(l=>l.kind==='REACTION'),rest=reactions.filter(l=>l.kind!=='REACTION'&&!said.has(l.text));return [...base.filter(l=>l.text),...(felt.length&&(p.gameProject?.reactionDisplay||'hints')!=='numbers'?[{speaker:'',kind:'REACTION',mood:felt.every(l=>l.mood==='down')?'down':felt.some(l=>l.mood==='up')?'up':'',characters:felt.map(l=>l.character),text:felt.map(l=>l.text).join(' ')}]:felt),...rest,...(d.highlights||[]).filter(h=>!said.has(h.text?.trim())).map(h=>({speaker:'',kind:'RESULT',text:h.text})),...(close?[{speaker:'',kind:'SCENE END',text:close}]:[]),...after,...(d.ended?[{speaker:'',kind:'THE END',text:`${d.ended.name}. ${d.ended.text}`}]:[])];}
