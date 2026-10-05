import {assert,execute} from '../core/engine.mjs';
import {contextFor} from './context.mjs';
import {playerStatements,capturedStatements,effectiveSceneMemories} from './memory.mjs';
import {effectiveGeneratedFacts,factKnownTo} from '../modules/facts.mjs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
import {prepareSceneRequest} from './service.mjs';
import {registry} from '../modules/index.mjs';
const visibleTo=(v,actor)=>v==='public'||Array.isArray(v)&&v.includes(actor);
const row=(source,text,reason)=>({source,text,reason});
// One report a creator can read against a strange reply: every persona, fact, memory and lore pool the prompt
// receives right now, plus each candidate left out and why (privacy, pool cap, budget, or state gate).
export function inspectContext(s,p,actorId=p.playerId,query=''){
 assert(p.actors.some(a=>a.id===actorId),'Unknown context owner');
 assert(typeof query==='string'&&query.length<=200,'Search text is too long');
 const c=contextFor(s,p,actorId,null,query,{wide:true}),canSee=v=>visibleTo(v,actorId);
 const supersededBy=id=>(p.facts||[]).find(n=>n.supersedes===id&&factKnownTo(s,n,actorId));
 const facts={included:(p.facts||[]).filter(f=>factKnownTo(s,f,actorId)&&!supersededBy(f.id)).map(f=>({id:f.id,text:f.text,reason:'actor knows this'})),
  excluded:(p.facts||[]).filter(f=>!factKnownTo(s,f,actorId)||supersededBy(f.id)).map(f=>({id:f.id,text:f.text,reason:factKnownTo(s,f,actorId)?`superseded by ${supersededBy(f.id).id}`:'private: actor does not know this'}))};
 const allFacts=effectiveGeneratedFacts(s),picked=new Set(c.generatedFactTrace.selected.map(f=>f.id)),dropped=new Set(c.generatedFactTrace.omitted.map(f=>f.id));
 const generated={included:c.generatedFactTrace.selected.map(({id,text,reason})=>({id,text,reason})),
  excluded:[...c.generatedFactTrace.omitted.map(({id,reason})=>({id,reason,...(allFacts.find(f=>f.id===id)?{text:allFacts.find(f=>f.id===id).text}:{})})),
   ...allFacts.filter(f=>!f.knownBy.includes(actorId)).map(f=>({id:f.id,text:f.text,reason:'private: actor does not know this'})),
   ...allFacts.filter(f=>f.knownBy.includes(actorId)&&!picked.has(f.id)&&!dropped.has(f.id)).map(f=>({id:f.id,text:f.text,reason:'not related to the current scene or topic'}))]};
 const heard=new Set(capturedStatements(s,p,actorId).map(m=>m.id)),kept=playerStatements(s,p,actorId,{keep:40,statements:4});
 const every=playerStatements(s,p,actorId,{keep:1e6,statements:1e6}),keptSources=new Set(kept.map(m=>m.source));
 const statements={included:kept.map(({source,kind,text})=>({source,kind,text,reason:'within memory caps'})),
  excludedByCap:every.filter(m=>!keptSources.has(m.source)).map(({source,kind,text})=>({source,kind,text,reason:'cap: keeps the last 40 lasting and 4 recent statements'})),
  excludedPrivate:capturedStatements(s,p,p.playerId).filter(m=>!heard.has(m.id)).map(({id,source,said})=>({id,source,text:said,reason:'private: actor did not hear this'}))};
 const sceneMems=effectiveSceneMemories(s),visibleMems=sceneMems.filter(m=>canSee(m.knownBy));
 const sceneMemories={included:visibleMems.slice(-8).map(m=>row(`scene:${m.scene}`,m.text,'last 8 scene memories')),
  excludedByCap:visibleMems.slice(0,-8).map(m=>row(`scene:${m.scene}`,m.text,'cap: keeps the last 8 scene memories')),
  excludedPrivate:sceneMems.filter(m=>!canSee(m.knownBy)).map(m=>row(`scene:${m.scene}`,m.text,'private: actor does not know this'))};
 const impressions=c.memories.filter(m=>String(m.source).startsWith('ledger:')).map(m=>row(m.source,m.text,'impression about the player'));
 const lore={selected:c.loreTrace.selected.map(({id,text,reason,truncated})=>({id,text,reason,...(truncated?{truncated}:{})})),omitted:c.loreTrace.omitted};
 const lastBudgetReport=Object.values(s.turns).filter(t=>t.contextReport).at(-1)?.contextReport||null;
 return {mode:'owner-pools',owner:actorId,actors:p.actors.map(a=>({id:a.id,name:a.name})),query,limits:'Owner-memory pools before request audience, relevance and budget filtering. Pool inclusion is eligibility for this owner; the generic prompt below is not a traced provider request.',
  persona:{actor:c.actor,player:c.player,present:c.present,backgroundCharacters:c.backgroundCharacters},facts,generated,statements,sceneMemories,impressions,lore,lastBudgetReport,promptMessages:scenePromptMessages(c,p)};
}
// Owner-pool diagnostics above retain their memory API contract; request inclusion comes only from the shared renderer.
export async function inspectSceneRequest(s,p,actorId=p.playerId,query='',provider={}){
 assert(!provider.scenePrompt,'Custom scene prompt preview is not supported');
 const d=inspectContext(s,p,actorId,query),location=s.actors[p.playerId].location;
 if(!query.trim())return {mode:'synthetic-scene-setup',owner:actorId,actors:d.actors,query,promptMessages:[],request:{synthetic:true,available:false,reason:'Enter player input to assemble a synthetic request.'}};
 const available=actorId!==p.playerId&&s.actors[actorId]?.location===location;
 let id='inspect-preview';while(s.turns[id])id+='x';
 const command={id,actorId:p.playerId,expectedRevision:s.revision,type:'core.scene',args:{characters:available?[actorId]:[],location,activity:available?'talk':'other',text:query}},preview=execute(s,command,p,registry),a=await prepareSceneRequest(preview.state,p,preview.turn,provider),cut=new Map(a.contextReport.cut),key=(pool,r)=>pool==='memories'?JSON.stringify([r.source,r.text,r.character||null]):r.id,keptMemoryIndices=(a.candidates.memories||[]).map((r,i)=>a.contextReport.included.some(([k])=>k===`memory:${r.source}:${i}`)?i:-1).filter(i=>i>=0),origin=r=>r.pool==='memories'?a.candidates.memories[keptMemoryIndices[r.index]]:r.row;
 const reason=(pool,r)=>{const k=key(pool,r),available=(a.candidates[pool]||[]).some(x=>key(pool,x)===k),kept=pool==='memories'?keptMemoryIndices.some(i=>key(pool,a.candidates.memories[i])===k):(a.context[pool]||[]).some(x=>key(pool,x)===k),budgetKey=pool==='facts'?`authored:${k}`:pool==='generatedFacts'?`fact:${k}`:pool==='lorebook'?`lore:${k}`:null;
  if(!available)return 'audience or scene selection: not shared with request participants or not a candidate for this scene';
  if(!kept)return pool==='memories'&&String(r.source).split('.')[0]===id?'current action: not repeated as recalled memory':`budget: ${cut.get(budgetKey)||'allocator excluded this candidate'}`;
  return 'prompt relevance or section cap: allocator retained this candidate but the renderer left it out';};
 const project=(pool,eligible,excluded)=>{const rows=new Map([...excluded,...eligible,...(a.candidates[pool]||[])].map(r=>[key(pool,r),r])),sent=a.contributions.filter(r=>r.pool===pool),included=sent.map(r=>({...rows.get(key(pool,origin(r))),...r.row,text:r.text,...(pool==='lorebook'&&p.lorebook?.find(x=>x.id===r.row.id)?.text!==r.text?{truncated:true,truncationReason:[p.lorebook.find(x=>x.id===r.row.id).text!==a.candidates.lorebook.find(x=>x.id===r.row.id)?.text?'entry token cap':'',a.candidates.lorebook.find(x=>x.id===r.row.id)?.text!==r.text?'allocator detail reduction':''].filter(Boolean).join('; ')}:{}),reason:`rendered in ${r.section} after audience and budget projection`})),ids=new Set(sent.map(r=>key(pool,origin(r))));
  return {included,excluded:[...rows.values()].filter(r=>!ids.has(key(pool,r))).map(r=>({...r,reason:eligible.some(x=>key(pool,x)===key(pool,r))||(a.candidates[pool]||[]).some(x=>key(pool,x)===key(pool,r))?reason(pool,r):r.reason||reason(pool,r)}))};};
 const facts=project('facts',d.facts.included,d.facts.excluded),generated=project('generatedFacts',d.generated.included,d.generated.excluded),memories=project('memories',[...d.statements.included,...d.sceneMemories.included,...d.impressions],[...d.statements.excludedByCap,...d.statements.excludedPrivate,...d.sceneMemories.excludedByCap,...d.sceneMemories.excludedPrivate]),loreRows=d.lore.omitted.map(r=>({...r,text:p.lorebook?.find(x=>x.id===r.id)?.text||''})),lore=project('lorebook',d.lore.selected,loreRows),isScene=r=>String(r.source).startsWith('scene:'),isImpression=r=>String(r.source).startsWith('ledger:'),profiles=a.contributions.filter(r=>r.pool==='persona');
 return {...d,mode:'synthetic-scene-request',limits:'Synthetic scene request assembled without a provider call. Included rows were rendered after canonical audience filtering and token allocation; this is not a captured historical request or its retries. Preview covers structured generated scenes, not authored/rules-only dispatch.',request:{synthetic:true,turnId:id,target:actorId,targetReason:actorId===p.playerId?'solo preview':available?'conversation with present NPC':'NPC is elsewhere: selected NPC omitted; effective cast follows the canonical engine plan',actor:a.actor,cast:a.cast,location,window:a.contextReport.window,reply:a.contextReport.reply,ratio:a.contextReport.ratio},budgetReport:a.contextReport,promptMessages:a.messages,
  persona:{actor:profiles.some(r=>r.row.id===actorId)?{id:actorId,name:profiles.find(r=>r.row.id===actorId).row.name,text:profiles.find(r=>r.row.id===actorId).text}:null,player:null,cast:profiles.map(r=>({id:r.row.id,name:r.row.name,text:r.text})),reason:profiles.some(r=>r.row.id===actorId)?'selected NPC profile rendered after allocation':'selected target has no rendered NPC profile in this request',playerReason:'no separate player persona block is rendered by the scene request',present:a.context.present,backgroundCharacters:a.context.backgroundCharacters},facts,generated,
  statements:{included:memories.included.filter(r=>!isScene(r)&&!isImpression(r)),excludedByCap:[],excludedPrivate:[],excludedRequest:memories.excluded.filter(r=>!isScene(r)&&!isImpression(r))},sceneMemories:{included:memories.included.filter(isScene),excludedByCap:[],excludedPrivate:[],excludedRequest:memories.excluded.filter(isScene)},impressions:memories.included.filter(isImpression),impressionsExcluded:memories.excluded.filter(isImpression),lore:{selected:lore.included,omitted:lore.excluded}};
}
