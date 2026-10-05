// Studio "Asset usage" section: a read-only report of where the project references images
// (backgrounds, portraits, poses, idle animations, still fallbacks, scene CGs), which files are
// missing, invalid, unreferenced or of undetermined usage, and links to the owning editor.
// Scanning sends the current pack for analysis only; nothing is saved, uploaded or deleted.
export function mountAssetAudit(parent,{getPack,api,onStatus=()=>{},state={}}={}){
 const doc=parent.ownerDocument,node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 state.report??=null;
 const status=node('p');status.className='asset-audit-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const msg=t=>{status.textContent=t;onStatus(t);};
 const box=node('div');box.className='asset-audit-box';
 parent.append(status,box);
 const pack=()=>getPack()||{};
 const badge=s=>{const b=node('span',s);b.className=`asset-audit-badge status-${s}`;return b;};
 const thumb=path=>{const img=node('img');img.src=path;img.alt='';img.loading='lazy';return img;};
 const button=(label,work)=>{const b=node('button',label);b.type='button';b.onclick=async()=>{try{b.disabled=true;await work();}catch(e){msg(e.message);}finally{b.disabled=false;}};return b;};
 const reveal=owner=>{const host=[...doc.querySelectorAll('#fields details.studio-section')].find(d=>d.dataset.title===owner.section);
  if(!host)return msg(`No open editor for “${owner.section}”. Reopen the project editor and scan again.`);
  host.open=true;host.scrollIntoView({behavior:'smooth',block:'start'});
  const card=owner.path&&[...host.querySelectorAll('article img')].find(i=>i.getAttribute('src')===owner.path)?.closest('article')||[...host.querySelectorAll('article > h3')].find(h=>h.textContent===owner.name)?.parentElement;
  const target=card||host;target.scrollIntoView({behavior:'smooth',block:'center'});
  target.classList.remove('preview-target');target.classList.add('preview-target');setTimeout(()=>target.classList.remove('preview-target'),2500);
  msg(`Opened the ${owner.section} editor${card?' at this field’s card':''}.`);};
 const ownerRow=(asset,owner)=>{const row=node('div');row.className='asset-audit-owner';
  row.append(node('span',owner.label),node('code',owner.ref));
  if(owner.section){const go=node('button','Reveal');go.type='button';go.onclick=()=>reveal({...owner,name:owner.label.split(' — ')[0],path:asset.path});row.append(go);}
  else row.append(node('small','No dedicated editor; edit this CG in the project JSON.'));
  return row;};
 const assetCard=asset=>{const card=node('article');card.className=`studio-card asset-audit-asset status-${asset.status}`;
  const head=node('div');head.className='asset-audit-head';head.append(node('code',asset.path),badge(asset.status),
   node('small',`${asset.type==='project'?'project upload':asset.type==='static'?'static asset':'external'}${asset.source?` · ${asset.source}`:''}${asset.owners.length?` · ${asset.owners.length} owner${asset.owners.length===1?'':'s'}`:''}`));
  if(asset.status==='ok'||asset.status==='undetermined'||asset.status==='unreferenced')head.append(thumb(asset.path));
  card.append(head);
  for(const note of asset.notes)card.append(node('p',note));
  if(asset.status==='missing')card.append(node('p','Missing: this field points at a file that is neither embedded nor stored in the project media folder.'));
  if(!asset.owners.length)card.append(node('p',asset.status==='undetermined'?'Usage cannot be determined from the project alone.':'No field in this project references this file.'));
  for(const owner of asset.owners)card.append(ownerRow(asset,owner));
  return card;};
 const group=(title,assets)=>{if(!assets.length)return;const wrap=node('div');wrap.append(node('h3',title));for(const asset of assets)wrap.append(assetCard(asset));box.append(wrap);};
 function render(){
  box.replaceChildren();
  const run=button(state.report?'↻ Scan again':'Scan asset usage',async()=>{state.report=await api('/api/studio/assets/report',{pack:pack()});render();
   const s=state.report.summary;msg(`Scanned ${s.references} field reference${s.references===1?'':'s'} across ${s.assets} asset${s.assets===1?'':'s'}: ${s.missing} missing, ${s.invalid} invalid, ${s.unreferenced} unreferenced, ${s.undetermined} undetermined, ${s.shared} shared. Nothing was changed.`);});
  box.append(run);
  const r=state.report;if(!r){box.append(node('p','Scans the current unsaved project state and this computer’s stored project media. Read-only: the scan never edits the project, its files or its saves.'));return;}
  const s=r.summary,by=s2=>r.assets.filter(a=>a.status===s2),ok=r.assets.filter(a=>a.status==='ok'&&a.owners.length);
  box.append(node('p',`${s.references} referenced field${s.references===1?'':'s'} · ${s.assets} distinct asset${s.assets===1?'':'s'} · ${s.missing} missing · ${s.invalid} invalid · ${s.unreferenced} unreferenced · ${s.undetermined} undetermined · ${s.shared} shared`));
  group('Missing references',by('missing'));
  group('Invalid references',by('invalid'));
  group('Shared assets (every owner listed)',ok.filter(a=>a.owners.length>1));
  group('Project uploads no field references',by('unreferenced').filter(a=>a.type==='project'));
  group('Static assets with undetermined usage',by('undetermined'));
  group('Referenced assets',ok.filter(a=>a.owners.length===1));
 }
 render();
 return {render};
}
