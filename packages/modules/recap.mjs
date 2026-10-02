import {assert} from '../core/engine.mjs';
import {calendarFor,PERIODS} from '../../public/calendar.mjs';

// Day recap (T-051): when the clock crosses into a new day the engine closes the day it just played and writes a few
// plain lines about what changed - rungs reached, who warmed or cooled, promises kept or broken, what she let slip,
// wants met, the beat that landed, and what tomorrow still holds. Built from committed events only: no model call, no
// RNG, so a replay and a reload agree. Tiers are words, the way the mood line says them; a line that carries a digit
// is dropped rather than shown, so no number ever reaches the card.
export const RECAP={max:6,keep:7};
const path=['modules','story.recap','days'];
const settings=pack=>({...RECAP,...pack.dayRecap});
const QUIET='A quiet day; nothing changed.';
// The day's own movement picks the band, exactly the way the mood line picks a tier.
const UP=[[3,'a touch warmer'],[6,'warmer'],[10,'noticeably warmer'],[18,'much warmer']];
const DOWN=[[3,'a touch less warm'],[6,'less warm'],[10,'noticeably less warm'],[18,'much less warm']];
const PHASE={crush:'a mutual crush',dating:'officially dating',exclusive:'together'};
const RUNG={talk:'talked properly',date:'went on a date',kiss:'kissed',night:'spent the night together'};
const band=(n,tiers)=>([...tiers].reverse().find(([at])=>n>=at)||tiers[0])[1];
const clean=list=>[...new Set(list.map(l=>String(l||'').replace(/\s+/g,' ').trim()).filter(l=>l&&!/\d/.test(l)))];
const join=names=>names.length<2?names.join('and'):`${names.slice(0,-1).join(', ')} and ${names.at(-1)}`;

// One day read out of committed state: {day,weekday,date,lines}. Pure, so the morning card and the journal agree,
// and cheap enough to rebuild for any past day. `ahead` (what tomorrow holds) is built last and never truncated by a
// busy day: the player is told what is at stake before the deadline, not after.
export function dayRecap(state,pack,day){
 const per=(pack.daypart?.interval||4)*PERIODS.length,start=(day-1)*per,player=pack.playerId,
  name=id=>state.actors[id]?.name||pack.actors.find(a=>a.id===id)?.name||id,
  acts=(state.events||[]).filter(e=>e.tick>=start&&e.tick<start+per&&(e.visibility==='public'||(e.visibility||[]).includes(player))),
  of=t=>acts.filter(e=>e.type===t),
  castOf=(...types)=>[...new Set(types.flatMap(t=>of(t)).map(e=>e.payload.character).filter(Boolean).map(name))],
  lines=[],ahead=[];
 // Rungs: what actually moved about where you stand.
 for(const e of of('social.romanceRankChanged')){const rank=(pack.romanceTempoProfiles||[]).find(p=>p.character===e.payload.character)?.ranks?.find(r=>r.id===e.payload.to);if(rank)lines.push(`You and ${name(e.payload.character)} reached ${rank.name}.`);}
 for(const e of of('social.firstCompleted'))if(RUNG[e.payload.rung])lines.push(`You and ${name(e.payload.character)} ${RUNG[e.payload.rung]}.`);
 for(const e of of('social.datingPhaseChanged'))if(PHASE[e.payload.to])lines.push(`You and ${name(e.payload.character)} are ${PHASE[e.payload.to]}.`);
 for(const e of of('character.stageReached'))lines.push(`${name(e.payload.character)} is turning into ${e.payload.name}.`);
 // Who warmed up, who cooled: the day's net movement per character, banded into words.
 const move=new Map();
 for(const e of acts){const warm=e.type==='social.romancePointsChanged'||e.type==='social.relationshipChanged'&&e.payload.toward===player,who=warm?(e.payload.character||e.payload.actor):null,delta=warm?e.payload.delta:0;if(who&&who!==player&&delta)move.set(who,(move.get(who)||0)+delta);}
 const up=[...move].filter(([,d])=>d>0).sort((a,b)=>b[1]-a[1]),down=[...move].filter(([,d])=>d<0).sort((a,b)=>a[1]-b[1]),
  warm=up.slice(0,2).map(([who])=>name(who)),cold=down.slice(0,2).map(([who])=>name(who));
 if(warm.length)lines.push(`${join(warm)} ${warm.length>1?'look':'looks'} ${band(up[0][1],UP)} toward you.`);
 if(cold.length)lines.push(`${join(cold)} ${cold.length>1?'are':'is'} ${band(-down[0][1],DOWN)} with you.`);
 // Promises, made and answered.
 const kept=castOf('social.planKept','story.planKept'),broke=castOf('social.planMissed','story.planBroken','story.goalMissed'),made=castOf('social.planMade','story.planCreated');
 if(kept.length&&broke.length)lines.push(`You kept your word to ${join(kept)} and let ${join(broke)} down.`);
 else if(kept.length)lines.push(`You kept your word to ${join(kept)}.`);
 else if(broke.length)lines.push(`You let ${join(broke)} down.`);
 else if(made.length)lines.push(`You made a plan with ${join(made)}.`);
 // What she let slip about herself: at most two clues, whatever the day turned up.
 const clues=[];
 for(const e of of('social.likeClueAdded'))clues.push(`${name(e.payload.character)}: ${e.payload.text}`);
 for(const e of of('social.actDiscovered')){const entry=(pack.actProfiles||[]).find(p=>p.character===e.payload.character)?.entries?.find(x=>x.id===e.payload.entry);if(entry)clues.push(`${name(e.payload.character)} ${entry.points>0?'likes':'does not like'} it when ${entry.reason}.`);}
 for(const e of of('social.preferenceDiscovered'))clues.push(`You learned something new about ${name(e.payload.character)}.`);
 lines.push(...clean(clues).slice(0,2));
 // A want of her own, met.
 for(const e of of('social.wantFulfilled').slice(0,1))lines.push(e.payload.text);
 // Who you spent it with, said only when something else already happened.
 const together=[...new Set([...of('core.sceneEnded').flatMap(e=>e.payload.characters||[]),...of('social.actPriced').map(e=>e.payload.character),...of('social.spoke').map(e=>e.payload.target),...of('social.planKept').map(e=>e.payload.character),...of('social.planMade').map(e=>e.payload.character)])].map(name);
 if(lines.length)lines.push(together.length?`You spent the day with ${join(together)}.`:'You spent the day on your own.');
 // The beat that landed, and the one you walked away from.
 for(const e of [...of('story.incident'),...of('story.beatIgnored'),...of('story.beatDropped'),...of('social.jealousyConfrontation')].slice(0,2))lines.push(e.payload.text);
 // What tomorrow holds.
 const due=[...new Set(((state.modules||{})['story.scenes']?.plans||[]).filter(p=>p.status==='pending'&&p.deadlineTick>=start+per).map(p=>p.character).filter(Boolean).map(name))];
 if(due.length)ahead.push(`Your plan with ${join(due)} is still open.`);
 const director=(state.modules||{})['story.director'];
 if(director?.owed)ahead.push('What you brushed off comes back harder tomorrow.');
 if(director?.armed)ahead.push('Something you have been warned about is waiting to happen.');
 const max=settings(pack).max,room=Math.max(0,max-clean(ahead).length),body=clean(lines).slice(0,room),out=[...body,...clean(ahead)],cal=calendarFor(start,pack);
 return {day,weekday:cal.weekday,date:cal.date,lines:out.length?out:[QUIET]};
}

// The last closed day, and the whole kept window, straight off committed state.
export const dayRecaps=(state,pack)=>state.modules['story.recap']?.days||[];

export const recap={id:'story.recap',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){
  const c=p.dayRecap;if(c===undefined)return;
  assert(c&&typeof c==='object'&&!Array.isArray(c),'dayRecap: expected an object');
  for(const [k,lo,hi] of [['max',1,12],['keep',1,30]])assert(c[k]===undefined||Number.isInteger(c[k])&&c[k]>=lo&&c[k]<=hi,`dayRecap.${k}: expected an integer from ${lo} to ${hi}`);
 },
 init:()=>({days:[]}),
 react(tx,event){
  if(event.type!=='core.timeAdvanced')return;
  const {from,to}=event.payload,pack=tx.pack,player=pack.playerId;
  // Every boundary the clock crossed closes one day; a skipped day closes with the honest quiet line.
  for(let day=calendarFor(from,pack).day;day<calendarFor(to,pack).day;day++){
   const closed=dayRecap(tx.state,pack,day),days=tx.state.modules['story.recap'].days||[];
   tx.set(path,[...days.filter(d=>d.day!==day),closed].slice(-settings(pack).keep));
   tx.emit('story.dayClosed',{day,weekday:closed.weekday,date:closed.date,lines:closed.lines,text:closed.lines.join(' ')},[player]);
  }},
 panel(s,p){const days=dayRecaps(s,p);return {title:'Day recaps',lines:days.length?[...days].reverse().map(d=>`${d.weekday}${d.date?` ${d.date}`:''}: ${d.lines.join(' ')}`):['No day has closed yet.']};}};
