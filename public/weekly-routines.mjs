import {WEEKDAYS,PERIODS} from './calendar.mjs';

const own=(x,k)=>Object.hasOwn(x,k),obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x),copy=x=>structuredClone(x),order=(a,b)=>a<b?-1:a>b?1:0;
const present=p=>obj(p?.gameProject)&&own(p.gameProject,'weeklyRoutines'),source=p=>p.gameProject?.weeklyRoutines,cell=s=>`${s.weekday}/${s.daypart}`;
function value(x,seen=new Set()){if(x===null||typeof x==='string'||typeof x==='boolean')return JSON.stringify(x);if(typeof x==='number'&&Number.isFinite(x))return JSON.stringify(x);if(!obj(x)&&!Array.isArray(x)||seen.has(x))throw Error('expected acyclic JSON values');if(!Array.isArray(x)&&![Object.prototype,null].includes(Object.getPrototypeOf(x)))throw Error('expected JSON object');seen.add(x);let s;if(Array.isArray(x)){const a=[];for(let i=0;i<x.length;i++){if(!own(x,i))throw Error('expected dense JSON array');a.push(value(x[i],seen));}s='['+a.join(',')+']';}else s='{'+Object.keys(x).sort(order).map(k=>JSON.stringify(k)+':'+value(x[k],seen)).join(',')+'}';seen.delete(x);return s;}
function payload(s){const {weekday,daypart,...rest}=s;return rest;}
function effect(s){const p=payload(s);if(p.skipHolidays===false)delete p.skipHolidays;return value(p);}
function error(ds){const e=Error(ds.map(d=>`${d.code}: ${d.message}`).join('; '));e.diagnostics=copy(ds);return e;}
function refuse(code,message,extra={}){throw error([{code,message,...extra}]);}
const records=(p,id)=>(Array.isArray(p.schedules)?p.schedules:[]).filter(s=>s?.actor===id);

// Source only; validation separately checks the persisted runtime cells.
export function compileWeeklyRoutines(pack){
 if(!present(pack))return {ok:true,actors:[],diagnostics:[]};
 const s=source(pack),diagnostics=[],actors=[],ids=new Set(),actorIds=new Set(),add=(code,message,extra={})=>diagnostics.push({code,message,...copy(extra)});
 if(!obj(s)||s.version!==1||!Array.isArray(s.actors)){add('schema','weeklyRoutines expected version 1 and actors array');return {ok:false,actors,diagnostics};}
 try{value(s);}catch{add('json','weeklyRoutines expected acyclic JSON data');return {ok:false,actors,diagnostics};}
 if(pack.schedules!==undefined&&!Array.isArray(pack.schedules))add('binding','schedules expected an array');
 for(const entry of s.actors){
  if(!obj(entry)||typeof entry.actor!=='string'||!Array.isArray(entry.rules)){add('actor','expected actor identity and rules array');continue;}
  const actor=entry.actor;if(actorIds.has(actor))add('duplicate-actor',`duplicate authoring actor ${actor}`,{actor});actorIds.add(actor);
  if(actor===pack.playerId||!Array.isArray(pack.actors)||!pack.actors.some(a=>a?.id===actor))add('actor',`unknown NPC ${actor}`,{actor});
  if(records(pack,actor).length>1)add('binding',`multiple runtime records for ${actor}`,{actor});
  const rules=[];for(const r of entry.rules){
   const extra={actor,ruleIds:typeof r?.id==='string'?[r.id]:[]};let valid=true;const bad=(code,message)=>{valid=false;add(code,message,extra);};
   if(!obj(r)){bad('rule','expected rule object');continue;}
   if(typeof r.id!=='string'||! /^[A-Za-z0-9._-]{1,128}$/.test(r.id))bad('id','invalid stable rule id');else{if(ids.has(r.id))bad('duplicate-id',`duplicate rule id ${r.id}`);ids.add(r.id);}
   if(!['everyday','weekdays','weekends','day'].includes(r.days)||!PERIODS.includes(r.daypart)||r.days==='day'&&!WEEKDAYS.includes(r.weekday)||r.days!=='day'&&own(r,'weekday'))bad('selector','invalid days, weekday or daypart');
   if(!obj(r.stop))bad('stop','expected stop payload');else{if(own(r.stop,'weekday')||own(r.stop,'daypart'))bad('selector','stop payload cannot contain weekday/daypart selectors');if(!Array.isArray(pack.locations)||!pack.locations.some(l=>l?.id===r.stop.location))bad('location','unknown stop location');if(own(r.stop,'skipHolidays')&&typeof r.stop.skipHolidays!=='boolean')bad('holiday','skipHolidays expected boolean');}
   if(valid)rules.push({rule:r,rank:r.days==='day'?3:r.days==='everyday'?1:2,days:r.days==='day'?[r.weekday]:r.days==='weekdays'?WEEKDAYS.slice(0,5):r.days==='weekends'?WEEKDAYS.slice(5):WEEKDAYS.slice()});
  }
  const weekly=[],provenance=[];for(const weekday of WEEKDAYS)for(const daypart of PERIODS){
   const candidates=rules.filter(x=>x.rule.daypart===daypart&&x.days.includes(weekday));if(!candidates.length)continue;let conflict=false;
   for(const rank of [1,2,3]){const same=candidates.filter(x=>x.rank===rank);if(new Set(same.map(x=>effect(x.rule.stop))).size>1){conflict=true;add('overlap',`incompatible ${actor} ${weekday} ${daypart} rules`,{actor,weekday,daypart,ruleIds:same.map(x=>x.rule.id).sort(order)});}}
   if(conflict)continue;const rank=Math.max(...candidates.map(x=>x.rank)),winners=candidates.filter(x=>x.rank===rank).sort((a,b)=>order(a.rule.id,b.rule.id));
   weekly.push({...copy(winners[0].rule.stop),weekday,daypart});provenance.push({weekday,daypart,winningRuleIds:winners.map(x=>x.rule.id),shadowedRuleIds:candidates.filter(x=>x.rank<rank).map(x=>x.rule.id).sort(order)});
  }
  actors.push({actor,weekly,provenance});
 }
 return {ok:diagnostics.length===0,actors,diagnostics};
}

export function validateWeeklyRoutines(pack){
 const r=compileWeeklyRoutines(pack);if(!r.ok)throw error(r.diagnostics);if(!present(pack))return true;
 const diagnostics=[];for(const a of r.actors){const rows=records(pack,a.actor),schedule=rows[0],expected=new Map(a.weekly.map(st=>[cell(st),effect(st)])),actual=new Map();let bad=false;
  if(schedule){if(!Array.isArray(schedule.weekly??[])){bad=true;}else for(const st of schedule.weekly||[]){try{if(!obj(st)||!WEEKDAYS.includes(st.weekday)||!PERIODS.includes(st.daypart)||actual.has(cell(st))||own(st,'skipHolidays')&&typeof st.skipHolidays!=='boolean'){bad=true;continue;}actual.set(cell(st),effect(st));}catch{bad=true;}}
   if(!a.weekly.length&&!(Array.isArray(schedule.stops)&&schedule.stops.length))diagnostics.push({code:'empty-schedule',message:`empty runtime schedule for ${a.actor}`,actor:a.actor});
  }
  if(bad||actual.size!==expected.size||[...expected].some(([k,v])=>actual.get(k)!==v))diagnostics.push({code:'drift',message:`compiled weekly cells drift for ${a.actor}`,actor:a.actor});
 }
 if(diagnostics.length)throw error(diagnostics);return true;
}

function preserve(before,after,known){for(const k of Object.keys(before))if(!known.includes(k)&&(!own(after,k)||value(before[k])!==value(after[k])))refuse('preservation',`preserve authored field ${k}; use explicit deletion instead`);}
function keepSource(before,after){preserve(before,after,['version','actors']);for(const old of before.actors){const next=after.actors.find(a=>a.actor===old.actor);if(!next)refuse('explicit-delete',`use explicit whole-record deletion/detach for ${old.actor}`);preserve(old,next,['actor','rules']);for(const r of old.rules){const n=next.rules.find(x=>x.id===r.id);if(n){preserve(r,n,['id','days','weekday','daypart','stop']);preserve(r.stop,n.stop,['location','skipHolidays']);}}}}
function patchWeekly(before,after){const desired=new Map(after.map(s=>[cell(s),s])),out=[];for(const old of before){const next=desired.get(cell(old));if(!next)continue;out.push(copy(effect(old)===effect(next)?old:next));desired.delete(cell(old));}for(const next of after)if(desired.has(cell(next)))out.push(copy(next));return out;}

// Returns a new committed pair, or throws without modifying the previous pair.
function apply(pack,authoring,conversionActor){
 if(authoring===undefined){if(present(pack))refuse('explicit-detach','use explicit detach to remove authoring metadata');return copy(pack);}
 const proposal={...pack,gameProject:{...pack.gameProject,weeklyRoutines:authoring}},r=compileWeeklyRoutines(proposal);if(!r.ok)throw error(r.diagnostics);
 if(present(pack)){const old=compileWeeklyRoutines(pack);if(!old.ok)throw error(old.diagnostics);keepSource(source(pack),authoring);}
 for(const a of r.actors)if(!source(pack)?.actors?.some(old=>old.actor===a.actor)&&records(pack,a.actor).length&&a.actor!==conversionActor)refuse('convert-first',`explicitly convert legacy records before taking ownership of ${a.actor}`,{actor:a.actor});
 const out=copy(pack);out.gameProject={...out.gameProject,weeklyRoutines:copy(authoring)};out.schedules||=[];
 for(const a of r.actors){const index=out.schedules.findIndex(s=>s.actor===a.actor),schedule=out.schedules[index];
  if(!a.weekly.length){if(!schedule)continue;if(Array.isArray(schedule.stops)&&schedule.stops.length){if(Array.isArray(schedule.weekly)&&schedule.weekly.length)schedule.weekly=[];continue;}if(Object.keys(schedule).some(k=>!['actor','weekly','stops'].includes(k))||own(schedule,'stops')&&!Array.isArray(schedule.stops))refuse('whole-record',`final rule deletion requires explicit whole-record deletion for ${a.actor}`,{actor:a.actor});out.schedules.splice(index,1);continue;}
  if(!schedule){out.schedules.push({actor:a.actor,weekly:copy(a.weekly)});continue;}
  if(!Array.isArray(schedule.weekly??[]))refuse('drift',`invalid compiled weekly array for ${a.actor}`);const seen=new Set();for(const st of schedule.weekly||[]){if(!obj(st)||!WEEKDAYS.includes(st.weekday)||!PERIODS.includes(st.daypart)||seen.has(cell(st)))refuse('duplicate-cell',`invalid or duplicate legacy weekly cell for ${a.actor}`);seen.add(cell(st));}
  schedule.weekly=patchWeekly(schedule.weekly||[],a.weekly);
 }
 validateWeeklyRoutines(out);return out;
}
export function applyWeeklyRoutines(pack,authoring=source(pack)){return apply(pack,authoring);}

export function convertWeeklyRoutines(pack,actor,idFactory){
 if(actor===pack.playerId||!pack.actors?.some(a=>a.id===actor))refuse('actor','unknown NPC for conversion');const rows=records(pack,actor);if(rows.length>1)refuse('binding','multiple runtime records cannot be converted');
 if(present(pack)){validateWeeklyRoutines(pack);if(source(pack).actors.some(a=>a.actor===actor))return applyWeeklyRoutines(pack);}
 const weekly=rows[0]?.weekly||[];if(!Array.isArray(weekly))refuse('drift','invalid legacy weekly array');const seen=new Set();for(const st of weekly){if(!obj(st)||!WEEKDAYS.includes(st.weekday)||!PERIODS.includes(st.daypart)||seen.has(cell(st)))refuse('duplicate-cell','invalid or duplicate legacy weekly cell');seen.add(cell(st));}
 if(weekly.length&&typeof idFactory!=='function')refuse('id','explicit conversion requires an id factory');const s=present(pack)?copy(source(pack)):{version:1,actors:[]};s.actors.push({actor,rules:weekly.map(st=>({id:idFactory(),days:'day',weekday:st.weekday,daypart:st.daypart,stop:copy(payload(st))}))});return apply(pack,s,actor);
}

export function addWeeklyRule(pack,actor,rule,idFactory){
 if(typeof idFactory!=='function')refuse('id','explicit add requires an id factory');if(!present(pack)||!source(pack)?.actors?.some(a=>a.actor===actor)){if(records(pack,actor).length)refuse('convert-first','explicitly convert legacy records before adding linked rules');}
 if(present(pack))validateWeeklyRoutines(pack);const s=present(pack)?copy(source(pack)):{version:1,actors:[]};let a=s.actors.find(a=>a.actor===actor);if(!a){a={actor,rules:[]};s.actors.push(a);}a.rules.push({...copy(rule),id:idFactory()});return applyWeeklyRoutines(pack,s);
}

export function reassignWeeklyRoutine(pack,actor,to){
 validateWeeklyRoutines(pack);const a=source(pack)?.actors.find(a=>a.actor===actor);if(!a)refuse('actor','no linked actor to reassign');if(actor===to)return applyWeeklyRoutines(pack);if(to===pack.playerId||!pack.actors?.some(a=>a.id===to))refuse('actor','unknown target NPC');if(records(pack,to).length||source(pack).actors.some(a=>a.actor===to))refuse('occupied','target actor identity is occupied');const p=copy(pack);p.gameProject.weeklyRoutines.actors.find(a=>a.actor===actor).actor=to;for(const r of p.schedules)if(r.actor===actor)r.actor=to;return applyWeeklyRoutines(p);
}
