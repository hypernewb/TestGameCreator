import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createApp} from '../server.mjs';
const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
async function boot(t){
 const dir=mkdtempSync(join(tmpdir(),'studio-draft-rev-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,post=async(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).then(async r=>({status:r.status,data:await r.json()})),get=async id=>(await fetch(base+'/api/studio/get?id='+id)).json();
 t.after(async()=>{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});});
 return {post,get,file:id=>join(dir,'drafts',id+'.json'),tick:()=>new Promise(r=>setTimeout(r,5))};
}
test('ordinary Save with the current revision stores the pack and returns the new revision',async t=>{
 const {post,get,tick}=await boot(t),created=(await post('/api/studio/create',{})).data,p=structuredClone(created.pack);p.title='Revision one';
 await tick();const r=await post('/api/studio/save',{id:created.id,pack:p,revision:created.updated});
 assert.equal(r.status,200);assert.notEqual(r.data.updated,created.updated);assert.equal(r.data.pack.title,'Revision one');
 const stored=await get(created.id);assert.equal(stored.updated,r.data.updated);assert.equal(stored.pack.title,'Revision one');
});
test('stale revision is refused and the newer saved draft is left unchanged',async t=>{
 const {post,get,file,tick}=await boot(t),created=(await post('/api/studio/create',{})).data,a=structuredClone(created.pack),b=structuredClone(created.pack);a.title='Tab A';b.title='Stale tab B';
 await tick();const newer=await post('/api/studio/save',{id:created.id,pack:a,revision:created.updated});assert.equal(newer.status,200);
 const before=readFileSync(file(created.id),'utf8');
 const stale=await post('/api/studio/save',{id:created.id,pack:b,revision:created.updated});
 assert.equal(stale.status,400);assert.match(stale.data.error,/Stale draft revision/);
 assert.equal(readFileSync(file(created.id),'utf8'),before);
 const stored=await get(created.id);assert.equal(stored.updated,newer.data.updated);assert.equal(stored.pack.title,'Tab A');
 const unversioned=await post('/api/studio/save',{id:created.id,pack:b});assert.equal(unversioned.status,400);assert.match(unversioned.data.error,/Stale draft revision/);
 assert.equal(readFileSync(file(created.id),'utf8'),before);
});
test('incomplete draft with the current revision still saves and returns a usable revision',async t=>{
 const {post,get,tick}=await boot(t),created=(await post('/api/studio/create',{})).data,half={schemaVersion:1,title:'Half-built'};
 await tick();const r=await post('/api/studio/save',{id:created.id,pack:half,revision:created.updated});
 assert.equal(r.status,200);assert.deepEqual((await get(created.id)).pack,half);
 await tick();const again=await post('/api/studio/save',{id:created.id,pack:{...half,title:'Half-built again'},revision:r.data.updated});
 assert.equal(again.status,200);assert.equal((await get(created.id)).pack.title,'Half-built again');
});
test('Studio ordinary saves go through the revision-sending helper and a refusal keeps the local draft',async()=>{
 assert.equal((source.match(/api\('\/api\/studio\/save'/g)||[]).length,1,'only saveDraft calls the save route');
 const start=source.indexOf('async function saveDraft('),end=source.indexOf('\n',source.indexOf('function syncRevision('));assert.ok(start>0&&end>start,'helpers exist');
 const calls=[];let refuse=false;const ctx={draft:{id:'d1',updated:'t1'},api:async(path,body)=>{calls.push({path,body});if(refuse)throw Error('Stale draft revision');return {id:body.id,updated:'t2',pack:body.pack};}};
 runInNewContext(source.slice(start,end),ctx);
 const saved=await ctx.saveDraft({id:'d1',updated:'t1',pack:{title:'x'}});
 assert.equal(calls[0].path,'/api/studio/save');assert.equal(calls[0].body.revision,'t1');assert.equal(saved.updated,'t2');
 assert.equal(ctx.draft.updated,'t1','a successful save alone does not change the draft');
 ctx.syncRevision(saved);assert.equal(ctx.draft.updated,'t2');
 ctx.syncRevision({id:'other',updated:'t9'});assert.equal(ctx.draft.updated,'t2','other drafts are not synced');
 refuse=true;await assert.rejects(ctx.saveDraft({id:'d1',updated:'t2',pack:{}}),/changed in another tab or window/);
 assert.equal(ctx.draft.updated,'t2');
});
