import {assert} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {changeChemistry} from './dating.mjs';

// C1 anniversaries (T-032, steal 5): the relationship remembers itself. Moments are stamped from committed dating
// events only, every interval days from the dating anchor the scene prompt gets the N-month mark plus up to two
// shared moments. The engine owns the clock, the reward and the neglect penalty; nothing here calls the model.
const path=['modules','social.anniversary'];
const PINNED=['firstMeeting','firstDate'];  // the anchor of the whole history: never trimmed
const SAY={firstMeeting:'you met',firstDate:'your first date',firstKiss:'your first kiss',firstNight:'your first night',stageChange:'you changed labels',breakup:'the breakup',reunion:'the reunion'};
const TOPICS={firstMeeting:['met','meet','first time'],firstDate:['date'],firstKiss:['kiss'],firstNight:['night','bed'],stageChange:['relationship','official','label','commit'],breakup:['breakup','broke up','split','apart'],reunion:['reconcile','back together']};
const INTIMATE={kiss:'firstKiss',night:'firstNight'};
// Any committed contact with her counts as contact on the anniversary day, not just a typed line.
const CONTACT={'social.spoke':(q,c)=>q.target===c,'core.sceneStarted':(q,c)=>(q.characters||[]).includes(c),'social.dateAccepted':(q,c)=>q.character===c,'social.defineRelationship':(q,c)=>q.character===c,'social.reconciliationAccepted':(q,c)=>q.character===c};

const runtimeOf=(s,c)=>s.modules['social.anniversary']?.characters?.[c];
const dayOf=(tick,p)=>calendarFor(tick,p).day;
const intervalOf=p=>p.anniversarySettings.interval;
const maxOf=p=>p.anniversarySettings.maxMoments;
const placeOf=(s,p,id)=>p.locations?.find(l=>l.id===s.actors[id]?.location)?.name||null;
// Broken bonds celebrate nothing: the anchor only counts while the relationship is actually live.
const live=(s,c)=>['dating','exclusive'].includes(s.modules['social.dating']?.characters?.[c]?.phase);
const ordinal=n=>n===1?'1st':n===2?'2nd':n===3?'3rd':`${n}th`;

// The N-month mark that falls on `day`, or 0. One function so the prompt, the action and the penalty agree.
function markAt(s,p,c,day){const r=runtimeOf(s,c),start=r?.datingStartDay;if(start===null||start===undefined||!live(s,c))return 0;const span=day-start,every=intervalOf(p);return span>0&&span%every===0?span/every:0;}
const markNow=(s,p,c)=>markAt(s,p,c,dayOf(s.tick,p));
const together=(s,p,c)=>{const r=runtimeOf(s,c),start=r?.datingStartDay;return start===null||start===undefined?0:Math.floor((dayOf(s.tick,p)-start)/intervalOf(p));};

// Newest last, the two anchors pinned first; over the cap the oldest unpinned moment goes.
function addMoment(tx,c,kind,extra={}){
  const r=runtimeOf(tx.state,c),now=dayOf(tx.state.tick,tx.pack),place=placeOf(tx.state,tx.pack,c);
  const moment={kind,day:now,place:place||'somewhere',...extra};
  const pinned=r.history.filter(m=>PINNED.includes(m.kind)),recent=r.history.filter(m=>!PINNED.includes(m.kind));
  // Pinned anchors lead in their original order; everything else is a recency window that drops off the oldest first.
  const head=PINNED.includes(moment.kind)?[...pinned,moment]:pinned,tail=PINNED.includes(moment.kind)?recent:[...recent,moment];
  tx.set([...path,'characters',c,'history'],[...head,...tail.slice(-Math.max(0,maxOf(tx.pack)-head.length))]);
}
const contact=(tx,c)=>tx.set([...path,'characters',c,'lastContactDay'],dayOf(tx.state.tick,tx.pack));

function ago(today,day,every){const n=Math.round((today-day)/every);return n<1?'Today':`${n} month${n===1?'':'s'} ago`;}
const momentLine=(s,p,m)=>`${ago(dayOf(s.tick,p),m.day,intervalOf(p))} at ${m.place} ${SAY[m.kind]||m.kind}.`;

// One shared moment on an ordinary day, but only where it fits: her place, or what was just talked about.
function relevant(s,p,c,input){
  const history=[...(runtimeOf(s,c)?.history||[])].reverse();
  const here=placeOf(s,p,p.playerId),topic=String(input||'').toLowerCase();
  return history.find(m=>here&&m.place===here)||(topic?history.find(m=>TOPICS[m.kind]?.some(w=>topic.includes(w))):null);
}

// The prompt block: one short string for today's mark, one for shared history. Injected, never a replacement.
export function anniversaryBrief(s,p,actorId,input=''){
  if(!p.anniversarySettings||!s.modules['social.anniversary'])return null;
  let mark=null,history=null;
  for(const c of Object.keys(s.modules['social.anniversary'].characters)){
    if(actorId!==p.playerId&&actorId!==c)continue;
    if(!live(s,c))continue;               // a broken bond celebrates nothing and shares nothing
    const n=markNow(s,p,c);
    if(n){const r=runtimeOf(s,c);mark=`Today is your ${n}-month mark with ${s.actors[c].name}${r.anniversaryAcknowledged===dayOf(s.tick,p)?'; you already marked it together.':'.'}`;
     history=(r.history||[]).slice(-2).map(m=>momentLine(s,p,m)).join(' ')||null;continue;}
    // No mark today: one moment at most, and only where the place or what the player just said actually fits.
    const moment=relevant(s,p,c,input);
    if(moment)history=momentLine(s,p,moment);
  }
  if(!mark&&!history)return null;
  return {...(mark?{anniversary:mark}:{}),...(history?{sharedHistory:history}:{})};
}

export const anniversary={id:'social.anniversary',version:'0.1.0',coreApi:'0.1.0',requires:['social.dating'],
 validate(p){
  const settings=p.anniversarySettings;if(settings===undefined)return;  // a missing field is legacy behaviour: no marks, no ledger
  assert(settings&&typeof settings==='object'&&!Array.isArray(settings),'anniversary settings invalid');
  assert(Number.isInteger(settings.interval)&&settings.interval>=7&&settings.interval<=365,'anniversary interval invalid');
  assert(Number.isInteger(settings.maxMoments)&&settings.maxMoments>=1&&settings.maxMoments<=20,'anniversary maxMoments invalid');
  assert(settings.acknowledgeReward===undefined||settings.acknowledgeReward&&Number.isInteger(settings.acknowledgeReward.like)&&settings.acknowledgeReward.like>=0&&settings.acknowledgeReward.like<=100,'anniversary acknowledge reward invalid');
  assert(settings.neglectPenalty===undefined||settings.neglectPenalty&&Number.isInteger(settings.neglectPenalty.like)&&settings.neglectPenalty.like<=0&&settings.neglectPenalty.like>=-100,'anniversary neglect penalty invalid');
 },
 init(p){
  if(!p.anniversarySettings)return {characters:{}};  // legacy packs keep their old serialized shape
  const characters={};
  for(const profile of p.datingProfiles||[])characters[profile.character]={history:[],firstMeetingDay:null,datingStartDay:null,lastContactDay:null,anniversaryAcknowledged:null,mark:0,months:0};
  return {characters};
 },
 react(tx,event){
  const {state:s,pack:p}=tx;if(!p.anniversarySettings)return;
  const q=event.payload||{};
  for(const {character} of p.datingProfiles||[]){
   const r=runtimeOf(s,character);if(!r)continue;
   if(CONTACT[event.type]?.(q,character)){contact(tx,character);if(event.type==='social.spoke'&&!r.firstMeetingDay){tx.set([...path,'characters',character,'firstMeetingDay'],dayOf(s.tick,p));addMoment(tx,character,'firstMeeting');}}
   if(event.type==='social.dateAccepted'&&q.character===character){
    if(!r.firstMeetingDay){tx.set([...path,'characters',character,'firstMeetingDay'],dayOf(s.tick,p));addMoment(tx,character,'firstMeeting');}
    if(r.datingStartDay===null){tx.set([...path,'characters',character,'datingStartDay'],dayOf(s.tick,p));addMoment(tx,character,'firstDate');}
   }
   if(event.type==='social.firstCompleted'&&q.character===character&&INTIMATE[q.rung])addMoment(tx,character,INTIMATE[q.rung]);
   if(event.type==='social.datingPhaseChanged'&&q.character===character){
    // Every move into a live stage counts; coming back from broken is the reunion, not a second stage change.
    if(['dating','exclusive'].includes(q.to)&&q.from!=='broken')addMoment(tx,character,'stageChange',{from:q.from,to:q.to});
    if(q.to==='broken'&&['dating','exclusive'].includes(q.from))addMoment(tx,character,'breakup',{from:q.from});
   }
   if(event.type==='social.reconciliationAccepted'&&q.character===character){tx.set([...path,'characters',character,'datingStartDay'],dayOf(s.tick,p));addMoment(tx,character,'reunion');}
   if(event.type==='core.timeAdvanced'){
    // Priced when the anniversary day closes without a word, once per day: waiting through it never double-charges.
    const from=dayOf(q.from,p),today=dayOf(q.to,p);
    if(today>from&&markAt(s,p,character,from)&&r.lastContactDay!==from&&r.anniversaryAcknowledged!==from&&p.anniversarySettings.neglectPenalty)changeChemistry(tx,character,p.anniversarySettings.neglectPenalty.like,'the mark passed without a word');
    tx.set([...path,'characters',character,'mark'],markNow(s,p,character));
    tx.set([...path,'characters',character,'months'],together(s,p,character));
   }
  }
 },
 commands:{'social.acknowledgeAnniversary'(tx,args){
   const {state:s,pack:p}=tx,c=args?.character,r=runtimeOf(s,c);
   assert(p.anniversarySettings,'Anniversaries are not enabled in this pack');assert(r,'Unknown character');
   assert(markNow(s,p,c),'There is no mark today');assert(s.actors[c].location===s.actors[p.playerId].location,`You need to be with ${s.actors[c].name} to mark it`);
   assert(r.anniversaryAcknowledged!==dayOf(s.tick,p),'You already marked this one together');
   contact(tx,c);tx.set([...path,'characters',c,'anniversaryAcknowledged'],dayOf(s.tick,p));
   if(p.anniversarySettings.acknowledgeReward)changeChemistry(tx,c,p.anniversarySettings.acknowledgeReward.like,'you remembered the date');
 }},
 actions(s,p){
  if(!p.anniversarySettings)return [];
  const here=s.actors[p.playerId].location;
  return (p.datingProfiles||[]).filter(({character:c})=>runtimeOf(s,c)?.anniversaryAcknowledged!==dayOf(s.tick,p)&&markNow(s,p,c)&&s.actors[c].location===here).map(({character:c})=>({label:`Mark the date with ${s.actors[c].name}`,type:'social.acknowledgeAnniversary',args:{character:c}}));
 },
 panel(s,p){
  const lines=[];
  if(p.anniversarySettings)for(const {character:c} of p.datingProfiles||[]){
   const r=runtimeOf(s,c);if(!r)continue;
   const mark=markNow(s,p,c),name=s.actors[c].name;
   lines.push(`${name}: ${r.datingStartDay===null?'not dating yet':`${r.months} month${r.months===1?'':'s'} together${mark?` — your ${ordinal(mark)} mark is today`:''}${r.anniversaryAcknowledged===dayOf(s.tick,p)?' ✓ marked together':''}`}`);
   for(const m of (r.history||[]))lines.push(`  • ${ago(dayOf(s.tick,p),m.day,intervalOf(p))} at ${m.place}: ${SAY[m.kind]||m.kind}`);
  }
  return {title:'Anniversaries',lines};
 }};

export {addMoment,markNow,together,momentLine,relevant};