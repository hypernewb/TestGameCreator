import http from 'node:http';
import {readFileSync,readdirSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {diagnoseScenes} from './packages/modules/scenes.mjs';
import {allGeneratedFacts,validateFactEdits,selectGeneratedFacts} from './packages/modules/facts.mjs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,extname,relative as pathRelative,isAbsolute,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {createWorld,validatePack,actions,resolveModules,execute,assert} from './packages/core/engine.mjs';
import {registry,moduleCatalog} from './packages/modules/index.mjs';
import {Store,exportCampaign,validateImport} from './packages/persistence/store.mjs';
import {MockProvider,CompatibleProvider} from './packages/ai/providers.mjs';
import {normalizeLocalEndpoint,localModelsUrl,validateLocalModel,LOCAL_PRESETS} from './packages/ai/local-settings.mjs';
import {GameService} from './packages/ai/service.mjs';
import {contextFor} from './packages/ai/context.mjs';
import {daypartContext} from './packages/ai/daypart.mjs';
import {modelIdsOf} from './vendor/venus/openaiResponse.mjs';
export function isFileWithin(base,file,pathApi={relative:pathRelative,isAbsolute,sep}) {
  const child=pathApi.relative(base,file);
  return child!=='' && child!=='..' && !child.startsWith('..'+pathApi.sep) && !pathApi.isAbsolute(child);
}
function imageInfo(bytes,type){
  if(type==='png'&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&bytes.length>=33){
    const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),depth=bytes[24],color=bytes[25];let offset=8;const data=[];
    while(offset+12<=bytes.length){const length=bytes.readUInt32BE(offset),name=bytes.toString('ascii',offset+4,offset+8);if(offset+12+length>bytes.length)return null;if(name==='IDAT')data.push(bytes.subarray(offset+8,offset+8+length));if(name==='IEND')break;offset+=12+length;}
    let transparent=false;
    if(depth===8&&color===6&&width*height<=1600000){const raw=inflateSync(Buffer.concat(data)),stride=width*4;if(raw.length>=(stride+1)*height){let previous=Buffer.alloc(stride),cursor=0;
      for(let y=0;y<height&&!transparent;y++){const filter=raw[cursor++],row=Buffer.from(raw.subarray(cursor,cursor+stride));cursor+=stride;
        for(let x=0;x<stride;x++){const left=x>=4?row[x-4]:0,up=previous[x],upperLeft=x>=4?previous[x-4]:0;if(filter===1)row[x]=(row[x]+left)&255;else if(filter===2)row[x]=(row[x]+up)&255;else if(filter===3)row[x]=(row[x]+Math.floor((left+up)/2))&255;else if(filter===4){const p=left+up-upperLeft,pa=Math.abs(p-left),pb=Math.abs(p-up),pc=Math.abs(p-upperLeft),predictor=pa<=pb&&pa<=pc?left:pb<=pc?up:upperLeft;row[x]=(row[x]+predictor)&255;}else if(filter!==0)return null;}
        for(let x=3;x<stride;x+=4)if(row[x]<255){transparent=true;break;}previous=row;
      }
    }}
    return {width,height,alpha:transparent};
  }
  if(type==='jpeg'&&bytes[0]===255&&bytes[1]===216){let i=2;while(i+9<bytes.length){if(bytes[i]!==255){i++;continue;}while(bytes[i]===255)i++;const marker=bytes[i++];if(marker===0xd9||marker===0xda)break;if([0x01,0xd8,0xd9,...Array.from({length:8},(_,n)=>0xd0+n)].includes(marker))continue;const size=bytes.readUInt16BE(i);if(size<2||i+size>bytes.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return {height:bytes.readUInt16BE(i+3),width:bytes.readUInt16BE(i+5),alpha:false};i+=size;}}
  return null;
}
export function createApp({dataPath,scenarioDir,provider=new MockProvider()}={}){
  const root=fileURLToPath(new URL('.',import.meta.url));const packs={};for(const f of readdirSync(resolve(root,'packs')).filter(f=>f.endsWith('.json'))){const p=JSON.parse(readFileSync(resolve(root,'packs',f),'utf8'));validatePack(p,registry);assert(!packs[p.id],'Duplicate pack ID');packs[p.id]=p;}
  const authorDir=scenarioDir||resolve(root,'data/scenarios'),draftDir=resolve(authorDir,'drafts'),publishedDir=resolve(authorDir,'published'),mediaDir=resolve(authorDir,'media');for(const dir of [draftDir,publishedDir,mediaDir])mkdirSync(dir,{recursive:true});
  const assetFile=name=>{assert(typeof name==='string'&&/^scenario-media\/[a-f0-9-]{36}\.(png|jpg|webp)$/.test(name),'Invalid project asset path');const f=resolve(mediaDir,name.slice('scenario-media/'.length));assert(isFileWithin(mediaDir,f),'Invalid project asset path');return f;};
  for(const f of readdirSync(publishedDir).filter(f=>/^[a-f0-9-]+\.json$/.test(f))){const p=JSON.parse(readFileSync(resolve(publishedDir,f),'utf8'));validatePack(p,registry);assert(!packs[p.id],'Duplicate pack ID');packs[p.id]=p;}
  const draftFile=id=>{assert(typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id),'Invalid draft ID');return resolve(draftDir,id+'.json');};
  const readDraft=id=>{const file=draftFile(id);assert(existsSync(file),'Draft not found');return JSON.parse(readFileSync(file,'utf8'));};
  const freshPack=()=>({schemaVersion:1,id:'draft',version:'0.1.0',title:'Untitled game',subtitle:'',calendar:'Day',accent:'#a9c59b',playerId:'player',gameProject:{premise:'',setting:'',writingStyle:'Present tense; grounded character dialogue; describe only what the player can perceive.',presentation:'visual-novel',calendar:{startDate:'',startWeekday:'Monday'},ai:{intent:'Interpret the player’s words as a single supported intention. Use only listed actions and exact targets. Ask for clarification when needed; never invent results.',scene:'Narrate the committed result in a vivid but concise way. Use only supplied lore, character knowledge, and outcomes. Do not change mechanics.',daypart:'Write a daypart introduction as a short scene, then write one in-character meeting invitation for every eligible character. Do not make off-screen characters appear.'}},startOptions:[{id:'opening',title:'A New Beginning',description:'Start at the beginning of the story.',playerLocation:'start',tick:0}],worldEvents:[],scriptedScenes:[],schedules:[],initialRelationships:[],modules:{'social.conversation':'0.1.0','story.scenes':'0.1.0','story.facts':'0.1.0'},locations:[{id:'start',name:'Starting place',description:'Describe what the player sees here.',exits:[]}],actors:[{id:'player',name:'You',location:'start'}],items:[],objects:[],facts:[],lorebook:[]});
  const aiSettingsFile=dataPath===':memory:'?null:resolve(dataPath?dirname(resolve(dataPath)):resolve(root,'data'),'ai-settings.json');
  let aiSettings={mode:'offline',endpoint:LOCAL_PRESETS.lmstudio,model:''};
  if(aiSettingsFile&&existsSync(aiSettingsFile)){try{const saved=JSON.parse(readFileSync(aiSettingsFile,'utf8'));if(saved.mode==='local'){aiSettings={mode:'local',endpoint:normalizeLocalEndpoint(saved.endpoint),model:validateLocalModel(saved.model)};provider=new CompatibleProvider({endpoint:aiSettings.endpoint,model:aiSettings.model,timeout:120000,maxRequests:10000,maxTokens:1800});}}catch(e){console.warn(`Ignoring invalid AI settings: ${e.message}`);}}
  const store=new Store(dataPath||resolve(root,'data/campaigns.sqlite')),service=new GameService(store,packs,registry,provider);const active=new Map();
  const view=s=>{const p=packs[s.packId];assert(p,'Missing pack');const context=contextFor(s,p);return {state:s,pack:p,actions:actions(s,p,registry),panels:resolveModules(p,registry).flatMap(m=>m.panel?[m.panel(s,p)]:[]),eventDebug:diagnoseScenes(s,p),known:[...context.facts,...context.generatedFacts],contextTrace:{lore:context.loreTrace,generatedFacts:context.generatedFactTrace,recentActions:context.recentActions}};};
  const server=http.createServer(async(req,res)=>{const send=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
    try{
      const host=req.headers.host;assert(host&&/^(127\.0\.0\.1|localhost):\d+$/.test(host),'Invalid Host');if(req.headers.origin)assert(req.headers.origin===`http://${host}`,'Cross-origin request rejected');
      const url=new URL(req.url,`http://${host}`),path=url.pathname;
      let body={};if(req.method==='POST'){assert(req.headers['content-type']?.startsWith('application/json'),'Expected JSON');let text='';for await(const chunk of req){text+=chunk;assert(text.length<=5000000,'Request too large');}body=JSON.parse(text||'{}');}
      if(path==='/api/bootstrap')return send({packs:Object.values(packs).sort((a,b)=>b.version.localeCompare(a.version)).map(p=>({id:p.id,title:p.title,subtitle:p.subtitle,starts:p.startOptions||[]})),modules:moduleCatalog,campaigns:store.list(),provider:service.provider.name,ai:aiSettings});
      if(path==='/api/ai/config'&&req.method==='GET')return send({provider:service.provider.name,...aiSettings,presets:LOCAL_PRESETS});
      if(path==='/api/ai/models'&&req.method==='POST'){
        const endpoint=normalizeLocalEndpoint(body.endpoint),reply=await fetch(localModelsUrl(endpoint),{signal:AbortSignal.timeout(5000)});
        assert(reply.ok,`Local AI server returned ${reply.status} while listing models`);
        const catalog=await reply.json();assert(Array.isArray(catalog.data),'Local AI server did not return a model list');
        return send({models:modelIdsOf(catalog).slice(0,100)});
      }
      if(path==='/api/ai/test'&&req.method==='POST'){
        const candidate=new CompatibleProvider({endpoint:normalizeLocalEndpoint(body.endpoint),model:validateLocalModel(body.model),timeout:120000,maxRequests:2,maxTokens:1800});
        const started=Date.now(),reply=await candidate.complete([{role:'user',content:'Reply with only READY.'}]);
        return send({ok:true,model:candidate.model,reply:reply.slice(0,300),latencyMs:Date.now()-started});
      }
      if(path==='/api/ai/test-scene'&&req.method==='POST'){
        const candidate=new CompatibleProvider({endpoint:normalizeLocalEndpoint(body.endpoint),model:validateLocalModel(body.model),timeout:120000,maxRequests:12,maxTokens:4096});
        const p=packs['sample.living-world'],initial=createWorld(p,registry,randomUUID()),action=execute(initial,{type:'world.nextDaypart',args:{},id:'model-probe',actorId:p.playerId,expectedRevision:0},p,registry);
        const started=Date.now(),scene=await candidate.generateDaypart(daypartContext(action.state,p,action.turn));
        return send({ok:true,model:candidate.model,lines:scene.lines,hangouts:scene.hangouts.map(h=>h.char),latencyMs:Date.now()-started});
      }
      if(path==='/api/ai/config'&&req.method==='POST'){
        assert(!active.size,'Wait for the current game action to finish before switching AI');
        assert(body.mode==='local'||body.mode==='offline','Choose local AI or offline demo');
        if(body.mode==='local'){
          const endpoint=normalizeLocalEndpoint(body.endpoint),model=validateLocalModel(body.model);
          aiSettings={mode:'local',endpoint,model};service.provider=new CompatibleProvider({endpoint,model,timeout:120000,maxRequests:10000,maxTokens:1800});
        }else{aiSettings={mode:'offline',endpoint:LOCAL_PRESETS.lmstudio,model:''};service.provider=new MockProvider();}
        if(aiSettingsFile){mkdirSync(dirname(aiSettingsFile),{recursive:true});writeFileSync(aiSettingsFile,JSON.stringify(aiSettings,null,2)+'\n');}
        return send({ok:true,provider:service.provider.name,...aiSettings});
      }
      if(path==='/api/studio/list'&&req.method==='GET')return send({drafts:readdirSync(draftDir).filter(f=>/^[a-f0-9-]{36}\.json$/.test(f)).map(f=>{const d=readDraft(f.slice(0,-5));return {id:d.id,title:d.pack.title,updated:d.updated};}).sort((a,b)=>b.updated.localeCompare(a.updated))});
      if(path==='/api/studio/create'&&req.method==='POST'){const id=randomUUID(),source=body.packId?packs[body.packId]:null;assert(!body.packId||source,'Unknown scenario');const pack=source?structuredClone(source):freshPack();pack.gameProject||={premise:'',setting:'',writingStyle:'Present tense; grounded character dialogue; describe only what the player can perceive.',calendar:{startDate:'',startWeekday:'Monday'},ai:{intent:'Interpret the player’s words as a single supported intention. Use only listed actions and exact targets. Ask for clarification when needed; never invent results.',scene:'Narrate the committed result vividly but concisely. Use only supplied lore, character knowledge, and outcomes.',daypart:'Write a daypart introduction as a short scene, then one in-character meeting invitation per eligible character.'}};pack.gameProject.presentation||='visual-novel';pack.gameProject.calendar||={startDate:''};pack.gameProject.ai||={intent:'',scene:'',daypart:''};pack.startOptions||=[{id:'opening',title:'A New Beginning',description:'Start at the beginning.',playerLocation:pack.actors.find(a=>a.id===pack.playerId).location,tick:0}];pack.worldEvents||=[];pack.initialRelationships||=[];pack.schedules||=[];const d={id,updated:new Date().toISOString(),pack};writeFileSync(draftFile(id),JSON.stringify(d,null,2));return send(d);}
      if(path==='/api/studio/get'&&req.method==='GET')return send(readDraft(url.searchParams.get('id')));
      if(path==='/api/studio/save'&&req.method==='POST'){const d=readDraft(body.id);assert(body.pack&&typeof body.pack==='object'&&!Array.isArray(body.pack),'Scenario data required');d.pack=body.pack;d.updated=new Date().toISOString();writeFileSync(draftFile(d.id),JSON.stringify(d,null,2));return send(d);}
      if(path==='/api/studio/validate'&&req.method==='POST'){validatePack(body.pack,registry);return send({ok:true});}
      if(path==='/api/studio/asset'&&req.method==='POST'){assert(typeof body.data==='string'&&body.data.length<=4900000,'Image is too large (maximum 3.5 MB)');const match=body.data.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);assert(match,'Use a PNG, JPEG, or WebP image');const bytes=Buffer.from(match[2],'base64');assert(bytes.length>0&&bytes.length<=3500000,'Image is too large (maximum 3.5 MB)');const valid=match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';assert(valid,'Image content does not match its file type');if(body.kind){const info=imageInfo(bytes,match[1]);if(body.kind==='background'){assert(match[1]==='jpeg'&&info?.width===1920&&info?.height===1080,'Backgrounds must be prepared as 1920 × 1080 landscape images (16:9).');}else if(body.kind==='character'){assert(match[1]==='png'&&info?.width===1024&&info?.height===1536&&info.alpha,'Character art must be a transparent PNG on a 1024 × 1536 canvas.');}else assert(false,'Unknown image type');}const ext=match[1]==='jpeg'?'jpg':match[1],name=`scenario-media/${randomUUID()}.${ext}`;writeFileSync(assetFile(name),bytes,{flag:'wx'});return send({path:name});}
      if(path==='/api/studio/asset'&&req.method==='GET'){const name=url.searchParams.get('path'),file=assetFile(name);assert(existsSync(file),'Project image not found');const ext=extname(file).slice(1),data=readFileSync(file);return send({path:name,mime:`image/${ext==='jpg'?'jpeg':ext}`,data:data.toString('base64')});}
      if(path==='/api/studio/publish'&&req.method==='POST'){const d=readDraft(body.id);const p=structuredClone(d.pack);p.id='created.'+randomUUID();p.version='0.1.0';validatePack(p,registry);writeFileSync(resolve(publishedDir,p.id.slice(8)+'.json'),JSON.stringify(p,null,2));packs[p.id]=p;return send({id:p.id,title:p.title});}
      if(path==='/api/new'&&req.method==='POST'){const p=packs[body.packId];assert(p,'Unknown pack');const s=createWorld(p,registry,randomUUID(),42,body.startId);store.insert(s);return send(view(s));}
      if(path==='/api/load'&&req.method==='POST'){return send(view(await service.recover(body.id)));}
      if(path==='/api/facts'&&req.method==='GET'){const s=store.load(url.searchParams.get('id')),p=packs[s.packId];assert(p&&s.modules['story.facts'],'Fact ledger is disabled');return send({facts:allGeneratedFacts(s),edits:s.factEdits||[],count:(s.factEdits||[]).length});}
      if(path==='/api/facts/search'&&req.method==='POST'){const s=store.load(body.campaignId),p=packs[s.packId];assert(p&&s.modules['story.facts'],'Fact ledger is disabled');assert(typeof body.query==='string'&&body.query.length<=200,'Search text is too long');return send(selectGeneratedFacts(s,p,p.playerId,body.query));}
      if(path==='/api/facts/edit'&&req.method==='POST'){assert(!active.has(body.campaignId),'Wait for the current action to finish');const s=store.load(body.campaignId),p=packs[s.packId];assert(p&&s.modules['story.facts'],'Fact ledger is disabled');const edit={id:randomUUID(),factId:body.factId,action:body.action,...(body.action==='correct'?{text:body.text?.trim()}:{}),...(body.action==='merge'?{targetId:body.targetId}:{}),at:new Date().toISOString()};validateFactEdits([...(s.factEdits||[]),edit],s,p);return send(view(store.editFact(body.campaignId,edit,body.expectedCount)));}
      if(path==='/api/action'&&req.method==='POST'){const c=new AbortController();assert(!active.has(body.campaignId),'A turn is already active');active.set(body.campaignId,c);try{const r=await service.act(body.campaignId,body,c.signal);return send({...view(r.state),clarification:r.clarification});}finally{active.delete(body.campaignId);}}
      if(path==='/api/turn/retry'&&req.method==='POST'){const c=new AbortController();assert(!active.has(body.campaignId),'A turn is already active');active.set(body.campaignId,c);try{const r=await service.retry(body.campaignId,body.turnId,c.signal);return send(view(r.state));}finally{active.delete(body.campaignId);}}
      if(path==='/api/cancel'&&req.method==='POST'){active.get(body.id)?.abort();return send({ok:true});}
      if(path==='/api/export'){return send(exportCampaign(store.load(url.searchParams.get('id'))));}
      if(path==='/api/journal'&&req.method==='GET'){const state=store.load(url.searchParams.get('id'));res.writeHead(200,{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':'attachment; filename=action-journal.jsonl','Cache-Control':'no-store'});res.end(state.events.filter(e=>e.type!=='core.patch').map(e=>JSON.stringify(e)).join('\n')+'\n');return;}
      if(path==='/api/import'&&req.method==='POST'){const p=packs[body.state?.packId];assert(p,'Install the matching pack before importing');const s=validateImport(body,p,registry);s.campaignId=randomUUID();store.insert(s);return send(view(s));}
      if(path.startsWith('/api/'))return send({error:'Not found'},404);
      if(path==='/vendor/venus/sceneActions.mjs'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript','X-Content-Type-Options':'nosniff'});res.end(readFileSync(resolve(root,'vendor/venus/sceneActions.mjs')));return;}
      if(path==='/vendor/venus/stageDisplay.mjs'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript','X-Content-Type-Options':'nosniff'});res.end(readFileSync(resolve(root,'vendor/venus/stageDisplay.mjs')));return;}
      if(path==='/vendor/venus/sceneText.mjs'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'text/javascript','X-Content-Type-Options':'nosniff'});res.end(readFileSync(resolve(root,'vendor/venus/sceneText.mjs')));return;}
      if(path.startsWith('/scenario-media/')){const file=assetFile(path.slice(1));assert(existsSync(file),'File not found');const ext=extname(file);res.writeHead(200,{'Content-Type':{'.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[ext],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self'; frame-ancestors 'none'"});res.end(readFileSync(file));return;}
      assert(req.method==='GET','Unsupported method');const relative=path==='/'?'index.html':decodeURIComponent(path.slice(1));const base=resolve(root,'public'),file=resolve(base,relative);assert(isFileWithin(base,file)&&existsSync(file),'File not found');const mime={'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'}[extname(file)];assert(mime,'Unsupported file');res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(readFileSync(file));
    }catch(e){send({error:e.message},400);}
  });return {server,store,service,packs};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const provider=process.env.STORY_ENDPOINT?new CompatibleProvider({endpoint:process.env.STORY_ENDPOINT,model:process.env.STORY_MODEL,key:process.env.STORY_API_KEY||'',maxRequests:Number(process.env.STORY_MAX_REQUESTS||100)}):new MockProvider();
  const {server,service}=createApp({provider});const port=Number(process.env.PORT||4317);server.listen(port,'127.0.0.1',()=>console.log(`Story Framework: http://127.0.0.1:${port}\nProvider: ${service.provider.name}\nKeep this window open. Press Ctrl+C to stop.`));
}
