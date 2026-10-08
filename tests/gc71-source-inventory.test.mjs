import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {dirname,join} from 'node:path';

// GC7.1: every writer named in docs/research/gc71-sources-2026-10-08.md must exist (exported or defined in its file).
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const W=[
 ['authored facts','packages/ai/bulk-authoring.mjs','applyDepth'],
 ['generated facts','packages/modules/facts.mjs','validateGeneratedFacts'],
 ['generated facts','packages/persistence/store.mjs','Store.prototype.narrative'],
 ['generated fact corrections','packages/persistence/store.mjs','Store.prototype.editFact'],
 ['captured statements','packages/modules/social.mjs','conversation.react'],
 ['captured statements','packages/ai/memory.mjs','capturedStatements'],
 ['statement corrections','packages/ai/memory-controls.mjs','applyMemoryEdit'],
 ['scene memories','packages/modules/scenes.mjs','effects'],
 ['scene memory corrections','packages/persistence/store.mjs','Store.prototype.editMemory'],
 ['impressions','vendor/venus/ledger.mjs','ledgerMemories'],
 ['impressions','packages/ai/memory.mjs','effectiveImpressions'],
 ['promises','packages/ai/memory.mjs','classifyUtterance'],
 ['plans','packages/modules/scenes.mjs','setPlanStatus'],
 ['relationship secrets','packages/modules/secrecy.mjs','secrecy.init'],
 ['relationship secrets','packages/modules/secrecy.mjs','suspect'],
];
const get=(o,path)=>path.split('.').reduce((v,k)=>v==null?v:v[k],o);
const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const defined=(src,name)=>new RegExp(`function\\s+${esc(name)}\\b|^\\s*(?:async\\s+)?${esc(name)}\\s*\\([^)]*\\)\\s*\\{|\\b${esc(name)}\\s*:\\s*(?:async\\s*)?(?:function|\\()|export\\s+(?:const|function|class)\\s+${esc(name)}\\b`,'m').test(src);
const mods={};
for(const [kind,file,fn] of W)test(`${kind}: ${fn} exists in ${file}`,async()=>{
 const abs=join(root,file),src=readFileSync(abs,'utf8');
 mods[file]??=await import(pathToFileURL(abs).href).catch(()=>null);
 const exported=typeof get(mods[file],fn)==='function';
 assert.ok(exported||defined(src,fn.split('.').pop()),`${fn} not exported or defined in ${file}`);
});

// Visibility enforcement is not directly tested for these rows; keep visible until a named test lands.
test.todo('generated facts: selectGeneratedFacts audience filter has no direct test');
test.todo('impressions: effectiveImpressions and knows() filter have no direct visibility test');
test.todo('authored facts: sharedAuthoredFact has no direct test by name');
test.todo('plans: plan rows have no knownBy field or visibility test');
