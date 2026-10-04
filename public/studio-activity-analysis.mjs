// Studio "Activity balance" section: run up to two sequences of the project's existing activities from one isolated
// fixture through the real engine and compare time, money, items, stats and trust side by side. Analysis only:
// no AI calls, no saves, no project edits, no suggested balance changes.
export function mountActivityAnalysis(parent,{getPack,getProjectId=()=>null,api,onStatus=()=>{},state={}}={}){
 const doc=parent.ownerDocument,node=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e;},control=(tag,id)=>{const e=node(tag);e.id=id;return e;};
 state.fixture??={tick:0,location:'',stats:{},flags:{}};state.sequences??=[{name:'Sequence A',steps:[]},{name:'Sequence B',steps:[]}];state.report??=null;
 const status=control('p','balance-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const msg=t=>{status.textContent=t;onStatus(t);};
 const box=control('div','balance-box');parent.append(node('p','Both sequences start from the same fixture and random seed and run through the ordinary game engine. Results are for comparison only: nothing here changes saves, the project or its balance.'),status,box);
 const grid=(...children)=>{const g=node('div');g.className='studio-grid';g.append(...children);return g;};
 const fieldBox=(label,input)=>{const w=node('label');w.className='studio-field';w.append(node('span',label),input);return w;};
 const select=(id,choices,value,onchange)=>{const s=control('select',id);for(const [v,l] of choices)s.append(new Option(l,v));s.value=value;s.onchange=e=>{onchange(e.target.value);invalidate();};return s;};
 const number=(id,value,onchange)=>{const i=control('input',id);i.type='number';i.value=value;i.oninput=()=>{onchange(Number(i.value));invalidate();};return i;};
 const button=(label,work,id,strict=false)=>{let clicks=0;const b=node('button',label);b.type='button';if(id)b.id=id;b.onclick=async()=>{const click=++clicks;let id=runId,sig=signature();try{if(!current(id,sig))return;b.disabled=true;const job=work();id=runId;await job;}catch(e){if(current(id,sig))msg(e.message);}finally{if(b.isConnected&&click===clicks&&(current(id,sig)||!strict&&state.epoch===epoch&&getProjectId()===projectId&&parent.isConnected))b.disabled=false;}};return b;};
 const epoch=state.epoch=(state.epoch||0)+1,projectId=getProjectId();let runId=0;
 const signature=()=>JSON.stringify([getPack(),state.fixture,state.sequences]);
 const current=(id,sig)=>state.epoch===epoch&&runId===id&&getProjectId()===projectId&&parent.isConnected&&signature()===sig;
 const invalidate=()=>{runId++;state.report=null;state.reportSignature=null;box.querySelectorAll('.balance-results,#balance-summary').forEach(e=>e.remove());msg('Inputs changed; compare again.');};
 const pack=()=>getPack()||{locations:[],actors:[],storyVariables:[],statDefinitions:[],activities:[]};
 const nameOf=(list,id)=>(list||[]).find(x=>x.id===id)?.name||id;
 const stepLabel=(p,s)=>s.wait?(s.until?`Skip to ${s.until}`:'Wait one period'):nameOf(p.activities,s.activity);
 const activityHint=(p,a)=>[nameOf(p.locations,a.location),a.character&&`with ${nameOf(p.actors,a.character)}`,a.perDay&&`${a.perDay}/day`,a.once&&'once',...(a.effects||[]).filter(e=>e.type==='money').map(e=>`${e.delta>0?'+':''}${e.delta} money`)].filter(Boolean).join(' · ');
 const fmt=v=>typeof v==='number'&&v>0?`+${v}`:String(v);
 async function compare(){
  const p=structuredClone(pack());if(!(p.activities||[]).length)throw Error('This project has no activities to compare. Add activities first.');
  const sequences=state.sequences.map((s,i)=>({name:s.name.trim()||`Sequence ${'AB'[i]}`,steps:structuredClone(s.steps)}));if(!sequences.some(s=>s.steps.length))throw Error('Add at least one step to a sequence before comparing.');
  const fixture={...state.fixture,stats:{...state.fixture.stats},flags:{...state.fixture.flags}};if(!fixture.location)delete fixture.location;
  const id=++runId,sig=signature();msg('Comparing sequences…');
  try{const report=await api('/api/studio/activity-compare',{pack:p,fixture,sequences,seed:fixture.seed});if(!current(id,sig))return;state.report=report;state.reportSignature=sig;render();msg(`Compared ${sequences.length} sequences from the same start (seed ${report.seed}).`);}catch(e){if(current(id,sig))throw e;}
 }
 function fixtureCard(p){
  const card=node('div');card.className='studio-card';card.append(node('h3','Starting fixture'));
  const f=state.fixture,economy=!!p.modules?.['world.economy'];
  card.append(grid(fieldBox('Player location',select('balance-fixture-location',[['','Project default'],...p.locations.map(l=>[l.id,l.name])],f.location||'',v=>{f.location=v;})),
   fieldBox('Starting tick',number('balance-fixture-tick',f.tick??0,v=>{f.tick=v;})),
   fieldBox('Random seed',number('balance-fixture-seed',f.seed??42,v=>{f.seed=v;})),
   ...(economy?[fieldBox(`Starting money (default ${p.initialMoney??100})`,(()=>{const i=number('balance-fixture-money',f.money??'',v=>{if(i.value==='')delete f.money;else f.money=v;});i.placeholder=String(p.initialMoney??100);return i;})())]:[])));
  if(p.modules?.['character.stats']&&(p.statDefinitions||[]).length)card.append(grid(...p.statDefinitions.map(d=>fieldBox(`${d.name} start`,(()=>{const i=number('balance-stat-'+d.id,f.stats[d.id]??'',v=>{if(i.value==='')delete f.stats[d.id];else f.stats[d.id]=v;});return i;})()))));
  if((p.storyVariables||[]).length)card.append(grid(...p.storyVariables.map(v=>{const c=control('input','balance-flag-'+v.id);c.type='checkbox';c.checked=f.flags[v.id]??!!v.initial;c.onchange=()=>{f.flags[v.id]=c.checked;invalidate();};return fieldBox(`${v.name} starts true`,c);})));
  const copy=control('select','balance-copy-scenario');copy.append(new Option('Copy fixture from a saved test scenario…',''));for(const s of state.scenarios||[])copy.append(new Option(s.name,s.id));
  copy.onchange=async()=>{if(!copy.value)return;const id=++runId,sig=signature();try{const r=await api('/api/studio/scenario?id='+encodeURIComponent(copy.value));if(!current(id,sig))return;state.fixture={...structuredClone(r.fixture||{}),tick:r.fixture?.tick??0,location:r.fixture?.location||'',stats:{...(r.fixture?.stats||{})},flags:{...(r.fixture?.flags||{})}};invalidate();render();msg(`Fixture copied from “${r.name}”. The scenario itself is unchanged.`);}catch(e){if(current(id,sig))msg(e.message);}};
  const tools=node('div');tools.className='studio-toolbar';tools.append(copy,button('Load scenarios',async()=>{const id=++runId,sig=signature();try{const r=await api('/api/studio/scenarios');if(!current(id,sig))return;state.scenarios=r.scenarios;render();msg(`${state.scenarios.length} saved test scenario${state.scenarios.length===1?'':'s'} available.`);}catch(e){if(current(id,sig))msg(e.message);}},'balance-load-scenarios',true));
  card.append(tools);return card;
 }
 function sequenceCard(p,s,i){
  const key='ab'[i],card=node('div');card.className='studio-card balance-sequence';card.id='balance-sequence-'+key;
  const name=control('input','balance-name-'+key);name.value=s.name;name.maxLength=80;name.oninput=()=>{s.name=name.value;invalidate();};card.append(fieldBox('Sequence name',name));
  const list=node('ol');list.className='balance-steps';
  s.steps.forEach((step,j)=>{const li=node('li');li.append(node('span',stepLabel(p,step)));
   const move=(d)=>{const k=j+d;if(k<0||k>=s.steps.length)return;[s.steps[j],s.steps[k]]=[s.steps[k],s.steps[j]];invalidate();render();};
   const up=button('↑',()=>move(-1)),down=button('↓',()=>move(1)),rm=button('✕',()=>{s.steps.splice(j,1);invalidate();render();});up.setAttribute('aria-label','Move up');down.setAttribute('aria-label','Move down');rm.setAttribute('aria-label','Remove step');
   li.append(up,down,rm);list.append(li);});
  if(!s.steps.length)list.append(node('li','No steps yet.'));
  card.append(list);
  const pick=select('balance-add-'+key,[['','Choose an activity…'],...(p.activities||[]).map(a=>[a.id,`${a.name} — ${activityHint(p,a)}`]),['wait:','Wait one period'],['wait:Morning','Skip to next Morning']],'',()=>{});
  const add=button('Add step',()=>{if(s.steps.length>=40)throw Error('At most 40 steps per sequence.');const v=pick.value;if(!v)throw Error('Choose an activity or wait step to add.');s.steps.push(v.startsWith('wait:')?{wait:true,...(v.slice(5)?{until:v.slice(5)}:{})}:{activity:v});invalidate();render();},'balance-add-btn-'+key);
  const tools=node('div');tools.className='studio-toolbar';tools.append(fieldBox('Add',pick),add,button('Clear',()=>{s.steps=[];invalidate();render();}));card.append(tools);
  const r=state.report?.sequences[i];
  if(r)card.append(results(r));
  return card;
 }
 function results(r){
  const out=node('div');out.className='balance-results';
  for(const st of r.steps){const f=node('div');f.className=`playtest-finding severity-${st.ok?'info':'critical'}`;
   f.append(node('strong',`${st.index}. ${st.label} — ${st.ok?'done':'unavailable'}`),node('small',` ${st.before.daypart} day ${st.before.day} → ${st.after.daypart} day ${st.after.day}`));
   if(st.ok){const ul=node('ul');for(const c of st.changes)ul.append(node('li',c.kind==='time'?`Time: ${c.from} → ${c.to} (${c.delta} tick${c.delta===1?"":"s"})`:c.kind==='location'?`Location: ${c.from} → ${c.to}`:`${c.label}: ${c.from??'—'} → ${c.to??'—'}${c.delta!==undefined?` (${fmt(c.delta)})`:''}`));if(!st.changes.length)ul.append(node('li','No tracked changes.'));f.append(ul);
    if(st.closedConversation)f.append(node('p','The conversation this activity opened was ended as a player would end it.'));if(st.note)f.append(node('p',st.note));}
   else{f.append(node('p',`Engine: ${st.error}`));const ul=node('ul');for(const why of st.reasons)ul.append(node('li',why));f.append(ul,node('p','Skipped; later steps continue from the unchanged state.'));}
   out.append(f);}
  return out;
 }
 function summary(p){
  const rep=state.report,seqs=rep.sequences,card=node('div');card.className='studio-card';card.id='balance-summary';
  card.append(node('h3','Final comparison'),node('p',`Seed ${rep.seed} · ${p.title||rep.packId} v${rep.packVersion||'—'} · start ${rep.start.daypart} day ${rep.start.day}`));
  const rows=[['Ends at',s=>`${s.final.daypart} day ${s.final.day}`],['Time used (ticks)',s=>s.final.tick-s.start.tick],['Location',s=>nameOf(p.locations,s.final.location)],['Unavailable steps',s=>s.unavailable]];
  if(rep.start.money!==null)rows.push(['Money',s=>`${s.final.money} (${fmt(s.final.money-s.start.money)})`]);
  for(const id of Object.keys(rep.start.stats))rows.push([nameOf(p.statDefinitions,id),s=>`${s.final.stats[id]} (${fmt(s.final.stats[id]-s.start.stats[id])})`]);
  for(const id of Object.keys(rep.start.trust))rows.push([`Trust with ${nameOf(p.actors,id)}`,s=>`${s.final.trust[id]} (${fmt(s.final.trust[id]-s.start.trust[id])})`]);
  for(const id of new Set(seqs.flatMap(s=>[...Object.keys(s.start.items),...Object.keys(s.final.items)])))rows.push([nameOf(p.items,id),s=>s.final.items[id]||0]);
  for(const id of new Set(seqs.flatMap(s=>s.totals.filter(t=>t.kind==='flag').map(t=>t.id))))rows.push([nameOf(p.storyVariables,id),s=>String(!!s.final.flags[id])]);
  const wrap=node('div');wrap.className='balance-table-wrap';const t=node('table');t.className='balance-table';
  const head=node('tr');head.append(node('th',''),...seqs.map(s=>node('th',s.name)));t.append(head);
  for(const [label,get] of rows){const tr=node('tr');tr.append(node('th',label),...seqs.map(s=>node('td',String(get(s)))));t.append(tr);}
  wrap.append(t);card.append(wrap);return card;
 }
 function render(){
  const p=pack();if(state.report&&state.reportSignature!==signature())state.report=null;box.replaceChildren(fixtureCard(p));
  const cols=node('div');cols.className='balance-columns';state.sequences.forEach((s,i)=>cols.append(sequenceCard(p,s,i)));
  const tools=node('div');tools.className='studio-toolbar';tools.append(button('▶ Compare sequences',compare,'balance-compare'),button('Clear results',()=>{invalidate();render();msg('Results cleared.');}),button('Cancel comparison',()=>{invalidate();render();msg('Comparison cancelled.');},'balance-cancel'));
  box.append(cols,tools);if(state.report)box.append(summary(p));
 }
 render();
 return {render,compare};
}
