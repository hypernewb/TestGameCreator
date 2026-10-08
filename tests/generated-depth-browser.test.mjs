import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {browser} from '../scripts/visual-fixtures/browser.mjs';

test('enrich browser: opt in, review every field, accept/reject, save and reopen',{timeout:120000},async()=>{
 const dir=fs.mkdtempSync(join(tmpdir(),'sf-depth-browser-'));let calls=0;const app=createApp({dataPath:':memory:',scenarioDir:dir,startupAsk:async(messages,schema)=>{calls++;assert.ok(!schema.properties['pilot:backstory']);return {'pilot:goal':'Find the lost chart at the dock.','pilot:style':'Folds receipts while thinking.'};}});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;let b;
 const api=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const x=await r.json();assert.equal(r.status,200,JSON.stringify(x));return x;};
 try{const d=await api('/api/studio/create',{}),p=d.pack;p.actors.push({id:'pilot',name:'Pilot',location:p.locations[0].id,backstory:'',traits:['curious','practical']});await api('/api/studio/save',{id:d.id,pack:p,revision:d.updated});
 b=await browser(process.env.STORY_VISUAL_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe',{args:process.env.STORY_VISUAL_NO_SANDBOX==='1'?['--no-sandbox']:[]});await b.call('Network.setBlockedURLs',{urls:['https://*']});await b.call('Page.addScriptToEvaluateOnNewDocument',{source:`const real=fetch;window.fetch=async(...args)=>{const r=await real(...args);if(args[0]==='/api/bootstrap'){const d=await r.json();d.ai.setupRequired=false;return new Response(JSON.stringify(d));}return r;};`});
 const click=selector=>b.evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`),open=async()=>{await b.wait(`document.querySelector('#draft-list option[value="${d.id}"]')`);await b.evaluate(`document.getElementById('draft-list').value=${JSON.stringify(d.id)}`);await click('#open');await b.wait('document.getElementById("enrich-cast")');};
 await b.call('Page.navigate',{url:base+'/studio.html'});await open();assert.equal(calls,0);await click('#enrich-cast');await b.wait('document.getElementById("draft-fields-1")');assert.equal(calls,1);assert.match(await b.evaluate('document.getElementById("draft-fields-0").textContent'),/Find the lost chart/);
 for(const [index,status] of [[0,'approved'],[1,'rejected']])await b.evaluate(`(()=>{const e=document.querySelector('#draft-fields-${index} select');e.value=${JSON.stringify(status)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await b.evaluate(`Array.from(document.querySelectorAll('button')).find(e=>e.textContent==='Apply approved').click()`);await b.wait('!document.getElementById("draft-fields-0")');await click('#save');await b.wait(`document.getElementById('studio-status').textContent==='Draft saved.'`);let saved=JSON.parse(fs.readFileSync(join(dir,'drafts',d.id+'.json'))).pack;assert.equal(saved.actors.find(a=>a.id==='pilot').goal,'Find the lost chart at the dock.');assert.equal(saved.actors.find(a=>a.id==='pilot').style,undefined);assert.equal(saved.actors.find(a=>a.id==='pilot').backstory,'');
 await b.call('Page.reload');await open();assert.equal(calls,1);saved=JSON.parse(fs.readFileSync(join(dir,'drafts',d.id+'.json'))).pack;assert.equal(saved.actors.find(a=>a.id==='pilot').goal,'Find the lost chart at the dock.');assert.deepEqual(b.errors,[]);assert.equal(app.store.list().length,0);
 }finally{if(b)await b.close();await new Promise(r=>app.server.close(r));app.store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
