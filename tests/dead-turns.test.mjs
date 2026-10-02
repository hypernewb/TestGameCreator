import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {funMetrics} from '../packages/testing/fun-metrics.mjs';

const load=f=>JSON.parse(readFileSync(new URL(`../packs/${f}`,import.meta.url),'utf8'));
const run=(s,p,type,args,id)=>execute(s,{type,args,id,actorId:p.playerId,expectedRevision:s.revision},p,registry).state;

const base=load('campus.json'),hours={...base,actors:base.actors.map(a=>a.id==='jana'?{...a,likes:['being challenged'],dislikes:[],backstory:''}:a)};
const withJana=()=>{const s=structuredClone(createWorld(hours,registry,'dead'));s.actors.player.location=s.actors.jana.location;return s;};
const talk=s=>actions(s,hours,registry).filter(a=>a.type==='social.speak'&&a.args.target==='jana');

test('asking about a like teaches it once, and the fact is a live event',()=>{
 let s=run(withJana(),hours,'social.speak',{target:'jana',text:'How are things going?'},'t1');
 const [ask]=talk(s);assert.match(ask.label,/being challenged/);
 s=run(s,hours,'social.speak',ask.args,'t2');
 const learned=Object.values(s.turns).at(-1).events.find(e=>e.type==='social.topicLearned');
 assert.equal(learned.payload.topic,'being challenged');assert.deepEqual(s.modules['social.conversation'].learned.jana,['being challenged']);
 s=run(s,hours,'social.speak',{target:'jana',text:'So, being challenged, huh?'},'t3');
 assert.ok(!Object.values(s.turns).at(-1).events.some(e=>e.type==='social.topicLearned'),'already known');
});

test('out of topics, "Go on." becomes one "what are you up to later" a day that points somewhere, then nothing canned',()=>{
 let s=run(withJana(),hours,'social.speak',{target:'jana',text:'How are things going?'},'t1');
 s=run(s,hours,'social.speak',talk(s)[0].args,'t2');
 const [later]=talk(s);assert.equal(later.label,"Ask Jana what they're up to later");
 s=run(s,hours,'social.speak',later.args,'t3');
 const hint=Object.values(s.turns).at(-1).events.find(e=>e.type==='social.hintGiven');
 assert.ok(hint&&hint.payload.location!==s.actors.jana.location,'names a different place');assert.match(hint.payload.text,/^Jana will be at /);
 assert.deepEqual(talk(s),[],'no canned talk button left today');
 assert.ok(!talk(s).some(a=>a.args.text==='Go on.'));
});

const chain=load('event-chain.json'),cued={...chain,scriptedScenes:[...chain.scriptedScenes,{id:'quiet-knock',title:'A knock',opening:'Someone knocks on the quiet room door.',trigger:{event:'core.moved',match:{to:'quiet-room'}},when:{location:'quiet-room',minTick:3},choices:[{id:'help',label:'Help',result:'You help.'}]}]};
const moves=s=>actions(s,cued,registry).filter(a=>a.type==='core.move').map(a=>a.label);

test('an exit says so when arriving there would start a scene, without duplicating the exit',()=>{
 const s=structuredClone(createWorld(cued,registry,'mv'));s.actors.player.location='hub';s.tick=0;
 const quiet=cued.locations.find(l=>l.id==='quiet-room').name;assert.ok(!moves(s).includes(`Go to ${quiet} (something is going on there)`),'not ready yet');
 s.tick=5;const list=moves(s);
 assert.ok(list.includes(`Go to ${quiet} (something is going on there)`),JSON.stringify(list));
 assert.equal(list.filter(l=>l.startsWith(`Go to ${quiet}`)).length,1);
});

test('typed, new speech the game answers is never a dead turn; an unanswered line or a canned repeat is',()=>{
 const turn=(id,input,repeat,answered)=>({id,command:{type:'social.speak'},input:input?'hi':undefined,events:[{type:'social.spoke',payload:{repeat}},...(answered?[{type:'social.chemistryChanged',payload:{character:'jana',delta:1}}]:[])]});
 const m=funMetrics({actors:{},turns:{a:turn('a',true,false,true),b:turn('b',false,false),c:turn('c',true,true),d:turn('d',true,false,false)}},{playerId:'player'});
 assert.equal(m.deadTurns,3);assert.equal(m.inputLost,2);
});
