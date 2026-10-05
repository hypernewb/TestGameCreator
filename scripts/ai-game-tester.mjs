// Headless, text-only game tester. The model plays through the real GameService and then critiques the run.
// The harness surfaces route leads, pushes the tester to vary input (mandatory free text), records unmet
// intents instead of silently dropping them, computes mechanical repetition/continuity findings, and gates
// the "reached target" verdict on play quality rather than tick count alone.
// Usage: node scripts/ai-game-tester.mjs --pack showcase.after-hours --days 4 --context 8192 [--context-wide]
import {readFileSync,readdirSync,mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {actions,createWorld} from '../packages/core/engine.mjs';
import {calendarFor} from '../public/calendar.mjs';
import {promptFill,speakCommand} from '../public/campus.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {funMetrics,funGate,funLine,gateLine} from '../packages/testing/fun-metrics.mjs';
import {readPack} from '../packages/cards/director-library.mjs';

const arg=(name,fallback)=>{const at=process.argv.indexOf(`--${name}`);return at<0?fallback:process.argv[at+1];};
const cleanJson=text=>JSON.parse(String(text).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim());
const clip=(text,n=600)=>String(text||'').replace(/\s+/g,' ').trim().slice(0,n);
const publicEvents=(turn,player)=>turn.events.filter(event=>event.visibility==='public'||event.visibility.includes(player)).map(event=>event.payload?.text).filter(Boolean);
const decisionFormat={type:'json_schema',json_schema:{name:'playtest_decision',strict:false,schema:{type:'object',properties:{actionIndex:{type:'integer',minimum:-1},input:{type:'string'},reason:{type:'string'},unmetIntent:{type:'string'}},required:['actionIndex','input','reason']}}};
const reviewFormat={type:'json_schema',json_schema:{name:'playtest_review',strict:false,schema:{type:'object',properties:{strengths:{type:'array',items:{type:'string'}},issues:{type:'array',items:{type:'object',properties:{severity:{type:'string',enum:['critical','high','medium','low']},layer:{type:'string',enum:['engine','ui','content','model-prompt','test-harness']},evidence:{type:'string'},cause:{type:'string'},concreteFix:{type:'string'}},required:['severity','layer','evidence','cause','concreteFix']}},prioritizedFixes:{type:'array',items:{type:'string'}}},required:['strengths','issues','prioritizedFixes']}}};

const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
// Plans and memories ("on Saturday", "next Tuesday", "see you Friday") are not clock slips: only a weekday used as if it were today counts.
export function calendarFlags(narrative,weekday){const text=String(narrative||'').replace(/[^.!?]*(?:\bscheduled\b|[’']ll be\b)[^.!?]*[.!?]?/g,' ').replace(/\b(on|next|last|this|by|until|till|since|every|from|before|after|for|come|see you)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/gi,' ');return WEEKDAYS.filter(day=>day!==weekday&&new RegExp(`\\b${day}\\b`).test(text)).map(day=>`mentions ${day} but it is ${weekday}`);}

// Compare model narratives over a sliding window with word-trigram Jaccard. Short authored template texts
// (movement lines, location descriptions) are skipped so deterministic repeats do not flood the findings.
const narrativeGrams=text=>{const words=String(text||'').toLowerCase().replace(/[^a-z\s]/g,' ').split(/\s+/).filter(word=>word.length>2);if(words.length<25)return null;const grams=new Set();for(let i=0;i<=words.length-3;i++)grams.add(words.slice(i,i+3).join(' '));return grams;};
const gramOverlap=(a,b)=>{if(!a||!b)return 0;let shared=0;for(const gram of a)if(b.has(gram))shared++;return shared/(a.size+b.size-shared);};
export function narrativeDupes(history,threshold=0.55){const pairs=[];history.forEach((row,index)=>{const grams=narrativeGrams(row.narrative);if(!grams)return;for(let prior=Math.max(0,index-3);prior<index;prior++){const score=gramOverlap(grams,narrativeGrams(history[prior].narrative));if(score>=threshold)pairs.push({turns:[prior+1,index+1],similarity:Number(score.toFixed(2))});}});return pairs;}
export function decisionSpam(history){let max=0,run=0;history.forEach((row,index)=>{run=index>0&&history[index-1].decision===row.decision?run+1:1;max=Math.max(max,run);});return max;}
// Interview-mode detector: how long the tester went speaking every turn without doing anything else.
export function speakStreak(history){let max=0,run=0;history.forEach((row,index)=>{run=row.command==='social.speak'?run+1:0;max=Math.max(max,run);});return max;}

export function testerView(state,pack,offered,history,clarification=''){
 const clock=calendarFor(state.tick,pack),at=state.actors[pack.playerId].location,pending=state.modules['story.scenes']?.pending,scene=pack.scriptedScenes?.find(value=>value.id===pending),beat=scene?.beats?.find(value=>value.id===state.modules['story.scenes']?.pendingBeat)||scene;
 const dating=state.modules['social.dating']?.characters||{},bonds=state.modules['social.bonds']?.values||{};
 const atName=id=>pack.locations.find(x=>x.id===state.actors[id]?.location)?.name||state.actors[id]?.location||'unknown';
 const leads=Object.entries(dating).map(([id,runtime])=>({name:pack.actors.find(actor=>actor.id===id)?.name||id,location:atName(id),phase:runtime.phase,chemistry:runtime.chemistry,satisfaction:runtime.satisfaction,eligible:runtime.eligible,blockers:(runtime.reasons||[]).slice(0,2),bonds:Object.entries(bonds).filter(([key])=>key.split('--')[0]===id).map(([key,value])=>`${key.split('--')[1]} ${value}`)}));
 const whereabouts=pack.actors.filter(actor=>actor.id!==pack.playerId).map(actor=>({name:actor.name,location:atName(actor.id)}));
 const canType=beat?.allowInput!==false,present=pack.actors.filter(actor=>actor.id!==pack.playerId&&state.actors[actor.id].location===at).map(actor=>actor.name);
 const recentDecisions=history.slice(-3).map(row=>row.decision),repeated=recentDecisions.length>=3&&recentDecisions.every(value=>value===recentDecisions[0])&&recentDecisions[0];
 const sinceTyped=[...history].reverse().findIndex(row=>row.kind==='input'),typedTurnsDue=canType&&present.length>0&&(sinceTyped===-1?history.length>=4:sinceTyped>=4);
 return {clock:{tick:state.tick,day:clock.day,weekday:clock.weekday,daypart:clock.daypart},location:pack.locations.find(x=>x.id===at)?.name||at,present,activeConversation:(state.scene?.characters||[]).map(id=>state.actors[id].name),scriptedScene:scene?.title||null,canType,typedTurnsDue,repetition:repeated?`You have chosen "${repeated}" three times in a row with little change. Pick a different action or type your own words.`:'',clarification,leads,whereabouts,actions:offered.map((action,index)=>({index,label:action.label,type:action.type,enabled:action.enabled,reason:action.reason||'',storylet:action.storylet||null})),recent:history.slice(-6).map(row=>({player:row.decision,game:clip(row.narrative,420),results:row.results}))};
}

export function fallbackDecision(offered){const enabled=offered.map((action,index)=>({action,index})).filter(x=>x.action.enabled),rank=type=>type==='story.choose'?0:type==='story.startOfferedScene'?1:type==='core.endScene'?2:type==='world.activity'?3:type==='core.move'?4:type==='core.wait'?9:5;const picked=enabled.sort((a,b)=>rank(a.action.type)-rank(b.action.type))[0];return picked?{actionIndex:picked.index,reason:'deterministic fallback'}:{input:'Wait and observe.',reason:'no enabled button'};}

async function choose(provider,view,typedInScene){
 const system=`You are a senior dating-sim playtester controlling the player in a text visual novel. Play naturally and critically for variety, character chemistry and route progress. The leads list shows each character's dating phase, chemistry and blockers, so pursue the most promising lead instead of wandering between locations. The whereabouts list shows where every character is right now: never travel to a character who is not there — pick a place they actually are, or wait for a daypart when their schedule brings them near. Spend one meaningful action per Morning, Afternoon and Evening. When canType is true and a character is present, prefer speaking or acting in your own words instead of navigating away, and when typedTurnsDue is true you MUST type your own words (actionIndex -1). Never repeat an action that just produced an unchanged or near-identical result; when view.repetition is set, change your approach. In an authored scripted scene, type at most one exploratory reply, then choose one enabled authored option so the story does not stall. End a conversation when its immediate purpose is complete. Never select a disabled action. If you wanted an option that is not offered (for example asking someone out), set unmetIntent to a short description of it and still make a valid choice. Return JSON with all three required fields. To select a listed action use {"actionIndex":0,"input":"","reason":"short intent"}. To type freely use {"actionIndex":-1,"input":"what the player says or does","reason":"short intent"}.`;
 const payload={...view,typedRepliesInCurrentScene:typedInScene};
 try{const value=cleanJson(await provider.complete([{role:'system',content:system},{role:'user',content:JSON.stringify(payload)}],undefined,decisionFormat));if(value.actionIndex>=0&&view.actions[value.actionIndex]?.enabled)return value;if(value.actionIndex===-1&&typeof value.input==='string'&&value.input.trim())return {...value,input:value.input.trim().slice(0,2000)};return {...fallbackDecision(view.actions.map(action=>({...action,args:{}}))),testerWarning:`Tester returned an invalid decision: ${JSON.stringify(value).slice(0,240)}`,unmetIntent:value.unmetIntent?String(value.unmetIntent).slice(0,200):''};}catch(error){return {...fallbackDecision(view.actions.map(action=>({...action,args:{}}))),testerError:String(error.message||error).slice(0,350)};}
}

export function runMetrics(history,startTick,endTick){const turns=history.length,fallbacks=history.filter(row=>row.fallback).length,clarifications=history.filter(row=>row.clarification).length,typed=history.filter(row=>row.kind==='input').length,choices=history.filter(row=>row.command==='story.choose').length,dead=history.filter(row=>row.to===row.from&&!['story.choose','story.respond','core.endScene','core.scene','social.speak'].includes(row.command)).length,commandCounts={};history.forEach(row=>{commandCounts[row.command]=(commandCounts[row.command]||0)+1;});return {turns,refusals:history.filter(row=>row.refused||['REFUSED','ERROR'].includes(row.command)).length,startTick,endTick,ticksPlayed:endTick-startTick,typed,authoredChoices:choices,fallbacks,clarifications,deadTurns:dead,maxConsecutiveSameDecision:decisionSpam(history),maxConsecutiveSpeak:speakStreak(history),commandCounts,nearDuplicates:narrativeDupes(history),calendarConflicts:history.filter(row=>(row.flags||[]).some(flag=>flag.startsWith('mentions '))).length,averageSeconds:Number((history.reduce((sum,row)=>sum+row.seconds,0)/Math.max(1,turns)).toFixed(2))};}

export function qualityGates(history,metrics,days){
 const failures=[];
 if(metrics.deadTurns>Math.max(2,Math.floor(metrics.turns*0.1)))failures.push(`deadTurns ${metrics.deadTurns} exceeds 10% of ${metrics.turns} turns`);
 if(metrics.nearDuplicates.length)failures.push(`${metrics.nearDuplicates.length} near-duplicate narrative pairs, e.g. turns ${metrics.nearDuplicates[0].turns.join(' & ')}`);
 if(metrics.maxConsecutiveSameDecision>3)failures.push(`the same decision was chosen ${metrics.maxConsecutiveSameDecision} times in a row`);
 if(metrics.maxConsecutiveSpeak>4)failures.push(`social.speak was used ${metrics.maxConsecutiveSpeak} turns in a row; vary actions, move, or end the conversation`);
 const typedFloor=Math.max(1,Math.floor(metrics.turns/8));
 if(metrics.typed<typedFloor)failures.push(`only ${metrics.typed} free-text turns, expected at least ${typedFloor}`);
 if(metrics.authoredChoices<days)failures.push(`only ${metrics.authoredChoices} authored choices in ${days} days`);
 return {pass:failures.length===0,failures};
}

export const CRITIQUE_TOKENS=8000;
export async function critique(provider,pack,history,metrics,days,unmetIntents){
 const transcript=history.map((row,index)=>`${index+1}. ${row.clock} | PLAYER ${row.decision} | COMMAND ${row.command} | GAME ${clip(row.narrative,520)} | RESULTS ${row.results.join('; ')||'none'} | TIME ${row.from}->${row.to}${row.from===row.to?' (free)':''}${row.flags?.length?` | FLAGS ${row.flags.join('; ')}`:''}${row.fallback?` | FALLBACK ${row.failureReason}`:''}`).join('\n').slice(-18000);
 const prompt=`Act as a senior game tester reviewing a text dating-sim playtest requested to cover ${days} days. The metrics give actual observed coverage; do not assume the requested date was reached. Be candid and specific. Every issue's evidence MUST cite turn numbers from the numbered transcript. Judge onboarding, agency (the game must never narrate the player's feelings, gaze or reactions), organic dialogue, character voice, pacing by daypart, continuity (weekday and calendar words must match the clock shown in that turn), relationship feedback, pacing of romance versus relationship state, repetition, failure handling and whether choices create interesting consequences. Check these known failure classes explicitly: verbatim or lightly paraphrased repeated narration, one action spammed for identical results, generic talk answers, intimacy ahead of relationship stage, invented player reactions, activity scenes that need a manual finish, calendar contradictions, repeated scene openings, unclear route leads. A turn marked TIME n->n (free) is a conversation or authored-scene beat inside an open scene: the clock moves to the daypart boundary when the scene closes, so never report free turns as stuck time or a broken clock. Classify each issue's cause with the layer field (engine, ui, content, model-prompt or test-harness). Mechanical findings already detected by the harness (verify and expand on them, do not ignore them): ${JSON.stringify({metrics,unmetIntents})}
Return JSON with arrays strengths and issues; each issue has severity (critical/high/medium/low), layer, evidence citing turn numbers, cause, and concreteFix. Add a prioritizedFixes array of the five best changes.
PACK: ${pack.title}
TRANSCRIPT:
${transcript}`;
 // The report is long and reasoning models think first: the play-turn cap (1800) cut it off every run, so the critique gets its own.
 const cap=provider.maxTokens;provider.maxTokens=Math.max(cap||0,CRITIQUE_TOKENS);
 try{return cleanJson(await provider.complete([{role:'system',content:'Return a concise, evidence-based JSON QA report.'},{role:'user',content:prompt}],undefined,reviewFormat));}catch(error){return {strengths:[],issues:[{severity:'critical',layer:'test-harness',evidence:'Critique generation failed',cause:error.message,concreteFix:'Inspect the saved transcript manually.'}],prioritizedFixes:[]};}finally{provider.maxTokens=cap;}
}

// Coverage and critique are separate: a refused move is evidence about the game, not a reason to skip review.
export function incompleteReasonOf(history){const row=history.find(x=>x.testerError);return row?.failureReason||'';}
export function refusalFindings(history){return history.flatMap((row,i)=>row.refused||['REFUSED','ERROR'].includes(row.command)?[{severity:'medium',layer:'engine',evidence:`Turn ${row.turn||i+1}: ${row.decision} — ${row.narrative}`,cause:'The game refused this attempted action; review whether the boundary and its feedback were appropriate.',concreteFix:'Check the action preconditions and give the player a clear explanation or an available alternative.'}]:[]);}
export async function reviewRun(provider,pack,history,metrics,days,unmetIntents){
 const review=await critique(provider,pack,history,metrics,days,unmetIntents);
 return {...review,issues:[...refusalFindings(history),...(review.issues||[])]};
}

async function main(){
 const packId=arg('pack','showcase.after-hours'),days=Math.max(1,Math.min(30,Number(arg('days','4'))||4)),context=Math.max(2048,Number(arg('context',process.env.STORY_CONTEXT_WINDOW||'8192'))||8192),endpoint=arg('endpoint',process.env.STORY_ENDPOINT),model=arg('model',process.env.STORY_MODEL),key=process.env.STORY_API_KEY||'';
 if(!endpoint||!model)throw Error('Set STORY_ENDPOINT and STORY_MODEL. Set STORY_API_KEY when the endpoint requires it.');
 // --pack also takes a JSON file (a pack, or a creator/draft-world output with {pack}), so a created world plays without landing in packs/.
 const file=/\.json$/i.test(packId)&&JSON.parse(readFileSync(resolve(packId),'utf8')),packs=file?[file.pack||file]:readdirSync(resolve('packs')).filter(file=>file.endsWith('.json')).map(file=>readPack(resolve('packs',file))),pack=file?packs[0]:packs.find(value=>value.id===packId);if(!pack)throw Error(`Unknown pack ${packId}`);
 const provider=new CompatibleProvider({endpoint,model,key,timeout:120000,maxRequests:500,maxTokens:1800,contextWindow:context,wideContext:process.argv.includes('--context-wide')}),dir=mkdtempSync(join(tmpdir(),'story-ai-tester-')),store=new Store(join(dir,'campaign.sqlite')),campaignId=`ai-test-${randomUUID()}`,start=createWorld(pack,registry,campaignId),service=new GameService(store,{[pack.id]:pack},registry,provider);store.insert(start);
 const interval=pack.daypart?.interval||4,targetTick=start.tick+days*interval*3,history=[],modelRequests={tester:0,game:0,critique:0},unmetIntents=[];let state=start,clarification='',typedScene='',guard=0;
 try{
  while(state.tick<targetTick&&guard++<days*18&&!state.modules['story.endings']?.selected){
   const offered=actions(state,pack,registry),view=testerView(state,pack,offered,history,clarification),sceneKey=`${state.modules['story.scenes']?.pending||''}:${state.scene?.id||''}`,typedInScene=typedScene===sceneKey;
   const beforeTester=provider.requests;let decision=await choose(provider,view,typedInScene);modelRequests.tester+=provider.requests-beforeTester;if(decision.testerError){history.push({clock:`Day ${view.clock.day} ${view.clock.weekday} ${view.clock.daypart}`,decision:'Tester stopped',kind:'tester',command:'TESTER_ERROR',narrative:decision.testerError,results:[],from:state.tick,to:state.tick,seconds:0,fallback:true,failureReason:decision.testerError,testerError:true});break;}
   if(Number.isInteger(decision.actionIndex)&&decision.actionIndex>=0&&!offered[decision.actionIndex]?.enabled)decision={...fallbackDecision(offered),testerWarning:decision.testerWarning||`Tester chose disabled action index ${decision.actionIndex}`,unmetIntent:decision.unmetIntent||''};
   if(decision.testerWarning||decision.unmetIntent)unmetIntents.push({turn:history.length+1,intent:String(decision.unmetIntent||decision.input||decision.reason||'').slice(0,200),reason:decision.reason||'',warning:decision.testerWarning||''});
   const before=state.tick,t0=Date.now(),request={id:randomUUID(),expectedRevision:state.revision};if(Number.isInteger(decision.actionIndex)&&decision.actionIndex>=0){const selected=offered[decision.actionIndex],typed=promptFill(state,selected);if(typed){request.input=typed;if(sceneKey)typedScene=sceneKey;}else request.command=speakCommand(state,pack,selected);}else{request.input=decision.input;if(sceneKey)typedScene=sceneKey;}
   const beforeGame=provider.requests;let result;try{result=await service.act(campaignId,request);}catch(error){modelRequests.game+=provider.requests-beforeGame;history.push({turn:history.length+1,clock:`${view.clock.weekday} ${view.clock.daypart}`,decision:decision.input||offered[decision.actionIndex]?.label||'unknown',kind:request.input?'input':'action',command:'REFUSED',refused:true,narrative:error.message,results:[],from:before,to:state.tick,seconds:(Date.now()-t0)/1000,fallback:false,failureReason:error.message});state=store.load(campaignId);clarification=error.message;console.log(`${String(history.length).padStart(2)} refused: ${clip(error.message,60)}`);continue;}modelRequests.game+=provider.requests-beforeGame;
   clarification=result.clarification||'';state=result.state;if(clarification){history.push({turn:history.length+1,clock:`Day ${view.clock.day} ${view.clock.weekday} ${view.clock.daypart}`,decision:request.input||offered[decision.actionIndex]?.label||decision.reason,kind:request.input?'input':'action',command:'CLARIFICATION',refused:true,clarification:true,narrative:clarification,results:[],from:before,to:state.tick,seconds:(Date.now()-t0)/1000,fallback:false});continue;}const turn=result.turn||Object.values(state.turns).at(-1),row={turn:history.length+1,clock:`Day ${view.clock.day} ${view.clock.weekday} ${view.clock.daypart}`,decision:request.input||offered[decision.actionIndex]?.label||decision.reason,kind:request.input?'input':'action',command:turn.command.type,narrative:turn.narrative||'',results:publicEvents(turn,pack.playerId),from:before,to:state.tick,seconds:Number(((Date.now()-t0)/1000).toFixed(2)),requestId:request.id,fallback:Boolean(turn.fallback),failureReason:turn.failureReason||'',flags:calendarFlags(turn.narrative||'',view.clock.weekday),...(decision.testerWarning?{testerWarning:decision.testerWarning}:{})};history.push(row);console.log(`${String(history.length).padStart(2)} ${row.clock.padEnd(24)} ${String(row.from+'→'+row.to).padEnd(8)} ${row.command.padEnd(26)} ${clip(row.decision,60)}`);
   const nextKey=`${state.modules['story.scenes']?.pending||''}:${state.scene?.id||''}`;if(nextKey!==sceneKey)typedScene='';
  }
  const metrics=runMetrics(history,start.tick,state.tick),tickTargetReached=state.tick>=targetTick&&!incompleteReasonOf(history),gates=qualityGates(history,metrics,days),incompleteReason=incompleteReasonOf(history)||(!tickTargetReached&&!state.modules['story.endings']?.selected?'turn guard reached':'');
  const beforeCritique=provider.requests,review=await reviewRun(provider,pack,history,metrics,days,unmetIntents);modelRequests.critique=provider.requests-beforeCritique;
  const fun=funMetrics(state,pack,{seconds:Object.fromEntries(history.filter(row=>row.requestId).map(row=>[row.requestId,row.seconds]))}),funGates=funGate(fun);
  const modelUsage={requests:{...modelRequests,total:provider.requests},responses:provider.usage.length,tokens:provider.usage.reduce((sum,row)=>sum+(row.tokens?.total_tokens||0),0)||null},report={generatedAt:new Date().toISOString(),pack:{id:pack.id,title:pack.title},model,contextWindow:context,requestedDays:days,tickTargetReached,qualityGates:gates,reachedTarget:tickTargetReached&&gates.pass,incompleteReason,metrics,modelUsage,ending:state.modules['story.endings']?.selected||null,fun,funGates,unmetIntents,transcript:history,review};mkdirSync(resolve('artifacts/ai-playtests'),{recursive:true});const out=resolve(arg('out',`artifacts/ai-playtests/${pack.id.replace(/[^a-z0-9.-]/gi,'-')}-${days}-day.json`));writeFileSync(out,JSON.stringify(report,null,2));console.log(`\nSaved ${out}\n${funLine(fun)}\n${gateLine(funGates)}\n${JSON.stringify({tickTargetReached,qualityGates:gates,reachedTarget:report.reachedTarget,incompleteReason,metrics,modelUsage,ending:report.ending,unmetIntents,review},null,2)}`);
 }finally{store.close();try{rmSync(dir,{recursive:true,force:true});}catch{}}
}

if(import.meta.url===`file:///${process.argv[1]?.replaceAll('\\','/')}`||process.argv[1]?.endsWith('ai-game-tester.mjs'))main().catch(error=>{console.error(error.stack||error.message);process.exitCode=1;});
