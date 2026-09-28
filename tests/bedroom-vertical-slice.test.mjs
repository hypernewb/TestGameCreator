import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const pack=JSON.parse(readFileSync(new URL('../packs/bedroom-vertical-slice.json',import.meta.url)));

test('bedroom vertical slice starts Mina at the authored trust value',()=>{
 validatePack(pack,registry);
 const world=createWorld(pack,registry,'bedroom-trust');
 assert.equal(world.modules['social.relationships'].edges['mina--player'],52);
});

test('legacy relationships key fails validation instead of silently starting at zero',()=>{
 const invalid=structuredClone(pack);
 invalid.relationships=[{a:'player',b:'mina',trust:52}];
 delete invalid.initialRelationships;
 assert.throws(()=>validatePack(invalid,registry),/use initialRelationships/);
});
