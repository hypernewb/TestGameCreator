const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined&&text!==null)n.textContent=text;if(cls)n.className=cls;return n;};
const SOURCE={model:['model','AI scene'],fallback:['fail','Fallback — model failed'],refusal:['fail','Refused'],rules:['rules','Rules only — no model'],untraced:['untraced','AI scene — no trace saved']};
const tag=(cls,text)=>el('span',text,'tag '+cls);
const words=(ws)=>{const s=el('span',undefined,'t');for(const w of ws)s.append(w.op==='same'?document.createTextNode(w.text):el(w.op==='del'?'del':'ins',w.text));return s;};
const line=(l,cls,note,body)=>{const p=el('p',undefined,'ln '+cls);if(l.name)p.append(el('b',l.name));p.append(body||el('span',l.text,'t'));if(note)p.append(el('small',note));return p;};
const diffRows=d=>d.map(x=>x.op==='same'?line(x.line,'from-model'):x.op==='edit'?line(x.line,'edited',x.speakerChanged?`edited — moved from ${x.from.name||'narration'} to ${x.line.name||'narration'}`:'edited',words(x.words)):x.op==='removed'?line(x.from,'removed','removed'):line(x.line,'added','added'));
const pretty=s=>{try{return JSON.stringify(JSON.parse(s),null,1);}catch{return s;}};
const col=(cls,title,...kids)=>{const c=el('section',undefined,'col '+cls);c.append(el('h3',title),...kids);return c;};
const none=t=>el('p',t,'none');
export function renderTurn(t){
 const box=el('article',undefined,'turn'),head=el('div',undefined,'turn-head'),[sc,sl]=SOURCE[t.source]||['untraced',t.source];
 head.append(tag(sc,sl),el('strong',t.command||'turn'),el('span',t.id));if(t.playedAt)head.append(el('span',new Date(t.playedAt).toLocaleString()));if(t.provider)head.append(el('span',t.provider));if(t.promptVersion)head.append(el('span','prompt '+t.promptVersion));
 const edits=t.finalDiff?t.finalDiff.filter(x=>x.op!=='same').length:0;head.append(tag(edits?'code':'model',t.finalDiff?edits?`${edits} line${edits>1?'s':''} changed by code`:'shown as written':'no model text to compare'));
 // 1. Input
 const quote=(label,text)=>{const q=el('div',undefined,'q');q.append(el('small',label),el('span',text||'(empty)'));return q;};
 const input=[t.input!=null?quote('Player typed',t.input):none('No typed input')];if(t.modelSaw!=null&&t.modelSaw!==t.input)input.push(quote('Sent to model as',t.modelSaw));
 // 2. What the model wrote
 const model=[];if(t.model)model.push(...t.model.map(l=>line(l,'from-model')));else model.push(none(t.source==='untraced'?'Played before tracing existed; only the displayed scene was saved.':t.source==='rules'?'No model call for this turn.':'No parsed model reply.'));
 if(t.failed)model.push(el('p','Failed: '+t.failed,'reject'));if(t.refusal)model.push(el('p',`Refused (${t.refusal.code}): ${t.refusal.reason||''}`,'reject'));
 for(const a of t.raw){const d=el('details');d.append(el('summary',`Raw reply, attempt ${a.attempt}${a.rejected?' — rejected':''}`));if(a.rejected)d.append(el('p',a.rejected,'reject'));d.append(el('pre',pretty(a.raw)));model.push(d);}
 for(const x of t.lint.filter(x=>x.repairRaw)){const d=el('details');d.append(el('summary',`Player-opening repair call${x.resolved?'':' — failed'}`));d.append(el('pre',pretty(x.repairRaw)));model.push(d);}
 // 3. Code repairs
 const code=[];for(const s of t.steps){const b=el('div',undefined,'step');b.append(el('strong',s.label));b.append(...diffRows(s.diff.filter(x=>x.op!=='same')));code.push(b);}
 if(t.summary&&t.summary.model!==undefined&&t.summary.final!==undefined&&t.summary.model!==t.summary.final){const b=el('div',undefined,'step');b.append(el('strong','Scene summary'),line({text:''},'edited','edited',words([{op:'del',text:t.summary.model||''},{op:'add',text:' '+(t.summary.final||'')}])));code.push(b);}
 if(t.end&&t.end.model!==t.end.final)code.push(el('p',`Scene end: model said ${t.end.model?'end':'continue'}, code ${t.end.final?'ended':'kept going'}`,'ln edited'));
 for(const x of t.lint.filter(x=>x.warned))code.push(el('p',`Style warning: ${x.check||x.code||''} ${x.message||x.detail||''}`.trim(),'none'));
 if(!code.length)code.push(none(t.model?'No changes — the model text passed through untouched.':'Nothing to compare.'));
 // 4. What the player saw
 const fin=t.finalDiff?diffRows(t.finalDiff):t.final.length?t.final.map(l=>line(l,'')):[none('No scene lines shown.')];
 // 5. Relationship changes
 const rel=t.changes.length?t.changes.map(c=>{const r=el('div',undefined,'rel'),h=el('div'),dim=c.dimension||c.stat||c.type.replace(/^\w+\./,'').replace(/Changed$/,'').replace(/[A-Z]/g,m=>' '+m.toLowerCase());h.append(el('strong',`${c.who||'?'}${c.toward?' → '+c.toward:''}`),document.createTextNode(` ${dim} `));if(c.delta!==undefined)h.append(el('span',(c.delta>0?'+':'')+c.delta,'d '+(c.delta>0?'up':c.delta<0?'down':'')));if(c.before!==undefined||c.after!==undefined)h.append(document.createTextNode(` (${c.before??'?'} → ${c.after??'?'})`));if(c.stage!==undefined)h.append(document.createTextNode(` stage ${c.stage}`));if(c.capped)h.append(tag('code','capped'));r.append(h);if(c.text)r.append(el('p',c.text));return r;}):[none('No relationship changes.')];
 const cols=el('div',undefined,'cols');cols.append(col('','Input',...input),col('m','Model wrote',...model),col('c','Code changed',...code),col('','Player saw',...fin),col('','Relationship changes',...rel));box.append(head,cols);return box;}
export function mountTurnCompare(root,{request=fetch,query=''}={}){
 let access='';const select=el('select'),load=el('button','Compare turns'),only=el('label'),box=el('input'),status=el('p',undefined,'muted'),legend=el('div',undefined,'tc-legend'),list=el('div'),bar=el('div',undefined,'tc-bar');let data=null;
 select.setAttribute('aria-label','Campaign');box.type='checkbox';box.style.width='auto';only.append(box,document.createTextNode(' Only turns code changed'));status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 legend.append(el('span'),el('span'),el('span'),el('span'));legend.children[0].append(tag('model','model'),document.createTextNode('model text kept as written'));legend.children[1].append(tag('code','code'),document.createTextNode('edited by our code — '),el('del','removed'),document.createTextNode(' '),el('ins','added'));legend.children[2].append(el('span','struck line','ln removed'),document.createTextNode(' model line code dropped'));legend.children[3].append(el('span','green line','ln added'),document.createTextNode(' line code added'));
 bar.append(select,load,only);root.append(bar,legend,status,list);
 async function api(path,body,creator=true){const r=await request(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{'Content-Type':'application/json',...(creator?{'x-story-memory':access}:{})}}),v=await r.json();if(!r.ok)throw Error(v.error||'Request failed');return v;}
 const draw=()=>{if(!data)return;const rows=data.turns.slice().reverse().filter(t=>!box.checked||t.steps.length||t.finalDiff?.some(x=>x.op!=='same'));list.replaceChildren(...(rows.length?rows.map(renderTurn):[none(box.checked?'No turns were changed by code.':'No played turns yet.')]));};
 box.onchange=draw;
 load.onclick=async()=>{const id=select.value;if(!id){status.textContent='Choose a campaign first.';return;}load.disabled=true;status.textContent='Loading…';try{if(!access)access=(await api('/api/creator/memory/access',{scope:'creator-debug'},false)).token;data=await api('/api/creator/turns/compare?id='+encodeURIComponent(id)+'&limit=80');const traced=data.turns.filter(t=>t.model).length;status.textContent=`${data.title}: ${data.turns.length} turns, newest first. ${traced} with a saved model trace.`;draw();}catch(e){access='';status.textContent=e.message;}finally{load.disabled=false;}};
 async function refresh(){try{const b=await api('/api/bootstrap',undefined,false);select.replaceChildren(el('option','Choose a campaign'));select.firstChild.value='';for(const c of b.campaigns){const o=el('option',`${c.id} - revision ${c.revision}`);o.value=c.id;select.append(o);}const want=new URLSearchParams(query).get('id');if(want&&b.campaigns.some(c=>c.id===want)){select.value=want;await load.onclick();}}catch(e){status.textContent=e.message;}}
 return {refresh,render:d=>{data=d;draw();}};}
if(typeof document!=='undefined'){const root=document.getElementById('turn-compare');if(root)mountTurnCompare(root,{query:location.search}).refresh();}
