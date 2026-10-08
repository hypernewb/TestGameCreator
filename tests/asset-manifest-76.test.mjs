import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../',import.meta.url),sha=b=>createHash('sha256').update(b).digest('hex'),raw=readFileSync(new URL('docs/research/asset-manifest-76-T-085.csv',root)),rows=raw.toString('utf8').trim().split(/\r?\n/).slice(1).map(l=>{const m=l.match(/^"([^"]+)","([A-F0-9]{64})","(\d+)"$/);assert.ok(m,'manifest row');return {path:m[1],sha:m[2].toLowerCase(),bytes:Number(m[3])};});
test('T-085 exact original manifest and all 76 real files retain byte counts and SHA256',()=>{
 assert.equal(sha(raw),'050746fe9b4c91d91c63174b2f422c31a60b78d09eb5cbe1cd32892228d16023');assert.equal(rows.length,76);assert.equal(new Set(rows.map(r=>r.path)).size,76);assert.equal(rows.reduce((n,r)=>n+r.bytes,0),81378218);
 assert.equal(rows.filter(r=>r.path.startsWith('public/assets/campus/')&&r.path.endsWith('.png')).length,39);assert.equal(rows.filter(r=>r.path.startsWith('public/assets/characters/')&&r.path.endsWith('.png')).length,24);assert.equal(rows.filter(r=>r.path.endsWith('.json')).length,13);
 for(const r of rows){assert.match(r.path,/^public\/assets\/(campus|characters)\/[a-zA-Z0-9_./-]+\.(png|json)$/);assert.ok(!r.path.split('/').includes('..'));const b=readFileSync(new URL(r.path,root));assert.equal(b.length,r.bytes,r.path);assert.equal(sha(b),r.sha,r.path);if(r.path.endsWith('.png'))assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a',r.path);else assert.doesNotThrow(()=>JSON.parse(b.toString('utf8')),r.path);}
});
test('T-085 ignore exceptions admit exactly the allowlist and keep unrelated assets excluded',()=>{
 const probes=['public/assets/campus/unused.png','public/assets/campus/cg/unused_v99.png','public/assets/characters/unknown/character.json','public/assets/characters/yuna/room_day.png','public/assets/characters/yuna/profile.png','public/assets/characters/yuna/expressions/neutral_v99.png','public/assets/characters/yuna/scenes/unused.png','public/assets/characters/yuna/renders/neutral.json','data/T085-probe.json','.env','node_modules/T085-probe.mjs'],input=[...rows.map(r=>r.path),...probes].join('\n')+'\n';
 const ignored=execFileSync('git',['check-ignore','--no-index','--stdin'],{cwd:root,input,encoding:'utf8'}).trim().split(/\r?\n/);assert.deepEqual(ignored,probes);
});
test('byte-preserving Git attributes cover audited assets and frozen regression/comparison evidence',()=>{
 const manifest='docs/research/asset-manifest-76-T-085.csv',paths=[...rows.map(r=>r.path),manifest],frozen=['tests/fixtures/current-cast/**','artifacts/venus-framework-comparison/**'],extra=['tests/fixtures/current-cast/world.json','tests/fixtures/current-cast/pack.json','tests/fixtures/current-cast/manifest.json','artifacts/venus-framework-comparison/prepare.mjs','artifacts/venus-framework-comparison/upstream/src/shared/types.ts'],rules=readFileSync(new URL('.gitattributes',root),'utf8').trim().split(/\r?\n/).filter(l=>l.endsWith(' -text'));assert.deepEqual(rules,[...paths,...frozen].map(p=>`/${p} -text`));
 const probes=['public/assets/characters/yuna/room_day.png','public/assets/characters/yuna/character-extra.json','public/assets/campus/unused.png','docs/research/unrelated.csv','tests/fixtures/unrelated.json','artifacts/unrelated.json'],input=[...paths,...extra,...probes].join('\n')+'\n';
 for(const mode of ['true','false']){const attrs=execFileSync('git',['-c',`core.autocrlf=${mode}`,'check-attr','text','--stdin'],{cwd:root,input,encoding:'utf8'}).trim().split(/\r?\n/);assert.deepEqual(attrs,[...[...paths,...extra].map(p=>`${p}: text: unset`),...probes.map(p=>`${p}: text: unspecified`)]);}
});
