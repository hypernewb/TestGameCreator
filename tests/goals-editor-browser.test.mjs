import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {browser as launchBrowser} from '../scripts/visual-fixtures/browser.mjs';

test('goal editor authors, validates and reopens a non-campus goal in a real browser',{timeout:45000},async()=>{
 const candidates=[process.env.CHROME_PATH,process.env.EDGE_PATH,'C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/chromium','/usr/bin/google-chrome'].filter(Boolean);let browser;
 for(const path of candidates){try{await access(path);browser=path;break;}catch{}}
 assert.ok(browser,'Set CHROME_PATH or EDGE_PATH to run the goal editor browser acceptance test');
 const dep=await readFile(new URL('../public/profile-tags.mjs',import.meta.url),'utf8'),script=await readFile(new URL('../public/sheet-editor.mjs',import.meta.url),'utf8'),html=`<!doctype html><html><body><main></main><pre id="result">WAIT</pre><script type="module">
 import {createSheet,mountSheetEditor,saveSheets,loadSheets} from '/sheet-editor.mjs';
 try{
  const sheet=createSheet('maker');sheet.personality.traits=['curious','practical'];sheet.source.actor={custom:'preserved'};
  const pack={playerId:'traveler',modules:{goals:'0.1.0'},actors:[{id:'traveler',name:'Traveler'},{id:'maker',name:'Maker'}],locations:[{id:'dock',name:'Dock'}],storyVariables:[{id:'parts',name:'Parts'},{id:'launch',name:'Launch'}],characterSheets:[sheet]};let changes=0;
  const main=document.querySelector('main'),button=name=>{const b=[...main.querySelectorAll('button')].find(b=>b.textContent===name);if(!b)throw Error('Missing button '+name);b.click();},field=(name,value)=>{const label=[...main.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent===name);if(!label)throw Error('Missing field '+name);const input=label.querySelector('input,select,textarea');input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},check=(ok,msg)=>{if(!ok)throw Error(msg);};
  mountSheetEditor(main,pack,'maker',()=>changes++);button('Arc & payoffs');button('Add character goal');button('Apply sheet to draft');check(changes===0&&!pack.characterSheets[0].goal,'invalid draft mutated the pack');
  field('Goal title','Build a boat');field('Why this matters','See the islands');field('Step 1 title','Gather parts');field('Step 1 hint','Bring the parts');field('Step 1 completes by','flags');field('Step 1 flag','parts');field('Step 1 flag value','true');button('Add step 1 reward');field('Step 1 reward 1 type','unlock');field('Step 1 reward flag','launch');field('Step 2 title','Discuss the design');field('Step 2 hint','boat design');button('Add goal step');field('Step 3 title','Name the boat');field('Step 3 hint','boat name');button('Move step 3 up');button('Apply sheet to draft');
  check(changes===1,'valid goal was not applied');const saved=saveSheets(pack),loaded=loadSheets(saved),goal=loaded.characterSheets[0].goal;check(goal.steps.length===3&&goal.steps[1].id==='step-3','stable step IDs/order lost');check(goal.steps[0].complete.flags.parts===true&&goal.steps[0].reward[0].type==='unlock','condition or typed reward lost');check(loaded.characterSheets[0].source.actor.custom==='preserved','unrelated source lost');
  main.replaceChildren();mountSheetEditor(main,loaded,'maker');button('Arc & payoffs');check([...main.querySelectorAll('input')].some(i=>i.value==='Build a boat'),'saved goal did not reopen');check(saveSheets(loaded)===saved,'opening mutated saved data');document.querySelector('#result').textContent='GOAL_EDITOR_PASS';
 }catch(e){document.querySelector('#result').textContent='GOAL_EDITOR_FAIL: '+e.stack;}
 </script></body></html>`;
 const server=createServer((req,res)=>{res.setHeader('Content-Type',req.url.endsWith('.mjs')?'text/javascript':'text/html');res.end(req.url==='/sheet-editor.mjs'?script:req.url==='/profile-tags.mjs'?dep:html);});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
 try{b=await launchBrowser(browser,{args:process.platform==='win32'?['--no-sandbox']:[]});await b.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});await b.wait("document.querySelector('#result')?.textContent.startsWith('GOAL_EDITOR_')");assert.equal(await b.evaluate("document.querySelector('#result').textContent"),'GOAL_EDITOR_PASS');assert.deepEqual(b.errors,[]);}
 finally{await b?.close();await new Promise(r=>server.close(r));}
});
