import {ROUTE_CONDITION_KINDS,unsupportedRouteConditions,guardRouteTransition} from '../modules/route-conditions.mjs';
export {ROUTE_CONDITION_KINDS,unsupportedRouteConditions,guardRouteTransition};
export const authoredGoalSteps=(p,npc)=>(p.characterSheets||[]).find(s=>s.actorId===npc)?.goal?.steps||[];
const stages=g=>[...new Set([g.initial,...(g.transitions||[]).flatMap(t=>[t.from,t.to])])];

// Static diagnostics only: an event's eventual occurrence cannot be proved from a route graph.
export function routeDiagnostics(p){
 const out=[],states=new Set((p.relationshipStates||[]).map(x=>x.id)),stats=new Map((p.statDefinitions||[]).map(x=>[x.id,x])),flags=new Set((p.storyVariables||[]).map(x=>x.id));
 for(const g of p.relationshipProgressions||[]){
  if(g.archetype&&!(p.romanceTempoProfiles||[]).some(x=>x.character===g.character))out.push({character:g.character,code:'tempo-unavailable',message:'Preset tempo is inactive: enable romance-tempo and add this NPC?s dating profile, then reapply the preset'});
  const ids=stages(g),edges=new Map(ids.map(id=>[id,[]])),blocked=new Set(),add=(code,message,where={})=>out.push({character:g.character,code,message,...where});
  for(const stage of ids)if(!states.has(stage))add('missing-stage',`Unknown stage ${stage}`,{stage});
  for(const [i,t] of (g.transitions||[]).entries()){
   if(unsupportedRouteConditions(t.requires?.conditions).length){blocked.add(i);add('needs-adapter-wiring','Unsupported condition kinds: '+unsupportedRouteConditions(t.requires.conditions).join(', '),{stage:t.to,transition:i});if(t.event!=='route.needsAdapter')add('unsafe-condition','Unsupported conditions are not quarantined; reopen the gate and apply it before play',{stage:t.to,transition:i});}
   const problem=(code,message)=>{blocked.add(i);add(code,message,{stage:t.to,transition:i});};
   for(const id of Object.keys(t.requires?.flags||{}))if(!flags.has(id))problem('missing-flag',`Unknown flag ${id}`);
   for(const [npc,id] of Object.entries({...t.requires?.goalStep,...t.requires?.conditions?.goalStep,...t.requires?.conditions?.goalSteps}))if(!p.modules?.goals||!authoredGoalSteps(p,npc).some(s=>s.id===id))problem('missing-goal-step',`Unknown or disabled goal step ${npc}/${id}`);
   for(const id of [...t.requires?.conditions?.firstCompleted||[],...(t.requires?.conditions?.elapsedDays||[]).map(r=>r.first)])if(!(p.firsts||[]).some(f=>f.id===id))problem('missing-first',`Unknown first ${id}`);
   const ranges=new Map();for(const r of t.requires?.stats||[]){const def=stats.get(r.stat);if(!def){problem('missing-stat',`Unknown stat ${r.stat}`);continue;}const actor=r.character==='self'?g.character:r.character==='player'?p.playerId:r.character,key=JSON.stringify([actor,r.stat]),range=ranges.get(key)||{min:def.min??-Infinity,max:def.max??Infinity};range.min=Math.max(range.min,r.min??-Infinity);range.max=Math.min(range.max,r.max??Infinity);ranges.set(key,range);if(range.min>range.max)problem('impossible-stat',`Stat ${r.stat} has incompatible bounds`);}
   edges.get(t.from).push({to:t.to,index:i});
  }
  const seen=new Set(),visit=id=>{if(seen.has(id)||!states.has(id))return;seen.add(id);for(const e of edges.get(id)||[])if(!blocked.has(e.index))visit(e.to);};visit(g.initial);
  for(const stage of ids)if(states.has(stage)&&!seen.has(stage))add('unreachable',`Stage ${stage} is unreachable from ${g.initial}`,{stage});
  const done=new Set(),active=new Set(),walk=id=>{if(done.has(id))return;active.add(id);for(const e of edges.get(id)||[])if(active.has(e.to))add('cycle',`Route cycle returns to ${e.to}; check that regression and repair are intentional`,{stage:e.to,transition:e.index});else walk(e.to);active.delete(id);done.add(id);};for(const id of ids)walk(id);
 }
 return out;
}

export function routeSameness(p){
 const groups=new Map(),routes=p.relationshipProgressions||[];
 for(const g of routes){
  const used=new Set(stages(g)),ids=[g.initial,...(p.relationshipStates||[]).map(s=>s.id).filter(id=>id!==g.initial&&used.has(id))],tempo=(p.romanceTempoProfiles||[]).find(x=>x.character===g.character),gates=(g.transitions||[]).map(t=>({from:ids.indexOf(t.from),to:ids.indexOf(t.to),kinds:Object.keys(t.requires||{}).filter(k=>Object.keys(t.requires[k]||{}).length).flatMap(k=>k==='conditions'?Object.keys(t.requires.conditions).map(x=>'conditions.'+x):[k]).sort()})).sort((a,b)=>a.from-b.from||a.to-b.to||JSON.stringify(a.kinds).localeCompare(JSON.stringify(b.kinds))),shape=JSON.stringify({stages:ids.length,gates,tempo:tempo?{advancement:tempo.advancement,ranks:(tempo.ranks||[]).map(r=>({points:r.points,ceiling:r.ceiling})),neglect:tempo.neglect,jealousy:tempo.jealousy}:null});
  if(!groups.has(shape))groups.set(shape,[]);groups.get(shape).push(g.character);
 }
 return [...groups.values()].filter(ids=>ids.length>1).map(characters=>({characters,message:`${characters.length} of ${routes.length} characters share the same route shape`}));
}

export const ROUTE_PRESETS=['fast-burn','slow-burn','goal-first','trust-first','push-pull','rival-jealous'];
// Keep unknown kinds fail-closed; restore saved pending events once their kinds are supported.
export function applyRoutePreset(pack,character,preset,{stat,inhibition}={}){
 if(!ROUTE_PRESETS.includes(preset)||!pack.actors.some(a=>a.id===character&&a.id!==pack.playerId))throw Error('Choose a route preset and NPC');
 const p=structuredClone(pack),def=p.statDefinitions?.find(s=>s.id===stat);if(preset!=='goal-first'&&!def)throw Error('Choose the route stat in this pack before applying a preset');
 p.modules||={};p.modules['social.conversation']||='0.1.0';p.modules['social.relationships']||='0.1.0';p.modules['social.progression']||='0.1.0';if(def)p.modules['character.stats']||='0.1.0';
 const steps=authoredGoalSteps(p,character);if(preset==='goal-first'&&(!p.modules.goals||steps.length<2))throw Error('Author and enable this character goal with at least two steps before applying goal-first');
 const labels=preset==='goal-first'?['Introduction',...steps.map(s=>s.title)]:preset==='trust-first'?['Introduction','Trust','Closeness','Commitment']:['Introduction','Connection','Closeness','Commitment'],ids=labels.map((_,i)=>i?`${character}-route-${i}`:'route-start');p.relationshipStates||=[];for(const [i,id] of ids.entries())if(!p.relationshipStates.some(s=>s.id===id))p.relationshipStates.push({id,name:labels[i]});
 const slow=['slow-burn','trust-first'].includes(preset),min=f=>Math.round((def.min??0)+((def.max??100)-(def.min??0))*f),transitions=ids.slice(1).map((to,i)=>({from:ids[i],to,event:preset==='goal-first'?'goals.advanced':'social.actPriced',match:{character},requires:preset==='goal-first'?{conditions:{goalSteps:{[character]:steps[i].id}}}:{stats:[{character:'self',stat,min:min((slow?[.35,.65,.85]:[.1,.3,.8])[i])}]}}));
 if(inhibition&&preset==='fast-burn'){const d=p.statDefinitions.find(s=>s.id===inhibition);if(!d)throw Error('Unknown inhibition stat');transitions[0].requires.stats.push({character:'self',stat:inhibition,max:Math.round((d.min??0)+((d.max??100)-(d.min??0))*.35)});}
 if(preset==='trust-first')transitions[0].requires.conditions={trust:{[character]:40}};
 if(preset==='push-pull')transitions.push({from:ids[2],to:ids[1],event:'social.neglectDetonated',match:{character},requires:{}});
 if(preset==='rival-jealous')transitions.push({from:ids[2],to:ids[1],event:'social.jealousyTriggered',match:{character},requires:{}});
 if(p.relationshipStates.length>30)throw Error('This preset exceeds the 30-stage limit; remove unused stages in Visual rules first');
 if(['trust-first','slow-burn'].includes(preset))for(const f of p.firsts||[])if(f.character===character)f.trigger={...f.trigger,event:'social.relationshipStateChanged',match:{character,to:ids[preset==='trust-first'?1:2]}};
 const graph={...(p.relationshipProgressions||[]).find(g=>g.character===character),character,archetype:preset,initial:ids[0],transitions:transitions.map(guardRouteTransition)};p.relationshipProgressions=[...(p.relationshipProgressions||[]).filter(g=>g.character!==character),graph];
 if(p.modules['social.romance-tempo']&&(p.datingProfiles||[]).some(x=>x.character===character)){const old=(p.romanceTempoProfiles||[]).find(x=>x.character===character)||{},step=slow?40:15,tempo={...old,character,advancement:'automatic',ranks:ids.map((id,i)=>({id,name:labels[i],points:i*step,ceiling:(i+1)*step})),signals:[...(old.signals||[]).filter(x=>!['route-step','route-first'].includes(x.id)),{id:'route-step',event:'social.relationshipStateChanged',match:{character},points:slow?12:4},{id:'route-first',event:'social.firstCompleted',match:{character},points:slow?20:5}]};if(preset==='push-pull')tempo.neglect={afterTicks:24,fuseTicks:4,minPoints:0,points:-5};if(preset==='rival-jealous')tempo.jealousy={preset:'guarded'};p.romanceTempoProfiles=[...(p.romanceTempoProfiles||[]).filter(x=>x.character!==character),tempo];}
 return p;
}
