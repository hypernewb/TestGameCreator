// Layer 2/3: deterministic dialogue regression. A committed corpus — one clean conversation plus planted-fault
// variants — replayed through dialogueMetrics, so the mechanical tripwires are gated in CI with zero model calls.
// Recorded A/B runs (scripts/prompt-ab.mjs --out run.json) replay through the same path (replayRun), and a filled
// blind-review CSV plus its key is scored against the model judge (humanAgreement — Layer 3's license check).
import {dialogueMetrics,dialogueLine} from './dialogue-metrics.mjs';

const P='player',J='jana',L=(speaker,text)=>({speaker,text});
export const BASE={playerId:P,engine:[L('','Trust 8 → 9')],lines:[
 L('','The kitchen smells like burnt coffee and morning.'),
 L(J,'You look terrible. Late night?'),
 L(P,'Good night, actually. Reading.'),
 L(J,'Reading. Voluntarily. The world must be ending.'),
 L(P,'It was that novel you left on the table.'),
 L(J,'I left that there in November.'),
 L(P,'It took me a while to get into it.'),
 L(J,'And? Verdict?')]};
const clean=m=>m.echoViolations===0&&m.walls===0&&m.recycledGrams===0&&(m.questionRate??0)<=0.6&&m.narrationWalls===0;
// Each fault is a known VN failure mode with a metric that must catch it; the clean case guards the other
// direction — if a tightened metric starts flagging the clean scene, that drift is visible here, not in playtests.
export const CASES=[
 {id:'clean',why:'the clean scene must stay clean',inject:null,check:clean},
 {id:'question-storm',why:'interview mode: every NPC line interrogates',inject:b=>({...b,lines:b.lines.map(l=>l.speaker===J?L(J,/[?]$/.test(l.text)?l.text:`${l.text.replace(/\.$/,'')}?`):l)}),check:m=>(m.questionRate??0)>=0.8},
 {id:'wall',why:'an NPC monologue instead of speakable lines',inject:b=>({...b,lines:[...b.lines,L(J,'And I have been thinking about what you said all week, about how the city feels different in the rain, about how we never go anywhere anymore, and how maybe the reason we stopped going places is that something always came up, and I want to know whether you feel that too before I say the rest of it out loud and make it real.')]})  ,check:m=>m.walls>=1},
 {id:'recycled-mannerism',why:'the same physical beat twice in one conversation',inject:b=>({...b,lines:[...b.lines,L(J,'She taps a finger against her chin and waits.'),L(J,'Later she taps a finger against her chin and smiles again.')]})  ,check:m=>m.recycledGrams>=2},
 {id:'echo-break',why:'the typed line keeps its self-reference inside the wrapper',inject:b=>({...b,lines:[...b.lines,L(P,'You tell Jana: "I ask Jana, \\"Where were you?\\""')]})  ,check:m=>m.echoViolations>=1},
 {id:'narration-wall',why:'a block of narration instead of a moment',inject:b=>({...b,lines:[...b.lines,L('','The morning continues around them while the radiator clanks twice and the light through the window shifts from white to amber and somewhere below a door slams and the smell of burnt coffee gives way to the smell of toast and neither of them moves to open the curtains because the conversation is not finished and the room knows it, and neither of them minds.')]})  ,check:m=>m.narrationWalls>=1},
 {id:'glue-storm',why:'engine lines crowd out the character lines',inject:b=>({...b,engine:[...b.engine,...Array.from({length:7},(_,i)=>L('',`Trust ${8+i} → ${9+i}`))]}),check:m=>(m.glueDensity??0)>=0.5}];
export function replayCorpus(){
 return CASES.map(c=>{const src=c.inject?c.inject(structuredClone(BASE)):BASE;
  const metrics=dialogueMetrics({lines:src.lines,engine:src.engine},{playerId:src.playerId});
  return {id:c.id,why:c.why,metrics,caught:!!c.check(metrics)};});
}
// Replay a recorded A/B run: aggregate the per-turn dialogue metrics per variant and collect every echo break.
export function replayRun(record,{playerId='',maxQuestionRate=0.7,maxWalls=1,maxGlue=0.5}={}){
 const variants=record.meta?.names||[],per={},echoHits=[];
 for(const n of variants)per[n]={turns:0,walls:0,recycledGrams:0,echoViolations:0,maxQuestionRate:0,maxGlueDensity:0};
 for(const r of record.rows||[])for(const n of variants){
  const m=r[n]?.dialogue||dialogueMetrics(r[n]?.shown||{lines:[],engine:[]},{playerId});if(!m)continue;
  const d=per[n];d.turns++;d.walls+=m.walls+m.narrationWalls;d.recycledGrams+=m.recycledGrams;d.maxQuestionRate=Math.max(d.maxQuestionRate,m.questionRate??0);d.maxGlueDensity=Math.max(d.maxGlueDensity,m.glueDensity??0);
  if(m.echoViolations){d.echoViolations+=m.echoViolations;echoHits.push({variant:n,where:`${r.scenario} turn ${r.turn+1}`});}}
 const failures=[];
 for(const [n,d] of Object.entries(per)){
  if(d.echoViolations)failures.push(`${n}: ${d.echoViolations} echo break(s) — zero tolerance`);
  if(d.maxQuestionRate>maxQuestionRate)failures.push(`${n}: a turn hits ${(d.maxQuestionRate*100).toFixed(0)}% NPC questions (max ${maxQuestionRate})`);
  if(d.walls>maxWalls)failures.push(`${n}: ${d.walls} walls across the run (max ${maxWalls})`);
  if(d.maxGlueDensity>maxGlue)failures.push(`${n}: glue density ${d.maxGlueDensity} on a turn (max ${maxGlue})`);}
 return {variants:per,echoHits,failures};
}
// Layer 3: score the model judge against a filled blind-review CSV (columns from blindReview in
// sustained-conversations.mjs) and its key. Winner agreement is the judge's license to operate.
export function humanAgreement(record,csvText,key){
 const lines=csvText.trim().split('\n');if(!lines.length)return {compared:0};
 const byCase={};for(const line of lines.slice(1)){const c=line.split(',');if(c[0])(byCase[c[0]]??=[]).push(c);}
 let compared=0,agree=0,funDelta=[];
 for(const [id,info] of Object.entries(key||{})){
  const rows=byCase[id];if(!rows)continue;
  const prefRow=rows.map(c=>c[9]).find(v=>['A','B','tie'].includes((v||'').trim()));
  if(!prefRow)continue;const pref=prefRow.trim();
  const last=(record.rows||[]).filter(r=>r.scenario===info.scenario&&r.verdicts?.length).at(-1);
  if(!last)continue;
  const verdict=last.verdicts.find(v=>v.pair.includes(info.A)&&v.pair.includes(info.B));if(!verdict)continue;
  const human=pref==='tie'?'tie':pref==='A'?info.A:info.B;
  compared++;if(verdict.winner===human)agree++;
  for(const c of rows){const want=parseFloat(c[7]),variant=c[1]==='A'?info.A:c[1]==='B'?info.B:null;
   if(Number.isFinite(want)&&variant&&Number.isFinite(verdict.scores?.[variant]?.fun))funDelta.push(Math.abs(verdict.scores[variant].fun/2-want));}}
 const avg=xs=>xs.length?+(xs.reduce((s,x)=>s+x,0)/xs.length).toFixed(2):null;
 return {compared,agreement:compared?+(agree/compared).toFixed(2):null,meanFunGap:avg(funDelta)};
}
export {dialogueLine};
