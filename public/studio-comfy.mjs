// Studio: "Generate with ComfyUI" beside an image slot, and a per-character batch (sprite set + sex scene CGs).
// Takes live in `takes` across Studio re-renders; picking one runs it through the same preparation + asset upload as a file upload.
import {BATCH_EMOTIONS,DEFAULT_ART} from './art-prompt.mjs';
export const takes=new Map();
const mini=p=>({artStyle:p?.artStyle,playerId:p?.playerId,actors:(p?.actors||[]).filter(a=>a.id===p.playerId).map(a=>({id:a.id,pronouns:a.pronouns}))});
export const blobOf=data=>{const [head,b64]=data.split(','),bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new Blob([u],{type:head.slice(5,head.indexOf(';'))});};
// d = {node,api,render,message,preparedImage,sleep,url}: injected so tests run without a browser.
// Progress goes straight to the live note: render() replaced the box this click came from.
const say=(id,st,text)=>{st.note=text;const n=globalThis.document?.querySelector(`[data-comfy-slot="${CSS.escape(id)}"] .asset-hint`);if(n)n.textContent=text;};
export async function poll(d,id,onTick){for(;;){const j=await d.api('/api/studio/comfy/job?id='+encodeURIComponent(id));onTick?.(j);if(j.status!=='running')return j;await d.sleep(1500);}}
export async function insert(d,data,assetKind){const blob=blobOf(data),file=new File([blob],'comfy.png',{type:blob.type}),prepared=await d.preparedImage(file,assetKind);return (await d.api('/api/studio/asset',{data:prepared,kind:assetKind})).path;}
// slot = {id,kind:'character'|'cg'|'background',obj,key,assetKind,actor?,location?,scene?,emotion?,outfit?}
export function comfyGen(parent,p,slot,d){const box=d.node('div');box.className='comfy-gen';box.dataset.comfySlot=slot.id;const st=takes.get(slot.id)||{extra:'',count:slot.kind==='character'?2:3};takes.set(slot.id,st);
 const extra=d.node('input');extra.placeholder=slot.kind==='cg'?'Extra tags: position, place, mood…':'Extra tags (optional)';extra.value=st.extra;extra.oninput=()=>{st.extra=extra.value;};
 const btn=d.node('button',st.status==='running'?'Generating…':'Generate with ComfyUI');btn.type='button';btn.dataset.action='comfy-generate';btn.disabled=st.status==='running';const note=d.node('small',st.note||'');note.className='asset-hint';
 btn.onclick=async()=>{st.status='running';st.results=[];st.note='Sending to ComfyUI…';d.render();try{const j0=await d.api('/api/studio/comfy/generate',{kind:slot.kind,pack:mini(p),actor:slot.actor,location:slot.location,scene:slot.scene,emotion:slot.emotion,outfit:slot.outfit,extra:st.extra,takes:st.count});
  const j=await poll(d,j0.id,j=>say(slot.id,st,`Rendering ${j.done}/${j.total}…`));st.status=j.status;st.results=j.results;st.note=j.status==='error'?j.error:'Pick a take to insert it.';}catch(e){st.status='error';st.note=e.message;}d.render();};
 box.append(btn,extra,note);
 if(st.results?.length){const row=d.node('div');row.className='comfy-takes';for(const [i,t] of st.results.entries()){const b=d.node('button');b.type='button';b.dataset.action='comfy-pick';b.title='Insert take '+(i+1)+' (seed '+t.seed+')';const img=d.node('img');img.alt='Take '+(i+1);img.src=t.src||=d.url(t.data);b.append(img);
  b.onclick=async()=>{try{d.message('Inserting take…');slot.obj[slot.key]=await insert(d,t.data,slot.assetKind);st.results=[];st.note='Inserted take '+(i+1)+'.';d.render();d.message('Unsaved changes');}catch(e){d.message(e.message);}};row.append(b);}box.append(row);}
 parent.append(box);return box;}
// Whole character: neutral sprite -> portrait, other emotions -> pose variants (replacing same id), one CG per allowed sex scene.
export function applyBatch(p,o,results,paths){for(const [i,r] of results.entries()){const path=paths[i];if(!path)continue;const [k,v]=r.slot.split(':');
 if(k==='portrait')o.portrait=path;else if(k==='pose'){o.poses||=[];const x=o.poses.find(q=>q.id===v);if(x)x.image=path;else o.poses.push({id:v,image:path});}
 else if(k==='cg'){const sex=(p.intimacyProfiles||[]).find(q=>q.character===o.id);if(!sex)continue;sex.scenes||=[];let s=sex.scenes.find(q=>q.category===v);if(!s){s={category:v};sex.scenes.push(s);}s.cg=path;}}}
export function comfyBatch(parent,p,o,d){const id='batch:'+o.id,st=takes.get(id)||{emotions:[...BATCH_EMOTIONS],cgs:true};takes.set(id,st);const box=d.node('div');box.className='studio-card comfy-batch';box.dataset.comfySlot=id;
 box.append(d.node('strong','Render with ComfyUI'),d.node('small','One base frame, then a sprite per expression (neutral becomes the portrait, the rest pose variants) and a CG for each sex scene they allow. Replaces those images; Undo by uploading again.'));
 const sex=(p.intimacyProfiles||[]).find(q=>q.character===o.id),scenes=(sex?.allowedCategories||[]).map(c=>(p.intimacyCategories||[]).find(x=>x.id===c)).filter(Boolean).map(c=>({id:c.id,name:c.name||c.id}));
 const chips=d.node('div');chips.className='chip-row';for(const e of BATCH_EMOTIONS){const l=d.node('label'),c=d.node('input');c.type='checkbox';c.dataset.emotion=e;c.checked=st.emotions.includes(e);c.onchange=()=>{st.emotions=c.checked?[...st.emotions,e]:st.emotions.filter(x=>x!==e);l.classList?.toggle('on',c.checked);};l.className='chip check'+(c.checked?' on':'');l.append(c,d.node('span',e));chips.append(l);}box.append(chips);
 if(scenes.length){const l=d.node('label'),c=d.node('input');c.type='checkbox';c.dataset.field='cgs';c.checked=st.cgs;c.onchange=()=>{st.cgs=c.checked;};l.className='studio-field inline-check';l.append(c,d.node('span',`Sex scene CGs (${scenes.map(s=>s.name).join(', ')})`));box.append(l);}
 const note=d.node('small',st.note||'');note.className='asset-hint';const btn=d.node('button',st.status==='running'?'Rendering…':'Render sprite set'+(scenes.length?' + CGs':''));btn.type='button';btn.dataset.action='comfy-batch';btn.disabled=st.status==='running';
 btn.onclick=async()=>{st.status='running';st.note='Sending to ComfyUI…';d.render();try{const j0=await d.api('/api/studio/comfy/batch',{pack:mini(p),actor:o,emotions:st.emotions,scenes:st.cgs?scenes:[]});
  const j=await poll(d,j0.id,j=>say(id,st,`Rendering ${j.done}/${j.total}…`));if(j.status==='error')throw Error(j.error);say(id,st,'Inserting…');
  const paths=[];for(const r of j.results)paths.push(await insert(d,r.data,r.slot.startsWith('cg:')?'background':'character'));applyBatch(p,o,j.results,paths);st.status='done';st.note=`Inserted ${paths.length} images.`;d.message('Unsaved changes');}catch(e){st.status='error';st.note=e.message;}d.render();};
 box.append(btn,note);artStyleFields(box,p,d);parent.append(box);return box;}
// Project-wide look shared by every render (blank = the default anime style). Stored on pack.artStyle.
export function artStyleFields(parent,p,d){const det=d.node('details');det.className='comfy-style';det.append(d.node('summary','Art style (whole project)'));for(const [k,label,ph] of [['style','Style tags',DEFAULT_ART.style],['negative','Never draw (tags)',DEFAULT_ART.negative]]){const l=d.node('label'),i=d.node('textarea');l.className='studio-field';i.dataset.artStyle=k;i.placeholder=ph;i.value=p.artStyle?.[k]||'';i.oninput=()=>{p.artStyle||={};if(i.value.trim())p.artStyle[k]=i.value;else{delete p.artStyle[k];if(!Object.keys(p.artStyle).length)delete p.artStyle;}d.message('Unsaved changes');};l.append(d.node('span',label),i);det.append(l);}parent.append(det);return det;}
