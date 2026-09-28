import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const base=JSON.parse(readFileSync(new URL('../packs/event-chain.json',import.meta.url),'utf8'));
const pack={...base,scriptedScenes:[...base.scriptedScenes,{id:'hub-news',title:'News on the board',opening:'Someone pinned a fresh notice.',trigger:{event:'core.inspected',match:{location:'hub'}},when:{location:'hub',minTick:3},choices:[{id:'read',label:'Read it',result:'You read it.'}]}]};
const looks=s=>actions(s,pack,registry).filter(a=>a.type==='core.inspect').map(a=>a.label),at=(s,tick)=>{s=structuredClone(s);s.actors.player.location='hub';s.tick=tick;return s;};

test('Look around says so when a scene is waiting on it here, and there is only ever one Look around',()=>{
 const s=createWorld(pack,registry,'cue');
 assert.deepEqual(looks(at(s,0)),['Look around'],'nothing ready yet');
 const ready=at(s,5);assert.deepEqual(looks(ready),['Look around (something is going on here)']);
 const after=execute(ready,{type:'core.inspect',args:{},id:'l1',actorId:'player',expectedRevision:ready.revision},pack,registry).state;
 assert.equal(after.modules['story.scenes'].pending,'hub-news','the cued look starts the scene');
 const done=execute(after,{type:'story.choose',args:{scene:'hub-news',choice:'read'},id:'l2',actorId:'player',expectedRevision:after.revision},pack,registry).state;
 assert.deepEqual(looks(done),['Look around'],'cue clears once the scene is used up');
});
