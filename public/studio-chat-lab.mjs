// Character Chat Lab (T-107): chat with one character from stranger to the last route stage without playing the
// game. Runs on an isolated lab campaign server-side; never touches saves, the draft or data/ai-settings.json.
import {goalRows,goalMarker} from './goal-progress.mjs';
const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export function mountChatLab(section,{getPack,getDraftId=()=>'',api,onStatus=()=>{}}={}){
 const pack=()=>getPack()||null;
 let session=null,rows=[],patches=[],view=null,busy=false,download=null;
 const $=id=>section.querySelector('#'+id);
 const call=api;
 const status=el('p');status.id='lab-status';status.setAttribute('role','status');
 const banner=el('p');banner.id='lab-banner';banner.setAttribute('role','alert');banner.hidden=true;
 banner.textContent='server older than files on disk — restart the server to play the new build';
 const buildLine=el('p');buildLine.id='lab-build';
 const refresh=el('button','Refresh build stamp');refresh.id='lab-build-refresh';refresh.type='button';refresh.hidden=true;
 // Setup: source, character, provider, start.
 const source=el('select');source.id='lab-source';source.setAttribute('aria-label','Lab source pack');source.append(el('option','Choose a project or pack…'));
 const npc=el('select');npc.id='lab-npc';npc.setAttribute('aria-label','Character');npc.append(el('option','Choose a character…'));npc.disabled=true;
 const provider=el('select');provider.id='lab-provider';provider.setAttribute('aria-label','Provider');
 for(const [v,l] of [['mock','Mock provider'],['local','Local model (AI settings)'],['cloud','Cloud model (AI settings)']]){const o=el('option',l);o.value=v;provider.append(o);}
 const start=el('button','Start lab');start.id='lab-start';start.type='button';
 const field=(label,input)=>{const w=el('label');w.className='studio-field';w.append(el('span',label),input);return w;};
 const setup=el('div');setup.className='studio-grid';
 setup.append(field('Project or pack',source),field('Character',npc),field('Provider',provider),field('Start',start));
 // Conversation and live side panel.
 const chat=el('div');chat.id='lab-chat';
 const input=el('input');input.id='lab-input';input.placeholder='Type a line for the conversation…';input.maxLength=2000;input.disabled=true;
 const send=el('button','Send');send.id='lab-send';send.type='button';send.disabled=true;
 const form=el('div');form.className='studio-toolbar';form.append(input,send);
 const panel=el('div');panel.id='lab-panel';
 const cols=el('div');cols.className='studio-grid';
 const chatWrap=el('div');chatWrap.append(el('h3','Conversation'),form,chat);
 const panelWrap=el('div');panelWrap.append(el('h3','Live state'),panel);
 cols.append(chatWrap,panelWrap);
 // Controls.
 const stage=el('select');stage.id='lab-stage';stage.setAttribute('aria-label','Stage');stage.append(el('option','Jump to…'));
 const jump=el('button','Jump to stage');jump.id='lab-jump';jump.type='button';jump.className='lab-patch';
 const forkTurn=el('input');forkTurn.id='lab-fork-turn';forkTurn.type='number';forkTurn.min='0';forkTurn.value='0';forkTurn.setAttribute('aria-label','Fork from turn');
 const fork=el('button','Fork from turn');fork.id='lab-fork';fork.type='button';
 const reset=el('button','Reset');reset.id='lab-reset';reset.type='button';
 const controlsRow=el('div');controlsRow.className='studio-toolbar';
 for(const [unit,label] of [['hour','Skip an hour'],['day','Skip a day'],['week','Skip a week']]){const b=el('button',label);b.type='button';b.dataset.skip=unit;controlsRow.append(b);}
 controlsRow.append(field('Stage',stage),jump,field('Fork from turn',forkTurn),fork,reset);
 const statsBox=el('div');statsBox.id='lab-stats';statsBox.className='studio-grid';
 const controls=el('div');controls.id='lab-controls';controls.className='studio-card';controls.hidden=true;
 controls.append(controlsRow,el('strong','Player stat sliders — applied as labelled lab patches'),statsBox);
 // End summary and export.
 const exportBtn=el('button','Export transcript (markdown)');exportBtn.id='lab-export';exportBtn.type='button';exportBtn.hidden=true;
 const exportText=el('textarea');exportText.id='lab-export-text';exportText.spellcheck=false;exportText.hidden=true;
 const summary=el('details');summary.id='lab-summary';summary.append(el('summary','End summary'),exportBtn,exportText);
 section.append(el('p','An isolated lab campaign: only the chosen character is staged, controls act through engine commands or labelled lab-only patches, and saves are never touched.'),status,banner,buildLine,setup,cols,controls,summary);
 buildLine.append(refresh);
 if(pack()){const o=el('option','Current draft');o.value='draft';source.append(o);}
 call('/api/bootstrap').then(b=>{for(const p of b.packs||[]){const o=el('option',p.title);o.value=p.id;source.append(o);}}).catch(()=>{});
 const set=t=>{status.textContent=t;onStatus(t);};
 const lock=value=>{busy=value;start.disabled=value;send.disabled=value||!session;input.disabled=value||!session;refresh.disabled=value;};
 const nameOf=id=>view?.pack?.actors.find(a=>a.id===id)?.name||id;
 function renderPanel(s){
  const part=(title,lines)=>{const d=el('div');d.className='studio-card';d.append(el('strong',title));for(const l of lines)d.append(el('p',l));return d;};
  const bits=[];
  bits.push(part('Clock and place',[`day ${s.day} (${s.weekday}) · ${s.daypart} · ${s.locationName} · tick ${s.tick}${s.scene?` · scene with ${(s.scene.characters||[]).map(nameOf).join(', ')}`:''}`]));
  const gates=(s.gates||[]).map(g=>`${g.met?'✓':'✗'} next: ${g.toName||g.to}${g.event?` on ${g.event}`:''}${g.min!==undefined?` (${g.stat} ${g.value}/${g.min})`:''}${g.reasons?.length?` — ${g.reasons.join('; ')}`:''}`);
  bits.push(part(`Stage — ${s.stage?`${s.stage.name} (${s.stage.source})`:'none authored'}`,s.stage?.source==='progression'?[`stage id: ${s.stage.id}`,...gates]:gates.length?gates:['no authored gates to show']));
  const rel=s.relationships||{},nums=Object.entries(rel).filter(([,v])=>v!=null).map(([k,v])=>`${k} ${v}`);
  if(rel.rank)nums.push(`rank ${rel.rank}`);
  bits.push(part('Relationships (debug view — hidden stats included)',nums.length?nums:['no relationship numbers yet']));
  bits.push(part('Stats (all, including hidden)',(s.stats||[]).map(x=>`${nameOf(x.character)} · ${x.name} (${x.stat}): ${x.value}${x.visibility!=='public'?` [${x.visibility}]`:''}`)));
  const f=s.firsts;
  if(f)bits.push(part('Firsts',[...(f.active?[`active: ${f.active.title} (checkpoint ${f.active.checkpoint+1})`]:[]),...(f.offers||[]).map(o=>`available: ${o.title}`),`completed: ${f.completed.length}${f.completed.length?` — ${f.completed.join(', ')}`:''}`]));
  if(s.wants?.length)bits.push(part('Wants',s.wants.map(w=>w.text)));
  const goals=session?.npcId?goalRows(view?.state,view?.pack,session.npcId):[];
  if(goals.length)bits.push(part('Goals (feature-detected)',goals.map(goalMarker)));
  if(s.quests)bits.push(part('Quests (feature-detected)',[JSON.stringify(s.quests).slice(0,300)]));
  if(s.verdict)bits.push(part('Delivery verdict (feature-detected)',[JSON.stringify(s.verdict).slice(0,300)]));
  bits.push(part('Acts priced on the last turn',(s.lastActs||[]).map(a=>`${a.act}${a.target?` → ${a.target}`:''}: ${a.verdict}${a.points?` (${a.points>0?'+':''}${a.points})`:''}${a.reason?` — ${a.reason}`:''}`).length?(s.lastActs||[]).map(a=>`${a.act}${a.target?` → ${a.target}`:''}: ${a.verdict}${a.points?` (${a.points>0?'+':''}${a.points})`:''}${a.reason?` — ${a.reason}`:''}`):['none']));
  const last=rows.at(-1);
  if(last)bits.push(part('Latency',[`turn ${last.turn+1}: ${last.ms}ms${last.ttft!=null?` · ttft ${last.ttft}ms`:''}${last.promptTokens!=null?` · ${last.promptTokens} prompt tokens`:''}`]));
  panel.replaceChildren(...bits);
 }
 function renderBuild(b){
  banner.hidden=!b.stale;
  buildLine.firstChild?.nodeType===3&&buildLine.firstChild.remove();
  buildLine.insertBefore(document.createTextNode(`server started ${b.startedAt} · git ${b.git||'?'} · prompt ${b.promptHash}${b.stale?' · STALE':''} · `),refresh);
 }
 function appendRow(row){
  const wrap=el('article');wrap.className='studio-card';
  wrap.append(el('strong',`Turn ${row.turn+1}`),el('p',`You: ${row.input||row.command||''}`),el('p',row.text||(row.refusal?`Refused: ${row.refusal.reason}`:'(no reply)')));
  chat.append(wrap);chat.scrollTop=chat.scrollHeight;
 }
 function snapshotUI(r){rows.push(r);renderPanel(r.snapshot);exportBtn.hidden=false;controls.hidden=false;}
 async function guard(work){if(busy)return;lock(true);try{await work();}catch(e){set(e.message);}finally{lock(false);}}
 async function applyControl(body){
  const r=await call('/api/lab/control',{labId:session.labId,...body});
  view=r.view;renderPanel(r.snapshot);
  for(const p of r.patches||[])patches.push(p);
  return r;
 }
 source.onchange=async()=>{
  npc.replaceChildren(el('option','Choose a character…'));npc.disabled=true;
  const value=source.value;if(!value)return;
  try{
   const cast=value==='draft'?(pack()?.actors||[]).filter(a=>a.id!==pack().playerId).map(a=>({id:a.id,name:a.name})):(await call('/api/lab/cast',{packId:value})).cast;
   for(const c of cast){const o=el('option',c.name);o.value=c.id;npc.append(o);}
   npc.disabled=!cast.length;if(cast.length===1)npc.selectedIndex=1;
  }catch(e){set(e.message);}
 };
 start.onclick=()=>guard(async()=>{
  const value=source.value;if(!value)throw Error('Choose a project or pack first.');
  if(!npc.value)throw Error('Choose a character first.');
  const body={npcId:npc.value,provider:provider.value};
  if(value==='draft'){if(!pack())throw Error('Open a draft first.');body.pack=pack();}else body.packId=value;
  const r=await call('/api/lab/start',body);
  session={...r,npcId:npc.value};view=r.view;rows=[];patches=[];chat.replaceChildren();
  renderBuild(r.build);refresh.hidden=false;controls.hidden=false;
  stage.replaceChildren(el('option','Jump to…'));
  for(const s of r.stages){const o=el('option',s.name);o.value=s.id;stage.append(o);}
  statsBox.replaceChildren();
  for(const s of r.stats){
   const slider=el('input');slider.type='range';slider.min=String(s.min);slider.max=String(s.max);slider.value=String(s.value);
   const label=el('span',`${s.name}: ${s.value}`);slider.oninput=()=>{label.textContent=`${s.name}: ${slider.value}`;};
   slider.onchange=()=>guard(async()=>{await applyControl({kind:'stat',stat:s.id,value:Number(slider.value)});set(`Lab patch: ${s.name} set to ${slider.value}.`);});
   statsBox.append(field(`${s.name} (${s.id})`,slider));
  }
  set(`Lab started for ${npc.selectedOptions[0].textContent}. Only ${npc.selectedOptions[0].textContent} is staged; the conversation begins with your first line.`);
  send.disabled=false;input.disabled=false;input.focus();
 });
 send.onclick=()=>guard(async()=>{
  const text=input.value.trim();if(!text)throw Error('Type a line first.');
  input.value='';set('Waiting for the reply…');
  const r=await call('/api/lab/turn',{labId:session.labId,input:text});
  view=r.view;appendRow({...r.row,input:text});snapshotUI({...r.row,input:text});
  set(r.row.refusal?`Turn ${r.row.turn+1} was refused.`:`Turn ${r.row.turn+1} done in ${r.row.ms}ms.`);
 });
 input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!send.disabled)send.click();}};
 for(const b of controlsRow.querySelectorAll('[data-skip]'))b.onclick=()=>guard(async()=>{
  const r=await applyControl({kind:'skip',unit:b.dataset.skip});
  set(r.result.ok?`Skipped ${b.dataset.skip}. Now day ${r.snapshot.day}, ${r.snapshot.daypart}.`:`Skip refused: ${r.result.refusal?.reason||'unknown'}`);
 });
 jump.onclick=()=>guard(async()=>{
  if(!stage.value)throw Error('Choose a stage first.');
  await applyControl({kind:'stage',stage:stage.value});
  set(`Lab patch: jumped to stage ${stage.selectedOptions[0].textContent}. Applied as a labelled lab patch, not by play.`);
 });
 fork.onclick=()=>guard(async()=>{
  const n=Number(forkTurn.value);if(!Number.isInteger(n)||n<0||n>=rows.length)throw Error(`Fork needs a turn between 0 and ${rows.length-1}.`);
  const r=await applyControl({kind:'fork',turn:n});
  rows=rows.slice(0,n+1);chat.replaceChildren();for(const r2 of rows)appendRow({...r2});
  set(`Forked from turn ${n}; the lab continues as a new isolated campaign ${String(r.result.campaignId).slice(0,13)}.`);
 });
 reset.onclick=()=>guard(async()=>{
  await call('/api/lab/control',{labId:session.labId,kind:'reset'});
  rows=[];chat.replaceChildren();panel.replaceChildren();exportBtn.hidden=true;controls.hidden=true;
  set('Lab reset. The conversation starts over from the first meeting.');
 });
 refresh.onclick=()=>guard(async()=>{renderBuild(await call('/api/lab/build'));set('Build stamp refreshed.');});
 exportBtn.onclick=()=>{
  const out=['# Character Chat Lab transcript','',`Project: ${source.selectedOptions[0].textContent} · character: ${npc.selectedOptions[0].textContent} · turns ${rows.length}`,'',
   ...patches.map(p=>`- turn ${p.turn}: ${p.label}`),'','## Transcript',''];
  for(const r of rows){out.push(`### Turn ${r.turn+1} — player: ${r.input||r.command||''}`,'',r.text||'(no reply)');
   const goals=r.snapshot?.goals||[],prior=r.turn?rows[r.turn-1]?.snapshot?.goals||[]:[];
   for(const g of goals)if(!prior.some(x=>x.title===g.title&&x.step===g.step&&x.done===g.done))out.push('',`> goal ${goalMarker(g)}`);
   for(const a of r.snapshot?.lastActs||[])out.push('',`> act ${a.act}: ${a.verdict}${a.points?` (${a.points>0?'+':''}${a.points})`:''}${a.reason?` — ${a.reason}`:''}`);
   out.push('');}
  exportText.value=out.join('\n');exportText.hidden=false;
  if(download){download.remove();download=null;}
  download=el('a','Download .md');download.href=URL.createObjectURL(new Blob([exportText.value],{type:'text/markdown'}));download.download='character-lab-transcript.md';
  summary.append(download);
  set('Transcript exported below; copy it or download the markdown file.');
 };
 return {set};
}
