// Headless Character Chat Lab runner (T-107): a scripted arc against any pack and NPC, mock/local/cloud.
// Writes the transcript and metrics as JSON + markdown into a temp or artifacts dir. The provider is chosen by
// flag; ai-settings.json is never read (the throwaway app runs on a temp dataPath).
// Example: node scripts/character-lab.mjs --pack campus.ashford --npc jana --script stranger-to-close
import {readdirSync,readFileSync,writeFileSync,mkdirSync,existsSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assert} from '../packages/core/engine.mjs';
import {createApp} from '../server.mjs';
import {registry} from '../packages/modules/index.mjs';
import {MockProvider,CompatibleProvider} from '../packages/ai/providers.mjs';
import {createLab,parseLabScript,labMetrics,transcriptMarkdown,labCast} from '../packages/testing/character-lab.mjs';

const BUILTIN=resolve(import.meta.dirname,'../tests/fixtures/lab-scripts');
export const builtinScripts=()=>existsSync(BUILTIN)?readdirSync(BUILTIN).filter(f=>f.endsWith('.lab')).map(f=>f.replace(/\.lab$/,'')):[];
export const loadScript=name=>{const file=existsSync(name)?name:join(BUILTIN,name+'.lab');assert(existsSync(file),`Lab script not found: ${name}`);return readFileSync(file,'utf8');};

export function providerFor(kind,{endpoint,model,key}={}){
 if(kind==='mock')return new MockProvider();
 if(kind==='local')return new CompatibleProvider({endpoint:endpoint||'http://127.0.0.1:1234/v1/chat/completions',model:model||'qwen/qwen3.8-27b',timeout:180000,maxRequests:10000,maxTokens:1800});
 if(kind==='cloud'){assert(typeof key==='string'&&key.trim(),'OPENROUTER_API_KEY is required for a cloud run');return new CompatibleProvider({endpoint:'https://openrouter.ai/api/v1/chat/completions',model:model||'deepseek/deepseek-v4.1-flash',key:key.trim(),timeout:180000,maxRequests:10000,maxTokens:1800});}
 throw Error('provider is mock, local or cloud');
}
// Runs the parsed steps through the lab; every step lands as an engine command, a labelled patch or a typed turn.
export async function runLabScript(lab,steps,{onRow=()=>{}}={}){
 const rows=[];
 for(const step of steps){
  let row;
  if(step.kind==='say')row=await lab.turn(step.line);
  else if(step.kind==='skip'){const r=await lab.skip(step.unit);row={turn:lab.rows.length,command:`lab.skip ${step.unit}`,ok:r.ok,refusal:r.refusal||null,text:'',ms:0,snapshot:lab.snapshot()};}
  else if(step.kind==='stage'){const ok=lab.jumpToStage(step.stage);row={turn:lab.rows.length,command:`lab.stage ${step.stage}`,ok,refusal:ok?null:'unknown stage',text:'',ms:0,snapshot:lab.snapshot()};}
  else if(step.kind==='stat'){const ok=lab.setStat(step.stat,step.value);row={turn:lab.rows.length,command:`lab.stat ${step.stat} ${step.value}`,ok,refusal:ok?null:'unknown stat',text:'',ms:0,snapshot:lab.snapshot()};}
  else throw Error(`Unknown lab step: ${step.kind}`);
  rows.push(row);onRow(row);
 }
 return {steps:rows,metrics:labMetrics(lab.rows,lab.pack),summary:lab.summary(),markdown:transcriptMarkdown(lab)};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];};
 const packId=arg('pack'),npcId=arg('npc'),scriptName=arg('script','stranger-to-close'),kind=arg('provider','mock'),seed=Number(arg('seed',42)),turns=Number(arg('turns',99));
 assert(packId&&npcId,'--pack and --npc are required');
 const key=(process.env.OPENROUTER_API_KEY||'').trim(),endpoint=arg('endpoint'),model=arg('model');
 const dir=mkdtempSync(join(tmpdir(),'story-character-lab-'));
 let app;
 try{
  app=createApp({dataPath:join(dir,'lab.sqlite'),scenarioDir:join(dir,'scenarios')});
  const pack=app.packs[packId];assert(pack,`Unknown pack: ${packId}`);
  const cast=labCast(pack);
  if(npcId==='?'){console.log('NPCs:',cast.map(c=>c.id).join(', '));process.exit(0);}
  assert(cast.some(c=>c.id===npcId),`Unknown NPC: ${npcId} (try --npc ?)`);
  const all=parseLabScript(loadScript(scriptName)),steps=[];for(const s of all){if(s.kind==='say'&&steps.filter(x=>x.kind==='say').length>=turns)continue;steps.push(s);}
  const lab=createLab({pack,registry,npcId,provider:providerFor(kind,{endpoint,model,key}),seed});
  const out=await runLabScript(lab,steps,{onRow:r=>console.log(`turn ${r.turn+1} ${r.command||'say'}${r.ok===false?' REFUSED':''}`.trimEnd())});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=arg('out',join('artifacts','character-lab',`${scriptName}-${stamp}`));
  mkdirSync(base,{recursive:true});
  writeFileSync(base+'.json',JSON.stringify({meta:{pack:packId,npc:npcId,script:scriptName,provider:kind,seed,date:new Date().toISOString(),labPatches:lab.patches},...out,markdown:undefined},null,2));
  writeFileSync(base+'.md',out.markdown);
  console.log(`stage ${out.summary.stage?.name||out.summary.stage?.id||'—'} · turns ${out.summary.turns} · latency ${JSON.stringify(out.metrics.latency)}`);
  console.log(`report: ${base}.md`);
 }finally{app?.store.close();try{rmSync(dir,{recursive:true,force:true});}catch{}}
}
