import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {bakeTemplates} from '../packages/cards/role-slots.mjs';

test('route fixtures validate independently and use only portable fixture art',()=>{
 const read=f=>JSON.parse(readFileSync(new URL(f,import.meta.url),'utf8')),p=read('./fixtures/route-mechanics.json'),tpl=read('./fixtures/role-template.json');
 assert.equal(p.id,'test.route-mechanics');assert.doesNotMatch(JSON.stringify([p,tpl]),/after-hours|assets\/generated\//);
 assert.doesNotThrow(()=>validatePack(p,registry));assert.doesNotThrow(()=>validatePack(bakeTemplates(p,tpl),registry));
 const cgs=p.scriptedScenes.filter(s=>s.cg);assert.ok(cgs.length>=8);for(const s of cgs)assert.ok(existsSync(new URL(`../public/${s.cg}`,import.meta.url)),s.id);
});
