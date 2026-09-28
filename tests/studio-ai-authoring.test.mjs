import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';

test('Studio AI scene generation repairs invalid JSON and returns a validated candidate',async()=>{
 const pack=JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8')),dir=mkdtempSync(join(tmpdir(),'studio-ai-'));let calls=0;
 const valid={characters:[],scenes:[{id:'ai-workshop-intro',title:'A careful question',opening:'Ada looks up from the display.',trigger:{event:'core.inspected',match:{location:'workshop'}},when:{location:'workshop'},pages:[{speaker:'ada',text:'Are you here to help?',stage:['show:ada']}],choices:[{id:'help',label:'Offer to help',result:'Ada accepts your offer.',effects:[{type:'memory',character:'ada',text:'The player offered to help with the display.'}]},{id:'decline',label:'Step away',result:'You leave Ada to her work.',effects:[]}]}]};
 const fetchImpl=async url=>{if(!String(url).endsWith('/v1/chat/completions'))return new Response('{}',{status:404});calls++;const value=calls===1?{characters:[],scenes:[{id:'broken'}]}:valid;return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'bionic',fetchImpl,maxTokens:4096}),app=createApp({dataPath:':memory:',scenarioDir:dir,provider});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const base=`http://127.0.0.1:${app.server.address().port}`,response=await fetch(base+'/api/studio/ai-scene',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pack,brief:'Ada asks whether the player will help.'})}),body=await response.json();assert.equal(response.status,200);assert.equal(body.scene.id,'ai-workshop-intro');assert.equal(calls,2);}finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});

test('Studio proposal routes review, regenerate one entry with the connected model, and apply (forced when the scenario changed)',async()=>{
 const {createProposal}=await import('../packages/ai/bulk-authoring.mjs'),pack=JSON.parse(readFileSync(new URL('../packs/activity-workshop.json',import.meta.url),'utf8')),dir=mkdtempSync(join(tmpdir(),'studio-review-'));let calls=0;
 const scene={id:'ada-asks',title:'A careful question',opening:'Ada looks up.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub'},pages:[{speaker:'ada',text:'Help me?'}],choices:[{id:'help',label:'Help',result:'Ada smiles.',effects:[]},{id:'no',label:'Not now',result:'You leave.',effects:[]}]};
 const fetchImpl=async(url,init)=>{if(!String(url).endsWith('/v1/chat/completions'))return new Response('{}',{status:404});calls++;assert.match(init.body,/Warmer please/);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({characters:[],scenes:[{...scene,title:'A warmer question'}]})},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'bionic',fetchImpl,maxTokens:4096}),app=createApp({dataPath:':memory:',scenarioDir:dir,provider});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=()=>`http://127.0.0.1:${app.server.address().port}`,post=async(path,body)=>{const r=await fetch(base()+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{const proposal=createProposal(pack,{scenes:[scene]}),review=await post('/api/studio/proposal/review',{pack,proposal,play:false});assert.equal(review.status,200);assert.deepEqual(review.data.entries.map(e=>[e.id,e.errors.length]),[['ada-asks',0]]);
  const re=await post('/api/studio/proposal/regenerate',{pack,proposal,kind:'scenes',index:0,note:'Warmer please'});assert.equal(re.status,200);assert.equal(calls,1);assert.equal(re.data.proposal.scenes[0].value.title,'A warmer question');assert.equal(re.data.review.entries.length,1);
  const approved={...re.data.proposal,scenes:[{...re.data.proposal.scenes[0],status:'approved'}]},edited={...pack,subtitle:'edited'};
  assert.equal((await post('/api/studio/proposal/apply',{pack:edited,proposal:approved})).status>=400,true);
  const applied=await post('/api/studio/proposal/apply',{pack:edited,proposal:approved,force:true});assert.equal(applied.status,200);assert.ok(applied.data.pack.scriptedScenes.some(s=>s.title==='A warmer question'));
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
