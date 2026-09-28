import {assert,safeKey} from '../core/engine.mjs';
import {calendarFor,WEEKDAYS} from '../../public/calendar.mjs';
// Holidays, closures and weather: the shared calendar flavor layer. Holidays are a pure function of the pack
// and the clock (so schedules and scene gates can consult them without state); weather is rolled once per
// campaign day from an authored weighted table (seeded, replay-safe) or pinned by `weatherByDate`.
export function holidayOf(pack,cal){
 for(const h of pack.calendar?.holidays||[]){
  if(h.weekday&&h.weekday===cal.weekday)return h;
  if(h.date&&cal.date&&(h.annual?cal.date.slice(5)===h.date:cal.date===h.date))return h;
 }
 return null;
}
// Why a location is closed right now, or null when it is open. Reads committed weather state, so a
// weather-triggered closure is replay-exact.
export function closedReason(pack,state,tick,locationId){
 const closures=pack.calendar?.closures;if(!closures?.length)return null;
 const cal=calendarFor(tick,pack),holiday=holidayOf(pack,cal),weather=state.modules['world.calendar']?.weather;
 for(const c of closures){
  if(c.location!==locationId)continue;
  if(c.weekdays?.includes(cal.weekday)||c.holiday&&holiday||c.weather&&weather===c.weather||c.dates?.includes(cal.date))return c.reason||'closed';
 }
 return null;
}
export const calendarWorld={id:'world.calendar',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){
  const c=p.calendar;if(c===undefined)return;
  assert(c&&typeof c==='object'&&!Array.isArray(c),'calendar: expected an object');
  const locs=new Set(p.locations.map(l=>l.id)),weatherIds=new Set();
  for(const h of c.holidays||[]){assert(typeof h.name==='string'&&h.name.trim()&&h.name.length<=60,'calendar holiday name: 1–60 characters');assert(Boolean(h.weekday)!==Boolean(h.date),'calendar holiday: exactly one of weekday or date');if(h.weekday)assert(WEEKDAYS.includes(h.weekday),'calendar holiday.weekday: invalid');if(h.date)assert(h.annual?/^\d{2}-\d{2}$/.test(h.date):/^\d{4}-\d{2}-\d{2}$/.test(h.date),'calendar holiday.date: MM-DD when annual, otherwise YYYY-MM-DD');assert(h.text===undefined||typeof h.text==='string'&&h.text.length<=200,'calendar holiday.text: up to 200 characters');}
  for(const k of c.weather||[]){assert(safeKey(k.id)&&!weatherIds.has(k.id),'calendar weather id: invalid or duplicate');weatherIds.add(k.id);assert(typeof k.name==='string'&&k.name.trim()&&k.name.length<=40,'calendar weather name: 1–40 characters');assert(k.weight===undefined||typeof k.weight==='number'&&k.weight>0&&k.weight<=100,'calendar weather weight: 0–100');assert(k.text===undefined||typeof k.text==='string'&&k.text.length<=200,'calendar weather text: up to 200 characters');}
  for(const [date,id] of Object.entries(c.weatherByDate||{})){assert(/^\d{4}-\d{2}-\d{2}$/.test(date),'calendar weatherByDate keys must be YYYY-MM-DD');assert(weatherIds.has(id),`calendar weatherByDate.${date}: unknown weather kind`);}
  for(const cl of c.closures||[]){assert(locs.has(cl.location),'calendar closure.location: unknown');assert(cl.weekdays?.length||cl.dates?.length||cl.holiday||cl.weather,'calendar closure: needs at least one trigger (weekdays, dates, holiday or weather)');for(const w of cl.weekdays||[])assert(WEEKDAYS.includes(w),'calendar closure.weekdays: invalid');for(const d of cl.dates||[])assert(/^\d{4}-\d{2}-\d{2}$/.test(d),'calendar closure.dates must be YYYY-MM-DD');assert(!cl.weather||weatherIds.has(cl.weather),'calendar closure.weather: unknown kind');assert(cl.reason===undefined||typeof cl.reason==='string'&&cl.reason.length<=120,'calendar closure.reason: up to 120 characters');}
 },
 init:()=>({day:null,weather:null,holiday:null}),
 react(tx,e){
  if(e.type!=='core.timeAdvanced')return;
  const p=tx.pack,c=p.calendar;if(!c)return;
  const to=calendarFor(e.payload.to,p);if(calendarFor(e.payload.from,p).day===to.day)return;
  let id=c.weatherByDate?.[to.date]||null;
  if(!id&&c.weather?.length){const total=c.weather.reduce((n,k)=>n+(k.weight||1),0);let r=tx.random()*total;for(const k of c.weather){r-=(k.weight||1);if(r<0){id=k.id;break;}}id=id||c.weather[0].id;}
  if(id&&id!==tx.state.modules['world.calendar'].weather){tx.set(['modules','world.calendar','weather'],id);const kind=c.weather.find(k=>k.id===id);tx.emit('world.weatherChanged',{weather:id,text:kind?.text||`${kind?.name||'The weather'} turns.`},[p.playerId]);}
  const holiday=holidayOf(p,to);
  if(holiday){tx.set(['modules','world.calendar','holiday'],holiday.name);tx.emit('world.holidayStarted',{name:holiday.name,text:holiday.text||`Today is ${holiday.name}.`},[p.playerId]);}
  else if(tx.state.modules['world.calendar'].holiday)tx.set(['modules','world.calendar','holiday'],null);
 },
 panel(s,p){const st=s.modules['world.calendar'],closed=[...new Set((p.calendar?.closures||[]).map(c=>c.location))].filter(id=>closedReason(p,s,s.tick,id)).map(id=>p.locations.find(l=>l.id===id)?.name||id);
  return {title:'Calendar',lines:[...(st.weather?[`Weather: ${(p.calendar?.weather||[]).find(k=>k.id===st.weather)?.name||st.weather}`]:[]),...(st.holiday?[`Holiday: ${st.holiday}`]:[]),...(closed.length?[`Closed now: ${closed.join(', ')}`]:[])]};}
};
