import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {venusStyleMessages} from '../vendor/venus/venusStylePrompt.mjs';
// gameProject.initiativeEvery on a non-campus pack: a harbor with a ferry pilot who wants something of her own.
const harbor=gp=>({schemaVersion:1,id:'harbor',version:'0.1.0',title:'Harbor',playerId:'me',modules:{},gameProject:{premise:'A harbor town.',setting:'Docks.',conversationStyle:'continuous',ai:{intent:'',scene:'',daypart:''},...gp},locations:[{id:'dock',name:'Dock',description:'A windy dock.',exits:[]}],actors:[{id:'me',name:'You',location:'dock'},{id:'olu',name:'Olu',location:'dock',goal:'to buy back the old ferry'}],items:[]});
const play=async(pack,inputs)=>{let s=createWorld(pack,{});const seen=[],provider=new MockProvider(),store={load:()=>structuredClone(s),commit:n=>{s=n;},narrative:(id,t,text,meta)=>{Object.assign(s.turns[t],{narrative:text,status:'complete'},meta);return structuredClone(s);}};provider.generateScene=async c=>{seen.push(c);return {lines:[{speaker:'olu',text:'Wind’s up.'}],acts:[]};};const service=new GameService(store,{harbor:pack},{},provider);let n=0;for(const input of inputs)await service.act('c',{id:`t${++n}`,expectedRevision:s.revision,input});return seen;};
const talk=['I talk to Olu','How is the water?','Busy day?','Seen any storms?','What about the nets?','Any news?','Where is everyone?'];
test('a present character with a goal raises it on the cadence, unprompted; 0 turns it off',async()=>{
 const seen=await play(harbor({}),talk),hits=seen.map(c=>c.wantHint||'');
 assert.ok(hits.some(Boolean),'the goal surfaces at the default cadence');
 assert.ok(hits.filter(Boolean).length<seen.length/2,'not every turn');
 assert.ok(hits.filter(Boolean).every(h=>h==='Olu: wants to buy back the old ferry'));
 assert.ok(!(await play(harbor({initiativeEvery:0}),talk)).some(c=>c.wantHint),'0 = off');
 assert.ok((await play(harbor({initiativeEvery:1}),talk)).filter(c=>c.sceneHistory?.length).every(c=>c.wantHint),'1 = every exchange');
});
test('both writers render the initiative note as private direction',()=>{
 const pack=harbor({}),ctx={stagedCast:['olu'],scenePhase:'continuation',playerAction:'Any news?',sceneHistory:[{input:'Hi.',text:'Olu: Back again.'}],gameProject:pack.gameProject,wantHint:'Olu: wants to buy back the old ferry'};
 for(const build of [scenePromptMessages,venusStyleMessages]){const text=build(ctx,pack).map(m=>m.content).join(' ');assert.match(text,/bring it up in their own voice/);assert.match(text,/buy back the old ferry/);}
});
test('validation accepts 0..10 and rejects anything else',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));p.gameProject={premise:'A harbor town.',setting:'Docks.',ai:{intent:'',scene:'',daypart:''},calendar:{startDate:'2026-06-01'},initiativeEvery:2};
 validatePack(p,registry);
 for(const bad of [-1,11,1.5,'3'])assert.throws(()=>validatePack({...p,gameProject:{...p.gameProject,initiativeEvery:bad}},registry),/initiativeEvery/);
});
