import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLineExtractor} from '../vendor/venus/sceneStream.mjs';
import {normalizeSceneVerdict} from '../vendor/venus/sceneClassifier.mjs';
import {createTextExtractor} from '../vendor/venus/textingStream.mjs';
import {createRequestQueue} from '../vendor/venus/requestQueue.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';

test('ported scene and texting parsers emit complete values once across arbitrary chunks',()=>{
 const lines=[{speaker:'ada',text:'A } brace and "quoted" words.',stage:['show:ada']},{speaker:'',text:'The room falls quiet.'}];
 const input=JSON.stringify({lines,summary:'Not a line'}),reader=createLineExtractor(),got=[];
 for(const char of input)got.push(...reader.feed(char));
 assert.deepEqual(got,lines);assert.deepEqual(reader.feed('{"text":"outside"}'),[]);
 const messages=['Hello "Ada"','A backslash \\ and a ] bracket'];const texting=createTextExtractor(),texts=[];
 for(const char of JSON.stringify({messages}))texts.push(...texting.feed(char));
 assert.deepEqual(texts,messages);
});

test('scene location classification tolerates model phrasing but refuses invented or ambiguous places',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/scripted-workshop.json',import.meta.url)));
 const locationOf=sceneLocation=>normalizeSceneVerdict({characters:[],mentionedOnly:[],sceneLocation,activity:'explore',activityId:''},p).location;
 for(const text of ['workshop','Workshop','the workshop','Workshop ',' Workshop','Go to the Workshop'])assert.equal(locationOf(text),'workshop');
 assert.equal(locationOf('the Meeting Room'),'meeting');
 for(const text of ['','   ','invented palace','somewhere between the Hub and the Workshop'])assert.equal(locationOf(text),null);
});

test('ported serial queue skips cancelled jobs and survives a failed predecessor',async()=>{
 const enqueue=createRequestQueue();let release;const order=[];
 const first=enqueue(async()=>{order.push('first');await new Promise(r=>release=r);throw Error('failed');});
 const firstResult=assert.rejects(first,/failed/);await Promise.resolve();
 const controller=new AbortController();const cancelled=enqueue(()=>{order.push('cancelled');},controller.signal);const cancelledResult=assert.rejects(cancelled,{name:'AbortError'});controller.abort();
 const last=enqueue(()=>order.push('last'));release();await Promise.all([firstResult,cancelledResult,last]);assert.deepEqual(order,['first','last']);
});

test('compatible provider serializes simultaneous requests to its local endpoint',async()=>{
 let active=0,maxActive=0,calls=0;let release;
 const provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test',fetchImpl:async()=>{
  active++;maxActive=Math.max(maxActive,active);calls++;if(calls===1)await new Promise(r=>release=r);active--;
  return {ok:true,json:async()=>({choices:[{message:{content:'OK'},finish_reason:'stop'}]})};
 }});
 const a=provider.complete([],null);const b=provider.complete([],null);await Promise.resolve();assert.equal(calls,1);release();assert.deepEqual(await Promise.all([a,b]),['OK','OK']);assert.equal(maxActive,1);
});

test('compatible provider emits complete sanitized-preview candidates from an SSE scene stream',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),json=JSON.stringify({lines:[{speaker:'ada',text:'First page.'},{speaker:'',text:'Second page.'}]});
 const chunks=[json.slice(0,35),json.slice(35,65),json.slice(65)],encoder=new TextEncoder();
 const provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'stream',fetchImpl:async()=>new Response(new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(encoder.encode(`data: ${JSON.stringify({choices:[{delta:{content:chunk}}]})}\n\n`));controller.enqueue(encoder.encode('data: [DONE]\n\n'));controller.close();}}),{headers:{'Content-Type':'text/event-stream'}})});
 const seen=[],context={stagedCast:['ada'],absentCharacters:[],sceneHistory:[],playerAction:'Continue',location:p.locations[0]};const result=await provider.generateScene(context,p,null,lines=>seen.push(...lines));assert.deepEqual(result.lines.map(x=>x.text),['First page.','Second page.']);assert.deepEqual(seen.map(x=>x.text),['First page.','Second page.']);
});

test('NPC social module develops off-screen relationships reproducibly and exports cleanly',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/npc-social.json',import.meta.url)));let s=createWorld(p,registry,'npc-social-test',42);
 for(let i=0;i<4;i++)s=execute(s,{id:'wait-'+i,type:'core.wait',args:{},actorId:p.playerId,expectedRevision:s.revision},p,registry).state;
 assert.equal(s.modules['social.npc'].pairs['brin|cyra'].affinity,4);assert.equal(s.modules['social.npc'].friendships.length,1);
 assert.deepEqual(validateImport(exportCampaign(s),p,registry).modules['social.npc'],s.modules['social.npc']);
 assert.equal(contextFor(s,p,'player').npcRelationships.length,0);assert.equal(contextFor(s,p,'brin').npcRelationships.length,1);
 const duplicate=execute(s,{id:'wait-3',type:'core.wait',args:{},actorId:p.playerId,expectedRevision:s.revision},p,registry);assert.equal(duplicate.duplicate,true);assert.equal(duplicate.state.modules['social.npc'].friendships.length,1);
});

test('NPC social module does not invent off-screen encounters for the active cast',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/npc-social.json',import.meta.url)));let s=createWorld(p,registry,'cast-test',42);
 s=execute(s,{id:'open',type:'core.scene',args:{text:'Talk to Brin and Cyra',location:'workshop',characters:['brin','cyra'],activity:'talk'},actorId:p.playerId,expectedRevision:0},p,registry).state;
 for(let i=0;i<2;i++)s=execute(s,{id:'wait-'+i,type:'core.wait',args:{},actorId:p.playerId,expectedRevision:s.revision},p,registry).state;
 assert.equal(s.tick,4);assert.equal(s.modules['social.npc'].pairs['brin|cyra'].affinity,3);assert.equal(s.modules['social.npc'].pairs['brin|cyra'].encounter,undefined);
});

test('shop purchase and scripted wages are atomic, affordable, and replayable',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/economy.json',import.meta.url)));let s=createWorld(p,registry,'economy-test');
 s=execute(s,{id:'move',type:'core.move',args:{to:'workshop'},actorId:p.playerId,expectedRevision:0},p,registry).state;
 assert.throws(()=>execute(s,{id:'too-early',type:'world.buy',args:{item:'toolkit'},actorId:p.playerId,expectedRevision:1},p,registry),/Insufficient funds/);
 assert.equal(s.modules['world.economy'].balance,10);assert.equal(s.modules['items.inventory'].owners.toolkit,'workshop');
 assert.throws(()=>execute(s,{id:'steal',type:'items.take',args:{item:'toolkit'},actorId:p.playerId,expectedRevision:1},p,registry),/Buy this item/);
 s=execute(s,{id:'shift',type:'core.scene',args:{text:'Work a shift',location:'workshop',characters:[],activity:'work',activityId:'work-shift'},actorId:p.playerId,expectedRevision:1},p,registry).state;
 assert.equal(s.modules['world.economy'].balance,30);
 s=execute(s,{id:'buy',type:'world.buy',args:{item:'toolkit'},actorId:p.playerId,expectedRevision:2},p,registry).state;
 assert.equal(s.modules['world.economy'].balance,10);assert.equal(s.modules['items.inventory'].owners.toolkit,p.playerId);
 s=execute(s,{id:'sell',type:'world.sell',args:{item:'toolkit'},actorId:p.playerId,expectedRevision:3},p,registry).state;
 assert.equal(s.modules['world.economy'].balance,20);assert.equal(s.modules['items.inventory'].owners.toolkit,'workshop');
 assert.deepEqual(validateImport(exportCampaign(s),p,registry).modules['world.economy'],s.modules['world.economy']);
});

test('freeform buy names one actual shop item and commits through the rules',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/economy.json',import.meta.url)));p.initialMoney=40;
 const store=new Store();store.insert(createWorld(p,registry,'freeform-shop'));
 const provider={name:'probe',async interpretScene(){throw Error('Purchases must bypass AI classification');},async generateScene(){return {lines:[{speaker:'',text:'The toolkit is yours.'}]};}};
 const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('freeform-shop',{id:'move',expectedRevision:0,command:{type:'core.move',args:{to:'workshop'}}});const r=await service.act('freeform-shop',{id:'buy',expectedRevision:1,input:'Buy Maker toolkit'});assert.equal(r.state.modules['world.economy'].balance,20);assert.equal(r.state.modules['items.inventory'].owners.toolkit,p.playerId);const missing=await service.act('freeform-shop',{id:'another',expectedRevision:2,input:'Buy invisible wand'});assert.ok(missing.clarification);assert.equal(missing.state.revision,2);}finally{store.close();}
});

test('shop cannot charge an unaffordable purchase, including freeform input',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/economy.json',import.meta.url)));const store=new Store();store.insert(createWorld(p,registry,'shop-limit'));
 const provider={name:'probe',async interpretScene(){throw Error('No classification needed');},async generateScene(){return {lines:[{speaker:'',text:'You reach the workshop.'}]};}};
 const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('shop-limit',{id:'move',expectedRevision:0,command:{type:'core.move',args:{to:'workshop'}}});const r=await service.act('shop-limit',{id:'buy',expectedRevision:1,input:'Buy Maker toolkit'});assert.ok(r.clarification);assert.equal(r.state.revision,1);assert.equal(r.state.modules['world.economy'].balance,10);assert.equal(r.state.modules['items.inventory'].owners.toolkit,'workshop');}finally{store.close();}
});

test('a scripted scene choice can award an authored wage once',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/economy.json',import.meta.url)));p.modules['story.scenes']='0.1.0';p.scriptedScenes=[{id:'wage',title:'Payday',opening:'The workshop pays you.',trigger:{event:'core.inspected',match:{}},choices:[{id:'accept',label:'Accept wage',result:'You are paid.',effects:[{type:'money',delta:15}]}]}];
 let s=createWorld(p,registry,'wage-test');s=execute(s,{id:'inspect',type:'core.inspect',args:{},actorId:p.playerId,expectedRevision:0},p,registry).state;
 assert.equal(s.modules['story.scenes'].pending,'wage');
 s=execute(s,{id:'choose',type:'story.choose',args:{scene:'wage',choice:'accept'},actorId:p.playerId,expectedRevision:1},p,registry).state;
 assert.equal(s.modules['world.economy'].balance,25);assert.equal(validateImport(exportCampaign(s),p,registry).modules['world.economy'].balance,25);
});
