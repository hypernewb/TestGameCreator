#!/usr/bin/env node
// Headless character authoring for local models and external agents.
// Run with --help for the prepare → answer → ingest and direct-generate workflows.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {characterMessages,normalizeCharacter,characterResponseFormat} from '../packages/ai/character-authoring.mjs';
import {normalizeLocalEndpoint,validateLocalModel} from '../packages/ai/local-settings.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const argv=process.argv.slice(2),command=argv.shift(),arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];},flag=name=>argv.includes(`--${name}`),required=name=>{const value=arg(name);if(!value)throw Error(`Missing --${name}`);return value;};
const readJson=file=>JSON.parse(readFileSync(resolve(file),'utf8')),writeNew=(file,value)=>writeFileSync(resolve(file),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const help=()=>console.log(`Headless character authoring

Prompt file: a JSON array of strings, or objects with brief plus optional name, pronouns, age and location.

Direct generation through an OpenAI-compatible endpoint:
  node scripts/character-author.mjs generate --pack packs/game.json --prompts cast.json --model MODEL --out cast.batch.json

Prepare portable jobs for Claude Code, Codex, or another agent:
  node scripts/character-author.mjs prepare --pack packs/game.json --prompts cast.json --out cast.jobs.json
The agent writes cast.responses.json as a JSON array of {"id":"character-1","response":{...}} using each job's messages and schema.
  node scripts/character-author.mjs ingest --pack packs/game.json --jobs cast.jobs.json --responses cast.responses.json --out cast.batch.json

Review the batch and change wanted entries from pending to approved, then apply without modifying the source pack:
  node scripts/character-author.mjs apply --pack packs/game.json --batch cast.batch.json --out packs/game-with-cast.json
Use --all only when every generated entry should be approved automatically.

Defaults: endpoint http://127.0.0.1:1234/v1; STORY_ENDPOINT and STORY_MODEL are accepted. --key or STORY_API_KEY supplies a bearer token.`);
const promptsOf=file=>{const raw=readJson(file);if(!Array.isArray(raw)||!raw.length)throw Error('Prompt file must be a non-empty JSON array');return raw.map((x,i)=>{const v=typeof x==='string'?{brief:x}:x;if(!v||typeof v!=='object'||typeof v.brief!=='string'||!v.brief.trim())throw Error(`Prompt ${i+1} needs a non-empty brief`);return {id:v.id||`character-${i+1}`,brief:v.brief.trim(),...(v.name?{name:String(v.name)}:{}),...(v.pronouns?{pronouns:String(v.pronouns)}:{}),...(v.age?{age:Number(v.age)}:{}),...(v.location?{location:String(v.location)}:{})};});};
const jobsOf=(pack,prompts)=>prompts.map(prompt=>{const request=characterMessages(pack,prompt.brief,prompt);return {id:prompt.id,input:prompt,messages:request.messages,responseSchema:request.schema};});
const batchOf=(pack,jobs,responses,meta={})=>{const byId=new Map(responses.map(x=>[x.id,x.response]));const entries=jobs.map(job=>{if(!byId.has(job.id))return {id:job.id,status:'failed',input:job.input,error:'Missing response'};try{return {id:job.id,status:'pending',input:job.input,value:normalizeCharacter(byId.get(job.id),pack,job.input)};}catch(error){return {id:job.id,status:'failed',input:job.input,error:error.message,response:byId.get(job.id)};}});return {format:'story-framework-character-batch',version:1,source:{packId:pack.id,packVersion:pack.version||'',actorIds:(pack.actors||[]).map(a=>a.id)},createdAt:new Date().toISOString(),...meta,entries};};
const assertSource=(pack,batch)=>{if(batch?.format!=='story-framework-character-batch'||batch.version!==1)throw Error('Not a character batch');if(batch.source?.packId!==pack.id)throw Error(`Batch belongs to ${batch.source?.packId||'another project'}, not ${pack.id}`);const now=(pack.actors||[]).map(a=>a.id),then=batch.source?.actorIds||[];if(JSON.stringify(now)!==JSON.stringify(then))throw Error('Pack cast changed after this batch was created; regenerate or ingest again');};

try{
 if(!command||command==='help'||command==='--help'){help();process.exit(0);}
 const pack=readJson(required('pack'));validatePack(pack,registry);
 if(command==='prepare'){
  const jobs=jobsOf(pack,promptsOf(required('prompts')));writeNew(required('out'),{format:'story-framework-character-jobs',version:1,source:{packId:pack.id,packVersion:pack.version||'',actorIds:pack.actors.map(a=>a.id)},instructions:'For each job, follow messages and return one JSON object matching responseSchema. Save a JSON array of {id,response}. Do not add prose outside response.',jobs});console.log(`Wrote ${jobs.length} portable character jobs to ${resolve(required('out'))}`);
 }else if(command==='generate'){
  const prompts=promptsOf(required('prompts')),jobs=jobsOf(pack,prompts),endpoint=normalizeLocalEndpoint(arg('endpoint',process.env.STORY_ENDPOINT||'http://127.0.0.1:1234/v1')),model=validateLocalModel(arg('model',process.env.STORY_MODEL||'')),provider=new CompatibleProvider({endpoint,model,key:arg('key',process.env.STORY_API_KEY||''),timeout:Number(arg('timeout',300000)),maxTokens:Number(arg('max-tokens',5000)),maxRequests:jobs.length*3});const responses=[];
  for(const [i,job] of jobs.entries()){console.error(`[${i+1}/${jobs.length}] ${job.input.name||job.id}`);let raw;for(let attempt=0;attempt<2;attempt++){raw=await provider.complete(job.messages,undefined,characterResponseFormat());try{normalizeCharacter(raw,pack,job.input);break;}catch(error){if(attempt)throw Error(`${job.id}: ${error.message}`);job.messages.push({role:'assistant',content:raw},{role:'user',content:`Return a complete corrected JSON object. Validation failed: ${error.message}`});}}responses.push({id:job.id,response:raw});}
  const batch=batchOf(pack,jobs,responses,{provider:model});writeNew(required('out'),batch);console.log(`Wrote ${batch.entries.filter(x=>x.status==='pending').length} reviewable characters to ${resolve(required('out'))}`);
 }else if(command==='ingest'){
  const file=readJson(required('jobs'));if(file?.format!=='story-framework-character-jobs'||file.version!==1)throw Error('Not a character jobs file');if(file.source?.packId!==pack.id||JSON.stringify(file.source.actorIds)!==JSON.stringify(pack.actors.map(a=>a.id)))throw Error('Jobs were prepared for a different or changed pack');const responses=readJson(required('responses'));if(!Array.isArray(responses))throw Error('Responses must be a JSON array');const batch=batchOf(pack,file.jobs,responses,{provider:'external-agent'});writeNew(required('out'),batch);const failed=batch.entries.filter(x=>x.status==='failed');console.log(`Wrote ${batch.entries.length-failed.length} reviewable characters to ${resolve(required('out'))}${failed.length?`; ${failed.length} failed validation`:''}`);
 }else if(command==='apply'){
  const batch=readJson(required('batch'));assertSource(pack,batch);const selected=batch.entries.filter(x=>x.status==='approved'||flag('all')&&x.status==='pending');if(!selected.length)throw Error('No approved characters; mark entries approved or pass --all');const next=structuredClone(pack);for(const entry of selected){const actor=normalizeCharacter(entry.value,next,entry.value);next.actors.push(actor);}validatePack(next,registry);writeNew(required('out'),next);console.log(`Wrote ${selected.length} characters to ${resolve(required('out'))}`);
 }else throw Error(`Unknown command: ${command}`);
}catch(error){console.error(`ERROR: ${error.message}`);process.exitCode=1;}
