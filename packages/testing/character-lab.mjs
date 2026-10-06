// Character Chat Lab core (T-107). Builds an isolated one-NPC lab campaign from any pack, applies lab controls
// as normal engine commands or labelled lab-only patches, and snapshots route state every turn. No fs, no server,
// no ai-settings reads: the caller supplies the provider, the store and the registry.
import {createWorld,execute,assert} from '../core/engine.mjs';
import {Store} from '../persistence/store.mjs';
import {GameService} from '../ai/service.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {dialogueMetrics} from './dialogue-metrics.mjs';
import {progressionRequirements} from '../modules/progression.mjs';
import {traitsOf} from '../modules/arc.mjs';
import {liveWants} from '../modules/wants.mjs';
import {bondKey} from '../modules/bonds.mjs';
import {randomUUID} from 'node:crypto';

export const DATING_PHASES=['available','crush','dating','exclusive'];
const SAFE=k=>!['__proto__','constructor','prototype'].includes(k);
const setPath=(state,path,value)=>{let o=state;for(const k of path.slice(0,-1)){if(!SAFE(k))return false;o=o[k]??={};}if(!SAFE(path.at(-1)))return false;o[path.at(-1)]=structuredClone(value);return true;};
const clampOf=(pack,path,value)=>{const id=path.at(-2)==='player'?null:path.at(-2);return value;};
const mainTurn=state=>{const ts=[...Object.values(state.turns||{})].reverse().find(t=>!/-acts$|-first$|-end$|-claim$/.test(t.id));return ts||null;};

export const labCast=pack=>pack.actors.filter(a=>a.id!==pack.playerId).map(a=>({id:a.id,name:a.name,location:a.location}));

// The route stages for one NPC, from whichever authored source the pack uses.
export function stageSource(pack,npc){
 const graph=(pack.relationshipProgressions||[]).find(g=>g.character===npc);
 if(graph&&pack.modules['social.progression'])return {source:'progression',graph};
 const track=(pack.arcTracks||[]).find(t=>t.character===npc);
 if(track&&pack.modules['character.arc'])return {source:'arc',track};
 if((pack.datingProfiles||[]).some(d=>d.character===npc)&&pack.modules['social.dating'])return {source:'dating'};
 return null;
}
export function stagesOf(pack,npc){
 const s=stageSource(pack,npc);if(!s)return [];
 if(s.source==='progression')return (pack.relationshipStates||[]).map(x=>({id:x.id,name:x.name}));
 if(s.source==='arc')return (s.track.stages||[]).map((x,i)=>({id:x.id,name:x.name,index:i}));
 return DATING_PHASES.map(id=>({id,name:id}));
}
export function stageState(state,pack,npc){
 const s=stageSource(pack,npc);if(!s)return null;
 if(s.source==='progression'){const id=state.modules['social.progression'].states[npc];return {source:'progression',id,name:pack.relationshipStates.find(x=>x.id===id)?.name||id};}
 if(s.source==='arc'){const i=state.modules['character.arc']?.characters?.[npc]?.stage??0,st=(s.track.stages||[])[i];return {source:'arc',id:st?.id||null,name:st?.name||null,index:i};}
 const phase=state.modules['social.dating']?.characters?.[npc]?.phase||'available';return {source:'dating',id:phase,name:phase};
}
// Conditions to leave the current stage: each marked met or unmet, with the unmet reasons.
export function stageGates(state,pack,npc){
 const s=stageSource(pack,npc);if(!s)return [];
 if(s.source==='progression'){const current=state.modules['social.progression'].states[npc];
  return (s.graph.transitions||[]).filter(t=>t.from===current).map(t=>{const reasons=progressionRequirements(t.requires,state,pack,npc);return {to:t.to,toName:pack.relationshipStates.find(x=>x.id===t.to)?.name||t.to,event:t.event,met:!reasons.length,reasons};});}
 if(s.source==='arc'){const traits=traitsOf(state,pack,npc),next=(s.track.stages||[])[(state.modules['character.arc']?.characters?.[npc]?.stage??0)+1];
  return next?Object.entries(next.when||{}).map(([trait,min])=>({to:next.id,toName:next.name,stat:trait,value:traits[trait]??0,min:min??0,met:(traits[trait]??0)>=(min??0),reasons:[]})):[];}
 return [];
}
// Conditions that guard entry into a stage (what a lab jump has to satisfy), or null.
export function stageEntry(pack,npc,stageId){
 const s=stageSource(pack,npc);if(!s)return null;
 if(s.source==='progression'){const t=(s.graph.transitions||[]).filter(t=>t.to===stageId).sort((a,b)=>Object.keys(a.requires||{}).length-Object.keys(b.requires||{}).length)[0];return t?{from:t.from,requires:t.requires||{}}:{};}
 if(s.source==='arc'){const st=(s.track.stages||[]).find(x=>x.id===stageId);return st?{when:st.when||{}}:null;}
 return DATING_PHASES.includes(stageId)?{}:null;
}
// The lab-only patches that land in a stage and satisfy its entry conditions, each clamped to its field's range.
export function stagePatch(pack,npc,stageId){
 const entry=stageEntry(pack,npc,stageId);if(!entry)return null;
 const patches=[];
 if(entry.requires){
  for(const [flag] of Object.entries(entry.requires.flags||{}))if(flag)patches.push({path:['flags',flag],value:true});
  for(const [dimension,min] of Object.entries(entry.requires.bonds||{}))patches.push({path:['modules','social.bonds','values',bondKey(npc,dimension,pack.playerId)],value:Math.max(0,min||0)});
  for(const rule of entry.requires.stats||[]){const actor=rule.character==='self'?npc:rule.character==='player'?pack.playerId:rule.character,d=(pack.statDefinitions||[]).find(x=>x.id===rule.stat),min=rule.min??d?.min??0;
   patches.push({path:['modules','character.stats','values',`${actor}--${rule.stat}`],value:min,clamp:[d?.min??-100,d?.max??100]});}
  patches.push({path:['modules','social.progression','states',npc],value:stageId});
 }else if(entry.when){
  for(const [trait,min] of Object.entries(entry.when))patches.push({path:['modules','character.arc','characters',npc,'traits',trait],value:min??0,clamp:[0,100]});
  const i=(pack.arcTracks||[]).find(t=>t.character===npc)?.stages?.findIndex(x=>x.id===stageId);
  patches.push({path:['modules','character.arc','characters',npc,'stage'],value:i});
 }else patches.push({path:['modules','social.dating','characters',npc,'phase'],value:stageId});
 return patches.map(p=>p.clamp?{...p,value:Math.max(p.clamp[0],Math.min(p.clamp[1],p.value))}:p);
}
// All relationship numbers including hidden ones: the Lab is a debug view.
export function labSnapshot(state,pack,npc){
 const player=pack.playerId,clock=calendarFor(state.tick,pack),at=state.actors[player].location;
 const stats=[];for(const who of [player,npc])for(const d of pack.statDefinitions||[]){const v=state.modules['character.stats']?.values?.[`${who}--${d.id}`];if(v!==undefined)stats.push({character:who,stat:d.id,name:d.name,value:v,visibility:d.visibility||'private'});}
 const m=state.modules||{},tempo=m['social.romance-tempo']?.characters?.[npc],profile=(pack.romanceTempoProfiles||[]).find(x=>x.character===npc);
 const rank=profile&&tempo?[...profile.ranks].reverse().find(r=>tempo.points>=r.points)?.name||null:null;
 const firsts=m['social.firsts']?{offers:(m['social.firsts'].offers||[]).filter(o=>state.tick>=o.after).map(o=>{const f=(pack.firsts||[]).find(x=>x.id===o.first);return {first:o.first,title:f?.title||o.first};}),
  active:m['social.firsts'].active?{first:m['social.firsts'].active.first,title:(pack.firsts||[]).find(x=>x.id===m['social.firsts'].active.first)?.title||m['social.firsts'].active.first,checkpoint:m['social.firsts'].active.checkpoint}:null,
  completed:[...(m['social.firsts'].completed||[])]}:null;
 const last=mainTurn(state),acts=last?(last.events||[]).filter(e=>e.type==='social.actPriced').map(e=>({act:e.payload.act?.kind,target:e.payload.act?.target,verdict:e.payload.verdict,points:e.payload.points,reason:e.payload.reason||null})):[];
 const verdictEvent=last?(last.events||[]).find(e=>/delivery/i.test(e.type)):null;
 const questModule=m['story.quests']||m['social.quests']||null;
 return {tick:state.tick,day:clock.day,weekday:clock.weekday,daypart:clock.daypart,location:at,locationName:pack.locations.find(l=>l.id===at)?.name||at,
  scene:state.scene?{id:state.scene.id,characters:state.scene.characters||[]}:null,
  stage:stageState(state,pack,npc),gates:stageGates(state,pack,npc),traits:m['character.arc']?.characters?.[npc]?.traits||null,
  relationships:{trust:m['social.relationships']?.edges?.[`${npc}--${player}`]??null,like:tempo?.points??null,rank,lust:m['social.touch-ladder']?.characters?.[npc]?.lust??null,
   chemistry:m['social.dating']?.characters?.[npc]?.chemistry??null,phase:m['social.dating']?.characters?.[npc]?.phase??null,satisfaction:m['social.dating']?.characters?.[npc]?.satisfaction??null},
  stats,firsts,wants:liveWants(state,pack,npc).map(w=>({id:w.id,text:w.text})),
  quests:questModule?(questModule.characters?.[npc]??questModule):null,
  verdict:verdictEvent?{type:verdictEvent.type,payload:verdictEvent.payload}:null,lastActs:acts,turns:Object.keys(state.turns||{}).length};
}

// Per-turn latency: total ms always; time-to-first-token when the provider streams (the Lab opts in), prompt
// tokens when the provider reports usage. Never mutates the shared provider: it proxies it.
export function latencyWrap(provider){
 const calls=[];
 const streams=provider.bundlesSceneMetadata===true;
 const timed=async(key,fn,args)=>{const t0=Date.now(),row={call:key,ms:0,ttft:null};calls.push(row);
  if(key==='complete'&&streams&&args[3]==null){
   try{return await fn(args[0],args[1],args[2],d=>{row.ttft??=Date.now()-t0;});}
   catch{row.ms=Date.now()-t0;return fn(args[0],args[1],args[2],undefined);}
  }
  try{return await fn(...args);}finally{row.ms=Date.now()-t0;}};
 const wrapped=new Proxy(provider,{get(t,k){const v=t[k];if(typeof v!=='function')return v;
  if(k==='complete')return (m,s,f,onDelta)=>timed('complete',v.bind(t),[m,s,f,onDelta]);
  if(k==='narrate')return (...args)=>timed('narrate',v.bind(t),args);
  return v.bind(t);}});
 return {provider:wrapped,calls};
}

export function parseLabScript(text){
 return String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(line=>{
  if(!line.startsWith('/'))return {kind:'say',line};
  const [cmd,...rest]=line.slice(1).split(/\s+/);
  if(cmd==='skip')return {kind:'skip',unit:['hour','day','week'].includes(rest[0])?rest[0]:null,line};
  if(cmd==='stage')return {kind:'stage',stage:rest[0],line};
  if(cmd==='stat')return {kind:'stat',stat:rest[0],value:Number(rest[1]),line};
  throw Error(`Unknown lab command: ${line}`);});
}

export function createLab({pack,registry,npcId,provider,seed=42,store}={}){
 assert(pack.actors.some(a=>a.id===npcId&&a.id!==pack.playerId),'Lab needs a non-player character');
 const player=pack.playerId;
 const lab={pack:structuredClone(pack),registry,npcId,seed,rows:[],patches:[],snapshotCap:200,player};
 lab.store=store||new Store(':memory:');
 const wrapped=latencyWrap(provider);lab.provider=wrapped.provider;lab.calls=wrapped.calls;
 lab.service=new GameService(lab.store,{[lab.pack.id]:lab.pack},registry,lab.provider);
 lab.usageFrom=Array.isArray(lab.provider.usage)?lab.provider.usage.length:null;
 const build=id=>{const w=createWorld(lab.pack,registry,id,seed);lab.store.insert(w);lab.world=w;lab.campaignId=w.campaignId;return w;};
 lab.rebuild=()=>build(`lab-${seed}-${randomUUID().slice(0,8)}`);
 lab.rebuild();
 lab.snapshot=()=>labSnapshot(lab.world,lab.pack,npcId);
 // Only the chosen NPC is ever staged: every typed turn is a core.scene command with the lab cast.
 lab.turn=async input=>{
  const before=lab.world,callsFrom=lab.calls.length,t0=Date.now(),n=lab.rows.length;
  const open=before.scene?.characters?.includes(npcId);
  const command={type:'core.scene',args:{location:before.actors[player].location,characters:[npcId],activity:open?'continue':'talk',text:input}};
  let result,error;
  try{result=await lab.service.act(lab.campaignId,{id:`t${n}`,expectedRevision:before.revision,input,command});}
  catch(e){if(!e.refusal)throw e;error=e;}
  const world=lab.store.load(lab.campaignId);lab.world=world;
  const fresh=Object.values(world.turns).filter(t=>!before.turns[t.id]);
  const lines=fresh.filter(t=>t.sceneLines?.length).flatMap(t=>t.sceneLines);
  const refusal=error?.refusal||fresh.find(t=>t.refusal)?.refusal||null;
  const turns=lab.calls.slice(callsFrom),ttft=turns.map(c=>c.ttft).filter(x=>x!=null);
  let tokens=null;if(lab.usageFrom!=null&&Array.isArray(lab.provider.usage)){tokens=lab.provider.usage.slice(lab.usageFrom).reduce((s,u)=>s+(u.tokens?.prompt_tokens||0),0);lab.usageFrom=lab.provider.usage.length;if(!tokens)tokens=null;}
  const row={turn:n,input,text:lines.map(l=>l.speaker?`${lab.pack.actors.find(a=>a.id===l.speaker)?.name||l.speaker}: ${l.text}`:l.text).join('\n')||refusal?.reason||'',
   lines,refusal,clarification:result?.clarification||null,command:fresh.at(-1)?.command?.type||null,
   ms:Date.now()-t0,ttft:ttft.length?Math.min(...ttft):null,promptTokens:tokens,
   snapshot:labSnapshot(world,lab.pack,npcId),state:world,events:fresh.flatMap(t=>t.events||[]).filter(e=>e.type!=='core.patch')};
  lab.rows.push(row);if(lab.rows.length>lab.snapshotCap)row.state=null;
  return row;};
 lab.patch=(path,value,label)=>{const w=structuredClone(lab.world);assert(setPath(w,path,value),'Blocked lab patch path');lab.store.commit(w,w.revision);lab.world=w;lab.patches.push({turn:lab.rows.length,label,path});return w;};
 lab.command=(type,args={})=>{const w=lab.world;let r;
  try{r=execute(w,{type,args,id:`c${w.revision}-${type}`,actorId:player,expectedRevision:w.revision},lab.pack,registry);}
  catch(e){return {ok:false,refusal:{reason:String(e.message||e).slice(0,300)}};}
  lab.store.commit(r.state,w.revision);lab.world=r.state;return {ok:!r.turn?.refusal,refusal:r.turn?.refusal||null};};
 lab.skip=async unit=>{assert(['hour','day','week'].includes(unit),'Skip unit is hour, day or week');
  const steps=[];if(lab.world.scene?.characters?.length)steps.push({type:'core.endScene',args:{}});
  if(unit==='hour')steps.push(...Array.from({length:Math.max(1,Math.round(60/(lab.pack.tickMinutes||15)))},()=>({type:'core.wait',args:{}})));
  else if(unit==='day')steps.push({type:'core.wait',args:{until:'Morning'}});
  else steps.push(...Array.from({length:7},()=>({type:'core.wait',args:{until:'Morning'}})));
  for(const c of steps){
   // The director may deal a scripted scene while the clock moves; the lab dismisses it like a player would.
   if(lab.world.modules['story.scenes']?.pending&&c.type!=='story.leave'){const leave=lab.command('story.leave',{});if(!leave.ok)return {ok:false,refusal:leave.refusal};}
   const r=lab.command(c.type,c.args);if(!r.ok)return {ok:false,refusal:r.refusal};}
  return {ok:true,tick:lab.world.tick};};
 lab.jumpToStage=stageId=>{const patches=stagePatch(lab.pack,npcId,stageId);if(!patches)return false;
  for(const p of patches)lab.patch(p.path,p.value,`lab: jumped to stage ${stageId}`);
  return true;};
 lab.setStat=(statId,value)=>{const d=(lab.pack.statDefinitions||[]).find(x=>x.id===statId);if(!d)return false;
  lab.patch(['modules','character.stats','values',`${player}--${statId}`],Math.max(d.min,Math.min(d.max,Math.round(value))),`lab: set player ${statId} to ${value}`);return true;};
 lab.fork=n=>{const row=lab.rows[n];assert(row?.state,'No saved state at that turn');
  const forked=structuredClone(row.state);forked.campaignId=`${lab.campaignId}-fork${n}-${randomUUID().slice(0,8)}`;lab.store.insert(forked);
  lab.world=forked;lab.campaignId=forked.campaignId;lab.rows=lab.rows.slice(0,n+1).map(r=>({...r}));return forked.campaignId;};
 lab.reset=()=>{lab.rebuild();lab.rows=[];lab.patches=[];return lab.world;};
 lab.metrics=()=>labMetrics(lab.rows,lab.pack);
 lab.summary=()=>labSummary(lab);
 // Lab setup: the player joins the NPC wherever she is; a blocked trip is settled with a labelled lab patch.
 const npc=lab.world.actors[npcId],me=lab.world.actors[player];
 if(npc.location!==me.location){const r=lab.command('core.move',{to:npc.location});
  if(!r.ok)lab.patch(['actors',npcId,'location'],me.location,`lab: placed ${lab.pack.actors.find(a=>a.id===npcId)?.name||npcId} with the player`);}
 return lab;
}

export function labMetrics(rows,pack){
 const dialogue=rows.map(r=>dialogueMetrics({lines:r.lines||[],engine:[]},{playerId:pack.playerId})).filter(m=>m.lines);
 const agg=keys=>Object.fromEntries(keys.map(k=>{const vs=dialogue.map(m=>m[k]).filter(v=>v!=null);return [k,vs.length?+(vs.reduce((s,v)=>s+v,0)/vs.length).toFixed(2):null];}));
 const ms=rows.map(r=>r.ms).filter(x=>x!=null),ttft=rows.map(r=>r.ttft).filter(x=>x!=null),tokens=rows.map(r=>r.promptTokens).filter(x=>x!=null);
 const sum=xs=>xs.reduce((s,x)=>s+x,0),avg=xs=>xs.length?+(sum(xs)/xs.length).toFixed(0):null;
 const stagePath=[];for(const r of rows){const s=r.snapshot?.stage?.id;if(stagePath.at(-1)?.to!==s)stagePath.push({turn:r.turn+1,from:stagePath.length?stagePath.at(-1).to:null,to:s});}
 return {turns:rows.length,refusals:rows.filter(r=>r.refusal).length,
  dialogue:agg(['questionRate','walls','narrationWalls','medianWords','dialogueRatio','recycledGrams','echoViolations']),
  speakerShare:dialogue.length?+(dialogue.map(m=>m.dialogueRatio??0).reduce((s,v)=>s+v,0)/dialogue.length).toFixed(2):null,
  stage:rows.at(-1)?.snapshot?.stage||null,stagePath,
  verdicts:rows.flatMap(r=>(r.snapshot?.lastActs||[]).map(a=>({turn:r.turn+1,...a}))),
  latency:{msAvg:avg(ms),msMax:ms.length?Math.max(...ms):null,ttftAvg:avg(ttft),promptTokensAvg:avg(tokens),promptTokensTotal:tokens.length?sum(tokens):null}};
}
function labSummary(lab){
 const first=lab.rows[0]?.snapshot,last=lab.rows.at(-1)?.snapshot,stats=[];
 if(first&&last)for(const s of last.stats){const b=first.stats.find(x=>x.character===s.character&&x.stat===s.stat);
  if(b&&b.value!==s.value)stats.push({character:s.character,stat:s.stat,from:b.value,to:s.value});}
 return {packId:lab.pack.id,packTitle:lab.pack.title,npc:lab.npcId,npcName:lab.pack.actors.find(a=>a.id===lab.npcId)?.name,
  turns:lab.rows.length,stage:last?.stage||null,stagePath:lab.metrics().stagePath,statChanges:stats,
  firsts:{completed:last?.firsts?.completed||[],active:last?.firsts?.active||null},
  moves:lab.rows.filter(r=>r.snapshot?.lastActs?.length).map(r=>({turn:r.turn+1,input:r.input,acts:r.snapshot.lastActs})),
  labPatches:lab.patches.map(p=>({turn:p.turn,label:p.label}))};
}
export function transcriptMarkdown(lab){
 const s=labSummary(lab),out=[`# Character Chat Lab — ${s.packTitle} · ${s.npcName}`,'',
  `Turns ${s.turns} · stage ${s.stage?.name||s.stage?.id||'—'} (${s.stage?.source||'—'}) · lab patches ${s.labPatches.length}`,'','## Summary','',
  ...s.stagePath.map(p=>`- turn ${p.turn}: stage → ${p.to}`),
  ...s.statChanges.map(c=>`- ${c.character} ${c.stat}: ${c.from} → ${c.to}`),
  ...(s.firsts.completed.length?[`- firsts completed: ${s.firsts.completed.join(', ')}`]:[]),
  ...s.labPatches.map(p=>`- turn ${p.turn}: ${p.label}`),'','## Transcript',''];
 for(const r of lab.rows){out.push(`### Turn ${r.turn+1} — player: ${r.input}`,'',r.text||'(no reply)');
  for(const a of r.snapshot?.lastActs||[])out.push('',`> act ${a.act}${a.target?` → ${a.target}`:''}: ${a.verdict}${a.points?` (${a.points>0?'+':''}${a.points})`:''}${a.reason?` — ${a.reason}`:''}`);
  if(r.refusal)out.push('',`> refused: ${r.refusal.reason}`);out.push('');}
 return out.join('\n');
}
