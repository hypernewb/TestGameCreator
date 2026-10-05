import {validateBindings} from '../vn_ui_studio/live-bindings.mjs';
// Pure Studio v1 contract port; parity covered by vn-skin-contract.test.mjs.
// No viewport thresholds exist in Studio; callers supply device and measured stage.
const utilityInfo={history:['History','history'],save:['Save','save'],load:['Load','load'],settings:['Settings','settings'],planner:['Planner','calendar'],updates:['Updates','spark'],dossier:['Dossier','profile'],inventory:['Inventory','bag'],location:['Location','map']};
const utilityGlyphs=[...new Set([...['moon','wallet','spark','heart','map','shop','board','calendar','phone','music','book','arrow'],'history','save','load','settings','profile','bag'])];
function utilityDefaults(){return Object.fromEntries(Object.entries(utilityInfo).map(([id,[label,glyph]])=>[id,{label,glyph,tint:'auto',visible:true,asset:''}]));}
function validateUtilities(raw){const out=utilityDefaults();if(raw===undefined)return out;if(!raw||typeof raw!=='object')throw Error('Invalid quick menu.');for(const id of Object.keys(out)){const a={...out[id],...raw[id]};if(!utilityGlyphs.includes(a.glyph)||typeof a.label!=='string'||a.label.length<1||a.label.length>32||/[<>\x00-\x1f]/.test(a.label)||typeof a.visible!=='boolean'||(a.tint!=='auto'&&!/^#[0-9a-f]{6}$/i.test(a.tint)))throw Error('Invalid quick-menu icon.');out[id]={label:a.label,glyph:a.glyph,tint:a.tint,visible:a.visible,asset:validateFrame(a.asset)};}return out;}
const buttonIds=['shop','map','board','calendar',...Object.keys(utilityInfo).map(id=>'tool_'+id)];
const buttonStates=['normal','hover','pressed','selected','disabled'];
const buttonOptions={display:['icon','both','label'],orientation:['horizontal','vertical'],skin:['bare','paper','glass','outline','tab','dock_tab']};
function buttonDefaults(id){return {display:id.startsWith('tool_')?'icon':'both',orientation:'horizontal',skin:id.startsWith('tool_')?'bare':'tab',iconSize:20,radius:4,padding:5,states:Object.fromEntries(buttonStates.map(mode=>[mode,{fill:'auto',ink:'auto',border:'auto',art:'',opacity:mode==='disabled'?45:100}]))};}
function validateButton(raw,id){const a={...buttonDefaults(id),...raw},out={};for(const [key,values] of Object.entries(buttonOptions)){if(!values.includes(a[key]))throw Error('Invalid button '+key+'.');out[key]=a[key];}for(const [key,min,max] of [['iconSize',12,40],['radius',0,24],['padding',0,16]]){if(!Number.isFinite(a[key])||a[key]<min||a[key]>max)throw Error('Invalid button '+key+'.');out[key]=a[key];}out.states={};for(const mode of buttonStates){const v={...buttonDefaults(id).states[mode],...a.states?.[mode]};for(const key of ['fill','ink','border'])if(v[key]!=='auto'&&(typeof v[key]!=='string'||!/^#[0-9a-f]{6}$/i.test(v[key])))throw Error('Invalid state color.');if(!Number.isFinite(v.opacity)||v.opacity<0||v.opacity>100)throw Error('Invalid state opacity.');out.states[mode]={fill:v.fill,ink:v.ink,border:v.border,opacity:v.opacity,art:validateFrame(v.art)};}return out;}
function validatePresets(raw){if(raw===undefined)return [];if(!Array.isArray(raw)||raw.length>10)throw Error('Use up to ten component presets.');const seen=new Set();return raw.map(p=>{if(typeof p.name!=='string'||!p.name.trim()||p.name.length>32||/[<>\x00-\x1f]/.test(p.name)||seen.has(p.name))throw Error('Use a unique preset name, up to 32 characters.');seen.add(p.name);return {name:p.name,appearance:validateAppearance(p.appearance),button:p.button?validateButton(p.button,'shop'):null};});}
const anchorOptions={x:['free','left','center','right'],y:['free','top','center','bottom']};
function constraintDefaults(){return {x:'free',y:'free',offsetX:0,offsetY:0,fixed:false,width:40,height:40};}
function validateConstraint(raw){const a={...constraintDefaults(),...raw};for(const axis of ['x','y'])if(!anchorOptions[axis].includes(a[axis]))throw Error('Invalid anchor.');for(const key of ['offsetX','offsetY'])if(!Number.isFinite(a[key])||Math.abs(a[key])>2000)throw Error('Invalid anchor offset.');for(const key of ['width','height'])if(!Number.isFinite(a[key])||a[key]<1||a[key]>2000)throw Error('Invalid fixed size.');if(typeof a.fixed!=='boolean')throw Error('Invalid sizing mode.');return a;}
function anchorBox(box,cw,ch,raw,minW=0,minH=0,fit=true){const a=validateConstraint(raw),w=Math.min(cw,a.fixed?Math.max(a.width,fit?minW:0):box.w),h=Math.min(ch,a.fixed?Math.max(a.height,fit?minH:0):box.h);const x=a.x==='left'?a.offsetX:a.x==='right'?cw-w-a.offsetX:a.x==='center'?(cw-w)/2+a.offsetX:box.x,y=a.y==='top'?a.offsetY:a.y==='bottom'?ch-h-a.offsetY:a.y==='center'?(ch-h)/2+a.offsetY:box.y;return {x:Math.max(0,Math.min(cw-w,x)),y:Math.max(0,Math.min(ch-h,y)),w,h};}
const options = {
  theme: ['parchment','kinetic','minimal','glass'], layout: ['bottom_adv','editorial_paper','cinematic_letterbox','floating_glass'],
  interaction: ['hybrid','free_text','strict_choices','kinetic_bubbles'], choice: ['tagged_pills','tilted_banners','editorial_cards','skill_check'],
  aiBar: ['bottom_bar','expandable_card','dual_toggle'], relationship: ['venus_hud','atmospheric_cues','dossier_notebook','hidden_immersive'],
  screen: ['choice_hub','dialogue','phone','map','clue_wheel','jukebox','dossier','rumors','flowchart'], device: ['desktop','tablet','phone'], sample: ['normal','long','many','unavailable','empty','loading','error'], navigation: ['dock','rail','compact']
};
const names = { date:'Date & semester', balance:'Balance', radar:'Stat radar', relationship:'Relationship summary', shop:'Shop', map:'Map', board:'Rumorboard', calendar:'Calendar', dialogue:'Dialogue frame', choices:'Choice & response panel', panel:'Screen content', utilities:'Quick-menu icons' };
const appearanceOptions={shape:['auto','calendar','receipt','record','dossier','notebook','tab','ticket','glass','frameless','pennant','shield'],font:['auto','serif','sans','mono'],texture:['auto','plain','ruled','linen'],icon:['auto','none','moon','wallet','spark','heart','map','shop','board','calendar','phone','music','book','arrow']};
const componentShapes={date:'calendar',balance:'receipt',radar:'record',relationship:'dossier',shop:'tab',map:'tab',board:'tab',calendar:'tab',dialogue:'notebook',choices:'notebook',panel:'dossier',utilities:'glass'};
Object.assign(names,Object.fromEntries(Object.entries(utilityInfo).map(([id,[label]])=>['tool_'+id,label+' button'])));
Object.assign(componentShapes,Object.fromEntries(Object.keys(utilityInfo).map(id=>['tool_'+id,'frameless'])));
function appearanceDefaults(id){return {shape:'auto',font:'auto',fontSize:100,padding:['date','balance','shop','map','board','calendar'].includes(id)?6:10,border:1,background:'auto',ink:'auto',icon:'auto',texture:'auto',fit:true,frame:'',slice:20};}
// Player art contract (ui-art.mjs): '' or an uploaded project media path only; Studio converts Wizard data URIs on import.
function validateFrame(value){if(value!==''&&!(typeof value==='string'&&/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value)))throw Error('Artwork must be uploaded project media (scenario-media PNG, JPEG or WebP); embedded, external or path-traversal art is refused.');return value;}
function validateAppearance(a){
  if(!a||typeof a!=='object')throw Error('Invalid component appearance.');const out={};
  for(const [field,values] of Object.entries(appearanceOptions)){if(!values.includes(a[field]))throw Error('Invalid component '+field+'.');out[field]=a[field];}
  for(const [field,min,max] of [['fontSize',75,150],['padding',0,24],['border',0,3],['slice',0,45]]){if(!Number.isFinite(a[field])||a[field]<min||a[field]>max)throw Error('Invalid component '+field+'.');out[field]=a[field];}
  for(const field of ['background','ink']){if(a[field]!=='auto'&&(typeof a[field]!=='string'||!/^#[0-9a-f]{6}$/i.test(a[field])))throw Error('Invalid component color.');out[field]=a[field];}
  if(typeof a.fit!=='boolean')throw Error('Invalid content-fit setting.');out.fit=a.fit;out.frame=validateFrame(a.frame);return out;
}
function fitBox(w,cw,ch,minW,minH,fit=true){const width=Math.min(cw,Math.max(cw*w.w/100,fit?minW:0)),height=Math.min(ch,Math.max(ch*w.h/100,fit?minH:0));return {x:Math.max(0,Math.min(cw-width,cw*w.x/100)),y:Math.max(0,Math.min(ch-height,ch*w.y/100)),w:width,h:height};}
const box = (x,y,w,h,z=10) => ({x,y,w,h,z,visible:true,locked:false});
const defaults = {
  date:box(3,4,23,18), balance:box(80,4,17,18), radar:box(79,26,18,29), relationship:box(31,4,39,15),
  shop:box(71,76,12,10), map:box(85,76,12,10), board:box(71,88,12,10), calendar:box(85,88,12,10),
  utilities:box(3,25,64,12,30), dialogue:box(3,60,66,36,20), choices:box(3,48,63,48,20), panel:box(12,24,63,71,20)
};
function splitUtilities(device,bar){const cols=device==='phone'?5:9,rows=device==='phone'?2:1,w=Math.max(5,(bar.w-(cols-1)*1)/cols),h=Math.max(4,(bar.h-(rows-1)*1)/rows);return Object.fromEntries(Object.keys(utilityInfo).map((id,i)=>['tool_'+id,{x:Math.min(100-w,bar.x+(i%cols)*(w+1)),y:Math.min(100-h,bar.y+Math.floor(i/cols)*(h+1)),w,h,z:bar.z,visible:true,locked:false}]));}
Object.assign(defaults,splitUtilities('desktop',defaults.utilities));
const clone = x => JSON.parse(JSON.stringify(x));
function deviceDefaults(device) {
  const ws=clone(defaults);
  if(device==='phone')Object.assign(ws,{utilities:box(3,23,94,17,30),date:box(3,3,61,8),balance:box(68,3,29,8),relationship:box(3,13,94,7),radar:{...box(69,23,28,18),visible:false},shop:box(3,90,22,7),map:box(27,90,22,7),board:box(51,90,22,7),calendar:box(75,90,22,7),dialogue:box(3,60,94,28,20),choices:box(3,54,94,34,20),panel:box(3,23,94,65,20)});
  if(device==='tablet'){ws.dialogue=box(3,65,72,31,20);ws.choices=box(3,53,66,43,20);ws.panel=box(9,19,70,72,20);}
  Object.assign(ws,splitUtilities(device,ws.utilities));
  return ws;
}
function createState() { return {version:1,theme:'parchment',layout:'bottom_adv',interaction:'hybrid',choice:'tagged_pills',aiBar:'bottom_bar',relationship:'venus_hud',screen:'choice_hub',device:'desktop',sample:'normal',navigation:'dock',accent:'#caa76a',textSize:18,opacity:96,radius:4,snap:true,smartSnap:true,showGuides:true,showOverlaps:false,reducedMotion:false,widgets:clone(defaults),layouts:{desktop:clone(defaults),tablet:deviceDefaults('tablet'),phone:deviceDefaults('phone')},constraints:Object.fromEntries(options.device.map(device=>[device,Object.fromEntries(Object.keys(names).map(id=>[id,constraintDefaults()]))])),utilities:utilityDefaults(),buttons:Object.fromEntries(buttonIds.map(id=>[id,buttonDefaults(id)])),presets:[],appearance:Object.fromEntries(Object.keys(names).map(id=>[id,appearanceDefaults(id)]))}; }
function validateState(raw) {
  if (!raw || typeof raw !== 'object' || raw.version !== 1) throw Error('Unsupported layout version. Use a version 1 Studio export.');
  const s = createState();
  for (const [key, values] of Object.entries(options)) { if (!values.includes(raw[key])) throw Error('Invalid ' + key + ' setting.'); s[key] = raw[key]; }
  if (typeof raw.accent !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.accent)) throw Error('Invalid accent color.'); s.accent = raw.accent;
  for (const [key,min,max] of [['textSize',14,28],['opacity',40,100],['radius',0,28]]) { if (!Number.isFinite(raw[key]) || raw[key] < min || raw[key] > max) throw Error('Invalid ' + key + '.'); s[key] = raw[key]; }
  for (const key of ['snap','reducedMotion']) { if (typeof raw[key] !== 'boolean') throw Error('Invalid '+key+'.'); s[key] = raw[key]; }
  function validateWidgets(rawWidgets,device=raw.device) {
   const widgets={};
   for (const id of Object.keys(defaults)) {
    const w = rawWidgets?.[id]||(id==='utilities'?deviceDefaults(device).utilities:id.startsWith('tool_')?splitUtilities(device,rawWidgets?.utilities||deviceDefaults(device).utilities)[id]:null); if (!w) throw Error('Missing widget: ' + id);
    for (const key of ['x','y','w','h','z']) if (!Number.isFinite(w[key])) throw Error('Invalid widget geometry.');
    if (w.x < 0 || w.y < 0 || w.w < 5 || w.h < 4 || w.x + w.w > 100.001 || w.y + w.h > 100.001 || w.z < 0 || w.z > 1000) throw Error('Widget outside canvas bounds.');
    if (typeof w.visible !== 'boolean' || typeof w.locked !== 'boolean') throw Error('Invalid widget visibility or lock.');
    widgets[id] = Object.fromEntries(['x','y','w','h','z','visible','locked'].map(k=>[k,w[k]]));
   }
   return widgets;
  }
  s.widgets=validateWidgets(raw.widgets);
  if(raw.layouts)for(const device of options.device)s.layouts[device]=validateWidgets(raw.layouts[device],device);
  if(raw.appearance)for(const id of Object.keys(names))s.appearance[id]=validateAppearance({...appearanceDefaults(id),...raw.appearance[id]});
  for(const key of ['smartSnap','showGuides','showOverlaps']){if(raw[key]!==undefined&&typeof raw[key]!=='boolean')throw Error('Invalid layout helper setting.');if(raw[key]!==undefined)s[key]=raw[key];}
  for(const device of options.device)for(const id of Object.keys(names))s.constraints[device][id]=validateConstraint(raw.constraints?.[device]?.[id]);
  s.utilities=validateUtilities(raw.utilities);
  for(const id of buttonIds){const old=raw.buttons?.[id]||(!id.startsWith('tool_')?{...buttonDefaults(id),display:raw.navigation==='compact'?'icon':'both',orientation:raw.navigation==='rail'?'vertical':'horizontal'}:undefined);s.buttons[id]=validateButton(old,id);}s.presets=validatePresets(raw.presets);
  if(raw.liveBindings!==undefined)s.liveBindings=validateBindings(raw.liveBindings);
  return s;
}
const units='percent of canvas; top-left origin';
const coreIds=['date','dialogue','choices','utilities','tool_history','tool_save','tool_load','tool_settings','tool_planner','tool_updates','tool_location','map','calendar'];
function safeConfig(value,key='config',path=key){
 if(typeof value==='number'&&!Number.isFinite(value))throw Error('Nonfinite configuration value.');
 const parts=path.split('.'),text=parts.length===4&&parts[0]==='config'&&((parts[1]==='utilities'&&Object.hasOwn(utilityInfo,parts[2])&&parts[3]==='label')||(parts[1]==='presets'&&/^\d+$/.test(parts[2])&&parts[3]==='name'));
 if(typeof value==='string'&&(/[<>\x00-\x1f]/.test(value)||(!text&&/javascript:|data:|https?:|url\(|@import|\.\.[/\\]/i.test(value))))throw Error('Unsafe configuration value.');
 if(value&&typeof value==='object'){
  if(Array.isArray(value)){if(key!=='presets')throw Error('Invalid configuration array.');}
  else if(Object.getPrototypeOf(value)!==Object.prototype&&Object.getPrototypeOf(value)!==null)throw Error('Invalid configuration object.');
  for(const [k,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe configuration key.');safeConfig(v,k,path+'.'+k);}
 }else if(value!==null&&!['string','number','boolean','undefined'].includes(typeof value))throw Error('Invalid configuration value.');
}
export function validateSkinExport(raw){
 try {
  if(typeof raw==='string')raw=JSON.parse(raw);
  if(!raw||Array.isArray(raw)||typeof raw!=='object'||raw.format!=='vn-ui-studio'||raw.version!==1)throw Error('Unsupported skin format/version.');
  if(raw.units!==units)throw Error('Unsupported skin units.');
  safeConfig(raw.config);const config=structuredClone(validateState(raw.config));
  const css=`:root { --ui-accent: ${config.accent}; --ui-text-size: ${config.textSize}px; --ui-radius: ${config.radius}px; --ui-panel-opacity: ${config.opacity / 100}; }`;
  if(typeof raw.css!=='string'||(raw.css!==''&&raw.css!==css))throw Error('Unsupported raw CSS; only the Studio token export is accepted and discarded.');
  const warnings=['Raw CSS discarded; consume validated tokens only.','Optional widgets remain unbound: '+Object.keys(defaults).filter(id=>!coreIds.includes(id)&&!config.liveBindings?.[id]).join(', '),'Input shares choices geometry; feedback shares dialogue geometry (no separate Studio widgets).'];
  return {ok:true,skin:{format:'vn-ui-studio',version:1,units,config,css:''},warnings,error:null};
 }catch(e){return {ok:false,skin:null,warnings:[],error:e instanceof Error?e.message:'Invalid skin export.'};}
}
export function resolveSkinLayout(skin,{width,height,device}={}){
 const invalid=error=>({ok:false,device:null,widgets:{},bindings:{},styles:null,warnings:[],error});
 const r=validateSkinExport(skin);if(!r.ok)return invalid(r.error);
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return invalid('Invalid stage dimensions.');
 if(device===undefined)return invalid('device-required: Studio defines no viewport breakpoints.');
 if(!options.device.includes(device))return invalid('Unsupported device.');
 const s=r.skin.config,ws=device===s.device?s.widgets:s.layouts[device],widgets={},bindings={};
 for(const id of [...new Set([...coreIds,...Object.keys(s.liveBindings||{})])]){const w=ws[id];if(!w.visible||(id.startsWith('tool_')&&(!ws.utilities.visible||!s.utilities[id.slice(5)].visible)))continue;widgets[id]={rect:anchorBox(fitBox(w,width,height,0,0,s.appearance[id].fit),width,height,s.constraints[device][id]),z:w.z,appearance:clone(s.appearance[id]),...(s.buttons[id]?{button:clone(s.buttons[id])}:{}),...(id.startsWith('tool_')?{utility:clone(s.utilities[id.slice(5)])}:{})};}
 for(const [binding,id] of [['dialogue','dialogue'],['input','choices'],['clock/location','date'],['feedback','dialogue']])if(widgets[id])bindings[binding]=id;
 bindings.navigation=coreIds.filter(id=>widgets[id]&&(id.startsWith('tool_')||['map','calendar'].includes(id)));
 return {ok:true,device,widgets,bindings,styles:{theme:s.theme,layout:s.layout,interaction:s.interaction,choice:s.choice,aiBar:s.aiBar,navigation:s.navigation,accent:s.accent,textSize:s.textSize,opacity:s.opacity,radius:s.radius,reducedMotion:s.reducedMotion,sample:s.sample},warnings:r.warnings,error:null};
}
function sourcePath(source){if(typeof source!=='string'||source.length>240||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(source))throw Error('Skin source must be a root-relative same-origin JSON path without traversal, escapes, query or fragment.');return source;}
export async function loadSkin(selection,{fetchJson,legacy=null}={}){
 const fallback=diagnostic=>({mode:'legacy',skin:null,legacy,diagnostic,warnings:[]});
 try {
  if(!selection)return fallback('Missing skin selection.');
  if(selection.version!==1)throw Error('Unsupported selection version.');
  if(selection.mode==='legacy'){if('export' in selection||'source' in selection)throw Error('Ambiguous legacy selection.');return fallback('Explicit legacy selection.');}
  if(selection.mode!=='wizard')throw Error('Unsupported selection mode.');
  const inline='export' in selection,source='source' in selection;if(inline===source)throw Error('Choose exactly one inline export or source.');
  let raw=selection.export;if(source){const path=sourcePath(selection.source);if(typeof fetchJson!=='function')throw Error('Missing skin fetchJson adapter.');raw=await fetchJson(path);}
  const r=validateSkinExport(raw);if(!r.ok)throw Error(r.error);return {mode:'wizard',skin:r.skin,legacy:null,diagnostic:null,warnings:r.warnings};
 }catch(e){return fallback(e instanceof Error?e.message:'Skin load failed.');}
}
