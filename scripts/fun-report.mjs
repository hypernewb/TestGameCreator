// F12 fun report. Two sources:
//   node scripts/fun-report.mjs --campaign <id|latest> [--db data/campaigns.sqlite]   a human run, opened read-only
//   node scripts/fun-report.mjs --pack packs/after-hours.json [--turns 200] [--seeds 11,42] [--personas romancer,explorer,achiever] [--json]
// Bot runs have no narration, so timing is the reading-speed estimate and repeated prose is always 0.
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {registry} from '../packages/modules/index.mjs';
import {runPersonaPlaytest,PERSONAS} from '../packages/testing/persona-playtest.mjs';
import {funMetrics,funGate,funLine,gateLine} from '../packages/testing/fun-metrics.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];},root=resolve(import.meta.dirname,'..'),json=process.argv.includes('--json');
const packsIn=dir=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync(resolve(dir,f),'utf8'))):[];
const out=[];
if(arg('campaign')){
 const db=new DatabaseSync(resolve(arg('db',resolve(root,'data/campaigns.sqlite'))),{readOnly:true}),want=arg('campaign');
 const row=want==='latest'?db.prepare('SELECT id,data FROM campaigns ORDER BY rowid DESC LIMIT 1').get():db.prepare('SELECT id,data FROM campaigns WHERE id=?').get(want);db.close();
 if(!row)throw new Error(`Campaign ${want} not found`);
 const state=JSON.parse(row.data),pack=[...packsIn(resolve(root,'packs')),...packsIn(resolve(root,'data/scenarios/published'))].find(p=>p.id===state.packId);
 if(!pack)throw new Error(`Pack ${state.packId} not found`);
 const m=funMetrics(state,pack);out.push({source:`campaign ${row.id}`,metrics:m,gate:funGate(m)});
}else{
 const pack=JSON.parse(readFileSync(resolve(arg('pack','packs/after-hours.json')),'utf8')),turns=+arg('turns',200);
 for(const persona of arg('personas',Object.keys(PERSONAS).join(',')).split(','))for(const seed of arg('seeds','11,42').split(',').map(Number)){
  const {state,errors}=runPersonaPlaytest(pack,registry,{turns,seed,persona}),m=funMetrics(state,pack);out.push({source:`${pack.id} ${persona} seed ${seed}`,errors:errors.length,metrics:m,gate:funGate(m)});
 }
}
if(json)console.log(JSON.stringify(out.map(({metrics:{nearDuplicates,...m},...r})=>({...r,metrics:m})),null,1));
else for(const r of out){console.log(`${r.source}${r.errors?` (${r.errors} action errors)`:''}`);console.log('  '+funLine(r.metrics));console.log('  '+gateLine(r.gate)+`  dead by command ${JSON.stringify(r.metrics.deadByCommand)}`);}
if(out.length>1&&!json){const pass=id=>out.filter(r=>r.gate.find(g=>g.id===id)?.pass).length;console.log(`\nfun summary: ${out.length} runs | endings ${new Set(out.map(r=>r.metrics.ending).filter(Boolean)).size} distinct (${out.filter(r=>r.metrics.ending).length} runs ended) | drama fired ${pass('drama')}/${out.length} | dead-turn gate ${pass('dead-turns')}/${out.length} | storylets seen (union) ${new Set(out.flatMap(r=>r.metrics.storyletIds||[])).size}`);}
