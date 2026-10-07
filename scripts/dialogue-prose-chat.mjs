import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {resolve} from 'node:path';import {playerLines} from '../public/turn-presentation.mjs';
import {pathToFileURL} from 'node:url';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {createApp} from '../server.mjs';import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
const out='artifacts/dialogue-prose';mkdirSync(out,{recursive:true});
const pack=JSON.parse(readFileSync('data/scenarios/published/e7bed17c-7b65-4ac6-8ec4-c447120cf55a.json','utf8'));
const model='qwen3.5-text-9b-nsfw-rp-roleplay-i1',endpoint='http://127.0.0.1:1234/v1/chat/completions';
const baselineDir=join(tmpdir(),'story-dialogue-baseline');mkdirSync(baselineDir,{recursive:true});
const baselineFiles=['packages/ai/conversation.mjs','packages/ai/character-context.mjs','packages/ai/beats.mjs','vendor/venus/scenePrompt.mjs'];
for(const p of baselineFiles){let s=execFileSync('git',['show','HEAD:'+p],{encoding:'utf8'});s=s.replace(/from (['"])(\.[^'"]+)\1/g,(_,q,rel)=>{const target=resolve(resolve(p,'..'),rel),b=baselineFiles.find(f=>resolve(f)===target);return 'from '+q+pathToFileURL(b?resolve(baselineDir,b.split('/').at(-1)):target).href+q;});writeFileSync(join(baselineDir,p.split('/').at(-1)),s);}
const {scenePromptMessages:beforePrompt}=await import(pathToFileURL(join(baselineDir,'scenePrompt.mjs')));
const {beatDirection:beforeBeat}=await import(pathToFileURL(join(baselineDir,'beats.mjs')));
const inputs=['Hi Dilek. What makes a poem worth arguing about?','I see.','I used to write poems, but I stopped because I felt embarrassed showing anyone.','I disagree a little. A poem can be clumsy and still say something true. Maybe the margin notes are overrated.','Could you explain your point about what makes a poem worth arguing about? I mean your view, not mine.','Would that view leave room for plain, everyday poems too?','I should get going. Thanks for the conversation, goodbye.'];
const sources=[...baselineFiles,'packages/ai/service.mjs','packages/ai/context-budget.mjs','packages/ai/knowledge.mjs','packages/ai/narration-lint.mjs'],hashes=()=>Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')]));
const meta={sourceHashes:hashes(),generationSeed:null,date:new Date().toISOString(),model,endpoint,temperature:0.5,maxTokens:1800,reasoningEffort:'none',seed:42,contextWindow:8192,selection:'Existing installed 9B roleplay model assumed from delegation; AI settings were not read. LM Studio listed no loaded instances before run. No model installation or paid fallback.',pack:pack.id,character:'dilek-sahin',inputs};
const arms={};
for(const arm of ['before','after']){
 const calls=[],provider=new CompatibleProvider({endpoint,model,timeout:120000,maxTokens:1800,contextWindow:8192});
 if(arm==='before')provider.scenePrompt=(c,p)=>beforePrompt({...c,direction:beforeBeat(c,p,'comparison-scene')},p);
 const complete=provider.complete.bind(provider);provider.complete=async(messages,signal,format,onDelta)=>{const start=Date.now(),row={messages:structuredClone(messages),format,temperature:0.5,max_tokens:provider.outputCap(messages),reasoning_effort:provider.reasoningParam?'none':null};calls.push(row);try{const raw=await complete(messages,signal,format,onDelta);row.raw=raw;row.ms=Date.now()-start;row.usage=provider.usage.at(-1);return raw;}catch(e){row.ms=Date.now()-start;row.error=e.message;throw e;}finally{writeFileSync(out+'/'+arm+'.calls.json',JSON.stringify({meta,calls},null,2));}};
 const app=createApp({dataPath:':memory:',scenarioDir:join(tmpdir(),'story-dialogue-isolated-'+Date.now()+'-'+arm),provider});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;console.log(arm+' isolated port '+port);
 const api=async(path,body)=>{const r=await fetch('http://127.0.0.1:'+port+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const v=await r.json();if(!r.ok)throw Error(JSON.stringify(v));return v;};
 let labId;const rows=[];
 try{const started=await api('/api/lab/start',{pack,npcId:'dilek-sahin',provider:'server',seed:42});labId=started.labId;meta[arm+'Build']=started.build;
 for(const input of (arm==='before'?inputs.slice(0,2):inputs)){const first=calls.length,start=Date.now();const result=await api('/api/lab/turn',{labId,input});const pages=playerLines(result.view),displayed=pages.map(l=>(l.speaker?(pack.actors.find(a=>a.id===l.speaker)?.name||l.speaker)+': ':'')+l.text).join('\n\n');const row={input,displayedPages:pages,ms:Date.now()-start,row:result.row,displayed,presentationLines:result.row.lines,turns:Object.values(result.view.state.turns).filter(t=>t.input===input).map(t=>({id:t.id,command:t.command,fallback:t.fallback,lintTrace:t.lintTrace,sceneRequest:t.sceneRequest,sceneLines:t.sceneLines})),calls:calls.slice(first)};rows.push(row);arms[arm]={rows,calls};writeFileSync(out+'/chat.json',JSON.stringify({meta,arms},null,2));writeFileSync(out+'/transcript.md','# Actual local-model dialogue\n\n'+Object.entries(arms).map(([name,a])=>'## '+name+'\n\n'+a.rows.map((r,i)=>'### Turn '+(i+1)+' ('+(r.ms/1000).toFixed(1)+'s)\n\nPlayer: '+r.input+'\n\n'+(r.displayed||'[No displayed dialogue]')+(r.row.clarification?'\n\nClarification: '+r.row.clarification:'')).join('\n\n')).join('\n\n'));console.log(arm+' turn '+rows.length+' '+row.ms+'ms '+row.presentationLines.length+' lines');}
 }finally{if(labId)await api('/api/lab/control',{labId,kind:'close'});await new Promise(r=>app.server.close(r));app.store.close();}
}
meta.sourceChangedDuringRun=JSON.stringify(meta.sourceHashes)!==JSON.stringify(hashes());writeFileSync(out+'/chat.json',JSON.stringify({meta,arms},null,2));
console.log('Logs: '+out+'/transcript.md and chat.json');
