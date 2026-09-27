import {actions,createWorld,execute} from '../core/engine.mjs';
import {diagnoseScenes,unreachableScenes} from '../modules/scenes.mjs';

const issue=(severity,code,message,details={})=>({severity,code,message,...details});
export function auditWorld(state,pack,{turns=state.revision,attempts=[],errors=[]}={}){
 const findings=[];for(const error of errors)findings.push(issue('critical','action-error',error.message,error));
 for(const entry of state.modules['story.scenes']?.evicted||[])findings.push(issue('critical','scene-evicted',`Scene ${entry.scene} was silently at risk: its trigger was evicted after firing at tick ${entry.firedTick}.`,{scene:entry.scene,tick:entry.firedTick}));
 for(const orphan of unreachableScenes(pack))findings.push(issue('critical','orphaned-beat',`Scene ${orphan.id} has unreachable beats: ${orphan.orphanedBeats.join(', ')}.`,{scene:orphan.id,beats:orphan.orphanedBeats}));
 for(const scene of diagnoseScenes(state,pack)){if(scene.status==='paused')findings.push(issue('warning','paused-scene',`Scene ${scene.id} is still paused after ${turns} turns: ${scene.reasons.join('; ')}`,{scene:scene.id}));else if(scene.status==='active')findings.push(issue('warning','active-scene',`Scene ${scene.id} remained active at the end of the run.`,{scene:scene.id}));else if(scene.status==='waiting')findings.push(issue('info','never-fired',`Scene ${scene.id} did not fire in this ${turns}-turn route.`,{scene:scene.id,reasons:scene.reasons}));}
 const rejected=attempts.filter(x=>!x.enabled);for(const [reason,count] of Object.entries(Object.fromEntries([...new Set(rejected.map(x=>x.reason))].map(reason=>[reason,rejected.filter(x=>x.reason===reason).length]))))findings.push(issue(count>=3?'warning':'info','repeated-rejection',`${count} offered actions were rejected: ${reason}`,{count,reason}));
 const order={critical:0,warning:1,info:2};findings.sort((a,b)=>order[a.severity]-order[b.severity]||a.code.localeCompare(b.code));return {turns,summary:{critical:findings.filter(x=>x.severity==='critical').length,warnings:findings.filter(x=>x.severity==='warning').length,info:findings.filter(x=>x.severity==='info').length,completedScenes:state.modules['story.scenes']?.completed.length||0},completedSceneIds:[...(state.modules['story.scenes']?.completed||[])],findings};
}

export function runDeterministicPlaytest(pack,registry,{turns=50,seed=42,startId}={}){
 let state=createWorld(pack,registry,'audit',seed,startId),serial=0;const attempts=[],errors=[],used=new Map();
 for(let turn=0;turn<turns;turn++){
  const offered=actions(state,pack,registry);attempts.push(...offered.filter(x=>!x.enabled).map(x=>({turn,...x})));
  const enabled=offered.filter(x=>x.enabled);if(!enabled.length){errors.push({turn,message:'No enabled action was available.'});break;}
  const score=a=>{const signature=`${a.type}:${JSON.stringify(a.args)}`,times=used.get(signature)||0;if(a.type==='story.choose')return -100+times;if(a.type==='story.leave')return 1000;if(a.type==='core.wait')return 500+times;if(a.type==='core.inspect')return 400+times;if(a.type==='core.move')return 200+times*20;return times*30;};
  const selected=enabled.toSorted((a,b)=>score(a)-score(b))[0],signature=`${selected.type}:${JSON.stringify(selected.args)}`;used.set(signature,(used.get(signature)||0)+1);
  try{state=execute(state,{type:selected.type,args:selected.args,id:`audit-${serial++}`,actorId:pack.playerId,expectedRevision:state.revision},pack,registry).state;}catch(error){errors.push({turn,action:selected.type,message:error.message});}
 }
 return {state,report:auditWorld(state,pack,{turns:state.revision,attempts,errors}),attempts,errors};
}

// Exercise every authored opening with several deterministic action biases. One greedy route can prove
// that a route works, but it cannot prove that alternate content is reachable.
export function runPlaytestSuite(pack,registry,{turns=50,seeds=[11,42,97]}={}){
 const starts=(pack.startOptions?.length?pack.startOptions:[{id:undefined}]).map(x=>x.id),runs=[];
 for(const startId of starts)for(const seed of seeds){const result=runDeterministicPlaytest(pack,registry,{turns,seed,startId});runs.push({startId:startId||'default',seed,report:result.report});}
 const sceneCoverage=new Map((pack.scriptedScenes||[]).map(x=>[x.id,{scene:x.id,title:x.title,runs:0,completed:0,active:0,paused:0}]));
 for(const run of runs){for(const id of run.report.completedSceneIds||[])if(sceneCoverage.has(id))sceneCoverage.get(id).completed++;for(const finding of run.report.findings){const coverage=sceneCoverage.get(finding.scene);if(coverage&&['never-fired','active-scene','paused-scene'].includes(finding.code)){coverage.runs++;if(finding.code==='active-scene')coverage.active++;if(finding.code==='paused-scene')coverage.paused++;}}}
 const unique=new Map();for(const run of runs)for(const finding of run.report.findings){const key=`${finding.severity}:${finding.code}:${finding.scene||''}:${finding.message}`;if(!unique.has(key))unique.set(key,{...finding,runs:0});unique.get(key).runs++;}
 const findings=[...unique.values()],critical=findings.filter(x=>x.severity==='critical').length,warnings=findings.filter(x=>x.severity==='warning').length;
 return {runs,coverage:[...sceneCoverage.values()],findings,summary:{runs:runs.length,critical,warnings,info:findings.length-critical-warnings,scenes:(pack.scriptedScenes||[]).length,neverCompleted:[...sceneCoverage.values()].filter(x=>!x.completed).length}};
}
