// Each prompt arm runs its own campaign through the real service. The judge reads the shared play-screen presentation.
// Example local run: node scripts/prompt-ab.mjs --endpoint http://localhost:1234/v1 --model qwen/qwen3.8-27b
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {createHash} from 'node:crypto';
import {mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {effectiveWindow,detectContextWindow,validateContextSize} from '../packages/ai/local-settings.mjs';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
import {scenePromptMessages,calmContinuationMessages} from '../vendor/venus/scenePrompt.mjs';
import {runPromptAB} from '../packages/testing/prompt-ab-runner.mjs';
import {tally,summaryLine,reportMarkdown} from '../packages/testing/prompt-ab.mjs';
import {appendLedger} from '../packages/testing/ledger.mjs';
import {SUSTAINED_SCENARIOS,repeatedScenarios,blindReview,sustainedMetrics} from '../packages/testing/sustained-conversations.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
try{process.loadEnvFile('.env');}catch{}
const endpoint=arg('endpoint','https://openrouter.ai/api/v1/chat/completions').replace(/\/$/,'');
const completionUrl=url=>url.endsWith('/chat/completions')?url:url+'/chat/completions';
const key=(process.env.OPENROUTER_API_KEY||'').trim().replace(/^[<"']+|[>"']+$/g,'');
const local=url=>['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname);
if(!local(endpoint)&&!key)throw Error('OPENROUTER_API_KEY is required for a cloud run');
const model=arg('model',local(endpoint)?'qwen/qwen3.8-27b':'deepseek/deepseek-v4.1-flash'),judge=arg('judge',model),judgeEndpoint=arg('judge-endpoint',endpoint),seed=Number(arg('seed',42)),maxTurns=Number(arg('turns',99)),judgeOrders=Number(arg('judge-orders',2));
if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(maxTurns)||maxTurns<1||![1,2].includes(judgeOrders))throw Error('Invalid seed, turns or judge-orders (1 or 2)');
if(process.argv.includes('--drive'))throw Error('--drive was removed: every variant now continues its own campaign');
const SCENARIOS={
 roommate:['Go find Jana','Hey Jana, how was your summer?',"Ask her what she's studying",'Tell her I grew up by a lake and never learned to surf','Tease her about the surfboard wax on the windowsill','Ask her how things are with Dominik','Say I should get to class, see you tonight'],
 library:['Go to the library','Find Nova and say hi','Ask what she is reading',"Tell her I've never read anything by that author and ask where to start",'Ask if she wants to grab coffee sometime','Say I have to run, nice meeting you'],
 group:['Go to Langley Hall','Walk over to Monique and Kaylee and introduce myself','Ask them how they know each other','Joke that the coffee machine here is a war crime','Ask Kaylee what she does for fun on weekends','Tell them I will see them around']
};
Object.assign(SCENARIOS,SUSTAINED_SCENARIOS);
const repeats=Number(arg('repeats',1)),judgeScope=arg('judge-scope','turn');
const pick=arg('scenario','roommate,library,group'),selected=pick==='all'?Object.keys(SCENARIOS):pick.split(',');
if(selected.some(s=>!SCENARIOS[s]))throw Error('Unknown scenario');
const forcedWindow=Number(arg('window',process.env.STORY_CONTEXT_WINDOW||0));if(!Number.isInteger(forcedWindow)||forcedWindow<0)throw Error('window must be a positive integer');
const windowInfo=forcedWindow?{window:forcedWindow,source:'explicit override'}:local(endpoint)?await detectContextWindow(completionUrl(endpoint),model):null;
const contextSize=validateContextSize(arg('context-size','default'));
const sourceFiles=['vendor/venus/scenePrompt.mjs','vendor/venus/venusStylePrompt.mjs','packages/ai/service.mjs','packages/ai/memory.mjs','packages/ai/beats.mjs','packages/modules/dating.mjs','packages/ai/context.mjs','packages/ai/context-budget.mjs','packages/ai/providers.mjs','packages/core/engine.mjs','public/turn-presentation.mjs','packages/testing/prompt-ab.mjs','packages/testing/prompt-ab-runner.mjs','scripts/prompt-ab.mjs','packages/testing/sustained-conversations.mjs','server.mjs','packages/ai/narration-lint.mjs','packages/ai/untrusted-output.mjs','packs/campus.json','packs/director/campus.json'];
const hashSources=()=>Object.fromEntries(sourceFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),sourceHashes=hashSources();
const make=(scenePrompt,modelId=model,url=endpoint,wideContext=false)=>{const p=new CompatibleProvider({endpoint:completionUrl(url),model:modelId,key:local(url)?'':key,timeout:180000,maxRequests:10000,maxTokens:2400,wideContext});p.detectedWindow=windowInfo?.window||null;p.contextSize=contextSize;p.contextWindow=effectiveWindow(p.detectedWindow,contextSize,p.remote);if(scenePrompt)p.scenePrompt=scenePrompt;return p;};
// Hybrid is the default scene style ('ours' and 'hybrid' are the same arm); 'plain' is the older prompt, opt-in only.
const ARMS={calm:()=>make(calmContinuationMessages),plain:()=>make((context,pack)=>scenePromptMessages({...context,sceneStyle:'plain'},pack)),venus:()=>make(venusStyleMessages),ours:()=>make(),hybrid:()=>make(),'context-wide':()=>{const p=make();p.wideContext=true;return p;}};
const names=arg('variants','venus,hybrid').split(',');if(names.length<2||new Set(names).size!==names.length||names.some(n=>!ARMS[n]))throw Error('Choose at least two unique variants: plain,ours,venus,hybrid,calm,context-wide');
if(names.includes('ours')&&names.includes('hybrid'))throw Error('ours already uses the hybrid prompt; compare plain,venus,ours to avoid duplicate arms');
const mode=arg('mode','paired'),reference=arg('reference',names.includes('ours')?'ours':names[0]);if(!['paired','trajectory'].includes(mode)||!names.includes(reference))throw Error('Choose mode paired or trajectory and a reference from the variants');
const variants=Object.fromEntries(names.map(n=>[n,ARMS[n]()])),judgeProvider=make(null,judge,judgeEndpoint),dir=mkdtempSync(join(tmpdir(),'story-prompt-ab-'));
const {store,service,packs,view}=createApp({dataPath:join(dir,'ab.sqlite'),scenarioDir:join(dir,'scenarios')});
let rows;const checkpointRows=[];const verbose=process.argv.includes('--verbose');
try{
 console.log(mode+' evaluation; reference='+reference+'; seed='+seed+'; judge orders='+judgeOrders+'; variants='+names.join(','));
 rows=await runPromptAB({service,store,pack:packs['campus.ashford'],registry,view,variants,scenarios:repeatedScenarios(Object.fromEntries(selected.map(s=>[s,SCENARIOS[s]])),repeats),seed,maxTurns,judgeProvider,judgeOrders,judgeScope,mode,reference,onRow:r=>{checkpointRows.push(r);writeFileSync(arg('out',join(tmpdir(),'prompt-ab-progress.md'))+'.partial.json',JSON.stringify({sourceHashes,rows:checkpointRows}));console.log(r.scenario+' '+r.turn+' '+r.phase+' '+names.map(n=>n+': '+r[n].text.split(/\s+/).length+'w'+(r[n].error?' FAILED':'')).join(' ')+(r.judgeErrors?.length?' JUDGE ERROR':''));if(verbose)for(const n of names){const h=r[n].context?.sceneHistory||[];if(h.length){console.log('  '+n+' ('+h.length+' turns):');for(const x of h)console.log('    '+(x.compact?'[digest]':'[keep]  ')+' '+String(x.text||'').slice(0,120)+(String(x.text||'').length>120?'…':''));}}}});
}finally{store.close();rmSync(dir,{recursive:true,force:true});}
const date=new Date().toISOString(),meta={evaluationVersion:3,model,judge,seed,judgeOrders,judgeScope,repeats,date,names,scenarios:selected,contextWindow:variants[names[0]].contextWindow,contextSize,contextSource:windowInfo?.source||'production fallback',sourceHashes,packDigest:mechanicsDigest(packs['campus.ashford']),sourceChangedDuringRun:JSON.stringify(sourceHashes)!==JSON.stringify(hashSources()),mode,reference,presentation:'public/turn-presentation.mjs'},out=arg('out',join(tmpdir(),'prompt-ab-'+date.replace(/[:.]/g,'-')+'.md'));
meta.sustainedMetrics=sustainedMetrics(rows,names);
if(names.length===2&&(judgeScope==='conversation'||process.argv.includes('--blind'))){const blind=blindReview(rows,names,seed),base=out.replace(/\.md$/,'');writeFileSync(base+'.blind.md',blind.markdown);writeFileSync(base+'.human.csv',blind.csv);writeFileSync(base+'.key.json',JSON.stringify(blind.key,null,2));console.log('blind review sheet: '+base+'.blind.md');}
writeFileSync(out,reportMarkdown(rows,meta));writeFileSync(out.replace(/\.md$/,'')+'.json',JSON.stringify({meta,rows},null,2));
appendLedger(join(import.meta.dirname,'..'),{kind:'ab',model,judge,seed,names,scenarios:selected,mode,judgeScope,summary:summaryLine(tally(rows,names)),report:out});
console.log('summary: '+summaryLine(tally(rows,names))+'\nreport: '+out);
if(meta.sourceChangedDuringRun||rows.some(r=>r.judgeErrors?.length))process.exitCode=1;
