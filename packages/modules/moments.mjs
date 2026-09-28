import {assert,safeKey,scheduleDestination} from '../core/engine.mjs';
import {calendarFor} from '../../public/calendar.mjs';
import {conditionReasons,validateConditions} from './conditions.mjs';
import {changeMoney} from './economy.mjs';
import {changeStat} from './stats.mjs';
import {heldBy,holdersOf,transfer,mint} from './inventory.mjs';
// Small things happen between the big scenes: a note on the pavement, a lesson in nerve, someone you know walking over,
// or a hook for an authored scene. Moves, waits and solo exploring roll for one; a dry streak raises the odds.
const path=['modules','world.moments'],KINDS=['find','encounter','scene'],ON=['move','wait','explore'],EFFECTS=['money','stat','trust','flag','item'];
export const MOMENT_DEFAULTS={chancePercent:30,dryStepPercent:15,perDay:4,cooldown:12,generate:true};
export const momentSettings=p=>({...MOMENT_DEFAULTS,...(p.momentsProfile||{})});
const at=(m,loc)=>!m.location||[].concat(m.location).includes(loc);
const fill=(text,v)=>text.replace(/\{(\w+)\}/g,(x,k)=>v[k]??x);
// Card worlds and thin packs still get moments: loose cash, a small stat nudge per stat, drop-ins by every character,
// and a hook for every scene that triggers on world.moment without an authored moment of its own.
export function generatedMoments(p){const s=momentSettings(p),g=s.generate===true?KINDS:s.generate||[],own=new Set((p.moments||[]).map(m=>m.id)),out=[];
 if(g.includes('find')&&p.modules['world.economy'])out.push({id:'gen-cash',kind:'find',text:'Something on the ground catches your eye: {amount} in loose cash. Nobody is looking for it.',effects:[{type:'money',delta:5,max:30}],maxUses:2,weight:2});
 if(g.includes('find')&&p.modules['character.stats'])for(const d of (p.statDefinitions||[]).filter(d=>d.visibility!=='private').slice(0,6))out.push({id:`gen-stat-${d.id}`,kind:'find',text:`A small moment at {place} tests your ${d.name.toLowerCase()}, and you handle it.`,effects:[{type:'stat',stat:d.id,delta:1}],maxUses:2});
 if(g.includes('encounter'))for(const a of p.actors.filter(a=>a.id!==p.playerId))out.push({id:`gen-meet-${a.id}`,kind:'encounter',character:a.id,text:'{name} spots you at {place} and comes over.',maxUses:3});
 if(g.includes('scene'))for(const sc of (p.scriptedScenes||[]).filter(x=>x.trigger?.event==='world.moment'&&safeKey(x.trigger.match?.moment)))if(!own.has(sc.trigger.match.moment)&&!out.some(m=>m.id===sc.trigger.match.moment))out.push({id:sc.trigger.match.moment,kind:'scene',location:sc.when?.location,text:sc.offerHint||'',maxUses:sc.repeatable?3:1,weight:3});
 return out.filter(m=>!own.has(m.id));}
export const allMoments=p=>[...(p.moments||[]),...generatedMoments(p)];
// Scheduled NPCs only drop in when their schedule leaves them free for the visit.
const busy=(p,id,from,n)=>(p.schedules||[]).some(r=>r.actor===id&&Array.from({length:n},(_,i)=>scheduleDestination(p,r,from+1+i)).some(Boolean));
function eligible(s,p,m,on,here,cfg){const st=s.modules['world.moments'],uses=st.uses[m.id]||0;
 if(!(m.on||ON).includes(on)||!at(m,here)||uses>=(m.maxUses??3)||st.last[m.id]!==undefined&&s.tick-st.last[m.id]<(m.cooldown??cfg.cooldown))return false;
 if(m.when&&conditionReasons(m.when,s,p).length)return false;
 if(m.kind==='encounter'){const a=s.actors[m.character];if(!a||a.location===here||st.away[m.character]||busy(p,m.character,s.tick,m.stay??p.daypart?.interval??4))return false;}
 if((m.effects||[]).some(e=>e.type==='item'&&heldBy(s,e.id,p.playerId)>0))return false;
 return true;}
function apply(tx,m,vars){const {state:s,pack:p}=tx;for(const e of m.effects||[]){
 if(e.type==='money'){const n=e.max?e.delta+Math.floor(tx.random()*(e.max-e.delta+1)):e.delta;vars.amount=`${p.currency??'$'}${Math.abs(n)}`;changeMoney(tx,n);}
 if(e.type==='stat')changeStat(tx,p.playerId,e.stat,e.delta,'moment');
 if(e.type==='flag')tx.set(['flags',e.id],e.value??true);
 if(e.type==='item'){const item=p.items.find(i=>i.id===e.id),from=holdersOf(s,e.id)[0]?.[0];if(from)transfer(tx,item,from,p.playerId,1);else mint(tx,item,p.playerId,1);vars.item=p.items.find(i=>i.id===e.id)?.name||e.id;}
 if(e.type==='trust'){const edge=`${e.character}--${p.playerId}`,old=s.modules['social.relationships'].edges[edge]||0,value=Math.max(0,Math.min(100,old+e.delta));tx.set(['modules','social.relationships','edges',edge],value);tx.emit('social.relationshipChanged',{actor:e.character,toward:p.playerId,old,value,delta:value-old,text:`${s.actors[e.character].name}: Trust ${old} → ${value}`},[p.playerId,e.character]);}
}}
function fire(tx,on){const {state:s,pack:p}=tx,st=s.modules['world.moments'],cfg=momentSettings(p),here=s.actors[p.playerId].location,day=calendarFor(s.tick,p).day;
 if(st.turn===tx.commandId)return;tx.set([...path,'turn'],tx.commandId);
 const today=st.day===day?st.today:0;if(today>=cfg.perDay)return;
 const pool=allMoments(p).filter(m=>eligible(s,p,m,on,here,cfg));if(!pool.length)return;
 if(tx.random()*100>=cfg.chancePercent+st.dry*cfg.dryStepPercent){tx.set([...path,'dry'],st.dry+1);return;}
 const w=pool.map(m=>(m.weight??1)*(st.recent.includes(m.id)?0.3:1)),total=w.reduce((a,b)=>a+b,0);let r=tx.random()*total,i=0;while(i<pool.length-1&&(r-=w[i])>=0)i++;const m=pool[i];
 const place=p.locations.find(l=>l.id===here).name,vars={place,name:s.actors[m.character]?.name||''};
 if(m.kind==='encounter'){const from=s.actors[m.character].location;tx.set(['actors',m.character,'location'],here);tx.set([...path,'away',m.character],{home:from,at:here,since:s.tick,until:s.tick+(m.stay??p.daypart?.interval??4)});tx.emit('world.actorArrived',{actor:m.character,location:here,text:`${vars.name} arrives at ${place}.`},[p.playerId,m.character]);}
 apply(tx,m,vars);
 tx.set([...path,'uses',m.id],(st.uses[m.id]||0)+1);tx.set([...path,'last',m.id],s.tick);tx.set([...path,'dry'],0);tx.set([...path,'day'],day);tx.set([...path,'today'],today+1);tx.set([...path,'recent'],[m.id,...st.recent.filter(x=>x!==m.id)].slice(0,4));
 tx.emit('world.moment',{moment:m.id,kind:m.kind,location:here,...(m.character?{character:m.character}:{}),...(m.line?{line:m.line}:{}),text:fill(m.text||'',vars)},[p.playerId,...(m.character?[m.character]:[])]);}
// Drop-ins go back to where they were (or wherever their schedule has since sent them) once the visit is over.
function sendHome(tx,to){const {state:s,pack:p}=tx;for(const [id,v] of Object.entries(s.modules['world.moments'].away)){if(to<v.until||s.scene?.characters?.includes(id))continue;const {[id]:gone,...rest}=s.modules['world.moments'].away;tx.set([...path,'away'],rest);if(s.actors[id].location!==v.at)continue;let home=v.home;for(const r of (p.schedules||[]).filter(r=>r.actor===id))for(let t=v.since+1;t<=to;t++)home=scheduleDestination(p,r,t)||home;if(home===v.at)continue;tx.set(['actors',id,'location'],home);tx.emit('world.actorArrived',{actor:id,location:home},[id]);}}
export const moments={id:'world.moments',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){const ids=new Set(),actors=new Set(p.actors.map(a=>a.id)),locs=new Set(p.locations.map(l=>l.id)),pr=p.momentsProfile;
  if(pr!==undefined){assert(pr&&typeof pr==='object'&&!Array.isArray(pr),'momentsProfile: expected object');for(const k of ['chancePercent','dryStepPercent'])assert(pr[k]===undefined||Number.isInteger(pr[k])&&pr[k]>=0&&pr[k]<=100,`momentsProfile.${k}: 0–100`);for(const k of ['perDay','cooldown'])assert(pr[k]===undefined||Number.isInteger(pr[k])&&pr[k]>=0&&pr[k]<=1000,`momentsProfile.${k}: integer 0–1000`);assert(pr.generate===undefined||typeof pr.generate==='boolean'||Array.isArray(pr.generate)&&pr.generate.every(k=>KINDS.includes(k)),'momentsProfile.generate: boolean or kinds');}
  assert(Array.isArray(p.moments||[])&&(p.moments||[]).length<=200,'moments: expected up to 200');
  for(const m of p.moments||[]){const l=`moment ${m.id}`;assert(safeKey(m.id)&&!ids.has(m.id),`${l}: ID invalid or duplicate`);ids.add(m.id);assert(KINDS.includes(m.kind),`${l}.kind: find, encounter or scene`);assert(typeof m.text==='string'&&m.text.length<=400&&(m.text.trim()||m.kind==='scene'),`${l}.text: 1–400 characters`);
   assert(!m.location||[].concat(m.location).every(x=>locs.has(x)),`${l}.location: unknown`);assert(!m.on||Array.isArray(m.on)&&m.on.length&&m.on.every(x=>ON.includes(x)),`${l}.on: move, wait or explore`);
   for(const k of ['maxUses','cooldown','stay'])assert(m[k]===undefined||Number.isInteger(m[k])&&m[k]>=0&&m[k]<=1000,`${l}.${k}: integer 0–1000`);assert(m.weight===undefined||typeof m.weight==='number'&&m.weight>0&&m.weight<=100,`${l}.weight: 0–100`);
   if(m.kind==='encounter')assert(actors.has(m.character)&&m.character!==p.playerId,`${l}.character: unknown`);assert(m.line===undefined||typeof m.line==='string'&&m.line.length<=300,`${l}.line: up to 300 characters`);
   if(m.when)validateConditions(m.when,p,`${l}.when`);
   assert(Array.isArray(m.effects||[])&&(m.effects||[]).length<=6,`${l}.effects: up to 6`);
   for(const e of m.effects||[]){assert(EFFECTS.includes(e.type),`${l}: unknown effect`);
    if(e.type==='money')assert(p.modules['world.economy']&&Number.isInteger(e.delta)&&Math.abs(e.delta)<=10000&&(e.max===undefined||Number.isInteger(e.max)&&e.max>=e.delta&&e.max<=10000),`${l}: money effect needs world.economy and integer delta/max`);
    if(e.type==='stat')assert(p.modules['character.stats']&&(p.statDefinitions||[]).some(d=>d.id===e.stat)&&Number.isInteger(e.delta)&&Math.abs(e.delta)<=10,`${l}: stat effect invalid`);
    if(e.type==='trust')assert(p.modules['social.relationships']&&actors.has(e.character)&&e.character!==p.playerId&&Number.isInteger(e.delta)&&Math.abs(e.delta)<=20,`${l}: trust effect invalid`);
    if(e.type==='flag')assert(safeKey(e.id)&&(e.value===undefined||typeof e.value==='boolean'),`${l}: flag effect invalid`);
    if(e.type==='item')assert(p.modules['items.inventory']&&(p.items||[]).some(i=>i.id===e.id),`${l}: item effect invalid`);}}},
 init:()=>({uses:{},last:{},recent:[],dry:0,day:null,today:0,turn:null,away:{}}),
 react(tx,e){const s=tx.state,p=tx.pack;
  if(e.type==='core.timeAdvanced'){sendHome(tx,e.payload.to);return;}
  const on=e.type==='core.moved'&&e.payload.actor===p.playerId?'move':e.type==='core.waited'?'wait':e.type==='core.sceneStarted'&&e.payload.activity==='explore'&&!(e.payload.characters||[]).length?'explore':null;
  if(!on||s.modules['story.scenes']?.pending||s.modules['story.endings']?.selected||s.scene?.characters?.length&&on!=='explore')return;
  if(on==='move'&&s.actors[p.playerId].location!==e.payload.to)return;
  fire(tx,on);},
 panel(s,p){const st=s.modules['world.moments'],all=allMoments(p);return {title:'Moments',lines:[`Today ${st.today}/${momentSettings(p).perDay} · dry streak ${st.dry}`,...st.recent.map(id=>`Recent: ${id} ×${st.uses[id]||0}`),...Object.entries(st.away).map(([id,v])=>`${s.actors[id]?.name||id} dropped in until tick ${v.until}`),`${all.length} moments (${all.length-(p.moments||[]).length} generated)`]};}
};
