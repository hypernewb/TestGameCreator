const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountContextInspector(root,{request=fetch}={}){
 let access='',epoch=0,busy=false;const select=el('select'),open=el('button','Inspect campaign AI context'),reload=el('button','Reload campaigns'),status=el('p'),actor=el('select'),query=el('input'),search=el('button','Preview AI context'),report=el('div');
 select.setAttribute('aria-label','Campaign to inspect');actor.setAttribute('aria-label','Context owner');query.setAttribute('aria-label','Search text the player would type');query.maxLength=200;status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 root.append(el('h2','AI context inspector — creator/debug'),el('p','Preview a synthetic scene request without calling the AI. Included facts, memories and NPC persona text are present in the displayed request after canonical audience filtering, token allocation and prompt relevance filtering. This is not a captured historical request.'),select,reload,open,status,actor,query,search,report);
 async function api(path,body,creator=true){const r=await request(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{'Content-Type':'application/json',...(creator?{'x-story-memory':access}:{})}}),v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
 actor.disabled=search.disabled=true;
 const reset=()=>{epoch++;access='';actor.replaceChildren();query.value='';report.replaceChildren();actor.disabled=search.disabled=true;status.textContent='';};
 const error=e=>{status.textContent=e.message;},lock=value=>{busy=value;open.disabled=reload.disabled=search.disabled=value;select.disabled=value;actor.disabled=search.disabled=value||!access;};
 async function campaigns(){reset();try{const b=await api('/api/bootstrap',undefined,false);select.replaceChildren(el('option','Choose a campaign'));select.firstChild.value='';for(const c of b.campaigns){const o=el('option',`${c.id} - revision ${c.revision}`);o.value=c.id;select.append(o);}}catch(e){error(e);}}
 const pool=(title,included,excluded,textOf=x=>x.text||'')=>{const s=el('details');s.className='studio-card';s.open=true;s.append(el('strong',title));
  for(const f of included)s.append(el('p',`${textOf(f)} (${f.source||f.id||''}) - included: ${f.reason}${f.truncated?'; truncated to '+(f.truncationReason||'entry token cap'):''}`));
  if(excluded.length){s.append(el('strong','Left out'));for(const f of excluded)s.append(el('small',`${textOf(f)} (${f.source||f.id||''}) — ${f.reason}`));}
  if(!included.length&&!excluded.length)s.append(el('p','No records.'));return s;};
 function render(d){if(d.mode==='synthetic-scene-setup'){report.replaceChildren(el('strong',`Context owner: ${d.owner}`),el('p',d.request.reason));return;}const synthetic=d.mode==='synthetic-scene-request';report.replaceChildren(el('p',d.limits),el('strong',`Context owner: ${d.owner}${d.query?`; search text: "${d.query}"`:''}`));
  const persona=el('details');persona.className='studio-card';persona.open=true;persona.append(el('strong',synthetic?'Persona text in synthetic request':'Owner persona pools'),el('p',synthetic?(d.persona.actor?.text||d.persona.reason):`Actor: ${JSON.stringify(d.persona.actor)}`),el('p',synthetic?d.persona.playerReason:`Player: ${JSON.stringify(d.persona.player)}`),el('small',`Present: ${d.persona.present.map(a=>a.name).join(', ')||'nobody'}. Mentioned elsewhere: ${d.persona.backgroundCharacters.map(a=>a.name).join(', ')||'none'}.`));if(synthetic)for(const profile of d.persona.cast||[])if(profile.id!==d.owner)persona.append(el('pre',profile.text));report.append(persona);if(synthetic)report.append(el('p',d.request.targetReason));
  report.append(pool('Facts (authored)',d.facts.included,d.facts.excluded,x=>`${x.text}`));
  report.append(pool('Facts (generated)',d.generated.included,d.generated.excluded,x=>`${x.text||x.id}`));
  report.append(pool('Statements the player made',d.statements.included,[...d.statements.excludedByCap,...d.statements.excludedPrivate,...(d.statements.excludedRequest||[])],x=>`${x.text}`));
  report.append(pool('Scene memories',d.sceneMemories.included,[...d.sceneMemories.excludedByCap,...d.sceneMemories.excludedPrivate,...(d.sceneMemories.excludedRequest||[])]));
  if(d.impressions.length||d.impressionsExcluded?.length)report.append(pool('Impressions',d.impressions,d.impressionsExcluded||[]));
  report.append(pool('Lorebook',d.lore.selected,d.lore.omitted.map(f=>({...f,text:f.text||''})),x=>x.text||''));
  const budget=el('details');budget.className='studio-card';budget.append(el('strong',synthetic?'Budget report (synthetic request)':'Budget report (last committed AI turn)'));
  if(!d.budgetReport&&!d.lastBudgetReport)budget.append(el('p','No committed AI turn in this campaign yet.'));
  else{const r=d.budgetReport||d.lastBudgetReport;budget.append(el('p',`Window ${r.window}; budget ${r.budget}; used ${r.used}${r.overBudget?' — OVER BUDGET':''}.`));
   for(const [key,count,tokens] of r.included||[])budget.append(el('small',`included: ${key} - ${typeof count==='number'?count+' items':count}, ${tokens} tokens`));
   for(const [key,reason] of r.cut||[])budget.append(el('small',`cut: ${key} — ${reason}`));}
  report.append(budget);
  const prompt=el('details');prompt.className='studio-card';prompt.append(el('strong',`${synthetic?'Synthetic request after audience and budget projection':'Preview prompt before token allocation'} (${d.promptMessages.length} messages)`),el('pre',d.promptMessages.map(m=>`[${m.role}]\n${m.content}`).join('\n\n')));report.append(prompt);}
 function owners(d){actor.replaceChildren();for(const a of d.actors){const o=el('option',a.name);o.value=a.id;if(a.id===d.owner)o.selected=true;actor.append(o);}actor.value=d.owner;}
 open.onclick=async()=>{if(busy)return;const id=select.value;if(!id)return error(Error('Choose a campaign first.'));reset();const version=epoch;lock(true);try{const token=(await api('/api/creator/memory/access',{scope:'creator-debug'},false)).token;if(version!==epoch)return;access=token;const d=await api('/api/creator/context/inspect',{campaignId:id,query:''});if(version!==epoch)return;owners(d);render(d);status.textContent=`Inspecting ${id}.`;}catch(e){if(version===epoch){access='';error(e);}}finally{lock(false);}};
 select.onchange=reset;reload.onclick=campaigns;
 actor.onchange=()=>{epoch++;report.replaceChildren();status.textContent='Preview the selected owner.';};
 search.onclick=async()=>{if(busy||!access)return error(Error('Inspect a campaign first.'));const version=epoch;lock(true);try{const d=await api('/api/creator/context/inspect',{campaignId:select.value,actorId:actor.value||undefined,query:query.value});if(version!==epoch)return;owners(d);render(d);}catch(e){if(version===epoch)error(e);}finally{lock(false);}};
 return {refresh:campaigns};
}
if(typeof document!=='undefined'){const root=document.getElementById('context-inspector');if(root)mountContextInspector(root).refresh();}
