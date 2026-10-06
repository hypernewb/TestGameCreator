import {assert,safeKey} from '../core/engine.mjs';
import {conditionReasons,validateConditions} from './conditions.mjs';
import {changeStat} from './stats.mjs';

const path=['modules','goals'],goalOf=(p,id)=>(p.characterSheets||[]).find(s=>s.actorId===id)?.goal;
const current=(s,p,id)=>{const g=goalOf(p,id),r=s.modules.goals?.[id];return p.modules?.goals&&g&&r?.id===g.id?{g,r,next:g.steps[r.completed.length]}:null;};
export function goalProgress(s,p,character){return (p.characterSheets||[]).filter(x=>!character||x.actorId===character).flatMap(({actorId:id})=>{const c=current(s,p,id);return c?.r.revealed?[{character:id,id:c.g.id,title:c.g.title,step:Math.min(c.r.completed.length+1,c.g.steps.length),total:c.g.steps.length,completed:[...c.r.completed],hint:c.next?.hint||'',done:!c.next}]:[];});}
export function goalHint(s,p,id){const c=current(s,p,id);return c?.next&&s.actors[id]?.location===s.actors[p.playerId]?.location?`Goal: ${c.g.title}; ${c.g.why}; next: ${c.next.title} (${c.next.hint}); ${c.g.secret&&!c.r.revealed?'private until you choose to mention it; ':''}bring it up yourself when natural.`:'';}
export function revealGoal(tx,id){const c=current(tx.state,tx.pack,id);assert(c,'Unknown goal');if(c.r.revealed)return;tx.set([...path,id,'revealed'],true);tx.emit('goals.revealed',{character:id,goal:c.g.id,title:c.g.title},[tx.pack.playerId,id]);}
const normalized=s=>typeof s==='string'?s.trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9@:_-]/g,'').slice(0,40):'';
export function mentionedGoals(s,p,lines){return (p.modules?.goals?p.characterSheets||[]:[]).filter(({actorId,goal})=>goal&&current(s,p,actorId)&&!current(s,p,actorId).r.revealed&&(lines||[]).some(l=>l.speaker===actorId&&String(l.text).toLocaleLowerCase().includes(goal.title.toLocaleLowerCase()))).map(x=>x.actorId);}
// Only already-priced acts can substantiate a story step. The creator's hint is the exact topic/target contract.
const matches=(step,act)=>act&&normalized(act.target)&&normalized(act.target)===normalized(step.hint);
export function advanceGoal(tx,id,step,act){
 const c=current(tx.state,tx.pack,id);assert(c?.r.revealed,'Goal must be revealed');assert(c.next?.id===step,'Not the current goal step');
 if(c.next.complete==='narrative')assert(matches(c.next,act)&&tx.events.some(e=>e.type==='social.actPriced'&&e.payload.character===id&&e.payload.verdict!=='unpaid'&&e.payload.act?.kind===act.kind&&e.payload.act?.target===act.target),'A matching committed act is required');
 else assert(!conditionReasons(c.next.complete,tx.state,tx.pack).length,'Goal step conditions not met');
 tx.set([...path,id,'completed'],[...c.r.completed,step]);
 for(const r of c.next.reward||[]){if(r.type==='stat')changeStat(tx,r.character||tx.pack.playerId,r.stat,r.delta,'goal');else if(r.type==='flag'||r.type==='unlock')tx.set(['flags',r.id],r.type==='unlock'?true:r.value??true);}
 tx.emit('goals.advanced',{character:id,goal:c.g.id,step,complete:!current(tx.state,tx.pack,id).next},[tx.pack.playerId,id]);
}
export const goals={id:'goals',version:'0.1.0',coreApi:'0.1.0',requires:[],
 validate(p){
  const cfg=p.goalSettings;if(cfg!==undefined){assert(cfg&&typeof cfg==='object'&&!Array.isArray(cfg),'goalSettings: expected object');assert(cfg.revealTrust===undefined||p.modules['social.relationships']&&Number.isInteger(cfg.revealTrust)&&cfg.revealTrust>=0&&cfg.revealTrust<=100,'goalSettings.revealTrust: expected 0-100 with social.relationships');}
  const ids=new Set(p.actors.filter(a=>a.id!==p.playerId).map(a=>a.id)),seen=new Set(),vars=new Set((p.storyVariables||[]).map(x=>x.id));
  for(const sheet of p.characterSheets||[]){const g=sheet.goal;if(g===undefined)continue;assert(ids.has(sheet.actorId)&&!seen.has(sheet.actorId),'goal: invalid or duplicate character');seen.add(sheet.actorId);
   assert(g&&safeKey(g.id),'goal: invalid ID');for(const k of ['title','why'])assert(typeof g[k]==='string'&&g[k].trim()&&g[k].length<=240,`goal.${k}: required, up to 240 characters`);assert(g.secret===undefined||typeof g.secret==='boolean','goal.secret: expected boolean');
   assert(Array.isArray(g.steps)&&g.steps.length>=2&&g.steps.length<=4,'goal.steps: expected 2-4 steps');const steps=new Set();
   for(const step of g.steps){assert(step&&safeKey(step.id)&&!steps.has(step.id),'goal step: invalid or duplicate ID');steps.add(step.id);for(const k of ['title','hint'])assert(typeof step[k]==='string'&&step[k].trim()&&step[k].length<=240,`goal step ${k}: required, up to 240 characters`);
    if(step.complete!=='narrative'){assert(step.complete&&Object.keys(step.complete).length&&Object.values(step.complete).every(v=>v!==null&&v!==undefined&&(typeof v==='object'?Object.keys(v).length>0:typeof v!=='string'||v.trim())),'goal step: a completion condition is required');assert(Object.keys(step.complete).every(k=>['location','weekdays','dayparts','charactersAt','present','attention','minTick','maxTick','flags','items','trust','completedScenes','plans','equipped','bonds','stats','relationshipStates','datingPhases','weather','holiday','goalStep'].includes(k)),'goal step: unknown condition');validateConditions(step.complete,p,'goal step.complete');}
    assert(Array.isArray(step.reward||[])&&(step.reward||[]).length<=8,'goal reward: expected up to 8 typed consequences');for(const r of step.reward||[]){assert(r&&['stat','flag','unlock'].includes(r.type),'goal reward: invalid type');if(r.type==='stat')assert(p.modules['character.stats']&&(p.statDefinitions||[]).some(d=>d.id===r.stat)&&(!r.character||p.actors.some(a=>a.id===r.character))&&Number.isInteger(r.delta)&&Math.abs(r.delta)<=100,'goal stat reward: invalid');else assert(safeKey(r.id)&&(!vars.size||vars.has(r.id))&&(r.value===undefined||typeof r.value==='boolean'),'goal flag/unlock reward: invalid');}
   }
   for(const want of sheet.wants||[])if(want.goalStep!==undefined)assert(steps.has(want.goalStep),'want.goalStep: unknown goal step');
  }
 },
 commands:{
  'goals.reveal'(tx,args){if(args.source){const turn=tx.state.turns[args.source];assert(turn&&!turn.fallback&&mentionedGoals(tx.state,tx.pack,turn.sceneLines).includes(args.character),'A committed character mention is required');}revealGoal(tx,args.character);},
  'goals.advance'(tx,args){advanceGoal(tx,args.character,args.step,args.act);}
 },
 init:p=>Object.fromEntries((p.characterSheets||[]).filter(s=>s.goal).map(s=>[s.actorId,{id:s.goal.id,revealed:false,completed:[]}])),
 react(tx,e){
  if(e.type==='core.patch'||e.type.startsWith('goals.'))return;
  for(const {actorId:id} of tx.pack.characterSheets||[]){let c=current(tx.state,tx.pack,id);if(!c)continue;
   const threshold=tx.pack.goalSettings?.revealTrust;if(!c.r.revealed&&!c.g.secret&&threshold!==undefined&&(tx.state.modules['social.relationships']?.edges?.[`${id}--${tx.pack.playerId}`]||0)>=threshold)revealGoal(tx,id);
   c=current(tx.state,tx.pack,id);if(!c.r.revealed||!c.next)continue;
   if(c.next.complete!=='narrative'){if(!conditionReasons(c.next.complete,tx.state,tx.pack).length)advanceGoal(tx,id,c.next.id);}
   else if(e.type==='social.actPriced'&&e.payload.character===id&&e.payload.verdict!=='unpaid'&&matches(c.next,e.payload.act)&&tx.events.includes(e))advanceGoal(tx,id,c.next.id,e.payload.act);
  }
 },
 panel(s,p){return {title:'Character goals',lines:goalProgress(s,p).map(g=>`${s.actors[g.character].name}: ${g.title} · ${g.done?'complete':`step ${g.step}/${g.total} · ${g.hint}`}`)};}
};
