import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const pack=({name='Reef',extra=false,cave=true}={})=>({schemaVersion:1,id:'test.reef',version:'0.1.0',title:'Reef fixture',playerId:'diver',modules:{},locations:[{id:'reef',name,exits:cave?[{to:'cave'}]:[]},...(cave?[{id:'cave',name:'Cave',exits:[{to:'reef'}]}]:[]),...(extra?[{id:'wreck',name:'Wreck',exits:[]}]:[])],actors:[{id:'diver',name:'Diver',location:'reef'},...(extra?[{id:'olu',name:'Olu',location:'wreck'}]:[])],gameProject:{premise:'',setting:'',presentation:'classic',conversationStyle:'authored',calendar:{startDate:''},ai:{intent:'',scene:'',daypart:''}}});
test('an older playthrough moves to the newest publish of its project, keeps its history, and refuses changes that would strand it',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pack-update-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,call=async(path,body,status=200)=>{const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data;};
 try{
  const d=await call('/api/studio/create',{});let rv=(await call('/api/studio/save',{id:d.id,pack:pack(),revision:d.updated})).updated;const v1=await call('/api/studio/publish',{id:d.id}),old=await call('/api/new',{packId:v1.id}),id=old.state.campaignId;
  assert.equal((await call(`/api/update?id=${id}`)).update,null);
  const move=old.actions.find(a=>a.enabled&&/cave/i.test(a.label||''));assert(move,JSON.stringify(old.actions.map(a=>a.label)));const moved=await call('/api/action',{campaignId:id,id:'m1',expectedRevision:0,input:move.label});const turns=Object.keys(moved.state.turns).length;
  rv=(await call('/api/studio/save',{id:d.id,pack:pack({name:'Coral Reef',extra:true}),revision:rv})).updated;const v2=await call('/api/studio/publish',{id:d.id});
  const {update}=await call(`/api/update?id=${id}`);assert.equal(update.packId,v2.id);assert.equal(update.blocked,null);assert(update.changes.includes('actors.olu: added'),JSON.stringify(update.changes));
  await call('/api/update',{campaignId:id,packId:'stale'},400);
  const up=await call('/api/update',{campaignId:id,packId:v2.id});assert.equal(up.state.packId,v2.id);assert.equal(up.state.actors.olu.location,'wreck');assert.equal(up.state.actors.diver.location,'cave');assert.equal(Object.keys(up.state.turns).length,turns);assert.equal(up.pack.locations[0].name,'Coral Reef');
  assert.equal((await call('/api/load',{id})).state.packId,v2.id);assert.equal((await call(`/api/update?id=${id}`)).update,null);
  const back=up.actions.find(a=>a.enabled&&/reef/i.test(a.label||''));assert(back);const again=await call('/api/action',{campaignId:id,id:'m2',expectedRevision:up.state.revision,input:back.label});assert.equal(again.state.actors.diver.location,'reef');
  rv=(await call('/api/studio/save',{id:d.id,pack:pack({cave:false,extra:true}),revision:rv})).updated;const v3=await call('/api/studio/publish',{id:d.id});
  const blocked=(await call(`/api/update?id=${id}`)).update;assert.equal(blocked.packId,v3.id);assert.match(blocked.blocked,/new game.*locations\.cave: removed/);
  assert.match((await call('/api/update',{campaignId:id},400)).error,/new game/);assert.equal((await call('/api/load',{id})).state.packId,v2.id);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('the player notice offers the update, applies it on click, and only explains when the update is blocked',async()=>{
 const {offerUpdate}=await import('../public/pack-update-notice.mjs'),mk=()=>{const els={};const doc={getElementById:id=>els[id]||null,createElement:tag=>{const e={tag,children:[],attrs:{},append:(...c)=>e.children.push(...c),setAttribute:(k,v)=>e.attrs[k]=v,remove:()=>{e.removed=true;delete els[e.id];},before:x=>{e.inserted=x;if(x.id)els[x.id]=x;}};return e;}};return {doc,anchor:doc.createElement('div')};};
 let {doc,anchor}=mk(),posted=null,updated=null;const api=async(path,body)=>{if(body){posted=body;return {state:{packId:'v2'}};}return {update:{packId:'v2',title:'Reef',changes:['actors.olu: added'],blocked:null}};};
 const box=await offerUpdate({api,campaignId:'c1',anchor,onUpdated:d=>updated=d,doc});assert.match(box.children[0].textContent,/Reef was updated \(actors\.olu: added\)/);
 const go=box.children.find(c=>c.textContent==='Continue with the update');await go.onclick();assert.deepEqual(posted,{campaignId:'c1',packId:'v2'});assert.equal(updated.state.packId,'v2');assert(box.removed);
 assert.equal(await offerUpdate({api,campaignId:'c1',anchor,doc}),null);
 ({doc,anchor}=mk());const b=await offerUpdate({api:async()=>({update:{packId:'v3',title:'Reef',changes:['locations.cave: removed'],blocked:'Start a new game to use this version (locations.cave: removed)'}}),campaignId:'c2',anchor,doc});
 assert.match(b.children[0].textContent,/can't switch.*Start a new game/);assert.deepEqual(b.children.slice(1).map(c=>c.textContent),['OK']);
 assert.equal(await offerUpdate({api:async()=>({update:null}),campaignId:'c3',anchor,doc}),null);assert.equal(await offerUpdate({api:async()=>{throw Error('preview');},campaignId:'c4',anchor,doc}),null);
});
