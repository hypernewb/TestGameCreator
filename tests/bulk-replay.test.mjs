// Real model replies that once failed (saved <out>.failed.txt files), replayed through the normalizer so salvage never regresses.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeCandidate,mergeApproved,KINDS} from '../packages/ai/bulk-authoring.mjs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const dir=new URL('./fixtures/bulk-replies/',import.meta.url),read=f=>readFileSync(new URL(f,dir),'utf8');
for(const c of JSON.parse(read('cases.json')))test(`replayed reply: ${c.name}`,()=>{
 const pack=JSON.parse(read(c.pack)),raw=read(c.reply);
 assert.throws(()=>normalizeCandidate(raw,pack,c.counts,{strict:true}));
 const got=normalizeCandidate(raw,pack,c.counts);
 for(const k of ['locations','characters','scenes','events'])assert.equal(got[k].length,c.expect[k],k);
 assert.deepEqual(got.skipped,c.expect.skipped);assert.equal(got.dropped.length,c.expect.dropped,got.dropped.join('\n'));
 validatePack(mergeApproved(pack,Object.fromEntries(KINDS.map(k=>[k,got[k].map(value=>({status:'approved',value}))]))),registry);
});
