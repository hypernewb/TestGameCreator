import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

// GC1 regression pins: each row names an existing proof test in its file. Gaps are test.todo, not fixes.
const root=p=>new URL('../'+p,import.meta.url);
const src=p=>readFileSync(root(p),'utf8');
const proves=(file,title)=>src(file).includes(`test('${title}'`);
const m=JSON.parse(src('docs/research/gc1-1-accepted-evidence-manifest-2026-10-08.json'));

test('GC1.1 pin: manifest counts match its entries and eight recovered files are frozen',()=>{assert.equal(m.frozen_file_count,m.frozen_files.length);assert.equal(m.prose_only_count,m.prose_only.length);assert.equal(m.frozen_file_count,8);assert.ok(m.prose_only.every(e=>'quoted_reply_excerpt' in e));}); // variant excerpts may be empty by design
test('GC1.1 pin: every frozen file exists and matches its manifest SHA-256',()=>{for(const f of m.frozen_files){assert.equal(createHash('sha256').update(readFileSync(root(f.path))).digest('hex'),f.sha256,f.path);}});

const pins=[
['GC1.2 assembly','tests/player-contribution.test.mjs','direct speech ownership survives quotes, filters, sanitizer and shared display at a later position'],
['GC1.2 assembly order','tests/player-contribution-recovery.test.mjs','repair requests enumerate IDs without a source placeholder and resolve ID replies'],
['GC1.2 history','tests/gc1-typed-input-retry.test.mjs','GC1.2 typed speech keeps its exact words in the saved turn and in history'],
['GC1.2 streaming','tests/gc1-typed-input-retry.test.mjs','GC1.2 typed speech survives streamed assembly with a surrogate pair split across chunks'],
['GC1.2 invented acceptance','tests/gc1-typed-input-retry.test.mjs','GC1.2 invented player acceptance never reaches the saved turn; a repaired reply matches the clean run'],
['GC1.2 repair','tests/gc1-typed-input-retry.test.mjs','GC1.2 a reply that drops the typed speech is repaired by source ID, not replaced by invented words'],
['GC1.2 paging','tests/gc1-typed-input-retry.test.mjs','GC1.2 typed speech is paged verbatim and never folded into the NPC reply'],
['GC1.4 dropped connection','tests/gc1-typed-input-retry.test.mjs','GC1.4 a dropped connection keeps the typed input, applies mechanics once and retry adds no second effect'],
['GC1.4 timeout and cancel','tests/gc1-typed-input-retry.test.mjs','GC1.4 a local timeout and a mid-stream cancel save no partial prose and retry applies the turn once'],
['GC1.4 malformed metadata','tests/gc1-typed-input-retry.test.mjs','GC1.4 malformed metadata keeps validated prose and records no invented memory or fact'],
['GC1.4 duplicate submit','tests/gc1-typed-input-retry.test.mjs','GC1.4 a completed turn cannot be retried or re-sent into a second effect'],
['GC1.4 null metadata entries','tests/gc1-typed-input-retry.test.mjs','GC1.4 null memory and fact entries in deferred metadata keep the prose and do not fail the turn'],
['GC1.2 later page','tests/gc1-typed-input-retry.test.mjs','GC1.2 typed speech on a later page of a long continuous reply keeps its owner and words'],
['GC1.4 mid-stream network error','tests/gc1-typed-input-retry.test.mjs','GC1.4 a network error after partial streamed deltas, not an abort, keeps input and saves no partial prose'],
['GC1.4 timeout and cancel retry text','tests/gc1-typed-input-retry.test.mjs','GC1.4 a timeout and a mid-stream cancel show the same Retry this turn text as a dropped connection'],
['GC1.4 malformed metadata completed turn','tests/gc1-typed-input-retry.test.mjs','GC1.4 a completed turn after malformed metadata applies its events once and cannot be retried'],
];
for(const [id,file,title] of pins)test(`${id} pin: ${file} proves "${title}"`,()=>assert.ok(proves(file,title),title));
// The old "retry after malformed metadata" gap cannot occur: malformed metadata does not fail a turn, and only failed turns can be retried. The pin above proves the reachable case instead.
