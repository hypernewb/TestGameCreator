import {matchedLoreKeys, keyPattern, absentNote} from '../../vendor/venus/lorebook.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {selectGeneratedFacts} from '../modules/facts.mjs';
import {loreIndex,bm25Score} from './retrieval.mjs';
import {statValue} from '../modules/stats.mjs';
import {datingContext} from '../modules/dating.mjs';
import {playerStatements,stripPlaceholders,mentionsPlayer} from './memory.mjs';
import {romanceNetworkContext} from '../modules/romance-network.mjs';
function visibleTo(v,actor){return v==='public'||Array.isArray(v)&&v.includes(actor);}
export function selectLore(s,p,actorId,query='',budget=1200){
 const location=s.actors[actorId].location,results=[],index=query?loreIndex(p):null;
 for(const entry of p.lorebook||[]){if(!visibleTo(entry.knownBy,actorId))continue;
  const matched=matchedLoreKeys(entry.tags||[],query);
  const scopeMatch=entry.scope==='world'||entry.scope==='location'&&entry.location===location||entry.scope==='character'&&entry.character===actorId;
  // BM25 relevance can surface an entry whose tags the player never typed; a tag hit still outranks it.
  const text=index?bm25Score(index,entry.id,query):{score:0,matched:[]},textMatch=text.score>=1;
  if(!scopeMatch&&!matched.length&&!textMatch)continue;
  const score=matched.length*10+Math.min(9,Math.round(text.score*2))+(entry.location===location?5:0)+(entry.character===actorId?5:0);
  results.push({...entry,score,reason:matched.length?`tag: ${matched.join(', ')}`:textMatch?`text: ${text.matched.slice(0,3).join(', ')}`:entry.scope==='location'?'current location':entry.scope==='character'?'character':'world'});
 }
 results.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));let used=0;
 const selected=[],omitted=[];for(const e of results){const length=e.text.length;if(used+length<=budget){selected.push({id:e.id,text:e.text,reason:e.reason,score:e.score});used+=length;}else omitted.push({id:e.id,reason:'budget'});}
 return {selected,omitted,budget,used};
}
// opts.wide gathers every candidate so a caller-side allocator (context-budget.mjs) can decide what fits.
export function contextFor(s,p,actorId=p.playerId,turn=null,query='',opts={}){
 const location=s.actors[actorId].location,canSee=v=>visibleTo(v,actorId),own=p.actors.find(a=>a.id===actorId);
 // Everything the player told this character: promises and self-disclosures are kept long-term, questions dropped.
 const selected=playerStatements(s,p,actorId,opts.wide?{keep:40,statements:4}:{keep:8,statements:8});
 // Impressions that never mention the player ("Brin likes sharing details about his habits") are the model talking about
 // the character itself; they cost tokens and teach the next reply nothing about the relationship.
 const playerName=p.actors.find(a=>a.id===p.playerId)?.name,aboutPlayer=d=>mentionsPlayer(d,playerName);
 // Walk newest-first and stop early: this runs every turn and must not scan the whole campaign.
 const ledger=[],turnList=Object.values(s.turns);for(let i=turnList.length-1;i>=0&&ledger.length<8;i--){const t=turnList[i];if(t.status!=='complete')continue;const own=(t.ledger||[]).filter(m=>(m.charKey===actorId||actorId===p.playerId)&&aboutPlayer(m.desc)).map(m=>{const name=p.actors.find(a=>a.id===m.charKey)?.name||m.charKey;return {source:`ledger:${t.id}`,text:`${name} ${m.type}: ${stripPlaceholders(m.desc,'the player',name)}`,knownBy:[p.playerId,m.charKey],tick:t.events[0]?.tick||0};});ledger.unshift(...own);}ledger.splice(0,Math.max(0,ledger.length-8));
 const lore=selectLore(s,p,actorId,query,opts.wide?Infinity:1200);
 const generatedFactTrace=selectGeneratedFacts(s,p,actorId,query,opts.wide?Infinity:650);
 const items=(p.items||[]).filter(i=>s.modules['items.inventory']?.owners[i.id]===location&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))).map(i=>({id:i.id,name:i.name}));
 const carried=(p.items||[]).filter(i=>s.modules['items.inventory']?.owners[i.id]===p.playerId).map(i=>({id:i.id,name:i.name,...(query.toLowerCase().includes(i.name.toLowerCase())?{description:i.description||''}:{})}));
 const equipped=p.equipmentSlots&&s.modules['items.equipment']?Object.entries(s.modules['items.equipment'].slots).filter(([,id])=>id).map(([slot,id])=>{const item=p.items.find(i=>i.id===id);return {slot,id,name:item?.name||id,description:item?.description||''};}):[];
 const nearbyBonds=p.relationshipDimensions&&s.modules['social.bonds']?p.actors.filter(a=>a.id!==p.playerId&&s.actors[a.id].location===location||a.id===actorId&&a.id!==p.playerId).map(a=>({character:a.id,values:Object.fromEntries(p.relationshipDimensions.map(d=>[d.id,s.modules['social.bonds'].values[`${a.id}--${d.id}--${p.playerId}`]||0]))})):[];
 const characterStats=s.modules['character.stats']?p.actors.filter(a=>a.id===actorId||a.id===p.playerId||s.actors[a.id].location===location).map(a=>({character:a.id,values:Object.fromEntries((p.statDefinitions||[]).filter(d=>d.visibility==='public'||a.id===actorId||actorId===p.playerId&&d.visibility==='player').map(d=>[d.id,statValue(s,a.id,d.id)]))})).filter(a=>Object.keys(a.values).length):[];
 const relationshipProgression=s.modules['social.progression']?Object.entries(s.modules['social.progression'].states).filter(([character])=>actorId===p.playerId||character===actorId).map(([character,state])=>({character,state})):[];
 const dating=s.modules['social.dating']?datingContext(s,p,actorId):[];
 const romanceNetwork=s.modules['social.romance-network']?romanceNetworkContext(s,p,actorId):null;
 const objects=(p.objects||[]).filter(o=>o.location===location).map(({id,name,description,tags})=>({id,name,description,tags}));
 const recentActions=s.events.filter(e=>e.type!=='core.patch'&&canSee(e.visibility)&&e.payload.text).slice(-10).map(e=>({source:e.id,tick:e.tick,type:e.type,text:e.payload.text}));
 const clock=calendarFor(s.tick,p),{day,weekday,week}=clock,part=clock.daypart;
 const activeEvents=p.modules['world.events']?(p.worldEvents||[]).filter(e=>day>=e.startDay&&day<=e.endDay).map(({id,name,description,location:where})=>({id,name,description,location:where||null})):[];
 const sceneId=s.modules['story.scenes']?.pending,scriptedScene=(p.scriptedScenes||[]).find(x=>x.id===sceneId),sceneBeat=scriptedScene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||scriptedScene;
 const backgroundCharacters=p.actors.filter(a=>a.id!==actorId&&s.actors[a.id].location!==location&&new RegExp(keyPattern(a.name,false),'iu').test(query)).map(a=>({id:a.id,name:a.name,pronouns:a.pronouns,description:a.description||'',traits:a.traits||[],voice:a.voice||'',rule:absentNote(a.name)}));
 const npcRelationships=Object.entries(s.modules['social.npc']?.pairs||{}).filter(([key])=>key.split('|').every(id=>s.actors[id]?.location===location)).map(([key,value])=>({characters:key.split('|'),...value}));
 return {money:s.modules['world.economy']?.balance??null,npcRelationships,promptVersion:'0.8',gameProject:p.gameProject||null,scriptedScene:scriptedScene?{id:sceneId,beat:s.modules['story.scenes']?.pendingBeat||'opening',title:scriptedScene.title,opening:sceneBeat.opening,stage:sceneBeat.stage||[],choices:sceneBeat.choices.map(c=>({id:c.id,label:c.label}))}:null,sceneWaiting:s.modules['story.scenes']?.waiting||null,sceneHistory:s.modules['story.scenes']?.history.slice(-5)||[],plans:(s.modules['story.scenes']?.plans||[]).filter(x=>x.status==='pending').sort((a,b)=>a.deadlineTick-b.deadlineTick),characterStats,relationshipProgression,actor:{id:actorId,name:own.name,pronouns:own.pronouns,style:own.style||'Natural and concise',goal:own.goal||'',traits:own.traits||[],backstory:own.backstory||'',likes:own.likes||[],dislikes:own.dislikes||[],voice:own.voice||'',year:own.year||null,major:own.major||null,dorm:own.dorm||null,appearance:own.appearance||'',relationshipToPlayer:s.modules['social.relationships']?.edges[`${actorId}--${p.playerId}`]??null},location:p.locations.find(l=>l.id===location),present:p.actors.filter(a=>s.actors[a.id].location===location).map(a=>({id:a.id,name:a.name,pronouns:a.pronouns,description:a.description||'',traits:a.traits||[],voice:a.voice||''})),backgroundCharacters,objects,items,carried,equipped,nearbyBonds,tick:s.tick,calendar:p.calendar,date:clock.date,day,week,weekday,daypart:part,activeEvents,
  dating,romanceNetwork,facts:(p.facts||[]).filter(f=>canSee(f.knownBy)&&!(p.facts||[]).some(n=>n.supersedes===f.id&&canSee(n.knownBy))).map(f=>({id:f.id,text:f.text})),generatedFacts:generatedFactTrace.selected.map(({id,subject,text,source,reason})=>({id,subject,text,source,reason})),generatedFactTrace,lorebook:lore.selected,loreTrace:lore,
  memories:[...selected.map(m=>({source:m.source,text:m.text,promise:m.promise,kind:m.kind})),...ledger.map(m=>({source:m.source,text:m.text})),...(s.modules['story.scenes']?.memories||[]).filter(m=>canSee(m.knownBy)).slice(-8).map(m=>({source:`scene:${m.scene}`,text:m.text,character:m.character}))],dialogue:Object.values(s.turns).filter(t=>t.status==='complete'&&t.events.some(e=>e.type==='social.spoke'&&canSee(e.visibility))).slice(-6).map(t=>({source:t.id,text:t.narrative})),recentActions,outcomes:(turn?.events||[]).filter(e=>canSee(e.visibility)).map(e=>({type:e.type,...e.payload}))};
}
