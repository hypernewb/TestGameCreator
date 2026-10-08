import test from 'node:test';
import assert from 'node:assert/strict';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {beatDirection} from '../packages/ai/beats.mjs';

const pack={playerId:'player',actors:[{id:'player',name:'You'},{id:'jana',name:'Jana',personality:'warm and playful'}],locations:[],statDefinitions:[{id:'charm',name:'Charm',min:0,max:20,ranks:[{min:0,name:'Awkward'},{min:8,name:'Magnetic'}]}]};
const context=(charm=0)=>({stagedCast:['jana'],scenePhase:'continuation',playerAction:'You make it surprisingly difficult to play it cool.',sceneHistory:[{input:'Hi Jana.',text:'Jana: Hello again.'}],characterStats:[{character:'player',values:{charm}}]});

test('ordinary writers preserve meaning and rank display without compulsory stat-colored recaps',()=>{for(const sceneWriter of ['framework','venus'])for(const scenePhase of ['opening','continuation'])for(const [charm,rank] of [[0,'Awkward'],[8,'Magnetic']]){const c={...context(charm),sceneWriter,scenePhase},before=structuredClone(c),[sys,user]=scenePromptMessages(c,pack);assert.doesNotMatch(sys.content,/PLAYER DELIVERY:|stat-ranked delivery|low Charm adds/);assert.match(sys.content,/Do not recap earlier turns or add stat-colored delivery/);assert.match(sys.content,/Player contribution ownership is given by type\/source/);assert.match(sys.content,/consent, promises, travel and spending require/);assert.ok(user.content.includes(c.playerAction));assert.ok(user.content.includes(`Charm: ${rank} (${charm})`));assert.deepEqual(c,before);}});
test('ordinary beat direction responds to meaning without mandatory recap or ranked delivery',()=>{const d=beatDirection(context(),pack,'42');assert.match(d,/respond to what the player means/);assert.doesNotMatch(d,/recasting|stat-ranked|one short narration clause/);assert.equal(d,beatDirection(context(),pack,'different'));});
test('missing stats keep neutral delivery and solo or authored scenes get no typed delivery instruction',()=>{
 const c=context();delete c.characterStats;
 assert.match(scenePromptMessages(c,pack)[0].content,/Do not recap earlier turns or add stat-colored delivery/);
 assert.doesNotMatch(scenePromptMessages(c,pack)[1].content,/YOU —/);
 for(const extra of [{stagedCast:[],scenePhase:'solo'},{playerAction:''},{scriptedScene:true},{first:{checkpoint:0}}])assert.doesNotMatch(scenePromptMessages({...c,...extra},pack)[0].content,/PLAYER DELIVERY:/);
});

test('provider preserves rank context and submitted indirect narration without mandatory delivery instructions',async()=>{
 const lines=[{speaker:'',text:'You tell Jana she makes playing it cool difficult, your teasing admission arriving a beat too quickly.'},{speaker:'jana',text:'That sounded almost rehearsed. Almost.'}],c=context();let sent;
 const p=new CompatibleProvider({endpoint:'https://example.test/v1/chat/completions',model:'mock',fetchImpl:async(_,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({lines})}}]}),{status:200,headers:{'content-type':'application/json'}});}});
 const result=await p.generateScene(c,pack);
 assert.match(sent.messages[0].content,/Player contribution ownership is given by type\/source/);assert.doesNotMatch(sent.messages[0].content,/PLAYER DELIVERY:/);assert.match(sent.messages[1].content,/Charm: Awkward \(0\)/);
 assert.deepEqual(result.lines,lines);assert.equal(p.requests,1);assert.deepEqual(result.lintTrace||[],[]);
});
