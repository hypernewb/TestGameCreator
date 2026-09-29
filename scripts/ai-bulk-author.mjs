// Generate reviewable character/scene batches, then apply only entries marked approved.
// Run with --help for examples.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizeLocalEndpoint,validateLocalModel} from '../packages/ai/local-settings.mjs';
import {normalizeCandidate,createProposal,applyProposal,messagesFor,candidateSchema,KINDS,stagesFor,withCandidate,joinCandidates,retryOnce,playability,mergeApproved,withProposal} from '../packages/ai/bulk-authoring.mjs';
import {cardBrief,seedMessages,seedPack,seedSchema,castOf} from '../packages/cards/card-world.mjs';
import {readCard} from '../packages/cards/character-card.mjs';
import {routeCandidate,routeIds,draftRouteProse} from '../packages/cards/route-skeleton.mjs';
import {intimacyCandidate,intimacyFrame,intimacyIds,boundaries,draftIntimacyProse} from '../packages/cards/intimacy-skeleton.mjs';

const argv=process.argv.slice(2),command=argv.shift();
const arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const required=name=>{const value=arg(name);if(!value)throw Error(`Missing --${name}`);return value;};
const readJson=file=>JSON.parse(readFileSync(resolve(file),'utf8'));
const integer=(name,fallback)=>{const n=Number(arg(name,fallback));if(!Number.isInteger(n)||n<0||n>100)throw Error(`--${name} must be an integer from 0 to 100`);return n;};
const help=()=>console.log(`AI-assisted bulk authoring\n\nStart a new pack from a SillyTavern/JanitorAI/Chub character card (PNG or JSON); the AI drafts a map that fits the card and the card becomes a character:\n  node scripts/ai-bulk-author.mjs seed --card cards/mara.png --locations 5 --model MODEL --out packs/mara.json [--brief notes.md]\n\nGrow a pack around a card (--card replaces or adds to --brief; --locations and --events add new places and one-off timed happenings; --templates N drafts role-slot scenes cast from the whole cast):\n  node scripts/ai-bulk-author.mjs generate --pack packs/mara.json --card cards/mara.png --locations 3 --characters 4 --scenes 6 --events 4 --model MODEL --out proposals/mara.json\n\nGenerate a review file:\n  node scripts/ai-bulk-author.mjs generate --pack packs/my-game.json --brief briefs/cast.md --characters 6 --scenes 12 --model MODEL --out proposals/batch.json\n\nPopulate the world (things to examine or use, hidden finds, ways to train stats):\n  node scripts/ai-bulk-author.mjs generate --pack packs/my-game.json --brief briefs/world.md --objects 8 --items 4 --activities 6 --model MODEL --out proposals/world.json\nHidden items list 2-3 candidate spots (hideIn); each new campaign picks one from its seed, so replays differ but stay reproducible.\n\nReview the file and change status from "pending" to "approved" for entries you want. Dry-run what the proposal would play like (unreachable places, sticky or clashing scenes, absent speakers, clashing events):
  node scripts/ai-bulk-author.mjs check --pack packs/my-game.json [--proposal proposals/batch.json]

Re-run a saved reply (<out>.failed.txt) through the current normalizer, without the model:
  node scripts/ai-bulk-author.mjs replay --pack packs/my-game.json --reply proposals/batch.json.failed.txt [--out proposals/batch.json]

Build a romance route: per love interest a ladder of hand cards (hangout, flirt, charged, kiss, night, again) with checks that fail forward, a run of --days, a last-day scene and endings. Code builds the structure; the model writes only the prose, one request per character (--placeholder skips the model):
  node scripts/ai-bulk-author.mjs route --pack packs/mara.json --route mara,jun --days 14 --model MODEL --out proposals/route.json [--card cards/mara.png] [--brief notes.md]

Draft intimacy for love interests (18+): an intimacy profile and a 5-beat first night plus a repeatable one, each beat with a stop choice. You set --content (fade, suggestive or explicit) and the ages; nothing here sets an age, and every encounter needs your own approval:
  node scripts/ai-bulk-author.mjs intimacy --pack packs/mara.json --characters mara --content fade --model MODEL --out proposals/intimacy.json [--private mara-flat] [--card cards/mara.png] [--brief notes.md] [--placeholder]

Then apply to a new pack:\n  node scripts/ai-bulk-author.mjs apply --pack packs/my-game.json --proposal proposals/batch.json --out packs/my-game-expanded.json\n\nGeneration uses an OpenAI-compatible local endpoint. Default: http://127.0.0.1:1234/v1. STORY_ENDPOINT and STORY_MODEL are also accepted.`);
const briefFile=()=>{const f=arg('brief');if(!f)return '';const b=readFileSync(resolve(f),'utf8').trim();if(!b)throw Error('Brief is empty');return b;};
const endpointModel=()=>[arg('endpoint',process.env.STORY_ENDPOINT||'http://127.0.0.1:1234/v1'),validateLocalModel(arg('model',process.env.STORY_MODEL||''))];

const complete=(...a)=>retryOnce(()=>ask(...a),e=>console.error(`AI request failed (${e.message.slice(0,120)}); retrying once…`));
async function ask(endpoint,model,messages,schema){
 // JSON mode where the server has it: a caller schema first (grammar-enforced on LM Studio/llama.cpp), json_object, json_schema (LM Studio accepts only that or text), else plain text.
 const strict={type:'json_schema',json_schema:{name:'answer',schema:schema||{type:'object'}}},formats=schema?[strict,{type:'json_object'},null]:[{type:'json_object'},strict,null];
 const url=normalizeLocalEndpoint(endpoint),request=async format=>fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model,messages,temperature:0.7,max_tokens:16000,...(format?{response_format:format}:{})}),signal:AbortSignal.timeout(300000)});
 let response;for(const format of formats){response=await request(format);if(response.status!==400)break;const detail=await response.text();if(!format||!/response[_ ]?format|json.?mode|json_schema/i.test(detail))throw Error(`AI request failed (400): ${detail.slice(0,500)}`);}
 if(!response.ok)throw Error(`AI request failed (${response.status}): ${(await response.text()).slice(0,500)}`);
 // Thinking models can spend the answer inside reasoning_content; use it if that is where the JSON ended up.
 const body=await response.json(),msg=body.choices?.[0]?.message||{},content=typeof msg.content==='string'&&msg.content.trim()?msg.content:typeof msg.reasoning_content==='string'&&msg.reasoning_content.includes('{')?msg.reasoning_content:msg.content;
 if(typeof content!=='string'||!content.trim())throw Error(`AI response was empty${body.choices?.[0]?.finish_reason==='length'?' (token limit reached, probably while thinking; turn thinking off for this model)':''}`);return content;
}

// When the repair also fails, save the reply next to --out so the author can see what the model did.
const keepRaw=(raw,fn)=>{try{return fn();}catch(e){const f=resolve(required('out'))+'.failed.txt';writeFileSync(f,raw);e.message+=` (raw reply saved to ${f})`;throw e;}};

try{
 if(!command||command==='--help'||command==='help'){help();process.exit(0);}
 if(command==='generate'){
  const pack=readJson(required('pack')),cardFile=arg('card'),notes=briefFile();if(!cardFile&&!notes)throw Error('Missing --brief or --card');
  let brief=notes;if(cardFile){const card=readFileSync(resolve(cardFile)),missing=castOf(pack,readCard(card).data.name.trim()).filter(m=>!m.id).map(m=>m.name).join(', ');if(missing)console.error(`Note: ${missing} not in this pack; content will fit the card without referencing them. Add them first with: npm run card -- import <pack> ${cardFile}`);brief=[cardBrief(card,{pack}),notes&&`AUTHOR NOTES\n${notes}`].filter(Boolean).join('\n\n');}
  const counts={locationCount:integer('locations',0),characterCount:integer('characters',0),sceneCount:integer('scenes',0),objectCount:integer('objects',0),itemCount:integer('items',0),activityCount:integer('activities',0),eventCount:integer('events',0),templateCount:integer('templates',0)};if(!Object.values(counts).some(Boolean))throw Error('Request at least one location, character, scene, template, object, item, activity or event');
  if((counts.sceneCount||counts.templateCount)&&!pack.modules?.['story.scenes'])throw Error('The pack must enable story.scenes before generating scripted scenes');
  const [endpoint,model]=endpointModel();
  // Places and people first, then scenes and events against them (see stagesFor); each stage gets one repair.
  const stages=stagesFor(counts);let candidate={},staged=pack;
  for(const [i,part] of stages.entries()){
   const label=stages.length>1?` (step ${i+1} of ${stages.length}: ${Object.keys(part).filter(k=>part[k]).map(k=>k.replace('Count','')).join(', ')})`:'',schema=candidateSchema(staged,part);if(label)console.error(`Generating${label}…`);
   let raw=await complete(endpoint,model,messagesFor(staged,brief,part),schema),got;
   try{got=normalizeCandidate(raw,staged,part,{strict:true});}catch(first){console.error(`First candidate failed validation: ${first.message}\nRequesting one repair…`);raw=await complete(endpoint,model,messagesFor(staged,brief,part,first.message),schema);got=keepRaw(raw,()=>normalizeCandidate(raw,staged,part));}
   candidate=joinCandidates(candidate,got);staged=withCandidate(staged,got);
  }
  if(candidate.skipped?.length)console.error(`Skipped copies of existing content: ${candidate.skipped.join(', ')}`);
  // Playability problems the new content introduces (existing ones are the pack's own business; see the check command).
  const before=new Set(playability(pack));candidate.warnings=[...(candidate.warnings||[]),...playability(staged).filter(x=>!before.has(x))];if(candidate.warnings.length)console.error(`Warnings (listed under "warnings" in the proposal):\n- ${candidate.warnings.join('\n- ')}`);
  if(candidate.dropped?.length)console.error(`Dropped entries that failed validation (listed under "dropped" in the proposal):\n- ${candidate.dropped.join('\n- ')}`);
  const out=resolve(required('out'));writeFileSync(out,JSON.stringify(createProposal(pack,candidate,{brief,counts,model}),null,2)+'\n',{flag:'wx'});console.log(`Wrote ${KINDS.filter(k=>candidate[k].length).map(k=>`${candidate[k].length} ${k}`).join(', ')} to ${out}`);console.log('Review each entry, change selected statuses to "approved", then run the apply command.');
 }else if(command==='route'){
  // Structure from code (packages/cards/route-skeleton.mjs); prose from the model, one small request per love interest. Missing slots keep placeholder lines and are listed as warnings.
  const pack=readJson(required('pack')),ids=routeIds(pack,required('route')),days=integer('days',14),out=resolve(required('out')),notes=briefFile(),cardFile=arg('card');
  const brief=[cardFile&&cardBrief(readFileSync(resolve(cardFile)),{pack,max:1500}).split('\n\nTASK\n')[0],notes].filter(Boolean).join('\n\n'),placeholder=argv.includes('--placeholder'),prose={},warnings=[];routeCandidate(pack,{route:ids,days});
  const [endpoint,model]=placeholder?['','placeholder']:endpointModel();
  if(!placeholder)for(const x of ids){
   console.error(`Writing ${x}'s route…`);let r;try{r=await draftRouteProse((m,schema)=>complete(endpoint,model,m,schema),pack,x,{brief,onRepair:e=>console.error(`${x}: ${e}; requesting one repair…`)});}catch(e){keepRaw(e.raw,()=>{throw e;});}
   prose[x]=r.prose;if(r.missing.length)warnings.push(`${x}: placeholder prose for ${r.missing.join(', ')}`);
  }
  const candidate={...routeCandidate(pack,{route:ids,days,prose}),warnings};if(warnings.length)console.error(`Warnings:\n- ${warnings.join('\n- ')}`);
  writeFileSync(out,JSON.stringify(createProposal(pack,candidate,{brief,route:ids,days,model}),null,2)+'\n',{flag:'wx'});console.log(`Wrote a ${days}-day route for ${ids.join(', ')} (${candidate.scenes.length} scenes) to ${out}`);console.log('Review the scenes, change statuses to "approved", then run check and apply. The route frame (stats, dating profiles, run, endings) applies with the proposal; delete "route" from the file to leave it out.');
 }else if(command==='intimacy'){
  // Structure, stop choices and boundaries from code (packages/cards/intimacy-skeleton.mjs); prose from the model, one request per love interest.
  const pack=readJson(required('pack')),ids=intimacyIds(pack,required('characters')),b=boundaries(pack,{contentLevel:required('content'),privateLocations:arg('private')}),out=resolve(required('out')),notes=briefFile(),cardFile=arg('card');
  const brief=[cardFile&&cardBrief(readFileSync(resolve(cardFile)),{pack,max:1500}).split('\n\nTASK\n')[0],notes].filter(Boolean).join('\n\n'),placeholder=argv.includes('--placeholder'),framed=intimacyFrame(pack,{characters:ids,...b}),prose={},warnings=[];
  const [endpoint,model]=placeholder?['','placeholder']:endpointModel();
  if(!placeholder)for(const x of ids){
   console.error(`Writing ${x}'s encounters…`);let r;try{r=await draftIntimacyProse((m,schema)=>complete(endpoint,model,m,schema),framed,x,{brief,onRepair:e=>console.error(`${x}: ${e}; requesting one repair…`)});}catch(e){keepRaw(e.raw,()=>{throw e;});}
   prose[x]=r.prose;if(r.missing.length)warnings.push(`${x}: placeholder intimacy prose for ${r.missing.join(', ')}`);
  }
  const c=intimacyCandidate(pack,{characters:ids,prose,...b}),candidate={...c,warnings:[...c.warnings,...warnings]};if(candidate.warnings.length)console.error(`Warnings:\n- ${candidate.warnings.join('\n- ')}`);
  writeFileSync(out,JSON.stringify(createProposal(pack,candidate,{brief,characters:ids,model}),null,2)+'\n',{flag:'wx'});console.log(`Wrote ${candidate.scenes.length} ${b.contentLevel} intimacy scenes for ${ids.join(', ')} to ${out}`);console.log('Adult content: each encounter needs your own approval ("Approve all" in Studio skips them). The intimacy profile and settings apply only for approved first encounters.');
 }else if(command==='seed'){
  const card=readFileSync(resolve(required('card'))),brief=briefFile(),locationCount=integer('locations',4),out=resolve(required('out'));if(locationCount<1)throw Error('--locations must be at least 1');
  const [endpoint,model]=endpointModel(),opts={locationCount,brief},schema=seedSchema(card,opts);let raw=await complete(endpoint,model,seedMessages(card,opts),schema),result;
  try{result=seedPack(raw,card,{locationCount,id:arg('id')});}catch(first){console.error(`First map failed validation: ${first.message}\nRequesting one repair…`);raw=await complete(endpoint,model,seedMessages(card,opts,first.message),schema);result=keepRaw(raw,()=>seedPack(raw,card,{locationCount,id:arg('id')}));}
  writeFileSync(out,JSON.stringify(result.pack,null,2)+'\n',{flag:'wx'});console.log(`Wrote ${result.pack.id} with ${result.pack.locations.length} locations and ${result.actorIds.join(', ')} to ${out}`);console.log(`Next: grow it with generate --pack ${out} --card <card> --characters N --scenes N --events N`);
 }else if(command==='check'){
  // Dry run: the pack as it stands, or with every non-rejected proposal entry applied.
  const pack=readJson(required('pack')),file=arg('proposal'),proposal=file&&readJson(file),next=proposal?withProposal(pack,proposal):pack,warnings=playability(next);
  console.log(warnings.length?`${warnings.length} playability warning${warnings.length>1?'s':''}:\n- ${warnings.join('\n- ')}`:'No playability warnings.');
 }else if(command==='replay'){
  // A saved reply (<out>.failed.txt) through today's normalizer, no model call; counts default to what the reply holds.
  const pack=readJson(required('pack')),raw=readFileSync(resolve(required('reply')),'utf8'),o=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1)),n=(k,a)=>integer(k,Array.isArray(o[a])?o[a].length:0);
  const counts={locationCount:n('locations','locations'),characterCount:n('characters','characters'),sceneCount:n('scenes','scenes'),objectCount:n('objects','objects'),itemCount:n('items','items'),activityCount:n('activities','activities'),eventCount:n('events','events'),templateCount:n('templates','templates')},candidate=normalizeCandidate(raw,pack,counts);
  const before=new Set(playability(pack));candidate.warnings=[...(candidate.warnings||[]),...playability(mergeApproved(pack,Object.fromEntries(KINDS.map(k=>[k,candidate[k].map(value=>({status:'approved',value}))])))).filter(x=>!before.has(x))];
  console.log(`Kept ${KINDS.filter(k=>candidate[k].length).map(k=>`${candidate[k].length} ${k}`).join(', ')||'nothing'}`);for(const [k,label] of [['skipped','Skipped copies'],['dropped','Dropped'],['warnings','Warnings']])if(candidate[k].length)console.log(`${label}:\n- ${candidate[k].join('\n- ')}`);
  const file=arg('out');if(file){const out=resolve(file);writeFileSync(out,JSON.stringify(createProposal(pack,candidate,{brief:`replayed from ${required('reply')}`,counts,model:'replay'}),null,2)+'\n',{flag:'wx'});console.log(`Wrote ${out}`);}
 }else if(command==='apply'){
  const pack=readJson(required('pack')),proposal=readJson(required('proposal')),next=applyProposal(pack,proposal),out=resolve(required('out'));writeFileSync(out,JSON.stringify(next,null,2)+'\n',{flag:'wx'});const approved=list=>(list||[]).filter(x=>x.status==='approved').length;console.log(`Wrote validated pack to ${out} (${KINDS.filter(k=>proposal[k]?.length).map(k=>`${approved(proposal[k])} ${k}`).join(', ')} applied).`);
 }else throw Error(`Unknown command: ${command}`);
}catch(error){console.error(`ERROR: ${error.message}`);process.exitCode=1;}
