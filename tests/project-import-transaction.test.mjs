import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {deflateSync,crc32} from 'node:zlib';
import vm from 'node:vm';
import {createApp} from '../server.mjs';

const name='scenario-media/00000000-0000-0000-0000-000000000001.png',other='scenario-media/00000000-0000-0000-0000-000000000002.png';
const chunk=(type,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
const png=(w=1,h=1)=>{const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const raw=Buffer.alloc((1+w*4)*h);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);};
const pack=()=>({schemaVersion:1,id:'test.import',version:'0.1.0',title:'Import fixture',playerId:'player',modules:{},locations:[{id:'dock',name:'Dock',description:'A dock.',exits:[]}],actors:[{id:'player',name:'Player',location:'dock'},{id:'ann',name:'Ann',location:'dock'}],gameProject:{premise:'Harbor.',setting:'Harbor.',calendar:{startDate:''},ai:{intent:'',scene:'',daypart:''}}});
const envelope=(pk,media={},extra={})=>JSON.stringify({format:'story-framework-game-project',version:1,pack:pk,media,...extra});
const fixture=async t=>{const dir=mkdtempSync(resolve(tmpdir(),'sf-gc94-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});const base=`http://127.0.0.1:${app.server.address().port}`,api=async(path,body)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};return {dir,app,api};};
const studioSource=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),sourceHelpers=studioSource.slice(studioSource.indexOf('function hasWeekly('),studioSource.indexOf('function weeklyAccept(')),draftSaveHelpers=studioSource.slice(studioSource.indexOf('async function saveDraft('),studioSource.indexOf('\n',studioSource.indexOf('function syncRevision('))),uiArt=readFileSync(new URL('../public/ui-art.mjs',import.meta.url),'utf8').replace(/^export /gm,''),importLine=studioSource.slice(studioSource.indexOf("$('import-project').onchange="),studioSource.indexOf('\n',studioSource.indexOf("$('import-project').onchange=")));
// Runs the real import-project handler; hook(path, body, context) may throw to simulate a failure at that step.
function importer(f,created,hook){const element={},calls=[],errors=[],context=vm.createContext({structuredClone,weeklySession:null,studioBusy:false,uiProjectSessions:new Map(),$:()=>element,draft:created,render:()=>{},message:()=>{},refresh:async()=>{},fail:e=>errors.push(e.message),api:async(path,body)=>{calls.push(path);await hook?.(path,body,context);const r=await f.api(path,body);if(r.status!==200)throw Error(r.data.error);return r.data;}});vm.runInContext(uiArt,context);vm.runInContext(sourceHelpers,context);vm.runInContext(draftSaveHelpers,context);vm.runInContext(importLine,context);return {context,calls,errors,run:text=>element.onchange({target:{files:[{text:async()=>text}],value:'chosen'}})};}
const snap=dir=>Object.fromEntries(['drafts','published','media'].map(k=>[k,readdirSync(resolve(dir,k)).sort().map(file=>[file,readFileSync(resolve(dir,k,file)).toString('base64')])]));
const titles=dir=>readdirSync(resolve(dir,'drafts')).map(file=>JSON.parse(readFileSync(resolve(dir,'drafts',file),'utf8')).pack.title);
const ref=(p,path)=>{p.locations[0].background=path;return p;};

test('malformed, incompatible and unsafe project files are refused without any write or active-draft change',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,imp=importer(f,structuredClone(created)),before=snap(f.dir),draftBefore=JSON.stringify(created);
 const cases=[['not JSON','{'],['null','null'],['foreign format',envelope(pack(),{},{format:'other-tool'})],['future version',envelope(pack(),{},{version:2})],['schema version 2',envelope({...pack(),schemaVersion:2})],['unknown module',envelope({...pack(),modules:{'no.such.module':{}}})],['no locations',envelope({...pack(),locations:[]})],['parent traversal',envelope(ref(pack(),'../../secret.jpg'))],['absolute path',envelope(ref(pack(),'C:/Windows/win.ini'))],['media key outside store',envelope(pack(),{'../escape.png':{mime:'image/png',data:png().toString('base64')}})]];
 for(const [label,text] of cases){imp.calls.length=0;const errors=imp.errors.length;await imp.run(text);assert.equal(imp.errors.length,errors+1,label);assert.ok(imp.calls.every(c=>c==='/api/studio/validate'),label);assert.deepEqual(snap(f.dir),before,label);assert.equal(JSON.stringify(imp.context.draft),draftBefore,label);}
});

test('oversized media is refused by validation before any upload',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,imp=importer(f,structuredClone(created)),before=snap(f.dir),p=ref(pack(),name);
 const big=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(3_600_000)]).toString('base64');
 await imp.run(envelope(p,{[name]:{mime:'image/png',data:big}}));assert.deepEqual(imp.calls,['/api/studio/validate']);assert.match(imp.errors.at(-1),/too large/i);
 await imp.run(envelope(p,{[name]:{mime:'image/png',data:'A'.repeat(5_100_000)}}));assert.deepEqual(imp.calls,['/api/studio/validate','/api/studio/validate']);assert.match(imp.errors.at(-1),/Request too large/);
 assert.deepEqual(snap(f.dir),before);
});

test('a second import started while one is running is refused and creates no second draft',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,imp=importer(f,structuredClone(created)),before=readdirSync(resolve(f.dir,'drafts')).length,text=envelope(pack());
 await Promise.all([imp.run(text),imp.run(text)]);
 assert.deepEqual(imp.errors,['A draft request is already running.']);assert.equal(imp.calls.filter(c=>c==='/api/studio/create').length,1);assert.equal(readdirSync(resolve(f.dir,'drafts')).length,before+1);
});

test('failures during upload, create, save or a concurrent edit keep the active draft and never save the imported project',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,p=ref(pack(),name);p.actors[1].portrait=other;
 const text=envelope(p,{[name]:{mime:'image/png',data:png().toString('base64')},[other]:{mime:'image/png',data:png(2,2).toString('base64')}}),before=snap(f.dir),draftBefore=JSON.stringify(created);
 const failing=async(label,hook)=>{const imp=importer(f,structuredClone(created),hook);await imp.run(text);assert.equal(imp.errors.length,1,label);assert.equal(JSON.stringify(imp.context.draft),draftBefore,label);assert.deepEqual(snap(f.dir).published,before.published,label);assert.ok(!titles(f.dir).includes('Import fixture'),label);return imp;};
 let uploads=0;const upload=await failing('second upload fails',path=>{if(path==='/api/studio/asset'&&++uploads===2)throw Error('injected upload failure');});assert.ok(!upload.calls.includes('/api/studio/create'));
 const create=await failing('create fails',path=>{if(path==='/api/studio/create')throw Error('injected create failure');});assert.ok(!create.calls.includes('/api/studio/save'));
 await failing('save fails',path=>{if(path==='/api/studio/save')throw Error('injected save failure');});
 await failing('project edited during upload',(path,body,ctx)=>{if(path==='/api/studio/asset')ctx.draft={...ctx.draft};});
 await failing('project edited after create',(path,body,ctx)=>{if(path==='/api/studio/create')ctx.draft={...ctx.draft};});
 const retry=importer(f,structuredClone(created));await retry.run(text);assert.deepEqual(retry.errors,[]);assert.ok(titles(f.dir).includes('Import fixture'));
});

test('a successful import uploads only the media its project references',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,imp=importer(f,structuredClone(created));
 await imp.run(envelope(ref(pack(),name),{[name]:{mime:'image/png',data:png().toString('base64')},[other]:{mime:'image/png',data:png(2,2).toString('base64')}}));
 assert.deepEqual(imp.errors,[]);assert.equal(readdirSync(resolve(f.dir,'media')).length,1);assert.match(imp.context.draft.pack.locations[0].background,/^scenario-media\/[a-f0-9-]{36}\.png$/);
});
