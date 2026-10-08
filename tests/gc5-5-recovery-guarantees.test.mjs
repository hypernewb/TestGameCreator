import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as recovery from '../public/studio-recovery.mjs';
import * as systems from '../public/studio-systems.mjs';
import * as rules from '../public/studio-rules.mjs';
import * as cardPresets from '../public/card-presets.mjs';
import {CHARACTER_TRAITS,TRAIT_DESCRIPTIONS} from '../public/character-traits.mjs';
import {mountAdvanced} from '../public/studio-advanced.mjs';
import {createApp} from '../server.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';

// Audit: docs/research/gc5-5-recovery-guarantees-2026-10-08.md (5 silent-loss cases).
// Cases 2-5 reproduce on this base but their fixes touch files outside the allowed edit list
// (public/creator.mjs) or need a recovery-design decision (startup inputs before first generate).
// They are marked todo so the suite stays green; remove the todo option when the fix lands.
const TODO={
 corrupt:'GC5.5 case 2: creator.mjs load/keep replaces a corrupt wizard record with defaults; fix needs an approved creator.mjs change',
 open:'GC5.5 case 3: creator.mjs openWorld replaces unsaved wizard state without confirm; fix needs an approved creator.mjs change',
 tabs:'GC5.5 case 4: creator.mjs has no storage listener; two wizard tabs last-write-wins; fix needs an approved creator.mjs change',
 startup:'GC5.5 case 5: startup inputs typed before the first generate are not captured; fix needs a recovery-design decision',
};

const studioSource=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
const creatorSource=readFileSync(new URL('../public/creator.mjs',import.meta.url),'utf8').replace(/^import .*;\r?$/gm,'');

class Element{constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.value='';this.textContent='';}append(...xs){for(const x of xs){if(x.parentNode)x.parentNode.children=x.parentNode.children.filter(y=>y!==x);x.parentNode=x.parentElement=this;this.children.push(x);}}replaceChildren(...xs){this.children=[];this.append(...xs);}prepend(...xs){this.children.unshift(...xs);}setAttribute(){}addEventListener(type,fn){this['on'+type]=fn;}click(){return this.onclick?.();}}
const all=e=>[e,...e.children.flatMap(all)];
const ok=data=>({ok:true,status:200,json:async()=>data});

function studioPage(d,disk,fetch){
 const ids=new Map(),events=new Map(),doc={getElementById:id=>{if(!ids.has(id))ids.set(id,new Element('div'));return ids.get(id);},createElement:tag=>new Element(tag),addEventListener:(type,fn)=>events.set(type,fn)},stubs={};
 for(const m of studioSource.matchAll(/^import \{([^}]+)\}.*$/gm))for(const name of m[1].split(',').map(x=>x.trim()))stubs[name]=()=>{};
 const mounts={mountSystems:systems.mountSystems,mountRules:rules.mountRules,mountAdvanced,mountRecovery:recovery.mountRecovery};
 const ctx={...stubs,...cardPresets,...systems,...rules,...recovery,document:doc,localStorage:disk,structuredClone,console,fetch,setTimeout:fn=>fn(),addEventListener:()=>{},Blob,URL:{createObjectURL:()=>'',revokeObjectURL:()=>{}}};
 for(const [name,fn] of Object.entries(mounts))ctx[name]=(parent,opts)=>fn(parent,{...opts,document:doc});
 const context=vm.createContext(Object.assign(ctx,{CHARACTER_TRAITS,TRAIT_DESCRIPTIONS}));
 vm.runInContext(studioSource.replace(/^import .*;\r?$/gm,'').replace('refresh().catch(fail);',''),context);
 if(d){context.fixture=structuredClone(d);vm.runInContext('draft=fixture;render();',context);}
 return {ids,context,events,get records(){return vm.runInContext('recovery.list()',context);}, type(id,value){const e=ids.get(id)||doc.getElementById(id);e.value=value;events.get('input')?.();}};
}

function creatorPage(rows,fetch=async p=>p.includes('/worlds')?ok({worlds:[]}):ok({drafter:false,modules:{}})){
 const els=new Map(),el=()=>({children:[],style:{},classList:{toggle(){}},value:'',textContent:'',disabled:false,replaceChildren(){},append(){},prepend(){},querySelectorAll:()=>[],setAttribute(){},addEventListener(){}}),get=id=>{if(!els.has(id))els.set(id,el());return els.get(id);};
 const confirms=[],disk={getItem:k=>rows.has(k)?rows.get(k):null,setItem:(k,v)=>rows.set(k,String(v))};
 const ctx=vm.createContext({document:{getElementById:get,createElement:()=>el(),addEventListener(){}},localStorage:disk,fetch,confirm:msg=>{confirms.push(msg);return false;},console,crypto:globalThis.crypto,mountUiProject(){},mountPortrait(){},Promise,JSON,Object,Array,Number,String,Error,Math,Set,Map,structuredClone,setTimeout,setImmediate,URL,scrollTo(){},location:{}});
 vm.runInContext(creatorSource+'\n__t={keep:()=>keep(),get S(){return S},set S(v){S=v},openWorld:id=>openWorld(id)};',ctx);
 return {t:ctx.__t,confirms,status:()=>get('status').textContent};
}

// Case 1: stale Studio save overwrites a newer saved draft.
test('GC5.5 case 1: a stale Studio save is refused and cannot overwrite a newer saved draft (already handled)',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'gc55-stale-')),app=createApp({dataPath:':memory:',scenarioDir:dir,provider:new MockProvider()});
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port,post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 const created=(await post('/api/studio/create',{mode:'blank'})).data,tabA=structuredClone(created.pack),tabB=structuredClone(created.pack);tabA.title='Tab A newer';tabB.title='Tab B stale';
 const newer=await post('/api/studio/save',{id:created.id,pack:tabA,revision:created.updated});assert.equal(newer.status,200);
 const stale=await post('/api/studio/save',{id:created.id,pack:tabB,revision:created.updated});
 assert.equal(stale.status,400);assert.match(stale.data.error,/Stale draft revision/);
 const stored=await (await fetch(base+'/api/studio/get?id='+created.id)).json();assert.equal(stored.pack.title,'Tab A newer');
});

// Case 5: startup text typed before the first generate is lost on refresh.
test('GC5.5 case 5: startup text typed before the first generate is kept in a browser recovery copy',{todo:TODO.startup},async t=>{
 const dir=mkdtempSync(join(tmpdir(),'gc55-startup-')),app=createApp({dataPath:':memory:',scenarioDir:dir,provider:new MockProvider()});
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+app.server.address().port,request=(path,opts)=>fetch(base+path,opts),post=async(path,body)=>(await request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
 const created=await post('/api/studio/create',{mode:'blank'}),rows=new Map(),disk={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)};
 const first=studioPage(created,disk,request);first.type('startup-prompt','A rainy harbour town with a lighthouse keeper');
 const second=studioPage(null,disk,request);
 assert.ok(JSON.stringify(second.records).includes('A rainy harbour town with a lighthouse keeper'),'typed startup text should be recoverable after refresh');
});

// Case 2: a corrupt wizard record is replaced by defaults on the next edit with no message.
test('GC5.5 case 2: a corrupt wizard draft is not silently replaced by defaults on the next edit',{todo:TODO.corrupt},()=>{
 const rows=new Map([['creator-draft','{"premise":"Half saved']]),w=creatorPage(rows);
 w.t.keep();
 assert.ok(rows.get('creator-draft')==='{"premise":"Half saved'||w.status()!=='','corrupt wizard draft was overwritten with no message');
});

// Case 3: Open replaces the current wizard state without asking first.
test('GC5.5 case 3: opening another world does not replace unsaved wizard edits without confirmation',{todo:TODO.open},async()=>{
 const rows=new Map(),fetch=async p=>{if(p.includes('/world?id='))return ok({spec:{title:'Saved world',heroines:[]},proposal:null,from:null});if(p.endsWith('/check'))return ok({cards:[],batches:[]});return ok({worlds:[],drafter:false,modules:{}});},w=creatorPage(rows,fetch);
 w.t.S={...w.t.S,step:6,spec:{title:'Unsaved edit',heroines:[]}};
 await w.t.openWorld('w2');
 assert.ok(w.confirms.length>0||w.t.S.spec.title==='Unsaved edit','unsaved wizard edit was replaced without confirmation');
});

// Case 4: two wizard tabs share one localStorage key; last write wins silently.
test('GC5.5 case 4: a second wizard tab does not silently drop the first tab edit',{todo:TODO.tabs},()=>{
 const rows=new Map(),a=creatorPage(rows),b=creatorPage(rows);
 a.t.S.premise='Tab A first';a.t.keep();
 b.t.S.premise='Tab B edit';b.t.keep();
 a.t.S.premise='Tab A second';a.t.keep();
 const persisted=JSON.parse(rows.get('creator-draft'));
 assert.ok(persisted.premise==='Tab B edit'||a.status()!==''||b.status()!=='','tab B edit was overwritten with no notice');
});
