import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {conditionReasons,validateConditions} from './conditions.mjs';
import {addPoints} from './romance-tempo.mjs';
import {changeTrust} from './romance-stats.mjs';
import {LEAVING} from '../../vendor/venus/scenePrompt.mjs';

// F8 drama director, in the spirit of the Left 4 Dead AI Director and RimWorld storytellers: the engine, not
// the model, decides when drama lands. Tension rises with eventful play and decays with the clock; a streak of
// quiet dayparts draws one authored complication scene through the existing story scene queue. The director only
// times the beat — every complication is an authored scripted scene triggered by the story.incident event.
// The mirror side: quiet dayparts can also deal authored event actions (offer:"director" scenes the player
// chooses to spend a whole daypart on) that pay stats, money, loot or affection, and finishing an authored
// activity can deal one tied to it. Dealing never costs a model call and never forces a scene on the player.
const path=['modules','story.director'];
// Storyteller presets (RimWorld): cassandra paces steadily, randy rolls early whims, phoebe needs deeper quiet.
const BASE={quietDayparts:2,earlyChancePercent:0,jitter:10,escalationDays:3,decayPerTick:3,activeThreshold:25,maxPerDay:1,firstTick:8,stallTurns:6};
export const PRESETS={
 cassandra:BASE,
 randy:{...BASE,quietDayparts:1,earlyChancePercent:20,jitter:35,escalationDays:2},
 phoebe:{...BASE,quietDayparts:3,escalationDays:4,decayPerTick:2}
};
export const settingsOf=profile=>({...BASE,opportunityChancePercent:0,interruptionChancePercent:0,opportunitiesPerDay:2,...PRESETS[profile?.preset||'cassandra'],...profile});
// Default tension weights for events that mean "something happened"; authored tensionEvents add on top, so a
// pack can calm specific events (neglectDefused) or prize its own story beats.
const WARMTH=new Set(['social.romancePointsChanged','social.relationshipChanged']);
export const TENSION_DEFAULTS={'story.choiceResolved':8,'core.sceneStarted':4,'world.hangoutStarted':6,'social.relationshipChanged':5,'social.romancePointsChanged':5,'social.jealousyTriggered':15,'social.neglectDetonated':12,'social.consentDeclined':10,'story.planBroken':10,'social.rumorCreated':5,'social.rumorBelieved':6,'story.sceneEvicted':4,'social.giftLimitReached':4,'social.neglectDefused':-8};
const clampTension=v=>Math.max(0,Math.min(100,v));
const profileOf=p=>p.directorProfile||null;
export const TONE_LEVELS={grounded:1,soap:2,melodrama:3};
const ceilingOf=settings=>settings.toneCeiling?TONE_LEVELS[settings.toneCeiling]:3;
export const focusOf=current=>{const sorted=Object.entries(current.attention||{}).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));return sorted[0]?.[1]>=3&&sorted[0][1]>=(sorted[1]?.[1]||0)*2?sorted[0][0]:null;};
// The single most-attended character, no ratio test: rotation never points away from whoever the player is
// actually spending time with, even while the attention meter is still climbing toward a formal focus.
const topAttentionOf=current=>{const sorted=Object.entries(current?.attention||{}).filter(([,n])=>n>0).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]));return sorted[0]?.[0]||null;};
export const adaptationOf=(current,quiet,settings)=>current.setbacks>=2?'recovery':focusOf(current)&&quiet>=1?'focus':quiet>=settings.quietDayparts?'quiet':'none';
// Tension tilt: the director only draws on quiet boundaries, so tension is always under the active threshold at
// pick time — the tilt uses that whole range. A charged run-up (tension near the threshold) favors the heavier
// tones, a calm one the lighter; soft (±8 at the extremes), never a hard gate.
const toneTilt=(c,current,settings)=>{const r=settings&&current?Math.max(0,Math.min(1,(current.tension||0)/Math.max(1,settings.activeThreshold))):0;return Math.round(((c.tone??1)-1)*(r-0.5)*16);};
const scoreBonus=(c,current,mode,delivery,settings,rotate)=>!c.template?0:(mode==='recovery'?(delivery==='offer'?30:-10):0)+(mode==='focus'?(c.focus===focusOf(current)&&['obstacle','temptation'].includes(c.kind)?30:c.focus&&c.focus!==focusOf(current)?-20:0):0)+toneTilt(c,current,settings)+(rotate&&c.focus&&c.focus===current.lastFocus&&c.focus!==topAttentionOf(current)?-12:0)+(mode==='breather'?((c.tone??1)>1?-25:8):0);
// Spotlight rotation (thin-slice step 4, armed 2026-10-01): a quiet-mode draw nudges off whoever the last beat
// starred — but only once the deck is mixed, detected per draw: some candidate whose cast is not drawn from the
// dating pool (step 10's non-romance shapes). Over an all-romance deck the penalty cannot rescue a starving NPC,
// it only suppresses whoever the player is courting (the planner courtship gate proved it), so it stays dormant
// there; and it never points away from the most-attended character. fun-metrics.spotlight measures the equity.
// Wildermyth-style escalation: heavier drama unlocks as campaign days pass (day 1 → tier 1, then +1 per escalationDays).
const tierOf=(settings,cal)=>1+Math.min(2,Math.floor((cal.day-1)/settings.escalationDays));
// Weighted draw with a no-immediate-repeat penalty; jitter consumes the campaign RNG once per candidate, so seeded runs replay exactly.
const bestOf=(pool,tx,settings,deck,current=null,mode='none',delivery='incident')=>{const rom=new Set((tx.pack.datingProfiles||[]).map(d=>d.character)),rotate=Boolean(current&&(mode==='quiet'||mode==='none')&&current.lastFocus&&pool.some(({c})=>{const vals=Object.values(c.roles||{});return c.focus&&c.focus!==current.lastFocus&&vals.length&&!vals.every(id=>rom.has(id));}));let best=null;for(const {c,delivery:kind} of pool){const score=(c.weight??10)+settings.jitter*tx.random()-(deck.recent.includes(c.id)?8:c.template&&deck.recent.some(r=>r.startsWith(`${c.template}.`))?6:0)+(current?scoreBonus(c,current,mode,kind||delivery,settings,rotate):0);if(!best||score>best.score)best={c,score,delivery:kind||delivery};}return best?{...best.c,_delivery:best.delivery}:null;};
// Deck bookkeeping is per role: complications count in uses/lastUse/recent, dealt events in the o- prefixed trio.
const deckOf=(current,prefix)=>prefix?{uses:current[prefix+'Uses']||{},lastUse:current[prefix+'LastUse']||{},recent:current[prefix+'Recent']||[]}:{uses:current.uses||{},lastUse:current.lastUse||{},recent:current.recent||[]};
const budgetLeft=(current,settings,cal,tick=Infinity)=>tick>=(current.offerBlockedUntilTick||0)&&(cal.day===current.oLastDay?current.oToday||0:0)<settings.opportunitiesPerDay;
function missedGoal(tx,current,profile,event){
 const entry=[...(profile.complications||[]),...(profile.opportunities||[])].find(c=>c.goal?.planId===event.payload?.id);
 if(!entry)return current;
 const {character,missed}=entry.goal,name=tx.state.actors[character]?.name||character;
 // kind "none": the deadline still breaks and is announced, but no Trust, points or offer block follows.
 if(missed.kind==='none');
 else if(missed.kind==='relationship'){
  const edge=`${character}--${tx.pack.playerId}`,relationships=tx.state.modules['social.relationships'];
  // Flagged saves use the shared Trust writer (daily cap, clamp); unflagged saves keep the legacy write (GC2.2).
  if(relationships&&tx.state.progression)changeTrust(tx,character,-missed.cost,{reaction:'director:missed-goal',keepPatch:true});
  else if(relationships){const old=relationships.edges[edge]||0,value=Math.max(0,old-missed.cost);tx.set(['modules','social.relationships','edges',edge],value);tx.emit('social.relationshipChanged',{actor:character,toward:tx.pack.playerId,old,value,delta:value-old,reaction:'director:missed-goal',text:`${name}: Trust ${old} → ${value}`},[tx.pack.playerId,character]);}
  else if(tx.state.modules['social.romance-tempo']?.characters?.[character])addPoints(tx,character,-missed.cost,'director:missed-goal');
 }else current={...current,offerBlockedUntilTick:Math.max(current.offerBlockedUntilTick||0,tx.state.tick+missed.cost)};
 tx.emit('story.goalMissed',{template:entry.template||null,entry:entry.id,planId:entry.goal.planId,character,consequence:missed.kind,cost:missed.cost??0,text:missed.kind==='none'?'The deadline passed.':missed.kind==='relationship'?`Missing the deadline strains things with ${name}.`:`Missing the deadline closes off new opportunities for ${missed.cost} ticks.`},[tx.pack.playerId,character]);
 return current;
}
function eligible(tx,entries,settings,cal,tier,deck,recycle=false){
 // Nobody the player just said goodbye to barges straight back in as a complication in the same breath.
 const st=tx.state.modules['story.scenes'],parted=new Set((tx.events||[]).filter(e=>e.type==='core.sceneEnded').flatMap(e=>e.payload.characters||[]));
 return entries.map((c,i)=>({c,i})).filter(({c})=>{if(Object.values(c.roles||{}).some(id=>parted.has(id)))return false;
  // A template's castings share one budget: "spark" with Nova and "spark" with Abigail are the same beat and the same prose.
  const kin=c.template?entries.filter(e=>e.template===c.template).map(e=>e.id):[c.id],scene=tx.pack.scriptedScenes.find(x=>x.id===c.scene),used=kin.reduce((n,id)=>n+(deck.uses[id]||0),0),last=kin.reduce((m,id)=>deck.lastUse[id]==null?m:Math.max(m??-Infinity,deck.lastUse[id]),null);
  return scene&&(recycle?scene.repeatable:used<(c.maxUses??1))&&!(c.minTick&&tx.state.tick<c.minTick)
   &&(last==null||tx.state.tick-last>=(c.cooldownTicks??0))&&(c.intensity??1)<=tier&&(c.tone??1)<=ceilingOf(settings)
   &&!conditionReasons(c.when,tx.state,tx.pack).length&&!conditionReasons(scene.when,tx.state,tx.pack,scene.pages).length
   &&(scene.repeatable||!st.completed.includes(scene.id))&&!(st.queue||[]).some(x=>x.scene===scene.id);
 });
}
// An event-driven beat (mishap, witnessed touch): an incident right now, ignoring the daily cap; armed behind an open scene.
function dealNow(tx,current,pick,deck,cal,mode,extra){
 if(tx.state.modules['story.scenes']?.pending){tx.set(path,{...current,armed:{id:pick.id,delivery:'incident'}});return;}
 tx.emit('story.incident',{incident:pick.id,scene:pick.scene,kind:pick.kind||'complication',intensity:pick.intensity??1,mode,recycled:false,armed:false,tension:current.tension,quiet:current.quiet,template:pick.template||null,roles:pick.roles||{},tone:pick.tone??1,...extra,text:withLast(pick.text,tx.state,tx.pack)||'Something goes wrong.'},[tx.pack.playerId]);
 tx.set(path,{...current,quiet:0,armed:null,...(pick.focus?{lastFocus:pick.focus}:{}),breatherNext:(pick.tone??1)===3,uses:{...deck.uses,[pick.id]:(deck.uses[pick.id]||0)+1},lastUse:{...deck.lastUse,[pick.id]:tx.state.tick},recent:[...deck.recent,pick.id].slice(-5),fired:current.fired+1,lastDay:cal.day,firedToday:cal.day===current.lastDay?current.firedToday+1:1,lastTick:tx.state.tick,lastKind:pick.kind||'complication'});
}
// Deal one authored event action into state.offers: it shows up as a choosable action (startOfferedScene) whose
// timeCost is the scene's — a whole daypart by design. Offers expire at dawn; taking one counts its uses.
const deal=(tx,current,settings,cal,entries,deck,extra,selected=null,mode='quiet')=>{
 const pool=(selected?[{c:selected}]:eligible(tx,entries,settings,cal,tierOf(settings,cal),deck)).filter(({c})=>extra(c)&&!(current.offers||[]).some(o=>o.id===c.id));
 const pick=selected?pool.find(x=>x.c.id===selected.id)?.c:bestOf(pool,tx,settings,deck);if(!pick)return false;
 tx.set(path,{...current,offers:[...(current.offers||[]),{id:pick.id,scene:pick.scene,...(pick.template?{template:pick.template,roles:pick.roles,kind:pick.kind,tone:pick.tone}: {})}],offersDay:cal.day,oLastDay:cal.day,oToday:(cal.day===current.oLastDay?current.oToday||0:0)+1,...(settings.adaptive?{quiet:0,armed:null,lastTick:tx.state.tick,lastKind:pick.kind,setbacks:Math.max(0,current.setbacks-(mode==='recovery'?2:0))}:{})});
 if(settings.adaptive)tx.emit('story.directorDealt',{entry:pick.id,scene:pick.scene,kind:pick.kind||'event',template:pick.template||null,roles:pick.roles||{},tone:pick.tone??1,mode,recycled:Boolean(pick._recycled),text:withLast(pick.text,tx.state,tx.pack)||'A new opportunity appears.'},[tx.pack.playerId]);
 return true;
};
function adaptivePool(tx,profile,settings,cal,current,recycle=false){const incidentsLeft=cal.day!==current.lastDay||(current.firedToday||0)<settings.maxPerDay,complications=incidentsLeft?eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),deckOf(current,''),recycle).filter(({c})=>c.template).map(x=>({...x,delivery:'incident'})):[];const offers=budgetLeft(current,settings,cal,tx.state.tick)?eligible(tx,profile.opportunities||[],settings,cal,tierOf(settings,cal),deckOf(current,'o'),recycle).filter(({c})=>c.template&&!c.match?.activity&&!(current.offers||[]).some(o=>o.id===c.id)).map(x=>({...x,delivery:'offer'})):[];return [...complications,...offers];}
// The tease is binding: the armed beat is the one that fires, and if it left the pool by fire time the promise is
// released out loud (story.teaserPassed) — never silently swapped for a different draw.
function adaptivePick(tx,pool,current,settings,mode){if(current.armed){const hit=pool.find(x=>x.c.id===current.armed.id&&x.delivery===(current.armed.delivery||'incident'));if(hit)return {pick:{...hit.c,_delivery:hit.delivery}};return {dropped:current.armed};}return {pick:bestOf(pool,tx,settings,{recent:[...current.recent,...(current.oRecent||[])]},current,mode)};}
function adaptiveBeat(tx,profile,current,settings,cal,tension,quiet,rollover,early,breather=false){const mode=breather?'breather':adaptationOf(current,quiet,settings)==='none'?(early?'whim':'quiet'):adaptationOf(current,quiet,settings),pool=adaptivePool(tx,profile,settings,cal,current),recycled=!pool.length,options=recycled?adaptivePool(tx,profile,settings,cal,current,true):pool,{pick,dropped}=adaptivePick(tx,options,{...current,tension},settings,mode);if(!pick){if(dropped){tx.emit('story.teaserPassed',{incident:dropped.id,delivery:dropped.delivery||'incident',reason:'ineligible',text:'The teased moment can no longer happen, and whatever was building passes with it.'},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet,armed:null});return true;}if(quiet===settings.quietDayparts)tx.emit('story.starved',{quiet,text:'Every director template is spent or gated.'},[]);return false;}if(recycled)pick._recycled=true;if(pick._delivery==='offer')return deal(tx,{...current,...rollover,tension,quiet,armed:null,breatherNext:false},settings,cal,profile.opportunities||[],deckOf(current,'o'),c=>!c.match?.activity,pick,mode);const deck=deckOf(current,'');tx.emit('story.incident',{incident:pick.id,scene:pick.scene,kind:pick.kind||'complication',intensity:pick.intensity??1,mode,recycled,armed:Boolean(current.armed?.id===pick.id),tension,quiet,template:pick.template||null,roles:pick.roles||{},tone:pick.tone??1,text:withLast(pick.text,tx.state,tx.pack)||'Something is about to happen.'},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet:0,armed:null,...(pick.focus?{lastFocus:pick.focus}:{}),breatherNext:(pick.tone??1)===3,uses:{...deck.uses,[pick.id]:(deck.uses[pick.id]||0)+1},lastUse:{...deck.lastUse,[pick.id]:tx.state.tick},recent:[...deck.recent,pick.id].slice(-5),fired:current.fired+1,lastDay:cal.day,firedToday:cal.day===current.lastDay?current.firedToday+1:1,lastTick:tx.state.tick,lastKind:pick.kind||'complication'});return true;}
// One callback line from the last played, resolved or dismissed scene (who, what, how it ended): the director's
// memory, quoted by the narrator and the future recap. Oldest-dropping by construction — only the latest entry speaks.
const lastBeatOf=(s,p)=>{const h=(s.modules['story.scenes']?.history||[]).at(-1);if(!h)return {};
 const scene=(p.scriptedScenes||[]).find(x=>x.id===h.scene);if(!scene)return {};
 const who=h.scene.startsWith('director.')?h.scene.split('.').slice(2).map(id=>s.actors[id]?.name||id).slice(0,2):[];
 const text=h.status==='resolved'||h.status==='played'?`the "${scene.title}" moment${who.length?` with ${who.join(' and ')}`:''} played out`:h.status==='dismissed'?`you walked away from "${scene.title}"${who.length?` (${who.join(' and ')})`:''}`:'';
 return text?{lastBeat:text}:{};};
// {last} in an authored beat's text or tease is the callback hook: at deal time it becomes the line above, so a
// beat can quote what actually happened before it ("Remember {last}?") instead of pretending shared history.
const withLast=(text,s,p)=>text?String(text).replace(/\{last\}/g,()=>lastBeatOf(s,p).lastBeat||'').slice(0,240):text;
// What the rest of the game may know about the drama schedule: derived only from committed state, costs nothing.
export function directorContext(s,p){
 const profile=profileOf(p),st=s.modules['story.director'];if(!profile||!st)return null;
 const settings=settingsOf(profile),cal=calendarFor(s.tick,p);
 return {tension:st.tension,quiet:st.quiet,needed:settings.quietDayparts,tier:tierOf(settings,cal),...(settings.adaptive?{adaptation:adaptationOf(st,st.quiet,settings),focus:focusOf(st),textMode:settings.textMode||'authored'}:{}),...(st.armed?{armed:st.armed.id}:{}),...(st.lastTick!=null&&s.tick-st.lastTick<=(p.daypart?.interval||4)?{freshKind:st.lastKind}:{}),...lastBeatOf(s,p)};
}
// One line of dramatic pressure for beats.mjs: charged days lean into subtext, a teased beat leans toward giving,
// and a fresh incident colors the aftermath. Empty string most turns, so the prompt only pays when it matters.
export function briefOf(d){
 if(!d)return '';
 if(d.freshKind)return `A recent ${d.freshKind} moment is still settling; let the undertone show without relitigating it.`;
 if(d.armed)return 'Pressure is building toward something; let one line carry it without resolving anything.';
 if(d.tension>=60)return 'The day is charged; let small tension show in gestures and word choice.';
 return '';
}
function react(tx,event){
 const profile=profileOf(tx.pack);if(!profile||event.type==='core.patch')return;
 let current=tx.state.modules['story.director'];const settings=settingsOf(profile);
 if(event.type==='story.planBroken')current=missedGoal(tx,current,profile,event);
 // Walking out of a director incident is noticed (owner call 2026-10-01): the beat is owed once — it comes back
 // harder at the next quiet boundary — and ignoring it a second time resolves it for good. One capped consequence
 // with a repair path (playing it through), never a grievance. Authored scenes and consent stops don't count;
 // adaptive packs only, so the legacy fixture stays frozen.
 if(event.type==='story.sceneDismissed'){
  const last=(tx.state.modules['story.scenes']?.history||[]).at(-1);
  if(settings.adaptive&&last?.status==='dismissed'&&!current.owed){
   const entry=(profile.complications||[]).find(c=>c.scene===event.payload.scene);
   if(entry){
    if((current.escalated||{})[entry.id]){tx.emit('story.beatDropped',{incident:entry.id,scene:entry.scene,text:'Ignored a second time, whatever was building passes for good.'},[tx.pack.playerId]);tx.set(path,{...current,notes:[...(current.notes||[]),{tick:tx.state.tick,incident:entry.id,text:'passed for good'}].slice(-10)});}
    else{const who=Object.values(entry.roles||{}).map(id=>tx.state.actors[id]?.name||id)[0],tone=Math.min(3,(entry.tone??1)+1);
     tx.emit('story.beatIgnored',{incident:entry.id,scene:entry.scene,tone,text:who?`You brushed ${who} off; it will come back up.`:'You walked away once; it will come back up.'},[tx.pack.playerId]);
     tx.set(path,{...current,owed:{id:entry.id,scene:entry.scene,kind:entry.kind,tone,intensity:Math.min(3,(entry.intensity??1)+1),template:entry.template||null,roles:entry.roles||{},focus:entry.focus||null,text:entry.text||null,command:tx.commandId},notes:[...(current.notes||[]),{tick:tx.state.tick,incident:entry.id,text:'ignored once'}].slice(-10)});}
   }
  }
  return;
 }
 // Taking a dealt event marks it accepted and counts the play: uses, cooldowns and the no-immediate-repeat penalty.
 if(event.type==='story.sceneSelected'){
  const hit=(current.offers||[]).find(o=>o.scene===event.payload.scene&&!o.accepted);
  if(hit){const deck=deckOf(current,'o');tx.set(path,{...current,offers:current.offers.map(o=>o===hit?{...o,accepted:true}:o),oUses:{...deck.uses,[hit.id]:(deck.uses[hit.id]||0)+1},oLastUse:{...deck.lastUse,[hit.id]:tx.state.tick},oRecent:[...deck.recent,hit.id].slice(-5)});}
  return;
 }
 // Work interrupts: finishing an authored activity can deal one event tied to it (match.activity) while the day has budget.
 if(event.type==='world.activityCompleted'){
  const st=tx.state.modules['story.scenes'],cal=calendarFor(tx.state.tick,tx.pack);
  if(st&&!st.pending&&tx.state.tick>=settings.firstTick&&settings.interruptionChancePercent>0&&budgetLeft(current,settings,cal,tx.state.tick)&&tx.random()*100<settings.interruptionChancePercent)
   deal(tx,current,settings,cal,profile.opportunities||[],deckOf(current,'o'),c=>c.match?.activity===event.payload.activity&&(!settings.adaptive||c.template));
  return;
 }
 // M5: a push-your-luck mishap costs nothing directly; the director answers it with in-scene trouble, around whoever was there.
 // It ignores the daily cap (a mishap always lands) and waits, armed, behind an open scene.
 if(event.type==='world.activityMishap'){
  if(!settings.adaptive)return;const cal=calendarFor(tx.state.tick,tx.pack),deck=deckOf(current,''),there=event.payload.characters||[];
  const pool=[false,true].map(r=>eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),deck,r).filter(({c})=>c.template)).find(x=>x.length)||[];
  const near=pool.filter(({c})=>Object.values(c.roles||{}).some(id=>there.includes(id))),pick=bestOf(near.length?near:pool,tx,settings,deck);if(!pick)return;
  return dealNow(tx,current,pick,deck,cal,'mishap',{activity:event.payload.activity});
 }
 // M5: a touch seen at work, the gym or study. A heroine who saw it gets the saw-you beat with the one touched as lead; else a rumor about her.
 // Same delivery as a mishap (now, in-scene, armed behind an open scene); trust gates still apply, so a stranger's touch is only gossip.
 if(event.type==='social.touchWitnessed'){
  if(!settings.adaptive)return;const cal=calendarFor(tx.state.tick,tx.pack),deck=deckOf(current,''),{character,rivals=[]}=event.payload;
  const fits=c=>c.template&&c.roles?.lead===character&&(c.template==='saw-you'?rivals.includes(c.roles.rival):c.template==='rumor');
  const pool=[false,true].map(r=>eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),deck,r).filter(({c})=>fits(c))).find(x=>x.length)||[];
  const saw=pool.filter(({c})=>c.template==='saw-you'),pick=bestOf(saw.length?saw:pool,tx,settings,deck);if(!pick)return;
  return dealNow(tx,current,pick,deck,cal,'witnessed',{location:event.payload.location});
 }
 // Typed-play stall interrupt (falsification 2026-10-01: one free scene ran 12 turns with the clock frozen at 25% dead):
 // consecutive sceneContinued turns with nothing committed between them are a stalling scene, and the director
 // interrupts it like a mishap — the cast arrives mid-conversation. Any committed change (tension, setbacks,
 // attention) resets the count, and a live tease outranks the interruption.
 if(event.type==='core.sceneEnded'&&current.stall){current={...current,stall:0};tx.set(path,current);}
 if(event.type==='core.sceneContinued'&&settings.adaptive&&!current.armed){
  const stall=(current.stall||0)+1;
  if(stall>=settings.stallTurns){
   const cal=calendarFor(tx.state.tick,tx.pack),deck=deckOf(current,''),pool=[false,true].map(r=>eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),deck,r).filter(({c})=>c.template)).find(x=>x.length)||[],pick=bestOf(pool,tx,settings,deck);
   if(pick){dealNow(tx,{...current,stall:0},pick,deck,cal,'stall',{});return;}
   tx.set(path,{...current,stall:0});
  }else tx.set(path,{...current,stall});
 }
 // Authored scenes can weight their own beats: scene.tension replaces the flat default when that scene resolves.
 // Warmth is not drama: a scene runs many turns on one tick, so gains would pile up tension the clock never decays and keep a good date from ever counting as quiet.
 const sceneTension=(tx.pack.scriptedScenes||[]).find(x=>x.id===event.payload?.scene)?.tension,warm=WARMTH.has(event.type)&&event.payload?.delta>0;
 const bump=(event.type==='story.choiceResolved'?(sceneTension??TENSION_DEFAULTS[event.type]??0):warm?0:(TENSION_DEFAULTS[event.type]??0))+(profile.tensionEvents||[]).filter(x=>x.event===event.type&&Object.entries(x.match||{}).every(([k,v])=>event.payload[k]===v)).reduce((n,x)=>n+x.weight,0);
 // A typed goodbye owns its turn: a beat due on this turn's clock waits for the next daypart instead of swallowing the farewell.
 if(['core.sceneStarted','core.sceneContinued','social.spoke'].includes(event.type)&&LEAVING.test(String(event.payload.utterance||event.payload.text||''))){current={...current,farewell:tx.commandId};tx.set(path,current);}
 if(event.type!=='core.timeAdvanced'){
  let setbacks=current.setbacks||0,attention=current.attention||{},attentionChanged=false;
  if(settings.adaptive){if(event.type==='social.romancePointsChanged')setbacks=Math.max(0,Math.min(10,setbacks+(event.payload.delta<0?1:-1)));if(['story.planBroken','social.planMissed','social.intimacyDeferred'].includes(event.type))setbacks=Math.min(10,setbacks+1);const character=event.type==='social.actPriced'?event.payload.character:event.type==='social.spoke'?event.payload.target:event.type==='core.sceneStarted'&&event.payload.characters?.length===1?event.payload.characters[0]:null;if(character&&tx.state.actors[character]&&character!==tx.pack.playerId){attention={...attention,[character]:Math.min(10,(attention[character]||0)+1)};attentionChanged=true;}}
  if(bump||setbacks!==(current.setbacks||0)||attentionChanged)tx.set(path,{...current,tension:clampTension(current.tension+bump),setbacks,attention,stall:0});return;
 }
 // The clock settles the daypart: tension decays over the elapsed ticks, then each crossed boundary counts as
 // quiet when what is left of tension sits below the threshold. Waiting IS quiet, so long rests invite drama.
 const {from,to}=event.payload,interval=tx.pack.daypart?.interval||4,cal=calendarFor(to,tx.pack);
 const tension=clampTension(current.tension-settings.decayPerTick*(to-from)),crossed=Math.floor(to/interval)-Math.floor(from/interval);
 if(settings.adaptive&&crossed>0)current={...current,attention:Object.fromEntries(Object.entries(current.attention||{}).map(([id,n])=>[id,Math.max(0,n-crossed)]).filter(([,n])=>n>0)),setbacks:Math.max(0,(current.setbacks||0)-(cal.day>calendarFor(from,tx.pack).day?1:0))};
 let quiet=current.quiet;
 // Dealt event actions are today's: they expire at dawn, and a new day draws from a fresh budget.
 const rollover=crossed>0&&cal.day!==current.offersDay?{offers:[],offersDay:cal.day}:{};
 if(crossed>0){
  quiet=tension<settings.activeThreshold?current.quiet+crossed:0;
  const st=tx.state.modules['story.scenes'],dayOk=cal.day!==current.lastDay||current.firedToday<settings.maxPerDay;
  const ready=st&&!st.pending&&current.farewell!==tx.commandId&&tx.state.tick>=settings.firstTick&&(settings.adaptive||dayOk)&&!(tx.state.run&&tx.state.tick>=tx.state.run.endTick);
  // An eventful daypart also forgets the tease: the pressure released elsewhere, the armed beat returns to the deck.
  const armed=tension<settings.activeThreshold?current.armed:null;
  // Randy's whim: even an eventful daypart can turn on a low roll, the way a storyteller interrupts a good streak.
  const early=ready&&settings.earlyChancePercent>0&&tx.random()*100<settings.earlyChancePercent;
  const cdeck=deckOf(current,''),odeck=deckOf(current,'o');
  // An owed escalation outranks the regular draw: the ignored beat returns once, at tone+1, without touching its
  // deck budget (the first deal already paid it); the recent-list penalty keeps the regular draw off it afterwards.
  if(settings.adaptive&&ready&&current.owed&&dayOk&&tx.commandId!==current.owed.command&&(quiet>=settings.quietDayparts||early)){
   const o=current.owed,who=Object.values(o.roles||{}).map(id=>tx.state.actors[id]?.name||id)[0];
   tx.emit('story.incident',{incident:o.id,scene:o.scene,kind:o.kind||'complication',intensity:o.intensity??2,mode:'escalation',recycled:false,armed:false,tension,quiet,template:o.template||null,roles:o.roles,tone:o.tone??2,escalated:true,text:o.text?withLast(o.text,tx.state,tx.pack):`You walked away from this once.${who?` ${who} is not letting it go this time.`:' It will not wait politely again.'}`},[tx.pack.playerId]);
   tx.set(path,{...current,...rollover,tension,quiet:0,armed:null,breatherNext:(o.tone??2)===3,owed:null,escalated:{...(current.escalated||{}),[o.id]:true},...(o.focus?{lastFocus:o.focus}:{}),recent:[...cdeck.recent,o.id].slice(-5),fired:current.fired+1,lastDay:cal.day,firedToday:cal.day===current.lastDay?(current.firedToday||0)+1:1,lastTick:tx.state.tick,lastKind:o.kind||'complication',notes:[...(current.notes||[]),{tick:tx.state.tick,incident:o.id,text:'came back harder'}].slice(-10)});
   return;
  }
  // L4D breathers: right after the heaviest tone, the next draw is relief — an offered event when the budget
  // allows, else the weighted draw below leans hard toward tone-1 — so peaks reset instead of stacking. An active
  // focus or recovery arc outranks the curve reset: drama about the person in the spotlight is not stacking.
  if(settings.adaptive&&ready&&current.breatherNext&&['quiet','none'].includes(adaptationOf(current,quiet,settings))&&budgetLeft(current,settings,cal,tx.state.tick)&&deal(tx,{...current,breatherNext:false,...rollover,tension,quiet},settings,cal,profile.opportunities||[],odeck,c=>!c.match?.activity,null,'breather'))return;
  if(settings.adaptive&&ready){const mode=adaptationOf(current,quiet,settings),due=quiet>=settings.quietDayparts||mode==='recovery'||mode==='focus'||early;if(due){if(adaptiveBeat(tx,profile,current,settings,cal,tension,quiet,rollover,early,current.breatherNext&&mode==='quiet'))return;}else if(quiet===settings.quietDayparts-1&&settings.quietDayparts>=2&&crossed===1&&!armed){const pool=adaptivePool(tx,profile,settings,cal,current).filter(x=>x.delivery!=='offer'),{pick}=adaptivePick(tx,pool,{...current,tension},settings,'quiet');if(pick){tx.emit('story.teaser',{incident:pick.id,kind:pick.kind||'event',template:pick.template||null,delivery:pick._delivery,text:withLast(pick.tease,tx.state,tx.pack)||'Something is about to happen.',quiet},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet,armed:{id:pick.id,delivery:pick._delivery}});return;}}}
  if(!settings.adaptive&&ready&&(quiet>=settings.quietDayparts||early)){
   const pool=eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),cdeck);
   const hit=armed?pool.find(x=>x.c.id===armed.id)?.c:null;
   if(armed&&!hit){tx.emit('story.teaserPassed',{incident:armed.id,delivery:'incident',reason:'ineligible',text:'The teased moment can no longer happen, and whatever was building passes with it.'},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet,armed:null});return;}
   const pick=hit??bestOf(pool,tx,settings,cdeck);
   if(pick){
    tx.emit('story.incident',{incident:pick.id,scene:pick.scene,kind:pick.kind||'complication',intensity:pick.intensity??1,mode:early?'whim':'quiet',armed:Boolean(armed&&armed.id===pick.id),tension,quiet,text:withLast(pick.text,tx.state,tx.pack)||'Something is about to happen.'},[tx.pack.playerId]);
    tx.set(path,{...current,...rollover,tension,quiet:0,armed:null,...(pick.focus?{lastFocus:pick.focus}:{}),uses:{...cdeck.uses,[pick.id]:(cdeck.uses[pick.id]||0)+1},lastUse:{...cdeck.lastUse,[pick.id]:tx.state.tick},recent:[...cdeck.recent,pick.id].slice(-5),fired:current.fired+1,lastDay:cal.day,firedToday:cal.day===current.lastDay?current.firedToday+1:1,lastTick:tx.state.tick,lastKind:pick.kind||'complication'});
    return;
   }
   // The deck is empty or fully gated: say so once per streak so playtests can measure dry spells (F12).
   if(quiet===settings.quietDayparts)tx.emit('story.starved',{quiet,text:'Every complication is spent or gated; the drama director has nothing to draw.'},[]);
  }else if(!settings.adaptive&&ready&&quiet===settings.quietDayparts-1&&settings.quietDayparts>=2&&crossed===1&&!armed){
   // Pre-commit the draw one daypart early and tell the player: the teased beat is the beat that fires, so the
   // warning is honest and the genre's "teased next event" staple comes for free.
   const pick=bestOf(eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),cdeck),tx,settings,cdeck);
   if(pick){tx.emit('story.teaser',{incident:pick.id,kind:pick.kind||'complication',text:withLast(pick.tease,tx.state,tx.pack)||'Something is about to happen.',quiet},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet,armed:{id:pick.id}});return;}
  }
  // The mirror: a dull daypart (tension under the threshold, drama not due) may deal one authored event action —
  // stats, money, loot or affection the player chooses to chase instead of whatever they were doing.
  if(!settings.adaptive&&ready&&quiet>0&&tension<settings.activeThreshold&&settings.opportunityChancePercent>0&&budgetLeft(current,settings,cal,tx.state.tick)&&tx.random()*100<settings.opportunityChancePercent){
   if(deal(tx,{...current,tension,quiet,armed,...rollover},settings,cal,profile.opportunities||[],odeck,c=>!c.match?.activity))return;
  }
 }
 // An eventful boundary dissolves the tease: say so, instead of letting the promise quietly evaporate.
 const kept=tension<settings.activeThreshold?current.armed:null;
 if(current.armed&&!kept)tx.emit('story.teaserPassed',{incident:current.armed.id,delivery:current.armed.delivery||'incident',reason:'released',text:'The day turned eventful on its own, and the teased pressure dissolves.'},[tx.pack.playerId]);
 tx.set(path,{...current,...rollover,tension,quiet,armed:kept});
}
export const director={id:'story.director',version:'0.1.0',coreApi:'0.1.0',requires:['story.scenes'],
 actions(s,p){const st=s.modules['story.director'],offers=(st?.offers||[]).filter(o=>!o.accepted);if(!offers.length)return [];
  const seen=new Set(),out=[];
  for(const o of offers){if(seen.has(o.scene))continue;seen.add(o.scene);
   const scene=(p.scriptedScenes||[]).find(x=>x.id===o.scene);if(!scene)continue;
   const reasons=conditionReasons(scene.when,s,p,scene.pages),location=scene.when?.location||s.actors[p.playerId].location,who=[...new Set((scene.pages||[]).map(x=>x.speaker).filter(Boolean))].slice(0,3).map(id=>p.actors.find(a=>a.id===id)?.name||id);
   out.push({label:scene.title,type:'story.startOfferedScene',args:{scene:scene.id},storylet:{title:scene.title,who,where:p.locations.find(l=>l.id===location)?.name||location,timeCost:scene.timeCost??p.daypart?.interval??1,hint:scene.offerHint||''},...(reasons.length?{disabledReason:scene.offerHint||reasons.join('; ')}:{})});}
  return out;},
 validate(p){
  const profile=p.directorProfile;if(profile===undefined)return;
  assert(profile&&typeof profile==='object'&&!Array.isArray(profile),'directorProfile: expected an object');
  assert(profile.preset===undefined||Object.hasOwn(PRESETS,profile.preset),'directorProfile.preset: expected cassandra, randy or phoebe');
  assert(profile.adaptive===undefined||typeof profile.adaptive==='boolean','directorProfile.adaptive: expected boolean');
  assert(profile.toneCeiling===undefined||profile.toneCeiling===''||Object.hasOwn(TONE_LEVELS,profile.toneCeiling),'directorProfile.toneCeiling: expected no ceiling, grounded, soap or melodrama');
  assert(profile.textMode===undefined||['authored','draft'].includes(profile.textMode),'directorProfile.textMode: expected authored or draft');
  const settings=settingsOf(profile);
  for(const [k,lo,hi] of [['quietDayparts',1,20],['earlyChancePercent',0,100],['jitter',0,50],['escalationDays',1,100],['decayPerTick',0,20],['activeThreshold',0,100],['maxPerDay',1,5],['firstTick',0,100000],['opportunityChancePercent',0,100],['interruptionChancePercent',0,100],['opportunitiesPerDay',1,10],['stallTurns',2,50]])assert(Number.isInteger(settings[k])&&settings[k]>=lo&&settings[k]<=hi,`directorProfile.${k}: expected an integer from ${lo} to ${hi}`);
  assert(Array.isArray(profile.tensionEvents||[])&&(profile.tensionEvents||[]).length<=20,'directorProfile.tensionEvents: expected up to 20 entries');
  for(const t of profile.tensionEvents||[]){
   assert(typeof t.event==='string'&&t.event&&t.event!=='core.patch'&&!['core.timeAdvanced','story.incident'].includes(t.event),'directorProfile.tensionEvents.event: invalid');
   assert(Object.entries(t.match||{}).every(([k,v])=>safeKey(k)&&['string','number','boolean'].includes(typeof v)),'directorProfile.tensionEvents.match: invalid');
   assert(Number.isInteger(t.weight)&&t.weight!==0&&Math.abs(t.weight)<=50,'directorProfile.tensionEvents.weight: expected a nonzero integer from -50 to 50');
  }
  const ids=new Set(),activities=new Set((p.activities||[]).map(a=>a.id));
  assert(Array.isArray(profile.complications||[])&&(profile.complications||[]).length<=(profile.adaptive?200:30),`directorProfile.complications: expected up to ${profile.adaptive?200:30}`);
  for(const c of profile.complications||[]){
   assert(safeKey(c.id)&&!ids.has(c.id),`director complication ${c.id}: invalid or duplicate ID`);ids.add(c.id);
   const scene=(p.scriptedScenes||[]).find(x=>x.id===c.scene);
   assert(scene,`director complication ${c.id}: unknown scripted scene`);
   assert(scene.trigger?.event==='story.incident'&&scene.trigger?.match?.incident===c.id,`director complication ${c.id}: its scene must trigger on story.incident matching this ID`);
   assert(scene.offer!=='hand'&&!scene.storylet&&scene.offer!=='director',`director complication ${c.id}: complication scenes are director-fired, not offered`);
   if((c.maxUses??1)>1)assert(scene.repeatable,`director complication ${c.id}: the scene must be repeatable for more than one use`);
   assert(c.kind===undefined||typeof c.kind==='string'&&c.kind.trim()&&c.kind.length<=40,`director complication ${c.id}.kind: up to 40 characters`);
   assert(c.tone===undefined||Number.isInteger(c.tone)&&c.tone>=1&&c.tone<=3,`director complication ${c.id}.tone: expected 1–3`);
   assert(c.template===undefined||safeKey(c.template),`director complication ${c.id}.template: invalid`);
   assert(c.focus===undefined||p.actors.some(x=>x.id===c.focus&&x.id!==p.playerId),`director complication ${c.id}.focus: unknown character`);
   assert(Number.isInteger(c.intensity??1)&&(c.intensity??1)>=1&&(c.intensity??1)<=3,`director complication ${c.id}.intensity: expected 1–3`);
   assert(Number.isInteger(c.weight??10)&&(c.weight??10)>=0&&(c.weight??10)<=100,`director complication ${c.id}.weight: expected 0–100`);
   for(const [k,lo,hi] of [['minTick',0,100000],['cooldownTicks',0,100000],['maxUses',1,10]])assert(c[k]===undefined||Number.isInteger(c[k])&&c[k]>=lo&&c[k]<=hi,`director complication ${c.id}.${k}: expected an integer from ${lo} to ${hi}`);
   if(c.when)validateConditions(c.when,p,`director complication ${c.id}.when`);
   assert(c.text===undefined||typeof c.text==='string'&&c.text.length<=200,`director complication ${c.id}.text: up to 200 characters`);
   assert(c.tease===undefined||typeof c.tease==='string'&&c.tease.trim()&&c.tease.length<=200,`director complication ${c.id}.tease: up to 200 characters`);
  }
  for(const c of [...(profile.complications||[]),...(profile.opportunities||[])]){const m=c.goal?.missed;if(!m)continue;assert(['none','relationship','opportunity'].includes(m.kind),`director ${c.id}.goal.missed.kind: expected none, relationship or opportunity`);assert(m.kind==='none'||Number.isInteger(m.cost)&&m.cost>=1,`director ${c.id}.goal.missed.cost: expected an integer of 1 or more (use kind "none" for no consequence)`);}
  assert(Array.isArray(profile.opportunities||[])&&(profile.opportunities||[]).length<=(profile.adaptive?200:30),`directorProfile.opportunities: expected up to ${profile.adaptive?200:30}`);
  for(const c of profile.opportunities||[]){
   assert(safeKey(c.id)&&!ids.has(c.id),`director opportunity ${c.id}: invalid or duplicate ID`);ids.add(c.id);
   const scene=(p.scriptedScenes||[]).find(x=>x.id===c.scene);
   assert(scene,`director opportunity ${c.id}: unknown scripted scene`);
   assert(scene.offer==='director',`director opportunity ${c.id}: its scene must set offer:"director" (dealt as a choosable action, never auto-triggered)`);
   assert(scene.trigger?.event!=='story.incident',`director opportunity ${c.id}: its scene must not trigger on story.incident`);
   if((c.maxUses??1)>1)assert(scene.repeatable,`director opportunity ${c.id}: the scene must be repeatable for more than one use`);
   assert(c.kind===undefined||typeof c.kind==='string'&&c.kind.trim()&&c.kind.length<=40,`director opportunity ${c.id}.kind: up to 40 characters`);
   assert(c.tone===undefined||Number.isInteger(c.tone)&&c.tone>=1&&c.tone<=3,`director opportunity ${c.id}.tone: expected 1–3`);
   assert(c.template===undefined||safeKey(c.template),`director opportunity ${c.id}.template: invalid`);
   assert(c.focus===undefined||p.actors.some(x=>x.id===c.focus&&x.id!==p.playerId),`director opportunity ${c.id}.focus: unknown character`);
   assert(Number.isInteger(c.weight??10)&&(c.weight??10)>=0&&(c.weight??10)<=100,`director opportunity ${c.id}.weight: expected 0–100`);
   for(const [k,lo,hi] of [['minTick',0,100000],['cooldownTicks',0,100000],['maxUses',1,10]])assert(c[k]===undefined||Number.isInteger(c[k])&&c[k]>=lo&&c[k]<=hi,`director opportunity ${c.id}.${k}: expected an integer from ${lo} to ${hi}`);
   if(c.when)validateConditions(c.when,p,`director opportunity ${c.id}.when`);
   if(c.match!==undefined)assert(c.match&&typeof c.match==='object'&&!Array.isArray(c.match)&&Object.keys(c.match).length===1&&safeKey(c.match.activity)&&activities.has(c.match.activity),`director opportunity ${c.id}.match: expected {activity:"<authored activity id>"}`);
   assert(c.text===undefined||typeof c.text==='string'&&c.text.length<=200,`director opportunity ${c.id}.text: up to 200 characters`);
  }
 },
 init:()=>({tension:0,quiet:0,uses:{},lastUse:{},recent:[],fired:0,lastDay:null,firedToday:0,armed:null,lastTick:null,lastKind:null,offers:[],offersDay:null,oToday:0,oLastDay:null,oUses:{},oLastUse:{},oRecent:[],setbacks:0,attention:{},lastFocus:null,breatherNext:false,owed:null,escalated:{},notes:[],stall:0}),
 react,
 panel(s,p){const profile=profileOf(p),st=s.modules['story.director'];if(!profile)return {title:'Drama director',lines:['No director profile; the module idles.']};
  const settings=settingsOf(profile),cal=calendarFor(s.tick,p),tier=tierOf(settings,cal);
  const lines=[`Tension ${st.tension}/100 · quiet dayparts ${st.quiet}/${settings.quietDayparts} · drama tier ${tier} · incidents fired ${st.fired}`];
  if(st.armed)lines.push(`Teased: ${st.armed.id} — fires if the next daypart stays quiet.`);
  if(st.owed)lines.push(`Ignored: ${st.owed.id} — comes back harder (tone ${st.owed.tone}) at the next quiet boundary.`);
  if((st.notes||[]).length)lines.push(`Consequence notes: ${st.notes.map(n=>`${n.incident} ${n.text}`).join(' · ')}`);
  for(const c of profile.complications||[]){const last=st.lastUse[c.id],cool=last!=null&&s.tick-last<(c.cooldownTicks??0);
   lines.push(`${c.id} (${c.kind||'complication'}, intensity ${c.intensity??1}): used ${(st.uses[c.id]||0)}/${c.maxUses??1}${cool?` · cooling down for ${(c.cooldownTicks??0)-(s.tick-last)} tick(s)`:''}${(st.uses[c.id]||0)>=(c.maxUses??1)?' · spent':''}${st.recent.includes(c.id)?' · recently played':''}`);}
  if((profile.opportunities||[]).length)lines.push(`Events on offer: ${(st.offers||[]).filter(o=>!o.accepted).map(o=>o.id).join(', ')||'none'} · dealt today ${cal.day===st.oLastDay?st.oToday||0:0}/${settings.opportunitiesPerDay}`);
  for(const c of profile.opportunities||[]){const last=st.oLastUse?.[c.id],cool=last!=null&&s.tick-last<(c.cooldownTicks??0);
   lines.push(`${c.id} (${c.match?.activity?`after ${c.match.activity}`:'offered on quiet dayparts'}): played ${(st.oUses||{})[c.id]||0}/${c.maxUses??1}${cool?` · cooling down for ${(c.cooldownTicks??0)-(s.tick-last)} tick(s)`:''}`);}
  return {title:'Drama director',lines};}
};
