import {assert,safeKey} from '../core/engine.mjs';

// Narrative facts are attached to their source turns, so save replay and retries
// never mutate the deterministic world state after the action has committed.
export const facts={id:'story.facts',version:'0.1.0',coreApi:'0.1.0',requires:[],
 init:()=>({}),
 panel(s,p){const count=Object.values(s.turns).reduce((n,t)=>n+(t.generatedFacts?.length||0),0);return {title:'Discovered facts',lines:[`${count} sourced narrative facts recorded.`]};}
};

export function allGeneratedFacts(state){return Object.values(state.turns).filter(t=>t.status==='complete').flatMap(t=>t.generatedFacts||[]);}
export function validateFactEdits(edits,state,pack){
 assert(Array.isArray(edits)&&edits.length<=10000,'Invalid fact edits');
 const facts=new Map(allGeneratedFacts(state).map(f=>[f.id,f]));
 for(const edit of edits){assert(edit&&safeKey(edit.id)&&facts.has(edit.factId)&&['retire','correct','merge'].includes(edit.action),'Invalid fact edit');assert(typeof edit.at==='string'&&edit.at.length<=40,'Invalid edit time');if(edit.action==='correct')assert(typeof edit.text==='string'&&edit.text.trim().length>=8&&edit.text.length<=220&&!/\b(?:equipped|inventory|trust score|affection score|flag set|quest completed)\b/i.test(edit.text),'Invalid correction text');if(edit.action==='merge')assert(edit.targetId!==edit.factId&&facts.get(edit.targetId)?.subject===facts.get(edit.factId).subject,'Merge target must be a different fact about the same subject');}
 assert(pack.modules['story.facts']||!edits.length,'Fact ledger module is disabled');
}
export function effectiveGeneratedFacts(state){
 const edits=new Map((state.factEdits||[]).map(edit=>[edit.factId,edit]));
 const seen=new Set();return allGeneratedFacts(state).reverse().map(f=>{const edit=edits.get(f.id);return {...f,text:edit?.action==='correct'?edit.text:f.text,edit:edit||null,retired:edit?.action==='retire'||edit?.action==='merge'};}).filter(f=>{if(f.retired)return false;const key=`${f.subject}:${f.text.trim().toLocaleLowerCase()}`;if(seen.has(key))return false;seen.add(key);return true;});
}

export function validateGeneratedFacts(raw,pack,turn,narrative){
 assert(Array.isArray(raw)&&raw.length<=3,'Invalid fact list');
 const subjects=new Set([...pack.actors,...pack.locations,...pack.items||[],...pack.objects||[]].map(x=>x.id));
 const cast=new Set(turn.command.type==='core.scene'?turn.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.characters||[]:turn.command.type==='social.speak'?[turn.command.args.target]:turn.command.type==='world.acceptHangout'?[turn.command.args.char]:[]);
 const location=turn.events.find(e=>e.type==='core.sceneStarted'||e.type==='core.sceneContinued')?.payload.location||turn.events.find(e=>e.type==='social.spoke')?.payload.location;
 return raw.map((fact,index)=>{
  assert(fact&&typeof fact==='object'&&subjects.has(fact.subject),'Unknown fact subject');
  // What the player says about themselves ("my name is Mara") is in their action, not the narration.
  const said=fact.subject===pack.playerId?String(turn.input||turn.command.args?.text||''):'';
  assert(typeof fact.quote==='string'&&fact.quote.length>=8&&fact.quote.length<=220&&(narrative.includes(fact.quote)||said.includes(fact.quote)),'Fact quote must occur in scene narration');
  assert(typeof fact.text==='string'&&fact.text.trim().length>=8&&fact.text.length<=220,'Invalid fact text');
  // New claims cannot alter ownership, flags, scores, or other game rules.
  assert(!/\b(?:equipped|inventory|trust score|affection score|flag set|quest completed)\b/i.test(fact.text),'Mechanical changes require a rule');
  assert(fact.subject===pack.playerId||cast.has(fact.subject)||fact.subject===location||turn.events.some(e=>e.payload?.item===fact.subject||e.payload?.location===fact.subject),'Fact subject was not involved in the action');
  const knownBy=[pack.playerId,...(cast.has(fact.subject)?[fact.subject]:[])];
  return {id:`${turn.id}.fact-${index}`,subject:fact.subject,text:fact.text.trim(),quote:fact.quote,source:turn.id,knownBy};
 });
}

export function selectGeneratedFacts(state,pack,actorId,query='',budget=650){
 if(!state.modules['story.facts'])return {selected:[],omitted:[],budget,used:0};
 const location=state.actors[actorId].location,words=query.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu)||[];
 const present=new Set(Object.entries(state.actors).filter(([,actor])=>actor.location===location).map(([id])=>id));
 const candidates=effectiveGeneratedFacts(state).filter(f=>f.knownBy.includes(actorId)).map(f=>{
  const subject=pack.actors.find(a=>a.id===f.subject)||pack.locations.find(l=>l.id===f.subject)||pack.items?.find(i=>i.id===f.subject)||pack.objects?.find(o=>o.id===f.subject);
  const related=f.subject===location||f.subject===actorId||present.has(f.subject);
  const matched=words.some(w=>`${subject?.name||''} ${f.subject} ${f.text}`.toLowerCase().includes(w));
  return {...f,score:(related?10:0)+(matched?8:0),reason:related?'current scene':matched?'player topic':'unrelated'};
 }).filter(f=>f.score>0).sort((a,b)=>b.score-a.score||b.source.localeCompare(a.source));
 let used=0;const selected=[],omitted=[];for(const fact of candidates){if(used+fact.text.length<=budget){selected.push(fact);used+=fact.text.length;}else omitted.push({id:fact.id,reason:'budget'});}return {selected,omitted,budget,used};
}
