import {calendarFor} from '../../public/calendar.mjs';
import {scheduleDestination} from './engine.mjs';
import {memoryEditIndex,effectiveImpressions,effectiveSceneMemories} from '../ai/memory.mjs';

// Venus-style character overview: a pure read of committed state, never a source of truth.
export const STAT_EVENTS=['social.relationshipChanged','social.bondChanged','social.chemistryChanged','social.satisfactionChanged'];
const who=e=>e.payload.actor??e.payload.character;
export function relationshipReaction(event,name='They'){const delta=event.payload.delta??(event.payload.value??event.payload.to??0)-(event.payload.old??event.payload.from??0),strong=Math.abs(delta)>=5;if(event.type==='social.satisfactionChanged')return delta>0?`${name} feels ${strong?'much ':''}better about the relationship. ♥`:delta<0?`${name} seems ${strong?'deeply ':''}hurt by what happened.`:`${name}'s feelings are unchanged.`;if(event.type==='social.chemistryChanged')return delta>0?`The spark with ${name} grows${strong?' noticeably':''}. ♥`:delta<0?`The spark with ${name} cools.`:`The mood with ${name} holds steady.`;if(event.type==='social.bondChanged')return delta>0?`${name} feels ${strong?'much ':''}closer to you. ♥`:delta<0?`${name} pulls back from you.`:`Your bond with ${name} holds steady.`;return delta>0?`${name} warms ${strong?'considerably ':''}toward you. ♥`:delta<0?`${name} becomes ${strong?'much ':''}more guarded.`:`${name}'s trust holds steady.`;}
export const statChanges=turn=>(turn?.events||[]).filter(e=>STAT_EVENTS.includes(e.type)).map(e=>({character:who(e),text:relationshipReaction(e,e.payload.name||e.payload.actorName||e.payload.text?.split(':')[0]||'They'),rawText:e.payload.text,delta:e.payload.delta??0}));
const band=t=>t<0?'Wary':t<20?'Acquaintance':t<40?'Friendly':t<70?'Close':'Devoted';
const cap=x=>x[0].toUpperCase()+x.slice(1);

export function characterProgress(s,p,{test=false}={}){
 const me=p.playerId,here=s.actors[me].location,place=id=>({id,name:p.locations.find(l=>l.id===id)?.name||id}),raw=test||Boolean(p.showRawCharacterStats);
 const showLocations=raw||p.gameProject?.characterLocationVisibility==='always',showSchedules=raw||p.gameProject?.characterScheduleVisibility==='always';
 const trust=s.modules['social.relationships']?.edges||{},bonds=s.modules['social.bonds']?.values,dating=s.modules['social.dating']?.characters||{},intimacy=s.modules['social.intimacy']?.characters||{};
 const talk=s.modules['social.conversation']?.memories||[],story=s.modules['story.scenes'],interval=p.daypart?.interval||4;
 return p.actors.filter(a=>a.id!==me).map(a=>{const id=a.id,at=s.actors[id].location,t=trust[`${id}--${me}`]??0,profile=(p.datingProfiles||[]).find(x=>x.character===id),d=dating[id],tempo=(p.romanceTempoProfiles||[]).find(x=>x.character===id),tempoState=s.modules['social.romance-tempo']?.characters?.[id];
  let next=null;const schedule=showSchedules&&p.modules['world.schedule']&&(p.schedules||[]).find(x=>x.actor===id);
  if(schedule)for(let tick=s.tick+1,loc=at;tick<=s.tick+interval*3;tick++){const to=scheduleDestination(p,schedule,tick);if(to&&to!==loc){const c=calendarFor(tick,p);next={location:place(to),tick,when:`${c.weekday} ${c.daypart}`};break;}}
  const availability=s.scene?.characters?.includes(id)?'With you now':at===here?'Here':showLocations?`At ${place(at).name}`:'Away';
  const stats=raw?{Trust:t,...Object.fromEntries((p.relationshipDimensions||[]).filter(()=>bonds).map(x=>[x.name,bonds[`${id}--${x.id}--${me}`]??0])),...(d?{Chemistry:d.chemistry,Satisfaction:d.satisfaction}:{})}:null;
  const recent=s.events.filter(e=>STAT_EVENTS.includes(e.type)&&who(e)===id).slice(-5).map(e=>relationshipReaction(e,a.name)).reverse();
  const memories=[...talk.filter(m=>m.knownBy?.includes(id)&&m.knownBy.includes(me)&&!m.promise).map(m=>({tick:m.tick,text:m.text})),...effectiveSceneMemories(s).filter(m=>m.character===id).map(m=>({tick:m.tick,text:m.text}))].sort((x,y)=>x.tick-y.tick).slice(-5).map(m=>m.text);
  const promises=[...talk.filter(m=>m.promise&&m.knownBy?.includes(id)).map(m=>({text:m.text,status:'made'})),...(story?.plans||[]).filter(x=>x.character===id).map(x=>({text:x.plan,status:x.status}))].slice(-5);
  const known=new Set(d?.knownPreferences||[]),ik=new Set(intimacy[id]?.knownInterests||[]),ip=(p.intimacyProfiles||[]).find(x=>x.character===id);
  const impressionEdits=memoryEditIndex(s,'impression'),ledger=Object.values(s.turns).flatMap(x=>effectiveImpressions(x,impressionEdits)).filter(x=>x.charKey===id&&x.type!=='neutral'&&x.desc).map(x=>`${x.type==='liked'?'Likes':'Dislikes'} ${x.desc}`);
  const preferences=[...new Set([...(profile?.preferences||[]).filter(x=>x.visibility==='public'||known.has(x.id)).map(x=>x.label||x.id),...[...(ip?.interests||[]),...(ip?.stylePreferences||[]),...(ip?.aftercarePreferences||[])].filter(x=>ik.has(x.id)).map(x=>x.label||x.id),...ledger])].slice(-8);
  const rank=tempo?.ranks?.[tempoState?.rank||0],nextRank=tempo?.ranks?.[(tempoState?.rank||0)+1],trustScene=(p.scriptedScenes||[]).filter(scene=>scene.when?.trust?.[id]>t).toSorted((x,y)=>x.when.trust[id]-y.when.trust[id])[0],hearts=tempo?Math.min(tempo.ranks.length,Math.max(1,(tempoState?.rank||0)+1)):d?({available:0,crush:1,dating:2,exclusive:3,rejected:0,broken:0}[d.phase]??0):Math.min(5,Math.floor(t/20)),heartMax=tempo?.ranks?.length||(d?3:5),teaser=nextRank?`Next: ${nextRank.name}${nextRank.scene?` — ${p.scriptedScenes?.find(x=>x.id===nextRank.scene)?.title||'a new scene'}`:''}`:trustScene?`Next: ${trustScene.title} — keep spending time together`:tempo?'Route complete':'Keep interacting to see where this relationship goes.';
  return {id,name:a.name,portrait:a.portrait||null,description:a.description||'',pronouns:a.pronouns||'',location:at===here||showLocations?place(at):null,availability,next,stage:rank?.name||(d?cap(d.phase||'available'):band(t)),progress:{hearts,max:heartMax,teaser},stats,recent,memories,promises,preferences};});
}

// "What could I pursue now?" — a player-facing lead sheet: offered storylets, then everyone worth approaching
// with the concrete hook attached (unread invitation, live event, where they are when visibility allows).
export function leadLines(s,p,available=[]){
 const me=p.playerId,here=s.actors[me].location,phone=s.modules['social.phone'],timed=s.modules['story.timed-events'];
 const showLocations=p.gameProject?.characterLocationVisibility==='always',showSchedules=p.gameProject?.characterScheduleVisibility==='always';
 const interval=p.daypart?.interval||4,lines=[];
 for(const card of available.filter(a=>a.type==='story.startOfferedScene'&&a.storylet))lines.push(`${card.storylet.title} — ${card.storylet.who.join(', ')||'anyone'} · ${card.storylet.where}${card.enabled?'':' (not yet' + (card.disabledReason?`: ${card.disabledReason})`:')')}`);
 for(const a of p.actors.filter(a=>a.id!==me)){
  const bits=[];
  if(s.scene?.characters?.includes(a.id))bits.push('with you now');
  else if(s.actors[a.id].location===here)bits.push('here');
  else if(showLocations)bits.push(`at ${p.locations.find(l=>l.id===s.actors[a.id].location)?.name||s.actors[a.id].location}`);
  else bits.push('away');
  if(showSchedules){const schedule=p.modules['world.schedule']&&(p.schedules||[]).find(x=>x.actor===a.id);
   if(schedule)for(let tick=s.tick+1,loc=s.actors[a.id].location;tick<=s.tick+interval*3;tick++){const to=scheduleDestination(p,schedule,tick);if(to&&to!==loc){const c=calendarFor(tick,p);bits.push(`${p.locations.find(l=>l.id===to)?.name||to} ${c.daypart.toLowerCase()}`);break;}}}
  if(phone){const thread=phone.threads[a.id]||[],unread=thread.filter(x=>!x.read).length,offer=thread.find(x=>x.offer?.status==='pending'&&x.offer.expiresTick>=s.tick);
   if(offer)bits.push('asked to meet you');else if(unread)bits.push(`${unread} unread message${unread>1?'s':''}`);}
  if(timed&&(p.timedEvents||[]).some(e=>e.character===a.id&&s.tick>=e.startTick&&s.tick<=e.endTick&&!['attended','missed'].includes(timed.status[e.id]||'')))bits.push('event happening now');
  lines.push(`${a.name} — ${bits.join(' · ')}`);
 }
 return lines;
}
