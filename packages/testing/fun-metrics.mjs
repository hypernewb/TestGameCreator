// F12 fun proxies computed from a committed campaign. Pure: reads state.turns/events and the pack, never the model.
// Timing comes from, in order: per-turn seconds the harness measured, `playedAt` stamps the store writes when a
// turn is narrated (human runs), or a reading-speed estimate (visual-novel pacing: ~4 words/s plus a decision).
const NOISE=new Set(['core.timeAdvanced','core.patch','core.waited','core.moved','core.inspected','core.travelBlocked','core.sceneStarted','core.sceneContinued','core.sceneEnded','world.daypartStarted','world.searchedEmpty','world.meetingUnavailable','world.meetingRedirect','world.actorArrived','world.objectExamined','social.spoke','social.threadRead','social.feedRead','story.sceneQueued','story.starved','story.sceneResponded']);
// Spark: small romantic signal (Stardew's heart wiggle). Payoff: a rung the player would tell a friend about.
const SPARK=new Set(['social.chemistryChanged','social.attractionChanged','social.preferenceDiscovered','social.intimacyInterestDiscovered','social.romancePointsChanged']);
const PAYOFF=new Set(['social.crushStarted','social.datingPhaseChanged','social.romanceRankChanged','social.dateAccepted','social.intimacyStarted','social.intimacyCompleted']);
const DRAMA=new Set(['story.incident','social.intimacyExposed','social.encounterDisclosed','social.jealousyTriggered','social.rumorLearned','social.rivalryDiscovered','social.relationshipStrained','social.neglectDetonated']);
const CHOICE=new Set(['story.choose','story.startOfferedScene']);
// Director beats that prove the world dealt drama this daypart (docs/NEXT-MILESTONES.md#fun-gate, "the world is
// never quiet"). A teaser is only a promise and starved is a confession — neither resets the quiet streak; only a
// dealt beat (incident, dealt event, missed goal) does.
const DIRECTOR_BEAT=new Set(['story.incident','story.directorDealt','story.goalMissed']);
// A typed turn "landed" when the game answered the intent itself: a response event that is neither presentation
// noise (NOISE) nor background activity that would have happened anyway (director deals), or a movement the intent
// asked for (core.moved is noise for dead-turn purposes but is a direct answer). Heuristic on purpose — the strict
// intent→response check belongs to the service-level typed fixtures.
const BACKGROUND=new Set(['story.incident','story.teaser','story.teaserPassed','story.directorDealt','story.goalMissed']);
const landedOf=t=>t.events.some(e=>!NOISE.has(e.type)&&!BACKGROUND.has(e.type)||e.type==='core.moved');
const up=e=>(e.payload?.delta??((e.payload?.to??0)-(e.payload?.from??0)))>0;

export const wordsOf=text=>String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
export const narrativeGrams=text=>{const w=wordsOf(text);if(w.length<25)return null;const g=new Set();for(let i=0;i<=w.length-3;i++)g.add(w.slice(i,i+3).join(' '));return g;};
export const gramOverlap=(a,b)=>{if(!a||!b)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n);};
// Short authored lines (movement, location blurbs) are skipped so deterministic repeats don't count as model repetition.
export function narrativeDupes(texts,threshold=0.55){const grams=texts.map(narrativeGrams),pairs=[];grams.forEach((g,i)=>{if(!g)return;for(let j=Math.max(0,i-3);j<i;j++){const s=gramOverlap(g,grams[j]);if(s>=threshold)pairs.push({turns:[j+1,i+1],similarity:Number(s.toFixed(2))});}});return pairs;}

// Player turns in play order. The service's automatic `<id>-end` scene close belongs to the turn that caused it.
// The service settles one typed line in follow-up turns (priced acts, a scored first, the scene close); they belong to that line.
const SUB=/-(acts|first|end)$/;
export function playerTurns(state){const out=[];for(const t of Object.values(state.turns||{})){if(out.length&&SUB.test(t.id)&&String(t.id).startsWith(out.at(-1).id)){out.at(-1).events=[...out.at(-1).events,...t.events];continue;}out.push({id:t.id,command:t.command?.type||'',input:typeof t.input==='string',events:t.events||[],narrative:typeof t.narrative==='string'?t.narrative:'',playedAt:t.playedAt});}return out;}

function secondsFor(turns,measured){
 const stamps=turns.map(t=>Date.parse(t.playedAt)),gaps=turns.map((t,i)=>measured[t.id]??(i&&stamps[i]&&stamps[i-1]?Math.min(300,(stamps[i]-stamps[i-1])/1000):null));
 const known=gaps.filter(x=>x!=null).sort((a,b)=>a-b),median=known[Math.floor(known.length/2)];
 if(known.length>=Math.max(1,turns.length/2))return {source:turns.some(t=>measured[t.id]!=null)?'measured':'stamped',seconds:gaps.map(x=>x??median)};
 return {source:'estimated',seconds:turns.map(t=>8+wordsOf(t.narrative||t.events.map(e=>e.payload?.text||'').join(' ')).length/4)};
}

export function funMetrics(state,pack,{seconds:measured={}}={}){
 const turns=playerTurns(state),{source,seconds}=secondsFor(turns,measured),romantic=new Set((pack.datingProfiles||[]).map(d=>d.character));
 const sceneById=new Map((pack.scriptedScenes||[]).map(s=>[s.id,s]));
 const seen={scenes:new Set(),beats:new Set(),places:new Set([state.actors?.[pack.playerId]?.location].filter(Boolean)),people:new Set(),objects:new Set()};let clock=0,deadRun=0,quietRun=0,lastBeat=0;const beatWindows=new Set(),beatCast=new Map();
 const m={turns:turns.length,timing:source,minutes:0,choices:0,typed:0,typedLive:0,deadTurns:0,longestDeadStreak:0,freshTurns:0,firstChoice:null,firstSpark:null,firstDiscovery:null,firstPayoff:null,firstDrama:null,firstCg:null,deadByCommand:{},maxQuietDayparts:pack.directorProfile?0:null,inputLost:0,longestBeatGap:0,trailingDrought:null,zeroBeatWindows:null};
 const mark=(key,i,via)=>{if(!m[key])m[key]={turn:i+1,minutes:Number((clock/60).toFixed(1)),via};};
 turns.forEach((t,i)=>{
  clock+=seconds[i];let fresh=false,live=false,quietBeat=false,beat=false;
  const landed=landedOf(t);
  if(t.input&&!landed)m.inputLost++; // the input produced nothing the game can point to
  if(CHOICE.has(t.command)){m.choices++;mark('firstChoice',i,t.command);}if(t.input)m.typed++;
  for(const e of t.events){const p=e.payload||{},scene=p.scene;
   if(!NOISE.has(e.type))live=true;
   if(e.type==='social.spoke'&&t.input&&!p.repeat&&landed)fresh=true; // new words the game actually answered
   if((SPARK.has(e.type)&&up(e)&&(!p.character||romantic.has(p.character)))||PAYOFF.has(e.type)||DRAMA.has(e.type))beat=true;
   if(scene&&['story.sceneSelected','story.sceneStarted','story.choiceResolved','story.sceneResumed','story.incident'].includes(e.type)){if(!seen.scenes.has(scene)){seen.scenes.add(scene);fresh=true;}const beat=`${scene}.${p.beat||'opening'}`;if(!seen.beats.has(beat)){seen.beats.add(beat);fresh=true;}}
   const place=e.type==='core.moved'?p.to:e.type==='core.sceneStarted'?p.location:null;if(place&&!seen.places.has(place)){seen.places.add(place);fresh=true;}
   for(const who of e.type==='core.sceneStarted'?p.characters||[]:[])if(!seen.people.has(who)){seen.people.add(who);fresh=true;}
   if(SPARK.has(e.type)&&up(e)&&(!p.character||romantic.has(p.character)))mark('firstSpark',i,e.type);
   if(e.type==='social.preferenceDiscovered'||e.type==='social.actDiscovered'||(e.type==='social.actPriced'&&(p.verdict==='liked'||p.verdict==='disliked')))mark('firstDiscovery',i,e.type); // the first liked/disliked reason, whichever channel delivers it
   if(e.type==='world.daypartStarted'&&m.maxQuietDayparts!=null)quietRun++;
   if(DIRECTOR_BEAT.has(e.type))quietBeat=true; // a beat dealt on the crossing itself keeps that daypart from counting as quiet
   if(PAYOFF.has(e.type))mark('firstPayoff',i,e.type);
   if(scene&&(e.type==='story.sceneSelected'||e.type==='story.sceneStarted')&&sceneById.get(scene)?.cg)mark('firstCg',i,scene); // a gallery unlock: delight, not necessarily romance
   const object=e.type==='world.objectExamined'?p.object??p.target??p.id:null;if(object&&!seen.objects.has(object)){seen.objects.add(object);fresh=true;}
   if(DRAMA.has(e.type))mark('firstDrama',i,e.type);
   // Spotlight equity (director-dm card): who the dealt beats actually starred, so rotation can be falsified.
   if(e.type==='story.incident'||e.type==='story.directorDealt')for(const id of new Set(Object.values(p.roles||{})))if(id&&id!==pack.playerId)beatCast.set(id,(beatCast.get(id)||0)+1);
  }
  if(fresh)m.freshTurns++;
  if(beat){m.longestBeatGap=Math.max(m.longestBeatGap,(clock-lastBeat)/60);lastBeat=clock;beatWindows.add(Math.floor(clock/600));}
  if(t.input&&landed)m.typedLive++;
  if(m.maxQuietDayparts!=null){if(quietBeat)quietRun=0;else if(quietRun>m.maxQuietDayparts)m.maxQuietDayparts=quietRun;}
  if(live||fresh)deadRun=0;else{m.deadTurns++;deadRun++;m.longestDeadStreak=Math.max(m.longestDeadStreak,deadRun);m.deadByCommand[t.command]=(m.deadByCommand[t.command]||0)+1;}
 });
 const narrated=turns.map(t=>t.narrative),withText=narrated.filter(narrativeGrams).length,dupes=narrativeDupes(narrated);
 m.minutes=Number((clock/60).toFixed(1));
 Object.assign(m,{choicesPer10:m.minutes?Number((m.choices*10/m.minutes).toFixed(1)):0,deadRatio:m.turns?Number((m.deadTurns/m.turns).toFixed(2)):0,freshRatio:m.turns?Number((m.freshTurns/m.turns).toFixed(2)):0,typedEffective:m.typed?Number((m.typedLive/m.typed).toFixed(2)):null,storylets:{seen:seen.scenes.size,total:sceneById.size},storyletIds:[...seen.scenes],repeatedProse:withText?Number((new Set(dupes.map(d=>d.turns[1])).size/withText).toFixed(2)):null,nearDuplicates:dupes,ending:state.modules?.['story.endings']?.selected||null,trailingDrought:Number(((clock-lastBeat)/60).toFixed(1)),zeroBeatWindows:clock>0?Math.max(0,Math.ceil(clock/600)-beatWindows.size):0});
 const cast=[...beatCast.entries()].map(([id,n])=>({id,n})).sort((a,b)=>b.n-a.n||a.id.localeCompare(b.id));m.spotlight=cast.length?{counts:cast,spread:cast.at(-1).n?Number((cast[0].n/cast.at(-1).n).toFixed(1)):null}:null;
 return m;
}

// The automatable half of the fun gate (docs/NEXT-MILESTONES.md#fun-gate). Each check carries a status, not just
// pass/fail: a metric that cannot apply to this run (no typed turns, no narration, no director) is
// 'not-exercised'; a run too short to expect the milestone is 'incomplete'; a run long enough (an ending, or
// ≥30 min) that never hit it is a real 'fail' — evidence of absence, not missing evidence.
export function funGate(m){
 const at=x=>x?.minutes??null,exercised=Boolean(m.ending)||m.minutes>=30;
 const check=(id,value,ok,need,status)=>{let st=status??(value==null?null:ok(value)?'pass':'fail');
  if(st==null)st=exercised?'fail':'incomplete'; // a missing milestone on a full run is a miss, not unknown
  return {id,value,need,pass:st==='pass'?true:st==='fail'?false:null,status:st};};
 return [check('first-choice',at(m.firstChoice),v=>v<=2,'≤ 2 min'),check('first-discovery',at(m.firstDiscovery),v=>v<=5,'≤ 5 min to a liked/disliked reason'),check('first-payoff',at(m.firstPayoff),v=>v<=15,'≤ 15 min'),check('dead-turns',m.deadRatio,v=>v<=0.1,'≤ 10%'),check('typed-effective',m.typed?m.typedEffective:null,v=>v>=0.5,'≥ 50% of typed turns change state',m.typed?undefined:'not-exercised'),check('run-length',m.ending?m.minutes:(m.minutes>=45?m.minutes:null),v=>v>=30&&v<=45,'30–45 min to an ending',m.ending?undefined:(m.minutes>=45?'fail':'incomplete')),check('drama',m.firstDrama?1:0,v=>v>0,'a complication or witness fires'),check('world-quiet',m.maxQuietDayparts,v=>v<=1,'≤ 1 quiet daypart in a row',m.maxQuietDayparts==null?'not-exercised':undefined),check('repeated-prose',m.repeatedProse,v=>v<=0.1,'≤ 10% of narrated turns',m.repeatedProse==null?'not-exercised':undefined),check('input-lost',m.typed?m.inputLost:null,v=>v===0,'0 lost inputs',m.typed?undefined:'not-exercised')];
}

const mins=x=>x?`${x.minutes}m/t${x.turn}`:'—';
export function funLine(m){return `fun[${m.timing}]: ${m.turns} turns ${m.minutes}m | 1st choice ${mins(m.firstChoice)} | 1st discovery ${mins(m.firstDiscovery)} | 1st spark ${mins(m.firstSpark)} | 1st payoff ${mins(m.firstPayoff)} | 1st CG ${mins(m.firstCg)} | drama ${mins(m.firstDrama)} | choices/10m ${m.choicesPer10} | dead ${m.deadTurns} (${Math.round(m.deadRatio*100)}%, streak ${m.longestDeadStreak}) | fresh ${Math.round(m.freshRatio*100)}% | typed ${m.typed?`${m.typed} (${Math.round(m.typedEffective*100)}% landed)`:'0'} | quiet max ${m.maxQuietDayparts==null?'—':m.maxQuietDayparts} | storylets ${m.storylets.seen}/${m.storylets.total} | repeat prose ${m.repeatedProse==null?'—':Math.round(m.repeatedProse*100)+'%'} | lost inputs ${m.inputLost} | beat gap max ${m.longestBeatGap?Number(m.longestBeatGap.toFixed(1))+'m':'—'} | tail drought ${m.trailingDrought?m.trailingDrought+'m':'—'} | spotlight ${m.spotlight?m.spotlight.counts.slice(0,3).map(c=>`${c.id}:${c.n}`).join(' ')+(m.spotlight.spread?` (×${m.spotlight.spread})`:' (starved cast)'):'—'}${m.ending?` | ending ${m.ending}`:''}`;}
export function gateLine(gate){return 'gate: '+gate.map(g=>`${g.id} ${g.pass===true?'ok':g.pass===false?'NO':g.status==='not-exercised'?'—':'?'}`).join(' · ');}
