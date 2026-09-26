export const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const PERIODS=['Morning','Afternoon','Evening'];
export function calendarFor(tick,pack){
 const interval=pack.daypart?.interval||4,slot=Math.floor(tick/interval),dayIndex=Math.floor(slot/PERIODS.length);
 const start=pack.gameProject?.calendar?.startDate||'',parsed=/^\d{4}-\d{2}-\d{2}$/.test(start)?new Date(`${start}T00:00:00Z`):null;
 const valid=parsed&&!Number.isNaN(parsed.getTime())&&parsed.toISOString().slice(0,10)===start;
 const configured=WEEKDAYS.indexOf(pack.gameProject?.calendar?.startWeekday);
 const first=valid?(parsed.getUTCDay()+6)%7:configured<0?0:configured;
 const date=valid?new Date(parsed.getTime()+dayIndex*86400000).toISOString().slice(0,10):null;
 return {week:Math.floor(dayIndex/7)+1,day:dayIndex+1,weekday:WEEKDAYS[(first+dayIndex)%7],daypart:PERIODS[slot%3],date,slot,interval};
}
