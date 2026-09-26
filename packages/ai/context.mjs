import {matchedLoreKeys, keyPattern, absentNote} from '../../vendor/venus/lorebook.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {selectGeneratedFacts} from '../modules/facts.mjs';
function visibleTo(v,actor){return v==='public'||Array.isArray(v)&&v.includes(actor);}
export function selectLore(s,p,actorId,query='',budget=1200){
 const location=s.actors[actorId].location,results=[];
 for(const entry of p.lorebook||[]){if(!visibleTo(entry.knownBy,actorId))continue;
  const matched=matchedLoreKeys(entry.tags||[],query);
  const scopeMatch=entry.scope==='world'||entry.scope==='location'&&entry.location===location||entry.scope==='character'&&entry.character===actorId;
  if(!scopeMatch&&!matched.length)continue;
  const score=matched.length*10+(entry.location===location?5:0)+(entry.character===actorId?5:0);
  results.push({...entry,score,reason:matched.length?`tag: ${matched.join(', ')}`:entry.scope==='location'?'current location':entry.scope==='character'?'character':'world'});
 }
 results.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));let used=0;
 const selected=[],omitted=[];for(const e of results){const length=e.text.length;if(used+length<=budget){selected.push({id:e.id,text:e.text,reason:e.reason});used+=length;}else omitted.push({id:e.id,reason:'budget'});}
 return {selected,omitted,budget,used};
}
export function contextFor(s,p,actorId=p.playerId,turn=null,query=''){
 const location=s.actors[actorId].location,canSee=v=>visibleTo(v,actorId),own=p.actors.find(a=>a.id===actorId);
 const memories=(s.modules['social.conversation']?.memories||[]).filter(m=>canSee(m.knownBy));
 const promises=memories.filter(m=>m.promise).slice(-6),recent=memories.slice(-8);
 const selected=[...new Map([...promises,...recent].map(m=>[m.id,m])).values()];
 const ledger=Object.values(s.turns).filter(t=>t.status==='complete').flatMap(t=>(t.ledger||[]).filter(m=>m.charKey===actorId||actorId===p.playerId).map(m=>({source:`ledger:${t.id}`,text:`${p.actors.find(a=>a.id===m.charKey)?.name||m.charKey} ${m.type}: ${m.desc}`,knownBy:[p.playerId,m.charKey],tick:t.events[0]?.tick||0}))).slice(-8);
 const lore=selectLore(s,p,actorId,query,1200);
 const generatedFactTrace=selectGeneratedFacts(s,p,actorId,query);
 const items=(p.items||[]).filter(i=>s.modules['items.inventory']?.owners[i.id]===location&&(!i.hidden||s.modules['world.objects']?.discovered.includes(i.id))).map(i=>({id:i.id,name:i.name}));
 const carried=(p.items||[]).filter(i=>s.modules['items.inventory']?.owners[i.id]===p.playerId).map(i=>({id:i.id,name:i.name,...(query.toLowerCase().includes(i.name.toLowerCase())?{description:i.description||''}:{})}));
 const equipped=p.equipmentSlots&&s.modules['items.equipment']?Object.entries(s.modules['items.equipment'].slots).filter(([,id])=>id).map(([slot,id])=>{const item=p.items.find(i=>i.id===id);return {slot,id,name:item?.name||id,description:item?.description||''};}):[];
 const nearbyBonds=p.relationshipDimensions&&s.modules['social.bonds']?p.actors.filter(a=>a.id!==p.playerId&&s.actors[a.id].location===location||a.id===actorId&&a.id!==p.playerId).map(a=>({character:a.id,values:Object.fromEntries(p.relationshipDimensions.map(d=>[d.id,s.modules['social.bonds'].values[`${a.id}--${d.id}--${p.playerId}`]||0]))})):[];
 const objects=(p.objects||[]).filter(o=>o.location===location).map(({id,name,description,tags})=>({id,name,description,tags}));
 const recentActions=s.events.filter(e=>e.type!=='core.patch'&&canSee(e.visibility)&&e.payload.text).slice(-10).map(e=>({source:e.id,tick:e.tick,type:e.type,text:e.payload.text}));
 const clock=calendarFor(s.tick,p),{day,weekday,week}=clock,part=clock.daypart;
 const activeEvents=p.modules['world.events']?(p.worldEvents||[]).filter(e=>day>=e.startDay&&day<=e.endDay).map(({id,name,description,location:where})=>({id,name,description,location:where||null})):[];
 const sceneId=s.modules['story.scenes']?.pending,scriptedScene=(p.scriptedScenes||[]).find(x=>x.id===sceneId),sceneBeat=scriptedScene?.beats?.find(b=>b.id===s.modules['story.scenes']?.pendingBeat)||scriptedScene;
 const backgroundCharacters=p.actors.filter(a=>a.id!==actorId&&s.actors[a.id].location!==location&&new RegExp(keyPattern(a.name,false),'iu').test(query)).map(a=>({id:a.id,name:a.name,description:a.description||'',traits:a.traits||[],voice:a.voice||'',rule:absentNote(a.name)}));
 const npcRelationships=Object.entries(s.modules['social.npc']?.pairs||{}).filter(([key])=>key.split('|').every(id=>s.actors[id]?.location===location)).map(([key,value])=>({characters:key.split('|'),...value}));
 return {money:s.modules['world.economy']?.balance??null,npcRelationships,promptVersion:'0.7',gameProject:p.gameProject||null,scriptedScene:scriptedScene?{id:sceneId,beat:s.modules['story.scenes']?.pendingBeat||'opening',title:scriptedScene.title,opening:sceneBeat.opening,stage:sceneBeat.stage||[],choices:sceneBeat.choices.map(c=>({id:c.id,label:c.label}))}:null,sceneWaiting:s.modules['story.scenes']?.waiting||null,sceneHistory:s.modules['story.scenes']?.history.slice(-5)||[],actor:{id:actorId,name:own.name,style:own.style||'Natural and concise',goal:own.goal||'',traits:own.traits||[],backstory:own.backstory||'',likes:own.likes||[],dislikes:own.dislikes||[],voice:own.voice||'',year:own.year||null,major:own.major||null,dorm:own.dorm||null,appearance:own.appearance||'',relationshipToPlayer:s.modules['social.relationships']?.edges[`${actorId}--${p.playerId}`]??null},location:p.locations.find(l=>l.id===location),present:p.actors.filter(a=>s.actors[a.id].location===location).map(a=>({id:a.id,name:a.name,description:a.description||'',traits:a.traits||[],voice:a.voice||''})),backgroundCharacters,objects,items,carried,equipped,nearbyBonds,tick:s.tick,calendar:p.calendar,date:clock.date,day,week,weekday,daypart:part,activeEvents,
  facts:(p.facts||[]).filter(f=>canSee(f.knownBy)&&!(p.facts||[]).some(n=>n.supersedes===f.id&&canSee(n.knownBy))).map(f=>({id:f.id,text:f.text})),generatedFacts:generatedFactTrace.selected.map(({id,subject,text,source,reason})=>({id,subject,text,source,reason})),generatedFactTrace,lorebook:lore.selected,loreTrace:lore,
  memories:[...selected.map(m=>({source:m.source,text:m.text,promise:m.promise})),...ledger.map(m=>({source:m.source,text:m.text})),...(s.modules['story.scenes']?.memories||[]).filter(m=>canSee(m.knownBy)).slice(-8).map(m=>({source:`scene:${m.scene}`,text:m.text,character:m.character}))],dialogue:Object.values(s.turns).filter(t=>t.status==='complete'&&t.events.some(e=>e.type==='social.spoke'&&canSee(e.visibility))).slice(-6).map(t=>({source:t.id,text:t.narrative})),recentActions,outcomes:(turn?.events||[]).filter(e=>canSee(e.visibility)).map(e=>({type:e.type,...e.payload}))};
}
