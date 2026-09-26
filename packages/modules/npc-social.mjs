import {assert} from '../core/engine.mjs';
import {pairKeyOf,settleNpcPairs,newFriendships,zoneOf} from '../../vendor/venus/npcRelationships.mjs';

export const npcSocial={
 id:'social.npc',version:'0.1.0',coreApi:'0.1.0',requires:['world.schedule'],
 validate(p){
  const npc=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),seen=new Set();
  assert(Array.isArray(p.initialNpcRelationships||[]),'initialNpcRelationships must be an array');
  for(const pair of p.initialNpcRelationships||[]){
   assert(npc.has(pair.a)&&npc.has(pair.b)&&pair.a!==pair.b,'NPC relationship needs two distinct NPCs');
   assert(Number.isInteger(pair.affinity)&&Math.abs(pair.affinity)<=6,'NPC affinity must be an integer from -6 to 6');
   const key=pairKeyOf(pair.a,pair.b);assert(!seen.has(key),'Duplicate NPC pair');seen.add(key);
  }
 },
 init(p){return {pairs:Object.fromEntries((p.initialNpcRelationships||[]).map(x=>[pairKeyOf(x.a,x.b),{affinity:x.affinity}])),friendships:[],lastSlot:-1};},
 react(tx,e){
  if(e.type!=='core.timeAdvanced')return;
  const {state:s,pack:p}=tx,interval=p.daypart?.interval||4,slot=Math.floor(e.payload.to/interval);
  if(slot<=Math.floor(e.payload.from/interval)||s.modules['social.npc'].lastSlot===slot)return;
  const current=s.modules['social.npc'],cast=s.scene?.characters||[],groups=[];
  for(const location of p.locations){
   if(location.id===s.actors[p.playerId].location)continue;
   const residents=p.actors.filter(a=>a.id!==p.playerId&&!cast.includes(a.id)&&s.actors[a.id].location===location.id).map(a=>a.id);
   if(residents.length<2)continue;
   const offset=slot%residents.length,members=[...residents.slice(offset),...residents.slice(0,offset)].slice(0,3);
   groups.push({kind:'hangout',ref:location.id,members});
   if(groups.length===8)break;
  }
  const pairs=settleNpcPairs({date:Math.floor(slot/3)+1,relationships:current.pairs,cast,groups,characters:Object.fromEntries(p.actors.map(a=>[a.id,a]))},()=>tx.random());
  const fresh=newFriendships(current.pairs,pairs,current.friendships).map(pair=>({...pair,slot}));
  tx.set(['modules','social.npc'],{pairs,friendships:[...current.friendships,...fresh],lastSlot:slot});
  tx.emit('social.npcSettled',{slot,groups,friends:fresh},[]);
 },
 panel(s){return {title:'NPC relationships',lines:Object.entries(s.modules['social.npc'].pairs).map(([key,pair])=>{const [a,b]=key.split('|');return `${s.actors[a].name} & ${s.actors[b].name}: ${zoneOf(pair.affinity)} (${pair.affinity})`;})};}
};
