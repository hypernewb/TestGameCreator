import test from 'node:test';
import assert from 'node:assert/strict';
import {uiArtPath,artUrl,iconHref,artCarriers,uiMediaReferences,remapUiMedia,iconNode,buttonIcon,fillButton} from '../public/ui-art.mjs';
import {embedWizardArt} from '../public/ui-art-import.mjs';
import {frameStyle,buttonStyle,surfaceStyle} from '../public/ui-layout-style.mjs';
import {validateSkinExport,resolveSkinLayout} from '../public/vn-skin.mjs';
import {reviewWizardExport,applyUiReview,selectScreenMode,mountUiProject} from '../public/ui-project.mjs';
import {createLiveUi} from '../public/ui-live.mjs';
import {fixture,view} from './ui-live-fixture.mjs';
import {authored} from './ui-live-layout-fixture.mjs';
import {artful,frameArt,stateArt,svgArt,png} from './ui-art-fixture.mjs';
const media=n=>`scenario-media/00000000-0000-4000-8000-${String(n).padStart(12,'0')}.png`,pause=()=>new Promise(r=>setTimeout(r,0));
const uploader=()=>{const sent=[];return {sent,upload:async d=>{sent.push(d);return media(sent.length);}};},raster=async()=>png(4,4,()=>[1,2,3,255]);
const embedded=async(raw=artful())=>{const u=uploader(),r=await embedWizardArt(raw,{upload:u.upload,rasterize:raster});return {...r,sent:u.sent};};
const bound=async(screen=false)=>{const p=applyUiReview(fixture(),reviewWizardExport((await embedded()).raw,{id:'art'}));return screen?selectScreenMode(p,'wizard'):p;};
class Element{constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.style={};this.attributes={};this.className='';this.value='';this.disabled=false;this.clientWidth=1440;this.clientHeight=900;}
 append(...xs){for(const x of xs){x.parentNode?.children&&(x.parentNode.children=x.parentNode.children.filter(y=>y!==x));x.parentNode=this;this.children.push(x);}}
 insertBefore(x,ref){x.parentNode&&(x.parentNode.children=x.parentNode.children.filter(y=>y!==x));x.parentNode=this;const i=this.children.indexOf(ref);i<0?this.children.push(x):this.children.splice(i,0,x);}
 get nextSibling(){const s=this.parentNode?.children;return s?s[s.indexOf(this)+1]||null:null;}
 replaceChildren(...xs){for(const x of this.children)x.parentNode=null;this.children=[];this.append(...xs);}
 setAttribute(k,v){this.attributes[k]=String(v);}removeAttribute(k){delete this.attributes[k];}
 get isConnected(){return this===this.ownerDocument.root||!!this.parentNode?.isConnected;}
 get textContent(){return this.text??this.children.map(x=>x.textContent).join(' ');}set textContent(x){this.text=String(x);this.children=[];}set innerHTML(x){throw Error('Unsafe HTML');}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null;}
 all(){return [this,...this.children.flatMap(x=>x.all())];}
 querySelector(s){return this.all().slice(1).find(e=>s[0]==='#'?e.id===s.slice(1):e.className.split(' ').includes(s.slice(1)))||null;}
 find(id){return this.querySelector('#'+id)||undefined;}}
const mkdoc=()=>{const doc={createElement:t=>new Element(t,doc),createElementNS:(ns,t)=>Object.assign(new Element(t,doc),{ns})};return doc;};
function dom(){const doc=mkdoc(),root=doc.root=new Element('main',doc);root.className='stage';const el=(tag,cls,id,parent=root)=>{const e=new Element(tag,doc);e.className=cls;if(id)e.id=id;parent.append(e);return e;};
 el('header','scene-header');el('nav','scene-nav');const d=el('section','dialogue');el('p','','line',d);el('section','choices','choices');el('section','choices hub','hub');el('section','first-controls','first-controls');const f=el('form','prompt-composer','prompt-composer');el('input','','player-prompt',f);el('div','scene-status','scene-status');
 return {root,ui:createLiveUi(root,{})};}
const svgOf=e=>e.children.find(x=>x.tagName==='SVG'),imgOf=e=>e.children.find(x=>x.tagName==='IMG'),labelOf=e=>e.children.find(x=>x.className==='design-label');

test('player art contract: only uploaded project media paths become URLs; embedded, external, script and traversal art is refused',()=>{
 assert.equal(artUrl(media(1)),'/'+media(1));assert.ok(uiArtPath('scenario-media/00000000-0000-4000-8000-000000000001.webp'));assert.ok(uiArtPath('scenario-media/00000000-0000-4000-8000-000000000001.jpg'));
 for(const bad of [frameArt,svgArt,'javascript:alert(1)','https://x.test/a.png','//x.test/a.png','/scenario-media/00000000-0000-4000-8000-000000000001.png','scenario-media/../server.mjs','scenario-media/00000000-0000-4000-8000-000000000001.svg','scenario-media/x.png','url(a.png)','',null,7])assert.equal(artUrl(bad),'',String(bad).slice(0,40));
 assert.equal(iconHref('heart'),'/vn_ui_studio/icons.svg#i-heart');for(const bad of ['../x','a"b','Heart','','i-x'])assert.equal(iconHref(bad),'');
 const ok=authored();ok.config.appearance.dialogue.frame=media(1);ok.config.utilities.save.asset=media(2);ok.config.buttons.shop.states.hover.art=media(3);assert.equal(validateSkinExport(ok).ok,true);
 for(const [where,v] of [['frame',frameArt],['frame','https://x.test/a.png'],['asset','scenario-media/../../a.png'],['art','javascript:x'],['art',svgArt]]){const raw=authored();if(where==='frame')raw.config.appearance.dialogue.frame=v;if(where==='asset')raw.config.utilities.save.asset=v;if(where==='art')raw.config.buttons.shop.states.hover.art=v;const r=validateSkinExport(raw);assert.equal(r.ok,false,where+' '+v.slice(0,30));assert.match(r.error,/uploaded project media|Unsafe configuration value/);}
});

test('every art-carrying Wizard field is found, reported as a media reference and remapped on import',()=>{
 const c=artful().config;c.presets=[{appearance:{frame:frameArt},button:{states:{normal:{art:stateArt}}}}];const refs=artCarriers(c).map(x=>x[2]).sort();
 assert.deepEqual(refs,['appearance.choices.frame','appearance.date.frame','appearance.dialogue.frame','appearance.tool_settings.frame','buttons.shop.states.hover.art','buttons.shop.states.normal.art','presets.0.appearance.frame','presets.0.button.states.normal.art','utilities.save.asset']);
 const pack={gameProject:{ui:{options:[{id:'art',skin:{export:{config:{appearance:{dialogue:{frame:media(1)}},utilities:{save:{asset:media(2)}},buttons:{}}}}}]}}};
 assert.deepEqual(uiMediaReferences(pack),[{ref:'gameProject.ui.art.appearance.dialogue.frame',path:media(1)},{ref:'gameProject.ui.art.utilities.save.asset',path:media(2)}]);
 const next=remapUiMedia(pack,{[media(1)]:media(9)});assert.deepEqual(uiMediaReferences(next).map(x=>x.path),[media(9),media(2)]);assert.equal(pack.gameProject.ui.options[0].skin.export.config.appearance.dialogue.frame,media(1),'original untouched');
});

test('Studio import validates Wizard data URIs, rasterises SVG, uploads each distinct image once and refuses bad art',async()=>{
 const r=await embedded();assert.equal(r.count,4,'frame, svg, state and icon art; the repeated frame and icon are uploaded once');assert.equal(r.sent.length,4);assert.ok(r.sent.every(d=>d.startsWith('data:image/png;base64,')),'SVG reached the server as PNG');
 const c=r.raw.config;assert.equal(c.appearance.dialogue.frame,c.appearance.choices.frame,'same URI → same upload');assert.ok(artCarriers(c).every(([o,k])=>uiArtPath(o[k])));assert.equal(validateSkinExport(r.raw).ok,true);
 const none=await embedWizardArt(JSON.stringify(authored()),{upload:()=>assert.fail('no upload')});assert.equal(none.count,0);
 const bad=authored();bad.config.appearance.dialogue.frame='data:image/png;base64,'+Buffer.from('not a png').toString('base64');await assert.rejects(embedWizardArt(bad,{upload:async()=>media(1)}),/appearance\.dialogue\.frame: Invalid PNG/);
 const evil=authored();evil.config.utilities.save.asset='data:image/svg+xml;base64,'+Buffer.from('<svg><script>x</script></svg>').toString('base64');await assert.rejects(embedWizardArt(evil,{upload:async()=>media(1),rasterize:raster}),/utilities\.save\.asset: .*self-contained/);
 await assert.rejects(embedWizardArt(artful(),{upload:async()=>'https://x.test/a.png',rasterize:raster}),/artwork upload failed/);
 const outside=authored();outside.config.appearance.dialogue.frame='https://x.test/frame.png';await assert.rejects(async()=>reviewWizardExport((await embedWizardArt(outside,{upload:async()=>media(1)})).raw,{id:'x'}),/Unsafe configuration value|uploaded project media/);
});

test('frames are 9-slice border images and button state art is a stretched background, using validated URLs only',()=>{
 const a={slice:20,border:1,frame:media(1)};assert.deepEqual(frameStyle(a),{borderStyle:'solid',borderColor:'transparent',borderImageSource:`url("/${media(1)}")`,borderImageSlice:'20% fill',borderImageWidth:'8px',borderImageRepeat:'stretch',clipPath:'none'});
 assert.equal(frameStyle({slice:20,border:0,frame:media(1)}).borderImageWidth,'4px');for(const f of ['',frameArt,'https://x.test/a.png'])assert.deepEqual(frameStyle({slice:20,border:1,frame:f}),{});
 const s=surfaceStyle('dialogue',{shape:'auto',font:'auto',fontSize:100,padding:4,border:2,slice:30,background:'auto',ink:'auto',texture:'auto',frame:media(2)},{theme:'kinetic',opacity:100,textSize:18,radius:8}).style;assert.equal(s.borderImageSource,`url("/${media(2)}")`);assert.equal(s.borderImageSlice,'30% fill');assert.equal(s.borderImageWidth,'16px');
 const b={skin:'tab',orientation:'horizontal',padding:3,radius:2,iconSize:20,display:'both',states:{normal:{fill:'auto',ink:'auto',border:'auto',opacity:100,art:media(3)},hover:{fill:'auto',ink:'auto',border:'auto',opacity:100,art:''},disabled:{fill:'auto',ink:'auto',border:'auto',opacity:45,art:frameArt}}},o={border:1};
 assert.equal(buttonStyle(b,'normal',o).backgroundImage,`url("/${media(3)}")`);assert.equal(buttonStyle(b,'normal',o).backgroundSize,'100% 100%');assert.equal(buttonStyle(b,'hover',o).backgroundImage,`url("/${media(3)}")`,'state without art falls back to normal art');assert.equal(buttonStyle(b,'disabled',o).backgroundImage,'none','unsafe state art is never a URL');
 assert.equal(buttonStyle({...b,states:{normal:{...b.states.normal,art:''}}},'normal',o).backgroundImage,'none');assert.equal(buttonStyle({...b,orientation:'vertical'},'normal',o).gap,'3px');assert.equal(buttonStyle(b,'normal',o).gap,'6px');
});

test('button content honours display, icon size, utility glyph or uploaded asset, and appearance.icon none/auto/glyph',()=>{
 const doc=mkdoc(),btn=(id,w,label='Go')=>fillButton(doc.createElement('button'),id,w,label),B=(o={})=>({display:'both',iconSize:20,...o});
 let e=btn('tool_save',{utility:{glyph:'save',asset:''},button:B()},'Save');const svg=svgOf(e);assert.equal(svg.ns,'http://www.w3.org/2000/svg');assert.equal(svg.children[0].attributes.href,'/vn_ui_studio/icons.svg#i-save');assert.equal(svg.attributes['aria-hidden'],'true');assert.equal(svg.style.width,'20px');assert.equal(labelOf(e).textContent,'Save');assert.equal(e.attributes['aria-label'],'Save');
 e=btn('tool_save',{utility:{glyph:'save',asset:media(4)},button:B({display:'icon',iconSize:26})},'Save');const img=imgOf(e);assert.equal(img.src,'/'+media(4));assert.equal(img.alt,'');assert.equal(img.style.height,'26px');assert.equal(img.style.objectFit,'contain');assert.equal(labelOf(e),undefined,'icon-only hides the label');assert.equal(e.attributes['aria-label'],'Save','still named for assistive tech');
 e=btn('tool_save',{utility:{glyph:'save',asset:frameArt},button:B()});assert.equal(imgOf(e),undefined,'embedded asset never reaches the player');assert.ok(svgOf(e),'falls back to the glyph');
 e=btn('tool_load',{utility:{glyph:'load',asset:''},button:B({display:'label'})},'Load');assert.deepEqual(e.children.map(x=>x.className),['design-label']);
 assert.equal(svgOf(btn('shop',{appearance:{icon:'auto'},button:B()})).children[0].attributes.href,'/vn_ui_studio/icons.svg#i-shop');assert.equal(svgOf(btn('shop',{appearance:{icon:'heart'},button:B()})).children[0].attributes.href,'/vn_ui_studio/icons.svg#i-heart');
 assert.equal(buttonIcon('shop',{appearance:{icon:'none'},button:B()}),null);assert.deepEqual(btn('balance',{appearance:{icon:'auto'},button:B()}).children.map(x=>x.className),['design-label'],'auto on a non-tool widget has no icon');
 e=btn('shop',{appearance:{icon:'none'},button:B({display:'icon'})},'Shop');assert.equal(labelOf(e).textContent,'Shop','icon-only without an icon keeps the label');
 assert.equal(iconNode(doc,{glyph:'"><script>'}),null);
});

test('the live player draws bound-widget icons and state art, dock icons/assets/frames, and framed header, dialogue and choices',async()=>{
 const p=await bound(true),c=p.gameProject.ui.options.find(x=>x.id==='art').skin.export.config,{root,ui}=dom();await ui.update(view(p));await pause();
 const shop=root.find('game-ui-shop');assert.equal(svgOf(shop).children[0].attributes.href,'/vn_ui_studio/icons.svg#i-heart');assert.equal(svgOf(shop).style.width,'22px');assert.equal(labelOf(shop).textContent,shop.attributes['aria-label']);assert.equal(shop.style.backgroundImage,`url("/${c.buttons.shop.states.normal.art}")`);
 shop.onpointerenter();assert.equal(root.find('game-ui-shop').style.backgroundImage,`url("/${c.buttons.shop.states.hover.art}")`,'hover state art');
 const save=root.find('game-ui-tool_save');assert.equal(imgOf(save).src,'/'+c.utilities.save.asset);assert.equal(labelOf(save),undefined);assert.equal(save.attributes['data-action'],'save');
 const load=root.find('game-ui-tool_load');assert.deepEqual(load.children.map(x=>x.className),['design-label']);
 const set=root.find('game-ui-tool_settings');assert.equal(set.style.borderImageSource,`url("/${c.appearance.tool_settings.frame}")`);assert.equal(svgOf(set).children[0].attributes.href,'/vn_ui_studio/icons.svg#i-settings');
 const hist=root.find('game-ui-tool_history');assert.equal(svgOf(hist).children[0].attributes.href,'/vn_ui_studio/icons.svg#i-history');assert.equal(svgOf(hist).attributes.fill,'none');assert.equal(svgOf(hist).attributes.stroke,'currentColor','glyphs follow the button ink');
assert.equal(root.querySelector('.dialogue').attributes['data-framed'],'','framed dialogue drops the classic plate');
 assert.equal(root.querySelector('.dialogue').style.borderImageSource,`url("/${c.appearance.dialogue.frame}")`);assert.equal(root.querySelector('.dialogue').style.borderImageSlice,'20% fill');assert.equal(root.querySelector('.scene-header').style.borderImageSource,`url("/${c.appearance.date.frame}")`);assert.equal(root.find('choices').style.borderImageSource,`url("/${c.appearance.choices.frame}")`);
 const urls=root.all().flatMap(e=>[...Object.values(e.style),e.src||'',...Object.values(e.attributes)]).filter(v=>typeof v==='string'&&/url\(|^\/|^data:|^https?:/i.test(v));assert.ok(urls.length>8);assert.ok(urls.every(v=>/^(url\("\/scenario-media\/[a-f0-9-]{36}\.png"\)|\/scenario-media\/[a-f0-9-]{36}\.png|\/vn_ui_studio\/icons\.svg#i-[a-z]+)$/.test(v)),urls.find(v=>!/scenario-media|icons\.svg/.test(v)));
 ui.reset();assert.ok(!root.querySelector('.dialogue').style.borderImageSource,'frame removed when the Wizard screen clears');assert.equal(root.querySelector('.dialogue').attributes['data-framed'],undefined);
});

test('a tampered pack with embedded or external art is refused by the player instead of drawing it',async()=>{
 const data=view(await bound()),c=data.pack.gameProject.ui.options.find(x=>x.id==='art').skin.export.config;c.appearance.shop.frame='https://x.test/a.png';const {root,ui}=dom();await ui.update(data);await pause();
 assert.equal(root.find('game-ui-shop'),undefined);assert.match(root.find('game-ui-live').children.find(x=>x.attributes.role==='status').textContent,/Unsafe configuration value|uploaded project media/);
});

test('Studio file import uploads Wizard art through the injected uploader before review, then applies media paths',async()=>{
 const doc=mkdoc();doc.root=new Element('section',doc);let current=fixture();const status=[],u=uploader();mountUiProject(doc.root,{getPack:()=>current,onChange:n=>current=n,onStatus:x=>status.push(x),makeId:()=>'art',uploadArt:u.upload,rasterize:raster});
 const file=doc.root.find('ui-layout-file');file.files=[{name:'art.json',size:1000,text:async()=>JSON.stringify(artful())}];await file.onchange();
 assert.equal(u.sent.length,4);assert.match(JSON.stringify(status.at(-1)),/4 artwork files uploaded as project media/);doc.root.all().find(e=>e.tagName==='BUTTON'&&/^Apply/.test(e.textContent)).onclick();
 const opt=current.gameProject.ui.options.find(x=>x.id==='art'),cfg=opt.skin.export.config;assert.ok(artCarriers(cfg).length>=5);assert.ok(artCarriers(cfg).every(([o,k])=>uiArtPath(o[k])));assert.ok(!JSON.stringify(current).includes('data:image'));
 const lay=resolveSkinLayout(opt.skin.export,{width:1440,height:810,device:'desktop'});assert.equal(lay.widgets.tool_save.utility.asset,cfg.utilities.save.asset);assert.equal(lay.widgets.shop.button.states.normal.art,cfg.buttons.shop.states.normal.art);
});
