import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {pairKeyOf,settleNpcPairs,newFriendships,zoneOf} from '../../vendor/venus/npcRelationships.mjs';

// Creator knobs: how often the off-screen world is rolled, how big it gets, and how often the player bumps into it.
export const NPC_SIMULATION={everySlots:1,maxGroups:8,maxGroupSize:3,runInsPerDay:1,runInChance:0.5};
export const npcSimulation=p=>({...NPC_SIMULATION,...(p.npcSimulation||{})});
const names=(s,ids)=>{const n=ids.map(id=>s.actors[id].name);return n.length<2?n.join(''):`${n.slice(0,-1).join(', ')} and ${n.at(-1)}`;};
const fill=(text,vars)=>text.replace(/\{(\w+)\}/g,(m,k)=>vars[k]??m);
// Authored cliques first (in pack order), then whoever is left rotates into one ad-hoc hangout. Pure and seed-free.
export function formGroups(p,location,residents,slot,size){
 const free=new Set(residents),groups=[];
 for(const g of p.npcGroups||[]){if(g.locations?.length&&!g.locations.includes(location))continue;const members=g.members.filter(id=>free.has(id)).slice(0,size);if(members.length<2)continue;members.forEach(id=>free.delete(id));groups.push({kind:'group',ref:location,group:g.id,members});}
 const rest=residents.filter(id=>free.has(id));if(rest.length>=2){const o=slot%rest.length;groups.push({kind:'hangout',ref:location,members:[...rest.slice(o),...rest.slice(0,o)].slice(0,size)});}
 return groups;
}

export const npcSocial={
 id:'social.npc',version:'0.2.0',coreApi:'0.1.0',requires:['world.schedule'],
 validate(p){
  const npc=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),seen=new Set(),locs=new Set(p.locations.map(l=>l.id));
  assert(Array.isArray(p.initialNpcRelationships||[]),'initialNpcRelationships must be an array');
  for(const pair of p.initialNpcRelationships||[]){
   assert(npc.has(pair.a)&&npc.has(pair.b)&&pair.a!==pair.b,'NPC relationship needs two distinct NPCs');
   assert(Number.isInteger(pair.affinity)&&Math.abs(pair.affinity)<=6,'NPC affinity must be an integer from -6 to 6');
   const key=pairKeyOf(pair.a,pair.b);assert(!seen.has(key),'Duplicate NPC pair');seen.add(key);
  }
  const groups=p.npcGroups||[],ids=new Set();assert(Array.isArray(groups)&&groups.length<=20,'npcGroups: expected up to 20 groups');
  for(const g of groups){assert(safeKey(g.id)&&!ids.has(g.id),'NPC group ID invalid or duplicate');ids.add(g.id);assert(Array.isArray(g.members)&&g.members.length>=2&&g.members.length<=6&&new Set(g.members).size===g.members.length&&g.members.every(id=>npc.has(id)),`NPC group ${g.id} needs 2-6 distinct NPC members`);assert((g.locations||[]).every(id=>locs.has(id)),`NPC group ${g.id} has an unknown location`);assert(g.runInText===undefined||typeof g.runInText==='string'&&g.runInText.length<=200,`NPC group ${g.id} runInText must be up to 200 characters`);}
  const sim=p.npcSimulation||{},int=(k,lo,hi)=>assert(sim[k]===undefined||Number.isInteger(sim[k])&&sim[k]>=lo&&sim[k]<=hi,`npcSimulation.${k} must be an integer from ${lo} to ${hi}`);
  assert(sim&&typeof sim==='object'&&!Array.isArray(sim),'npcSimulation must be an object');int('everySlots',1,12);int('maxGroups',0,8);int('maxGroupSize',2,6);int('runInsPerDay',0,6);
  assert(sim.runInChance===undefined||typeof sim.runInChance==='number'&&sim.runInChance>=0&&sim.runInChance<=1,'npcSimulation.runInChance must be from 0 to 1');
 },
 init(p){return {pairs:Object.fromEntries((p.initialNpcRelationships||[]).map(x=>[pairKeyOf(x.a,x.b),{affinity:x.affinity}])),friendships:[],lastSlot:-1,runIns:{day:-1,count:0}};},
 react(tx,e){
  if(e.type!=='core.timeAdvanced')return;
  const {state:s,pack:p}=tx,interval=p.daypart?.interval||4,slot=Math.floor(e.payload.to/interval),sim=npcSimulation(p);
  if(slot<=Math.floor(e.payload.from/interval)||s.modules['social.npc'].lastSlot===slot||slot%sim.everySlots)return;
  const current=s.modules['social.npc'],cast=s.scene?.characters||[],me=p.playerId,here=s.actors[me].location,day=calendarFor(e.payload.to,p).day;
  let runIns=current.runIns?.day===day?current.runIns:{day,count:0},groups=[];
  const present=loc=>p.actors.filter(a=>a.id!==me&&s.actors[a.id].location===loc).map(a=>a.id);
  for(const location of p.locations){
   if(location.id===here||groups.length>=sim.maxGroups)continue;
   const residents=present(location.id).filter(id=>!cast.includes(id));
   if(residents.length>=2)groups.push(...formGroups(p,location.id,residents,slot,sim.maxGroupSize).slice(0,sim.maxGroups-groups.length));
  }
  // A run-in is the player's one on-screen overlay: capped per day, and only for NPCs standing in the same room but outside the scene.
  const idle=present(here).filter(id=>!cast.includes(id)),[runIn]=idle.length>=2&&runIns.count<sim.runInsPerDay?formGroups(p,here,idle,slot,sim.maxGroupSize):[];
  if(runIn&&tx.random()<sim.runInChance){groups.push({...runIn,runIn:true});runIns={day,count:runIns.count+1};}
  const pairs=settleNpcPairs({date:Math.floor(slot/3)+1,relationships:current.pairs,cast,groups,characters:Object.fromEntries(p.actors.map(a=>[a.id,a]))},()=>tx.random());
  const place=id=>p.locations.find(l=>l.id===id)?.name||id,where=Object.fromEntries(groups.flatMap(g=>g.members.map(id=>[id,g.ref])));
  const fresh=newFriendships(current.pairs,pairs,current.friendships).map(({a,b})=>({a,b,slot,...(where[a]&&where[a]===where[b]?{location:where[a],text:`${names(s,[a,b])} became friends at ${place(where[a])}.`}:{})}));
  tx.set(['modules','social.npc'],{pairs,friendships:[...current.friendships,...fresh],lastSlot:slot,runIns});
  for(const g of groups){
   // Witnesses are everyone physically in the room; nobody else learns of the encounter unless gossip carries it.
   const witnesses=g.ref===here?[me,...present(here)]:present(g.ref),moves=[];
   for(let i=0;i<g.members.length;i++)for(let j=i+1;j<g.members.length;j++){const pair=pairs[pairKeyOf(g.members[i],g.members[j])];if(pair?.encounter)moves.push({a:g.members[i],b:g.members[j],positive:pair.encounter.positive,affinity:pair.affinity});}
   const positive=moves.filter(x=>x.positive).length*2>=moves.length,who=names(s,g.members),authored=(p.npcGroups||[]).find(x=>x.id===g.group);
   const text=g.runIn?fill(authored?.runInText||'{names} are here together, deep in conversation.',{names:who,location:place(g.ref)}):undefined;
   tx.emit(g.runIn?'social.npcRunIn':'social.npcEncounter',{slot,kind:g.kind,group:g.group||null,location:g.ref,place:place(g.ref),members:g.members,names:who,witnesses,positive,pairs:moves,...(text?{text}:{})},witnesses);
  }
  for(const f of fresh)if(f.text)tx.emit('social.npcFriendship',{a:f.a,b:f.b,slot,location:f.location,text:f.text},[f.a,f.b]);
  tx.emit('social.npcSettled',{slot,groups,friends:fresh},[]);
 },
 panel(s,p){return {title:'NPC relationships',lines:[...Object.entries(s.modules['social.npc'].pairs).map(([key,pair])=>{const [a,b]=key.split('|');return `${s.actors[a].name} & ${s.actors[b].name}: ${zoneOf(pair.affinity)} (${pair.affinity})`;}),...(p?.npcGroups||[]).map(g=>`Group ${g.name||g.id}: ${names(s,g.members)}`)]};}
};

// Friendship memories are private to the pair: only a member of the pair ever gets them back.
export const npcMemoriesFor=(s,actorId)=>(s.modules['social.npc']?.friendships||[]).filter(f=>f.text&&(f.a===actorId||f.b===actorId)).slice(-2).map(f=>f.text);
