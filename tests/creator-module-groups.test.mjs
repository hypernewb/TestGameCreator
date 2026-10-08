import test from 'node:test';import assert from 'node:assert/strict';
import {moduleCatalog} from '../packages/modules/index.mjs';
test('school and job systems are flagged campus; generic systems are not',()=>{
 assert.equal(moduleCatalog['world.academics'].campus,true);assert.equal(moduleCatalog['world.jobs'].campus,true);
 for(const id of ['world.economy','world.schedule','social.romance-tempo'])assert.equal(moduleCatalog[id].campus,undefined,id);
});
