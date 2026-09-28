import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService,choiceFor} from '../packages/ai/service.mjs';

const opt=(choice,label,stat)=>({type:'story.choose',label:stat?`[${stat} 3/6] ${label}`:label,args:{scene:'swan',choice},...(stat?{check:{stat}}:{})});
const swan=[opt('stare','Stare it down','nerve'),opt('sandwich','Offer it half your sandwich','empathy'),opt('detour','Take the long way round')];
const pick=(input,available=swan,beat,stats)=>choiceFor(available,input,beat,stats)?.args.choice;

test('typed approach words land on the one check that tests that stat',()=>{
 assert.equal(pick('I glare back at the swan'),undefined);
 assert.equal(pick('I stared the thing out'),'stare');assert.equal(pick('staring contest, then'),'stare');
 assert.equal(pick('I crouch and gently hold out some bread'),'sandwich');
 assert.equal(pick('I walk the long way'),'detour');
});

test('negation, mixed approaches and two checks on one stat stay free text',()=>{
 assert.equal(pick('I do not stare at it'),undefined);
 assert.equal(pick('I confront it, then gently back off'),undefined);
 assert.equal(pick('I confront it',[...swan,opt('hiss','Hiss back','nerve')]),undefined);
});

test('authored choice phrases and pack stat phrases outrank the defaults',()=>{
 const beat={choices:[{id:'stare',phrases:['square up']},{id:'sandwich',phrases:['bread','feed it']},{id:'detour'}]};
 assert.equal(pick('I square up to it',swan,beat),'stare');assert.equal(pick('I feed it a crust',swan,beat),'sandwich');
 const stats=[{id:'nerve',phrases:['puff up']},{id:'empathy'}];
 assert.equal(pick('I puff up my chest',swan,null,stats),'stare');assert.equal(pick('I confront it',swan,null,stats),undefined);assert.equal(pick('I confront it'),'stare');
});

test('a typed approach in a live scene resolves the check instead of free replying',async()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));delete p.modules['world.schedule'];Object.assign(p.modules,{'story.scenes':'0.1.0','character.stats':'0.1.0'});
 p.statDefinitions=[{id:'nerve',name:'Nerve',min:0,max:10,visibility:'public'},{id:'empathy',name:'Empathy',min:0,max:10,visibility:'public'}];p.initialStats=[{character:'player',stat:'nerve',value:7}];
 p.scriptedScenes=[{id:'swan',title:'Right of way',opening:'A swan blocks the path.',trigger:{event:'core.inspected',match:{}},pages:[{speaker:'ada',text:'It is looking at you.'}],choices:[{id:'stare',label:'Stare it down',result:'The swan blinks first.',check:{stat:'nerve',target:6,fail:{result:'The swan wins.'}},phrases:['square up']},{id:'sandwich',label:'Offer it half your sandwich',result:'It lets you pass.',check:{stat:'empathy',target:5,fail:{result:'It takes the sandwich and your pride.'}}},{id:'detour',label:'Take the long way round',result:'Discretion.'}]}];
 validatePack(p,registry);assert.throws(()=>validatePack({...p,scriptedScenes:[{...p.scriptedScenes[0],choices:[{...p.scriptedScenes[0].choices[0],phrases:'square up'}]}]},registry),/phrases/);
 assert.throws(()=>validatePack({...p,statDefinitions:[{...p.statDefinitions[0],phrases:[3]},p.statDefinitions[1]]},registry),/phrases/);
 let calls=0;const provider={name:'probe',async generateScene(){calls++;return {lines:[{speaker:'ada',text:'Well?'}]};}};
 const store=new Store();store.insert(createWorld(p,registry,'free-check'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{await service.act('free-check',{id:'open',expectedRevision:0,command:{type:'core.inspect',args:{}}});
  const r=await service.act('free-check',{id:'glare',expectedRevision:1,input:'I plant my feet and stare the swan out'});
  assert.equal(r.turn.command.type,'story.choose');assert.equal(r.turn.command.args.choice,'stare');assert.equal(r.turn.input,'I plant my feet and stare the swan out');
  assert.ok(r.turn.events.some(e=>e.type==='story.checkResolved'&&e.payload.passed));assert.match(r.turn.narrative,/blinks first/);assert.equal(r.state.modules['story.scenes'].pending,null);assert.equal(calls,0);
 }finally{store.close();}
});
