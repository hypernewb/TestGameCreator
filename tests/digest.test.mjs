import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {digest,mechanicsDigest,mechanicsShape,createWorld,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
// Pinned from the original for…of hash: saves store packDigest, so the value must never drift, emoji included.
test('the pack digest keeps its original value for text with emoji and accents',()=>{
 assert.equal(digest({a:'x😀y'}),'36e3e426');assert.equal(digest('é ✓'),'ef285ffd');
});
test('the memoised pack digest matches a fresh hash and still changes when a pack is edited in place',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),first=mechanicsDigest(p);
 assert.equal(first,digest(mechanicsShape(p)));assert.equal(mechanicsDigest(p),first);
 p.locations[0].exits=[];assert.notEqual(mechanicsDigest(p),first);assert.equal(mechanicsDigest(p),digest(mechanicsShape(p)));
});
test('actions still refuses every preview when the pack changed under a save',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url))),w=createWorld(p,registry,'d');
 assert.ok(actions(w,p,registry).some(a=>a.enabled));p.locations[0].exits=[];
 const list=actions(w,p,registry);assert.ok(list.length&&list.every(a=>!a.enabled&&/Pack changed/.test(a.reason)));
});
