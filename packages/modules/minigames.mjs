import {assert} from '../core/engine.mjs';
import {changeTrust} from './romance-stats.mjs';
import {changeMoney} from './economy.mjs';
import {changeStat} from './stats.mjs';

// M5 activity depth. The play UI runs a real-time widget per stat and reports a tier on the activity command (args.result);
// the engine never sees the game. Owner calls (2026-09-30): only upside (skip = the base yield, the floor), push your luck only
// after a great run with a rising mishap chance, and mishaps cost nothing directly: they emit world.activityMishap for the director.
export const GAMES={fitness:'timing',focus:'memory',wit:'quiz',charm:'rhythm'},RESULTS=['skip','ok','good','great'];
export const PUSH_MISHAP=[25,45,65];// percent per extra round; three rounds at most
const BONUS={good:{stat:1,money:0.2},great:{stat:1,money:0.5},push:{stat:1,money:0.5}};
const path=['modules','world.minigames'];
// Co-op: her own drafted line per tier (actor.reactions), else a plain one; a great run with her can proc a moment she stays for.
export const REACTION_FALLBACK={skip:'{name} lets it go without a word.',ok:'{name} shrugs. "Not bad."',good:'{name} grins at you. "Okay, that was good."',great:'{name} stares at you, impressed. "Where did that come from?"'},SPARK_PERCENT=40;
export const reactionOf=(actor,r)=>actor?.reactions?.[r]||REACTION_FALLBACK[r].replace('{name}',actor?.name||'She');
// Which widget an activity plays: its own `game`, else the game of the first stat it trains (money jobs train one too).
export const gameOf=a=>a.game||GAMES[(a.effects||[]).find(e=>e.type==='stat'&&GAMES[e.stat])?.stat]||'timing';
// Witnessed touch (owner call, round 2): at work, the gym or study, a touch with a third party there becomes a witnessed event.
// Gossip seeds a rumor from the witnesses and the director deals a saw-you (a heroine saw it) or rumor beat; no numbers are taken directly.
// A place is watched if it says so (location.watched), else if it hosts a job or gym/study training and is not the player's home.
export const watchedAt=(pack,loc)=>{const l=pack.locations.find(x=>x.id===loc);return l?.watched??Boolean(l&&loc!==pack.actors.find(a=>a.id===pack.playerId)?.location&&(pack.activities||[]).some(a=>a.location===loc&&(a.effects||[]).some(e=>e.type==='money'&&e.delta>0||e.type==='stat'&&['fitness','focus'].includes(e.stat))));};
const heroineIds=pack=>new Set([...(pack.datingProfiles||[]),...(pack.romanceTempoProfiles||[])].map(x=>x.character));
function witnessed(tx,her){const player=tx.pack.playerId,loc=tx.state.actors[player].location,st=tx.state.modules['world.minigames'];
 if(!tx.state.actors[her]||!watchedAt(tx.pack,loc)||(st.witnessed||{})[her]===tx.state.tick)return;
 const witnesses=tx.pack.actors.map(a=>a.id).filter(id=>id!==player&&id!==her&&(tx.state.actors[id]?.location===loc||tx.state.scene?.characters?.includes(id)));if(!witnesses.length)return;
 const H=heroineIds(tx.pack),rivals=witnesses.filter(id=>H.has(id)),names=witnesses.map(id=>tx.state.actors[id].name),place=tx.pack.locations.find(x=>x.id===loc).name,name=tx.state.actors[her].name;
 tx.set([...path,'witnessed'],{...(st.witnessed||{}),[her]:tx.state.tick});
 tx.emit('social.touchWitnessed',{character:her,name,location:loc,place,witnesses,rivals,text:`${names.join(' and ')} ${names.length>1?'see':'sees'} you and ${name} at ${place}.`},[player,her,...witnesses]);}
function bonus(tx,activity,kind){const b=BONUS[kind];
 for(const e of activity.effects||[]){if(e.type==='stat'&&b.stat)changeStat(tx,tx.pack.playerId,e.stat,b.stat,`${kind} run`);if(e.type==='money'&&e.delta>0&&tx.state.modules['world.economy']){const d=Math.round(e.delta*b.money);if(d)changeMoney(tx,d);}}}
export const minigames={id:'world.minigames',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){for(const a of p.activities||[])assert(a.game===undefined||Object.values(GAMES).includes(a.game),`activity ${a.id}.game: one of ${Object.values(GAMES)}`);
  for(const a of p.actors)assert(a.reactions===undefined||a.reactions&&typeof a.reactions==='object'&&Object.entries(a.reactions).every(([k,v])=>RESULTS.includes(k)&&typeof v==='string'&&v.length<=240),`actor ${a.id}.reactions: {skip,ok,good,great} lines up to 240 characters`);
  for(const l of p.locations)assert(l.watched===undefined||typeof l.watched==='boolean',`location ${l.id}.watched: true or false`);},
 init(){return {run:null,witnessed:{}};},
 react(tx,event){
  if(event.type==='social.actPriced'&&event.payload.act?.kind==='touch')return witnessed(tx,event.payload.character);
  if(event.type!=='world.activityCompleted')return;
  const r=event.payload.result,a=(tx.pack.activities||[]).find(x=>x.id===event.payload.activity);tx.set([...path,'run'],null);if(!a||!r)return;
  if(BONUS[r])bonus(tx,a,r);
  const her=a.character&&event.payload.characters.includes(a.character)?a.character:null;
  if(her)tx.emit('world.coopReaction',{character:her,activity:a.id,result:r,text:reactionOf({...tx.pack.actors.find(x=>x.id===her),name:tx.state.actors[her].name},r)},[tx.pack.playerId,her]);
  if(!BONUS[r])return;
  // Co-op: the heroine you did it with notices a good run.
  if(her)changeTrust(tx,a.character,r==='great'?2:1);
  if(her&&r==='great'&&tx.random()*100<SPARK_PERCENT)tx.emit('world.moment',{moment:`${her}-great-run`,kind:'encounter',character:her,location:event.payload.location,activity:a.id,text:`${tx.state.actors[her].name} hangs back after, in no hurry to leave.`},[tx.pack.playerId,her]);
  if(r==='great')tx.set([...path,'run'],{activity:a.id,tick:tx.state.tick,round:0,location:event.payload.location,characters:event.payload.characters});
  tx.emit('world.minigameScored',{activity:a.id,result:r,game:gameOf(a),canPush:r==='great',text:r==='great'?'Great run. One more round could pay more, or go wrong.':'Good run.'},[tx.pack.playerId]);
 },
 commands:{
  // One more round after a great run: roll the mishap first; a mishap ends the run and keeps what was banked.
  'world.pushLuck'(tx){const run=tx.state.modules['world.minigames'].run;assert(run&&run.tick===tx.state.tick&&run.round<PUSH_MISHAP.length,'There is no run to push right now');
   const a=tx.pack.activities.find(x=>x.id===run.activity),round=run.round+1;
   if(tx.random()*100<PUSH_MISHAP[run.round]){tx.set([...path,'run'],null);tx.emit('world.activityMishap',{activity:a.id,location:run.location,characters:run.characters,round,text:`You push it once too often at ${a.name.toLowerCase()}, and it goes wrong.`},[tx.pack.playerId,...run.characters]);return;}
   bonus(tx,a,'push');const more=round<PUSH_MISHAP.length;tx.set([...path,'run'],more?{...run,round}:null);
   tx.emit('world.luckPushed',{activity:a.id,round,canPush:more,next:more?PUSH_MISHAP[round]:null,text:more?'It pays off. Push again?':'It pays off. That is as far as it goes.'},[tx.pack.playerId]);}
 },
 actions(s){const run=s.modules['world.minigames']?.run;return run&&run.tick===s.tick&&run.round<PUSH_MISHAP.length?[{type:'world.pushLuck',label:'Push your luck',args:{}}]:[];},
};
