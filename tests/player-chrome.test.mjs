import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');

test('developer tools are hidden from the normal player chrome and toggled from the game menu',()=>{
 for(const id of ['memory-manager','backups','export','journal-export','view-mode'])assert.match(html,new RegExp(`id="${id}"[^>]*class="[^"]*developer-only|class="[^"]*developer-only[^"]*"[^>]*id="${id}"`));
 assert.match(html,/<aside><div id="panels"><\/div><div class="developer-only"><details open><summary>Creator diagnostics/,"stats panels are the player's; diagnostics stay developer-only");
 assert.match(html,/id="vn-status"/);assert.match(html,/id="vn-menu-ai"/);
 assert.match(app,/story-developer-view/);
 assert.match(app,/Hide developer view/);
});

test('showcase play screen keeps the classic UI and drives the real game API',()=>{
 const play=readFileSync(new URL('../public/play.html',import.meta.url),'utf8'),js=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8');
 for(const id of ['background','sprites','speaker','line','choices','prompt-composer','scene-status','game-menu','history','status','saves','preferences','title-screen'])assert.match(play,new RegExp(`id="${id}"`),id);
 assert.doesNotMatch(play,/data-preview|state-preview/,'mockup-only state previews are not shipped');
 assert.match(play,/ui-showcase\.css/);assert.match(play,/href="\/"/,'links back to the classic UI');
 for(const route of ['/api/bootstrap','/api/new','/api/load','/api/action','/api/preview','/api/turn/retry','/api/backups/create','/api/backups/restore'])assert.ok(js.includes(route),route);
 assert.match(js,/expectedRevision:current\.state\.revision/);assert.match(js,/sceneLines/);assert.match(js,/calendarFor/);
 assert.match(html,/id="showcase-link"[^>]*href="\/play\.html"/);assert.match(html,/id="ai-settings"/,'classic UI is unchanged otherwise');
});
test('static server serves bundled fonts for the showcase UI',async()=>{
 const {createApp}=await import('../server.mjs'),{mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'fonts-')),app=createApp({dataPath:join(dir,'campaigns.sqlite')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const res=await fetch(`http://127.0.0.1:${app.server.address().port}/assets/fonts/SourceSans3-Variable.ttf`);assert.equal(res.status,200);assert.equal(res.headers.get('content-type'),'font/ttf');await res.arrayBuffer();}
 finally{await new Promise(r=>app.server.close(r));app.store?.close?.();rmSync(dir,{recursive:true,force:true});}
});
