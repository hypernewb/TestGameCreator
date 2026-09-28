import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actions,createWorld,execute,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url)));

function campaign(id){
  validatePack(pack,registry);
  let state=createWorld(pack,registry,id);
  const act=(type,args={})=>{
    const result=execute(state,{id:`${id}-${state.revision}`,actorId:pack.playerId,type,args,expectedRevision:state.revision},pack,registry);
    state=result.state;
    return result;
  };
  return {act,get state(){return state;},available:()=>actions(state,pack,registry)};
}

test('gallery route records the missed rooftop meeting and unlocks its ending',()=>{
  const c=campaign('gallery-route');
  c.act('core.inspect');
  c.act('story.choose',{scene:'two-messages',choice:'admit-conflict'});
  c.act('core.move',{to:'square'});
  c.act('core.move',{to:'gallery'});
  c.act('story.attendTimedEvent',{event:'mina-opening'});
  c.act('story.choose',{scene:'mina-turning-point',choice:'make-room'});
  c.act('core.wait');
  assert.equal(c.state.modules['story.timed-events'].status['rowan-news'],'missed');
  c.act('story.choose',{scene:'rowan-aftermath',choice:'call-now'});
  assert.ok(c.available().some(action=>action.type==='story.chooseEnding'&&action.args.ending==='stay-for-the-opening'));
  c.act('story.chooseEnding',{ending:'stay-for-the-opening'});
  assert.equal(c.state.modules['story.endings'].selected,'stay-for-the-opening');
});

test('rooftop route records the missed gallery opening and unlocks its ending',()=>{
  const c=campaign('rooftop-route');
  c.act('core.inspect');
  c.act('story.choose',{scene:'two-messages',choice:'promise-both'});
  c.act('core.move',{to:'square'});
  c.act('core.move',{to:'rooftop'});
  c.act('story.attendTimedEvent',{event:'rowan-news'});
  c.act('story.choose',{scene:'rowan-turning-point',choice:'celebrate'});
  c.act('core.wait');
  assert.equal(c.state.modules['story.timed-events'].status['mina-opening'],'missed');
  c.act('story.choose',{scene:'mina-aftermath',choice:'apologize'});
  assert.ok(c.available().some(action=>action.type==='story.chooseEnding'&&action.args.ending==='watch-the-city-change'));
  c.act('story.chooseEnding',{ending:'watch-the-city-change'});
  assert.equal(c.state.modules['story.endings'].selected,'watch-the-city-change');
});
