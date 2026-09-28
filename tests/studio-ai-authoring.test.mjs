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
