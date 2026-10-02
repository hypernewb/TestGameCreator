import test from 'node:test';
import assert from 'node:assert/strict';
import {server} from '../vn_ui_studio/serve.mjs';
import {assets} from '../vn_ui_studio/asset-catalog.mjs';
test('Studio preview serves its entry point, module graph, styles and download assets',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{
  const origin=`http://127.0.0.1:${server.address().port}`,pending=['vn_game_ui_wizard.html',...assets.map(a=>a.file)],seen=new Set();
  while(pending.length){const path=pending.shift();if(seen.has(path))continue;seen.add(path);const url=new URL(path,origin+'/'),res=await fetch(url),text=await res.text();assert.equal(res.status,200,path);assert.ok(text.length,path);assert.match(res.headers.get('content-type'),({html:/text\/html/,mjs:/javascript/,css:/text\/css/,svg:/image\/svg/})[path.split('.').pop()],path);
   if(path.endsWith('.svg')){assert.match(text,/<svg\b/,path);assert.doesNotMatch(text,/<script|<foreignObject|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|data:|javascript:)/i,path);}
   const refs=[];if(path.endsWith('.html'))for(const m of text.matchAll(/(?:href|src)=["']([^"']+)["']/g))refs.push(m[1]);
   if(path.endsWith('.mjs')){for(const m of text.matchAll(/\bfrom\s*["'](\.\.?\/[^"']+)["']/g))refs.push(m[1]);for(const m of text.matchAll(/["'`]((?:vn_ui_studio\/)[a-z-]+\.svg)(?:#[^"'`]*)?["'`]/g))refs.push('/'+m[1]);}
   if(path.endsWith('.css'))for(const m of text.matchAll(/url\(["']?([^"')]+)["']?\)/g))refs.push(m[1]);
   for(const ref of refs){if(ref.startsWith('#'))continue;const next=new URL(ref,url);assert.equal(next.origin,origin,`${path}: external reference`);assert.ok(next.pathname==='/vn_game_ui_wizard.html'||/^\/vn_ui_studio\/[a-z-]+\.(mjs|css|svg)$/.test(next.pathname),`${path}: ${ref}`);pending.push(next.pathname.slice(1));}
  }
  for(const path of ['vn_ui_studio/app.mjs','vn_ui_studio/model.mjs','vn_ui_studio/styles.css','vn_ui_studio/campus.css','vn_ui_studio/scene.svg','vn_ui_studio/frame.svg','vn_ui_studio/icons.svg','vn_ui_studio/hud-expansion-board.svg'])assert.ok(seen.has(path),path);
 }finally{await new Promise(r=>server.close(r));}
});
