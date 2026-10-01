// Layer 2/3 gate: replay the planted-fault corpus (always, zero model calls) and optionally a recorded A/B run
// (scripts/prompt-ab.mjs --out run.json) through the dialogue metrics, and score a filled blind-review CSV
// against the model judge. Exit code 1 on any missed fault or threshold breach.
import {readFileSync} from 'node:fs';
import {replayCorpus,replayRun,humanAgreement} from '../packages/testing/dialogue-replay.mjs';
import {dialogueLine} from '../packages/testing/dialogue-metrics.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
let failed=0;
console.log('planted-fault corpus:');
for(const r of replayCorpus()){console.log(`  ${r.caught?'caught':'MISS '} ${r.id} — ${r.why} [${dialogueLine(r.metrics)}]`);if(!r.caught)failed++;}
const runPath=arg('run');
if(runPath){
 const record=JSON.parse(readFileSync(runPath,'utf8')),rep=replayRun(record,{playerId:arg('player-id','')});
 for(const [n,d] of Object.entries(rep.variants))console.log(`  ${n}: ${d.turns} turns · walls ${d.walls} · recycled ${d.recycledGrams} · max q ${(d.maxQuestionRate*100).toFixed(0)}% · echo ${d.echoViolations} · max glue ${d.maxGlueDensity}`);
 for(const h of rep.echoHits)console.log(`  ECHO BREAK ${h.variant} at ${h.where}`);
 for(const f of rep.failures){console.log(`  BREACH ${f}`);failed++;}
 const human=arg('human'),key=arg('key');
 if(human&&key){
  const a=humanAgreement(record,readFileSync(human,'utf8'),JSON.parse(readFileSync(key,'utf8')));
  console.log(`  human-vs-judge: ${a.agreement==null?'not enough filled reviews':`${a.agreement} winner agreement over ${a.compared} case(s)`}${a.meanFunGap!=null?`, mean would-type-next gap ${a.meanFunGap}/5`:''}`);
 }
}
if(failed)process.exitCode=1;
