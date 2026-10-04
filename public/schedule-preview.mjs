import {calendarFor} from './calendar.mjs';
import {compileWeeklyRoutines,validateWeeklyRoutines} from './weekly-routines.mjs';

import {resolveSchedule,holidayMatch} from './schedule-resolver.mjs';
export {holidayMatch} from './schedule-resolver.mjs';
const cellKey=(w,d)=>`${w}/${d}`;
const dayLabel=r=>!r?'Linked rule':r.days==='day'?`${r.weekday} override`:r.days==='weekdays'?'Weekdays':r.days==='weekends'?'Weekends':'Every day';
export function previewWeek(pack,actorId,week=1){
 const interval=pack.daypart?.interval||4,notes=["Simulation assumption: always starts at tick 0 from each NPC's authored starting location. Playable start selections and live campaign state are ignored."],cells=[];
 const actor=(pack.actors||[]).find(a=>a.id===actorId);
 if(!actor||actorId===pack.playerId)return {interval,week,cells,notes:['Choose an NPC to preview attendance.']};
 const later=(pack.startOptions||[]).filter(x=>Number.isInteger(x?.tick)&&x.tick>0);if(later.length)notes.push(`Nonzero playable starts are not simulated: ${later.map(x=>`${x.title||x.id} (${x.id}, tick ${x.tick})`).join(', ')}.`);
 if(!pack.modules?.['world.schedule'])notes.push('The schedules module is disabled: runtime attendance never changes, so the character stays at their authored starting location.');
 const linked=pack.gameProject&&Object.hasOwn(pack.gameProject,'weeklyRoutines')?compileWeeklyRoutines(pack):null;
 if(linked&&!linked.ok)notes.push(`Linked weekly rules have problems (${linked.diagnostics.map(d=>d.code).join(', ')}); raw cells decide until they are fixed.`);
 const provenance=new Map();
 let bound=linked?.ok;try{if(bound)validateWeeklyRoutines(pack);}catch{bound=false;notes.push('Linked weekly cells drift from authored rules; raw cells decide until recompiled.');}
 if(bound)for(const p of linked.actors.find(x=>x.actor===actorId)?.provenance||[])provenance.set(cellKey(p.weekday,p.daypart),p);
 const authored=new Map();
 for(const e of pack.gameProject?.weeklyRoutines?.actors||[])if(e?.actor===actorId)for(const r of e.rules||[])if(typeof r?.id==='string')authored.set(r.id,r);
 const raws=(pack.schedules||[]).filter(r=>r.actor===actorId),exceptions=(pack.scheduleExceptions||[]).filter(x=>x.actor===actorId);
 if(!raws.length&&!provenance.size)notes.push('This character has no schedule: runtime attendance never changes (stays at the authored starting location).');
 const weekStart=(week-1)*21*interval,horizon=week*21*interval;
 let location=actor.location,source={kind:'start',label:raws.length||provenance.size?'Starting location':'No schedule — stays at start'},lastShadowed=[];
 for(let tick=0;tick<horizon;tick++){
  let dest=null,src=null,shadowed=[],blocked=null,hol=null,fresh=false;
  const clock=tick%interval===0?calendarFor(tick,pack):null;
  // Runtime movement only happens on core.timeAdvanced, which never processes tick 0: the world starts there.
  if(clock)hol=holidayMatch(pack,clock);
  let resolved=null,raw=null;
  if(tick>0&&pack.modules?.['world.schedule']){
   for(const row of raws){const next=resolveSchedule(pack,row,tick);if(next?.location){resolved=next;dest=next.location;raw=row;}if(clock&&!next)blocked||=(row.weekly||[]).find(st=>st.weekday===clock.weekday&&st.daypart===clock.daypart&&st.skipHolidays&&hol);}
   for(const row of raws)if(row.stops?.length&&row.stops.some(st=>st.location===(dest||location))){for(let t=tick;t>tick-row.period&&t>=0;t--){const recent=resolveSchedule(pack,row,t);if(recent?.location){if(recent.location!==(dest||location)){resolved=recent;dest=recent.location;raw=row;}break;}}}
  }
  if(resolved){const st=resolved.stop;src={kind:resolved.kind,label:resolved.kind==='exception'?`Exception (ticks ${st.startTick}-${st.endTick})`:resolved.kind==='stop'?`Tick stop (+${st.at} every ${raw.period})`:'Weekly cell'};
   if(resolved.kind==='weekly'){const prov=provenance.get(cellKey(st.weekday,st.daypart));if(prov){const win=prov.winningRuleIds.map(id=>authored.get(id)).find(x=>x);src={kind:'rule',id:win?.id||prov.winningRuleIds[0],label:dayLabel(win)};shadowed=prov.shadowedRuleIds.map(id=>({id,label:dayLabel(authored.get(id))}));}}
  }
  if(dest){location=dest;source=src;lastShadowed=shadowed;fresh=true;}
  if(clock&&tick>=weekStart){
   const unknown=!Array.isArray(pack.locations)||!pack.locations.some(l=>l.id===location);
   cells.push({weekday:clock.weekday,daypart:clock.daypart,week,date:clock.date||null,tick,location,
    locationName:unknown?null:pack.locations.find(l=>l.id===location)?.name||null,unknownLocation:unknown,
    fresh,carried:!fresh,source,skipHolidays:source.kind==='rule'&&!!authored.get(source.id)?.stop?.skipHolidays,
    shadowed:fresh?shadowed:lastShadowed,holiday:hol?.name||null,holidaySkipped:!!blocked});
  }
 }
 notes.push(`Assumes a quiet week ${week}${cells[0]?.date?` starting ${cells[0].date}`:''} (displayed ticks ${weekStart}-${horizon-1}; carried attendance follows the tick-zero simulation): no held scenes, invitations or detours; periodic schedule catch-up applies; the holiday table applies as authored. Changing this preview never edits the project or a save.`);
 if(exceptions.length&&(!raws.length||!pack.modules?.['world.schedule']))notes.push('Exception windows do not move this NPC while no runtime schedule is enabled.');
 else if(exceptions.length)notes.push(`${exceptions.length} tick exception window(s) override every rule while active${exceptions.some(x=>x.endTick<weekStart||x.startTick>=weekStart+21*interval)?'; some fall outside this week':''}.`);
 const holidays=[...new Set(cells.filter(c=>c.holiday).map(c=>`${c.holiday} (${c.weekday})`))];
 if(holidays.length)notes.push(`Holiday this week: ${holidays.join(', ')} — rules set to skip holidays will not fire.`);
 if(cells.some(c=>c.unknownLocation))notes.push('A rule points at a location that does not exist in the project; fix it before play.');
 return {interval,week,cells,notes};
}
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const small=(parent,text,cls)=>{const s=node('small',text);if(cls)s.className=cls;parent.append(s);return s;};
export function mountSchedulePreview(parent,{getPack,onOpenRule=()=>{},message=()=>{}}){
 const box=node('details');box.className='schedule-preview';box.open=true;parent.append(box);
 let sel={actor:'',week:1};
 const render=()=>{
  const pack=getPack(),npcs=(pack?.actors||[]).filter(a=>a.id&&a.id!==pack.playerId),names=new Map(npcs.map(a=>[a.id,a.name||a.id]));
  if(!npcs.some(a=>a.id===sel.actor))sel={actor:npcs[0]?.id||'',week:sel.week};
  box.replaceChildren(node('summary','Weekly attendance preview (read-only)'));
  if(!sel.actor){box.append(node('p','Add an NPC to preview attendance.'));return;}
  const controls=node('div');controls.className='studio-grid';
  const who=node('label');who.className='studio-field';who.append(node('span','Character'));
  const whoSel=node('select');for(const a of npcs){const o=node('option',`${a.name||a.id} (${a.id})`);o.value=a.id;whoSel.append(o);}whoSel.value=sel.actor;
  whoSel.onchange=()=>{sel.actor=whoSel.value;render();};who.append(whoSel);controls.append(who);
  const wk=node('label');wk.className='studio-field';wk.append(node('span','Preview week'));
  const wkSel=node('select');for(let w=1;w<=6;w++){const o=node('option',`Week ${w}`);o.value=String(w);wkSel.append(o);}wkSel.value=String(sel.week);
  wkSel.onchange=()=>{sel.week=Number(wkSel.value)||1;render();};wk.append(wkSel);controls.append(wk);
  box.append(controls);
  const view=previewWeek(pack,sel.actor,sel.week);
  for(const n of view.notes){const p=node('p',n);if(n.startsWith('Simulation assumption:'))p.className='preview-assumption';box.append(p);}
  const grid=node('div');grid.className='schedule-preview-grid';grid.append(node('strong',''));
  for(const part of ['Morning','Afternoon','Evening'])grid.append(node('strong',part));
  for(const day of ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']){
   grid.append(node('strong',day));
   for(const part of ['Morning','Afternoon','Evening']){
    const c=view.cells.find(x=>x.weekday===day&&x.daypart===part),cellNode=node('div');cellNode.className='schedule-cell';cellNode.dataset.cell=`${day}/${part}`;
    cellNode.append(node('strong',c.unknownLocation?`Unknown location '${c.location}'`:c.locationName||c.location));
    if(c.source.kind==='rule'){
     const open=node('button',`${c.source.label} — edit rule`);open.type='button';open.onclick=()=>{onOpenRule({kind:'rule',id:c.source.id});message(`Opened the schedule rule responsible for ${day} ${part}.`);};cellNode.append(open);
    }else small(cellNode,c.source.label,'preview-source');
    if(c.shadowed.length)small(cellNode,`Overrides: ${c.shadowed.map(x=>x.label).join(', ')}`,'preview-shadowed');
    if(c.skipHolidays)small(cellNode,'Skips holidays','preview-flag');
    if(c.holidaySkipped)small(cellNode,`Holiday ${c.holiday}: rule did not fire`,'preview-flag');
    else if(c.holiday)small(cellNode,`Holiday: ${c.holiday}`,'preview-flag');
    if(c.carried)small(cellNode,'carried from the previous slot','preview-carried');
    grid.append(cellNode);
   }
  }
  box.append(grid);
 };
 render();
 for(const label of parent.parentElement?.querySelectorAll?.('label')||[])if(['Start date (YYYY-MM-DD, optional)','Starting weekday without a date'].includes(label.firstElementChild?.textContent))label.children[1]?.addEventListener('input',render);
}
