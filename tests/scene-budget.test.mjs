import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

const pack=(extra={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};delete p.schedules;return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const initial=state,events=[];const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;events.push(...r.turn.events);return r;};return {act,initial,events,get state(){return state;}};};
const talk=(text,activity='talk')=>({text,location:'hub',characters:['ada'],activity});

test('a budgeted scene records its focus, budget and input count, and replays the same',()=>{
 const g=run(pack({sceneBudget:3}),'budget');
 g.act('core.scene',talk('Hi Ada.'));assert.deepEqual([g.state.scene.focus,g.state.scene.budget,g.state.scene.inputs],['ada',3,1]);
 g.act('core.scene',talk('How was your day?','continue'));g.act('core.scene',talk('Want a coffee?','continue'));assert.equal(g.state.scene.inputs,3);
 const again=replay(g.initial,g.events);assert.deepEqual([again.scene,again.modules],[g.state.scene,g.state.modules]);
});

test('packs without a budget keep the old scene shape and digest',()=>{
 const p=pack(),g=run(p,'plain');g.act('core.scene',talk('Hi Ada.'));
 assert.equal(g.state.scene.budget,undefined);assert.equal(g.state.scene.focus,undefined);
 assert.throws(()=>validatePack(pack({sceneBudget:0}),registry),/sceneBudget/);assert.throws(()=>validatePack(pack({sceneBudget:2.5}),registry),/sceneBudget/);
});

test('the input that reaches the budget gets a closing reply that answers it, then the scene ends',async()=>{
 const p=pack({sceneBudget:2}),seen=[];
 const provider={name:'probe',async generateScene(context){seen.push({phase:context.scenePhase,action:context.playerAction,prompt:scenePromptMessages(context,p).map(m=>m.content).join('\n')});return {lines:[{speaker:'',text:'You ask.'},{speaker:'ada',text:'Sure, see you then.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'closing'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{
  await service.act('closing',{id:'open',expectedRevision:0,command:{type:'core.scene',args:talk('Hi Ada.')}});
  const r=await service.act('closing',{id:'last',expectedRevision:1,command:{type:'core.scene',args:talk('Coffee tomorrow?','continue')}});
  assert.deepEqual(seen.map(s=>s.phase),['opening','closing']);
  assert.match(seen[1].prompt,/PLAYER ACTION\nCoffee tomorrow\?/);assert.match(seen[1].prompt,/Answer the player action first/);
  assert.match(seen[0].prompt,/restating only the player action in second person/);assert.match(seen[0].prompt,/5–6 visual-novel entries/);
  assert.equal(r.state.scene,null);assert.equal(r.turn.id,'last');assert.match(r.turn.narrative,/see you then/);
  assert.equal(r.state.turns['last-end'].events.find(e=>e.type==='core.sceneEnded').payload.reason,'natural');
 }finally{store.close();}
});

test('an unbudgeted scene also targets a full typed exchange',()=>{
 const p=pack(),prompt=scenePromptMessages({stagedCast:['ada'],scenePhase:'opening',playerAction:'Hi.'},p).map(m=>m.content).join('\n');
 assert.match(prompt,/5–6 visual-novel entries/);assert.match(prompt,/At least three entries should be spoken NPC lines/);
});
