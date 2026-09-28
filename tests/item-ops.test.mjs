import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,replay,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {heldBy} from '../packages/modules/inventory.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
// A small economy pack: a bean shop with stock and daily restock, stackable and single-use items, a charged item, and one recipe.
function pack(){
 const p=clone(neutral);
 p.modules['items.inventory']='0.2.0';p.modules['world.economy']='0.2.0';delete p.modules['world.schedule'];delete p.modules['story.quests'];delete p.schedules;delete p.quests;
 p.initialMoney=100;
 p.items=[
  {id:'bean',name:'Coffee beans',owner:'hub',shop:true,price:10,stock:5,restock:3,stack:4},
  {id:'roll',name:'Butter roll',owner:'hub',shop:true,price:4,stock:2,stack:9},
  {id:'brew',name:'Cold brew',owner:'player',stack:5,use:{text:'You drink the cold brew.',effects:[{type:'flag',id:'caffeinated',value:true}]}},
  {id:'vial',name:'Perfume vial',owner:'player',use:{charges:2,text:'You dab the perfume.',effects:[{type:'flag',id:'scented',value:true}]}},
  {id:'tonic',name:'Expensive tonic',owner:'player',use:{effects:[{type:'money',delta:-100000}]}}
 ];
 p.recipes=[{id:'espresso',name:'Brew an espresso',location:'workshop',inputs:[{item:'bean',count:1}],output:{item:'brew',count:1}}];
 return p;
}
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}
const inv=s=>s.modules['items.inventory'];

test('pack with quantities, consumables, charges, and recipes validates',()=>{validatePack(pack(),registry);});

test('buying moves real units: stock depletes, partial stacks nest, a sold-out shop refuses',()=>{
 const h=harness(pack());
 h.act('world.buy',{item:'bean',count:3});
 assert.equal(heldBy(h.state,'bean','hub'),2);assert.equal(heldBy(h.state,'bean','player'),3);
 assert.deepEqual(inv(h.state).owners.bean,{hub:2,player:3});
 assert.equal(h.state.modules['world.economy'].balance,70);
 h.act('world.buy',{item:'roll',count:2});
 assert.equal(heldBy(h.state,'roll','hub'),0);
 const before=clone(h.state);
 assert.throws(()=>h.act('world.buy',{item:'roll',count:1}),/sold out/);
 assert.deepEqual(h.state,before,'a failed buy changes nothing');
});

test('stack caps bind at the holder: overbuying is rejected even with stock left',()=>{
 const h=harness(pack());
 h.act('world.buy',{item:'bean',count:3});
 h.act('world.sell',{item:'bean',count:2});
 const before=clone(h.state);
 assert.throws(()=>h.act('world.buy',{item:'bean',count:4}),/Can't hold more than 4/);
 assert.deepEqual(h.state,before);
});

test('selling returns units and money to the shop',()=>{
 const h=harness(pack());
 h.act('world.buy',{item:'bean',count:3});
 h.act('world.sell',{item:'bean',count:2});
 assert.equal(h.state.modules['world.economy'].balance,80);assert.equal(heldBy(h.state,'bean','hub'),4);assert.equal(heldBy(h.state,'bean','player'),1);
});

test('stock restocks once per campaign day up to the authored maximum',()=>{
 const h=harness(pack());
 h.act('world.buy',{item:'bean',count:3});
 for(let i=0;i<13;i++)h.act('core.wait');
 assert.equal(heldBy(h.state,'bean','hub'),5,'hub had 2; the daily restock adds 3, capped at stock 5');
 assert.ok(h.state.events.some(e=>e.type==='world.restocked'));
 for(let i=0;i<12;i++)h.act('core.wait');
 assert.equal(heldBy(h.state,'bean','hub'),5,'already full: no further change');
});

test('a consumable applies authored effects then spends a unit; a failed use consumes nothing',()=>{
 const h=harness(pack());
 h.act('items.use',{item:'brew'});
 assert.equal(h.state.flags.caffeinated,true);assert.equal(heldBy(h.state,'brew','player'),0);assert.equal(inv(h.state).owners.brew,undefined);
 assert.ok(h.state.events.some(e=>e.type==='items.used'&&e.payload.item==='brew'));
 assert.ok(h.state.events.some(e=>e.type==='items.consumed'&&e.payload.item==='brew'));
 const before=clone(h.state);
 assert.throws(()=>h.act('items.use',{item:'tonic'}),/Insufficient funds/);
 assert.deepEqual(h.state,before,'the tonic was not spent when its effect was refused');
});

test('charged items deplete separately from quantity and break at zero',()=>{
 const h=harness(pack());
 h.act('items.use',{item:'vial'});
 assert.equal(inv(h.state).charges.vial,1);assert.equal(heldBy(h.state,'vial','player'),1,'still carried with one charge left');
 h.act('items.use',{item:'vial'});
 assert.equal(inv(h.state).charges.vial,0);assert.equal(heldBy(h.state,'vial','player'),0,'broke after the last charge');
 const before=clone(h.state);
 assert.throws(()=>h.act('items.use',{item:'vial'}),/used up/);
 assert.deepEqual(h.state,before);
});

test('crafting consumes inputs, respects place and once, and cannot run short',()=>{
 const h=harness(pack());
 assert.throws(()=>h.act('items.craft',{recipe:'espresso'}),/another place/);
 h.act('core.move',{to:'workshop'});
 const before=clone(h.state);
 assert.throws(()=>h.act('items.craft',{recipe:'espresso'}),/You need 1× Coffee beans/);
 assert.deepEqual(h.state,before);
 h.act('core.move',{to:'hub'});
 h.act('world.buy',{item:'bean',count:1});
 h.act('core.move',{to:'workshop'});
 h.act('items.craft',{recipe:'espresso'});
 assert.equal(heldBy(h.state,'bean','player'),0);assert.equal(heldBy(h.state,'brew','player'),2,'the crafted brew joins the one the player started with');
 assert.ok(h.state.events.some(e=>e.type==='items.crafted'&&e.payload.recipe==='espresso'));
});

test('give and place move exact counts between holders',()=>{
 const h=harness(pack());
 h.act('world.buy',{item:'bean',count:2});
 h.act('core.move',{to:'workshop'});
 h.act('items.give',{item:'bean',target:'brin',count:1});
 assert.equal(heldBy(h.state,'bean','brin'),1);assert.equal(heldBy(h.state,'bean','player'),1);
 h.act('items.place',{item:'bean',count:1});
 assert.equal(heldBy(h.state,'bean','workshop'),1);assert.equal(heldBy(h.state,'bean','player'),0);
});

test('single-unit items keep the legacy flat ownership shape; replay reproduces quantities exactly',()=>{
 const h=harness(pack());
 assert.equal(inv(h.state).owners.vial,'player','unique item stays flat');
 const scripted=[['world.buy',{item:'bean',count:2}],['core.move',{to:'workshop'}],['items.craft',{recipe:'espresso'}],['items.use',{item:'brew'}],['items.use',{item:'vial'}],['core.wait'],['core.move',{to:'hub'}],['world.sell',{item:'bean',count:1}]];
 const a=harness(pack()),b=harness(pack());
 for(const [type,args] of scripted){a.act(type,args);b.act(type,args);}
 assert.deepEqual(a.state,b.state);
 const restored=replay(createWorld(pack(),registry,'test'),a.state.events);
 assert.deepEqual(restored.modules['items.inventory'],a.state.modules['items.inventory']);
 assert.deepEqual(restored.modules['world.economy'],a.state.modules['world.economy']);
});
