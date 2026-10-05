import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,actions,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {MockProvider} from '../packages/ai/providers.mjs';
import {endings,endingReasons} from '../packages/modules/endings.mjs';
const pack=JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
test('run-over production is opt-in and preserves legacy flags and unlimited runs',()=>{
 const ending=pack.endings.find(x=>x.id===pack.run.defaultEnding),legacy={...pack,endings:pack.endings.map(x=>x.id===ending.id?{...x,requires:{flags:{legacy:true}}}:x)},unlimited={...pack};delete unlimited.run;
 for(const p of [legacy,unlimited]){let s=createWorld(p,registry,p.id);for(let n=0;n<84;n++)s=execute(s,{id:String(n),actorId:p.playerId,expectedRevision:s.revision,type:'core.wait',args:{}},p,registry).state;assert.equal(s.flags['run-over'],undefined);if(p.run)assert.equal(s.modules['story.endings'].selected,ending.id);else assert.equal(s.modules['story.endings'].selected,null);}
 assert.deepEqual(endingReasons({requires:{flags:{legacy:true}}},{flags:{legacy:true}},pack),[]);assert.throws(()=>endings.validate({...pack,endings:[{...ending,requires:{flags:{'run-over':1}}}]}),/ending flag requirement invalid/);
});
test('campus and reskin unlock their fallback only at the deadline',()=>{
 const reskin=JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url),'utf8'));
 for(const p of [pack,reskin]){let s=createWorld(p,registry,p.id),n=0;const ending=p.endings.find(x=>x.id===p.run.defaultEnding);assert.deepEqual(ending.requires,{flags:{'run-over':true}});while(s.tick<s.run.endTick){assert.equal(s.flags['run-over'],undefined);assert.ok(!s.modules['story.endings'].unlocked.includes(ending.id));assert.equal(s.modules['story.endings'].selected,null);s=execute(s,{id:String(++n),actorId:p.playerId,expectedRevision:s.revision,type:'core.wait',args:{}},p,registry).state;}assert.equal(s.flags['run-over'],true);assert.ok(s.modules['story.endings'].unlocked.includes(ending.id));assert.equal(s.modules['story.endings'].selected,ending.id);}
});
const routes={jana:[['listen','borkum'],['listen','dominik']],monique:[['listen','case-study'],['tease','planner']],nova:[['listen','film'],['tease','projector']],abigail:[['listen','project'],['tease','kayak']]};
const words={jana:['What was Borkum like growing up?','How are things with Dominik? I am listening.'],monique:['How is your case study going?','Does your planner have a slot for arguing with me?'],nova:['Tell me about the film you are making.','Is the projector your most temperamental cast member?'],abigail:['How is the solar kayak project going?','Does the kayak get a performance review too?']};
async function run(mode,character='jana',together=false){
 const store=new Store(':memory:'),provider=new MockProvider(),id=`${mode}-${character}-${together}`;let tags=[],speaker='',calls=0,n=0,spoken=0,speech=0,opened='';
 provider.generateScene=async context=>{calls++;return {lines:[{speaker:context.speakers?.includes(speaker)?speaker:'',text:'Thanks for asking. Let me tell you.'}],acts:tags};};store.insert(createWorld(pack,registry,id));const service=new GameService(store,{[pack.id]:pack},registry,provider);let s=store.load(id);
 const act=async(command,acts=[])=>{tags=acts;const r=await service.act(id,{id:String(++n),expectedRevision:s.revision,command});s=r.state;assert.equal(r.turn?.fallback,false,r.turn?.failureReason);};
 try{  while(!s.modules['story.endings'].selected&&n<600){
   const offered=together&&s.scene?actions(s,pack,registry,['social.defineRelationship','social.askDate']).filter(x=>x.enabled):[],day=Math.floor(s.tick/12),who=mode==='spread'?Object.keys(routes)[day%4]:character;
   const goal=pack.endings.find(x=>x.character===character&&(together?x.priority===10:x.priority===20));
   if(mode==='route'&&s.modules['story.endings'].unlocked.includes(goal.id)){if(s.scene)await act({type:'core.endScene',args:{}});if(!s.modules['story.endings'].selected)await act({type:'story.chooseEnding',args:{ending:goal.id}});break;}
   if(s.scene){
    const dating=s.modules['social.dating'].characters[who],phase=dating.phase,threshold=pack.datingProfiles.find(x=>x.character===who).thresholds.exclusive,relation=together&&offered.find(x=>x.type==='social.defineRelationship'||x.type==='social.askDate'&&dating.score>=threshold&&!['dating','exclusive'].includes(phase));
    if(relation){await act(relation);continue;}
    if(opened!==s.scene.id){opened=s.scene.id;spoken=0;}
    if(spoken>=(mode==='spread'?1:3)||!s.scene.characters.includes(who)){await act({type:'core.endScene',args:{}});continue;}
    const i=speech++%2,[kind,target]=routes[who][i];speaker=who;spoken++;
    await act({type:'social.speak',args:{target:who,text:words[who][i]}},[{kind,target}]);
   }else if(mode==='neglectful'||s.tick%12!==0||(!together&&mode==='focused'&&s.modules['story.endings'].unlocked.some(x=>pack.endings.find(e=>e.id===x)?.priority===20))){await act({type:'core.wait',args:{}});}
   else{
    const location=s.actors[who].location,closed=pack.calendar.closures.some(x=>x.location===location&&x.weekdays?.includes(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][day%7]));
    if(closed){await act({type:'core.wait',args:{}});continue;}
    speaker=who;await act({type:'core.scene',args:{text:`Talk to ${who}`,location,characters:[who],activity:'talk'}});
   }
  }
  if(mode==='route')assert.ok(s.tick<=s.run.endTick);else assert.equal(s.tick,s.run.endTick,`${id} must finish its full 28 days`);assert.equal(s.scene,null);assert.ok(s.modules['story.endings'].selected,`${id} must select an ending`);const ending=pack.endings.find(x=>x.id===s.modules['story.endings'].selected);assert.deepEqual(endingReasons(ending,s,pack),[]);
  console.log(id,ending.id,'tick',s.tick,'calls',calls,'turns',n);return {ending:ending.id,state:s,calls,turns:n};
 }finally{store.close();}
}
test('focused, spread and neglectful campus bots finish 28 days with distinct endings',async()=>{
 const focused=await run('focused'),spread=await run('spread'),neglectful=await run('neglectful');
 assert.equal(focused.ending,'jana-stays');assert.equal(neglectful.ending,'term-ends');assert.ok(new Set([focused.ending,spread.ending,neglectful.ending]).size>=2);assert.ok(focused.calls>0);assert.ok(focused.calls<=focused.turns);
});

for(const [character,ending] of [['monique','monique-partner'],['nova','nova-premiere'],['abigail','abigail-launch']])test(`${ending} is reachable within the campus term`,async()=>{assert.equal((await run('route',character)).ending,ending);});
for(const character of Object.keys(routes))test(`${character}-together is reachable within the campus term`,async()=>{assert.equal((await run('route',character,true)).ending,`${character}-together`);});






