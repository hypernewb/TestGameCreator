import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {actions,clone,createWorld,execute,replay,validatePack} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';

const neutral=JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const act=(state,pack,type,args={})=>execute(state,{id:`turn-${state.revision}`,actorId:pack.playerId,type,args,expectedRevision:state.revision},pack,registry);
const scene=(id,extra={})=>({id,title:id==='open'?'Visit Ada':'Late-night invitation',opening:'Ada looks up.',stage:[],pages:[{speaker:'ada',text:'Do you have a minute?'}],trigger:{event:'core.inspected',match:{}},when:{location:'hub'},choices:[{id:'stay',label:'Stay',result:'You stay.',effects:[]}],offer:'hand',timeCost:4,...extra});

test('storylet hand offers eligible cards, explains locked cards, and only starts on selection',()=>{
 const pack=clone(neutral);delete pack.modules['world.schedule'];pack.modules['story.scenes']='0.1.0';pack.scriptedScenes=[scene('open'),scene('locked',{when:{location:'hub',flags:{invited:true}},offerHint:'Earn an invitation first.'})];
 validatePack(pack,registry);let state=createWorld(pack,registry,'storylet-hand');
 let offered=actions(state,pack,registry).filter(action=>action.storylet);assert.equal(offered.length,2);assert.equal(offered[0].enabled,true);assert.equal(offered[0].storylet.where,'Hub');assert.deepEqual(offered[0].storylet.who,['Ada']);assert.equal(offered[1].enabled,false);assert.equal(offered[1].storylet.hint,'Earn an invitation first.');
 state=act(state,pack,'core.inspect').state;assert.equal(state.modules['story.scenes'].pending,null,'hand scenes do not auto-trigger');
 const started=act(state,pack,'story.startOfferedScene',{scene:'open'});state=started.state;assert.equal(state.modules['story.scenes'].pending,'open');assert.equal(state.tick,4);assert.ok(started.turn.events.some(event=>event.type==='story.sceneSelected'));
 const restored=replay(createWorld(pack,registry,'storylet-hand'),state.events);assert.equal(restored.modules['story.scenes'].pending,'open');assert.equal(restored.tick,state.tick);
});

test('fixed run clamps time to its deadline and deterministically commits the fallback ending',()=>{
 const pack=clone(neutral);pack.modules['story.endings']='0.1.0';pack.endings=[{id:'best',name:'Best ending',priority:10,requires:{flags:{won:true}},text:'You won.'},{id:'deadline',name:'Time is up',requires:{flags:{won:true}},text:'The term ends.'}];pack.run={days:1,defaultEnding:'deadline'};
 validatePack(pack,registry);let state=createWorld(pack,registry,'fixed-run');assert.deepEqual(state.run,{startTick:0,endTick:12,days:1});
 for(let i=0;i<20&&!state.modules['story.endings'].selected;i++)state=act(state,pack,'core.wait').state;
 assert.equal(state.tick,12);assert.equal(state.modules['story.endings'].selected,'deadline');assert.throws(()=>act(state,pack,'core.wait'),/ended/);
 const restored=replay(createWorld(pack,registry,'fixed-run'),state.events);assert.equal(restored.tick,12);assert.equal(restored.modules['story.endings'].selected,'deadline');
});

test('Studio and player UI expose storylet and run-calendar controls',()=>{
 const studio=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
 assert.match(studio,/Player chooses story card/);assert.match(studio,/Campaign length in days/);assert.match(app,/storylet-card/);assert.match(app,/days left/);
});
