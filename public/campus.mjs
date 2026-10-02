// Campus-sim screens (day card, hub, end card, journal) as pure view models over (state, pack). The browser cannot
// import packages/, so the few reads below mirror acts.knownActs / arc.stageOf / acts.sceneVerdicts (tests pin them).
import {calendarFor,WEEKDAYS,PERIODS} from './calendar.mjs';
import {firstEndCard} from './firsts-ui.mjs';
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const nameOf=(pack,id)=>pack.actors.find(a=>a.id===id)?.name||id;
// Campus is the showcase world: it leads the start screens, everything else keeps the server's order.
export const SHOWCASE='campus.ashford',featuredFirst=packs=>[...packs.filter(p=>p.id===SHOWCASE),...packs.filter(p=>p.id!==SHOWCASE)];
export const isCampus=pack=>Boolean(pack?.actProfiles?.length&&pack.activities?.length&&pack.run);
export const loveInterests=pack=>(pack.actProfiles||[]).map(x=>x.character);
const dateLabel=d=>d?`${MONTHS[+d.slice(5,7)-1]} ${+d.slice(8,10)}`:'';
const hash=s=>[...s].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7);
const holidayOf=(pack,cal)=>(pack.calendar?.holidays||[]).find(h=>h.weekday?h.weekday===cal.weekday:h.date&&cal.date&&(h.annual?cal.date.slice(5)===h.date:cal.date===h.date))||null;
// Mirrors world.calendar closedReason.
const closedWhy=(state,pack,loc,cal)=>(pack.calendar?.closures||[]).find(c=>c.location===loc&&(c.weekdays?.includes(cal.weekday)||c.holiday&&holidayOf(pack,cal)||c.dates?.includes(cal.date)||c.weather&&c.weather===state.modules['world.calendar']?.weather))?.reason||null;
const stopAt=(pack,actor,tick)=>{const s=(pack.schedules||[]).find(x=>x.actor===actor);if(!s)return null;const t=tick%(s.period||12);return [...s.stops].filter(x=>x.at<=t).at(-1)?.location||null;};

// Morning card: date, days left, weather, one line from yesterday, one rumor about tonight.
export function dayCard(state,pack){
 const cal=calendarFor(state.tick,pack),days=pack.run?.days||0,kinds=pack.calendar?.weather||[],w=kinds.find(k=>k.id===state.modules['world.calendar']?.weather)||kinds[0]||null;
 const holiday=holidayOf(pack,cal);
 const interval=pack.daypart?.interval||4,per=interval*PERIODS.length,dayStart=(cal.day-1)*per,prev=(state.events||[]).filter(e=>e.tick>=dayStart-per&&e.tick<dayStart);
 const felt=prev.filter(e=>e.type==='social.actPriced'&&['liked','disliked'].includes(e.payload.verdict)).at(-1),met=prev.filter(e=>e.type==='core.sceneEnded'&&e.payload.characters?.length).at(-1);
 const yesterday=cal.day<2?null:felt?`Yesterday, ${felt.payload.text}`:met?`Yesterday you spent time with ${met.payload.characters.map(c=>nameOf(pack,c)).join(' and ')}.`:'Yesterday was a quiet one.';
 const evening=dayStart+interval*(PERIODS.length-1),li=loveInterests(pack),start=hash(`${state.campaignId}:${cal.day}`),spots=li.map((_,i)=>li[(start+i)%li.length]).map(who=>({who,loc:pack.locations.find(l=>l.id===stopAt(pack,who,evening))})),pick=spots.find(x=>x.loc&&!closedWhy(state,pack,x.loc.id,cal));
 const rumor=pick?`Word is ${nameOf(pack,pick.who)} will be at ${pick.loc.name} tonight.`:null;
 return {day:cal.day,weekday:cal.weekday,date:dateLabel(cal.date),daysLeft:Math.max(0,days-cal.day),weather:w&&{name:w.name,text:w.text||''},holiday:holiday&&{name:holiday.name,text:holiday.text||''},yesterday,rumor};
}
// True on the first turn of a new day (or a fresh campaign): the UI shows the day card once.
export const newDay=(state,pack,prevTick)=>prevTick===undefined?state.tick===0:calendarFor(prevTick,pack).day!==calendarFor(state.tick,pack).day;
export const recapCard=(state,pack)=>pack.dayRecap?.mode==='prompt'?null:(state.modules['story.recap']?.days||[]).at(-1)||null;

// Hub: every place with what you can do there right now and who is around. Engine rules still decide; this only previews.
export function hub(state,pack){
 const cal=calendarFor(state.tick,pack),here=state.actors[pack.playerId].location,daily=state.activityDayUses||{};
 return pack.locations.map(loc=>{const closed=closedWhy(state,pack,loc.id,cal),people=Object.keys(state.actors).filter(id=>id!==pack.playerId&&state.actors[id].location===loc.id).map(id=>({id,name:nameOf(pack,id),interest:loveInterests(pack).includes(id)}));
  const activities=(pack.activities||[]).filter(a=>a.location===loc.id&&(!a.requiresFlag||state.flags?.[a.requiresFlag])&&!(a.once&&state.activityUses?.[a.id])).map(a=>{const used=a.perDay&&(daily[a.id]?.day===cal.day?daily[a.id].count:0)>=a.perDay,away=a.character&&state.actors[a.character]?.location!==loc.id,ranks=a.minRank&&(pack.romanceTempoProfiles||[]).find(p=>p.character===a.character)?.ranks||[],need=ranks.findIndex(r=>r.id===a.minRank),lock=need>(state.modules?.['social.romance-tempo']?.characters?.[a.character]?.rank||0)?ranks[need]:null;return {id:a.id,name:a.name,description:a.description||'',yields:yields(pack,a),character:a.character||null,available:!closed&&!used&&!away&&!lock,why:closed||(lock?`Unlocks at ${lock.name||lock.id} with ${nameOf(pack,a.character)}`:used?'Done for today':away?`${nameOf(pack,a.character)} isn't here`:'')};});
  return {id:loc.id,name:loc.name,background:loc.background||null,here:loc.id===here,closed,people,activities};});
}
// M0.7 goal line: per love interest, her next first on the ladder (talk, date, kiss, night) and what gates it, in words, never numbers.
// Mirrors the engine gates: first tempo rank, dating thresholds.date / .exclusive, intimacy requirement phases (tests pin them).
export function goals(state,pack){
 return loveInterests(pack).map(c=>{const name=nameOf(pack,c),d=state.modules['social.dating']?.characters?.[c]||{},t=state.modules['social.romance-tempo']?.characters?.[c]||{},prof=(pack.datingProfiles||[]).find(x=>x.character===c)||{},th=prof.thresholds||{},phases=(pack.intimacyProfiles||[]).find(x=>x.character===c)?.requirements?.phases||['dating','exclusive'];
  const line=(next,why)=>({character:c,name,next,why,text:`${name}: ${why?`next is ${next}. ${why}`:next}`});
  if(!(t.rank>0))return line('a real talk','She needs to trust you more.');
  if(d.eligible===false&&!['dating','exclusive'].includes(d.phase))return line('nothing for now','She is off the table right now.');
  if(!['dating','exclusive'].includes(d.phase))return line('a date',(d.score??0)>=th.date?'Ask her out.':'She needs to be more into you.');
  if(d.phase!=='exclusive'&&!phases.includes(d.phase))return line('a kiss',(d.score??0)>=th.exclusive?'Ask her to make it official.':'She needs to be more into you first.');
  if(!state.flags?.[`${c}-first-night`])return line('a night together',phases.includes(d.phase)?'When the moment is right, ask her.':'She wants you to make it official first.');
  if(d.phase!=='exclusive')return line('a kiss',(d.score??0)>=th.exclusive?'Ask her to make it official.':'She needs to be more into you first.');
  return line('You are together. Keep it that way.','');});
}
// The core.scene command a hub activity sends (authored id in activityId; see engine scene handling).
// What an activity pays, as the hub shows it (owner call 2026-09-29): money exact, your stats as arrows, her trust as a heart, never a number for either.
export const yields=(pack,a)=>(a.effects||[]).map(e=>e.type==='money'?`${e.delta<0?'−':'+'}$${Math.abs(e.delta)}`:e.type==='stat'?`${(pack.statDefinitions||[]).find(x=>x.id===e.stat)?.name||e.stat} ${(e.delta<0?'↓':'↑').repeat(Math.min(3,Math.abs(e.delta)))}`:e.type==='trust'?`${nameOf(pack,e.character)} ♥`:'').filter(Boolean).join(' · ');
// M5: `result` is the widget's tier (skip|ok|good|great); left out, the engine pays the base yield.
export const activityCommand=(pack,id,result)=>{const a=pack.activities.find(x=>x.id===id);return {type:'core.scene',args:{text:a.name,location:a.location,characters:a.character?[a.character]:[],activity:'other',activityId:a.id,...(result?{result}:{})}};};
// In a scene, an "Ask her about…" suggestion is a line to type, not a menu pick: typed lines are what she prices.
export const promptFill=(state,a)=>state?.scene&&a.type==='social.speak'&&a.args?.text||null;
// Outside a scene, talking to her opens a short focused talk scene, so what you say there is priced (M0 interview: "Talk opens a scene").
export const speakCommand=(state,pack,a)=>!state?.scene&&isCampus(pack)&&a.type==='social.speak'&&a.args?.target?{type:'core.scene',args:{text:a.args.text||`Talk to ${state.actors[a.args.target]?.name}`,location:state.actors[pack.playerId].location,characters:[a.args.target],activity:'talk'}}:{type:a.type,args:a.args};

// End card: when the newest turn closed a scene, one row per priced act of that scene: who, why, and ♥+ / ♥− (never a number).
export function endCard(state,pack){
 const first=firstEndCard(state,pack);if(first)return first;
 const turn=Object.values(state.turns||{}).at(-1);if(!turn?.events?.some(e=>e.type==='core.sceneEnded'))return null;
 const events=state.events||[],end=events.findLastIndex(e=>e.type==='core.sceneEnded'),priced=events.slice(0,end).filter(e=>e.type==='social.actPriced'),sceneId=priced.at(-1)?.payload.sceneId;
 const since=events.slice(0,end).findLastIndex(e=>e.type==='core.sceneEnded'),rows=sceneId?priced.filter(e=>e.payload.sceneId===sceneId&&events.indexOf(e)>since).map(e=>({character:e.payload.character,name:nameOf(pack,e.payload.character),text:e.payload.text,mark:e.payload.verdict==='liked'?'up':e.payload.verdict==='disliked'?'down':'none'})):[];
 const ended=events[end].payload;return {text:ended.text,characters:(ended.characters||[]).map(c=>nameOf(pack,c)),rows};
}

// Journal: read-only, only what the player has learned: arc stage by name and discovered likes/dislikes.
export function journal(state,pack){
 if(pack.likesOpen!==undefined)return loveInterests(pack).map(id=>{const actor=pack.actors.find(a=>a.id===id),track=(pack.arcTracks||[]).find(t=>t.character===id),stage=track?.stages?.[state.modules['character.arc']?.characters?.[id]?.stage??0],clues=state.modules['social.dating']?.characters?.[id]?.likeClues||[],counts=new Map();for(const clue of clues)counts.set(clue.entry,(counts.get(clue.entry)||0)+1);const known=pack.likesOpen===true?[...counts].filter(([,n])=>n>=2).map(([entry])=>clues.find(x=>x.entry===entry)):[];return {id,name:actor?.name||id,portrait:actor?.portrait||null,stage:stage?.name||null,clues:clues.map(({text,tick,from})=>({text,tick,from})),likes:known.filter(x=>x.liked).map(x=>({reason:x.label})),dislikes:known.filter(x=>!x.liked).map(x=>({reason:x.label}))};});
 return loveInterests(pack).map(id=>{const track=(pack.arcTracks||[]).find(t=>t.character===id),stage=track?.stages?.[state.modules['character.arc']?.characters?.[id]?.stage??0],known=state.modules['social.acts']?.characters?.[id]?.known||[];
  const acts=((pack.actProfiles||[]).find(x=>x.character===id)?.entries||[]).filter(x=>known.includes(x.id)).map(x=>({kind:x.kind,target:x.target,reason:x.reason,liked:x.points>0}));
  const actor=pack.actors.find(a=>a.id===id);return {id,name:actor?.name||id,portrait:actor?.portrait||null,stage:stage?.name||null,likes:acts.filter(x=>x.liked),dislikes:acts.filter(x=>!x.liked)};});
}
// Phone: threads newest-first; replying and accepting stay engine actions (social.replyMessage / social.acceptPhoneOffer).
export const PHONE_ACTIONS=['social.readThread','social.replyMessage','social.acceptPhoneOffer'];
const threadOrder=(a,b)=>Number(b.unread>0)-Number(a.unread>0)||b.at-a.at;
export function phone(state,pack){
 const threads=state.modules['social.phone']?.threads||{};
 return Object.entries(threads).filter(([,t])=>t.length).map(([id,t])=>({character:id,name:nameOf(pack,id),unread:t.filter(m=>!m.read).length,messages:t.map(m=>({id:m.id,text:m.text,reply:m.replyText||null,offer:m.offer?{place:pack.locations.find(l=>l.id===m.offer.location)?.name||m.offer.location,status:m.offer.status}:null})).reverse()})).sort((a,b)=>threadOrder({...a,at:threads[a.character].at(-1).tick??0},{...b,at:threads[b.character].at(-1).tick??0}));
}
// Messages panel: every thread newest-first with the invitation each one is waiting on. Reading, replying and accepting stay engine actions.
export function messages(state,pack){
  const threads=state.modules['social.phone']?.threads||{};
  const list=Object.entries(threads).filter(([,t])=>t.length).map(([character,t])=>({character,name:nameOf(pack,character),unread:t.filter(m=>!m.read).length,at:t.at(-1).tick,
    messages:[...t].reverse().map(m=>({id:m.id,text:m.text,read:Boolean(m.read),mine:Boolean(m.replyText),reply:m.replyText||null,offer:m.offer?{place:pack.locations.find(l=>l.id===m.offer.location)?.name||m.offer.location,status:m.offer.status,expires:m.offer.expiresTick}:null}))})).sort(threadOrder);
  return {unread:list.reduce((n,t)=>n+t.unread,0),threads:list};
}
// Sprite expression for a love interest in the open scene: her last reaction this scene, else neutral.
export function poseFor(state,pack,id){
 const actor=pack.actors.find(a=>a.id===id),poses=actor?.poses||[],sceneId=state.scene?.id,last=sceneId&&(state.events||[]).filter(e=>e.type==='social.actPriced'&&e.payload.sceneId===sceneId&&e.payload.character===id).at(-1)?.payload.verdict;
 const want=last==='liked'?'smile':last==='disliked'?'frustrated':state.modules['character.sobriety']?.characters?.[id]?.drinks>=(pack.sobriety?.drunkAt??3)?'concerned':'neutral';
 return poses.find(p=>p.id===want)?.image||actor?.portrait||null;
}
// The engine's shared choice hint prints trust as a number; on campus an activity choice shows the hub's yields line instead.
export const actionHint=(pack,a)=>{const act=isCampus(pack)&&a.args?.activityId&&pack.activities.find(x=>x.id===a.args.activityId);return act?yields(pack,act):a.storylet?.hint;};
// Scene-header clock, just numbers: raw tick plus position within the daypart (T37 · 2/4), so a long talk visibly spends the day.
export const clockDigits=(state,pack)=>{const interval=pack.daypart?.interval||4;return `T${state.tick} · ${(state.tick%interval)+1}/${interval}`;};
