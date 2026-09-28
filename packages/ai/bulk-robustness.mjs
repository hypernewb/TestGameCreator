// Bookkeeping for scripts/ai-bulk-robustness.mjs: one generate run (exit code, stderr, proposal, playtest) → a row, rows → a table.
import {registry} from '../modules/index.mjs';
import {withProposal} from './bulk-authoring.mjs';
import {runPersonaPlaytest} from '../testing/persona-playtest.mjs';
import {funMetrics} from '../testing/fun-metrics.mjs';
import {calendarFor} from '../../public/calendar.mjs';
const KINDS=['locations','characters','scenes','objects','items','activities','events','templates'];
export function summarizeRun({model,run,code,stderr='',proposal,ms=0,watch=[],play}){
 const count=re=>(stderr.match(re)||[]).length,text=proposal?JSON.stringify(KINDS.map(k=>(proposal[k]||[]).map(x=>x.value))).toLowerCase():'';
 return {model,run,ok:code===0&&!!proposal,seconds:Math.round(ms/1000),repairs:count(/Requesting one repair/g),retries:count(/retrying once/g),
  kept:proposal?Object.fromEntries(KINDS.filter(k=>proposal[k]?.length).map(k=>[k,proposal[k].length])):{},dropped:proposal?.dropped?.length||0,warnings:proposal?.warnings?.length||0,
  words:Object.fromEntries(watch.map(w=>[w,text.split(w.toLowerCase()).length-1])),error:code===0?'':(stderr.match(/ERROR: (.*)/)?.[1]||`exit ${code}`).slice(0,160),...(play?{play}:{})};
}
// Valid is not fun (docs/GENERATOR-PLAN.md step 3): play the pack plus every non-rejected entry with persona bots and measure what a
// player meets. Dead-turn share, distinct hand cards on offer per daypart lived (target 2–4), new scenes/templates played, first payoff, endings.
// calendar: per daypart any bot lived, the distinct cards offered across bots (the Studio heatmap).
export function playtestProposal(pack,proposal,{personas=['romancer','explorer'],turns=120,seed=7}={}){
 const next=withProposal(pack,proposal),fresh=new Set(['scenes','templates'].flatMap(k=>(proposal[k]||[]).filter(x=>x.status!=='rejected').map(x=>x.value.id))),played=new Set(),heat=new Map();
 const runs=personas.map(persona=>{const slots=new Map(),seen=(s,enabled)=>{const k=calendarFor(s.tick,next).slot,set=slots.get(k)||new Set();for(const a of enabled)if(a.type==='story.startOfferedScene')set.add(a.args.scene);slots.set(k,set);const h=heat.get(k)||new Set();for(const x of set)h.add(x);heat.set(k,h);};
  const {state,errors}=runPersonaPlaytest(next,registry,{turns,seed,persona,onTurn:seen}),m=funMetrics(state,next),mine=m.storyletIds.map(id=>next.scriptedScenes.find(x=>x.id===id)?.template?.id||id).filter(id=>fresh.has(id));mine.forEach(id=>played.add(id));
  return {persona,turns:m.turns,dead:m.deadRatio,hand:slots.size?[...slots.values()].reduce((n,x)=>n+x.size,0)/slots.size:0,played:new Set(mine).size,payoff:m.firstPayoff?.minutes??null,ending:m.ending,errors:errors.length};});
 const avg=k=>Number((runs.reduce((n,r)=>n+r[k],0)/runs.length).toFixed(2)),payoffs=runs.map(r=>r.payoff).filter(x=>x!=null);
 return {dead:avg('dead'),hand:avg('hand'),played:played.size,fresh:fresh.size,payoff:payoffs.length?Math.min(...payoffs):null,endings:[...new Set(runs.map(r=>r.ending).filter(Boolean))],errors:runs.reduce((n,r)=>n+r.errors,0),runs,playedIds:[...played],
  calendar:[...heat].sort((a,b)=>a[0]-b[0]).map(([k,set])=>{const c=calendarFor(k*(next.daypart?.interval||4),next);return {day:c.day,daypart:c.daypart,hand:set.size};})};
}
const pct=x=>`${Math.round(x*100)}%`,playLine=p=>`play: dead ${pct(p.dead)} hand ${p.hand}/daypart played ${p.played}/${p.fresh} payoff ${p.payoff==null?'—':`${p.payoff}m`} endings ${p.endings.length?p.endings.join(','):'—'}${p.errors?` errors ${p.errors}`:''}`;
export function summarizeRuns(rows){
 const by=new Map();for(const r of rows)by.set(r.model,[...(by.get(r.model)||[]),r]);
 return [...by].map(([model,list])=>({model,runs:list.length,ok:list.filter(r=>r.ok).length,firstTry:list.filter(r=>r.ok&&!r.repairs).length,dropped:list.reduce((n,r)=>n+r.dropped,0),warnings:list.reduce((n,r)=>n+r.warnings,0),avgSeconds:Math.round(list.reduce((n,r)=>n+r.seconds,0)/list.length),...played(list)}));
}
const played=list=>{const p=list.map(r=>r.play).filter(Boolean),avg=k=>Number((p.reduce((n,x)=>n+x[k],0)/p.length).toFixed(2));return p.length?{play:{dead:avg('dead'),hand:avg('hand'),played:p.reduce((n,x)=>n+x.played,0),fresh:p.reduce((n,x)=>n+x.fresh,0),endings:p.filter(x=>x.endings.length).length}}:{};};
export const formatRow=r=>`${r.ok?'ok  ':'FAIL'} ${r.model} #${r.run} ${r.seconds}s repairs:${r.repairs} retries:${r.retries} kept:${Object.entries(r.kept).map(([k,n])=>`${n} ${k}`).join(', ')||'-'} dropped:${r.dropped} warnings:${r.warnings}${Object.keys(r.words).length?` words:${Object.entries(r.words).map(([w,n])=>`${w}=${n}`).join(' ')}`:''}${r.error?` error: ${r.error}`:''}${r.play?` ${playLine(r.play)}`:''}`;
export const formatSummary=s=>`${s.model}: ${s.ok}/${s.runs} ok, ${s.firstTry} first try, ${s.dropped} dropped, ${s.warnings} warnings, ~${s.avgSeconds}s/run${s.play?`; play: dead ${pct(s.play.dead)}, hand ${s.play.hand}/daypart, played ${s.play.played}/${s.play.fresh}, ${s.play.endings} with an ending`:''}`;
