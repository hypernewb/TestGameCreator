// Player-like bots for F12 fun metrics. The audit runner is a coverage bot (it equips every shirt); these pick like
// people do: Bartle-style persona weights, a taste for novelty (Hades-style "what's new"), and boredom with repeats.
import {actions,createWorld,execute} from '../core/engine.mjs';
import {conditionReasons} from '../modules/scenes.mjs';
// A person keeps a date they said yes to: head there when it would start, otherwise let the clock run to it.
const planPull=(s,p)=>{const out={go:new Set(),wait:false};for(const plan of (s.modules['story.scenes']?.plans||[]).filter(x=>x.status==='pending'))for(const sc of (p.scriptedScenes||[]).filter(x=>x.when?.plans?.[plan.id]==='pending')){const to=sc.when.location||sc.trigger?.match?.to;if(!to)continue;if(!conditionReasons({...sc.when,location:undefined},s,p).length)out.go.add(to);else if(!conditionReasons({...sc.when,location:undefined,dayparts:undefined},s,p).length)out.wait=true;}return out;};

const rng=seed=>{let x=(seed>>>0)||1;return()=>((x=Math.imul(x^(x>>>15),2246822507)^Math.imul(x^(x>>>13),3266489909),x^=x>>>16)>>>0)/4294967296;};
// Base appetite per action type. `romantic` = targets a dating-profile character; `fresh` = move to an unvisited place.
export const PERSONAS={
 romancer:{'story.choose':100,'story.startOfferedScene':90,'social.speak':25,romantic:60,'core.waitUntil':30,'items.give':15,'core.move':15,fresh:30,'core.scene':12,'world.explore':8,'world.use':6,'core.endScene':4,'core.inspect':3,'core.wait':3,'items.equip':2,'items.take':2,'items.place':1,'story.leave':1},
 explorer:{'story.choose':80,'story.startOfferedScene':70,'social.speak':25,romantic:30,'core.waitUntil':10,'items.give':5,'core.move':15,fresh:70,'core.scene':15,'world.explore':45,'world.use':25,'items.take':15,'core.endScene':5,'core.inspect':10,'core.wait':3,'items.equip':4,'items.place':1,'story.leave':1},
 achiever:{'story.choose':90,'story.startOfferedScene':60,'social.speak':20,romantic:30,'core.waitUntil':15,'items.give':8,'core.move':15,fresh:25,'core.scene':55,'world.explore':12,'world.use':15,'core.endScene':5,'core.inspect':2,'core.wait':3,'items.equip':10,'items.take':6,'items.place':1,'story.leave':1}
};

export function runPersonaPlaytest(pack,registry,{turns=150,seed=42,persona='romancer',startId,onTurn}={}){
 const want=PERSONAS[persona]||PERSONAS.romancer,roll=rng(seed),romantic=new Set((pack.datingProfiles||[]).map(d=>d.character)),used=new Map(),visited=new Set(),recent=[],errors=[];
 let state=createWorld(pack,registry,`persona-${persona}-${seed}`,seed,startId);
 for(let turn=0;turn<turns&&!state.modules?.['story.endings']?.selected;turn++){
  const here=state.actors[pack.playerId]?.location;visited.add(here);
  const enabled=actions(state,pack,registry).filter(x=>x.enabled),pull=planPull(state,pack);if(!enabled.length){errors.push({turn,message:'No enabled action.'});break;}onTurn?.(state,enabled);
  const weigh=a=>{const sig=`${a.type}:${JSON.stringify(a.args)}`,to=a.args?.target||a.args?.character||a.args?.to;let w=want[a.type]??5;
   if(romantic.has(to)&&want.romantic)w=Math.max(w,want.romantic);if(a.type==='core.move'&&!visited.has(to))w=Math.max(w,want.fresh);if(a.cue)w=Math.max(w,want['story.startOfferedScene']);
   if(a.type==='core.move'&&pull.go.has(to)&&to!==here)w=Math.max(w,150);if(pull.wait&&['world.nextDaypart','core.wait'].includes(a.type))w=Math.max(w,60);
   w/=1+2*(used.get(sig)||0);if(recent.length>=2&&recent.every(t=>t===a.type)&&!a.type.startsWith('story.'))w/=3;return w*w;};
  const weights=enabled.map(weigh),total=weights.reduce((a,b)=>a+b,0);let r=roll()*total,pick=enabled.at(-1);
  for(let i=0;i<enabled.length;i++){r-=weights[i];if(r<=0){pick=enabled[i];break;}}
  const sig=`${pick.type}:${JSON.stringify(pick.args)}`;used.set(sig,(used.get(sig)||0)+1);recent.push(pick.type);if(recent.length>2)recent.shift();
  try{state=execute(state,{type:pick.type,args:pick.args,id:`p${turn}`,actorId:pack.playerId,expectedRevision:state.revision},pack,registry).state;}catch(error){errors.push({turn,action:pick.type,message:error.message});}
 }
 return {state,errors};
}
