import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {estimateTokens,messageTokens,calibrate,allocate,lods,replyReserve} from '../packages/ai/budget.mjs';
import {budgetSceneContext,turnDigest,recapGroups,sceneTranscript} from '../packages/ai/context-budget.mjs';
import {bm25Index,bm25Score,terms} from '../packages/ai/retrieval.mjs';
import {selectLore,contextFor} from '../packages/ai/context.mjs';
import {detectContextWindow,effectiveWindow,validateContextSize,contextPreset,isLoopback,CLOUD_WINDOW} from '../packages/ai/local-settings.mjs';
import {createApp} from '../server.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const item=(key,pool,tier,rank,...texts)=>({key,pool,tier,rank,lods:lods(texts.map((t,i)=>[`l${i}`,t]))});

test('sceneTranscript skips score sub-turns between conversation turns',()=>{
 const line=(id,command,narrative,text)=>({id,status:'complete',command:{type:command,args:{text:id}},input:id,narrative,sceneLines:[{speaker:'ada',text}],events:[]});
 const world={scene:{id:'s1'},events:[],turns:{
  t1:line('t1','core.scene','Ada: Hello there.','Hello there.'),
  t1acts:{id:'t1-acts',status:'complete',command:{type:'social.priceActs',args:{}},input:undefined,narrative:'Ada: Trust 45 → 50',sceneLines:[{speaker:'',text:'Ada: Trust 45 → 50'}],events:[]},
  t2:line('t2','core.scene','Ada: Nice weather.','Nice weather.'),
  t2first:{id:'t2-first',status:'complete',command:{type:'social.scoreFirst',args:{}},input:undefined,narrative:'Checkpoint reached.',sceneLines:[{speaker:'',text:'Checkpoint reached.'}],events:[]}}};
 const history=sceneTranscript(world,{id:'t3',events:[]},['ada']);
 assert.deepEqual(history.map(h=>h.text),['Ada: Hello there.','Ada: Nice weather.']);
});

test('score events never reach the model context as recent actions',()=>{
 const p=pack(),s=createWorld(p,registry,'ctx-score');
 s.events.push({id:'e1',tick:0,type:'social.relationshipChanged',visibility:['player'],payload:{actor:'ada',toward:'player',old:45,value:50,text:'Ada: Trust 45 → 50'}},
  {id:'e2',tick:0,type:'world.moneyChanged',visibility:['player'],payload:{delta:30,balance:130,text:'Balance: $130.'}},
  {id:'e3',tick:0,type:'world.activityCompleted',visibility:['player'],payload:{activity:'shift',text:'You finished the diner shift.'}});
 const actions=contextFor(s,p).recentActions;
 assert.deepEqual(actions.map(a=>a.text),['You finished the diner shift.']);
});

test('token estimate counts dense scripts per character and Latin text per four characters',()=>{
 assert.equal(estimateTokens('abcdefgh'),2);
 assert.equal(estimateTokens('你好世界'),4);
 assert.equal(estimateTokens('abcd你好'),3);
 assert.equal(estimateTokens('abcdefgh',1.5),3);
});

test('calibration moves the ratio toward reported prompt tokens and stays bounded',()=>{
 let c={ratio:1,samples:0};for(let i=0;i<20;i++)c=calibrate(c,1000,1300);
 assert.ok(Math.abs(c.ratio-1.3)<0.01,`ratio ${c.ratio}`);
 assert.equal(calibrate(c,0,500),c);
 assert.ok(calibrate({ratio:1,samples:0},100,100000).ratio<=3);
});

test('allocator reserves floors so a huge transcript cannot starve lore and recaps',()=>{
 const long='x'.repeat(4000),items=[...Array.from({length:10},(_,i)=>item(`h${i}`,'history',2,i,long)),item('lore','lore',4,1,'y'.repeat(200)),item('past','past',5,1,'z'.repeat(200))];
 const result=allocate(items,{budget:1500});
 assert.ok(result.chosen.has('lore')&&result.chosen.has('past'));
 assert.ok(result.used<=1500);
});

test('allocator degrades before cutting and keeps a transcript tail contiguous',()=>{
 const items=Array.from({length:6},(_,i)=>({...item(`t${i}`,'history',2,i,'f'.repeat(800),'d'.repeat(40)),monotone:true}));
 const result=allocate(items,{budget:500,tiers:{2:{floor:0.5,ceiling:1}}});
 const levels=items.map(x=>result.chosen.get(x.key)?.level||'cut');
 assert.equal(levels.at(-1),'l0');
 // Newest first: full, then digests, then cuts — never a richer item older than a poorer one.
 const order=['l0','l1','cut'],ranks=[...levels].reverse().map(l=>order.indexOf(l));
 assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b));
 assert.ok(levels.includes('l1'));
});

test('hard ceiling keeps off-screen color from absorbing leftover budget',()=>{
 const result=allocate([item('npc1','npc',6,1,'n'.repeat(2000))],{budget:1000});
 assert.equal(result.chosen.has('npc1'),false);
 assert.equal(result.cut[0].reason,'budget');
});

test('a long chatty scene stays inside the model window, compacting old turns into engine digests',async()=>{
 const p=pack();delete p.modules['world.schedule'];p.actors.find(a=>a.id==='brin').location='hub';
 const contexts=[],page=n=>`Ada studies the plans for a long moment, turning page ${n} toward the lamp and tracing each line of the design with one careful finger while she thinks. `.repeat(3);
 const provider={name:'probe',contextWindow:4096,maxTokens:400,async interpretScene(){throw Error('continuation only');},async generateScene(context){contexts.push(structuredClone(context));return {lines:Array.from({length:8},(_,i)=>({speaker:i%2?'ada':'',text:page(contexts.length*10+i)}))};}};
 const store=new Store();store.insert(createWorld(p,registry,'long'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  let result=await service.act('long',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Discuss the plans together.',location:'hub',characters:['ada','brin'],activity:'talk'}}});
  for(let i=0;i<18;i++)result=await service.act('long',{id:`r${i}`,expectedRevision:result.state.revision,input:`I think version ${i} is closer. Keep going.`});
  const last=contexts.at(-1),report=result.turn.contextReport;
  assert.equal(last.scenePhase,'continuation');
  assert.ok(messageTokens(scenePromptMessages(last,p))<=report.budget,`prompt over budget: ${JSON.stringify(report).slice(0,300)}`);
  assert.equal(report.overBudget,false);
  // The newest turn is verbatim; the oldest survive only as digests of what the player did.
  assert.ok(!last.sceneHistory.at(-1).compact);
  assert.ok(last.sceneHistory[0].compact);
  assert.match(last.sceneHistory[0].text,/Player: /);
  const firstVerbatim=last.sceneHistory.findIndex(h=>!h.compact);
  assert.ok(last.sceneHistory.slice(firstVerbatim).every(h=>!h.compact));
  assert.equal(last.sceneHistory.length,18);
  assert.deepEqual(last.castProfiles.map(a=>a.id).sort(),['ada','brin']);
  assert.ok(report.included.some(([key,level])=>key.startsWith('history:')&&level==='digest'));
  // Deterministic: the same world and turn produce the same plan.
  const world=store.load('long'),again=()=>budgetSceneContext({...last,sceneHistory:contexts.at(-1).sceneHistory},p,world,'r17',{window:4096,reply:400,render:c=>scenePromptMessages(c,p)}).report;
  assert.deepEqual(again(),again());
 }finally{store.close();}
});

test('a tiny window shrinks cast profiles to names but never drops a cast member',()=>{
 const p=pack(),world=createWorld(p,registry,'tiny');
 const context={stagedCast:['ada','brin'],sceneHistory:[],location:p.locations[0],playerAction:'Hello'};
 const {context:out,report}=budgetSceneContext(context,p,world,'none',{window:600,reply:200,render:c=>scenePromptMessages(c,p)});
 assert.deepEqual(out.castProfiles.map(a=>a.id).sort(),['ada','brin']);
 assert.equal(report.overBudget,true);
});

test('turn digests come from committed events, not model prose',()=>{
 const digest=turnDigest({input:'Give Ada the ticket',events:[{type:'items.transferred',visibility:'public',payload:{text:'Gave Festival ticket'}},{type:'core.patch',visibility:[],payload:{path:['flags','festival_invited'],value:true}},{type:'core.timeAdvanced',visibility:'public',payload:{}}]});
 assert.equal(digest,'Player: Give Ada the ticket → Gave Festival ticket; flag festival_invited=true');
});

test('provider calibrates its token ratio from reported usage',async()=>{
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl:async(_url,request)=>{const body=JSON.parse(request.body);return {ok:true,json:async()=>({choices:[{message:{content:'READY'},finish_reason:'stop'}],usage:{prompt_tokens:messageTokens(body.messages)*2,completion_tokens:1}})};}});
 for(let i=0;i<6;i++)await provider.complete([{role:'user',content:'Reply with only READY. '.repeat(20)}]);
 assert.ok(Math.abs(provider.calibration.ratio-2)<0.01,`ratio ${provider.calibration.ratio}`);
});

test('context window detection reads llama.cpp, LM Studio, Ollama and /v1/models metadata',async()=>{
 const serve=routes=>async(url,init)=>{const path=new URL(url).pathname,hit=routes[`${init?.method||'GET'} ${path}`];return hit?{ok:true,json:async()=>hit}:{ok:false,json:async()=>({})};};
 const endpoint='http://127.0.0.1:8080/v1/chat/completions';
 assert.deepEqual(await detectContextWindow(endpoint,'m',serve({'GET /props':{default_generation_settings:{n_ctx:16384}}})),{window:16384,source:'llama.cpp /props'});
 assert.deepEqual(await detectContextWindow(endpoint,'qwen',serve({'GET /api/v0/models/qwen':{max_context_length:32768,loaded_context_length:8192}})),{window:8192,source:'LM Studio /api/v0/models'});
 assert.deepEqual(await detectContextWindow(endpoint,'llama3',serve({'POST /api/show':{parameters:'num_ctx 12288',model_info:{'llama.context_length':131072}}})),{window:12288,source:'Ollama num_ctx'});
 assert.deepEqual(await detectContextWindow(endpoint,'llama3',serve({'POST /api/show':{model_info:{'llama.context_length':131072}}})),{window:4096,source:'Ollama default num_ctx'});
 assert.deepEqual(await detectContextWindow(endpoint,'x',serve({'GET /v1/models':{data:[{id:'x',max_model_len:65536}]}})),{window:65536,source:'/v1/models'});
 assert.equal(await detectContextWindow(endpoint,'q',serve({'GET /api/v0/models/q':{state:'not-loaded',max_context_length:262144}})),null,'an unloaded LM Studio model reports its trained maximum, not its load size');
 assert.equal(await detectContextWindow(endpoint,'x',async()=>{throw Error('offline');}),null);
});

test('reply reserve shrinks to what the model actually writes once replies have been seen',()=>{
 const u=n=>({tokens:{completion_tokens:n}});
 assert.equal(replyReserve([],1800),1800);assert.equal(replyReserve([u(90),u(60)],1800),1800,'too few samples keeps the ceiling');
 assert.equal(replyReserve([u(90),u(60),u(110),u(50),u(70)],1800),512,'short replies reserve the floor');
 assert.equal(replyReserve([u(900),u(60),u(110),u(50),u(70)],1800),1350);assert.equal(replyReserve([u(1700),u(60),u(110),u(50),u(70)],1800),1800);
});

test('provider re-detects the window after a reply loads a just-in-time model',async()=>{
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl:async()=>({ok:true,json:async()=>({choices:[{message:{content:'READY'},finish_reason:'stop'}]})})});
 let probes=0;provider.detectWindow=async()=>{probes++;if(probes===2)provider.detectedWindow=32768;};
 for(let i=0;i<4;i++)await provider.complete([{role:'user',content:'hi'}]);
 assert.equal(probes,2);assert.equal(provider.detectedWindow,32768);
});

test('provider asks reasoning models not to think, and drops the parameter where a server rejects it',async()=>{
 const sent=[],reply={ok:true,json:async()=>({choices:[{message:{content:'READY'},finish_reason:'stop'}]})};
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl:async(_url,request)=>{const body=JSON.parse(request.body);sent.push(body.reasoning_effort);return body.reasoning_effort&&sent.length===2?{ok:false,status:400,text:async()=>"Unrecognized request argument: 'reasoning_effort'"}:reply;}});
 assert.equal(await provider.complete([{role:'user',content:'hi'}]),'READY');
 assert.equal(await provider.complete([{role:'user',content:'hi'}]),'READY');
 assert.equal(await provider.complete([{role:'user',content:'hi'}]),'READY');
 assert.deepEqual(sent,['none','none',undefined,undefined]);assert.equal(provider.requests,3);
});

test('BM25 ranks specific words above common ones and splits CJK into bigrams',()=>{
 const index=bm25Index([{id:'a',text:'The library closes at nine. The library keeps old maps.'},{id:'b',text:'The festival opens at nine in the square.'},{id:'c',text:'The square has a fountain.'}]);
 assert.equal(bm25Score(index,'a','where are the old maps').matched.join(),'old,map');
 assert.ok(bm25Score(index,'b','festival tonight').score>bm25Score(index,'b','nine').score);
 assert.equal(bm25Score(index,'c','library').score,0);
 assert.deepEqual(terms('图书馆'),['图书','书馆']);
});

test('lore the player describes without its tag words is still selected, below tagged lore',()=>{
 const p=pack(),world=createWorld(p,registry,'lore');
 p.lorebook=[{id:'secret-passage',tags:['tunnel'],scope:'character',character:'nobody',knownBy:'public',text:'A hidden passage behind the bookcase leads to the old boiler room.'},{id:'tagged',tags:['bookcase'],scope:'character',character:'nobody',knownBy:'public',text:'The bookcase was built by the founder.'}];
 const lore=selectLore(world,p,p.playerId,'I push on the bookcase looking for a hidden passage');
 assert.deepEqual(lore.selected.map(e=>e.id),['tagged','secret-passage']);
 assert.match(lore.selected[1].reason,/^text: /);
 assert.equal(selectLore(world,p,p.playerId,'hello there').selected.length,0);
});

test('closed-scene recaps roll up by day this week and by week before that',()=>{
 const scene=(source,day,week)=>({source,day,week,text:`Scene ${source}.`,digest:`changed ${source}`});
 const groups=recapGroups([scene('w1a',2,1),scene('w1b',3,1),scene('d9a',9,2),scene('d9b',9,2),scene('t1',10,2)],10,2);
 assert.deepEqual(groups.map(g=>[g.key,g.scenes.length]),[['week:1',2],['day:9',2],['past:t1',1]]);
 assert.equal(groups[0].period,'Week 1');
 const p=pack(),world=createWorld(p,registry,'recap');
 const {context}=budgetSceneContext({stagedCast:['ada'],sceneHistory:[],location:p.locations[0],day:10,week:2,pastScenes:[scene('w1a',2,1),scene('w1b',3,1),scene('t1',10,2)]},p,world,'x',{render:c=>scenePromptMessages(c,p)});
 assert.deepEqual(context.pastScenes.map(x=>x.source),['week:1','t1']);
 assert.equal(context.pastScenes[0].text,'Scene w1a. Scene w1b.');
 assert.equal(context.pastScenes[0].changes,'changed w1a; changed w1b');
});

test('context size presets cap the window without exceeding what the model reports',()=>{
 assert.equal(effectiveWindow(32768,'minimal'),4096);
 assert.equal(effectiveWindow(32768,'default'),16384);
 assert.equal(effectiveWindow(32768,'max'),32768);
 assert.equal(effectiveWindow(2048,'minimal'),2048);
 assert.equal(effectiveWindow(null,'max'),8192);
 // A cloud model: large window when undetected, and 'default' no longer caps it or digests old turns.
 assert.equal(effectiveWindow(null,'default',true),CLOUD_WINDOW);
 assert.equal(effectiveWindow(1048576,'default',true),1048576);
 assert.equal(effectiveWindow(null,'minimal',true),4096);
 assert.equal(contextPreset('default',true).verbatim,Infinity);assert.equal(contextPreset('default',false).verbatim,16);
 assert.equal(isLoopback('http://127.0.0.1:1234/v1'),true);assert.equal(isLoopback('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'),false);
 assert.throws(()=>validateContextSize('huge'),/minimal, default, or max/);
});

test('context size API switches the active provider and reports the window in use',async()=>{
 const app=createApp({dataPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${app.server.address().port}`,post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  let config=await (await fetch(base+'/api/ai/config')).json();
  assert.equal(config.contextSize,'default');assert.deepEqual(config.contextSizes.map(x=>x.id),['minimal','default','max']);assert.equal(config.contextWindow,8192);
  app.service.provider.detectedWindow=65536;
  const changed=await (await post('/api/ai/context-size',{size:'max'})).json();
  assert.equal(changed.contextWindow,65536);assert.equal(app.service.provider.contextWindow,65536);
  assert.equal((await (await post('/api/ai/context-size',{size:'minimal'})).json()).contextWindow,4096);
  assert.equal((await post('/api/ai/context-size',{size:'huge'})).status,400);
  // Switching provider keeps the chosen preset.
  await post('/api/ai/config',{mode:'offline'});
  config=await (await fetch(base+'/api/ai/config')).json();
  assert.equal(config.contextSize,'minimal');assert.equal(config.contextWindow,4096);
 }finally{app.server.close();app.store.close();}
});


test('wideContext preserves character lines that mention a cast member',()=>{
  const p=pack();
  const charText='Ada nods and replies to the player. ';
  const plainText='The sky grows darker without comment. ';
  const history=[];
  for(let i=0;i<6;i++){
    history.push({source:`h${i}`,input:`Turn ${i}`,text:i%2===0?charText:plainText});
  }
  const base={stagedCast:['ada'],sceneHistory:history,memories:[],playerAction:'Go on'};
  const render=c=>scenePromptMessages(c,p);

  // verbatim:0 disables word-for-word preservation; without wideContext, charLines only have digest LOD
  const {context:stdCtx}=budgetSceneContext({...base},p,{turns:{}},'now',{window:32768,reply:500,verbatim:0,render});
  assert.ok(stdCtx.sceneHistory.every(h=>h.compact===true),
    'all turns compacted to digest without wideContext');

  const {context:wideCtx}=budgetSceneContext({...base},p,{turns:{}},'now',{window:32768,reply:500,verbatim:0,wideContext:true,render});
  const wideChar=wideCtx.sceneHistory.find(h=>h.source==='h0');
  assert.ok(!wideChar.compact,'character line preserved (not digest) with wideContext');
  assert.equal(wideChar.text,charText,'character line keeps full text');
  const widePlain=wideCtx.sceneHistory.find(h=>h.source==='h1');
  assert.ok(widePlain.compact===true,'non-character line still compacted with wideContext');
});

test('wideContext tail window is 1500 chars instead of 700',()=>{
  const p=pack();
  // Long text (>3000 chars) mentioning Ada — full LOD should exceed a moderate budget, forcing tail LOD
  const longText=('Ada discusses the harbor, the project, and many other details that need remembering. ').repeat(80);
  assert.ok(longText.length>3000,'long text exceeds 3000 chars');
  const base={stagedCast:['ada'],sceneHistory:[{source:'h0',input:'Long turn',text:longText}],memories:[],playerAction:'Go on'};
  const render=c=>scenePromptMessages(c,p);
  const opts={window:2500,reply:200,verbatim:0,render};

  // Without wideContext: no full/tail LODs available (charLine disabled) → compacted to digest
  const {context:stdCtx}=budgetSceneContext({...base},p,{turns:{}},'now',opts);
  assert.ok(stdCtx.sceneHistory[0].compact===true,'long Ada turn compacted without wideContext');

  // With wideContext: full/tail + digest available; budget should force tail LOD
  const {context:wideCtx,report}=budgetSceneContext({...base},p,{turns:{}},'now',{...opts,wideContext:true});
  const turn=wideCtx.sceneHistory[0];
  assert.ok(!turn.compact,'long Ada turn preserved (not digest) with wideContext');

  const level=report.included.find(([key])=>key==='history:h0')?.[1];
  assert.ok(level,'history item appears in report.included');

  // When the allocator chose 'tail', the text must be ellipsis + last 1500 chars (not 700)
  if(level==='tail'){
    assert.equal(turn.text,'…'+longText.slice(-1500),
      'tail is ellipsis + last 1500 chars (not 700)');
    assert.equal(turn.text.length,1501,
      'tail text length is 1501 (1 ellipsis + 1500 chars)');
    assert.notEqual(turn.text,'…'+longText.slice(-700),
      'tail does not use the old 700-char window');
  }else{
    // If 'full' was chosen (budget was sufficient), the text equals the original
    assert.equal(level,'full');
    assert.equal(turn.text,longText);
  }
});

test('Venus sheet: love life reaches the prompt only in an involved one-on-one scene, and empty voice fields stay out',()=>{
 const p=pack(),world=createWorld(p,registry,'love'),ada=p.actors.find(a=>a.id==='ada');Object.assign(ada,{datingHistory:'One long ex.',datingPreference:'Casual, sleeps around.',kinks:'Being watched.',isVirgin:false,voice:'',style:'',examples:[],neverSays:[]});
 const run=(cast,dating)=>budgetSceneContext({stagedCast:cast,sceneHistory:[],location:p.locations[0],playerAction:'Hello',dating},p,world,'none',{window:32000,render:c=>scenePromptMessages(c,p)}).context.castProfiles.find(a=>a.id==='ada');
 const solo=run(['ada'],[{character:'ada',phase:'dating'}]);assert.deepEqual(solo.loveLife,{history:'One long ex.',preference:'Casual, sleeps around.',kinks:'Being watched.'});for(const k of ['voice','style','examples','neverSays','fingerprint'])assert.equal(solo[k],undefined);
 const r=budgetSceneContext({stagedCast:['ada'],sceneHistory:[],location:p.locations[0],playerAction:'Hello',dating:[{character:'ada',phase:'dating'}]},p,world,'none',{window:32000,render:c=>scenePromptMessages(c,p)});assert.match(JSON.stringify(scenePromptMessages(r.context,p)),/Being watched/);assert.equal(run(['ada'],[]).loveLife,undefined);assert.equal(run(['ada','brin'],[{character:'ada',phase:'dating'}]).loveLife,undefined);
});
