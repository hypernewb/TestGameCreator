// Turn comparison: what the player typed, what the model wrote, what our code changed, what was shown, and what moved
// in relationships. Read-only over saved turns; creator/debug only (raw replies can carry hidden facts).
const STAGES={model:'Model reply (parsed)','player-opening-repair':'Player-opening repair call',guard:'Cast/agency guard',repeats:'Repeat filter','stock-phrases':'Stock-phrase filter',advances:'Advance filter',sanitize:'Presentation sanitizer'};
const AI_FREE=new Set(['Game rules','Authored scene']);
const norm=t=>String(t||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim(),key=l=>`${l.speaker||''}\u0000${l.text}`;
const lcs=(a,b,eq)=>{const m=a.length,n=b.length,t=Array.from({length:m+1},()=>new Uint16Array(n+1));for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)t[i][j]=eq(a[i],b[j])?t[i+1][j+1]+1:Math.max(t[i+1][j],t[i][j+1]);const out=[];let i=0,j=0;while(i<m&&j<n){if(eq(a[i],b[j])){out.push(['same',a[i],b[j]]);i++;j++;}else if(t[i+1][j]>=t[i][j+1])out.push(['del',a[i++]]);else out.push(['add',null,b[j++]]);}while(i<m)out.push(['del',a[i++]]);while(j<n)out.push(['add',null,b[j++]]);return out;};
// Word-level diff of one line: [{op:'same'|'del'|'add',text}], whitespace kept with its word.
export function wordDiff(a='',b=''){const split=s=>s.match(/\s*(?:[\p{L}\p{N}_'’]+|[^\s\p{L}\p{N}_'’])/gu)||[],x=split(a),y=split(b),ops=lcs(x,y,(p,q)=>p.trim()===q.trim()),out=[];for(const [op,p,q] of ops){const text=op==='add'?q:p;if(out.at(-1)?.op===op)out.at(-1).text+=text;else out.push({op,text});}return out;}
// Line diff between two stages. Adjacent removed+added lines pair up as an edit with a word diff when the speaker matches,
// or when code moved the words to another speaker (e.g. narration `Brin: "Hi."` re-attributed to Brin).
export function lineDiff(before=[],after=[]){const ops=lcs(before,after,(p,q)=>key(p)===key(q)),out=[];
 for(let i=0;i<ops.length;i++){const [op,a,b]=ops[i];if(op==='same'){out.push({op,line:b});continue;}
  if(op==='del'){const k=ops.slice(i+1).findIndex(([o])=>o!=='del'),j=k<0?-1:i+1+k,next=ops[j];const moved=next?.[0]==='add'&&(next[2].speaker||'')!==(a.speaker||'')&&norm(next[2].text).length>2&&norm(a.text).includes(norm(next[2].text));if(next?.[0]==='add'&&((next[2].speaker||'')===(a.speaker||'')||moved)){out.push({op:'edit',from:a,line:next[2],words:wordDiff(a.text,next[2].text),...(moved?{speakerChanged:true}:{})});ops.splice(j,1);continue;}out.push({op:'removed',from:a});continue;}
  out.push({op:'added',line:b});}
 return out;}
const changed=d=>d.some(x=>x.op!=='same');
const relevant=e=>e.type!=='social.spoke'&&(/^social\.|^character\.stat|^romance\./.test(e.type)||Number.isFinite(e.payload?.delta));
const changeOf=(e,name)=>{const p=e.payload||{},who=p.actor??p.character??p.from,other=p.toward??p.rival??(typeof p.to==='string'?p.to:undefined),before=p.old??(typeof p.from==='number'?p.from:undefined),after=p.value??(typeof p.to==='number'?p.to:p.meter);return {type:e.type,who:who&&name(who),toward:other&&name(other),...(p.dimension?{dimension:p.dimension}:{}),...(p.stat?{stat:p.stat}:{}),...(Number.isFinite(p.delta)?{delta:p.delta}:Number.isFinite(before)&&Number.isFinite(after)?{delta:after-before}:{}),...(Number.isFinite(before)?{before}:{}),...(Number.isFinite(after)?{after}:{}),...(p.stage!==undefined?{stage:p.stage}:{}),...(p.capped?{capped:true}:{}),text:typeof p.text==='string'?p.text:''};};
export function turnComparisons(state,pack,{limit=60}={}){
 const name=id=>pack.actors.find(a=>a.id===id)?.name||id,named=l=>({...l,name:l.speaker?name(l.speaker):''}),turns=Object.values(state.turns||{}),rows=[];
 for(const t of turns){const parent=rows.findLast(r=>t.id.startsWith(r.id+'-'));if(parent){parent.followUps.push(t);continue;}rows.push({id:t.id,turn:t,followUps:[]});}
 return rows.filter(r=>r.turn.input!==undefined||r.turn.sceneLines?.length||r.turn.sceneTrace).slice(-limit).map(({id,turn:t,followUps})=>{
  const tr=t.sceneTrace,stages=(tr?.stages||[]).map(s=>({...s,label:STAGES[s.stage]||s.stage,lines:s.lines.map(named)})),final=(t.sceneLines||[]).map(named),model=stages[0]?.lines||null;
  const steps=stages.slice(1).map((s,i)=>({stage:s.stage,label:s.label,diff:lineDiff(stages[i].lines,s.lines)})).filter(s=>changed(s.diff));
  const source=t.fallback?'fallback':tr?.refusal?'refusal':AI_FREE.has(t.provider)||!tr&&!t.sceneRequest?'rules':tr?'model':'untraced';
  const events=[t,...followUps].flatMap(x=>x.events||[]).filter(relevant);
  return {id,playedAt:t.playedAt||null,command:t.command?.type||'',input:t.input??null,modelSaw:t.sceneRequest?.playerAction??null,provider:t.provider||'',promptVersion:t.promptVersion||'',source,
   raw:(tr?.raw||[]).map(a=>({...a})),failed:tr?.failed||t.failureDiagnostic?.detail||null,refusal:t.refusal?{code:t.refusal.code,reason:t.refusal.reason}:null,
   model,steps,final,finalDiff:model?lineDiff(model,final):null,summary:tr?.summary||null,end:tr?.end||null,lint:(t.lintTrace||[]).map(x=>({...x})),
   changes:events.map(e=>changeOf(e,name))};});}
