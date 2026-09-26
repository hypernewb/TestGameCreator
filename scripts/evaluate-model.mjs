import {readFileSync,writeFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {contextFor} from '../packages/ai/context.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
if(!process.env.STORY_ENDPOINT||!process.env.STORY_MODEL){console.error('Set STORY_ENDPOINT and STORY_MODEL first. This evaluation makes billable model calls when using a paid endpoint.');process.exit(1);}
const provider=new CompatibleProvider({endpoint:process.env.STORY_ENDPOINT,model:process.env.STORY_MODEL,key:process.env.STORY_API_KEY||'',maxRequests:100});
const pack=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete pack.modules['world.schedule'];
const cases=JSON.parse(readFileSync(new URL('../tests/model-evaluations.json',import.meta.url))),results=[];
for(const c of cases){let s=createWorld(pack,registry,'evaluation');if(c.setup==='promise'){s=execute(s,{id:'promise',actorId:pack.playerId,type:'social.speak',args:{target:'ada',text:'I promise to return your notebook.'},expectedRevision:0},pack,registry).state;for(let i=0;i<30;i++)s=execute(s,{id:`later-${i}`,actorId:pack.playerId,type:'core.wait',args:{},expectedRevision:s.revision},pack,registry).state;}
 try{const intent=await provider.interpret(c.input,contextFor(s,pack),actions(s,pack,registry));let narrative=null;if(intent.type!=='clarify'){const r=execute(s,{...intent,id:'evaluated',actorId:pack.playerId,expectedRevision:s.revision},pack,registry);narrative=await provider.narrate(contextFor(r.state,pack,intent.type==='social.speak'?intent.args.target:pack.playerId,r.turn));}results.push({id:c.id,expectedCategory:c.expected.includes(intent.type),intent,narrative,humanReview:{continuity:null,voice:null,repetition:null,notes:''}});}catch(e){results.push({id:c.id,error:e.message});}}
const path=process.argv[2]||'model-evaluation-results.json';writeFileSync(path,JSON.stringify({model:process.env.STORY_MODEL,results,usage:provider.usage},null,2));console.log(`Wrote ${results.length} cases to ${path}. Human review is required; command validation is not a narrative quality score.`);
