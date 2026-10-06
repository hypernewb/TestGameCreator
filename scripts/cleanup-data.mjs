// Reviewable cleanup of local junk under data/ (and retired packs/after-hours*). Dry run by default; --apply moves.
// Never hard-deletes: files move into data/.trash-<date>/ (same relative layout), and campaigns.sqlite is copied there
// before any row is removed. Removed campaign rows are also written out as JSON next to a manifest. Never touches
// data/ai-settings.json. Stop the app (npm start / desktop) before --apply so nothing writes mid-cleanup.
// Usage: node scripts/cleanup-data.mjs [--apply] [--root <repo dir>] [--examples N]
import {readFileSync,readdirSync,existsSync,mkdirSync,renameSync,copyFileSync,writeFileSync,statSync} from 'node:fs';
import {resolve,relative,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {DatabaseSync} from 'node:sqlite';

const MEDIA=/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:png|jpg|webp)/g;
const json=f=>JSON.parse(readFileSync(f,'utf8'));
const jsonFiles=dir=>existsSync(dir)?readdirSync(dir).filter(f=>f.endsWith('.json')).map(f=>join(dir,f)):[];
const typedTurns=s=>Object.values(s.turns||{}).filter(t=>typeof t.input==='string'&&t.input.trim()).length;
const SKIP_DIRS=new Set(['.git','node_modules','.worktrees','data','.tools','artifacts']);
const walk=(dir,out=[])=>{for(const e of readdirSync(dir,{withFileTypes:true})){if(e.isDirectory()){if(!SKIP_DIRS.has(e.name))walk(join(dir,e.name),out);}else if(/\.(mjs|js|cjs|json|html|md)$/.test(e.name))out.push(join(dir,e.name));}return out;};

// The blank "Untitled game" pack, read from this repo's server.mjs so the comparison follows the live template.
const REPO=fileURLToPath(new URL('..',import.meta.url));
export async function blankTemplate(root=REPO){
  const m=readFileSync(resolve(root,'server.mjs'),'utf8').match(/const freshPack=\(\)=>(\(\{.*?\}\));\r?\n/);
  if(!m)throw new Error('freshPack not found in server.mjs');
  const {defaultProjectUi}=await import(pathToFileURL(resolve(root,'public/ui-selection.mjs')).href);
  return new Function('defaultProjectUi','return ()=>'+m[1])(defaultProjectUi)();
}
// Identical to the template; drafts saved before gameProject.ui existed (older template) count as blank too.
export const isBlank=(pack,fresh)=>{if(isDeepStrictEqual(pack,fresh))return 'exact';if(!pack?.gameProject||'ui' in pack.gameProject)return false;const p=structuredClone(pack);p.gameProject.ui=fresh.gameProject.ui;return isDeepStrictEqual(p,fresh)?'pre-ui':false;};

export async function plan(root){
  const data=resolve(root,'data'),sc=resolve(data,'scenarios'),dbPath=resolve(data,'campaigns.sqlite');
  const db=existsSync(dbPath)?new DatabaseSync(dbPath,{readOnly:true}):null;
  const campaigns=db?db.prepare('SELECT id,data FROM campaigns').all().map(({id,data})=>{let s={};try{s=JSON.parse(data);}catch{}return {id,packId:s.packId,turns:Object.keys(s.turns||{}).length,typed:typedTurns(s)};}):[];
  const played=new Set(campaigns.filter(c=>c.typed).map(c=>c.packId));
  // Campaigns: zero typed player turns, plus their recovery/auto backups.
  const dropCampaigns=campaigns.filter(c=>!c.typed),dropIds=new Set(dropCampaigns.map(c=>c.id));
  const rb=db?db.prepare('SELECT campaign,count(*) n FROM recovery_backups GROUP BY campaign').all():[],bk=db?db.prepare('SELECT campaign,count(*) n FROM backups GROUP BY campaign').all():[];
  const sum=(rows,ids)=>rows.filter(r=>ids.has(r.campaign)).reduce((a,r)=>a+r.n,0);
  // Drafts identical to the blank template (never one a published pack was made from).
  const fresh=await blankTemplate();
  const published=jsonFiles(resolve(sc,'published')).map(f=>({file:f,pack:json(f)})),worlds=jsonFiles(resolve(sc,'worlds')).map(f=>({file:f,w:json(f)}));
  const sources=new Set(published.map(p=>p.pack.publishedFrom).filter(Boolean));
  const drafts=jsonFiles(resolve(sc,'drafts')).map(f=>{const d=json(f);return {file:f,id:d.id,updated:d.updated,title:d.pack?.title,blank:isBlank(d.pack,fresh)};});
  const dropDrafts=drafts.filter(d=>d.blank&&!sources.has(d.id));
  // Worlds + published: saves sharing a slug (id minus its -hex8 suffix) are one family; keep the newest and any played.
  const ids=new Map();const add=(id,kind,file,saved,title)=>{const e=ids.get(id)||{id,files:[],saved:'',title};e.files.push({kind,file});if(saved>e.saved)e.saved=saved;ids.set(id,e);};
  for(const {file,w} of worlds)add(w.id,'world',file,w.saved||statSync(file).mtime.toISOString(),w.title);
  for(const {file,pack} of published)add(pack.id,'published',file,pack.publishedAt||statSync(file).mtime.toISOString(),pack.title);
  const families={};for(const e of ids.values()){const m=e.id.match(/^(.+)-[a-f0-9]{8}$/);if(m)(families[m[1]]||=[]).push(e);}
  const keepSaves=[],dropSaves=[];
  for(const list of Object.values(families)){if(list.length<2){keepSaves.push(...list.map(e=>({...e,why:'only save'})));continue;}list.sort((a,b)=>b.saved.localeCompare(a.saved));
    list.forEach((e,i)=>i===0?keepSaves.push({...e,why:'newest'}):played.has(e.id)?keepSaves.push({...e,why:'campaign with typed turns'}):dropSaves.push(e));}
  // Retired after-hours packs: only when nothing outside tests/fixtures references them.
  const packsDir=resolve(root,'packs'),retired=existsSync(packsDir)?readdirSync(packsDir).filter(f=>f.startsWith('after-hours')).map(f=>join(packsDir,f)):[];
  const code=retired.length?walk(root).filter(f=>!relative(root,f).replace(/\\/g,'/').startsWith('tests/fixtures/')&&f!==fileURLToPath(import.meta.url)):[];
  const dropRetired=[],keepRetired=[];
  for(const f of retired){const p=statSync(f).isFile()&&f.endsWith('.json')?json(f):{};const needles=[relative(packsDir,f).replace(/\\/g,'/'),p.id].filter(Boolean);
    const refs=code.filter(c=>c!==f&&needles.some(n=>readFileSync(c,'utf8').includes(n)));(refs.length?keepRetired:dropRetired).push({file:f,refs:refs.map(r=>relative(root,r))});}
  // Media: drop files no surviving draft/world/published/packs file or surviving campaign/backup mentions.
  const gone=new Set([...dropDrafts.map(d=>d.file),...dropSaves.flatMap(e=>e.files.map(x=>x.file)),...dropRetired.map(r=>r.file)]);
  const refText=[...drafts.map(d=>d.file),...worlds.map(w=>w.file),...published.map(p=>p.file),...jsonFiles(packsDir),...jsonFiles(resolve(packsDir,'director')),...jsonFiles(resolve(sc,'test-scenarios'))].filter(f=>!gone.has(f)).map(f=>readFileSync(f,'utf8'));
  if(db){for(const {data} of db.prepare('SELECT campaign,data FROM recovery_backups').all().filter(r=>!dropIds.has(r.campaign)))refText.push(data);for(const c of db.prepare('SELECT id,data FROM campaigns').all())if(!dropIds.has(c.id))refText.push(c.data);}
  const used=new Set(refText.flatMap(t=>t.match(MEDIA)||[]));
  const mediaDir=resolve(sc,'media'),media=existsSync(mediaDir)?readdirSync(mediaDir,{withFileTypes:true}).filter(e=>e.isFile()).map(e=>e.name):[];
  const dropMedia=media.filter(n=>!used.has(n)).map(n=>join(mediaDir,n));
  db?.close();
  return {root,data,dbPath,drafts,dropDrafts,dropSaves,keepSaves,families,campaigns,dropCampaigns,rbDrop:sum(rb,dropIds),bkDrop:sum(bk,dropIds),dropRetired,keepRetired,retired,media,dropMedia};
}

export function report(p,{examples=5,log=console.log}={}){
  const rel=f=>relative(p.root,f).replace(/\\/g,'/'),ex=(list,fmt)=>list.slice(0,examples).forEach(x=>log('    e.g. '+fmt(x)));
  const exact=p.dropDrafts.filter(d=>d.blank==='exact').length;
  log(`Drafts: ${p.dropDrafts.length} of ${p.drafts.length} identical to the blank "Untitled game" template (${exact} exact, ${p.dropDrafts.length-exact} saved before the template had gameProject.ui)`);
  ex(p.dropDrafts,d=>`${rel(d.file)}  updated ${d.updated}  [${d.blank}]`);
  const kept=p.drafts.filter(d=>!p.dropDrafts.includes(d));log(`  keeping ${kept.length}: ${kept.map(d=>JSON.stringify(d.title)).join(', ')}`);
  const sf=Object.entries(p.families).filter(([,l])=>l.length>1);
  log(`\nWorlds/published: ${sf.map(([k,l])=>`${l.length} saves of "${l[0].title}" (${k})`).join('; ')||'no duplicate families'}`);
  log(`  moving ${p.dropSaves.length} save(s) = ${p.dropSaves.reduce((a,e)=>a+e.files.length,0)} file(s)`);ex(p.dropSaves,e=>`${e.id}  saved ${e.saved}  [${e.files.map(x=>x.kind).join('+')}]`);
  for(const e of p.keepSaves.filter(e=>e.why!=='only save'))log(`  keeping ${e.id}  saved ${e.saved}  (${e.why})`);
  const typed=p.campaigns.length-p.dropCampaigns.length;
  log(`\nCampaigns (data/campaigns.sqlite): ${p.dropCampaigns.length} of ${p.campaigns.length} have zero typed player turns; ${p.rbDrop} recovery_backups + ${p.bkDrop} backups rows belong to them`);
  ex(p.dropCampaigns,c=>`${c.id}  pack ${c.packId}  ${c.turns} turn(s), 0 typed`);log(`  keeping ${typed} campaign(s) with typed turns`);
  log(`\nMedia: ${p.dropMedia.length} of ${p.media.length} files unreferenced by any remaining draft/world/published/packs/test-scenario/campaign`);ex(p.dropMedia,rel);
  log(`\nRetired packs/after-hours*: ${p.retired.length} found, ${p.dropRetired.length} unreferenced`);ex(p.dropRetired,r=>rel(r.file));
  for(const r of p.keepRetired)log(`  keeping ${rel(r.file)} — referenced by ${r.refs.slice(0,5).join(', ')}`);
}

export function apply(p,{date=new Date().toLocaleDateString('sv'),log=console.log}={}){
  let trash=resolve(p.data,`.trash-${date}`);for(let i=2;existsSync(trash);i++)trash=resolve(p.data,`.trash-${date}-${i}`);
  const move=f=>{const rel=relative(p.root,f),to=resolve(trash,rel.startsWith('data')?relative(p.data,f):rel);mkdirSync(dirname(to),{recursive:true});renameSync(f,to);return rel.replace(/\\/g,'/');};
  mkdirSync(trash,{recursive:true});const manifest={date:new Date().toISOString(),trash:relative(p.root,trash),moved:[],campaignsRemoved:[],recoveryBackupsRemoved:0,backupsRemoved:0};
  if(p.dropCampaigns.length&&existsSync(p.dbPath)){
    const db=new DatabaseSync(p.dbPath);db.exec('PRAGMA wal_checkpoint(FULL)');db.close();
    for(const s of ['','-wal','-shm'])if(existsSync(p.dbPath+s))copyFileSync(p.dbPath+s,resolve(trash,'campaigns.sqlite'+s));
    const db2=new DatabaseSync(p.dbPath),ids=p.dropCampaigns.map(c=>c.id),q='('+ids.map(()=>'?').join(',')+')';
    writeFileSync(resolve(trash,'removed-campaigns.json'),JSON.stringify(db2.prepare(`SELECT id,revision,data FROM campaigns WHERE id IN ${q}`).all(...ids),null,1));
    db2.exec('BEGIN IMMEDIATE');try{
      manifest.recoveryBackupsRemoved=Number(db2.prepare(`DELETE FROM recovery_backups WHERE campaign IN ${q}`).run(...ids).changes);
      manifest.backupsRemoved=Number(db2.prepare(`DELETE FROM backups WHERE campaign IN ${q}`).run(...ids).changes);
      db2.prepare(`DELETE FROM campaigns WHERE id IN ${q}`).run(...ids);db2.exec('COMMIT');}catch(e){db2.exec('ROLLBACK');db2.close();throw e;}
    db2.close();manifest.campaignsRemoved=ids;
  }
  for(const f of [...p.dropDrafts.map(d=>d.file),...p.dropSaves.flatMap(e=>e.files.map(x=>x.file)),...p.dropMedia,...p.dropRetired.map(r=>r.file)])if(existsSync(f))manifest.moved.push(move(f));
  writeFileSync(resolve(trash,'manifest.json'),JSON.stringify(manifest,null,1));
  log(`\nMoved ${manifest.moved.length} file(s) and removed ${manifest.campaignsRemoved.length} campaign(s), ${manifest.recoveryBackupsRemoved} recovery_backups and ${manifest.backupsRemoved} backups row(s).\nEverything is in ${manifest.trash} (DB copy: campaigns.sqlite, rows: removed-campaigns.json, list: manifest.json).`);
  return manifest;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
  const a=process.argv.slice(2),opt=k=>{const i=a.indexOf(k);return i>=0?a[i+1]:undefined;};
  const p=await plan(resolve(opt('--root')||REPO));
  report(p,{examples:Number(opt('--examples')||5)});
  if(a.includes('--apply'))apply(p);else console.log('\nDry run — nothing changed. Re-run with --apply to move these into data/.trash-<date>/.');
}
