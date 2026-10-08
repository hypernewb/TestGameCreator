import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import * as recovery from '../public/studio-recovery.mjs';
import * as systems from '../public/studio-systems.mjs';
import * as rules from '../public/studio-rules.mjs';
import * as cardPresets from '../public/card-presets.mjs';
import * as weekly from '../public/weekly-routines.mjs';
import {CHARACTER_TRAITS,TRAIT_DESCRIPTIONS} from '../public/character-traits.mjs';
import {mountAdvanced} from '../public/studio-advanced.mjs';
import {createApp} from '../server.mjs';

// GC5.3 / GC5.4: Save and Apply ownership and raw-buffer handling in public/studio.mjs.
// Drives the real studio.mjs in a vm with DOM stubs against a real in-memory server.
const studioSource=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');

class Element{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.value='';this.textContent='';}append(...xs){for(const x of xs){if(x.parentNode)x.parentNode.children=x.parentNode.children.filter(y=>y!==x);x.parentNode=x.parentElement=this;this.children.push(x);}}replaceChildren(...xs){this.children=[];this.append(...xs);}prepend(...xs){this.children.unshift(...xs);}setAttribute(){}addEventListener(type,fn){this['on'+type]=fn;}click(){return this.onclick?.();}}
const all=e=>[e,...e.children.flatMap(all)];

function studioPage(d,disk,fetch){
 const ids=new Map(),doc={getElementById:id=>{if(!ids.has(id))ids.set(id,new Element('div'));return ids.get(id);},createElement:tag=>new Element(tag),addEventListener:(type,fn)=>events.set(type,fn)},stubs={};
 for(const m of studioSource.matchAll(/^import \{([^}]+)\}.*$/gm))for(const name of m[1].split(',').map(x=>x.trim()))stubs[name]=()=>{};
 const mounts={mountSystems:systems.mountSystems,mountRules:rules.mountRules,mountAdvanced,mountRecovery:recovery.mountRecovery};
 const ctx={...stubs,validateWeeklyRoutines:weekly.validateWeeklyRoutines,...cardPresets,...systems,...rules,...recovery,document:doc,localStorage:disk,structuredClone,console,fetch,setTimeout:fn=>fn(),addEventListener:()=>{},Blob,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}}};
 for(const [name,fn] of Object.entries(mounts))ctx[name]=(parent,opts)=>fn(parent,{...opts,document:doc});
 const context=vm.createContext(Object.assign(ctx,{CHARACTER_TRAITS,TRAIT_DESCRIPTIONS}));
 vm.runInContext(studioSource.replace(/^import .*;\r?$/gm,'').replace('refresh().catch(fail);',''),context);
 if(d){context.fixture=structuredClone(d);vm.runInContext('draft=fixture;render();',context);}
 const run=s=>vm.runInContext(s,context);
 const btn=id=>ids.get(id);
 const text=()=>[...ids.values()].map(e=>String(e.textContent||'')).join('\n');
 return {ids,context,run,btn,text,status:()=>ids.get('studio-status').textContent,type(id,value){const e=ids.get(id)||doc.getElementById(id);e.value=value;e.oninput?.();}};
}

async function setup(t,hold){
 const dir=mkdtempSync(join(tmpdir(),'gc53-save-')),app=createApp({dataPath:':memory:',scenarioDir:dir});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});
 const base='http://127.0.0.1:'+app.server.address().port,real=(path,opts)=>fetch(base+path,opts);
 const post=async(path,body)=>{const r=await real(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const stored=async id=>(await real('/api/studio/get?id='+id)).json();
 const created=(await post('/api/studio/create',{mode:'blank'})).data;
 // holds the next request to `path`: the server still handles it, only the response is delayed (or replaced).
 const holds=[];
 const holdNext=path=>{let sent,release;const h={path,sentP:new Promise(r=>sent=r),release:()=>release(),gate:new Promise(r=>release=r),sent,calls:0};holds.push(h);return h;};
 const calls=[];
 const net=async(path,opts)=>{calls.push(path);const h=holds.find(x=>x.path===path&&!x.done);if(!h)return real(path,opts);h.done=true;if(h.fake){h.sent();await h.gate;return {ok:true,status:200,json:async()=>h.fake};}const r=await real(path,opts);h.sent();await h.gate;return r;};
 const page=studioPage(created,{getItem:()=>null,setItem(){}},net);
 return {page,post,stored,created,holdNext,calls,base};
}

test('GC5.3 delayed Save reports the saved snapshot and keeps a newer edit pending',async t=>{
 const {page,stored,created,holdNext}=await setup(t);
 page.run('draft.pack.title="Snapshot A"');
 const h=holdNext('/api/studio/save'),p=page.btn('save').onclick();await h.sentP;
 page.run('draft.pack.title="Newer B"');h.release();await p;
 assert.match(page.status(),/Saved snapshot of Snapshot A\. Newer local edits are still unsaved/);
 assert.equal(page.run('draft.pack.title'),'Newer B','newer local edit must stay in the open draft');
 const s=await stored(created.id);assert.equal(s.pack.title,'Snapshot A');
 assert.equal(page.run('draft.updated'),s.updated,'the saved revision is adopted so the next Save is not stale');
 await page.btn('save').onclick();
 assert.equal(page.status(),'Draft saved.');assert.equal((await stored(created.id)).pack.title,'Newer B');
});

test('GC5.3 Open or New cannot switch project while a Save response is still pending',async t=>{
 const {page,stored,created,holdNext}=await setup(t);
 page.run('draft.pack.title="In flight"');
 const h=holdNext('/api/studio/save'),p=page.btn('save').onclick();await h.sentP;
 await page.btn('open').onclick();
 assert.match(page.status(),/already running/);
 assert.equal(page.run('draft.id'),created.id);
 h.release();await p;
 assert.equal((await stored(created.id)).pack.title,'In flight');
});

test('GC5.3 failed validation shows an error and the last valid save stays intact',async t=>{
 const {page,stored,created}=await setup(t);
 page.run('draft.pack.title="Valid save"');await page.btn('save').onclick();
 assert.equal(page.status(),'Draft saved.');
 page.run('draft.pack.title="Broken"; draft.pack.gameProject={weeklyRoutines:"not a list"}');
 await page.btn('save').onclick();
 assert.notEqual(page.status(),'Draft saved.');assert.ok(page.status().length>0);
 assert.equal((await stored(created.id)).pack.title,'Valid save');
});

test('GC5.3 pending weekly routine edit blocks Save with an error, not success',async t=>{
 const {page,stored,created}=await setup(t);
 page.run('draft.pack.title="Weekly blocked"; weeklyState().pending={x:1}');
 await page.btn('save').onclick();
 assert.match(page.status(),/Resolve or cancel the pending weekly routine edit/);
 assert.notEqual((await stored(created.id)).pack.title,'Weekly blocked');
});

test('GC5.3 pending system and visual-rule buffers block Save and Check',async t=>{
 const {page,stored,created}=await setup(t);
 page.run('draft.pack.title="Systems blocked"');
 systems.restoreSystemBuffers(created.id,[['probe',{value:1}]]);
 await page.btn('save').onclick();assert.match(page.status(),/pending system forms/);
 await page.btn('check').onclick();assert.match(page.status(),/pending system forms/);
 systems.restoreSystemBuffers(created.id,[]);
 rules.restoreRuleBuffers(created.id,[['rule-probe',{value:1}]]);
 await page.btn('save').onclick();assert.match(page.status(),/pending visual rule forms/);
 rules.restoreRuleBuffers(created.id,[]);
 assert.notEqual((await stored(created.id)).pack.title,'Systems blocked');
});

test('GC5.3 an AI-draft Apply that returns after a later edit does not overwrite that edit',async t=>{
 const {page,stored,created,holdNext}=await setup(t);
 page.run('draft.pack.title="Before apply"; proposal={source:{},actors:[{status:"approved"}]}; review={entries:[{kind:"actors",index:0,status:"approved",errors:[],warnings:[],adult:false,label:"Ada"}],route:[],errors:[],calendar:[]}; expandedSections.add("AI drafts"); render();');
 const apply=[...page.ids.values()].flatMap(all).find(e=>e.textContent==='Apply approved');
 assert.ok(apply,'Apply approved button rendered');
 const h=holdNext('/api/studio/proposal/apply');h.fake={pack:{...structuredClone(created.pack),title:'Applied from proposal'}};
 const p=apply.onclick();await h.sentP;
 page.run('draft.pack.title="Edited during apply"');h.release();await p;
 assert.equal(page.run('draft.pack.title'),'Edited during apply','a late Apply response must not replace newer edits');
 assert.match(page.status(),/Project changed while applying drafts/);
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
});

test('GC5.3 Apply approved while a Save is pending is refused and sends nothing',async t=>{
 const {page,calls,created,holdNext}=await setup(t);
 page.run('draft.pack.title="Saving"; proposal={source:{},actors:[{status:"approved"}]}; review={entries:[{kind:"actors",index:0,status:"approved",errors:[],warnings:[],adult:false,label:"Ada"}],route:[],errors:[],calendar:[]}; expandedSections.add("AI drafts"); render();');
 const apply=[...page.ids.values()].flatMap(all).find(e=>e.textContent==='Apply approved');
 const h=holdNext('/api/studio/save'),p=page.btn('save').onclick();await h.sentP;
 await apply.onclick();
 assert.match(page.status(),/already running/);
 assert.ok(!calls.includes('/api/studio/proposal/apply'),'no proposal apply request while Save is pending');
 h.release();await p;
});

test('GC5.3 Apply approved with no edit in between applies the draft and says to Save',async t=>{
 const {page,stored,created,holdNext}=await setup(t);
 page.run('proposal={source:{},actors:[{status:"approved"}]}; review={entries:[{kind:"actors",index:0,status:"approved",errors:[],warnings:[],adult:false,label:"Ada"}],route:[],errors:[],calendar:[]}; expandedSections.add("AI drafts"); render();');
 const apply=[...page.ids.values()].flatMap(all).find(e=>e.textContent==='Apply approved');
 const h=holdNext('/api/studio/proposal/apply');h.fake={pack:{...structuredClone(created.pack),title:'Applied from proposal'}};
 const p=apply.onclick();await h.sentP;h.release();await p;
 assert.equal(page.run('draft.pack.title'),'Applied from proposal');
 assert.match(page.status(),/Applied 1 draft\. Save the draft to keep them/);
 assert.equal((await stored(created.id)).pack.title,created.pack.title,'Apply alone does not save; the server copy is unchanged');
});

test('GC5.4 invalid JSON in the project buffer blocks Save, Check and Publish with a clear message',async t=>{
 const {page,stored,created}=await setup(t);
 page.type('json','{"pack": ');
 await page.btn('save').onclick();assert.match(page.status(),/Apply or discard pending raw JSON/);
 await page.btn('check').onclick();assert.match(page.status(),/Apply or discard pending raw JSON/);
 await page.btn('publish').onclick();assert.match(page.status(),/Apply or discard pending raw JSON/);
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
});

test('GC5.4 valid-but-unapplied JSON blocks Save until Apply, then Save keeps the applied data',async t=>{
 const {page,stored,created}=await setup(t);
 const pack=JSON.parse(page.run('JSON.stringify(draft.pack)'));pack.title='From JSON';
 page.type('json',JSON.stringify(pack,null,2));
 await page.btn('save').onclick();assert.match(page.status(),/Apply or discard pending raw JSON/);
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
 page.btn('apply-json').onclick();assert.equal(page.run('draft.pack.title'),'From JSON');
 await page.btn('save').onclick();assert.equal(page.status(),'Draft saved.');
 assert.equal((await stored(created.id)).pack.title,'From JSON');
});

test('GC5.4 invalid JSON Apply keeps the buffer and the error, and Save stays blocked',async t=>{
 const {page,stored,created}=await setup(t);
 page.type('json','{bad');
 page.btn('apply-json').onclick();
 assert.notEqual(page.status(),'JSON applied. Save the draft or check for errors.');
 assert.ok(page.run('rawSessions.has(draft.id)'),'the raw buffer is kept for correction');
 await page.btn('save').onclick();assert.match(page.status(),/Apply or discard pending raw JSON/);
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
});

test('GC5.4 a non-object project JSON is refused on Apply and not applied',async t=>{
 const {page,stored,created}=await setup(t);
 page.type('json','[]');
 page.btn('apply-json').onclick();
 assert.match(page.status(),/Project JSON must be one object/);
 assert.ok(page.run('Array.isArray(draft.pack)')===false,'draft.pack is not replaced by the array');
 assert.ok(page.run('rawSessions.has(draft.id)'),'the raw buffer is kept');
 await page.btn('save').onclick();assert.notEqual(page.status(),'Draft saved.');
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
});

test('GC5.4 discard removes the raw buffer and Save then saves only the applied form data',async t=>{
 const {page,stored,created}=await setup(t);
 page.run('draft.pack.title="Form title"');
 page.type('json','{"title":"Discarded JSON"}');
 page.btn('discard-json').onclick();
 assert.ok(!page.run('rawSessions.has(draft.id)'));
 await page.btn('save').onclick();assert.equal(page.status(),'Draft saved.');
 assert.equal((await stored(created.id)).pack.title,'Form title');
});

test('GC5.4 Apply after the project changed underneath the raw edit is refused',async t=>{
 const {page,stored,created}=await setup(t);
 page.type('json',JSON.stringify({...created.pack,title:'Stale JSON'}));
 page.run('draft.pack.title="Changed under raw"');
 page.btn('apply-json').onclick();
 assert.match(page.status(),/Project changed after this raw JSON edit/);
 assert.equal(page.run('draft.pack.title'),'Changed under raw');
 assert.equal((await stored(created.id)).pack.title,created.pack.title);
});

// Startup profile buffers live in a closure in studio.mjs (startupTexts) and need the candidate UI to fill,
// so they are checked by reading the guard, not by driving it.
test('GC5.4 startup Save refuses while profile JSON or project JSON is pending (read-only guard check)',()=>{
 const start=studioSource.indexOf("$('startup-save').onclick=");assert.ok(start>0);
 const line=studioSource.slice(start,studioSource.indexOf('\n',start));
 assert.match(line,/startupTexts\.size\)throw Error\('Apply or discard pending profile JSON before Save/);
 assert.match(line,/rawSessions\.has\(draft\?\.id\)\)throw Error\('Apply or discard pending project JSON first/);
});

// Decision needed (GC5.3): Save stores structurally incomplete packs by design (tests/studio-draft-revision.test.mjs),
// so a Save of an invalid project can show success while the last fully valid save is replaced. Decide whether Save
// should refuse validatePack failures or keep the current working-copy behaviour and rely on Check/Publish.
test.todo('GC5.3 decision: Save of a validation-failing project should not replace the last valid save');
