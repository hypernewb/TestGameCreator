// Generate reviewable character/scene batches, then apply only entries marked approved.
// Run with --help for examples.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {normalizeLocalEndpoint,validateLocalModel} from '../packages/ai/local-settings.mjs';
import {normalizeCandidate,createProposal,applyProposal,messagesFor,candidateSchema,KINDS} from '../packages/ai/bulk-authoring.mjs';
import {cardBrief,seedMessages,seedPack,seedSchema,castOf} from '../packages/cards/card-world.mjs';
import {readCard} from '../packages/cards/character-card.mjs';

const argv=process.argv.slice(2),command=argv.shift();
const arg=(name,fallback)=>{const i=argv.indexOf(`--${name}`);return i<0?fallback:argv[i+1];};
const required=name=>{const value=arg(name);if(!value)throw Error(`Missing --${name}`);return value;};
const readJson=file=>JSON.parse(readFileSync(resolve(file),'utf8'));
const integer=(name,fallback)=>{const n=Number(arg(name,fallback));if(!Number.isInteger(n)||n<0||n>100)throw Error(`--${name} must be an integer from 0 to 100`);return n;};
const help=()=>console.log(`AI-assisted bulk authoring\n\nStart a new pack from a SillyTavern/JanitorAI/Chub character card (PNG or JSON); the AI drafts a map that fits the card and the card becomes a character:\n  node scripts/ai-bulk-author.mjs seed --card cards/mara.png --locations 5 --model MODEL --out packs/mara.json [--brief notes.md]\n\nGrow a pack around a card (--card replaces or adds to --brief; --locations and --events add new places and one-off timed happenings):\n  node scripts/ai-bulk-author.mjs generate --pack packs/mara.json --card cards/mara.png --locations 3 --characters 4 --scenes 6 --events 4 --model MODEL --out proposals/mara.json\n\nGenerate a review file:\n  node scripts/ai-bulk-author.mjs generate --pack packs/my-game.json --brief briefs/cast.md --characters 6 --scenes 12 --model MODEL --out proposals/batch.json\n\nPopulate the world (things to examine or use, hidden finds, ways to train stats):\n  node scripts/ai-bulk-author.mjs generate --pack packs/my-game.json --brief briefs/world.md --objects 8 --items 4 --activities 6 --model MODEL --out proposals/world.json\nHidden items list 2-3 candidate spots (hideIn); each new campaign picks one from its seed, so replays differ but stay reproducible.\n\nReview the file and change status from "pending" to "approved" for entries you want. Then apply to a new pack:\n  node scripts/ai-bulk-author.mjs apply --pack packs/my-game.json --proposal proposals/batch.json --out packs/my-game-expanded.json\n\nGeneration uses an OpenAI-compatible local endpoint. Default: http://127.0.0.1:1234/v1. STORY_ENDPOINT and STORY_MODEL are also accepted.`);
const briefFile=()=>{const f=arg('brief');if(!f)return '';const b=readFileSync(resolve(f),'utf8').trim();if(!b)throw Error('Brief is empty');return b;};
const endpointModel=()=>[arg('endpoint',process.env.STORY_ENDPOINT||'http://127.0.0.1:1234/v1'),validateLocalModel(arg('model',process.env.STORY_MODEL||''))];

async function complete(endpoint,model,messages,schema){
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
  const counts={locationCount:integer('locations',0),characterCount:integer('characters',0),sceneCount:integer('scenes',0),objectCount:integer('objects',0),itemCount:integer('items',0),activityCount:integer('activities',0),eventCount:integer('events',0)};if(!Object.values(counts).some(Boolean))throw Error('Request at least one location, character, scene, object, item, activity or event');
  if(counts.sceneCount&&!pack.modules?.['story.scenes'])throw Error('The pack must enable story.scenes before generating scripted scenes');
  const [endpoint,model]=endpointModel();
  const schema=candidateSchema(pack,counts);let raw=await complete(endpoint,model,messagesFor(pack,brief,counts),schema),candidate;
  try{candidate=normalizeCandidate(raw,pack,counts,{strict:true});}catch(first){console.error(`First candidate failed validation: ${first.message}\nRequesting one repair…`);raw=await complete(endpoint,model,messagesFor(pack,brief,counts,first.message),schema);candidate=keepRaw(raw,()=>normalizeCandidate(raw,pack,counts));}
  if(candidate.skipped?.length)console.error(`Skipped copies of existing content: ${candidate.skipped.join(', ')}`);
  const out=resolve(required('out'));writeFileSync(out,JSON.stringify(createProposal(pack,candidate,{brief,counts,model}),null,2)+'\n',{flag:'wx'});console.log(`Wrote ${KINDS.filter(k=>candidate[k].length).map(k=>`${candidate[k].length} ${k}`).join(', ')} to ${out}`);console.log('Review each entry, change selected statuses to "approved", then run the apply command.');
 }else if(command==='seed'){
  const card=readFileSync(resolve(required('card'))),brief=briefFile(),locationCount=integer('locations',4),out=resolve(required('out'));if(locationCount<1)throw Error('--locations must be at least 1');
  const [endpoint,model]=endpointModel(),opts={locationCount,brief},schema=seedSchema(card,opts);let raw=await complete(endpoint,model,seedMessages(card,opts),schema),result;
  try{result=seedPack(raw,card,{locationCount,id:arg('id')});}catch(first){console.error(`First map failed validation: ${first.message}\nRequesting one repair…`);raw=await complete(endpoint,model,seedMessages(card,opts,first.message),schema);result=keepRaw(raw,()=>seedPack(raw,card,{locationCount,id:arg('id')}));}
  writeFileSync(out,JSON.stringify(result.pack,null,2)+'\n',{flag:'wx'});console.log(`Wrote ${result.pack.id} with ${result.pack.locations.length} locations and ${result.actorIds.join(', ')} to ${out}`);console.log(`Next: grow it with generate --pack ${out} --card <card> --characters N --scenes N --events N`);
 }else if(command==='apply'){
  const pack=readJson(required('pack')),proposal=readJson(required('proposal')),next=applyProposal(pack,proposal),out=resolve(required('out'));writeFileSync(out,JSON.stringify(next,null,2)+'\n',{flag:'wx'});const approved=list=>(list||[]).filter(x=>x.status==='approved').length;console.log(`Wrote validated pack to ${out} (${KINDS.filter(k=>proposal[k]?.length).map(k=>`${approved(proposal[k])} ${k}`).join(', ')} applied).`);
 }else throw Error(`Unknown command: ${command}`);
}catch(error){console.error(`ERROR: ${error.message}`);process.exitCode=1;}
