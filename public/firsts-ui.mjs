// Presentation only. Offers use the server's actions; progress and verdicts come from engine state/events.
const firstOf=(pack,id)=>(pack.firsts||[]).find(f=>f.id===id);
const nameOf=(pack,id)=>pack.actors.find(a=>a.id===id)?.name||id;
const END=new Set(['social.firstCompleted','social.firstStopped','social.firstRejected']);

export function firstProgress(state,pack){
 const active=state.modules['social.firsts']?.active,first=active&&firstOf(pack,active.first);if(!first)return null;
 return {id:first.id,title:first.title,name:nameOf(pack,first.character),
  dots:first.checkpoints.map((_,i)=>i<active.checkpoint?'done':i===active.checkpoint?'current':'pending')};
}

export function firstOffers(state,pack,actions=[]){
 const module=state.modules['social.firsts'];if(!module||module.active)return [];
 return module.offers.filter(o=>state.tick>=o.after&&!module.completed.includes(o.first)).flatMap(o=>{
  const first=firstOf(pack,o.first);if(!first)return [];
  const start=actions.find(a=>a.type==='social.startFirst'&&a.args?.first===first.id&&a.enabled!==false);
  const name=nameOf(pack,first.character),location=state.actors[first.character]?.location,place=pack.locations.find(l=>l.id===location)?.name;
  // A night offer never substitutes for renewed consent. Only the engine may make it actionable.
  const nightReady=first.rung!=='night'||state.modules['social.intimacy']?.characters?.[first.character]?.active?.category==='first-night';
  const away=location!==state.actors[pack.playerId].location;
  return [{id:first.id,character:first.character,title:first.title,label:`${name} — the moment’s right`,
   hint:!nightReady?'When you both want to, ask her again.':away?`Meet her at ${place||'her current location'}.`:first.title,
   command:start?{type:start.type,args:start.args}:nightReady&&away?{type:'core.scene',args:{text:`Meet ${name}`,location,characters:[first.character],activity:'talk'}}:null,
   travel:!start&&nightReady&&away}];
 });
}

// A typed reply is followed by recorded pricing/scoring and sometimes closing turns. Keep its prose on screen.
export function firstTurn(state,pack){
 const turns=Object.values(state.turns||{});let last=turns.at(-1);if(!last)return null;
 if(last.command.type==='core.endScene'&&turns.at(-2)?.command.type==='social.scoreFirst')last=turns.at(-2);
 const source=['social.scoreFirst','social.priceActs'].includes(last.command.type)?state.turns[last.command.args.source]:last;
 if(!source)return null;
 const group=turns.slice(turns.indexOf(source)),events=group.flatMap(t=>t.events||[]),firstEvent=events.find(e=>e.type==='social.firstStarted'||END.has(e.type)||e.type==='social.firstCheckpoint');
 const active=state.modules['social.firsts']?.active;
 if(!firstEvent&&!active)return null;
 if(!firstEvent&&source.command.type!=='core.scene'&&source.command.type!=='social.speak')return null;
 const first=firstOf(pack,firstEvent?.payload.first||active?.first);if(!first)return null;
 const ended=events.findLast(e=>END.has(e.type)),next=events.findLast(e=>e.type==='social.firstCheckpoint'&&e.payload.cue),started=events.find(e=>e.type==='social.firstStarted');
 return {source,first,opening:started?.payload.text||null,ended:ended?.payload||null,
  cue:!ended&&(next?.payload.cue||started?.payload.cue)||null,
  cg:ended?.type==='social.firstCompleted'?ended.payload.cg:null};
}

const LABELS={'opening-up':'Opening up','your-turn':'Your turn',arrival:'Arrival',noticing:'Noticing her',moment:'The moment',reading:'Reading the moment','leaning-in':'Leaning in',after:'After',lead:'Lead','check-in':'Check-in',peak:'Peak'};
export function firstEndCard(state,pack){
 const view=firstTurn(state,pack);if(!view?.ended)return null;
 const {first,ended}=view,name=nameOf(pack,first.character);
 return {first:first.id,text:ended.title||first.title,outcome:ended.outcome||'completed',cg:view.cg,characters:[name],
  note:ended.outcome?ended.text:'A moment to remember.',rows:(ended.verdicts||[]).map(v=>({character:first.character,name,checkpoint:LABELS[v.checkpoint]||v.checkpoint,
   text:v.verdict==='best'?`${name} appreciated ${v.reason||'how you read the moment'}.`:v.verdict==='miss'?`You missed the moment: ${v.reason||'you rushed it'}.`:`It half-landed: ${v.reason||'nothing stood out'}.`,
   mark:v.verdict==='best'?'up':v.verdict==='miss'?'down':'none'}))};
}
