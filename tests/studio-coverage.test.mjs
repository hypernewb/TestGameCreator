// T-072 studio coverage lock: every pack option a module reads must be settable in public/studio.mjs
// or explicitly classified in this test as JSON-only tuning or a known gap. New options appear here
// mechanically, so a mechanic shipping without a Studio control fails unless it is allowlisted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const studio=readFileSync(join(root,'public','studio.mjs'),'utf8');
const knowledge=readFileSync(join(root,'public','studio-knowledge.mjs'),'utf8');
// The weekly preview reads exceptions to warn about precedence; it does not edit them.
// A control counts when the key is bound as a field key ('key'), an editor/rows key, or a p.key / pack.key path.
const controlSource=(studio+'\n'+knowledge).replace(/\(p\.scheduleExceptions\|\|\[\]\)\.some\(x=>x\.actor===entry\.actor\)/g,'false');
const hasControl=k=>new RegExp(`(?:'|"|p\\.|pack\\.)${k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}(?![A-Za-z0-9_$])`).test(controlSource);
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
const JSON_ONLY={
 economySettings:'debtLimit balance knob with a sane default; packs ship it in JSON',
 invitations:'typed-invite private/public trust thresholds default sensibly',
 romanceStats:'daily Like-gain cap tuning with defaults',
 currency:'money display symbol; default is fine',
};
// KNOWN_GAPS: module-read options with no Studio control, acknowledged in docs/research/studio-coverage.md.
// dailyNeeds is editable in Studio but cannot be enabled or added there, so it stays listed.
const KNOWN_GAPS={
 arcTracks:'character change arc tracks have no editor',
 dailyNeeds:'hidden daily need: editable but no enable toggle or add flow',
 firsts:'typed-scene firsts checkpoints have no editor',
 moments:'ambient moments library has no editor',
 momentsProfile:'moment generation tuning has no editor',
 npcDialogue:'NPC run-in lines have no editor',
 recipes:'item combine recipes have no editor',
 scheduleExceptions:'schedule overrides have no editor',
 services:'economy paid services have no editor',
 sobriety:'drink items and thresholds have no editor',
 statMilestones:'stat milestone flags have no editor',
 touchLadder:'touch ladder settings have no editor',
 wageRules:'economy wage rules have no editor',
};

test('every module-read pack option is in Studio or explicitly allowlisted',()=>{
 const missing=KEYS.filter(k=>!hasControl(k)&&!JSON_ONLY[k]&&!KNOWN_GAPS[k]);
 assert.deepEqual(missing,[],'module-read option with no Studio control and no allowlist entry — add a control or classify it');
});
test('allowlisted options are real module-read pack options',()=>{
 for(const [k,why] of Object.entries({...JSON_ONLY,...KNOWN_GAPS}))assert.ok(KEYS.includes(k),`allowlisted ${k} is not read by any module — remove the entry (${why})`);
});
test('KNOWN_GAPS stay honest: listed options still have no Studio control',()=>{
 for(const k of Object.keys(KNOWN_GAPS))if(k!=='dailyNeeds')assert.ok(!hasControl(k),`${k} now has a Studio control — remove it from KNOWN_GAPS and the coverage doc`);
});
