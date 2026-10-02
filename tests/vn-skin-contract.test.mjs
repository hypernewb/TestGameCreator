import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createState,exportPackage,validateState,fitBox} from '../vn_ui_studio/model.mjs';
import {anchorBox} from '../vn_ui_studio/responsive.mjs';
import {setUtility} from '../vn_ui_studio/utilities.mjs';
import {validateSkinExport,resolveSkinLayout,loadSkin} from '../public/vn-skin.mjs';
const fixture=()=>exportPackage(createState()),copy=x=>structuredClone(x);

test('v1 normalizes with Studio parity, clones inputs and discards raw CSS',()=>{
 const raw=fixture(),before=copy(raw),r=validateSkinExport(raw);assert.equal(r.ok,true);assert.deepEqual(r.skin.config,validateState(raw.config));assert.deepEqual(raw,before);assert.equal(r.skin.css,'');r.skin.config.widgets.date.x=10;assert.equal(raw.config.widgets.date.x,3);
 const old=fixture();delete old.config.appearance;delete old.config.buttons;delete old.config.constraints;delete old.config.utilities;delete old.config.presets;assert.deepEqual(validateSkinExport(old).skin.config,validateState(old.config));assert.equal(validateSkinExport(JSON.stringify(raw)).ok,true);
});
test('accepted nested constraint extensions never alias caller data through validation or loading',async()=>{
 for(const mode of ['validate','inline','source']){
  const raw=fixture();for(const device of ['desktop','tablet','phone'])raw.config.constraints[device].dialogue.extension={nested:{gap:12},other:{offset:9}};
  const before=copy(raw),r=mode==='validate'?validateSkinExport(raw):await loadSkin(mode==='inline'?{version:1,mode:'wizard',export:raw}:{version:1,mode:'wizard',source:'/ui/a.json'},{fetchJson:async()=>raw});assert.ok(r.skin);assert.deepEqual(r.skin.config,validateState(raw.config));assert.deepEqual(raw,before);
  for(const device of ['desktop','tablet','phone']){const input=raw.config.constraints[device].dialogue.extension,output=r.skin.config.constraints[device].dialogue.extension;assert.notEqual(output,input);assert.notEqual(output.nested,input.nested);assert.notEqual(output.other,input.other);output.nested.gap=27;assert.equal(input.nested.gap,12);input.other.offset=31;assert.equal(output.other.offset,9);}
 }
});
test('Studio plain-text labels and preset names retain punctuation without URL false positives',async()=>{
 for(const label of ['Load data:','https: help','Try url(example)','Read ../ guide','Use javascript:']){const state=createState();setUtility(state,'load','label',label);state.presets=[{name:label,appearance:copy(state.appearance.dialogue),button:null}];const raw=exportPackage(state),before=copy(raw),r=validateSkinExport(raw);assert.equal(r.ok,true);assert.deepEqual(r.skin.config,validateState(raw.config));assert.deepEqual(raw,before);assert.equal(r.skin.config.utilities.load.label,label);assert.equal(r.skin.config.presets[0].name,label);assert.equal((await loadSkin({version:1,mode:'wizard',export:raw})).mode,'wizard');}
});
test('URL-looking artwork and unsafe source paths fail without calling fetch',async()=>{
 for(const value of ['data:image/png;base64,AAAA','javascript:alert(1)','https://evil/art.png','//evil/art.png','/ui/../art.png','/ui/%2e%2e/art.png'])for(const carrier of ['frame','asset','art']){const raw=fixture();if(carrier==='frame')raw.config.appearance.dialogue.frame=value;else if(carrier==='asset')raw.config.utilities.load.asset=value;else raw.config.buttons.tool_load.states.hover.art=value;assert.equal(validateSkinExport(raw).ok,false);}
 let calls=0;for(const source of ['data:application/json,{}','javascript:alert(1)','https://evil/a.json','//evil/a.json','/ui/../a.json','/ui/%2e%2e/a.json','/ui/%252e%252e/a.json','/ui/a%2fb.json','/ui/./a.json','/ui/a.json#x']){const r=await loadSkin({version:1,mode:'wizard',source},{fetchJson:async()=>{calls++;return fixture();}});assert.equal(r.mode,'legacy');assert.ok(r.diagnostic);}assert.equal(calls,0);
 for(const label of ['<script>','<img onerror=x>','Load\n data:']){const raw=fixture();raw.config.utilities.load.label=label;assert.equal(validateSkinExport(raw).ok,false);}
});
test('invalid versions, geometry, labels, styles and every artwork carrier fail closed',()=>{
 for(const mutate of [r=>r.version=2,r=>r.format='other',r=>r.units='px',r=>r.config.version=2,r=>r.config.widgets.date.x=Infinity,r=>r.config.layouts.phone.dialogue.w=NaN,r=>r.config.accent='url(javascript:x)',r=>r.config.appearance.date.ink='<script>',r=>r.config.utilities.save.label='<img onerror=x>',r=>r.config.constraints.desktop.dialogue.width=Infinity,r=>r.config.buttons.tool_save.states.hover.fill='red',r=>r.config.appearance.date.frame='data:image/png;base64,AAAA',r=>r.config.utilities.save.asset='/../private.png',r=>r.config.buttons.tool_save.states.normal.art='https://evil/a.png',r=>r.css=':root{background:url(javascript:x)}',r=>r.config.presets=[{name:'Bad',appearance:{...r.config.appearance.date,frame:'/ui/a.svg'}}]]){const raw=fixture();mutate(raw);const before=copy(raw),r=validateSkinExport(raw);assert.equal(r.ok,false);assert.equal(r.skin,null);assert.ok(r.error);assert.deepEqual(raw,before);}
 for(const raw of ['{',null,[],{},JSON.parse('{"__proto__":{"polluted":true}}')])assert.equal(validateSkinExport(raw).ok,false);
});
test('core rectangles and independent states match wizard at desktop/tablet/phone stage sizes',()=>{
 for(const [device,width,height] of [['desktop',1440,900],['tablet',768,1024],['phone',390,844]]){
  const raw=fixture();raw.config.constraints[device].dialogue={x:'right',y:'bottom',offsetX:17,offsetY:23,fixed:true,width:250,height:120};raw.config.buttons.tool_save.states.hover.fill='#abcdef';raw.config.buttons.tool_load.states.disabled.opacity=25;
  const r=resolveSkinLayout(validateSkinExport(raw).skin,{width,height,device});assert.equal(r.ok,true);for(const id of ['date','dialogue','choices','tool_save','tool_load'])assert.deepEqual(r.widgets[id].rect,anchorBox(fitBox(raw.config.layouts[device][id],width,height,0,0,raw.config.appearance[id].fit),width,height,raw.config.constraints[device][id]));assert.equal(r.widgets.tool_save.button.states.hover.fill,'#abcdef');assert.equal(r.widgets.tool_load.button.states.disabled.opacity,25);assert.equal(r.widgets.tool_save.button.states.disabled.opacity,45);assert.ok(!r.widgets.radar);assert.ok(!r.widgets.balance);assert.equal(r.bindings.input,'choices');assert.equal(r.bindings.feedback,'dialogue');
 }
 const skin=validateSkinExport(fixture()).skin;assert.equal(resolveSkinLayout(skin,{width:390,height:844}).error,'device-required: Studio defines no viewport breakpoints.');for(const args of [{width:0,height:1,device:'phone'},{width:1,height:NaN,device:'phone'},{width:1,height:1,device:'watch'}])assert.equal(resolveSkinLayout(skin,args).ok,false);
});
test('presentation variants survive and absent optional content never becomes a binding',()=>{
 for(const sample of ['long','empty','loading','error']){const raw=fixture();raw.config.sample=sample;raw.config.widgets.dialogue.visible=false;raw.config.layouts.phone.dialogue.visible=false;const r=validateSkinExport(raw);assert.equal(r.skin.config.sample,sample);const layout=resolveSkinLayout(r.skin,{width:390,height:844,device:'phone'});assert.equal(layout.bindings.dialogue,undefined);assert.equal(layout.bindings.feedback,undefined);assert.ok(!layout.widgets.panel);assert.ok(r.warnings.some(w=>w.includes('unbound')));}
});
test('active custom geometry wins over stale saved device layouts and hidden tools stay unbound',()=>{
 const raw=fixture();raw.config.widgets.dialogue.x=10;raw.config.widgets.dialogue.w=60;raw.config.utilities.save.visible=false;raw.config.widgets.radar.visible=false;const before=copy(raw),skin=validateSkinExport(raw).skin,r=resolveSkinLayout(skin,{width:1440,height:900,device:'desktop'});assert.equal(r.widgets.dialogue.rect.x,144);assert.equal(r.widgets.dialogue.rect.w,864);assert.ok(!r.widgets.tool_save);assert.ok(!r.bindings.navigation.includes('tool_save'));assert.deepEqual(raw,before);r.widgets.tool_load.button.states.normal.fill='#abcdef';assert.equal(skin.config.buttons.tool_load.states.normal.fill,'auto');
 const old=fixture();for(const widgets of [old.config.widgets,...Object.values(old.config.layouts)])for(const id of Object.keys(widgets))if(id.startsWith('tool_'))delete widgets[id];const normalized=validateSkinExport(old).skin;assert.deepEqual(normalized.config,validateState(old.config));
});
test('loader preserves selections and uses diagnostic legacy fallback on all failed loads',async()=>{
 const legacy={name:'existing'},raw=fixture();let calls=0;const fetchJson=async path=>{calls++;assert.equal(path,'/ui/default-layout.json');return raw;};
 for(const metadata of [{actors:['campus-shaped'],locations:['campus']},{actors:['pilot-x'],locations:['orbital-dock']},{}]){const selection={version:1,mode:'wizard',export:raw,metadata},before=copy(selection),r=await loadSkin(selection,{fetchJson,legacy});assert.equal(r.mode,'wizard');assert.deepEqual(r.skin.config,raw.config);assert.deepEqual(selection,before);}
 assert.equal(calls,0);assert.equal((await loadSkin({version:1,mode:'wizard',source:'/ui/default-layout.json'},{fetchJson,legacy})).mode,'wizard');assert.equal(calls,1);
 for(const selection of [undefined,{version:1,mode:'legacy'},{version:2,mode:'wizard',export:raw},{version:1,mode:'wizard'},{version:1,mode:'wizard',export:{...raw,version:2}},{version:1,mode:'wizard',export:raw,source:'/ui/a.json'},...['https://evil/x.json','//evil/x.json','/ui/../x.json','/ui/%2e%2e/x.json','/ui/%252e%252e/x.json','data:text/plain,x','/ui/a.json?x=1','/ui/a.svg','/ui/a\\b.json'].map(source=>({version:1,mode:'wizard',source}))]){const before=copy(selection),r=await loadSkin(selection,{fetchJson,legacy});assert.equal(r.mode,'legacy');assert.equal(r.legacy,legacy);assert.ok(r.diagnostic);assert.deepEqual(selection,before);}
 for(const fetchJson of [async()=>{throw Error('offline');},async()=>'{',async()=>({...raw,version:5}),undefined]){const r=await loadSkin({version:1,mode:'wizard',source:'/ui/a.json'},{fetchJson,legacy});assert.equal(r.mode,'legacy');assert.ok(r.diagnostic);}
});
test('baseline is a pack-independent current export without embedded artwork',async()=>{const raw=JSON.parse(await readFile(new URL('../public/ui/default-layout.json',import.meta.url),'utf8')),r=validateSkinExport(raw);assert.equal(r.ok,true);assert.equal(r.skin.config.accent,'#a65f3f');assert.equal(r.skin.config.appearance.dialogue.background,'#f3ead9');assert.equal(r.skin.config.appearance.dialogue.ink,'#211c18');assert.deepEqual(r.skin.config,validateState(raw.config));});
