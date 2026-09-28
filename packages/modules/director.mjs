import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {conditionReasons,validateConditions} from './conditions.mjs';

// F8 drama director, in the spirit of the Left 4 Dead AI Director and RimWorld storytellers: the engine, not
// the model, decides when drama lands. Tension rises with eventful play and decays with the clock; a streak of
// quiet dayparts draws one authored complication scene through the existing story scene queue. The director only
// times the beat — every complication is an authored scripted scene triggered by the story.incident event.
// The mirror side: quiet dayparts can also deal authored event actions (offer:"director" scenes the player
// chooses to spend a whole daypart on) that pay stats, money, loot or affection, and finishing an authored
// activity can deal one tied to it. Dealing never costs a model call and never forces a scene on the player.
const path=['modules','story.director'];
// Storyteller presets (RimWorld): cassandra paces steadily, randy rolls early whims, phoebe needs deeper quiet.
const BASE={quietDayparts:2,earlyChancePercent:0,jitter:10,escalationDays:3,decayPerTick:3,activeThreshold:25,maxPerDay:1,firstTick:8};
export const PRESETS={
 cassandra:BASE,
 randy:{...BASE,quietDayparts:1,earlyChancePercent:20,jitter:35,escalationDays:2},
 phoebe:{...BASE,quietDayparts:3,escalationDays:4,decayPerTick:2}
};
export const settingsOf=profile=>({...BASE,opportunityChancePercent:0,interruptionChancePercent:0,opportunitiesPerDay:2,...PRESETS[profile?.preset||'cassandra'],...profile});
// Default tension weights for events that mean "something happened"; authored tensionEvents add on top, so a
// pack can calm specific events (neglectDefused) or prize its own story beats.
export const TENSION_DEFAULTS={'story.choiceResolved':8,'core.sceneStarted':4,'world.hangoutStarted':6,'social.relationshipChanged':5,'social.romancePointsChanged':5,'social.jealousyTriggered':15,'social.neglectDetonated':12,'social.consentDeclined':10,'story.planBroken':10,'social.rumorCreated':5,'social.rumorBelieved':6,'story.sceneEvicted':4,'social.giftLimitReached':4,'social.neglectDefused':-8};
const clampTension=v=>Math.max(0,Math.min(100,v));
const profileOf=p=>p.directorProfile||null;
// Wildermyth-style escalation: heavier drama unlocks as campaign days pass (day 1 → tier 1, then +1 per escalationDays).
const tierOf=(settings,cal)=>1+Math.min(2,Math.floor((cal.day-1)/settings.escalationDays));
// Weighted draw with a no-immediate-repeat penalty; jitter consumes the campaign RNG once per candidate, so seeded runs replay exactly.
const bestOf=(pool,tx,settings,deck)=>{let best=null;for(const {c} of pool){const score=(c.weight??10)+settings.jitter*tx.random()-(deck.recent.includes(c.id)?8:0);if(!best||score>best.score)best={c,score};}return best?best.c:null;};
// Deck bookkeeping is per role: complications count in uses/lastUse/recent, dealt events in the o- prefixed trio.
const deckOf=(current,prefix)=>prefix?{uses:current[prefix+'Uses']||{},lastUse:current[prefix+'LastUse']||{},recent:current[prefix+'Recent']||[]}:{uses:current.uses||{},lastUse:current.lastUse||{},recent:current.recent||[]};
const budgetLeft=(current,settings,cal)=>(cal.day===current.oLastDay?current.oToday||0:0)<settings.opportunitiesPerDay;
function eligible(tx,entries,settings,cal,tier,deck){
 const st=tx.state.modules['story.scenes'];
 return entries.map((c,i)=>({c,i})).filter(({c})=>{
  const scene=tx.pack.scriptedScenes.find(x=>x.id===c.scene),last=deck.lastUse[c.id];
  return scene&&(deck.uses[c.id]||0)<(c.maxUses??1)&&!(c.minTick&&tx.state.tick<c.minTick)
   &&(last==null||tx.state.tick-last>=(c.cooldownTicks??0))&&(c.intensity??1)<=tier
   &&!conditionReasons(c.when,tx.state,tx.pack).length&&!conditionReasons(scene.when,tx.state,tx.pack,scene.pages).length
   &&(scene.repeatable||!st.completed.includes(scene.id))&&!(st.queue||[]).some(x=>x.scene===scene.id);
 });
}
// Deal one authored event action into state.offers: it shows up as a choosable action (startOfferedScene) whose
// timeCost is the scene's — a whole daypart by design. Offers expire at dawn; taking one counts its uses.
const deal=(tx,current,settings,cal,entries,deck,extra)=>{
 const pool=eligible(tx,entries,settings,cal,tierOf(settings,cal),deck).filter(({c})=>extra(c)&&!(current.offers||[]).some(o=>o.id===c.id));
 const pick=bestOf(pool,tx,settings,deck);if(!pick)return false;
 tx.set(path,{...current,offers:[...(current.offers||[]),{id:pick.id,scene:pick.scene}],offersDay:cal.day,oLastDay:cal.day,oToday:(cal.day===current.oLastDay?current.oToday||0:0)+1});
 return true;
};
// What the rest of the game may know about the drama schedule: derived only from committed state, costs nothing.
export function directorContext(s,p){
 const profile=profileOf(p),st=s.modules['story.director'];if(!profile||!st)return null;
 const settings=settingsOf(profile),cal=calendarFor(s.tick,p);
 return {tension:st.tension,quiet:st.quiet,needed:settings.quietDayparts,tier:tierOf(settings,cal),...(st.armed?{armed:st.armed.id}:{}),...(st.lastTick!=null&&s.tick-st.lastTick<=(p.daypart?.interval||4)?{freshKind:st.lastKind}:{})};
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
 const current=tx.state.modules['story.director'],settings=settingsOf(profile);
 // Taking a dealt event marks it accepted and counts the play: uses, cooldowns and the no-immediate-repeat penalty.
 if(event.type==='story.sceneSelected'){
  const hit=(current.offers||[]).find(o=>o.scene===event.payload.scene&&!o.accepted);
  if(hit){const deck=deckOf(current,'o');tx.set(path,{...current,offers:current.offers.map(o=>o===hit?{...o,accepted:true}:o),oUses:{...deck.uses,[hit.id]:(deck.uses[hit.id]||0)+1},oLastUse:{...deck.lastUse,[hit.id]:tx.state.tick},oRecent:[...deck.recent,hit.id].slice(-5)});}
  return;
 }
 // Work interrupts: finishing an authored activity can deal one event tied to it (match.activity) while the day has budget.
 if(event.type==='world.activityCompleted'){
  const st=tx.state.modules['story.scenes'],cal=calendarFor(tx.state.tick,tx.pack);
  if(st&&!st.pending&&tx.state.tick>=settings.firstTick&&settings.interruptionChancePercent>0&&budgetLeft(current,settings,cal)&&tx.random()*100<settings.interruptionChancePercent)
   deal(tx,current,settings,cal,profile.opportunities||[],deckOf(current,'o'),c=>c.match?.activity===event.payload.activity);
  return;
 }
 // Authored scenes can weight their own beats: scene.tension replaces the flat default when that scene resolves.
 const sceneTension=(tx.pack.scriptedScenes||[]).find(x=>x.id===event.payload?.scene)?.tension;
 const bump=(event.type==='story.choiceResolved'?(sceneTension??TENSION_DEFAULTS[event.type]??0):(TENSION_DEFAULTS[event.type]??0))+(profile.tensionEvents||[]).filter(x=>x.event===event.type&&Object.entries(x.match||{}).every(([k,v])=>event.payload[k]===v)).reduce((n,x)=>n+x.weight,0);
 if(event.type!=='core.timeAdvanced'){if(bump)tx.set(path,{...current,tension:clampTension(current.tension+bump)});return;}
 // The clock settles the daypart: tension decays over the elapsed ticks, then each crossed boundary counts as
 // quiet when what is left of tension sits below the threshold. Waiting IS quiet, so long rests invite drama.
 const {from,to}=event.payload,interval=tx.pack.daypart?.interval||4,cal=calendarFor(to,tx.pack);
 const tension=clampTension(current.tension-settings.decayPerTick*(to-from)),crossed=Math.floor(to/interval)-Math.floor(from/interval);
 let quiet=current.quiet;
 // Dealt event actions are today's: they expire at dawn, and a new day draws from a fresh budget.
 const rollover=crossed>0&&cal.day!==current.offersDay?{offers:[],offersDay:cal.day}:{};
 if(crossed>0){
  quiet=tension<settings.activeThreshold?current.quiet+crossed:0;
  const st=tx.state.modules['story.scenes'],dayOk=cal.day!==current.lastDay||current.firedToday<settings.maxPerDay;
  const ready=st&&!st.pending&&tx.state.tick>=settings.firstTick&&dayOk;
  // An eventful daypart also forgets the tease: the pressure released elsewhere, the armed beat returns to the deck.
  const armed=tension<settings.activeThreshold?current.armed:null;
  // Randy's whim: even an eventful daypart can turn on a low roll, the way a storyteller interrupts a good streak.
  const early=ready&&settings.earlyChancePercent>0&&tx.random()*100<settings.earlyChancePercent;
  const cdeck=deckOf(current,''),odeck=deckOf(current,'o');
  if(ready&&(quiet>=settings.quietDayparts||early)){
   const pool=eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),cdeck);
   const pick=armed?pool.find(x=>x.c.id===armed.id)?.c??bestOf(pool,tx,settings,cdeck):bestOf(pool,tx,settings,cdeck);
   if(pick){
    tx.emit('story.incident',{incident:pick.id,scene:pick.scene,kind:pick.kind||'complication',intensity:pick.intensity??1,mode:early?'whim':'quiet',armed:Boolean(armed&&armed.id===pick.id),tension,quiet,text:pick.text||'Something is about to happen.'},[tx.pack.playerId]);
    tx.set(path,{...current,...rollover,tension,quiet:0,armed:null,uses:{...cdeck.uses,[pick.id]:(cdeck.uses[pick.id]||0)+1},lastUse:{...cdeck.lastUse,[pick.id]:tx.state.tick},recent:[...cdeck.recent,pick.id].slice(-5),fired:current.fired+1,lastDay:cal.day,firedToday:cal.day===current.lastDay?current.firedToday+1:1,lastTick:tx.state.tick,lastKind:pick.kind||'complication'});
    return;
   }
   // The deck is empty or fully gated: say so once per streak so playtests can measure dry spells (F12).
   if(quiet===settings.quietDayparts)tx.emit('story.starved',{quiet,text:'Every complication is spent or gated; the drama director has nothing to draw.'},[]);
  }else if(ready&&quiet===settings.quietDayparts-1&&settings.quietDayparts>=2&&crossed===1&&!armed){
   // Pre-commit the draw one daypart early and tell the player: the teased beat is the beat that fires, so the
   // warning is honest and the genre's "teased next event" staple comes for free.
   const pick=bestOf(eligible(tx,profile.complications||[],settings,cal,tierOf(settings,cal),cdeck),tx,settings,cdeck);
   if(pick){tx.emit('story.teaser',{incident:pick.id,kind:pick.kind||'complication',text:pick.tease||'Something is about to happen.',quiet},[tx.pack.playerId]);tx.set(path,{...current,...rollover,tension,quiet,armed:{id:pick.id}});return;}
  }
  // The mirror: a dull daypart (tension under the threshold, drama not due) may deal one authored event action —
  // stats, money, loot or affection the player chooses to chase instead of whatever they were doing.
  if(ready&&quiet>0&&tension<settings.activeThreshold&&settings.opportunityChancePercent>0&&budgetLeft(current,settings,cal)&&tx.random()*100<settings.opportunityChancePercent){
   if(deal(tx,{...current,tension,quiet,armed,...rollover},settings,cal,profile.opportunities||[],odeck,c=>!c.match?.activity))return;
  }
 }
 tx.set(path,{...current,...rollover,tension,quiet,armed:tension<settings.activeThreshold?current.armed:null});
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
  const settings=settingsOf(profile);
  for(const [k,lo,hi] of [['quietDayparts',1,20],['earlyChancePercent',0,100],['jitter',0,50],['escalationDays',1,100],['decayPerTick',0,20],['activeThreshold',0,100],['maxPerDay',1,5],['firstTick',0,100000],['opportunityChancePercent',0,100],['interruptionChancePercent',0,100],['opportunitiesPerDay',1,10]])assert(Number.isInteger(settings[k])&&settings[k]>=lo&&settings[k]<=hi,`directorProfile.${k}: expected an integer from ${lo} to ${hi}`);
  assert(Array.isArray(profile.tensionEvents||[])&&(profile.tensionEvents||[]).length<=20,'directorProfile.tensionEvents: expected up to 20 entries');
  for(const t of profile.tensionEvents||[]){
   assert(typeof t.event==='string'&&t.event&&t.event!=='core.patch'&&!['core.timeAdvanced','story.incident'].includes(t.event),'directorProfile.tensionEvents.event: invalid');
   assert(Object.entries(t.match||{}).every(([k,v])=>safeKey(k)&&['string','number','boolean'].includes(typeof v)),'directorProfile.tensionEvents.match: invalid');
   assert(Number.isInteger(t.weight)&&t.weight!==0&&Math.abs(t.weight)<=50,'directorProfile.tensionEvents.weight: expected a nonzero integer from -50 to 50');
  }
  const ids=new Set(),activities=new Set((p.activities||[]).map(a=>a.id));
  assert(Array.isArray(profile.complications||[])&&(profile.complications||[]).length<=30,'directorProfile.complications: expected up to 30');
  for(const c of profile.complications||[]){
   assert(safeKey(c.id)&&!ids.has(c.id),`director complication ${c.id}: invalid or duplicate ID`);ids.add(c.id);
   const scene=(p.scriptedScenes||[]).find(x=>x.id===c.scene);
   assert(scene,`director complication ${c.id}: unknown scripted scene`);
   assert(scene.trigger?.event==='story.incident'&&scene.trigger?.match?.incident===c.id,`director complication ${c.id}: its scene must trigger on story.incident matching this ID`);
   assert(scene.offer!=='hand'&&!scene.storylet&&scene.offer!=='director',`director complication ${c.id}: complication scenes are director-fired, not offered`);
   if((c.maxUses??1)>1)assert(scene.repeatable,`director complication ${c.id}: the scene must be repeatable for more than one use`);
   assert(c.kind===undefined||typeof c.kind==='string'&&c.kind.trim()&&c.kind.length<=40,`director complication ${c.id}.kind: up to 40 characters`);
   assert(Number.isInteger(c.intensity??1)&&(c.intensity??1)>=1&&(c.intensity??1)<=3,`director complication ${c.id}.intensity: expected 1–3`);
   assert(Number.isInteger(c.weight??10)&&(c.weight??10)>=0&&(c.weight??10)<=100,`director complication ${c.id}.weight: expected 0–100`);
   for(const [k,lo,hi] of [['minTick',0,100000],['cooldownTicks',0,100000],['maxUses',1,10]])assert(c[k]===undefined||Number.isInteger(c[k])&&c[k]>=lo&&c[k]<=hi,`director complication ${c.id}.${k}: expected an integer from ${lo} to ${hi}`);
   if(c.when)validateConditions(c.when,p,`director complication ${c.id}.when`);
   assert(c.text===undefined||typeof c.text==='string'&&c.text.length<=200,`director complication ${c.id}.text: up to 200 characters`);
   assert(c.tease===undefined||typeof c.tease==='string'&&c.tease.trim()&&c.tease.length<=200,`director complication ${c.id}.tease: up to 200 characters`);
  }
  assert(Array.isArray(profile.opportunities||[])&&(profile.opportunities||[]).length<=30,'directorProfile.opportunities: expected up to 30');
  for(const c of profile.opportunities||[]){
   assert(safeKey(c.id)&&!ids.has(c.id),`director opportunity ${c.id}: invalid or duplicate ID`);ids.add(c.id);
   const scene=(p.scriptedScenes||[]).find(x=>x.id===c.scene);
   assert(scene,`director opportunity ${c.id}: unknown scripted scene`);
   assert(scene.offer==='director',`director opportunity ${c.id}: its scene must set offer:"director" (dealt as a choosable action, never auto-triggered)`);
   assert(scene.trigger?.event!=='story.incident',`director opportunity ${c.id}: its scene must not trigger on story.incident`);
   if((c.maxUses??1)>1)assert(scene.repeatable,`director opportunity ${c.id}: the scene must be repeatable for more than one use`);
   assert(c.kind===undefined||typeof c.kind==='string'&&c.kind.trim()&&c.kind.length<=40,`director opportunity ${c.id}.kind: up to 40 characters`);
   assert(Number.isInteger(c.weight??10)&&(c.weight??10)>=0&&(c.weight??10)<=100,`director opportunity ${c.id}.weight: expected 0–100`);
   for(const [k,lo,hi] of [['minTick',0,100000],['cooldownTicks',0,100000],['maxUses',1,10]])assert(c[k]===undefined||Number.isInteger(c[k])&&c[k]>=lo&&c[k]<=hi,`director opportunity ${c.id}.${k}: expected an integer from ${lo} to ${hi}`);
   if(c.when)validateConditions(c.when,p,`director opportunity ${c.id}.when`);
   if(c.match!==undefined)assert(c.match&&typeof c.match==='object'&&!Array.isArray(c.match)&&Object.keys(c.match).length===1&&safeKey(c.match.activity)&&activities.has(c.match.activity),`director opportunity ${c.id}.match: expected {activity:"<authored activity id>"}`);
   assert(c.text===undefined||typeof c.text==='string'&&c.text.length<=200,`director opportunity ${c.id}.text: up to 200 characters`);
  }
 },
 init:()=>({tension:0,quiet:0,uses:{},lastUse:{},recent:[],fired:0,lastDay:null,firedToday:0,armed:null,lastTick:null,lastKind:null,offers:[],offersDay:null,oToday:0,oLastDay:null,oUses:{},oLastUse:{},oRecent:[]}),
 react,
 panel(s,p){const profile=profileOf(p),st=s.modules['story.director'];if(!profile)return {title:'Drama director',lines:['No director profile; the module idles.']};
  const settings=settingsOf(profile),cal=calendarFor(s.tick,p),tier=tierOf(settings,cal);
  const lines=[`Tension ${st.tension}/100 · quiet dayparts ${st.quiet}/${settings.quietDayparts} · drama tier ${tier} · incidents fired ${st.fired}`];
  if(st.armed)lines.push(`Teased: ${st.armed.id} — fires if the next daypart stays quiet.`);
  for(const c of profile.complications||[]){const last=st.lastUse[c.id],cool=last!=null&&s.tick-last<(c.cooldownTicks??0);
   lines.push(`${c.id} (${c.kind||'complication'}, intensity ${c.intensity??1}): used ${(st.uses[c.id]||0)}/${c.maxUses??1}${cool?` · cooling down for ${(c.cooldownTicks??0)-(s.tick-last)} tick(s)`:''}${(st.uses[c.id]||0)>=(c.maxUses??1)?' · spent':''}${st.recent.includes(c.id)?' · recently played':''}`);}
  if((profile.opportunities||[]).length)lines.push(`Events on offer: ${(st.offers||[]).filter(o=>!o.accepted).map(o=>o.id).join(', ')||'none'} · dealt today ${cal.day===st.oLastDay?st.oToday||0:0}/${settings.opportunitiesPerDay}`);
  for(const c of profile.opportunities||[]){const last=st.oLastUse?.[c.id],cool=last!=null&&s.tick-last<(c.cooldownTicks??0);
   lines.push(`${c.id} (${c.match?.activity?`after ${c.match.activity}`:'offered on quiet dayparts'}): played ${(st.oUses||{})[c.id]||0}/${c.maxUses??1}${cool?` · cooling down for ${(c.cooldownTicks??0)-(s.tick-last)} tick(s)`:''}`);}
  return {title:'Drama director',lines};}
};
