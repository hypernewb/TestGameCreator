// M2 proof 1: strip campus to its picks (cast templates, targets, ids, world data, premise), let the cloud drafter write every
// text slot, then validate. Usage: node scripts/draft-world.mjs [--dry] [--rounds 2] [--out file.json] [--style "..."]
// --card file.png|json: a SillyTavern card seeds love interest 1 and the premise (its scenario, unless --premise is given).
// --premise "..." [--heroines 4]: M2 structure pass first (the model proposes places, items, cast), then the same draft pass.
// --reactions: M5, draft only each love interest's 4 activity reaction lines and print them as JSON (pasted into packs/campus.json actors).
// --director [grounded|soap|melodrama]: M3, keep campus text as is and draft only the director beats; they are written to packs/director/campus.json.
// Needs OPENROUTER_API_KEY in .env (never printed). --dry uses an offline echo model.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {specFromPack} from '../packages/cards/world-assembly.mjs';
import {structureOnly,draftWorld} from '../packages/cards/world-draft.mjs';
import {proposeWorld,cardSeed} from '../packages/cards/world-structure.mjs';
import {openRouterComplete} from '../packages/cards/openrouter.mjs';
import {validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

if(!process.env.OPENROUTER_API_KEY&&existsSync('.env'))process.loadEnvFile('.env');
const arg=(k,d)=>{const i=process.argv.indexOf(`--${k}`);return i<0?d:process.argv[i+1];},dry=process.argv.includes('--dry');
const seed=arg('card')&&cardSeed(readFileSync(arg('card'))),premise=arg('premise')||seed&&(seed.premise||`A love story with ${seed.name}.`),out=arg('out',join(tmpdir(),`draft-${seed?'card':premise?'premise':'campus'}-${Date.now()}.json`)),rounds=+arg('rounds',2),style=arg('style');
const CAST={jana:{temperament:'torn',pace:'steady'},monique:{temperament:'guarded',pace:'slow'},nova:{temperament:'prickly',pace:'casual'},abigail:{temperament:'practical',pace:'easy'}};
const use={in:0,out:0},echo=async m=>JSON.stringify(Object.fromEntries([...m.at(-1).content.matchAll(/^"([^"]+)":/gm)].map(x=>[x[1],`text for ${x[1]}`])));
const complete=dry?echo:openRouterComplete({usage:u=>{use.in+=u.prompt_tokens||0;use.out+=u.completion_tokens||0;}});
const t0=Date.now();
let spec,proposal,notes=[];
if(premise){if(dry)throw new Error('--dry has no offline proposer; drop --premise');({spec,proposal,notes}=await proposeWorld(premise,{complete,heroines:+arg('heroines',4),style,...(seed?{card:{name:seed.name,text:seed.text}}:{})}));
 console.log(`proposal: ${proposal.title} | ${spec.world.locations.length} places, ${spec.world.items.length} items, ${spec.world.activities.length} activities | ${spec.heroines.map(h=>`${h.actor.name} ${h.actor.age} ${h.temperament}/${h.pace} (${h.topic})`).join(', ')}`);for(const n of notes)console.log(`  note: ${n}`);}
else if(process.argv.includes('--director')){const t=arg('director');spec={...specFromPack(JSON.parse(readFileSync('packs/campus.json','utf8')),{cast:CAST}),director:{tone:/^(grounded|soap|melodrama)$/.test(t||'')?t:'soap'}};}
else if(process.argv.includes('--reactions'))spec=specFromPack(JSON.parse(readFileSync('packs/campus.json','utf8')),{cast:CAST}),spec.heroines.forEach(h=>delete h.actor.reactions);
else spec=structureOnly(specFromPack(JSON.parse(readFileSync('packs/campus.json','utf8')),{cast:CAST}));
const r=await draftWorld(spec,{complete,rounds,style,onBatch:b=>console.log(`${b.batch.padEnd(18)} ${b.filled}/${b.asked}${b.error?` (${b.error})`:""}`)});
let ok='valid';try{validatePack(r.pack,registry);}catch(e){ok=`INVALID: ${e.message}`;}
if(spec.director&&!premise&&!r.missing.length&&!dry)writeFileSync('packs/director/campus.json',JSON.stringify(r.spec.director,null,1)+'\n');
if(process.argv.includes('--reactions'))console.log(JSON.stringify(Object.fromEntries(r.spec.heroines.map(h=>[h.id,h.actor.reactions])),null,1));
writeFileSync(out,JSON.stringify({proposal,notes,spec:r.spec,pack:r.pack,missing:r.missing},null,1));
const get=p=>p.split('.').reduce((o,k)=>Array.isArray(o)&&o[0]?.temperament?o.find(h=>h.id===k):o?.[k],r.spec);
const [h0,h1]=r.spec.heroines.map(h=>h.id);
for(const p of ['title',`heroines.${h0}.actor.description`,`heroines.${h1||h0}.rungs.talk.opening`,`heroines.${h0}.rungs.date.choices.2.label`,`heroines.${h1||h0}.rungs.night.stop`])console.log(`  ${p}: ${JSON.stringify(get(p))}`);
console.log(`${ok} | missing ${r.missing.length} | calls ${r.calls} | tokens ${use.in} in / ${use.out} out ≈ $${(use.in*0.3e-6+use.out*1.2e-6).toFixed(4)} | ${((Date.now()-t0)/1000).toFixed(0)}s | ${out}`);
