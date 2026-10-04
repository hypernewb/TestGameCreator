import {assert} from '../core/engine.mjs';
import {contextFor} from './context.mjs';
import {playerStatements,capturedStatements} from './memory.mjs';
import {effectiveGeneratedFacts,factKnownTo} from '../modules/facts.mjs';
import {scenePromptMessages} from '../../vendor/venus/scenePrompt.mjs';
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
 const sceneMems=s.modules['story.scenes']?.memories||[],visibleMems=sceneMems.filter(m=>canSee(m.knownBy));
 const sceneMemories={included:visibleMems.slice(-8).map(m=>row(`scene:${m.scene}`,m.text,'last 8 scene memories')),
  excludedByCap:visibleMems.slice(0,-8).map(m=>row(`scene:${m.scene}`,m.text,'cap: keeps the last 8 scene memories')),
  excludedPrivate:sceneMems.filter(m=>!canSee(m.knownBy)).map(m=>row(`scene:${m.scene}`,m.text,'private: actor does not know this'))};
 const impressions=c.memories.filter(m=>String(m.source).startsWith('ledger:')).map(m=>row(m.source,m.text,'impression about the player'));
 const lore={selected:c.loreTrace.selected.map(({id,text,reason,truncated})=>({id,text,reason,...(truncated?{truncated}:{})})),omitted:c.loreTrace.omitted};
 const lastBudgetReport=Object.values(s.turns).filter(t=>t.contextReport).at(-1)?.contextReport||null;
 return {owner:actorId,actors:p.actors.map(a=>({id:a.id,name:a.name})),query,limits:'Preview of what the AI would receive right now for this owner and search text, with each left-out candidate and why. Privacy comes from knownBy ownership; space limits come from pool caps (650 characters of facts, 4 lore entries at 50 tokens each, 40 lasting + 4 recent statements, 8 scene memories) plus the per-turn token allocator, whose cuts from the last committed AI turn appear under Budget report. The exact prompt below shows everything else the model is told, including the persona blocks.',
  persona:{actor:c.actor,player:c.player,present:c.present,backgroundCharacters:c.backgroundCharacters},facts,generated,statements,sceneMemories,impressions,lore,lastBudgetReport,promptMessages:scenePromptMessages(c,p)};
}
