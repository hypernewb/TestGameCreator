import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {prepareSceneRequest} from '../packages/ai/service.mjs';
import {estimateTokens} from '../packages/ai/budget.mjs';
// G2: a fact selected by the allocator must reach the rendered KNOWN section; privacy still filters.
// G3: the player profile is in CURRENT STATE, budgeted, and carries no invented actions.
const LONG='PLAYER-LONG '+'She keeps a notebook of small kindnesses and a tin of mints. '.repeat(30);
const pack=(desc)=>({schemaVersion:1,id:'g2g3',title:'G2G3 fixture',version:'0.1.0',playerId:'player',modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','story.facts':'0.1.0','story.scenes':'0.1.0'},locations:[{id:'room',name:'Room',exits:[{to:'away'}]},{id:'away',name:'Away',exits:[{to:'room'}]}],actors:[{id:'player',name:'Player',pronouns:'she/her',location:'room',description:desc},{id:'owner',name:'Owner',location:'room',personality:'Patient and precise.',goal:'Organize the archive.'},{id:'bystander',name:'Bystander',location:'away'}],facts:[{id:'auth-cellar',text:'Lantern oil is stored in the cellar.',knownBy:'public'},{id:'auth-damp',text:'The archive cellar is damp.',knownBy:'public'},{id:'auth-private',text:'G2PRIVATE: Bystander hides a sealed letter.',knownBy:['bystander']}],lorebook:[],scriptedScenes:[]});
const say=(s,p,id,text)=>{const t=execute(s,{id,actorId:'player',expectedRevision:s.revision,type:'core.scene',args:{characters:['owner'],location:'room',activity:'talk',text}},p,registry);t.turn.status='complete';t.turn.narrative='Owner looks up.';return t.state;};
async function probe(desc,text){
 const p=pack(desc);let s=createWorld(p,registry,'g2g3');
 s=say(s,p,'old','Hello there');
 s.turns.old.generatedFacts=[{id:'old.fact-0',subject:'owner',text:'G2GEN Owner opens the archive at sunset.',quote:'archive',source:'old',knownBy:['player','owner']},{id:'old.fact-1',subject:'bystander',text:'G2GENPRIVATE bystander hides a receipt.',quote:'archive',source:'old',knownBy:['bystander']}];
 const t=execute(s,{id:'probe',actorId:'player',expectedRevision:s.revision,type:'core.scene',args:{characters:['owner'],location:'room',activity:'talk',text}},p,registry);
 const a=await prepareSceneRequest(t.state,p,t.turn,{contextWindow:8192,maxTokens:512});
 return {a,prompt:a.messages.map(m=>m.content).join('\n')};
}

test('G2: an authored fact selected by the allocator reaches KNOWN with no cast or player name in it',async()=>{
 const {a,prompt}=await probe('Plain player.','Show me the archive cellar');
 assert.ok(a.context.facts.some(f=>f.id==='auth-damp'));
 assert.ok(prompt.includes('The archive cellar is damp.'));
});

test('G2: a generated fact selected for the prompt is rendered in KNOWN',async()=>{
 const {prompt}=await probe('Plain player.','Owner archive notes');
 assert.ok(prompt.includes('G2GEN Owner opens the archive at sunset.'));
});

test('G2/privacy: facts private to another character never reach the prompt',async()=>{
 const {a,prompt}=await probe('Plain player.','Owner archive notes');
 assert.ok(!a.context.facts.some(f=>f.id==='auth-private'));
 assert.ok(!prompt.includes('G2PRIVATE'));
 assert.ok(!prompt.includes('G2GENPRIVATE'));
});

test('G3: player profile appears in CURRENT STATE with name, pronouns and description',async()=>{
 const {prompt}=await probe('G3-DESC She wears a grey coat.','Owner archive notes');
 const line=prompt.split('\n').find(l=>l.startsWith('PLAYER — '));
 assert.ok(line,'player line missing');
 assert.ok(line.includes('Player (she/her)'));
 assert.ok(line.includes('G3-DESC She wears a grey coat.'));
 assert.ok(line.includes('never add actions, words or feelings'));
});

test('G3: a long player description is capped so the profile stays within a small token budget',async()=>{
 const {prompt}=await probe(LONG,'Owner archive notes');
 const line=prompt.split('\n').find(l=>l.startsWith('PLAYER — '));
 assert.ok(line);
 assert.ok(estimateTokens(line)<=120,`profile costs ${estimateTokens(line)} tokens`);
 assert.ok(line.length<600);
});

test('G3: the profile invents no player actions, speech or feelings',async()=>{
 const {prompt}=await probe('Plain player.','Owner archive notes');
 const line=prompt.split('\n').find(l=>l.startsWith('PLAYER — '));
 assert.ok(line);
 assert.ok(!/\b(smiles|nods|says|feels|laughs|sighs|blushes)\b/i.test(line));
});
