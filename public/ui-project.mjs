import {validateSkinExport,resolveSkinLayout} from './vn-skin.mjs';
import {validateProjectUi} from './ui-selection.mjs';
const base=()=>({version:1,selected:'legacy',options:[]}),clone=x=>structuredClone(x);
export function projectUiOptions(pack){const ui=validateProjectUi(pack.gameProject?.ui);return [{id:'legacy',label:'Legacy interface'},{id:'default',label:'Bundled interface (new default)'},...(ui?.options||[]).map(({id,label})=>({id,label}))];}
export function reviewWizardExport(raw,{id=globalThis.crypto.randomUUID(),label='Imported layout',fileName=''}={}){
 if(typeof raw==='string'&&raw.length>5000000)throw Error('Layout exceeds the server limit of 5,000,000 characters.');
 const r=validateSkinExport(raw);if(!r.ok)throw Error(r.error);const option={id,label,skin:{version:1,mode:'wizard',export:r.skin}};validateProjectUi({version:1,selected:id,options:[option]});return {option:clone(option),warnings:r.warnings.slice(),fileName:String(fileName)};
}
export function applyUiReview(pack,review){
 if(!review?.option)throw Error('Import and review a layout before Apply.');const ui=validateProjectUi(pack.gameProject?.ui)||base(),option=clone(review.option),existing=ui.options.find(x=>x.id===option.id);
 if(existing&&JSON.stringify(existing)!==JSON.stringify(option))throw Error('A different layout with this ID already exists; import it as a new option.');if(!existing)ui.options.push(option);ui.selected=option.id;const next=clone(pack);next.gameProject||={};next.gameProject.ui=validateProjectUi(ui);return next;
}
export function selectUiOption(pack,id){const ui=validateProjectUi(pack.gameProject?.ui)||base();ui.selected=id;const next=clone(pack);next.gameProject||={};next.gameProject.ui=validateProjectUi(ui);return next;}
export function mountUiProject(parent,{getPack,getProjectId=()=>'',onChange,onStatus=()=>{},state={review:null},makeId=()=>globalThis.crypto.randomUUID()}={}){
 state.request=(state.request||0)+1;state.loading=false;
 const doc=parent.ownerDocument,projectId=getProjectId(),active=()=>parent.isConnected&&getProjectId()===projectId,node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;},control=(tag,id)=>{const e=node(tag);e.id=id;return e;};
 const grid=node('div');grid.className='studio-grid';const select=control('select','ui-layout-select'),wrap=node('label');wrap.className='studio-field';wrap.append(node('span','Selected interface'),select);grid.append(wrap);
 const file=control('input','ui-layout-file');file.type='file';file.accept='.json,application/json';const fileWrap=node('label');fileWrap.className='studio-field';fileWrap.append(node('span','Import UI wizard JSON'),file);grid.append(fileWrap);
 const info=node('p','Export a layout from the existing UI wizard, then import its JSON here. Import only opens a review; Apply changes this unsaved project. Save draft to keep the selection.');info.className='muted';
 const compatibility=node('p','Classic keeps its current interface. Live-game layout bindings are pending; this diagram is not a live game. Player reading-font preferences remain independent.');compatibility.className='muted';
 const limit=node('p','The server accepts at most 5,000,000 characters per request, including the whole project and its UI options. Oversized projects cannot be saved; no options or assets are deleted automatically.');limit.className='muted';
 const status=control('p','ui-layout-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');const box=control('article','ui-layout-review');box.className='studio-card';
 const buttons=node('div');buttons.className='studio-toolbar';const apply=control('button','ui-layout-apply'),cancel=control('button','ui-layout-cancel');apply.type=cancel.type='button';apply.textContent='Apply layout';cancel.textContent='Cancel review';buttons.append(apply,cancel);parent.append(grid,info,compatibility,limit,status,box,buttons);
 const message=text=>{status.textContent=text;onStatus(text);};
 function choices(){try{select.replaceChildren();for(const choice of projectUiOptions(getPack())){const o=node('option',choice.label);o.value=choice.id;select.append(o);}select.value=getPack().gameProject?.ui?.selected||'legacy';select.disabled=file.disabled=false;}catch(e){select.disabled=file.disabled=true;message(e.message);}}
 function renderReview(){
  const review=state.review;box.hidden=!review;box.replaceChildren();apply.disabled=!review;cancel.disabled=!review&&!state.loading;if(!review)return;
  box.append(node('h3','Layout review'),node('p','File: '+review.fileName));const label=control('input','ui-layout-label');label.type='text';label.maxLength=64;label.value=review.option.label;const lw=node('label');lw.className='studio-field';lw.append(node('span','Layout option name'),label);box.append(lw);label.oninput=()=>{if(active())review.option.label=label.value;};
  const device=control('select','ui-layout-device'),dw=node('label');dw.className='studio-field';for(const id of ['desktop','tablet','phone']){const o=node('option',id);o.value=id;device.append(o);}device.value=state.device||'desktop';dw.append(node('span','Diagram device'),device);box.append(dw);
  const dims={desktop:[1440,900],tablet:[768,1024],phone:[390,844]},[width,height]=dims[device.value],layout=resolveSkinLayout(review.option.skin.export,{width,height,device:device.value});if(!layout.ok){apply.disabled=true;box.append(node('p',layout.error));return;}
  const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='ui-layout-diagram';svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',`${device.value} layout geometry diagram; no game data`);svg.style.width='100%';svg.style.maxWidth='720px';svg.style.height='auto';
  for(const [id,w] of Object.entries(layout.widgets)){const rect=doc.createElementNS('http://www.w3.org/2000/svg','rect');for(const [key,value] of Object.entries({x:w.rect.x,y:w.rect.y,width:w.rect.w,height:w.rect.h,fill:'none',stroke:'currentColor','stroke-width':2}))rect.setAttribute(key,value);const text=doc.createElementNS('http://www.w3.org/2000/svg','text');text.setAttribute('x',w.rect.x+4);text.setAttribute('y',w.rect.y+16);text.setAttribute('fill','currentColor');text.setAttribute('font-size',12);text.textContent=id;svg.append(rect,text);}box.append(svg,node('p',`${width} × ${height} authoring stage; anchors use pixels. This is a geometry review, not gameplay fidelity.`));
  for(const warning of review.warnings)box.append(node('p',warning));device.onchange=()=>{if(active()){state.device=device.value;renderReview();}};
 }
 select.onchange=()=>{if(!active())return;try{onChange(selectUiOption(getPack(),select.value));choices();message('Interface choice changed. Save draft to keep it.');}catch(e){choices();message(e.message);}};
 file.onchange=async()=>{
  if(!active())return;const selected=file.files?.[0];if(!selected)return;const request=state.request=(state.request||0)+1;state.review=null;state.loading=true;renderReview();
  try{if(selected.size>5000000)throw Error('Choose a layout below the server limit of 5,000,000 characters.');const raw=await selected.text();if(!active()||state.request!==request)return;state.review=reviewWizardExport(raw,{id:makeId(),fileName:selected.name});message('Layout validated. Review its geometry and name before Apply.');}catch(e){if(active()&&state.request===request){state.review=null;message(e.message);}}finally{if(active()&&state.request===request){state.loading=false;file.value='';renderReview();}}
 };
 apply.onclick=()=>{if(!active()||!state.review)return;try{onChange(applyUiReview(getPack(),state.review));choices();message('Layout applied to this unsaved project. Save draft to persist it.');}catch(e){message(e.message);}};
 cancel.onclick=()=>{if(!active())return;state.request=(state.request||0)+1;state.review=null;state.loading=false;file.value='';renderReview();message('Layout review cancelled. Project unchanged.');file.focus();};choices();renderReview();
}
