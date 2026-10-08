import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../server.mjs';
const pack=name=>({schemaVersion:1,id:'test.reef',version:'0.1.0',title:'Reef fixture',playerId:'diver',modules:{},locations:[{id:'reef',name,exits:[]}],actors:[{id:'diver',name:'Diver',location:'reef'}],gameProject:{premise:'',setting:'',presentation:'classic',conversationStyle:'authored',calendar:{startDate:''},ai:{intent:'',scene:'',daypart:''}}});
test('republishing a draft replaces it in the picker while older campaigns keep their own version',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'studio-republish-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,api=async(path,body)=>{const r=await fetch(base+path,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;},reefs=async()=>(await api('/api/bootstrap')).packs.filter(p=>p.title==='Reef fixture');
 try{
  const d=await api('/api/studio/create',{});let rv=(await api('/api/studio/save',{id:d.id,pack:pack('Reef'),revision:d.updated})).updated;const v1=await api('/api/studio/publish',{id:d.id}),old=await api('/api/new',{packId:v1.id});
  rv=(await api('/api/studio/save',{id:d.id,pack:pack('Coral Reef'),revision:rv})).updated;const v2=await api('/api/studio/publish',{id:d.id});
  assert.deepEqual((await reefs()).map(p=>p.id),[v2.id]);assert.equal(app.packs[v2.id].locations[0].name,'Coral Reef');
  assert.equal((await api('/api/load',{id:old.state.campaignId})).pack.locations[0].name,'Reef');
  const other=await api('/api/studio/create',{});await api('/api/studio/save',{id:other.id,pack:pack('Reef'),revision:other.updated});await api('/api/studio/publish',{id:other.id});assert.equal((await reefs()).length,2);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
