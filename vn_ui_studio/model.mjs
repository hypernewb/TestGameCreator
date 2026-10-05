import {validateBindings} from './live-bindings.mjs';
import {constraintDefaults,validateConstraint} from './responsive.mjs';
import {buttonIds,buttonDefaults,validateButton,validatePresets} from './buttons.mjs';
import {utilityDefaults,validateUtilities,utilityInfo} from './utilities.mjs';
export const options = {
  theme: ['parchment','kinetic','minimal','glass'], layout: ['bottom_adv','editorial_paper','cinematic_letterbox','floating_glass'],
  interaction: ['hybrid','free_text','strict_choices','kinetic_bubbles'], choice: ['tagged_pills','tilted_banners','editorial_cards','skill_check'],
  aiBar: ['bottom_bar','expandable_card','dual_toggle'], relationship: ['venus_hud','atmospheric_cues','dossier_notebook','hidden_immersive'],
  screen: ['choice_hub','dialogue','phone','map','clue_wheel','jukebox','dossier','rumors','flowchart'], device: ['desktop','tablet','phone'], sample: ['normal','long','many','unavailable','empty','loading','error'], navigation: ['dock','rail','compact']
};
export const names = { date:'Date & semester', balance:'Balance', radar:'Stat radar', relationship:'Relationship summary', shop:'Shop', map:'Map', board:'Rumorboard', calendar:'Calendar', dialogue:'Dialogue frame', choices:'Choice & response panel', panel:'Screen content', utilities:'Quick-menu icons' };
export const appearanceOptions={shape:['auto','calendar','receipt','record','dossier','notebook','tab','ticket','glass','frameless','pennant','shield'],font:['auto','serif','sans','mono'],texture:['auto','plain','ruled','linen'],icon:['auto','none','moon','wallet','spark','heart','map','shop','board','calendar','phone','music','book','arrow']};
export const componentShapes={date:'calendar',balance:'receipt',radar:'record',relationship:'dossier',shop:'tab',map:'tab',board:'tab',calendar:'tab',dialogue:'notebook',choices:'notebook',panel:'dossier',utilities:'glass'};
Object.assign(names,Object.fromEntries(Object.entries(utilityInfo).map(([id,[label]])=>['tool_'+id,label+' button'])));
Object.assign(componentShapes,Object.fromEntries(Object.keys(utilityInfo).map(id=>['tool_'+id,'frameless'])));
export function appearanceDefaults(id){return {shape:'auto',font:'auto',fontSize:100,padding:['date','balance','shop','map','board','calendar'].includes(id)?6:10,border:1,background:'auto',ink:'auto',icon:'auto',texture:'auto',fit:true,frame:'',slice:20};}
export function validateFrame(value){
  if(value===''||typeof value==='string'&&/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(value))return value;
  if(typeof value!=='string'||value.length>240000||!/^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/.test(value))throw Error('Use a PNG or SVG frame smaller than 175 KB.');
  const bytes=typeof Buffer!=='undefined'?Buffer.from(value.split(',')[1],'base64'):Uint8Array.from(atob(value.split(',')[1]),c=>c.charCodeAt(0));
  if(value.startsWith('data:image/png;')){if(![137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))throw Error('Invalid PNG frame.');}
  else {const svg=new TextDecoder().decode(bytes);if(!/<svg\b/i.test(svg)||/<!DOCTYPE|<!ENTITY|<script|<foreignObject|\bon\w+\s*=|(?:href|xlink:href)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)|@import/i.test(svg))throw Error('Use a self-contained SVG without scripts or external resources.');}
  return value;
}
export function validateAppearance(a){
  if(!a||typeof a!=='object')throw Error('Invalid component appearance.');const out={};
  for(const [field,values] of Object.entries(appearanceOptions)){if(!values.includes(a[field]))throw Error('Invalid component '+field+'.');out[field]=a[field];}
  for(const [field,min,max] of [['fontSize',75,150],['padding',0,24],['border',0,3],['slice',0,45]]){if(!Number.isFinite(a[field])||a[field]<min||a[field]>max)throw Error('Invalid component '+field+'.');out[field]=a[field];}
  for(const field of ['background','ink']){if(a[field]!=='auto'&&(typeof a[field]!=='string'||!/^#[0-9a-f]{6}$/i.test(a[field])))throw Error('Invalid component color.');out[field]=a[field];}
  if(typeof a.fit!=='boolean')throw Error('Invalid content-fit setting.');out.fit=a.fit;out.frame=validateFrame(a.frame);return out;
}
export function setAppearance(s,id,field,value){if(!names[id]||!(field in appearanceDefaults(id)))throw Error('Unknown component property.');s.appearance[id]=validateAppearance({...s.appearance[id],[field]:value});}
export function resetAppearance(s,id){s.appearance[id]=appearanceDefaults(id);}
export function fitBox(w,cw,ch,minW,minH,fit=true){const width=Math.min(cw,Math.max(cw*w.w/100,fit?minW:0)),height=Math.min(ch,Math.max(ch*w.h/100,fit?minH:0));return {x:Math.max(0,Math.min(cw-width,cw*w.x/100)),y:Math.max(0,Math.min(ch-height,ch*w.y/100)),w:width,h:height};}
const box = (x,y,w,h,z=10) => ({x,y,w,h,z,visible:true,locked:false});
export const defaults = {
  date:box(3,4,23,18), balance:box(80,4,17,18), radar:box(79,26,18,29), relationship:box(31,4,39,15),
  shop:box(71,76,12,10), map:box(85,76,12,10), board:box(71,88,12,10), calendar:box(85,88,12,10),
  utilities:box(3,25,64,12,30), dialogue:box(3,60,66,36,20), choices:box(3,48,63,48,20), panel:box(12,24,63,71,20)
};
export function splitUtilities(device,bar){const cols=device==='phone'?5:9,rows=device==='phone'?2:1,w=Math.max(5,(bar.w-(cols-1)*1)/cols),h=Math.max(4,(bar.h-(rows-1)*1)/rows);return Object.fromEntries(Object.keys(utilityInfo).map((id,i)=>['tool_'+id,{x:Math.min(100-w,bar.x+(i%cols)*(w+1)),y:Math.min(100-h,bar.y+Math.floor(i/cols)*(h+1)),w,h,z:bar.z,visible:true,locked:false}]));}
Object.assign(defaults,splitUtilities('desktop',defaults.utilities));
export const clone = x => JSON.parse(JSON.stringify(x));
export function deviceDefaults(device) {
  const ws=clone(defaults);
  if(device==='phone')Object.assign(ws,{utilities:box(3,23,94,17,30),date:box(3,3,61,8),balance:box(68,3,29,8),relationship:box(3,13,94,7),radar:{...box(69,23,28,18),visible:false},shop:box(3,90,22,7),map:box(27,90,22,7),board:box(51,90,22,7),calendar:box(75,90,22,7),dialogue:box(3,60,94,28,20),choices:box(3,54,94,34,20),panel:box(3,23,94,65,20)});
  if(device==='tablet'){ws.dialogue=box(3,65,72,31,20);ws.choices=box(3,53,66,43,20);ws.panel=box(9,19,70,72,20);}
  Object.assign(ws,splitUtilities(device,ws.utilities));
  return ws;
}
export function createState() { return {version:1,theme:'parchment',layout:'bottom_adv',interaction:'hybrid',choice:'tagged_pills',aiBar:'bottom_bar',relationship:'venus_hud',screen:'choice_hub',device:'desktop',sample:'normal',navigation:'dock',accent:'#caa76a',textSize:18,opacity:96,radius:4,snap:true,smartSnap:true,showGuides:true,showOverlaps:false,reducedMotion:false,widgets:clone(defaults),layouts:{desktop:clone(defaults),tablet:deviceDefaults('tablet'),phone:deviceDefaults('phone')},constraints:Object.fromEntries(options.device.map(device=>[device,Object.fromEntries(Object.keys(names).map(id=>[id,constraintDefaults()]))])),utilities:utilityDefaults(),buttons:Object.fromEntries(buttonIds.map(id=>[id,buttonDefaults(id)])),presets:[],appearance:Object.fromEntries(Object.keys(names).map(id=>[id,appearanceDefaults(id)]))}; }
export function validateState(raw) {
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
const clamp = (n,min,max) => Math.max(min, Math.min(max,n));
export function moveWidget(w,x,y) { w.x = clamp(x,0,100-w.w); w.y = clamp(y,0,100-w.h); }
export function resizeWidget(w,width,height) { w.w = clamp(width,5,100-w.x); w.h = clamp(height,4,100-w.y); }
export function resetLayout(s,id) { for(const key of id?[id]:Object.keys(defaults))s.constraints[s.device][key]=constraintDefaults(); const base=deviceDefaults(s.device); for (const k of id ? [id] : Object.keys(defaults)) Object.assign(s.widgets[k],base[k],{visible:s.widgets[k].visible,locked:s.widgets[k].locked}); }
export function switchDevice(s,device) { if(!options.device.includes(device))throw Error('Unknown device.'); s.layouts[s.device]=clone(s.widgets);s.device=device;s.widgets=clone(s.layouts[device]); }
export function applyPreset(s,preset) {
  const sets = { classic:{theme:'parchment',screen:'dialogue',layout:'bottom_adv',interaction:'strict_choices',choice:'editorial_cards',relationship:'dossier_notebook'}, minimal:{theme:'minimal',screen:'choice_hub',layout:'bottom_adv',interaction:'hybrid',choice:'tagged_pills',relationship:'hidden_immersive'}, phone:{theme:'glass',screen:'phone',layout:'floating_glass',interaction:'free_text',choice:'tagged_pills',relationship:'dossier_notebook'}, dashboard:{theme:'kinetic',screen:'choice_hub',layout:'cinematic_letterbox',interaction:'hybrid',choice:'tilted_banners',relationship:'venus_hud'} };
  if (!sets[preset]) throw Error('Unknown preset.'); Object.assign(s,sets[preset]); s.widgets=deviceDefaults(s.device);for(const id of Object.keys(defaults))s.constraints[s.device][id]=constraintDefaults();
}
export function screenWidgets(s) { return ['utilities',...Object.keys(utilityInfo).map(id=>'tool_'+id),'date','balance','radar',...(s.relationship === 'venus_hud' ? ['relationship'] : []),'shop','map','board','calendar',s.screen === 'choice_hub' ? 'choices' : s.screen === 'dialogue' ? 'dialogue' : 'panel'].filter(id=>s.widgets[id].visible&&(!id.startsWith('tool_')||(s.widgets.utilities.visible&&s.utilities[id.slice(5)].visible))); }
export function history(initial) {
  let list = [clone(initial)], i = 0;
  return {push(s) { const value=clone(s); if(JSON.stringify(value)===JSON.stringify(list[i]))return; list=list.slice(0,i+1); list.push(value); if(list.length>60)list.shift(); i=list.length-1; },undo() { if(i>0)i--; return clone(list[i]); },redo() { if(i<list.length-1)i++; return clone(list[i]); },canUndo:()=>i>0,canRedo:()=>i<list.length-1};
}
export function exportPackage(s) { const config = validateState(s); return {format:'vn-ui-studio',version:1,units:'percent of canvas; top-left origin',config,css:`:root { --ui-accent: ${s.accent}; --ui-text-size: ${s.textSize}px; --ui-radius: ${s.radius}px; --ui-panel-opacity: ${s.opacity / 100}; }`}; }

export function separateStack(top,bottom,ch,gap=6){top={...top};bottom={...bottom};if(top.x<bottom.x+bottom.w&&bottom.x<top.x+top.w&&top.y+top.h+gap>bottom.y&&top.y<bottom.y+bottom.h){if(top.y+top.h+gap+bottom.h<=ch)bottom.y=top.y+top.h+gap;else if(bottom.y-top.h-gap>=0)top.y=bottom.y-top.h-gap;}return [top,bottom];}

export function fitBelow(box,bar,ch,gap=6){if(box.x>=bar.x+bar.w||box.x+box.w<=bar.x||box.y>=bar.y+bar.h+gap)return {...box};const y=Math.min(ch-60,bar.y+bar.h+gap);return {...box,y,h:Math.min(box.h,ch-y)};}
