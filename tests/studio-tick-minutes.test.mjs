import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runInNewContext} from 'node:vm';
import {createApp} from '../server.mjs';
import {actions,createWorld} from '../packages/core/engine.mjs';
import {optionCost} from '../public/calendar.mjs';
const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),campus=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
function control(p){
 const start=source.indexOf('function tickMinutesEditor(');assert.ok(start>=0,'Studio has a tick length control');let input;
 const ctx={p,parent:{},field:(parent,obj,key,label,kind)=>{assert.equal(kind,'number');input={value:obj[key]??''};return input;},message(){}};
 runInNewContext(source.slice(start,source.indexOf('\n}',start)+2)+';tickMinutesEditor(parent,p);',ctx);return input;
}
test('campus and its reskin author a one-hour tick',()=>{
 assert.equal(campus.tickMinutes,60);assert.equal(JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url),'utf8')).tickMinutes,60);assert.match(source,/tickMinutesEditor\(dayLoop,p\)/);
});
test('Studio saves tick length and option labels follow the reopened pack',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'studio-tick-')),app=createApp({dataPath:':memory:',scenarioDir:dir});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,post=async(path,body)=>{const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200);return r.json();};
 try{
  const draft=await post('/api/studio/create',{});draft.pack=structuredClone(campus);const input=control(draft.pack);assert.equal(input.value,60);input.value='30';input.oninput();assert.equal(draft.pack.tickMinutes,30);
  await post('/api/studio/save',draft);const response=await fetch(base+'/api/studio/get?id='+draft.id);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.pack.tickMinutes,30);
  const p={schemaVersion:1,id:campus.id,title:'Test',version:'0.1.0',modules:{},playerId:'you',locations:[{id:'home',name:'Home',exits:[]}],actors:[{id:'you',name:'You',location:'home'}],tickMinutes:saved.pack.tickMinutes},s=createWorld(p,{}),list=actions(s,p,{}),wait=list.find(a=>a.type==='core.wait');assert.deepEqual(wait.cost,{ticks:1,display:'30m'});assert.equal(optionCost(s,wait,p,list).display,'30m');assert.equal(actions(s,{...p,tickMinutes:60},{}).find(a=>a.type==='core.wait').cost.display,'1h');assert.equal(s.tick,0);
  input.value='';input.oninput();assert.ok(!Object.hasOwn(draft.pack,'tickMinutes'));await post('/api/studio/save',draft);const legacy=await (await fetch(base+'/api/studio/get?id='+draft.id)).json();assert.ok(!Object.hasOwn(legacy.pack,'tickMinutes'));delete p.tickMinutes;assert.equal(actions(s,p,{}).find(a=>a.type==='core.wait').cost.display,'1 tick');
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
test('Studio leaves missing tick length untouched and ignores invalid values',()=>{
 const p={},input=control(p);assert.equal(input.value,'');assert.ok(!Object.hasOwn(p,'tickMinutes'));for(const value of ['0','-1','abc','Infinity','1.5']){input.value=value;input.oninput();assert.ok(!Object.hasOwn(p,'tickMinutes'));}input.value='25';input.oninput();assert.equal(p.tickMinutes,25);input.value='0';input.oninput();assert.equal(p.tickMinutes,25);
});
