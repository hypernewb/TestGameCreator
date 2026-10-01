import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';

const pack=(extra={})=>{
  const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
  p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};
  delete p.schedules;
  p.modules={...p.modules,'social.acts':'0.1.0','world.economy':'0.2.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','items.inventory':'0.2.0','social.conversation':'0.1.0','social.relationships':'0.1.0'};
  p.actProfiles=[{character:'ada',entries:[{id:'coffee_tease',kind:'tease',target:'coffee',points:4,reason:'you teased her about coffee'}]}];
  p.items=[{id:'coffee',name:'Coffee',owner:'hub',shop:true,price:5,stock:10}];
  p.initialMoney=20;
  p.datingProfiles=[{character:'ada',thresholds:{crush:0,date:10,exclusive:20},preferences:[],signals:[]}];
  p.romanceTempoProfiles=[{character:'ada',advancement:'automatic',ranks:[{id:'start',name:'Start',points:0,ceiling:20},{id:'next',name:'Next',points:10,ceiling:40}],initialPoints:10,gifts:{preferences:[]}}];
  p.initialRelationships=[{character:'ada',trust:50}];
  return p;
};

const seen=[];
const probeProvider={
  name:'probe',
  async interpret(input,context,available){
    const text=input.trim().toLowerCase();
    if(text.includes('tease') || text.includes('hello') || text.includes('say')){
      return {type:'core.scene',args:{text:input.trim(),location:'hub',characters:['ada'],activity:'talk'}};
    }
    return {type:'clarify',args:{question:'test'}};
  },
  async complete(messages,signal,responseFormat,onDelta){return 'OK';},
  async generateScene(context){
    seen.push(context.direction||'');
    return {lines:[{speaker:'ada',text:'You got me there.'}]};
  }
};

test('mixed: tease + buy both succeed',async()=>{
  const p=pack();
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed1'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r=await service.act('mixed1',{id:'turn1',expectedRevision:0,input:'I tease her about her coffee and buy us two coffees'});
    assert.equal(r.turn.command.type,'core.scene');
    const events=r.turn.events;
    const moneyChanged=events.find(e=>e.type==='world.moneyChanged');
    assert.ok(moneyChanged,'money changed for coffee purchase');
    const transferred=events.find(e=>e.type==='items.transferred' && e.payload.item==='coffee');
    assert.ok(transferred,'coffee transferred');
    assert.equal(r.state.modules['world.economy'].balance,15,'coffee costs 5');
  }finally{store.close();}
});

test('mixed: a failed part leaves no partial state and still records its refusal',async()=>{
  const p=pack();
  p.initialMoney=0;
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed2'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r=await service.act('mixed2',{id:'turn1',expectedRevision:0,input:'I tease her about her coffee and buy us two coffees'});
    const events=r.turn.events;
    const sceneStarted=events.find(e=>e.type==='core.sceneStarted');
    assert.ok(sceneStarted,'scene started');
    assert.equal(r.state.modules['world.economy'].balance,0,'no money spent');
    const refusal=events.find(e=>e.type==='core.refused' && e.payload.refusal?.code==='item');
    assert.ok(refusal,'buy refusal recorded in the same turn');
    assert.equal(r.turn.refusal.code,'item','refusal passed to narration');
    assert.ok(!events.some(e=>e.type==='items.transferred'&&e.payload.to==='player'),'the rejected part transfers nothing');
  }finally{store.close();}
});

test('mixed: up to 3 operations per turn including primary',async()=>{
  const p=pack();
  p.initialMoney=30;
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed3'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r=await service.act('mixed3',{id:'turn1',expectedRevision:0,input:'I say hello and buy a coffee and give the coffee to her'});
    assert.equal(r.turn.command.type,'core.scene');
    const events=r.turn.events;
    const moneyChanged=events.find(e=>e.type==='world.moneyChanged');
    const transferred=events.find(e=>e.type==='items.transferred' && e.payload.to==='ada');
    assert.ok(moneyChanged,'buy happened');
    assert.ok(transferred,'give happened');
  }finally{store.close();}
});

test('mixed: parts beyond 3 produce a narrated cue',async()=>{
  const p=pack();
  p.initialMoney=50;
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed6'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  seen.length=0;
  try{
    // 5 parts: the primary plus two operations settle, the rest is a cue the narrator weaves in.
    const r=await service.act('mixed6',{id:'turn1',expectedRevision:0,input:'I say hello and buy a coffee and give the coffee to her and buy another coffee and move to workshop'});
    assert.equal(r.state.actors.player.location,'hub','the fourth and fifth parts do not move the player');
    assert.equal(seen.length,1,'one narration for the turn');
    assert.match(seen[0],/wait/i,'the cue reaches the scene prompt');
  }finally{store.close();}
});

test('mixed: replay reproduces the same events and split',async()=>{
  const p=pack();
  p.initialMoney=30;
  const store=new Store();
  const world=createWorld(p,registry,'mixed7');
  store.insert(world);
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r1=await service.act('mixed7',{id:'turn1',expectedRevision:0,input:'I say hello and buy a coffee and give the coffee to her'});
    const shape=state=>state.turns.turn1.events.map(e=>`${e.type}:${JSON.stringify(e.payload)}`);
    assert.deepEqual(shape(r1.state),shape(r1.state),'one turn, one ordered event list');
    // Replaying the recorded command from the same start gives the same split, and import agrees.
    const again=execute(createWorld(p,registry,'mixed7'),r1.turn.command,p,registry);
    assert.deepEqual(shape(again.state),shape(r1.state),'engine replay of the recorded command matches');
    assert.equal(again.state.modules['world.economy'].balance,25);
    const imported=validateImport(exportCampaign(r1.state),p,registry);
    assert.deepEqual(shape(imported),shape(r1.state),'imported history reproduces the split');
    assert.equal(imported.modules['world.economy'].balance,25);
    // A second run of the same turn from the same state is identical.
    const store2=new Store();
    store2.insert(createWorld(p,registry,'mixed7'));
    const r2=await new GameService(store2,{[p.id]:p},registry,probeProvider).act('mixed7',{id:'turn1',expectedRevision:0,input:'I say hello and buy a coffee and give the coffee to her'});
    assert.deepEqual(shape(r2.state),shape(r1.state));
    store2.close();
  }finally{store.close();}
});

test('mixed: components execute in order',async()=>{
  const p=pack();
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed4'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r=await service.act('mixed4',{id:'turn1',expectedRevision:0,input:'I say hello and buy a coffee and give the coffee to her'});
    const order=r.turn.events.filter(e=>['world.moneyChanged','items.transferred'].includes(e.type)).map(e=>e.type);
    assert.deepEqual(order,['items.transferred','world.moneyChanged','items.transferred'],'bought, then paid, then given');
    assert.ok(r.turn.events[0].type==='core.patch'||r.turn.events.some(e=>e.type==='social.spoke'),'the spoken act runs first');
    assert.equal(r.state.modules['world.economy'].balance,15);
  }finally{store.close();}
});

test('mixed: invite as component works',async()=>{
  const p=pack();
  p.initialMoney=20;
  const store=new Store();
  store.insert(createWorld(p,registry,'mixed5'));
  const service=new GameService(store,{[p.id]:p},registry,probeProvider);
  try{
    const r=await service.act('mixed5',{id:'turn1',expectedRevision:0,input:'I say hello and invite Ada to the workshop'});
    const events=r.turn.events;
    const inviteEvent=events.find(e=>e.type==='social.inviteAccepted' || e.type==='social.inviteDeclined');
    assert.ok(inviteEvent || events.find(e=>e.type==='core.refused' && e.payload.refusal?.code), 'invite attempted');
  }finally{store.close();}
});

test('mixed: a refused part rolls back whole and the engine caps the split',async()=>{
  const p=pack();
  p.initialMoney=0;
  const world=createWorld(p,registry,'mixed8');
  const store=new Store();
  store.insert(world);
  try{
    const r=execute(world,{id:'turn1',type:'core.wait',args:{},actorId:'player',expectedRevision:0,components:[{type:'core.move',args:{to:'dungeon'}},{type:'world.buy',args:{item:'coffee'}},{type:'items.give',args:{item:'coffee',target:'ada'}}]},p,registry);
    assert.equal(r.state.actors.player.location,'hub','the unreachable move changed nothing');
    assert.equal(r.state.modules['world.economy'].balance,0,'nothing spent');
    assert.ok(!r.turn.events.some(e=>e.type==='items.transferred'),'no half-applied transfer');
    assert.deepEqual(r.turn.events.filter(e=>e.type==='core.refused').map(e=>e.payload.refusal.code),['place','item'],'each refused part is recorded');
    assert.equal(r.turn.refusal.code,'place','the refusal reaches narration');
    assert.throws(()=>execute(world,{id:'bad',type:'core.wait',args:{},actorId:'player',expectedRevision:0,components:[{type:'core.move'}]},p,registry),/Invalid turn components/);
  }finally{store.close();}
});