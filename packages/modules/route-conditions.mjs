// Pending integration: call alongside conditionReasons after T-110 lands. No state mutation.
export function routeConditionReasons(when,state,pack){
 const reasons=[];
 for(const [npc,id] of Object.entries(when?.goalSteps||{})){const g=state.modules.goals?.[npc],i=g?.steps?.findIndex(s=>(typeof s==='string'?s:s.id)===id);if(!(i>=0&&Number.isInteger(g.current)&&g.current>i))reasons.push(`Goal ${npc}/${id} is not completed`);}
 for(const id of when?.firstCompleted||[])if(!state.modules['social.firsts']?.completed?.includes(id))reasons.push(`First ${id} is not completed`);
 for(const r of when?.elapsedDays||[]){const first=state.modules['social.firsts'],tick=first?.completed?.includes(r.first)?(first.history?.find(x=>x.first===r.first&&x.outcome==='completed')?.tick??state.events?.find(x=>x.type==='social.firstCompleted'&&x.payload?.first===r.first)?.tick):undefined,days=(state.tick-tick)/((pack.daypart?.interval||4)*3);if(!Number.isFinite(days)||!Number.isInteger(r.min)||r.min<0||days<r.min)reasons.push(`Needs ${r.min} elapsed days since ${r.first}`);}
 return reasons;
}

export function validateRouteConditions(when,pack){
 const check=(ok,message)=>{if(!ok)throw Error('Route condition: '+message);},npcs=new Set(pack.actors.filter(x=>x.id!==pack.playerId).map(x=>x.id)),firsts=new Set((pack.firsts||[]).map(x=>x.id));
 if(when.goalSteps!==undefined){check(when.goalSteps&&typeof when.goalSteps==='object'&&!Array.isArray(when.goalSteps),'goalSteps must map NPCs to step IDs');for(const [npc,id] of Object.entries(when.goalSteps))check(npcs.has(npc)&&typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/.test(id),'unknown NPC or invalid goal step ID');}
 if(when.firstCompleted!==undefined)check(Array.isArray(when.firstCompleted)&&when.firstCompleted.every(id=>firsts.has(id)),'firstCompleted must reference existing firsts');
 if(when.elapsedDays!==undefined)check(Array.isArray(when.elapsedDays)&&when.elapsedDays.every(r=>r&&firsts.has(r.first)&&Number.isInteger(r.min)&&r.min>=0),'elapsedDays needs existing firsts and nonnegative whole days');
}
