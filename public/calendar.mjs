export const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const PERIODS=['Morning','Afternoon','Evening'];
export function timeCost(ticks,pack){
 const minutes=pack.tickMinutes??(pack.id==='campus'?60:null),total=ticks*minutes;
 return {ticks,display:minutes>0?total>=60?`${Math.floor(total/60)}h${total%60?` ${total%60}m`:''}`:`${total}m`:`${ticks} tick${ticks===1?'':'s'}`};
}
export function optionCost(state,action,pack,actions=[]){
 const a=actions.find(a=>a.type===action.type&&Object.entries(action.args||{}).every(([k,v])=>['text','result'].includes(k)||JSON.stringify(a.args?.[k])===JSON.stringify(v)));
 if(a?.cost)return a.cost;
 if(['core.refuse','core.inspect','items.equip','items.unequip','social.readFeed','social.readThread','social.reactToPost','social.setRumorStance','social.resolveConfrontation','social.scoreFirst','social.stopFirst','world.pushLuck'].includes(action.type))return timeCost(pack.durations?.[action.type]??0,pack);
 const n=pack.daypart?.interval||4,left=n-state.tick%n,planner=pack.gameProject?.timeMode==='planner',continuous=planner||pack.gameProject?.conversationStyle==='continuous',args=action.args||{};
 if(action.type==='core.wait'&&args.until){const slot=Math.floor(state.tick/n),d=((PERIODS.indexOf(args.until)-slot%3+3)%3)||3;return timeCost((slot+d)*n-state.tick,pack);}
 if(planner)return timeCost(Math.max(0,(state.planner?.endTick??state.tick+left)-state.tick),pack);
 const to=args.location,queue=[[state.actors[pack.playerId].location,0]],seen=new Set();let travel=0;
 while(queue.length&&to){const [id,cost]=queue.shift();if(id===to){travel=cost;break;}if(seen.has(id))continue;seen.add(id);for(const e of pack.locations.find(l=>l.id===id)?.exits||[])if(!e.flag||state.flags[e.flag])queue.push([e.to,cost+1]);}
 const activity=pack.activities?.find(a=>a.id===args.activityId),ticks=action.type==='core.scene'?continuous?args.activity==='rest'||!args.characters?.length?Math.max(travel,left):travel:travel+(activity?.duration??(args.activity==='continue'?0:1)):pack.durations?.[action.type]??1;
 return timeCost(state.run?Math.min(ticks,Math.max(0,state.run.endTick-state.tick)):ticks,pack);
}
export function calendarFor(tick,pack){
 const interval=pack.daypart?.interval||4,slot=Math.floor(tick/interval),dayIndex=Math.floor(slot/PERIODS.length);
 const start=pack.gameProject?.calendar?.startDate||'',parsed=/^\d{4}-\d{2}-\d{2}$/.test(start)?new Date(`${start}T00:00:00Z`):null;
 const valid=parsed&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===start;
 const configured=WEEKDAYS.indexOf(pack.gameProject?.calendar?.startWeekday);
 const first=valid?(parsed.getUTCDay()+6)%7:configured<0?0:configured;
 const date=valid?new Date(parsed.getTime()+dayIndex*86400000).toISOString().slice(0,10):null;
 return {week:Math.floor(dayIndex/7)+1,day:dayIndex+1,weekday:WEEKDAYS[(first+dayIndex)%7],daypart:PERIODS[slot%3],date,slot,interval};
}
