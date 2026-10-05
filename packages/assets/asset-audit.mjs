import {projectMediaPath} from './project-media.mjs';

// Read-only asset usage report: where a pack references images, what owns each file, and which
// references or files are missing, invalid, unreferenced or simply undetermined. Pure: every file
// or media lookup is injected, so running a report can never change anything.
const staticPath=p=>/^assets\/[a-zA-Z0-9/_-]+\.(svg|png|jpg|webp)$/.test(p);
const pathProblem=p=>{if(typeof p!=='string'||!p)return 'Asset path is missing or not a string';if(projectMediaPath(p)||staticPath(p))return null;if(p.startsWith('scenario-media/')||p.startsWith('assets/'))return 'Asset path does not match the accepted formats (scenario-media/<uuid>.png|jpg|webp or assets/<name>.svg|png|jpg|webp)';return 'Unsupported asset path; use assets/… or scenario-media/…';};
const mimeOf=p=>p.endsWith('.jpg')?'image/jpeg':p.endsWith('.png')?'image/png':p.endsWith('.webp')?'image/webp':null;
const FIELD_KINDS={background:'background',portrait:'character',idleStill:'character',image:'character',idleAnimation:'animation',cg:'scene CG'};

export function assetReferences(pack){
 const refs=[],add=(owner,ref,field,path,section)=>refs.push({ref,field,kind:FIELD_KINDS[field]||null,path,owner,section});
 for(const [i,l] of (pack.locations||[]).entries())if(l?.background)add({type:'location',id:l?.id||String(i),name:l?.name||l?.id||`Location ${i+1}`,label:`${l?.name||l?.id||`Location ${i+1}`} — background`},`locations.${l?.id||i}.background`,'background',l.background,'Locations');
 for(const [i,a] of (pack.actors||[]).entries()){const id=a?.id||String(i),name=a?.name||a?.id||`Character ${i+1}`,at=`actors.${id}`;
  if(a?.portrait)add({type:'actor',id,name,label:`${name} — portrait`},`${at}.portrait`,'portrait',a.portrait,'Characters');
  if(a?.idleAnimation)add({type:'actor',id,name,label:`${name} — idle animation`},`${at}.idleAnimation`,'idleAnimation',a.idleAnimation,'Characters');
  if(a?.idleStill)add({type:'actor',id,name,label:`${name} — idle animation still`},`${at}.idleStill`,'idleStill',a.idleStill,'Characters');
  for(const [j,p] of (a?.poses||[]).entries())if(p?.image)add({type:'actor',id,name,label:`${name} — pose ${p?.id||j+1}`},`${at}.poses.${p?.id||j}.image`,'image',p.image,'Characters');
 }
 for(const [i,s] of (pack.scriptedScenes||[]).entries()){const id=s?.id||String(i),name=s?.title||s?.id||`Scene ${i+1}`,at=`scenes.${id}`;
  const addPage=(base,j,page)=>{if(page?.background)add({type:'scene',id,name,label:`${name} — page ${j+1} background`},`${base}.pages.${j}.background`,'background',page.background,'Scripted scenes');if(page?.cg)add({type:'scene',id,name,label:`${name} — page ${j+1} CG`},`${base}.pages.${j}.cg`,'cg',page.cg,'Scripted scenes');};
  if(s?.background)add({type:'scene',id,name,label:`${name} — scene background`},`${at}.background`,'background',s.background,'Scripted scenes');
  if(s?.cg)add({type:'scene',id,name,label:`${name} — scene CG`},`${at}.cg`,'cg',s.cg,'Scripted scenes');
  (s?.pages||[]).forEach((page,j)=>addPage(at,j,page));
  for(const [k,b] of (s?.beats||[]).entries()){const bt=`${at}.beats.${b?.id||k}`;
   if(b?.background)add({type:'scene',id,name,label:`${name} — beat ${b?.id||k+1} background`},`${bt}.background`,'background',b.background,'Scripted scenes');
   if(b?.cg)add({type:'scene',id,name,label:`${name} — beat ${b?.id||k+1} CG`},`${bt}.cg`,'cg',b.cg,'Scripted scenes');
   (b?.pages||[]).forEach((page,j)=>addPage(bt,j,page));
  }
 }
 for(const [i,f] of (pack.firsts||[]).entries())if(f?.cg)add({type:'first',id:f?.id||String(i),name:f?.title||f?.id||`First ${i+1}`,label:`${f?.title||f?.id||`First ${i+1}`} — CG`},`firsts.${f?.id||i}.cg`,'cg',f.cg,null);
 return refs;
}

export function assetAudit(pack,{media=null,probe,listMedia=[],listStatic=[]}={}){
 const refs=assetReferences(pack),assets=new Map();
 const entry=path=>{let e=assets.get(path);if(!e)assets.set(path,e={path,type:path.startsWith('scenario-media/')?'project':path.startsWith('assets/')?'static':'external',status:'ok',source:null,owners:[],notes:[]});return e;};
 for(const r of refs){const e=entry(r.path);e.owners.push({label:r.owner.label,ref:r.ref,field:r.field,kind:r.kind,section:r.section});
  const problem=pathProblem(r.path);
  if(problem){if(e.status!=='invalid'){e.status='invalid';e.notes=[problem];}continue;}
  if(e.status==='invalid')continue;
  const found=probe?probe(r.path):null;
  if(!found){e.status='missing';continue;}
  e.source=found.source;if(found.note&&!e.notes.includes(found.note))e.notes.push(found.note);
 }
 for(const [path,asset] of Object.entries(media||{})){const e=entry(path),problem=pathProblem(path);
  if(problem){if(e.status!=='invalid'){e.status='invalid';e.notes=[problem];}continue;}
  const expected=mimeOf(path);if(asset&&expected&&asset.mime!==expected&&!e.notes.some(n=>n.includes('MIME')))e.notes.push('Embedded image MIME does not match its path');
  if(e.owners.length){if(e.status==='missing'){e.status='ok';e.source='embedded';}else e.source=e.source||'embedded';}
  else if(e.status==='ok'){e.status='unreferenced';e.source='embedded';}
 }
 for(const path of listMedia){const e=entry(path);if(!e.owners.length&&e.status==='ok'){e.status='unreferenced';e.source='uploaded';}else e.source=e.source||'uploaded';}
 for(const path of listStatic){const e=entry(path);if(!e.owners.length&&e.status==='ok'){e.status='undetermined';e.source='static';e.notes.push('No reference found in this project. It may still be used by the engine, player UI or code; this report alone does not make the file safe to remove.');}else e.source=e.source||'static';}
 const list=[...assets.values()].sort((a,b)=>a.type.localeCompare(b.type)||a.path.localeCompare(b.path));
 for(const e of list)if(e.owners.length>1)e.notes.push(`Shared by ${e.owners.length} fields.`);
 const count=status=>list.filter(e=>e.status===status).length,references=refs.map(r=>({...r,status:assets.get(r.path)?.status||'ok'}));
 return {references,assets:list,summary:{references:refs.length,assets:list.length,missing:count('missing'),invalid:count('invalid'),unreferenced:count('unreferenced'),undetermined:count('undetermined'),shared:list.filter(e=>e.owners.length>1).length}};
}
