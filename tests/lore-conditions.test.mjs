import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {selectLore} from '../packages/ai/context.mjs';
const vault={id:'vault',text:'The vault under the workshop opens only at night.',tags:['vault'],scope:'location',location:'workshop',knownBy:'public'};
const pack=(...lore)=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.lorebook=lore;return p;};
const ids=r=>r.selected.map(e=>e.id),why=(r,id)=>r.omitted.find(e=>e.id===id)?.reason;

test('lore only surfaces when committed world state satisfies its when-gate and delay',()=>{
 const p=pack({...vault,when:{flags:{found_key:true}}},{...vault,id:'late',tags:['late'],delay:5}),s=createWorld(p,registry,'gate');
 let r=selectLore(s,p,'player','vault late');assert.deepEqual(ids(r),[]);assert.match(why(r,'vault'),/^when: Flag found_key/);assert.equal(why(r,'late'),'delay: until tick 5');
 s.flags.found_key=true;s.tick=5;r=selectLore(s,p,'player','vault late');assert.deepEqual(ids(r).sort(),['late','vault']);assert.deepEqual(r.activated.sort(),['late','vault']);
});

test('sticky keeps a fired entry for N ticks, then cooldown blocks keyed re-activation, all from saved turns',()=>{
 const p=pack({...vault,sticky:2,cooldown:3}),s=createWorld(p,registry,'timers'),at=(tick,query)=>{s.tick=tick;return selectLore(s,p,'player',query);};
 const fire=tick=>{s.turns[`t${tick}`]={id:`t${tick}`,status:'complete',events:[{tick}],loreActivations:{tick,ids:['vault']}};};
 let r=at(10,'the vault');assert.deepEqual(r.activated,['vault']);fire(10);
 r=at(11,'weather');assert.deepEqual(ids(r),['vault']);assert.equal(r.selected[0].reason,'sticky: 1 tick(s) left');assert.deepEqual(r.activated,[],'sticky does not refresh itself');
 r=at(12,'the vault');assert.deepEqual(ids(r),[]);assert.equal(why(r,'vault'),'cooldown: until tick 15');
 r=at(14,'weather');assert.deepEqual(ids(r),[]);assert.equal(why(r,'vault'),undefined,'an unkeyed entry is simply not relevant');
 r=at(15,'vault');assert.deepEqual(r.activated,['vault']);
 s.turns.old={id:'old',status:'complete',events:[{tick:1}],loreActivations:{tick:1,ids:['vault']}};delete s.turns.t10;assert.deepEqual(at(12,'vault').activated,['vault'],'activations outside every window are ignored');
});

test('a failed when-gate beats stickiness, and invalid gates or timers are rejected at load',()=>{
 const p=pack({...vault,sticky:5,when:{flags:{found_key:true}}}),s=createWorld(p,registry,'gate2');s.flags.found_key=true;s.tick=3;
 s.turns.a={id:'a',status:'complete',events:[{tick:3}],loreActivations:{tick:3,ids:['vault']}};assert.deepEqual(ids(selectLore(s,p,'player','')),['vault']);
 s.flags.found_key=false;assert.deepEqual(ids(selectLore(s,p,'player','')),[]);
 assert.throws(()=>validatePack(pack({...vault,when:{location:'moon'}}),registry),/lorebook\[0\]\.when\.location/);
 assert.throws(()=>validatePack(pack({...vault,when:{completedScenes:['nope']}}),registry),/completedScenes: unknown scene nope/);
 assert.throws(()=>validatePack(pack({...vault,sticky:-1}),registry),/lorebook\[0\]\.sticky/);
 assert.throws(()=>validatePack(pack({...vault,cooldown:1.5}),registry),/lorebook\[0\]\.cooldown/);
});

test('the service records only fresh activations that reached the prompt on the committed turn',async()=>{
 const p=pack({...vault,sticky:3});delete p.modules['world.schedule'];
 const provider={name:'probe',async interpretScene(){throw Error('unused');},async generateScene(context){assert.ok(context.lorebook.some(e=>e.id==='vault'));return {lines:[{speaker:'ada',text:'Ask me about it later.'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'rec'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('rec',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'What is in the vault?',location:'hub',characters:['ada'],activity:'talk'}}});
  const turn=store.load('rec').turns.open;assert.deepEqual(turn.loreActivations,{tick:r.state.tick,ids:['vault']});}
 finally{store.close();}
});
