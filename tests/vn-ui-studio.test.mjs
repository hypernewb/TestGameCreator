import test from 'node:test';
import assert from 'node:assert/strict';
import { server } from '../vn_ui_studio/serve.mjs';
import { assets, assetById, filterAssets } from '../vn_ui_studio/asset-catalog.mjs';
import { createState, validateState, moveWidget, resizeWidget, resetLayout, applyPreset, switchDevice, history, screenWidgets, exportPackage, appearanceDefaults, setAppearance, resetAppearance, fitBox } from '../vn_ui_studio/model.mjs';

test('studio layouts stay in bounds on drag and resize', () => {
  const s = createState(), w = s.widgets.date;
  moveWidget(w, 200, -30); assert.equal(w.x, 100 - w.w); assert.equal(w.y, 0);
  resizeWidget(w, 200, 200); assert.equal(w.x + w.w, 100); assert.equal(w.y + w.h, 100);
  resizeWidget(w, -1, -1); assert.equal(w.w, 5); assert.equal(w.h, 4);
});
test('reset restores geometry and layers without discarding appearance or visibility', () => {
  const s = createState(); s.theme = 'glass'; s.widgets.date.visible = false; s.widgets.date.x = 40; s.widgets.date.z = 99;
  resetLayout(s); assert.equal(s.theme, 'glass'); assert.equal(s.widgets.date.visible, false); assert.equal(s.widgets.date.x, 3); assert.equal(s.widgets.date.z, 10);
});
test('undo and redo use independent snapshots and discard branched redo', () => {
  const s = createState(), h = history(s); s.theme = 'glass'; h.push(s); s.theme = 'parchment'; h.push(s);
  const prev = h.undo(); assert.equal(prev.theme, 'glass'); prev.widgets.date.x = 70;
  assert.equal(h.undo().widgets.date.x, 3); assert.equal(h.redo().widgets.date.x, 3);
  s.theme = 'kinetic'; h.push(s); assert.equal(h.canRedo(), false);
});
test('import rejects unknown enums, unsafe values, missing widgets, and wrong versions', () => {
  const s = createState(); assert.deepEqual(validateState(JSON.parse(JSON.stringify(s))), s);
  for (const mutate of [s => s.theme = 'unknown', s => s.version = 8, s => s.widgets.date.x = Infinity, s => s.widgets.date.w = 300, s => delete s.widgets.date, s => s.widgets.date.visible = 'yes', s => s.accent = 'url(javascript:alert(1))', s => s.textSize = 200]) {
    const bad = createState(); mutate(bad); assert.throws(() => validateState(bad));
  }
});
test('every original preview has distinct main components and shared HUD', () => {
  const s = createState();
  for (const screen of ['choice_hub','dialogue','phone','map','clue_wheel','jukebox','dossier','rumors','flowchart']) {
    s.screen = screen; const ids = screenWidgets(s); assert.ok(ids.includes('date'));
    assert.ok(ids.includes(screen === 'choice_hub' ? 'choices' : screen === 'dialogue' ? 'dialogue' : 'panel'));
  }
  s.screen = 'choice_hub'; s.interaction = 'free_text'; assert.ok(screenWidgets(s).includes('choices'));
  s.relationship = 'hidden_immersive'; assert.ok(!screenWidgets(s).includes('relationship'));
});
test('starter presets and export produce validated portable configuration', () => {
  for (const preset of ['classic','minimal','phone','dashboard']) {
    const s = createState(); s.widgets.choices.visible=false; applyPreset(s, preset); assert.equal(s.widgets.choices.visible,true); assert.deepEqual(validateState(s), s);
    const pkg = exportPackage(s); assert.deepEqual(validateState(pkg.config), s); assert.match(pkg.css, /--ui-accent:/); assert.equal(pkg.format, 'vn-ui-studio');
  }
});
test('device layouts preserve independent edits and phone has readable full-width panels', () => {
  const s=createState();s.widgets.choices.x=12;switchDevice(s,'phone');assert.equal(s.widgets.choices.w,94);assert.equal(s.widgets.radar.visible,false);
  s.widgets.choices.y=48;switchDevice(s,'desktop');assert.equal(s.widgets.choices.x,12);switchDevice(s,'phone');assert.equal(s.widgets.choices.y,48);
  resetLayout(s,'choices');assert.equal(s.widgets.choices.y,54);assert.deepEqual(validateState(s),s);
  s.layouts.desktop.date.x=-5;assert.throws(()=>validateState(s));
});
test('preview server serves the studio and rejects paths outside its allowlist', async () => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const url='http://127.0.0.1:'+server.address().port;
    assert.equal((await fetch(url+'/')).status,200);
    assert.match((await fetch(url+'/vn_ui_studio/app.mjs')).headers.get('content-type'),/javascript/);
    assert.equal((await fetch(url+'/package.json')).status,404);
    assert.equal((await fetch(url+'/%FF')).status,404);
    assert.equal((await fetch(url+'/%2e%2e%2fpackage.json')).status,404);
    for (const asset of assets) {
      const response=await fetch(url+'/'+asset.file);assert.equal(response.status,200,asset.id);
      assert.match(response.headers.get('content-type'),/svg/);
      const svg=await response.text();assert.match(svg,/<svg\b/);assert.match(svg,/<title>/);assert.match(svg,/<desc>/);
      assert.doesNotMatch(svg,/<script|<foreignObject|https?:\/\/(?!www.w3.org)/i);
    }
  } finally {await new Promise(resolve=>server.close(resolve));}
});
test('asset catalog has 12 unique components, supports filters, and falls back safely', () => {
  assert.equal(assets.length,12);assert.equal(new Set(assets.map(a=>a.id)).size,12);
  for(const category of ['story','feedback','progression','utility'])assert.ok(filterAssets(category).every(a=>a.category===category));
  assert.equal(filterAssets('all').length,12);assert.equal(filterAssets('unknown').length,0);
  assert.equal(assetById('invalid').id,'speaker');assert.ok(assets.filter(a=>a.priority==='First').length>=4);
});
test('component appearances persist independently across devices, export and undo', () => {
  const s=createState(),h=history(s);setAppearance(s,'date','shape','ticket');setAppearance(s,'date','background','#efe0bd');h.push(s);
  assert.equal(s.appearance.choices.shape,'auto');switchDevice(s,'phone');assert.equal(s.appearance.date.shape,'ticket');
  const restored=validateState(exportPackage(s).config);assert.equal(restored.appearance.date.background,'#efe0bd');
  assert.equal(h.undo().appearance.date.shape,'auto');resetAppearance(s,'date');assert.deepEqual(s.appearance.date,appearanceDefaults('date'));
});
test('legacy layouts gain safe appearance defaults without losing custom geometry', () => {
  const s=createState();delete s.appearance;s.widgets.date.x=13;const migrated=validateState(s);
  assert.equal(migrated.widgets.date.x,13);assert.deepEqual(migrated.appearance.date,appearanceDefaults('date'));
  for(const [field,value] of [['shape','unsafe'],['background','url(remote)'],['fontSize',NaN],['padding',99],['border',-1],['icon','<svg>'],['texture','remote']]) {
    const bad=createState();bad.appearance.date[field]=value;assert.throws(()=>validateState(bad));assert.throws(()=>setAppearance(createState(),'date',field,value));
  }
});
test('content fitting expands cramped widgets inside the canvas and exact sizing can be retained', () => {
  const w={x:82,y:88,w:12,h:8};const fitted=fitBox(w,532,299,110,65,true);
  assert.ok(fitted.w>=110);assert.ok(fitted.h>=65);assert.ok(fitted.x+fitted.w<=532);assert.ok(fitted.y+fitted.h<=299);
  assert.equal(fitBox(w,532,299,110,65,false).w,532*12/100);
  assert.equal(fitBox(w,50,30,110,65,true).w,50);
});
test('custom frames are embedded in exports and reject scripted or external SVGs', () => {
  const uri=svg=>'data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'),s=createState();
  setAppearance(s,'choices','frame',uri('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="none" stroke="gold"/></svg>'));
  assert.equal(validateState(exportPackage(s).config).appearance.choices.frame,s.appearance.choices.frame);
  for(const svg of ['<svg><script>bad()</script></svg>','<svg><image href="https://example.com/image.png"/></svg>','<svg onload="bad()"/>','<!DOCTYPE svg><svg/>'])assert.throws(()=>setAppearance(s,'choices','frame',uri(svg)));
  assert.throws(()=>setAppearance(s,'date','frame','data:image/png;base64,YmFk'));resetAppearance(s,'choices');assert.equal(s.appearance.choices.frame,'');
});

test('expanded HUD cards keep wallet, stats and navigation rows separated',async()=>{const {separateStack}=await import('../vn_ui_studio/model.mjs');let [wallet,stats]=separateStack({x:507,y:14,w:95,h:58},{x:502,y:62,w:116,h:125},347);assert.equal(stats.y,78);assert.equal(wallet.y,14);let [shop,board]=separateStack({x:451,y:271,w:68,h:38},{x:451,y:305,w:68,h:38},347);assert.equal(shop.y,261);assert.equal(board.y,305);assert.ok(shop.y+shop.h+6<=board.y);assert.deepEqual(separateStack({x:0,y:0,w:10,h:10},{x:20,y:0,w:10,h:10},100),[{x:0,y:0,w:10,h:10},{x:20,y:0,w:10,h:10}]);});

test('quick-menu icons migrate, edit independently, undo and export safely',async()=>{const {setUtility,utilityDefaults}=await import('../vn_ui_studio/utilities.mjs');const s=createState(),h=history(s);setUtility(s,'history','glyph','heart');setUtility(s,'history','tint','#ccaa88');h.push(s);assert.equal(s.utilities.save.glyph,'save');assert.equal(validateState(exportPackage(s).config).utilities.history.glyph,'heart');assert.equal(h.undo().utilities.history.glyph,'history');const old=cloneForTest(s);delete old.utilities;delete old.widgets.utilities;for(const layout of Object.values(old.layouts))delete layout.utilities;assert.deepEqual(validateState(old).utilities,utilityDefaults());assert.ok(screenWidgets(validateState(old)).includes('utilities'));for(const [field,value] of [['glyph','bad'],['tint','red'],['label','<script>'],['visible',1],['asset','data:bad']])assert.throws(()=>setUtility(s,'history',field,value));});
function cloneForTest(s){return JSON.parse(JSON.stringify(s));}

test('quick menu renders accessible icons, hides individual tools and keeps actions fixed',async()=>{const {utilityMarkup,utilityPanel}=await import('../vn_ui_studio/utility-views.mjs');const {setUtility}=await import('../vn_ui_studio/utilities.mjs');const s=createState();setUtility(s,'save','label','Bookmark');setUtility(s,'inventory','visible',false);const html=utilityMarkup(s,g=>'<svg data-symbol="'+g+'"></svg>');assert.match(html,/data-tool="save" aria-label="Bookmark"/);assert.doesNotMatch(html,/data-tool="inventory"/);assert.equal((html.match(/data-tool=/g)||[]).length,8);assert.match(utilityPanel('load',s,null),/disabled/);assert.match(utilityPanel('load',s,{screen:'dialogue'}),/Restore preview slot/);const old=cloneForTest(s);old.device='phone';delete old.widgets.utilities;for(const layout of Object.values(old.layouts))delete layout.utilities;const migrated=validateState(old);assert.equal(migrated.layouts.desktop.utilities.y,25);assert.equal(migrated.layouts.phone.utilities.y,23);});

test('quick menu leaves screen headers clear when panels fit below it',async()=>{const {fitBelow}=await import('../vn_ui_studio/model.mjs');const page=fitBelow({x:74,y:83,w:389,h:246},{x:19,y:87,w:395,h:44},347);assert.equal(page.y,137);assert.equal(page.h,210);assert.ok(page.y+page.h<=347);assert.equal(fitBelow({x:450,y:83,w:100,h:200},{x:19,y:87,w:300,h:44},347).y,83);});

test('utility buttons split legacy geometry into independent device layouts',async()=>{const {splitUtilities}=await import('../vn_ui_studio/model.mjs');const s=createState();assert.ok(s.widgets.tool_history);moveWidget(s.widgets.tool_history,11,42);assert.notEqual(s.widgets.tool_save.x,11);const old=cloneForTest(s);for(const widgets of [old.widgets,...Object.values(old.layouts)])for(const id of Object.keys(widgets))if(id.startsWith('tool_'))delete widgets[id];const restored=validateState(old);assert.deepEqual(restored.widgets.tool_save,splitUtilities(old.device,old.widgets.utilities).tool_save);assert.ok(restored.widgets.tool_history.x+restored.widgets.tool_history.w<=100);});
test('button states and reusable presets validate, export, undo and preserve actions and positions',async()=>{const {setButton,saveComponentPreset,applyComponentPreset}=await import('../vn_ui_studio/buttons.mjs');const s=createState(),h=history(s);setButton(s,'shop','display','icon');setButton(s,'shop','fill','#abcdef','hover');saveComponentPreset(s,'shop','My button');const before=cloneForTest(s.widgets.map);applyComponentPreset(s,'map','My button');h.push(s);assert.deepEqual(s.widgets.map,before);assert.equal(s.buttons.map.display,'icon');assert.equal(s.buttons.map.states.hover.fill,'#abcdef');assert.equal(s.buttons.board.display,'both');assert.equal(validateState(exportPackage(s).config).presets[0].name,'My button');assert.equal(h.undo().buttons.map.display,'both');for(const [key,value,mode] of [['display','bad'],['iconSize',100],['fill','url(bad)','hover'],['art','data:bad','normal']])assert.throws(()=>setButton(s,'shop',key,value,mode));});

test('button artwork inherits safely and old compact navigation migrates to icon-only buttons',async()=>{const {setButton}=await import('../vn_ui_studio/buttons.mjs');const {buttonVariables,designButton}=await import('../vn_ui_studio/button-views.mjs');const s=createState(),art='data:image/svg+xml;base64,'+Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64');setButton(s,'shop','art',art,'normal');assert.match(buttonVariables(s.buttons.shop),/--hover-art:url\(data:image/);setButton(s,'shop','opacity',30,'disabled');assert.match(buttonVariables(s.buttons.shop),/--disabled-opacity:0.3/);assert.match(designButton(s,'shop','<svg/>','Shop','data-navigate="choice_hub"'),/data-navigate="choice_hub"/);const old=cloneForTest(s);delete old.buttons;old.navigation='compact';assert.equal(validateState(old).buttons.map.display,'icon');assert.throws(()=>validateState({...s,presets:[{name:'bad',appearance:{}}]}));});

test('responsive anchors preserve edge gaps and fixed sizes as canvas dimensions change',async()=>{const {anchorBox,captureConstraint,constraintDefaults,validateConstraint}=await import('../vn_ui_studio/responsive.mjs');const box={x:320,y:220,w:60,h:40},rule=captureConstraint({...constraintDefaults(),x:'right',y:'bottom',fixed:true},box,400,300);assert.equal(rule.offsetX,20);assert.equal(rule.offsetY,40);assert.deepEqual(anchorBox(box,800,600,rule),{x:720,y:520,w:60,h:40});assert.deepEqual(anchorBox(box,30,20,rule),{x:0,y:0,w:30,h:20});assert.throws(()=>validateConstraint({x:'bad'}));const s=createState();s.constraints.desktop.map=rule;assert.equal(validateState(exportPackage(s).config).constraints.desktop.map.x,'right');});
test('selection alignment and equal gaps preserve sizes and refuse locked or impossible groups atomically',async()=>{const {arrangeWidgets}=await import('../vn_ui_studio/responsive.mjs');const s=createState();Object.assign(s.widgets.shop,{x:10,w:10});Object.assign(s.widgets.map,{x:30,w:20});Object.assign(s.widgets.board,{x:80,w:10});arrangeWidgets(s,['shop','map','board'],'space','x');assert.equal(s.widgets.map.x,40);arrangeWidgets(s,['shop','map','board'],'center','y');const before=cloneForTest(s.widgets);s.widgets.map.locked=true;assert.throws(()=>arrangeWidgets(s,['shop','map'],'start','x'));assert.equal(s.widgets.shop.x,before.shop.x);assert.throws(()=>arrangeWidgets(s,['shop','board'],'space','x'));});
test('neighbor snapping and overlap diagnostics use actual rendered rectangles',async()=>{const {snapBox,overlapIssues}=await import('../vn_ui_studio/responsive.mjs');const result=snapBox({x:163,y:70,w:40,h:30},[{id:'map',x:200,y:80,w:50,h:40}],500,300);assert.equal(result.box.x,160);assert.equal(result.guides.find(g=>g.axis==='x').id,'map');assert.equal(overlapIssues([{id:'a',x:0,y:0,w:20,h:20},{id:'b',x:10,y:10,w:20,h:20}],100,100)[0].type,'overlap');assert.equal(overlapIssues([{id:'a',x:0,y:0,w:10,h:10},{id:'b',x:10,y:0,w:10,h:10}],100,100).length,0);});
test('responsive rules migrate, remain device-specific, undo and reset safely',async()=>{const {constraintDefaults,overlapIssues}=await import('../vn_ui_studio/responsive.mjs');const s=createState(),h=history(s);s.constraints.desktop.shop={...constraintDefaults(),x:'right',offsetX:12};h.push(s);switchDevice(s,'phone');assert.equal(s.constraints.phone.shop.x,'free');switchDevice(s,'desktop');assert.equal(s.constraints.desktop.shop.offsetX,12);assert.equal(h.undo().constraints.desktop.shop.x,'free');resetLayout(s,'shop');assert.equal(s.constraints.desktop.shop.x,'free');s.constraints.desktop.shop.x='right';applyPreset(s,'classic');assert.equal(s.constraints.desktop.shop.x,'free');const old=cloneForTest(s);delete old.constraints;delete old.smartSnap;assert.equal(validateState(old).constraints.desktop.shop.x,'free');assert.equal(validateState(old).smartSnap,true);assert.throws(()=>validateState({...s,smartSnap:'yes'}));assert.equal(overlapIssues([{id:'text',x:0,y:0,w:50,h:20,contentH:40}],100,100)[0].type,'clipping');});
