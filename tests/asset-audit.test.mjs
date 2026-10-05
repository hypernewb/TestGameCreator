import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {deflateSync,crc32} from 'node:zlib';
import {createApp} from '../server.mjs';
import {assetReferences,assetAudit} from '../packages/assets/asset-audit.mjs';

const name='scenario-media/00000000-0000-0000-0000-000000000001.png',ghost='scenario-media/00000000-0000-0000-0000-000000000002.webp',staticRef='assets/art/bg.jpg';
const chunk=(type,data)=>{const out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);out.writeUInt32BE(crc32(out.subarray(4,-4)),out.length-4);return out;};
const png=(w=1,h=1)=>{const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;const raw=Buffer.alloc((1+w*4)*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)raw[y*(1+w*4)+1+x*4+3]=255;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);};
const wchunk=(type,data)=>{const out=Buffer.alloc(8+data.length+(data.length%2));out.write(type,0);out.writeUInt32LE(data.length,4);data.copy(out,8);return out;};
const animatedWebp=()=>{const body=Buffer.concat([Buffer.from('WEBP'),wchunk('ANIM',Buffer.alloc(6)),wchunk('ANMF',Buffer.alloc(24))]),head=Buffer.alloc(8);head.write('RIFF',0);head.writeUInt32LE(body.length,4);return Buffer.concat([head,body]);};
const pack=()=>({schemaVersion:1,id:'test.audit',version:'0.1.0',title:'Audit fixture',playerId:'player',modules:{},locations:[{id:'dock',name:'Dock',description:'A dock.',exits:[],background:name}],actors:[{id:'player',name:'Player',location:'dock'},{id:'ann',name:'Ann',location:'dock',portrait:name,idleAnimation:ghost,idleStill:name,poses:[{id:'happy',image:name}]}],scriptedScenes:[{id:'scene-1',title:'The dock',trigger:{event:'core.inspected',match:{}},background:name,cg:staticRef,pages:[{text:'Hi.',background:name,cg:staticRef}],beats:[{id:'b1',opening:'Back.',background:name,cg:staticRef,pages:[{text:'Again.',background:name,cg:staticRef}]}]}],firsts:[{id:'first-1',title:'First talk',character:'ann',rung:'talk',trigger:{event:'core.inspected'},checkpoints:[],cg:staticRef}],gameProject:{premise:'Harbor.',setting:'Harbor.',calendar:{startDate:''},ai:{intent:'',scene:'',daypart:''}}});
const fixture=async t=>{const dir=mkdtempSync(resolve(tmpdir(),'sf-audit-test-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();});const base=`http://127.0.0.1:${app.server.address().port}`,api=async(path,body)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};return {dir,app,api};};
const files=(dir,key)=>readdirSync(resolve(dir,key)).sort();
const upload=async(api,bytes,kind)=>(await api('/api/studio/asset',{data:`data:image/${kind==='animation'?'webp':'png'};base64,${bytes.toString('base64')}`,kind})).data.path;

test('assetReferences covers every supported image field: locations, actors, poses, scenes, beats, pages, firsts',()=>{
 const p=pack(),refs=assetReferences(p),byRef=Object.fromEntries(refs.map(r=>[r.ref,r]));
 assert.equal(refs.length,14);
 for(const ref of ['locations.dock.background','actors.ann.portrait','actors.ann.idleAnimation','actors.ann.idleStill','actors.ann.poses.happy.image','scenes.scene-1.background','scenes.scene-1.cg','scenes.scene-1.pages.0.background','scenes.scene-1.pages.0.cg','scenes.scene-1.beats.b1.background','scenes.scene-1.beats.b1.cg','scenes.scene-1.beats.b1.pages.0.background','firsts.first-1.cg'])assert.ok(byRef[ref],`missing ${ref}`);
 assert.equal(byRef['actors.ann.idleAnimation'].kind,'animation');
 assert.equal(byRef['locations.dock.background'].section,'Locations');
 assert.equal(byRef['firsts.first-1.cg'].section,null);
});

test('shared assets list every owner; missing references are detected per reference',()=>{
 const p=pack(),report=assetAudit(p,{probe:path=>path===ghost?null:{source:'uploaded'}});
 const shared=report.assets.find(a=>a.path===name);
 assert.equal(shared.owners.length,8);
 assert.ok(shared.notes.some(n=>n.includes('Shared by 8')));
 assert.equal(shared.status,'ok');
 assert.deepEqual(report.summary,{references:14,assets:3,missing:1,invalid:0,unreferenced:0,undetermined:0,shared:2});
 const anim=report.assets.find(a=>a.path===ghost);
 assert.equal(anim.status,'missing');
 assert.ok(report.references.filter(r=>r.path===ghost).every(r=>r.status==='missing'));
});

test('embedded media takes precedence, unreferenced entries are flagged and mime mismatches noted',()=>{
 const p=pack(),media={[ghost]:{mime:'image/png',data:'AAAA'}},report=assetAudit(p,{media,probe:()=>null});
 const anim=report.assets.find(a=>a.path===ghost);
 assert.equal(anim.status,'ok');assert.equal(anim.source,'embedded');
 assert.ok(anim.notes.some(n=>n.includes('MIME')));
 const before=structuredClone(p);assetAudit(p,{media,probe:()=>null});
 assert.deepEqual(p,before,'the report must not mutate the pack');
});

test('static files without a project reference are undetermined, never called safe to remove; invalid paths are flagged',()=>{
 const p=pack(),report=assetAudit(p,{probe:path=>path===staticRef?null:{source:'uploaded'},listStatic:['assets/art/unused.svg',staticRef]});
 const unused=report.assets.find(a=>a.path==='assets/art/unused.svg');
 assert.equal(unused.status,'undetermined');
 assert.ok(unused.notes.some(n=>n.includes('does not make the file safe to remove')));
 const bad=p=>{p.actors[1].portrait='https://example.com/a.png';p.locations[0].background='scenario-media/../../evil.png';const r=assetAudit(p,{probe:()=>({source:'uploaded'})});
  assert.equal(r.assets.find(a=>a.path.startsWith('https://')).status,'invalid');assert.equal(r.assets.find(a=>a.path.includes('..')).status,'invalid');};
 bad(p);
});

test('report endpoint scans uploads, animated media and static assets without changing any file',async t=>{
 const f=await fixture(t),created=(await f.api('/api/studio/create',{})).data,p=pack();
 p.locations[0].background=await upload(f.api,png(1920,1080));
 p.actors[1].portrait=p.locations[0].background;
 p.actors[1].idleAnimation=await upload(f.api,animatedWebp(),'animation');
 p.actors[1].idleStill=await upload(f.api,png(1024,1536));
 delete p.scriptedScenes;p.firsts=[];
 p.actors[1].poses=[{id:'happy',image:'scenario-media/00000000-0000-0000-0000-000000000042.png'}];
 await f.api('/api/studio/save',{id:created.id,pack:p});
 const before={drafts:files(f.dir,'drafts'),published:files(f.dir,'published'),media:files(f.dir,'media')};
 const r=await f.api('/api/studio/assets/report',{pack:p});
 assert.equal(r.status,200);
 const report=r.data,byPath=Object.fromEntries(report.assets.map(a=>[a.path,a]));
 assert.equal(report.summary.missing,1);
 const anim=byPath[p.actors[1].idleAnimation];
 assert.equal(anim.status,'ok');assert.equal(anim.source,'uploaded');assert.equal(anim.owners[0].kind,'animation');
 assert.equal(byPath[p.locations[0].background].owners.length,2);
 assert.ok(report.assets.some(a=>a.status==='undetermined'&&a.path.startsWith('assets/')));
 assert.deepEqual({drafts:files(f.dir,'drafts'),published:files(f.dir,'published'),media:files(f.dir,'media')},before);
 assert.equal((await f.api('/api/studio/validate',{pack:p})).status,400,'the ghost pose upload must still block validation');
});
