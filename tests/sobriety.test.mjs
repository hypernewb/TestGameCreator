import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {sobrietyOf} from '../packages/modules/sobriety.mjs';

const pack=()=>({schemaVersion:1,id:'test.sobriety',version:'0.1.0',title:'Sobriety',playerId:'player',modules:{'items.inventory':'0.2.0','character.sobriety':'0.1.0'},locations:[{id:'bar',name:'Bar',exits:[]}],actors:[{id:'player',name:'You',location:'bar'},{id:'mia',name:'Mia',location:'bar'}],items:[{id:'beer',name:'Beer',owner:'player',stack:3}],sobriety:{drinkItems:['beer'],tipsyAt:2,drunkAt:3,soberPerDaypart:1}});
const run=p=>{validatePack(p,registry);let state=createWorld(p,registry,'sobriety');return {get state(){return state;},act(type,args={}){const r=execute(state,{id:`t${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r.turn.events;}};};
test('drinks make an NPC tipsy then drunk and dayparts restore sobriety',()=>{const p=pack(),g=run(p);g.state.modules['items.inventory'].owners.beer={player:3};assert.equal(sobrietyOf(g.state,p,'mia'),'sober');g.act('items.give',{item:'beer',target:'mia'});assert.equal(sobrietyOf(g.state,p,'mia'),'sober');g.act('items.give',{item:'beer',target:'mia'});assert.equal(sobrietyOf(g.state,p,'mia'),'tipsy');g.act('items.give',{item:'beer',target:'mia'});assert.equal(sobrietyOf(g.state,p,'mia'),'drunk');for(let i=0;i<4;i++)g.act('core.wait');assert.equal(sobrietyOf(g.state,p,'mia'),'tipsy');for(let i=0;i<4;i++)g.act('core.wait');assert.equal(sobrietyOf(g.state,p,'mia'),'sober');});
test('sobriety replays identically',()=>{const walk=()=>{const p=pack(),g=run(p);g.state.modules['items.inventory'].owners.beer={player:3};g.act('items.give',{item:'beer',target:'mia'});g.act('core.wait');return g.state;};assert.deepEqual(walk(),walk());});
