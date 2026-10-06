// M2 creator API (/api/creator/*): premise -> editable proposal -> structure spec -> drafted text, card by card -> a new campaign.
// Kept out of server.mjs: createApp hands in its packs, store and folders, plus `drafter()`, which returns the cloud complete(messages) (OpenRouter by default) or null.
import {existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomInt} from 'node:crypto';
import {createWorld,validatePack,assert} from '../core/engine.mjs';
import {assemble} from './world-assembly.mjs';
import {batches,draftMessages,acceptDraft,setPath,structureOnly} from './world-draft.mjs';
import {TONE_CEILINGS} from './director-library.mjs';
import {structureFromProposal,proposeWorld,cardSeed,PLACE_KINDS,PRICES,STATS,WANT_MIN} from './world-structure.mjs';
import {TEMPERAMENTS,PACES} from './beat-library.mjs';
import {routeDiagnostics,routeSameness} from './route-archetypes.mjs';

const obj=(x,m)=>{assert(x&&typeof x==='object'&&!Array.isArray(x),m);return x;};
// cards: every text path per card (from the picks alone), so the wizard can lay out scene cards whether or not they are drafted yet.
const report=spec=>{const {pack,missing}=assemble(spec);return {routeDiagnostics:routeDiagnostics(pack),routeSameness:routeSameness(pack),missing,batches:batches(missing).map(b=>({id:b.id,count:b.paths.length})),cards:batches(assemble(structureOnly(spec)).missing),scenes:pack.scriptedScenes.length};};

export function creatorRoutes({packs,store,registry,publishedDir,worldDir,drafter,validateMedia=()=>{},catalog={}}){
 mkdirSync(worldDir,{recursive:true});
 const ask=()=>{const c=drafter();assert(c,'Set OPENROUTER_API_KEY in .env to use the world drafter');return c;};
 const worldFile=id=>{assert(typeof id==='string'&&/^[a-z0-9-]{1,80}$/.test(id),'Invalid world id');return resolve(worldDir,id+'.json');};
 return async(path,method,body)=>{
  // A SillyTavern card (PNG data URL, JSON text or object) -> {name,text,premise}: read locally, no model call. Propose then takes {card:{name,text}}.
  if(path==='/api/creator/card'&&method==='POST'){const c=body.card,png=typeof c==='string'&&c.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);assert(c&&(typeof c==='object'||typeof c==='string'&&c.length<=4900000),'Character card required');return cardSeed(png?Buffer.from(png[1],'base64'):c);}
  if(path==='/api/creator/propose'&&method==='POST'){const premise=String(body.premise||'').trim();assert(premise&&premise.length<=4000,'Enter a premise (up to 4,000 characters)');
   const card=body.card?{name:String(body.card.name||'').trim().slice(0,80),text:String(body.card.text||'').slice(0,4000)}:undefined;assert(!card||card.name&&card.text,'Card needs a name and text');
   const n=Math.max(1,Math.min(6,Number(body.heroines)||4)),r=await proposeWorld(premise,{complete:ask(),heroines:n,style:body.style,card});return {...r,...report(r.spec)};}
  // The owner edited the proposal: rebuild the structure from it (ids, exits, prices and yields are code's again).
  if(path==='/api/creator/structure'&&method==='POST'){const r=structureFromProposal(obj(body.proposal,'Proposal required'));return {...r,...report(r.spec)};}
  if(path==='/api/creator/modules'&&method==='POST'){const spec=structuredClone(obj(body.spec,'World spec required')),modules=structuredClone(assemble(spec).pack.modules);if(body.id!==undefined){assert(catalog[body.id],'Unknown module');assert(typeof body.enabled==='boolean','Module enabled must be boolean');const enable=(id,seen=new Set())=>{if(seen.has(id))return;seen.add(id);assert(catalog[id],'Unknown dependency');for(const dep of catalog[id].requires||[])enable(dep,seen);modules[id]=catalog[id].version;},disable=(id,seen=new Set())=>{if(seen.has(id))return;seen.add(id);for(const [key,meta] of Object.entries(catalog))if(modules[key]&&(meta.requires||[]).includes(id))disable(key,seen);delete modules[id];};body.enabled?enable(body.id):disable(body.id);spec.modules=modules;validatePack(assemble(spec).pack,registry);}return {spec,modules};}
  if(path==='/api/creator/check'&&method==='POST')return report(obj(body.spec,'World spec required'));
  // batch: one card id (world, <id>:profile or <id>:<rung>), or batches: up to 6 drafted in parallel. redo=true blanks those cards first, so Redraft rewrites them from the picks.
  // A card whose call fails or returns junk just stays missing (errors lists why); the wizard retries what is left.
  if(path==='/api/creator/fill'&&method==='POST'){let spec=structuredClone(obj(body.spec,'World spec required'));const ids=[...new Set([].concat(body.batches??body.batch??[]).map(String))].slice(0,6),c=ask();
   if(body.redo){const all=batches(assemble(structureOnly(spec)).missing);for(const id of ids){const b=all.find(x=>x.id===id);assert(b,'Unknown card');for(const p of b.paths)setPath(spec,p,'');}}
   const todo=batches(assemble(spec).missing).filter(b=>ids.includes(b.id)),errors=[],filled=[];
   const raws=await Promise.all(todo.map(b=>c(draftMessages(spec,b,{style:body.style})).catch(e=>{errors.push(`${b.id}: ${e.message}`);return '';})));
   todo.forEach((b,i)=>{const x=acceptDraft(spec,b,raws[i]);spec=x.spec;filled.push(...x.filled);});return {spec,filled,errors,...report(spec)};}
  // Save: a world becomes a published pack + a fresh campaign; the spec and proposal are kept so the wizard can reopen it. Blank text is allowed:
  // assemble improvises it (plain names, free firsts, beats left out). `from` ties every save of one world together, so older campaigns are offered the update.
  if(path==='/api/creator/save'&&method==='POST'){const spec=obj(body.spec,'World spec required'),{pack,improvised}=assemble(spec,{improvise:true}),from=typeof body.from==='string'&&/^creator:[a-z0-9-]{1,90}$/.test(body.from)?body.from:null;
   pack.id=`${pack.id||'world'}-${randomUUID().slice(0,8)}`;pack.publishedFrom=from||`creator:${pack.id}`;pack.publishedAt=new Date().toISOString();validateMedia(pack);validatePack(pack,registry);assert(!packs[pack.id],'Duplicate pack ID');
   writeFileSync(resolve(publishedDir,randomUUID()+'.json'),JSON.stringify(pack,null,1));packs[pack.id]=pack;
   writeFileSync(worldFile(pack.id),JSON.stringify({id:pack.id,from:pack.publishedFrom,title:pack.title,saved:pack.publishedAt,spec,proposal:body.proposal||null},null,1));
   const s=createWorld(pack,registry,randomUUID(),randomInt(2**32-1));store.insert(s);return {packId:pack.id,campaignId:s.campaignId,title:pack.title,from:pack.publishedFrom,improvised:improvised.length};}
  // The enum picks the proposal form offers (code owns the numbers behind them).
  if(path==='/api/creator/options'&&method==='GET')return {temperaments:Object.fromEntries(Object.entries(TEMPERAMENTS).map(([k,t])=>[k,t.about])),paces:Object.keys(PACES),placeKinds:PLACE_KINDS,prices:Object.keys(PRICES),stats:STATS,levels:Object.keys(WANT_MIN),tones:TONE_CEILINGS,modules:catalog,drafter:!!drafter()};
  if(path==='/api/creator/worlds'&&method==='GET')return {worlds:readdirSync(worldDir).filter(f=>f.endsWith('.json')).map(f=>{const w=JSON.parse(readFileSync(resolve(worldDir,f),'utf8'));return {id:w.id,title:w.title,saved:w.saved};}).sort((a,b)=>b.saved.localeCompare(a.saved))};
  if(path==='/api/creator/world'&&method==='GET'){const f=worldFile(body.id);assert(existsSync(f),'World not found');return JSON.parse(readFileSync(f,'utf8'));}
 };
}

