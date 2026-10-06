import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,writeFileSync,unlinkSync,mkdirSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createApp} from '../server.mjs';import {browser} from '../scripts/visual-fixtures/browser.mjs';import {fixture} from './ui-live-fixture.mjs';
test('Studio Chat Lab: three mock turns update the side panel, export works and the stale banner appears',{timeout:180000},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'sf-character-lab-browser-')),probe=join(process.cwd(),'packages','__lab_stale_probe.tmp');
 const app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port,api=async(path,body)=>{const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}),d=await r.json();assert.equal(r.status,200,d.error);return d;};
 let b;
 try{
  const p=fixture();p.gameProject.conversationStyle='continuous';p.modules['social.conversation']='0.1.0';
  const draft=await api('/api/studio/create',{});await api('/api/studio/save',{id:draft.id,pack:p});
  assert.equal((await api('/api/lab/build')).stale,false,'a fresh server is not stale');
  b=await browser('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
  await b.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await b.call('Page.navigate',{url:base+'/studio.html'});
  await b.wait('document.querySelector("#draft-list")&&document.querySelector("#draft-list").options.length>1');
  await b.evaluate(`document.querySelector('#draft-list').value=${JSON.stringify(draft.id)};document.querySelector('#open').click();`);
  await b.wait('!document.querySelector("#editor").hidden&&document.querySelector("#fields").children.length>3');
  await b.evaluate(`[...document.querySelectorAll('#fields details.studio-section')].find(d=>d.querySelector("summary")?.textContent.includes("Character Chat Lab")).open=true;`);
  await b.wait('document.querySelector("#lab-start")&&!document.querySelector("#lab-source").disabled');
  await b.wait(`[...document.querySelector('#lab-source').options].some(o=>o.value==='draft')`);
  await b.evaluate(`document.querySelector('#lab-source').value='draft';document.querySelector('#lab-source').dispatchEvent(new Event('change'));`);
  await b.wait('document.querySelector("#lab-npc").options.length>=2');
  await b.evaluate(`document.querySelector('#lab-npc').selectedIndex=1;document.querySelector('#lab-npc').dispatchEvent(new Event('change'));`);
  await b.evaluate(`document.querySelector('#lab-provider').value='mock';document.querySelector('#lab-start').click();`);
  await b.wait('!document.querySelector("#lab-send").disabled');
  assert.match(await b.evaluate(`document.querySelector('#lab-build').textContent`),/server started .* git /,'build stamp with server time, git hash and prompt hash');
  assert.match(await b.evaluate(`document.querySelector('#lab-status').textContent`),/Lab started/);
  const texts=['Hi — I don\'t think we\'ve met yet.','What do you like about this place?','Tell her I am glad I ran into you today.'];
  for(const [i,text] of texts.entries()){
   await b.evaluate(`document.querySelector('#lab-input').value=${JSON.stringify(text)};document.querySelector('#lab-send').click();`);
   await b.wait(`document.querySelectorAll('#lab-chat article').length===${i+1}`);
   await b.wait(`!document.querySelector('#lab-send').disabled`);
   assert.match(await b.evaluate(`document.querySelectorAll('#lab-chat article')[${i}].textContent`),/Turn \d+/,'the reply landed in the pane');
   assert.match(await b.evaluate(`document.querySelector('#lab-panel').textContent`),/Stage —|Relationships/,'the side panel updates every turn');
  }
  assert.match(await b.evaluate(`document.querySelector('#lab-panel').textContent`),/Nerve/,'stats, hidden ones included, are shown');
  await b.evaluate(`document.querySelector('#lab-controls').hidden=false;`);
  await b.evaluate(`document.querySelector('[data-skip="hour"]').click();`);
  await b.wait(`document.querySelector('#lab-status').textContent.includes('Skipped hour')`);
  assert.match(await b.evaluate(`document.querySelector('#lab-panel').textContent`),/· (Morning|Afternoon|Evening) ·/,'the snapshot shows the new time');
  await b.evaluate(`document.querySelector('#lab-export').click();`);
  await b.wait(`!document.querySelector('#lab-export-text').hidden`);
  const exported=await b.evaluate(`document.querySelector('#lab-export-text').value`);
  assert.match(exported,/## Transcript/);assert.match(exported,/Turn 3/);assert.match(exported,/glad I ran into you/);
  writeFileSync(probe,'probe');
  try{
   assert.equal((await (await fetch(base+'/api/lab/build')).json()).stale,true,'a file touched under packages/ after server start marks the build stale');
   await b.evaluate(`document.querySelector('#lab-build-refresh').click();`);
   await b.wait('!document.querySelector("#lab-banner").hidden');
   assert.match(await b.evaluate(`document.querySelector('#lab-banner').textContent`),/server older than files on disk/);
  }finally{unlinkSync(probe);}
  await b.evaluate(`document.querySelector('#lab-build-refresh').click();`);
  await b.wait('document.querySelector("#lab-banner").hidden');
  mkdirSync('artifacts/character-lab',{recursive:true});
  writeFileSync('artifacts/character-lab/browser.png',Buffer.from((await b.call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(b.errors,[]);
 }finally{await b?.close();await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});try{unlinkSync(probe);}catch{}}
});
