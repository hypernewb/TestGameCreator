// T-072 studio coverage lock: every pack option a module reads must be settable in public/studio.mjs
// or explicitly classified in this test as JSON-only tuning or a known gap. New options appear here
// mechanically, so a mechanic shipping without a Studio control fails unless it is allowlisted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {systemSpecs} from '../public/creator-systems-contract.mjs';
import {advancedSpecs} from '../public/creator-advanced-contract.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
const studio=readFileSync(join(root,'public','studio.mjs'),'utf8');
const knowledge=readFileSync(join(root,'public','studio-knowledge.mjs'),'utf8');
const systems=readFileSync(join(root,'public','studio-systems.mjs'),'utf8'),systemKeys=Object.keys(systemSpecs({actors:[],locations:[]}));
const advancedKeys=Object.values(advancedSpecs({actors:[],locations:[]})).map(s=>s.path[0]);
// The weekly preview reads exceptions to warn about precedence; it does not edit them.
// A control counts when the key is bound as a field key ('key'), an editor/rows key, or a p.key / pack.key path.
const controlSource=(studio+'\n'+knowledge+'\n'+readFileSync(join(root,'public','route-map.mjs'),'utf8')).replace(/\(p\.scheduleExceptions\|\|\[\]\)\.some\(x=>x\.actor===entry\.actor\)/g,'false');
const hasControl=k=>systemKeys.includes(k)&&systems.includes('edit(')&&studio.includes('mountSystems(')||advancedKeys.includes(k)&&studio.includes('mountAdvanced(')||new RegExp(`(?:'|"|p\\.|pack\\.)${k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![A-Za-z0-9_$])`).test(controlSource);
// NOISE: pack-shaped locals that are not pack options (react uses `const p=event.payload`; plans, pages).
const NOISE=new Set(['act','capped','character','characters','company','deadlineTick','entry','points','sceneId','source','status','target','verdict']);
function moduleKeys(){
 const out=new Set();
 for(const file of readdirSync(join(root,'packages','modules')).filter(f=>f.endsWith('.mjs')&&f!=='index.mjs')){
  const src=readFileSync(join(root,'packages','modules',file),'utf8');
  for(const m of src.matchAll(/\b(?:p|pack|tx\.pack)\.([A-Za-z_$][A-Za-z0-9_$]*)\b/g))if(!NOISE.has(m[1]))out.add(m[1]);
 }
 return [...out].sort();
}
const KEYS=moduleKeys();
// JSON_ONLY: deliberate pack-JSON tuning knobs with safe defaults; no dedicated control expected.
const JSON_ONLY={};
// KNOWN_GAPS: module-read options with no Studio control, acknowledged in docs/research/studio-coverage.md.
const KNOWN_GAPS={};

test('every module-read pack option is in Studio or explicitly allowlisted',()=>{
 const missing=KEYS.filter(k=>!hasControl(k)&&!JSON_ONLY[k]&&!KNOWN_GAPS[k]);
 assert.deepEqual(missing,[],'module-read option with no Studio control and no allowlist entry — add a control or classify it');
});
test('allowlisted options are real module-read pack options',()=>{
 for(const [k,why] of Object.entries({...JSON_ONLY,...KNOWN_GAPS}))assert.ok(KEYS.includes(k),`allowlisted ${k} is not read by any module — remove the entry (${why})`);
});
test('KNOWN_GAPS stay honest: listed options still have no Studio control',()=>{
 for(const k of Object.keys(KNOWN_GAPS))assert.ok(!hasControl(k),`${k} now has a Studio control — remove it from KNOWN_GAPS and the coverage doc`);
});
test('all thirteen former gaps have typed visual schemas and remain real module options',()=>{assert.equal(systemKeys.length,13);for(const k of systemKeys){assert.ok(KEYS.includes(k),k);assert.ok(hasControl(k),k);assert.ok(Object.keys(systemSpecs({actors:[],locations:[]})[k].fields).length,k);}});
