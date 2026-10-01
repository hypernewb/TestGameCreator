import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {selectLore,contextFor} from '../packages/ai/context.mjs';
import {estimateTokens} from '../packages/ai/budget.mjs';

const pack=JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url)));
const world=createWorld(pack,registry,'lore-test');
const player=pack.playerId;

test('selectLore returns up to 4 entries when keys match',()=>{
 const r=selectLore(world,pack,'yuna','I want to ask about Jeju and Jisoo');
 assert.ok(r.selected.length<=4,'max 4 entries');
 assert.ok(r.selected.some(e=>e.id==='yuna-jeju'),'yuna-jeju triggered by Jeju');
 assert.ok(r.selected.some(e=>e.id==='yuna-jisoo'),'yuna-jisoo triggered by Jisoo');
});

test('selectLore returns no key-matched entries when no keys match',()=>{
 world.actors.yuna.location='langley';
 const r=selectLore(world,pack,'yuna','Hello how are you today');
 const keyed=r.selected.filter(e=>e.keyMatched && e.id.startsWith('yuna-'));
 assert.deepEqual(keyed.map(e=>e.id),[]);
});

test('each lore entry is <= 50 tokens',()=>{
 const r=selectLore(world,pack,'yuna','Jeju Jisoo parents hotteok volleyball roommate');
 for(const e of r.selected){
  assert.ok(estimateTokens(e.text)<=50,`entry ${e.id} tokens ${estimateTokens(e.text)} <= 50`);
 }
});

test('keys match against current location',()=>{
 world.actors.yuna.location='hewett';
 const r=selectLore(world,pack,'yuna','');
 assert.ok(r.selected.some(e=>e.id==='yuna-volleyball'),'yuna-volleyball triggered by hewett location');
});

test('player block exists with name, pronouns, description <= 60 tokens',()=>{
 const ctx=contextFor(world,pack,'yuna');
 assert.ok(ctx.player,'player block present');
 assert.equal(ctx.player.name,'You');
 assert.equal(ctx.player.pronouns,'you');
 assert.ok(ctx.player.description);
 assert.ok(estimateTokens(ctx.player.description)<=60,`player description tokens ${estimateTokens(ctx.player.description)} <= 60`);
});

test('lore entries have keyMatched flag for sorting',()=>{
 const r=selectLore(world,pack,'yuna','Jeju island home');
 const keyed=r.selected.filter(e=>e.keyMatched);
 assert.ok(keyed.length>0,'some entries have keyMatched true');
 assert.ok(r.selected[0].keyMatched,'first entry is key-matched');
});

test('budget is respected',()=>{
 const r=selectLore(world,pack,'yuna','Jeju Jisoo parents hotteok volleyball roommate',200);
 assert.ok(r.used<=r.budget);
});

test('campus-trio.json has lore entries with keys for all three heroines',()=>{
 for(const id of ['yuna','haruka','minji']){
  const sheet=pack.characterSheets.find(s=>s.actorId===id);
  assert.ok(sheet,'character sheet exists for '+id);
  assert.ok(sheet.lore.entries.length>=4,'at least 4 lore entries for '+id);
  assert.ok(sheet.lore.entries.length<=6,'at most 6 lore entries for '+id);
  for(const e of sheet.lore.entries){
   assert.ok(e.keys && e.keys.length>0,'entry '+e.id+' has keys');
   assert.ok(e.scope==='character');
   assert.equal(e.character,id);
  }
 }
});