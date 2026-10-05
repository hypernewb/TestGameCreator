import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,execute,replay,validatePack,mechanicsDigest} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createSheet} from '../packages/core/character-sheet.mjs';
import {wants,pickWants,wantHint,WANTS} from '../packages/modules/wants.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';

// A kept plan is what social.acts commits when the player turns up; the probe fires that same event.
const probe={id:'test.probe',version:'0.1.0',coreApi:'0.1.0',requires:[],commands:{'test.keepPlan'(tx,args){tx.emit('social.planKept',{character:args.character||'mia',location:args.location||'murphys',text:'You kept your plan with her.'});}}};
const mods={...registry,[probe.id]:probe};
const ALL=[
  {id:'quiet-night',text:'a quiet night in with the lights low',keys:['listen','barley-tea']},
  {id:'sand-court',text:'the sand court behind the fields',keys:['invite','hewett']},
  {id:'new-bar',text:'to try the new bar nobody has tried',keys:['invite','murphys']},
  {id:'exam-help',text:'help with the exam she has been dreading',keys:['ask','stacks']}];
const campus=()=>JSON.parse(readFileSync(new URL('../packs/campus.json',import.meta.url),'utf8'));
const trio=()=>JSON.parse(readFileSync(new URL('../packs/campus-trio.json',import.meta.url),'utf8'));
const sheet=(id,wants)=>{const s=createSheet(id);s.personality.traits=['warm','curious'];s.wants=structuredClone(wants);return s;};
const pack=(o={})=>{const p={
  schemaVersion:1,id:'test.wants',version:'0.1.0',title:'Wants',playerId:'player',
  modules:{'social.conversation':'0.1.0','social.relationships':'0.1.0','items.inventory':'0.2.0','social.dating':'0.1.0','social.romance-tempo':'0.2.0','social.acts':'0.1.0','social.wants':'0.1.0','test.probe':'0.1.0'},
  gameProject:{premise:'Test',setting:'Test',conversationStyle:'authored',ai:{intent:'',scene:'',daypart:''}},
  locations:[{id:'cafe',name:'Cafe',exits:[{to:'hewett'},{to:'murphys'}]},{id:'hewett',name:'Hewett Gym',exits:[{to:'cafe'}]},{id:'murphys',name:'Murphys',exits:[{to:'cafe'}]}],
  actors:[{id:'player',name:'You',location:'cafe'},{id:'mia',name:'Mia',location:'cafe',traits:['warm']},{id:'ada',name:'Ada',location:'cafe',traits:['dry']}],
  datingProfiles:[{character:'mia',thresholds:{crush:0,date:10,exclusive:20},preferences:[],signals:[]}],
  romanceTempoProfiles:[{character:'mia',initialPoints:10,ranks:[{id:'start',name:'Start',points:0,ceiling:100}]}],
  actProfiles:[{character:'mia',entries:[],fallback:{landed:0,missed:0}}],
  characterSheets:[sheet('mia',o.wants??ALL)],
  wantSettings:{reward:3,active:2},romanceStats:{dailyGain:6}};
  if(o.ada)p.characterSheets.push(sheet('ada',[{id:'ada-solo-want',text:'a night nobody interrupts',keys:['listen']}]));
  o.tune?.(p);return p;};
const SEED=0;
const run=(p,seed=SEED)=>{validatePack(p,mods);let s=createWorld(p,mods,'wants',seed);return {get state(){return s;},load(v){s=structuredClone(v);},act(acts){const r=execute(s,{id:`t${s.revision}`,actorId:'player',type:'social.priceActs',args:{character:'mia',sceneId:'scene',acts},expectedRevision:s.revision},p,mods);s=r.state;return r.turn.events;},cmd(type,args={}){const r=execute(s,{id:`t${s.revision}`,actorId:'player',type,args,expectedRevision:s.revision},p,mods);s=r.state;return r.turn.events;},like(){return s.modules['social.romance-tempo'].characters.mia.points;},live(){return s.modules['social.wants'].characters.mia;}}};
const liveWant=(p,key)=>pickWants(p,SEED,1,'mia').find(id=>p.characterSheets[0].wants.some(w=>w.id===id&&w.keys.includes(key)));

test('the rotation is deterministic from the save seed and keeps one or two wants live',()=>{
  const p=pack(),first=pickWants(p,SEED,1,'mia');
  assert.deepEqual(first,pickWants(structuredClone(p),SEED,1,'mia'),'the same save picks the same wants');
  assert.equal(first.length,2,'two wants, not the whole list');
  const weeks=[];for(let w=1;w<=8;w++){const draw=pickWants(p,SEED,w,'mia');weeks.push(draw.join('|'));assert.ok(draw.length<=2,'never more than the pack number');}
  assert.ok(new Set(weeks).size>1,'weeks do not all draw the same pair');
  assert.notDeepEqual(pickWants(p,SEED,1,'mia'),pickWants(p,SEED+1,1,'mia'),'a different save seed draws differently');
  const one=pack({tune:p=>{p.wantSettings.active=1;}});
  assert.equal(pickWants(one,SEED,1,'mia').length,1,'the pack decides how many are live');
  const spent={[first[0]]:1};
  assert.ok(!pickWants(p,SEED,1,'mia',spent).includes(first[0]),'a want spent this week is out of the draw');
  assert.ok(!pickWants(p,SEED,2,'mia',spent).includes(first[0]),'and stays out the week after');
  assert.ok([3,4,5,6,7,8].some(w=>pickWants(p,SEED,w,'mia',spent).includes(first[0])),'then it can come round again');
});

test('a matching act pays Like once, retires the want, and a new one rolls next week',()=>{
  const p=pack(),g=run(p),before=g.like(),live=g.live().active,want=liveWant(p,'listen');
  assert.ok(want,'the live draw includes a listen want');
  g.act([{kind:'listen',target:'troubles'}]);
  assert.equal(g.like(),before+WANTS.reward,'the campus-sized reward lands on Like');
  const paid=g.state.events.filter(e=>e.type==='social.wantFulfilled');
  assert.equal(paid.length,1);assert.equal(paid[0].payload.want,want);assert.equal(paid[0].payload.points,3);
  assert.deepEqual(g.live().active,live.filter(id=>id!==want),'the want is retired');
  assert.deepEqual(g.live().spent,{[want]:1});
  g.act([{kind:'listen',target:'troubles'}]);
  assert.equal(g.like(),before+WANTS.reward,'the same want never pays twice');
  for(let i=0;i<85;i++)g.cmd('core.wait');
  assert.equal(g.live().week,2,'a new week');
  assert.equal(g.live().active.length,2,'two wants again');
  assert.ok(!g.live().active.includes(want),'the fulfilled want is out for the next week');
  for(const id of g.live().active)assert.ok(p.characterSheets[0].wants.some(w=>w.id===id),'the new draw is authored');
});

test('an act that matches nothing, and a want that is not live, change nothing',()=>{
  const p=pack(),g=run(p),before=g.like();
  g.act([{kind:'insult',target:'anything'}]);
  assert.equal(g.like(),before);
  assert.equal(g.state.events.some(e=>e.type==='social.wantFulfilled'),false);
  const quiet=pack({wants:ALL.filter(w=>w.id==='quiet-night')}),h=run(quiet);
  h.act([{kind:'invite',target:'afternoon@murphys'}]);
  assert.equal(h.like(),10,'the bar want is not authored in this pack');
  assert.ok(h.state.events.some(e=>e.type==='social.planMade'),'the plan itself still exists');
});

test('a kept plan at the place she named fulfils the want',()=>{
  const p=pack({wants:[ALL[2],ALL[1]]}),g=run(p),before=g.like(),bar=liveWant(p,'murphys'),court=liveWant(p,'hewett');
  assert.ok(bar&&court,'this week draws the two plans');
  g.cmd('test.keepPlan',{location:'murphys'});
  assert.equal(g.like(),before+3);
  assert.deepEqual(g.live().active,[court]);
  g.cmd('test.keepPlan',{location:'murphys'});
  assert.equal(g.like(),before+3,'a retired want pays nothing');
  g.cmd('test.keepPlan',{location:'hewett'});
  assert.equal(g.like(),before+6,'the other live want is still hers to have');
});

test('the reward counts against the existing daily gain cap',()=>{
  const p=pack({tune:p=>{p.romanceStats.dailyGain=1;}}),g=run(p);
  g.act([{kind:'listen',target:'troubles'}]);
  assert.equal(g.like(),11,'the cap, not the want, decides the price');
  const paid=g.state.events.filter(e=>e.type==='social.wantFulfilled');
  assert.equal(paid[0].payload.points,1,'the event reports what was actually applied');
  assert.deepEqual(Object.keys(g.live().spent),[liveWant(p,'listen')],'a want helped is retired even when the cap held the price back');
});

test('an authored reward overrides the pack number',()=>{
  const g=run(pack({wants:[{id:'quiet-night',text:'a quiet night in',keys:['listen'],reward:6}]}));
  g.act([{kind:'listen',target:'troubles'}]);
  assert.equal(g.like(),16,'her own number wins');
});

test('one heroine, one line: the want reaches the scene prompt only while she is in it',async()=>{
  const {Store}=await import('../packages/persistence/store.mjs'),{GameService}=await import('../packages/ai/service.mjs');
  const p=pack({ada:true}),provider={name:'probe',seen:[],async generateScene(context){this.seen.push(context);return {lines:[{speaker:'mia',text:'Okay.'}],acts:[]};}};
  const store=new Store();store.insert(createWorld(p,mods,'wants-svc',19));
  const service=new GameService(store,{[p.id]:p},mods,provider),revision=()=>store.load('wants-svc').revision;
  const open=(id,characters)=>service.act('wants-svc',{id,expectedRevision:revision(),command:{type:'core.scene',args:{text:'Hey',location:'cafe',characters,activity:'talk'}}});
  try{
   await open('with-mia',['mia','ada']);
   const both=provider.seen.at(-1);
   assert.match(both.wantHint,/^Mia: has been wanting /,'one line, one heroine');
   assert.equal(both.wantHint.split('has been wanting').length-1,1,'never one line per heroine');
   const text=scenePromptMessages(both,p).map(m=>m.content).join(' ');
   assert.ok(text.includes('has been wanting'),'the wish reaches the prompt');
   assert.ok(!text.includes('quiet-night')&&!text.includes('wantSettings')&&!text.includes('+3'),'the id, the tuning and the price never do');
   assert.match(text,/never call it a want/,'the model is told to keep it in her voice');
   await service.act('wants-svc',{id:'leave',expectedRevision:revision(),command:{type:'core.endScene',args:{reason:'player'}}});
   await open('with-ada',['ada']);
   const other=provider.seen.at(-1);
   assert.match(other.wantHint,/^Ada: /,'the line follows whoever is there');
   assert.ok(!/Mia/.test(other.wantHint),'an absent heroine says nothing');
  }finally{store.close();}
});

test('a character with no authored wants is never given one',()=>{
  const p=pack(),g=run(p);
  assert.equal(wantHint(g.state,p,'ada'),'');
  assert.equal(wantHint(g.state,p,'player'),'','the player never wants a line of her own');
  g.cmd('test.keepPlan',{character:'ada',location:'murphys'});
  assert.equal(g.state.events.some(e=>e.type==='social.wantFulfilled'),false);
});

test('missing pack fields preserve legacy behaviour',()=>{
  const p=pack({tune:p=>{delete p.characterSheets[0].wants;}}),g=run(p);
  g.act([{kind:'listen',target:'troubles'}]);
  assert.equal(g.like(),10);
  assert.deepEqual(g.state.modules['social.wants'].characters,{});
  assert.equal(wantHint(g.state,p,'mia'),'');
  const bare=pack({tune:p=>{delete p.characterSheets;delete p.wantSettings;}}),h=run(bare);
  h.act([{kind:'listen',target:'troubles'}]);
  assert.equal(h.like(),10,'a pack without the data behaves exactly as before');
  assert.equal(wantHint(h.state,bare,'mia'),'');
  const off=pack({tune:p=>{delete p.modules['social.wants'];}}),k=run(off);
  k.act([{kind:'listen',target:'troubles'}]);
  assert.equal(k.like(),10);
  assert.equal(wantHint(k.state,off,'mia'),'','no module, no line');
});

test('invalid tuning and rows are rejected',()=>{
  for(const change of [
    p=>p.wantSettings={reward:-1},p=>p.wantSettings={active:0},p=>p.wantSettings={reward:2.5},p=>p.wantSettings=[],
    p=>p.characterSheets[0].wants[0].text='',p=>p.characterSheets[0].wants[0].keys=[],
    p=>p.characterSheets[0].wants[0].keys=['not a key!'],p=>p.characterSheets[0].wants[0].reward=-2,
    p=>p.characterSheets[0].wants[1].id=p.characterSheets[0].wants[0].id,p=>p.characterSheets[0].wants[0].id='nope!'
  ]){const p=pack();change(p);assert.throws(()=>validatePack(p,mods),/want/i);}
  assert.doesNotThrow(()=>validatePack(pack({tune:p=>p.wantSettings={reward:5,active:1}}),mods));
});

test('a save, reload and replay reproduce the rotation and the reward',()=>{
  const p=pack(),g=run(p),initial=structuredClone(g.state);
  g.act([{kind:'listen',target:'troubles'}]);
  g.cmd('test.keepPlan',{location:'murphys'});
  const saved=JSON.parse(JSON.stringify(g.state)),h=run(p);
  h.load(saved);
  assert.deepEqual(h.live(),g.live(),'a reloaded campaign continues from the saved wants');
  for(let i=0;i<85;i++){g.cmd('core.wait');h.cmd('core.wait');}
  assert.deepEqual(h.live(),g.live(),'both roll the same week after a reload');
  assert.equal(h.like(),g.like());
  const rebuilt=replay(initial,g.state.events);
  assert.deepEqual(rebuilt.modules['social.wants'],g.state.modules['social.wants'],'replay rebuilds the wants from patches alone');
  assert.equal(rebuilt.tick,g.state.tick);
});

test('tuning the pack changes the mechanics digest',()=>{
  const p=pack(),q=pack({tune:p=>p.wantSettings.reward=5}),r=pack({wants:ALL.slice(0,3)});
  assert.notEqual(mechanicsDigest(p),mechanicsDigest(q),'the number is mechanics');
  assert.notEqual(mechanicsDigest(p),mechanicsDigest(r),'so are her wants');
  assert.equal(mechanicsDigest(p),mechanicsDigest(pack()),'the same pack digests the same');
});

test('the campus and trio packs ship the reward and four wants per heroine',()=>{
  for(const p of [campus(),trio()]){
    validatePack(p,registry);
    assert.equal(p.wantSettings.reward,3);
    assert.equal(p.wantSettings.active,2);
    assert.equal(p.modules['social.wants'],wants.version);
  }
  const p=trio(),authored=new Map(p.characterSheets.map(sheet=>[sheet.actorId,new Set(sheet.wants.map(want=>want.id))]));
  for(const sheet of p.characterSheets){
    assert.equal(sheet.wants.length,4,`${sheet.actorId} carries four wants`);
    for(const want of sheet.wants)assert.ok(want.text.length<=160&&want.keys.length,`${want.id} is authorable`);
  }
  const s=createWorld(p,registry,'trio-wants',19);
  for(const [character,runtime] of Object.entries(s.modules['social.wants'].characters)){
    assert.equal(runtime.active.length,2,`${character} has two live wants`);
    for(const id of runtime.active)assert.ok(authored.get(character).has(id),`${character} draws authored wants`);
  }
  assert.deepEqual(createWorld(campus(),registry,'campus-wants',19).modules['social.wants'].characters,{},'no sheet wants, no state');
});

test('the studio section edits the reward and each heroine\'s wants',()=>{
  const ui=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
  assert.match(ui,/function wantsEditor/);
  assert.match(ui,/section\('Her own wants'/);
  assert.match(ui,/wantSettings=\{reward:3,active:2\}/,'the control offers the campus default');
  const p=trio();
  assert.ok(p.characterSheets.every(s=>s.wants.every(w=>w.id.startsWith(s.actorId))),'every want is named for its owner');
});
