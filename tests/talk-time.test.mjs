import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {calendarFor} from '../public/calendar.mjs';
import {clockDigits} from '../public/campus.mjs';

const pack=(extra={})=>{const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={...JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).gameProject,...extra};delete p.schedules;return p;};
const run=(p,id)=>{let state=createWorld(p,registry,id);const act=(type,args={})=>{const r=execute(state,{id:`${id}-${state.revision}`,actorId:p.playerId,type,args,expectedRevision:state.revision},p,registry);state=r.state;return r;};return {act,get state(){return state;}};};
const talk=(text,activity='talk')=>({text,location:'hub',characters:['ada'],activity});

test('every turnsPerTick exchanges in a kept scene advance one tick and emit core.timeAdvanced',()=>{
 const c=run(pack(),'talk-time');
 c.act('core.scene',talk('Hi Ada.'));
 assert.equal(c.state.tick,0);
 c.act('core.scene',talk('How was your day?','continue'));c.act('core.scene',talk('Tell me more.','continue'));
 assert.equal(c.state.tick,0);
 const r=c.act('core.scene',talk('Go on.','continue'));
 assert.equal(c.state.tick,1);
 assert.equal(r.turn.events.filter(e=>e.type==='core.timeAdvanced').length,1);
 assert.deepEqual(c.state.scene?.characters,['ada'],'scene stays open through the tick advance');
 const restored=replay(createWorld(pack(),registry,'talk-time-replay'),c.state.events);
 assert.equal(restored.tick,1);
});

test('turnsPerTick knob changes the exchange rate',()=>{
 const p=pack({turnsPerTick:2}),c=run(p,'talk-fast');
 c.act('core.scene',talk('Hi Ada.'));c.act('core.scene',talk('Hey.','continue'));
 assert.equal(c.state.tick,0);
 c.act('core.scene',talk('So…','continue'));
 assert.equal(c.state.tick,1);
});

test('crossing a daypart boundary mid-scene adds a run-long note to the scene prompt context',()=>{
 const p=pack(),c=run(p,'talk-late');
 c.act('core.wait',{});c.act('core.wait',{});
 assert.equal(c.state.tick,2);
 c.act('core.scene',talk('Hi Ada.'));
 for(let i=0;i<5;i++)c.act('core.scene',talk(`Line ${i}.`,'continue'));
 assert.equal(c.state.tick,3);assert.equal(calendarFor(c.state.tick,p).daypart,'Morning');
 c.act('core.scene',talk('One more.','continue'));
 assert.equal(c.state.tick,4);assert.equal(calendarFor(c.state.tick,p).daypart,'Afternoon');
 const ctx=contextFor(c.state,p);
 assert.match(ctx.timeNote,/It is now Afternoon; the conversation has run long\./);
 const messages=scenePromptMessages(ctx,p);
 assert.ok(messages[1].content.includes('the conversation has run long'));
 assert.ok(!contextFor(run(pack(),'talk-quiet').state,p).timeNote,'no note without an open scene');
});

test('goodbyeEndsDay still lands on the next day when the NPC ends the scene',()=>{
 const p=pack({goodbyeEndsDay:true}),c=run(p,'talk-goodbye');
 c.act('core.scene',talk('Hi Ada.'));
 for(let i=0;i<8;i++)c.act('core.scene',talk(`Line ${i}.`,'continue'));
 assert.equal(c.state.tick,2);
 const end=c.act('core.endScene',{reason:'natural'});
 assert.equal(c.state.scene,null);assert.equal(c.state.tick,12);
 assert.equal(calendarFor(c.state.tick,p).daypart,'Morning');assert.equal(calendarFor(c.state.tick,p).day,2);
 assert.equal(end.turn.events.filter(e=>e.type==='core.timeAdvanced').length,1);
});

test('clockDigits renders just numbers',()=>{
 assert.equal(clockDigits({tick:37},pack()),'T37 · 2/4');
 assert.equal(clockDigits({tick:0},pack()),'T0 · 1/4');
});
