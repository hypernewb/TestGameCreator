const safe=id=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
const need=(ok,text)=>{if(!ok)throw Error(text);};
export const ruleFingerprint=value=>JSON.stringify(value);
export function ruleSegments(p){return (p.scriptedScenes||[]).flatMap(s=>[{scene:s.id,segment:s},...(s.beats||[]).map(b=>({scene:s.id,beat:b.id,segment:b}))]);}
export function rulePlans(p){return ruleSegments(p).flatMap(x=>[...(x.segment.effects||[]),...(x.segment.choices||[]).flatMap(c=>[...(c.effects||[]),...(c.check?.fail?.effects||[])])].filter(e=>e.type==='plan').map(effect=>({...x,effect})));}
export function ruleTarget(p,t){
 if(t.kind==='stage')return (p.relationshipStates||[]).find(s=>s.id===t.id);
 if(t.kind==='path')return (p.relationshipProgressions||[]).find(g=>g.character===t.character);
 const x=ruleSegments(p).find(x=>x.scene===t.scene&&x.beat===t.beat);return t.choice?x?.segment.choices?.find(c=>c.id===t.choice):x?.segment;
}
export function nextRuleId(ids,prefix){let i=1;while(ids.includes(`${prefix}-${i}`))i++;return `${prefix}-${i}`;}
export function ruleReferences(p,target){
 const out=[];for(const g of p.relationshipProgressions||[])if(target.kind==='stage'){if(g.initial===target.id)out.push(g.character+' initial stage');for(const [i,t] of (g.transitions||[]).entries())if(t.from===target.id||t.to===target.id)out.push(g.character+' transition '+(i+1));}
 for(const [i,d] of (p.datingProfiles||[]).entries())if(target.kind==='stage'?(d.eligibility?.blockedStates||[]).includes(target.id):d.character===target.character&&(d.eligibility?.blockedStates||[]).length)out.push('datingProfiles['+i+'] ('+d.character+').eligibility.blockedStates');
 const when=(value,label)=>{for(const [character,state] of Object.entries(value?.relationshipStates||{}))if(target.kind==='path'?character===target.character:state===target.id)out.push(label+' stage gate [relationshipStates.'+character+']');};
 const scene=(s,label)=>{for(const segment of [s,...(s.beats||[])]){const part=label+(segment===s?'':'/'+segment.id);for(const c of [segment,...(segment.choices||[])]){const at=part+(c===segment?'':'/'+c.id);when(c.when,at);for(const [i,m] of (c.check?.modifiers||[]).entries())when(m.when,at+'.check.modifiers['+i+'].when');for(const e of [...(c.effects||[]),...(c.check?.fail?.effects||[])])if(e.type==='relationshipState'&&(target.kind==='path'?e.character===target.character:e.to===target.id))out.push(at+' stage effect');}}};
 for(const s of p.scriptedScenes||[])scene(s,s.id);
 for(const key of ['lorebook','moments'])for(const [i,e] of (p[key]||[]).entries())when(e.when,key+'['+i+'] ('+(e.id||'unnamed')+').when');
 for(const key of ['complications','opportunities'])for(const [i,e] of (p.directorProfile?.[key]||[]).entries())when(e.when,'directorProfile.'+key+'['+i+'] ('+(e.id||'unnamed')+').when');
 for(const [i,t] of (p.directorTemplates||[]).entries()){const label='directorTemplates['+i+'] ('+(t.id||'unnamed')+')';when(t.when,label+'.when');if(t.scene)scene(t.scene,label+'.scene');if(t.goal?.kept)scene(t.goal.kept,label+'.goal.kept');}return out;
}
export function ruleDiagnostics(p){
 const out=[],add=(severity,code,target,message)=>out.push({severity,code,target,message}),states=new Set((p.relationshipStates||[]).map(s=>s.id)),plans=rulePlans(p),ids=plans.map(x=>x.effect.id).filter(Boolean);
 for(const id of new Set(ids))if(ids.filter(x=>x===id).length>1)add('warning','ambiguous-plan',id,'Multiple plan creators use this ID; preserved as advanced.');
 for(const x of plans)if(!x.effect.id)add('warning','idless-plan',x.scene,'Unnamed plan preserved as advanced.');
 for(const g of p.relationshipProgressions||[])if(p.modules?.['social.progression']){if(!states.has(g.initial))add('error','initial',g.character,'Unknown initial relationship stage.');for(const t of g.transitions||[]){if(!states.has(t.from)||!states.has(t.to)||t.from===t.to)add('error','transition',g.character,'Choose two different existing stages.');if(!['story.choiceResolved','story.planKept','story.planBroken'].includes(t.event))add('warning','custom-event',g.character,'Custom transition event preserved; use advanced controls.');}if((g.transitions||[]).length>1)add('warning','transition-order',g.character,'First eligible transition wins in the displayed order.');}
 if(p.modules?.['story.scenes'])for(const x of ruleSegments(p)){for(const target of [x.segment,...(x.segment.choices||[])]){for(const id of Object.keys(target.when?.plans||{}))if(!ids.includes(id))add('warning','external-plan',x.scene,'Unverified external plan reference: '+id+' (preserved).');}if(!(x.segment.choices||[]).some(c=>!Object.keys(c.when||{}).length&&!c.check&&!(c.effects||[]).length&&!c.next&&!c.waitFor))add('warning','escape',x.scene+(x.beat?'/'+x.beat:''),'No terminal escape; retain unconditional branches and add an explicit escape.');}
 return out;
}
function actor(p,id){need(p.actors.some(a=>a.id===id&&id!==p.playerId),'Choose an existing NPC.');}
function stage(p,id){need((p.relationshipStates||[]).some(s=>s.id===id),'Choose an existing relationship stage.');}
function plan(p,id){const xs=rulePlans(p).filter(x=>x.effect.id===id);need(xs.length===1,'Choose one unambiguous named plan creator.');return xs[0].effect;}
export function editRule(p,{target,expectedBase,op,value={}}){
 const old=target&&ruleTarget(p,target);if(target){need(old,'Rule target was deleted or replaced.');need(expectedBase===ruleFingerprint(old),'Rule changed since this form opened. Cancel and reopen it.');}
 const q=structuredClone(p),obj=target&&ruleTarget(q,target),text=(s,label)=>{need(typeof s==='string'&&s.trim(),label+' is required.');return s;};
 if(op==='addStage'){need((q.relationshipStates||[]).length<30,'At most 30 relationship stages.');const id=nextRuleId((q.relationshipStates||[]).map(s=>s.id),'stage');(q.relationshipStates||=[]).push({id,name:text(value.name,'Display name')});}
 else if(op==='renameStage'){obj.name=text(value.name,'Display name');}
 else if(op==='removeStage'||op==='removePath'){const refs=ruleReferences(q,target);need(!refs.length,'Referenced rule cannot be removed: '+refs.join('; '));if(op==='removeStage'){need((q.relationshipStates||[]).length>1||!q.modules?.['social.progression'],'Keep at least one stage while progression is enabled.');q.relationshipStates.splice(q.relationshipStates.findIndex(s=>s.id===target.id),1);}else q.relationshipProgressions.splice(q.relationshipProgressions.findIndex(g=>g.character===target.character),1);}
 else if(op==='removeTransition'){need(target?.kind==='path'&&Number.isInteger(value.index)&&obj.transitions?.[value.index],'Transition no longer exists.');obj.transitions.splice(value.index,1);}
 else if(op==='initial'){actor(q,value.character);stage(q,value.initial);const g=(q.relationshipProgressions||[]).find(g=>g.character===value.character);if(g)g.initial=value.initial;else (q.relationshipProgressions||=[]).push({character:value.character,initial:value.initial,transitions:[]});}
 else if(op==='transition'||op==='editTransition'){
  stage(q,value.from);stage(q,value.to);need(value.from!==value.to,'From and To must be different stages.');const g=obj;need(target?.kind==='path','Choose a character progression.');need((g.transitions||[]).length<100,'At most 100 transitions.');let match;
  need(['story.planKept','story.planBroken','story.choiceResolved'].includes(value.event),'Choose a supported committed event.');
  if(value.event==='story.choiceResolved'){const c=ruleTarget(q,{scene:value.scene,beat:value.beat||undefined,choice:value.choice});need(c,'Choose an existing scene choice.');match={scene:value.scene,choice:value.choice,beat:value.beat||'opening'};}
  else{const e=plan(q,value.plan);need(e.character===g.character,'The selected plan belongs to another NPC.');match={id:e.id,character:e.character};}
  const requires={};if(value.flag){need((q.storyVariables||[]).some(x=>x.id===value.flag),'Choose an existing flag.');need(['true','false'].includes(value.flagValue),'Choose True or False for the flag.');requires.flags={[value.flag]:value.flagValue==='true'};}
  if(op==='editTransition'){const t=g.transitions?.[value.index];need(t,'Transition no longer exists.');if(t.event!==value.event){need(value.confirmSwitch===true,'Confirm changing the event and replacing its match terms.');t.match=match;}else t.match={...t.match,...match};t.from=value.from;t.to=value.to;t.event=value.event;if(value.flag)t.requires={...t.requires,flags:{...t.requires?.flags,...requires.flags}};}else (g.transitions||=[]).push({from:value.from,to:value.to,event:value.event,match,...(value.flag?{requires}:{})});
 }
 else if(op==='condition'){
  need(['plans','relationshipStates','flags'].includes(value.map),'Choose a supported condition.');need(safe(value.key),'Choose a safe condition reference.');if(value.map==='plans'){plan(q,value.key);need(['none','pending','kept','broken'].includes(value.value),'Invalid plan status.');}if(value.map==='relationshipStates'){actor(q,value.key);stage(q,value.value);need((q.relationshipProgressions||[]).some(g=>g.character===value.key),'NPC needs a relationship progression.');}if(value.map==='flags')need((q.storyVariables||[]).some(x=>x.id===value.key)&&typeof value.value==='boolean','Choose an existing flag and boolean.');
  const map=obj.when?.[value.map]||{};if(value.oldKey&&value.oldKey!==value.key)need(!Object.hasOwn(map,value.key),'That condition reference already exists.');if(!value.oldKey)need(!Object.hasOwn(map,value.key),'That condition reference already exists; edit its row.');
  const next={...map};if(value.oldKey)delete next[value.oldKey];next[value.key]=value.value;obj.when={...obj.when,[value.map]:next};
 }
 else if(op==='removeCondition'){need(['plans','relationshipStates','flags'].includes(value.map),'Unsupported condition map.');need(Object.hasOwn(obj.when?.[value.map]||{},value.key),'Condition no longer exists.');delete obj.when[value.map][value.key];}
 else if(op==='plan'||op==='editPlan'){
  need(target?.choice,'Choose a scene choice.');actor(q,value.character);const n=String(value.deadlineTicks??'');need(n.trim()&&Number.isInteger(Number(n))&&Number(n)>=0,'Relative deadline must be a nonnegative integer; blank is not zero.');const visibility=value.visibility;need(Array.isArray(visibility)&&visibility.length&&new Set(visibility).size===visibility.length&&visibility.every(id=>q.actors.some(a=>a.id===id)),'Choose valid unique plan knowers.');
  const fields={character:value.character,plan:text(value.plan,'Agreement text'),deadlineTicks:Number(n),visibility:[...visibility]};need(fields.plan.length<=500,'Agreement text must be at most 500 characters.');
  if(op==='editPlan'){const e=obj.effects?.[value.index];need(e?.type==='plan'&&e.id,'Choose a named plan effect.');plan(q,e.id);need(e.character===fields.character&&e.plan===fields.plan,'Referenced plan character and agreement text are fixed; create a separate plan to change them.');if(e.deadlineTick!==undefined)need(value.confirmSwitch===true,'Confirm replacing the absolute deadline with relative ticks.');delete e.deadlineTick;Object.assign(e,fields);}else{const id=nextRuleId(rulePlans(q).map(x=>x.effect.id),'plan');(obj.effects||=[]).push({type:'plan',id,...fields});}
 }
 else if(op==='planStatus'||op==='editPlanStatus'){need(target?.choice,'Choose a scene choice.');const e=plan(q,value.plan);need(['kept','broken'].includes(value.status),'Choose kept or broken.');need(!Object.hasOwn(obj.when?.plans||{},e.id)||obj.when.plans[e.id]==='pending','Resolve conflicts with the existing plan gate first.');const fields={type:'planStatus',id:e.id,character:e.character,plan:e.plan,status:value.status};if(op==='editPlanStatus'){const effect=obj.effects?.[value.index];need(effect?.type==='planStatus'&&effect.id===e.id,'Plan resolution reference is fixed.');Object.assign(effect,fields);}else{need(!(obj.effects||[]).some(x=>x.type==='planStatus'&&x.id===e.id),'This choice already resolves this plan; edit its resolution.');(obj.effects||=[]).push(fields);}obj.when={...obj.when,plans:{...obj.when?.plans,[e.id]:'pending'}};}
 else if(op==='escape'){need(!target?.choice,'Choose a scene segment.');const id=nextRuleId((obj.choices||[]).map(c=>c.id),'escape');(obj.choices||=[]).push({id,label:text(value.label,'Escape label'),result:text(value.result,'Escape result'),effects:[]});}
 else throw Error('Unknown rule edit.');
 return {pack:q,diagnostics:ruleDiagnostics(q)};
}
