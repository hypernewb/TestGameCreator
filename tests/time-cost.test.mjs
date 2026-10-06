import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actionCost,actions,createWorld,execute,replay} from '../packages/core/engine.mjs';
import {timeCost,optionCost} from '../public/calendar.mjs';
import {freeConversation,conversationCommand} from '../public/turn-presentation.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const pack=(extra={})=>({schemaVersion:1,id:'test',title:'Test',version:'0.1.0',modules:{},playerId:'you',locations:[{id:'home',name:'Home',exits:[{to:'gym'}]},{id:'gym',name:'Gym',exits:[{to:'home'}]}],actors:[{id:'you',name:'You',location:'home'},{id:'friend',name:'Friend',location:'home'}],activities:[{id:'gym-session',name:'Gym',description:'Train',location:'gym',duration:2,effects:[]}],...extra,...(extra.gameProject?{gameProject:{premise:'Test',setting:'Test',ai:{intent:'',scene:'',daypart:''},...extra.gameProject}}:{})});
const scene=(args={})=>({type:'core.scene',args:{text:'Gym',location:'gym',characters:[],activity:'other',activityId:'gym-session',...args}});
test('cost formatting uses pack minutes, campus default and legacy ticks',()=>{
 assert.deepEqual(timeCost(2,{tickMinutes:30}),{ticks:2,display:'1h'});assert.equal(timeCost(3,{tickMinutes:25}).display,'1h 15m');assert.equal(timeCost(0,{tickMinutes:30}).display,'0m');assert.equal(timeCost(1,{id:'campus'}).display,'1h');assert.equal(timeCost(2,{}).display,'2 ticks');assert.equal(timeCost(1,{}).display,'1 tick');
});
test('pure preview includes travel and authored duration and leaves replay unchanged',()=>{
 const p=pack(),s=createWorld(p,{}),before=structuredClone(s),a=scene(),cost=actionCost(s,a,p,{}),result=execute(s,{...a,id:'chosen',actorId:p.playerId,expectedRevision:s.revision},p,{});
 assert.equal(cost.ticks,3);assert.deepEqual(s,before);assert.equal(result.state.tick-s.tick,cost.ticks);const restored=replay(s,result.turn.events);restored.events=result.state.events;restored.turns=result.state.turns;assert.deepEqual(restored,result.state);
});
test('every engine option carries a cost including free options',()=>{
 const p=pack(),s=createWorld(p,{}),list=actions(s,p,{});assert.ok(list.length);assert.ok(list.every(a=>Number.isInteger(a.cost.ticks)&&typeof a.cost.display==='string'));assert.equal(list.find(a=>a.type==='core.inspect').cost.ticks,0);assert.equal(list.find(a=>a.type==='core.wait').cost.ticks,1);
});
test('wait boundary and run cap use actual engine advancement',()=>{
 const p=pack({daypart:{interval:4}}),s=createWorld(p,{});s.tick=2;assert.equal(actionCost(s,{type:'core.wait',args:{until:'Evening'}},p,{}).ticks,6);s.run={endTick:12};s.tick=11;assert.equal(actionCost(s,scene(),p,{}).ticks,1);
});
test('planner choices display the remaining reservation, not a zero-tick opening',()=>{
 const p=pack({gameProject:{timeMode:'planner'},daypart:{interval:4}}),s=createWorld(p,{});s.tick=1;assert.equal(actionCost(s,scene({location:'home',activityId:undefined,activity:'talk',characters:['friend']}),p,{}).ticks,3);assert.equal(actionCost(s,{type:'core.wait',args:{until:'Evening'}},p,{}).ticks,7);
});
test('continuous conversation turns show free exchanges and paid boundaries',()=>{
 const p=pack({gameProject:{conversationStyle:'continuous'},daypart:{interval:4}}),s=createWorld(p,{}),a=scene({location:'home',activityId:undefined,activity:'talk',characters:['friend']}),opened=execute(s,{...a,id:'open',actorId:p.playerId,expectedRevision:0},p,{}).state;
 assert.equal(actionCost(opened,scene({location:'home',activityId:undefined,activity:'continue',characters:['friend']}),p,{}).ticks,0);assert.equal(actionCost(opened,{type:'core.endScene',args:{}},p,{}).ticks,4);
});
test('hub costs use engine previews and handle remote activities and free fallback',()=>{
 const p=pack({tickMinutes:30}),s=createWorld(p,{}),a=scene();assert.equal(optionCost(s,a,p).display,'1h 30m');assert.equal(optionCost(s,{type:'core.inspect',args:{}},p).ticks,0);assert.equal(optionCost(s,a,p,[{...a,cost:{ticks:7,display:'3h 30m'}}]).ticks,7);
});
const source=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8'),extract=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
test('option buttons and planner labels render costs without changing commands or slot units',()=>{
 const p=pack({tickMinutes:30}),s=createWorld(p,{}),list=actions(s,p,{}),boxes=new Map(),el=(tag,text)=>({tag,text,children:[],append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;}}),box=el('div'),data={state:s,pack:p,actions:list},ctx={current:data,busy:false,optionCost,timeCost,el,GROUPS:[],actionHint:()=>'',useHub:()=>false,$:id=>{if(!boxes.has(id))boxes.set(id,el('div'));return boxes.get(id);}};
 runInNewContext(extract('const costLabel=','async function api(')+extract('function renderChoices()','function next()')+'renderChoices();',ctx);
 const buttons=boxes.get('#choices').children.filter(x=>x.tag==='button').slice(0,-1);assert.equal(buttons.length,list.length);assert.ok(buttons.every(x=>/ \u00b7 \d/.test(x.text)));assert.equal(buttons.find(x=>x.text.startsWith('Look around')).text,'Look around · 0m');
 let plannerData;Object.assign(ctx,{$:()=>box,plannerReady:()=>true,renderPlanner:(box,data)=>{plannerData=data;},act:()=>{}});runInNewContext(extract('function renderHub()','// Messages panel:')+'renderHub();',ctx);
 assert.ok(plannerData.actions.every(a=>a.label.includes(' · ')&&a.storylet.title.includes(' · ')));assert.deepEqual(plannerData.actions.map(a=>a.args),list.map(a=>a.args));assert.deepEqual(plannerData.actions.map(a=>a.storylet.timeCost),list.map(a=>a.storylet?.timeCost));assert.deepEqual(data.actions,list);
});
test('typed result line displays the committed cost',async()=>{
 const p=pack({tickMinutes:30}),s=createWorld(p,{}),data={state:{...s,tick:2},pack:p},nodes=new Map(),ctx={freeConversation,conversationCommand,previewMode:null,session:0,requestSeq:0,liveUi:{refresh(){}},current:{state:s,pack:p},busy:false,lines:[],cursor:0,timeCost,stopAuto(){},renderFirstControls(){},showLine(){},showLoading(){},api:async()=>data,render(d){ctx.current=d;ctx.lines=[{text:'Narration'}];},setTimeout:r=>{r();},crypto:{randomUUID:()=> 'typed'},renderMessages(){},$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);}};
 const result=await runInNewContext(extract('async function act(request)','async function retry()')+"act({input:'Train at the gym'})",ctx);assert.equal(result,data);assert.equal(ctx.lines[0].text,'Train at the gym · 1h');assert.equal(ctx.lines[1].text,'Narration');
});
