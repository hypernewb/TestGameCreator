import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const key='test-key-123',settings={mode:'cloud',preset:'gemini',key};
test('first-run setup, single-request probes, safe settings and restart',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'story-first-run-')),realFetch=globalThis.fetch,logs=[],warn=console.warn,log=console.log;let calls=0,status=200,offline=false,last,body=null;
 console.warn=(...x)=>logs.push(x.join(' '));console.log=(...x)=>logs.push(x.join(' '));
 globalThis.fetch=async(url,init)=>{calls++;last={url,init};if(offline)throw Error(key);return new Response(JSON.stringify(status===200?body||{choices:[{message:{content:key}}]}:{error:{message:key}}),{status,headers:{'Content-Type':'application/json'}});};
 let app;
 const start=async()=>{app=createApp({dataPath:join(dir,'campaigns.sqlite'),scenarioDir:join(dir,'scenarios')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));};
 const stop=async()=>{await new Promise(r=>app.server.close(r));app.store.close();};
 const request=async(path,body)=>{const r=await realFetch(`http://127.0.0.1:${app.server.address().port}/api/${path}`,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),raw=await r.text();assert.ok(!raw.includes(key),raw);return JSON.parse(raw);};
 try{await start();assert.equal((await request('bootstrap')).ai.setupRequired,true);const cfg=await request('ai/config');assert.deepEqual(Object.keys(cfg.connectionPresets),['gemini','openrouter','lmstudio','custom']);
  assert.equal((await request('ai/connect-test',settings)).result,'works');assert.equal(calls,1);assert.equal(last.init.headers.Authorization,`Bearer ${key}`);assert.ok(!String(last.url).includes(key));assert.equal(JSON.parse(last.init.body).max_tokens,8);
  for(const [code,result] of [[401,'bad key'],[403,'bad key'],[429,'rate limited'],[500,'unavailable']]){status=code;const before=calls;assert.equal((await request('ai/connect-test',settings)).result,result);assert.equal(calls,before+1);}offline=true;assert.equal((await request('ai/connect-test',settings)).result,'no internet');offline=false;status=200;body={choices:[{message:{content:'',reasoning_content:'Thinking'}}]};assert.equal((await request('ai/connect-test',settings)).result,'works');body={choices:[{message:{content:''}}]};assert.equal((await request('ai/connect-test',settings)).result,'unavailable');body=null;
  const saved=await request('ai/config',settings);assert.equal(saved.keyLast4,'-123');assert.equal(saved.setupRequired,false);assert.equal((await request('bootstrap')).ai.setupRequired,false);assert.equal((await request('ai/config')).keyLast4,'-123');
  assert.equal((await request('ai/connect-test',{mode:'cloud',preset:'gemini'})).result,'works');await request('ai/context-size',{size:'minimal'});assert.equal((await request('ai/config')).keyLast4,'-123');await stop();await start();assert.equal((await request('bootstrap')).ai.setupRequired,false);assert.equal(app.service.provider.key,key);
  assert.equal((await request('ai/connect-test',{mode:'cloud',preset:'custom',endpoint:`https://example.com/?key=${key}`,model:'test',key})).result,'invalid settings');assert.ok(!logs.join('\n').includes(key));
  for(const preset of ['openrouter','custom']){assert.equal((await request('ai/connect-test',{mode:'cloud',preset,endpoint:'https://example.com/v1/chat/completions',model:'test',key})).result,'works');}
  await request('ai/config',{mode:'local',endpoint:'http://127.0.0.1:1234/v1',model:'test-local'});await stop();await start();assert.equal((await request('bootstrap')).ai.setupRequired,false);assert.equal((await request('ai/config')).model,'test-local');
 }finally{await stop();globalThis.fetch=realFetch;console.warn=warn;console.log=log;rmSync(dir,{recursive:true,force:true});}
});

test('three-step UI gates saving on a successful test and clears the key',async()=>{
 const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm'),{CONNECTION_PRESETS}=await import('../packages/ai/providers.mjs');
 const nodes=[];
 const el=(tag,text)=>{const n={tag,textContent:text||'',children:[],hidden:false,value:'',disabled:false,append(...xs){for(const x of xs){x.parent=this;this.children.push(x);}},prepend(x){x.parent=this;this.children.unshift(x);},replaceChildren(...xs){this.children=[];this.append(...xs);},setAttribute(){},closest(){return this.parent;},showModal(){this.open=true;},close(){this.open=false;}};nodes.push(n);return n;};
 const ids={'ai-form':el('form'),'ai-dialog':el('dialog'),welcome:el('section')},body=el('body'),requests=[];let result=false,boots=0;
 const api=async(path,data)=>{if(path==='/api/ai/config'&&!data)return {mode:'offline',connectionPresets:CONNECTION_PRESETS};requests.push({path,data});return path.endsWith('connect-test')?{ok:result,message:result?'Works!':'Bad key.'}:{ok:true};};
 const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8'),code=source.slice(source.indexOf('const setupDialog='),source.indexOf('let aiPresets='));
 const {openConnectionSetup,setupDialog}=runInNewContext(code+';({openConnectionSetup,setupDialog})',{el,api,$:id=>ids[id],document:{body},boot:async()=>{boots++;},showError:e=>{throw e;}});
 await openConnectionSetup(true);const button=t=>nodes.find(n=>n.tag==='button'&&n.textContent===t),step=nodes.find(n=>n.textContent==='Step 1 of 3'),keyInput=nodes.find(n=>n.type==='password');
 assert.equal(setupDialog.open,true);assert.equal(button('Cancel').hidden,true);let prevented=false;setupDialog.oncancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
 button('Next').onclick();assert.equal(step.textContent,'Step 2 of 3');assert.equal(nodes.find(n=>n.tag==='a').href,CONNECTION_PRESETS.gemini.keyUrl);keyInput.value=key;button('Next').onclick();assert.equal(step.textContent,'Step 3 of 3');assert.equal(button('Save and start playing').disabled,true);
 await button('Test connection').onclick();assert.equal(button('Save and start playing').disabled,true);result=true;await button('Test connection').onclick();assert.equal(button('Save and start playing').disabled,false);
 keyInput.oninput();assert.equal(button('Save and start playing').disabled,true);await button('Test connection').onclick();await button('Save and start playing').onclick();assert.equal(setupDialog.open,false);assert.equal(keyInput.value,'');assert.equal(boots,1);assert.equal(requests.at(-1).data.key,key);assert.equal(requests.at(-1).path,'/api/ai/config');
});
