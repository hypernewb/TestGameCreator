import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {testGroups} from '../scripts/test.mjs';
test('default tests exclude browser files; all keeps each test once with parallel units and serial browsers',()=>{
 const names=['z-browser.test.mjs','fixture.mjs','a.test.mjs','b.test.mjs','c-browser.test.mjs'],unit=testGroups(names),browser=testGroups(names,'browser'),all=testGroups(names,'all');
 assert.deepEqual(unit,[{files:['tests/a.test.mjs','tests/b.test.mjs'],args:[]}]);assert.deepEqual(browser,[{files:['tests/c-browser.test.mjs','tests/z-browser.test.mjs'],args:['--test-concurrency=1']}]);assert.deepEqual(all,[...unit,...browser]);assert.equal(new Set(all.flatMap(g=>g.files)).size,4);assert.deepEqual(testGroups([],'all'),[]);assert.throws(()=>testGroups(names,'browesr'),/Use unit, browser or all/);
});
test('every direct Chromium test belongs to the browser suite',()=>{
 const names=readdirSync(new URL('.',import.meta.url)).filter(f=>f.endsWith('.test.mjs'));for(const f of names){if(f==='test-runner.test.mjs')continue;const source=readFileSync(new URL(f,import.meta.url),'utf8');if(/visual-fixtures\/browser|headless=new|remote-debugging-port/.test(source))assert.ok(f.endsWith('-browser.test.mjs'),f+' launches a browser in the default suite');}
 const all=testGroups(names,'all').flatMap(g=>g.files);assert.equal(all.length,names.length);assert.equal(new Set(all).size,names.length);
});
