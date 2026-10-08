import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {playerLines} from '../public/turn-presentation.mjs';

// GC1.2 typed input and GC1.4 failure/retry, driven through GameService with mock providers only.
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const typed='I say "Don\'t go yet, Ada — are you okay? 🙂"';
const spoken='Don\'t go yet, Ada — are you okay? 🙂';
function turnRequest(id,input,expectedRevision=0){return {id,expectedRevision,input,command:{type:'core.scene',args:{text:input,location:'hub',characters:['ada'],activity:'talk'}}};}
function setup(provider){const p=pack();delete p.modules['world.schedule'];const store=new Store();store.insert(createWorld(p,registry,'probe',42));const service=new GameService(store,{[p.id]:p},registry,provider);return {p,store,service};}
const reply=extra=>({lines:[{speaker:'',type:'playerSpeech',sourceId:'player-1',text:spoken},{speaker:'ada',text:'I hear you.'}],memories:[],facts:[],...extra});

test('GC1.2 typed speech keeps its exact words in the saved turn and in history',async()=>{
 const prompts=[];const provider={name:'probe',async generateScene(context){prompts.push(JSON.stringify(context));return reply();}};
 const h=setup(provider);try{
  const first=await h.service.act('probe',turnRequest('one',typed));
  const t=first.state.turns.one;
  assert.equal(t.input,typed);
  assert.equal(t.fallback,false);
  assert.ok(t.sceneLines.some(l=>l.type==='playerSpeech'&&l.text===spoken),JSON.stringify(t.sceneLines));
  const second=await h.service.act('probe',turnRequest('two','I smile.',first.state.revision));
  assert.equal(second.state.turns.two.input,'I smile.');
  assert.ok(prompts.at(-1).includes(spoken),'the next prompt carries the earlier typed words verbatim');
 }finally{h.store.close();}
});

// Scene reply as the provider would stream it; the emoji is split between SSE records so the surrogate pair crosses a delta.
const content=JSON.stringify({lines:[{speaker:'',type:'playerSpeech',sourceId:'player-1',text:spoken},{speaker:'ada',text:'I hear you.'}],memories:[],facts:[]});
function sse(content){const enc=new TextEncoder(),cut=content.indexOf('\uD83D')+1,parts=[content.slice(0,cut),content.slice(cut)];return new Response(new ReadableStream({start(c){for(const d of parts)c.enqueue(enc.encode(`data: ${JSON.stringify({choices:[{delta:{content:d}}]})}\n\n`));c.enqueue(enc.encode(`data: ${JSON.stringify({choices:[{delta:{},finish_reason:'stop'}],usage:{prompt_tokens:10,completion_tokens:5}})}\n\n`));c.enqueue(enc.encode('data: [DONE]\n\n'));c.close();}}),{status:200,headers:{'Content-Type':'text/event-stream'}});}
const compatible=fetchImpl=>new CompatibleProvider({endpoint:'http://127.0.0.1:1/v1/chat/completions',model:'fake',fetchImpl});

test('GC1.2 typed speech survives streamed assembly with a surrogate pair split across chunks',async()=>{
 const h=setup(compatible(async()=>sse(content)));try{
  const r=await h.service.act('probe',turnRequest('stream',typed));const t=r.state.turns.stream;
  assert.equal(t.fallback,false,t.failureReason);assert.equal(t.input,typed);
  assert.ok(t.sceneLines.some(l=>l.type==='playerSpeech'&&l.text===spoken),JSON.stringify(t.sceneLines));
 }finally{h.store.close();}
});

test('GC1.2 invented player acceptance never reaches the saved turn; a repaired reply matches the clean run',async()=>{
 const json=body=>Response.json({choices:[{message:{content:JSON.stringify(body)}}],usage:{prompt_tokens:10,completion_tokens:5}});
 const clean={lines:[{speaker:'',type:'playerSpeech',sourceId:'player-1',text:spoken},{speaker:'ada',text:'I hear you.'}],memories:[],facts:[]};
 const invented={...clean,lines:[...clean.lines,{speaker:'',type:'playerAction',text:'You accept her offer, kiss her and promise to stay the night.'}]};
 const run=async replies=>{let n=0;const h=setup(compatible(async()=>json(replies[Math.min(n++,replies.length-1)])));try{const r=await h.service.act('probe',turnRequest('emb',typed));return {turn:r.state.turns.emb,state:r.state,calls:n};}finally{h.store.close();}};
 const a=await run([clean]),repaired=await run([invented,clean]),stuck=await run([invented]);
 assert.equal(repaired.turn.fallback,false,repaired.turn.failureReason);
 assert.deepEqual(repaired.turn.sceneLines,a.turn.sceneLines);
 assert.deepEqual(repaired.turn.events,a.turn.events);
 assert.equal(stuck.turn.fallback,true);
 assert.ok(!/accept her offer|kiss her/.test(stuck.turn.narrative+JSON.stringify(stuck.turn.sceneLines)));
 assert.deepEqual(stuck.turn.events,a.turn.events);
 assert.deepEqual(stuck.state.modules,a.state.modules);
});

const json=body=>Response.json({choices:[{message:{content:typeof body==='string'?body:JSON.stringify(body)}}],usage:{prompt_tokens:10,completion_tokens:5}});
const clean={lines:[{speaker:'',type:'playerSpeech',sourceId:'player-1',text:spoken},{speaker:'ada',text:'I hear you.'}],memories:[],facts:[]};
const hang=async(url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true}));

test('GC1.4 a dropped connection keeps the typed input, applies mechanics once and retry adds no second effect',async()=>{
 let up=false,calls=0;const h=setup(compatible(async()=>{calls++;if(!up)throw new TypeError('fetch failed');return json(clean);}));try{
  const first=await h.service.act('probe',turnRequest('drop',typed)),t=first.state.turns.drop;
  assert.equal(calls,1,'a dropped connection is not silently re-sent');
  assert.equal(t.fallback,true);assert.equal(t.input,typed);assert.equal(t.failureDiagnostic.code,'scene_unavailable');assert.match(t.narrative,/Retry this turn/);
  assert.ok(t.events.length>0);const revision=first.state.revision,events=structuredClone(t.events);
  const failedAgain=await h.service.retry('probe','drop');assert.equal(failedAgain.state.turns.drop.fallback,true);assert.equal(failedAgain.state.turns.drop.input,typed);
  up=true;const r=await h.service.retry('probe','drop');
  assert.equal(r.state.revision,failedAgain.state.revision);assert.deepEqual(r.state.turns.drop.events,events);
  assert.equal(r.state.turns.drop.fallback,false);assert.equal(r.state.turns.drop.failureDiagnostic,null);assert.equal(r.state.turns.drop.input,typed);
  assert.ok(r.state.turns.drop.sceneLines.some(l=>l.type==='playerSpeech'&&l.text===spoken));
 }finally{h.store.close();}
});

test('GC1.4 a local timeout and a mid-stream cancel save no partial prose and retry applies the turn once',async()=>{
 for(const mode of ['timeout','cancel']){
  const ctl=new AbortController();let calls=0,streamed=false;
  const provider=compatible(async(url,opts)=>{calls++;if(calls>1)return json(clean);if(mode==='timeout')return hang(url,opts);
   const enc=new TextEncoder();return new Response(new ReadableStream({start(c){streamed=true;c.enqueue(enc.encode(`data: ${JSON.stringify({choices:[{delta:{content:'{"lines":[{"speaker":"ada","text":"Half a sent'}}]})}\n\n`));opts.signal.addEventListener('abort',()=>c.error(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});setTimeout(()=>ctl.abort(),5);}}),{status:200,headers:{'Content-Type':'text/event-stream'}});});
  if(mode==='timeout')provider.timeout=5;
  const h=setup(provider);try{
   const first=await h.service.act('probe',turnRequest(mode,typed),mode==='cancel'?ctl.signal:undefined),t=first.state.turns[mode];
   assert.equal(calls,1,mode);assert.equal(t.fallback,true,mode);assert.equal(t.failureDiagnostic.code,mode==='timeout'?'scene_timeout':'scene_cancelled',mode);
   assert.equal(t.input,typed,mode);assert.ok(!/Half a sent/.test(t.narrative+JSON.stringify(t.sceneLines)),mode);
   assert.ok(mode==='timeout'||streamed);
   const revision=first.state.revision,events=structuredClone(t.events);
   const r=await h.service.retry('probe',mode);
   assert.equal(r.state.revision,revision,mode);assert.deepEqual(r.state.turns[mode].events,events,mode);assert.equal(r.state.turns[mode].fallback,false,mode);
   assert.equal(r.state.turns[mode].input,typed,mode);
  }finally{h.store.close();}
 }
});

test('GC1.4 malformed metadata keeps validated prose and records no invented memory or fact',async()=>{
 const bad={lines:clean.lines,memories:'several things happened',facts:[null,7,{text:42}]};
 const good=await (async()=>{const h=setup(compatible(async()=>json(clean)));try{return (await h.service.act('probe',turnRequest('meta',typed))).state;}finally{h.store.close();}})();
 let n=0;const h=setup(compatible(async()=>json(++n===1?bad:'not json at all')));try{
  const r=await h.service.act('probe',turnRequest('meta',typed)),t=r.state.turns.meta;
  assert.equal(t.fallback,false,t.failureReason);assert.deepEqual(t.sceneLines,good.turns.meta.sceneLines);
  assert.deepEqual(t.events,good.turns.meta.events);assert.equal(t.failureDiagnostic,null);
 }finally{h.store.close();}
});

test('GC1.4 a completed turn cannot be retried or re-sent into a second effect',async()=>{
 let calls=0;const h=setup(compatible(async()=>{calls++;return json(clean);}));try{
  const first=await h.service.act('probe',turnRequest('once',typed)),sent=calls;const before=structuredClone(first.state);
  const again=await h.service.act('probe',turnRequest('once',typed,first.state.revision));
  assert.equal(calls,sent,'a re-sent submit reads the saved turn without a model call');assert.equal(again.state.revision,before.revision);
  await assert.rejects(h.service.retry('probe','once'),/Only a failed generated turn can be retried/);
  assert.deepEqual(h.store.load('probe').turns,before.turns);assert.deepEqual(h.store.load('probe').events,before.events);
 }finally{h.store.close();}
});

test('GC1.2 a reply that drops the typed speech is repaired by source ID, not replaced by invented words',async()=>{
 const dropped={lines:[{speaker:'ada',text:'I hear you.'}],memories:[],facts:[]};let n=0;
 const h=setup(compatible(async()=>json(++n===1?dropped:clean)));try{
  const r=await h.service.act('probe',turnRequest('repair',typed)),t=r.state.turns.repair;
  assert.equal(t.fallback,false,t.failureReason);
  assert.deepEqual(t.sceneLines.filter(l=>l.type==='playerSpeech').map(l=>l.text),[spoken]);
  assert.ok(n>=2,'the repair request reached the model');
 }finally{h.store.close();}
});

test('GC1.2 typed speech is paged verbatim and never folded into the NPC reply',async()=>{
 const h=setup(compatible(async()=>json(clean)));try{
  const r=await h.service.act('probe',turnRequest('page',typed));const pack=h.p;pack.gameProject={conversationStyle:'continuous'};
  const lines=playerLines({state:r.state,pack});
  assert.ok(lines.some(l=>l.type==='playerSpeech'&&l.text===spoken&&l.speaker===pack.playerId),JSON.stringify(lines));
  assert.ok(lines.some(l=>l.speaker==='ada'&&l.text==='I hear you.'),JSON.stringify(lines));
 }finally{h.store.close();}
});

test('GC1.4 null memory and fact entries in deferred metadata keep the prose and do not fail the turn',async()=>{
 const meta={summary:'',end_scene:false,memories:[null,{charKey:'ada',type:'neutral',desc:'To Player, Ada said: "I hear you."'}],facts:[null],metadataEvidence:{memories:[],facts:[]}};
 const provider={name:'probe',bundlesSceneMetadata:true,async generateScene(){return {...reply(),finalizeMetadata:async()=>meta};}};
 const h=setup(provider);try{
  const r=await h.service.act('probe',turnRequest('meta',typed));const t=r.state.turns.meta;
  assert.equal(t.fallback,false,t.failureReason);
  assert.ok(t.sceneLines.some(l=>l.speaker==='ada'&&l.text==='I hear you.'),JSON.stringify(t.sceneLines));
  assert.ok(t.ledger.some(m=>m.desc.includes('I hear you.')),JSON.stringify(t.ledger));
 }finally{h.store.close();}
});

test('GC1.2 typed speech on a later page of a long continuous reply keeps its owner and words',async()=>{
 const long={lines:[1,2,3,4].map(i=>({speaker:'ada',text:`Ada line ${i} fills a page with enough ordinary words.`})).concat([{speaker:'',type:'playerSpeech',sourceId:'player-1',text:spoken},{speaker:'ada',text:'I hear you.'}]),memories:[],facts:[]};
 const h=setup(compatible(async()=>json(long)));try{
  const r=await h.service.act('probe',turnRequest('later',typed));const pack=h.p;pack.gameProject={conversationStyle:'continuous'};
  const lines=playerLines({state:r.state,pack}),idx=lines.findIndex(l=>l.type==='playerSpeech');
  assert.ok(idx>=4,JSON.stringify(lines));assert.equal(lines[idx].speaker,pack.playerId);assert.equal(lines[idx].text,spoken);
  assert.ok(lines.every((l,i)=>i===idx||!l.text.includes(spoken)),JSON.stringify(lines));
 }finally{h.store.close();}
});

test('GC1.4 a network error after partial streamed deltas, not an abort, keeps input and saves no partial prose',async()=>{
 let calls=0;const provider=compatible(async()=>{calls++;if(calls>1)return json(clean);const enc=new TextEncoder();return new Response(new ReadableStream({start(c){c.enqueue(enc.encode(`data: ${JSON.stringify({choices:[{delta:{content:'{"lines":[{"speaker":"ada","text":"Half a sent'}}]})}\n\n`));setTimeout(()=>c.error(new TypeError('socket reset')),5);}}),{status:200,headers:{'Content-Type':'text/event-stream'}});});
 const h=setup(provider);try{
  const first=await h.service.act('probe',turnRequest('netdrop',typed)),t=first.state.turns.netdrop;
  assert.equal(calls,1,'a mid-stream error is not silently re-sent');assert.equal(t.fallback,true,t.failureReason);assert.equal(t.input,typed);
  assert.ok(!/Half a sent/.test(t.narrative+JSON.stringify(t.sceneLines)));assert.match(t.narrative,/Retry this turn/);
  const revision=first.state.revision,r=await h.service.retry('probe','netdrop');
  assert.equal(r.state.revision,revision);assert.equal(r.state.turns.netdrop.fallback,false);assert.equal(r.state.turns.netdrop.input,typed);assert.equal(calls,2);
 }finally{h.store.close();}
});

test('GC1.4 a timeout and a mid-stream cancel show the same Retry this turn text as a dropped connection',async()=>{
 for(const mode of ['timeout','cancel']){
  const ctl=new AbortController();let calls=0;
  const provider=compatible(async(url,opts)=>{calls++;if(calls>1)return json(clean);if(mode==='timeout')return hang(url,opts);
   const enc=new TextEncoder();return new Response(new ReadableStream({start(c){c.enqueue(enc.encode(`data: ${JSON.stringify({choices:[{delta:{content:'{"lines":[{"speaker":"ada","text":"Half a sent'}}]})}\n\n`));opts.signal.addEventListener('abort',()=>c.error(Object.assign(new Error('aborted'),{name:'AbortError'})),{once:true});setTimeout(()=>ctl.abort(),5);}}),{status:200,headers:{'Content-Type':'text/event-stream'}});});
  if(mode==='timeout')provider.timeout=5;
  const h=setup(provider);try{
   const first=await h.service.act('probe',turnRequest(mode,typed),mode==='cancel'?ctl.signal:undefined),t=first.state.turns[mode];
   assert.equal(t.fallback,true,mode);assert.match(t.narrative,/Retry this turn/,mode);
  }finally{h.store.close();}
 }
});

test('GC1.4 a completed turn after malformed metadata applies its events once and cannot be retried',async()=>{
 const bad={lines:clean.lines,memories:'several things happened',facts:[null,7,{text:42}]};let n=0;
 const h=setup(compatible(async()=>json(++n===1?bad:clean)));try{
  const first=await h.service.act('probe',turnRequest('mretry',typed)),t=first.state.turns.mretry;
  assert.equal(t.fallback,false,t.failureReason);const events=structuredClone(t.events),revision=first.state.revision;
  await assert.rejects(h.service.retry('probe','mretry'),/Only a failed generated turn can be retried/);
  const saved=h.store.load('probe');assert.equal(saved.revision,revision);assert.deepEqual(saved.turns.mretry.events,events);
 }finally{h.store.close();}
});
