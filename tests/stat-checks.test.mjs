import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,replay,clone,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {analyzeSceneGraphs} from '../packages/modules/scenes.mjs';
const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
function harness(p){let s=createWorld(p,registry,'test');return {get state(){return s;},act(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;}};}
const ev=(r,type)=>r.turn.events.find(e=>e.type===type);

function checkPack({nerve=4,learn=1}={}){
 const p=clone(neutral);Object.assign(p.modules,{'character.stats':'0.1.0','story.scenes':'0.1.0','items.equipment':'0.1.0'});
 p.statDefinitions=[{id:'nerve',name:'Nerve',min:0,max:20,visibility:'public',learnFromFailure:learn,ranks:[{min:0,name:'Shy'},{min:5,name:'Steady'},{min:10,name:'Bold'}]}];
 p.initialStats=[{character:p.playerId,stat:'nerve',value:nerve}];
 p.equipmentSlots=['accessory'];Object.assign(p.items.find(i=>i.id==='token'),{slot:'accessory',statBonus:{nerve:2}});
 p.activities=[{id:'open-mic',name:'Open mic',description:'You survive the open mic.',location:'hub',duration:2,effects:[{type:'stat',stat:'nerve',delta:2}]},{id:'drink',name:'Have a drink',description:'Warmth in the chest.',location:'hub',duration:0,effects:[{type:'flag',id:'had-drink',value:true}]}];
 p.scriptedScenes=[{id:'ask',title:'The ask',opening:'Ada is waiting for you to say it.',trigger:{event:'core.inspected',match:{location:'hub'}},
  choices:[{id:'bold',label:'Ask her out, plainly',result:'She says yes.',next:'yes',effects:[{type:'flag',id:'date-set',value:true}],
   check:{stat:'nerve',target:10,modifiers:[{when:{flags:{'had-drink':true}},value:3,label:'Liquid courage'}],fail:{result:'The words come out sideways; she laughs, kindly.',next:'laugh',effects:[{type:'flag',id:'fumbled',value:true}]}}},
   {id:'wait',label:'Say nothing',result:'The moment passes.'}],
  beats:[{id:'yes',opening:'She is smiling.',choices:[{id:'ok',label:'Smile back',result:'Done.'}]},{id:'laugh',opening:'She is still laughing.',choices:[{id:'ok',label:'Laugh along',result:'Done.'}]}]}];
 validatePack(p,registry);return p;
}

test('a stat check shows its requirement and fails forward into its own branch',()=>{
 const p=checkPack(),h=harness(p);h.act('core.inspect');
 const a=actions(h.state,p,registry).find(x=>x.args?.choice==='bold');assert.match(a.label,/^\[Nerve · Bold ✗\] Ask her out/);assert.equal(a.check.value,4);assert.equal(a.check.passed,false);assert.equal(a.disabledReason,undefined,'a failing check is still choosable');
 const r=h.act('story.choose',{scene:'ask',choice:'bold'});
 assert.equal(ev(r,'story.checkResolved').payload.passed,false);assert.equal(ev(r,'story.choiceResolved').payload.text,'The words come out sideways; she laughs, kindly.');
 assert.equal(h.state.flags.fumbled,true);assert.equal(h.state.flags['date-set'],undefined);assert.equal(h.state.modules['story.scenes'].pendingBeat,'laugh');
 const learned=ev(r,'character.statChanged');assert.equal(learned.payload.delta,1);assert.equal(learned.payload.reason,'learned from a failed check');assert.equal(h.state.modules['character.stats'].values['player--nerve'],5);
 assert.deepEqual(replay(createWorld(p,registry,'test'),h.state.events).modules,h.state.modules);
});

test('gear and situational modifiers push a check over its target',()=>{
 const p=checkPack({nerve:6}),h=harness(p);h.act('core.move',{to:'workshop'});h.act('items.take',{item:'token'});h.act('items.equip',{item:'token'});h.act('core.move',{to:'hub'});
 h.act('core.inspect');const before=actions(h.state,p,registry).find(x=>x.args?.choice==='bold');assert.equal(before.check.value,8);assert.deepEqual(before.check.modifiers,[{label:'Brass token',value:2}]);
 h.act('story.leave',{scene:'ask'});const g=h;g.act('core.scene',{text:'a drink',location:'hub',characters:[],activity:'other',activityId:'drink'});g.act('core.inspect');
 const a=actions(g.state,p,registry).find(x=>x.args?.choice==='bold');assert.match(a.label,/✓/);assert.equal(a.check.value,11);
 const r=g.act('story.choose',{scene:'ask',choice:'bold'});assert.equal(ev(r,'story.checkResolved').payload.passed,true);assert.equal(g.state.flags['date-set'],true);assert.equal(g.state.modules['story.scenes'].pendingBeat,'yes');assert.equal(ev(r,'character.statChanged'),undefined,'passing teaches nothing');
});

test('training activities raise stats and announce rank-ups',()=>{
 const p=checkPack({nerve:4}),h=harness(p);
 const r=h.act('core.scene',{text:'I do the open mic',location:'hub',characters:[],activity:'other',activityId:'open-mic'});
 const up=ev(r,'character.statChanged');assert.equal(up.payload.rankUp,true);assert.equal(up.payload.rank,'Steady');assert.equal(up.payload.text,'Your Nerve rose to Steady.');assert.equal(h.state.modules['character.stats'].values['player--nerve'],6);
 const again=h.act('core.scene',{text:'again',location:'hub',characters:[],activity:'other',activityId:'open-mic'});assert.equal(ev(again,'character.statChanged').payload.text,'Nerve +2 · Steady');
});

test('stat check validation rejects checks that could strand or confuse the player',()=>{
 const bad=f=>{const p=checkPack();f(p.scriptedScenes[0].choices[0].check,p);assert.throws(()=>validatePack(p,registry));};
 bad(c=>{delete c.fail;});bad(c=>{c.fail.result='';});bad(c=>{c.stat='charm';});bad(c=>{c.target=99;});bad(c=>{c.fail.next='nowhere';});bad(c=>{c.modifiers[0].value=0;});bad(c=>{c.fail.effects=[{type:'explode'}];});
 bad((c,p)=>{p.statDefinitions[0].ranks=[{min:5,name:'A'},{min:5,name:'B'}];});bad((c,p)=>{p.items.find(i=>i.id==='notebook').statBonus={nerve:1};});bad((c,p)=>{p.activities[0].effects[0].delta=9;});
 const graph=analyzeSceneGraphs(checkPack()).find(x=>x.scene==='ask');assert.ok(graph.edges.some(e=>e.choice==='bold:fail'&&e.to==='laugh'));assert.deepEqual(graph.unreachable,[]);
});
