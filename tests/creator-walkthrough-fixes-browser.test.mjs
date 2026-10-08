import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {browser} from '../scripts/visual-fixtures/browser.mjs';

async function run(entry,fn){const dir=mkdtempSync(join(tmpdir(),'sf-walkthrough-')),provider=new MockProvider();provider.interpret=provider.narrate=()=>{throw Error('Model calls forbidden');};const app=createApp({dataPath:':memory:',scenarioDir:dir,provider,drafter:()=>{throw Error('Generation forbidden');}});let b;await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;try{b=await browser(process.env.STORY_VISUAL_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');await b.call('Network.setBlockedURLs',{urls:['https://*']});await b.call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await b.call('Page.navigate',{url:base+'/'+entry+'.html'});await fn({b});assert.deepEqual(b.errors,[]);}finally{await b?.close();await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}}

const setField=(card,i,v)=>`(()=>{const el=[...document.querySelectorAll('.her')[${card}].querySelectorAll('input[type=text]')][${i}];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`;

test('creator walkthrough fixes: blank love interests block the build with a message, cards are labelled and highlights update in place, Start over clears the draft',{timeout:180000},async()=>run('creator',async({b})=>{
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.querySelectorAll('.her').length===4");
 assert.deepEqual(await b.evaluate("[...document.querySelectorAll('.her h3')].map(h=>h.textContent)"),['Love interest 1','Love interest 2','Love interest 3','Love interest 4']);
 assert.equal(await b.evaluate("document.querySelectorAll('.her.blank').length"),4);
 assert.equal(await b.evaluate("document.querySelector('.her .errs').hidden"),false);

 await b.evaluate(setField(0,0,'Ada Vale'));await b.evaluate(setField(0,1,'sea charts'));
 await b.wait("document.querySelectorAll('.her')[0].className==='her'");
 assert.equal(await b.evaluate("document.querySelector('.her .errs').hidden"),true);
 assert.equal(await b.evaluate("document.querySelectorAll('.her')[0].querySelector('h3').textContent"),'Love interest 1: Ada Vale');

 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.getElementById('status').textContent.includes('3 empty love-interest cards')");
assert.equal(await b.evaluate("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')"),false);
 assert.equal(await b.evaluate("document.querySelectorAll('.her').length"),4);

 for(let k=0;k<3;k++){await b.evaluate("(()=>{window.confirm=()=>true;const c=document.querySelectorAll('.her.blank')[0];[...c.querySelectorAll('button')].find(x=>x.textContent==='✕').click();return true;})()");await b.wait(`document.querySelectorAll('.her').length===${3-k}`);}
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 assert.deepEqual(await b.evaluate("[...document.querySelectorAll('ul.notes li')].map(l=>l.textContent)"),['place 1 had no name: called it \"Place 1\"','place 2 had no name: called it \"Place 2\"','no paid job was proposed: added \"Odd job\"']);

 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Next: Gameplay modules').click()");
 await b.wait("document.querySelector('details.campus')");
 assert.equal(await b.evaluate("document.querySelector('details.campus').open"),false);
 assert.equal(await b.evaluate("[...document.querySelectorAll('h3')].some(h=>h.textContent==='Added or changed by the builder')"),false);

 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Back: Draft').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Back to the proposal').click()");
 await b.wait("document.querySelector('#creator-next')?.textContent==='Next: Build structure'");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Back').click()");
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("window.confirm=()=>true;[...document.querySelectorAll('button')].find(x=>x.textContent==='Start over').click()");
 await b.wait("document.querySelector('#view textarea')?.value===''");
 assert.equal(await b.evaluate("localStorage.getItem('creator-draft')?.includes('\"spec\"')??false"),false);
}));

test('creator Game UI step: copy names the real Save button and screen labels match between the selector and the designer',{timeout:180000},async()=>run('creator',async({b})=>{
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.querySelectorAll('.her').length===4");
 for(let c=0;c<4;c++)await b.evaluate(setField(c,0,'Name '+c)+';'+setField(c,1,'topic '+c));
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Next: Gameplay modules').click()");
 await b.wait("document.querySelector('details.campus')");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Game UI')");
 const text=await b.evaluate("document.querySelector('#view').innerText");
 assert.doesNotMatch(text,/Save draft/);
 assert.match(text,/Save and start a campaign/);
 await b.evaluate("[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Edit Game UI here').click()");
 await b.wait("document.getElementById('ui-designer-screen')");
 const top=await b.evaluate("[...document.getElementById('ui-screen-select').options].map(o=>o.textContent)");
 const designer=await b.evaluate("[...document.getElementById('ui-designer-screen').options].map(o=>o.textContent)");
 assert.deepEqual(designer,top);
}));

test('creator review step: every select has an accessible name, mode options explain themselves, Save has no stale disabled reason',{timeout:180000},async()=>run('creator',async({b})=>{
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.querySelectorAll('.her').length===4");
 for(let c=0;c<4;c++)await b.evaluate(setField(c,0,'Name '+c)+';'+setField(c,1,'topic '+c));
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Next: Gameplay modules').click()");
 await b.wait("document.querySelector('details.campus')");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Game UI')");
 await b.evaluate("[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Next: Review / Save').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Review / Save')");
 const sel=await b.evaluate("[...document.querySelectorAll('#view select')].map(s=>({named:!!(s.labels.length||s.getAttribute('aria-label')),options:[...s.options].map(o=>o.textContent)}))");
 assert.ok(sel.length>0);
 assert.deepEqual(sel.filter(s=>!s.named),[]);
 const mode=sel.find(s=>s.options.includes('world setting (default)'));
 assert.ok(mode,'rung mode select present');
 assert.deepEqual(mode.options,['world setting (default)','free: typed, checkpoint cues','authored: choice scenes']);
 const save=await b.evaluate("(()=>{const x=[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Save and start a campaign');return {disabled:x.disabled,title:x.title}})()");
 assert.deepEqual(save,{disabled:false,title:''});
}));

test('creator review step: love-interest card titles drop the repeated name and mode badges, groups collapse with the first open',{timeout:180000},async()=>run('creator',async({b})=>{
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.querySelectorAll('.her').length===4");
 for(let c=0;c<4;c++)await b.evaluate(setField(c,0,'Name '+c)+';'+setField(c,1,'topic '+c));
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Next: Gameplay modules').click()");
 await b.wait("document.querySelector('details.campus')");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Game UI')");
 await b.evaluate("[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Next: Review / Save').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Review / Save')");
 const heads=await b.evaluate("[...document.querySelectorAll('#view .card h3')].map(h=>h.textContent)");
 const own=heads.filter(h=>!h.startsWith('Director'));
 assert.ok(own.includes('Profile'),heads.join('|'));
 assert.deepEqual(own.filter(h=>/ · |\(free\)|\(authored\)|_/.test(h)),[],own.join('|'));
 const groups=await b.evaluate("[...document.querySelectorAll('#view details.group')].map(d=>({open:d.open,summary:d.querySelector('summary').textContent,cards:d.querySelectorAll('.card').length}))");
 assert.match(groups[0].summary,/^World · 1 card$/,groups[0].summary);
 assert.equal(groups[0].open,true);assert.ok(groups.slice(1).every(g=>g.open===false),JSON.stringify(groups));
 assert.match(groups[1].summary,/^Name 0 · \d+ cards?$/,groups[1].summary);
 assert.equal(groups.reduce((n,g)=>n+g.cards,0),heads.length);
}));

test('creator review gate: a pending Game UI screen change blocks Save with a visible reason until it is applied or cancelled',{timeout:180000},async()=>run('creator',async({b})=>{
 await b.wait("document.querySelector('#view h2')?.textContent==='Premise'");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("document.querySelectorAll('.her').length===4");
 for(let c=0;c<4;c++)await b.evaluate(setField(c,0,'Name '+c)+';'+setField(c,1,'topic '+c));
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Draft the text')");
 await b.evaluate("[...document.querySelectorAll('button')].find(x=>x.textContent==='Next: Gameplay modules').click()");
 await b.wait("document.querySelector('details.campus')");
 await b.evaluate("document.querySelector('#creator-next').click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Game UI')");
 await b.evaluate("[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Edit Game UI here').click()");
 await b.wait("document.getElementById('ui-designer-screen')");
 await b.evaluate("(()=>{const s=document.getElementById('ui-designer-screen');s.value='wizard';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()");
 await b.evaluate("[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Next: Review / Save')?.click()");
 await b.wait("[...document.querySelectorAll('#view h2')].some(h=>h.textContent==='Review / Save')");
 const gate=await b.evaluate("(()=>{const x=[...document.querySelectorAll('#view button')].find(x=>x.textContent==='Save and start a campaign');return {disabled:x.disabled,title:x.title,warn:[...document.querySelectorAll('#view .errs')].map(e=>e.textContent)}})()");
 assert.equal(gate.disabled,true,JSON.stringify(gate));
 assert.match(gate.title,/pending Game UI edits/);
 assert.ok(gate.warn.some(t=>/Game UI edits are pending/.test(t)),JSON.stringify(gate.warn));
 assert.ok(gate.warn.some(t=>/Save waits until pending Game UI edits/.test(t)),JSON.stringify(gate.warn));
}));
