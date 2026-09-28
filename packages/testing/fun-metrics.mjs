// F12 fun proxies computed from a committed campaign. Pure: reads state.turns/events and the pack, never the model.
// Timing comes from, in order: per-turn seconds the harness measured, `playedAt` stamps the store writes when a
// turn is narrated (human runs), or a reading-speed estimate (visual-novel pacing: ~4 words/s plus a decision).
const NOISE=new Set(['core.timeAdvanced','core.patch','core.waited','core.moved','core.inspected','core.travelBlocked','core.sceneStarted','core.sceneContinued','core.sceneEnded','world.daypartStarted','world.searchedEmpty','world.meetingUnavailable','world.meetingRedirect','world.actorArrived','world.objectExamined','social.spoke','social.threadRead','social.feedRead','story.sceneQueued','story.starved','story.sceneResponded']);
// Spark: small romantic signal (Stardew's heart wiggle). Payoff: a rung the player would tell a friend about.
const SPARK=new Set(['social.chemistryChanged','social.attractionChanged','social.preferenceDiscovered','social.intimacyInterestDiscovered','social.romancePointsChanged']);
const PAYOFF=new Set(['social.crushStarted','social.datingPhaseChanged','social.romanceRankChanged','social.dateAccepted','social.intimacyStarted','social.intimacyCompleted']);
const DRAMA=new Set(['story.incident','social.intimacyExposed','social.encounterDisclosed','social.jealousyTriggered','social.rumorLearned','social.rivalryDiscovered','social.relationshipStrained','social.neglectDetonated']);
const CHOICE=new Set(['story.choose','story.startOfferedScene']);
const up=e=>(e.payload?.delta??((e.payload?.to??0)-(e.payload?.from??0)))>0;

export const wordsOf=text=>String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(w=>w.length>2);
export const narrativeGrams=text=>{const w=wordsOf(text);if(w.length<25)return null;const g=new Set();for(let i=0;i<=w.length-3;i++)g.add(w.slice(i,i+3).join(' '));return g;};
export const gramOverlap=(a,b)=>{if(!a||!b)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/(a.size+b.size-n);};
// Short authored lines (movement, location blurbs) are skipped so deterministic repeats don't count as model repetition.
export function narrativeDupes(texts,threshold=0.55){const grams=texts.map(narrativeGrams),pairs=[];grams.forEach((g,i)=>{if(!g)return;for(let j=Math.max(0,i-3);j<i;j++){const s=gramOverlap(g,grams[j]);if(s>=threshold)pairs.push({turns:[j+1,i+1],similarity:Number(s.toFixed(2))});}});return pairs;}

// Player turns in play order. The service's automatic `<id>-end` scene close belongs to the turn that caused it.
export function playerTurns(state){const out=[];for(const t of Object.values(state.turns||{})){if(t.command?.type==='core.endScene'&&t.command.args?.reason==='natural'&&out.length&&String(t.id).startsWith(out.at(-1).id)){out.at(-1).events=[...out.at(-1).events,...t.events];continue;}out.push({id:t.id,command:t.command?.type||'',input:typeof t.input==='string',events:t.events||[],narrative:typeof t.narrative==='string'?t.narrative:'',playedAt:t.playedAt});}return out;}

function secondsFor(turns,measured){
 const stamps=turns.map(t=>Date.parse(t.playedAt)),gaps=turns.map((t,i)=>measured[t.id]??(i&&stamps[i]&&stamps[i-1]?Math.min(300,(stamps[i]-stamps[i-1])/1000):null));
 const known=gaps.filter(x=>x!=null).sort((a,b)=>a-b),median=known[Math.floor(known.length/2)];
 if(known.length>=Math.max(1,turns.length/2))return {source:turns.some(t=>measured[t.id]!=null)?'measured':'stamped',seconds:gaps.map(x=>x??median)};
 return {source:'estimated',seconds:turns.map(t=>8+wordsOf(t.narrative||t.events.map(e=>e.payload?.text||'').join(' ')).length/4)};
}

export function funMetrics(state,pack,{seconds:measured={}}={}){
 const turns=playerTurns(state),{source,seconds}=secondsFor(turns,measured),romantic=new Set((pack.datingProfiles||[]).map(d=>d.character));
 const sceneById=new Map((pack.scriptedScenes||[]).map(s=>[s.id,s]));
 const seen={scenes:new Set(),beats:new Set(),places:new Set([state.actors?.[pack.playerId]?.location].filter(Boolean)),people:new Set(),objects:new Set()};let clock=0,deadRun=0;
 const m={turns:turns.length,timing:source,minutes:0,choices:0,typed:0,deadTurns:0,longestDeadStreak:0,freshTurns:0,firstChoice:null,firstSpark:null,firstPayoff:null,firstDrama:null,firstCg:null,deadByCommand:{}};
 const mark=(key,i,via)=>{if(!m[key])m[key]={turn:i+1,minutes:Number((clock/60).toFixed(1)),via};};
 turns.forEach((t,i)=>{
  clock+=seconds[i];let fresh=false,live=false;
  if(CHOICE.has(t.command)){m.choices++;mark('firstChoice',i,t.command);}if(t.input)m.typed++;
  for(const e of t.events){const p=e.payload||{},scene=p.scene;
   if(!NOISE.has(e.type))live=true;
   if(e.type==='social.spoke'&&t.input&&!p.repeat)fresh=true; // the player's own new words are never a dead turn
   if(scene&&['story.sceneSelected','story.sceneStarted','story.choiceResolved','story.sceneResumed','story.incident'].includes(e.type)){if(!seen.scenes.has(scene)){seen.scenes.add(scene);fresh=true;}const beat=`${scene}.${p.beat||'opening'}`;if(!seen.beats.has(beat)){seen.beats.add(beat);fresh=true;}}
   const place=e.type==='core.moved'?p.to:e.type==='core.sceneStarted'?p.location:null;if(place&&!seen.places.has(place)){seen.places.add(place);fresh=true;}
   for(const who of e.type==='core.sceneStarted'?p.characters||[]:[])if(!seen.people.has(who)){seen.people.add(who);fresh=true;}
   if(SPARK.has(e.type)&&up(e)&&(!p.character||romantic.has(p.character)))mark('firstSpark',i,e.type);
   if(PAYOFF.has(e.type))mark('firstPayoff',i,e.type);
   if(scene&&(e.type==='story.sceneSelected'||e.type==='story.sceneStarted')&&sceneById.get(scene)?.cg)mark('firstCg',i,scene); // a gallery unlock: delight, not necessarily romance
   const object=e.type==='world.objectExamined'?p.object??p.target??p.id:null;if(object&&!seen.objects.has(object)){seen.objects.add(object);fresh=true;}
   if(DRAMA.has(e.type))mark('firstDrama',i,e.type);
  }
  if(fresh)m.freshTurns++;
  if(live||fresh)deadRun=0;else{m.deadTurns++;deadRun++;m.longestDeadStreak=Math.max(m.longestDeadStreak,deadRun);m.deadByCommand[t.command]=(m.deadByCommand[t.command]||0)+1;}
 });
 const narrated=turns.map(t=>t.narrative),withText=narrated.filter(narrativeGrams).length,dupes=narrativeDupes(narrated);
 m.minutes=Number((clock/60).toFixed(1));
 Object.assign(m,{choicesPer10:m.minutes?Number((m.choices*10/m.minutes).toFixed(1)):0,deadRatio:m.turns?Number((m.deadTurns/m.turns).toFixed(2)):0,freshRatio:m.turns?Number((m.freshTurns/m.turns).toFixed(2)):0,storylets:{seen:seen.scenes.size,total:sceneById.size},storyletIds:[...seen.scenes],repeatedProse:withText?Number((new Set(dupes.map(d=>d.turns[1])).size/withText).toFixed(2)):0,nearDuplicates:dupes,ending:state.modules?.['story.endings']?.selected||null});
 return m;
}

// The automatable half of the fun gate (docs/NEXT-MILESTONES.md#fun-gate). null = not measurable in this run.
export function funGate(m){
 const at=x=>x?.minutes??null,check=(id,value,ok,need)=>({id,value,need,pass:value==null?null:ok(value)});
 return [check('first-choice',at(m.firstChoice),v=>v<=2,'≤ 2 min'),check('first-payoff',at(m.firstPayoff),v=>v<=15,'≤ 15 min'),check('dead-turns',m.deadRatio,v=>v<=0.1,'≤ 10%'),check('run-length',m.ending?m.minutes:null,v=>v>=30&&v<=45,'30–45 min to an ending'),check('drama',m.firstDrama?1:0,v=>v>0,'a complication or witness fires'),check('repeated-prose',m.repeatedProse,v=>v<=0.1,'≤ 10% of narrated turns')];
}

const mins=x=>x?`${x.minutes}m/t${x.turn}`:'—';
export function funLine(m){return `fun[${m.timing}]: ${m.turns} turns ${m.minutes}m | 1st choice ${mins(m.firstChoice)} | 1st spark ${mins(m.firstSpark)} | 1st payoff ${mins(m.firstPayoff)} | 1st CG ${mins(m.firstCg)} | drama ${mins(m.firstDrama)} | choices/10m ${m.choicesPer10} | dead ${m.deadTurns} (${Math.round(m.deadRatio*100)}%, streak ${m.longestDeadStreak}) | fresh ${Math.round(m.freshRatio*100)}% | storylets ${m.storylets.seen}/${m.storylets.total} | repeat prose ${Math.round(m.repeatedProse*100)}%${m.ending?` | ending ${m.ending}`:''}`;}
export function gateLine(gate){return 'gate: '+gate.map(g=>`${g.id} ${g.pass==null?'?':g.pass?'ok':'NO'}`).join(' · ');}
