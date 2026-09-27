// Compact playtest against a live local model. Prints one line per turn plus a summary, not raw logs.
// Usage: node scripts/playtest.mjs [--size minimal|default|max] [--filler N] [--endpoint URL] [--model ID] [--pack ID] [--verbose]
// Always runs on a throwaway DB in the OS temp dir; never touches data/campaigns.sqlite.
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createApp} from '../server.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];},flag=k=>process.argv.includes('--'+k);
const size=arg('size','minimal'),filler=+arg('filler',12),verbose=flag('verbose'),packId=arg('pack','sample.living-world');
const endpoint=arg('endpoint',process.env.STORY_ENDPOINT||'http://localhost:1234/v1'),model=arg('model',process.env.STORY_MODEL||'qwen3.5-text-9b-nsfw-rp-roleplay-i1');
// Facts planted early, then asked back after filler turns push them out of the verbatim window.
const setup=["Go to the workshop and find Brin","Tell Brin my name is Mara, my favorite color is teal, and I grew up by the harbor","Tell Brin about the storm that sank my father's boat","Tell Brin I once built a kite that flew for an hour","Tell Brin I am nervous about the meeting with Ada"];
const fillers=["Ask Brin what he is building","Ask Brin how long he has worked here","Ask Brin what tools he likes best","Ask Brin whether he has family nearby","Ask Brin what he does on rest days","Ask Brin what the hardest project he ever finished was","Ask Brin what he thinks of Cyra","Ask Brin whether the workshop gets cold at night","Ask Brin what music he listens to while working","Ask Brin whether he ever wanted a different job","Tell Brin a joke about a clockmaker","Ask Brin what he would build with unlimited brass","Ask Brin what he had for breakfast","Ask Brin whether he believes in luck"];
const recall=[["Ask Brin if he remembers my name",/mara/i],["Ask Brin what my favorite color is",/teal/i],["Ask Brin where I grew up",/harbou?r/i],["Ask Brin what happened to my father's boat",/storm|sank|sunk|wreck|lost/i],["Ask Brin what I built that flew for an hour",/kite/i],["Ask Brin what I said I was nervous about",/ada|meeting/i]];
const plan=[...setup.map(i=>({input:i})),...Array.from({length:filler},(_,k)=>({input:fillers[k%fillers.length]})),...recall.map(([input,expect])=>({input,expect}))];
const words=t=>String(t).toLowerCase().replace(/[^a-z0-9' ]+/g,' ').split(/\s+/).filter(Boolean);
const grams=(t,n)=>{const w=words(t),g=new Set();for(let i=0;i+n<=w.length;i++)g.add(w.slice(i,i+n).join(' '));return g;};
const overlap=(a,b)=>{if(!a.size||!b.size)return 0;let n=0;for(const x of a)if(b.has(x))n++;return n/Math.min(a.size,b.size);};
// Echo: the reply parrots the player's own phrasing (5-word run) or mostly repeats the previous reply (trigram overlap).
const echoOf=(text,input,prev)=>{const p=[...grams(input,5)].find(g=>grams(text,5).has(g));if(p)return 'input';return prev&&overlap(grams(text,3),grams(prev,3))>0.5?'repeat':'';};
const reportOf=o=>{let hit=null;const rec=x=>{if(x&&typeof x==='object'){if(x.v===1&&x.included)hit=x;for(const v of Object.values(x))rec(v);}};rec(o);return hit;};
const dir=mkdtempSync(join(tmpdir(),'story-playtest-'));
const {server,service}=createApp({dataPath:join(dir,'playtest.sqlite')});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`;
const api=async(p,b)=>(await fetch(base+p,b?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}:{})).json();
const rows=[];let prev='';
try{
  await api('/api/ai/config',{mode:'local',endpoint,model});await api('/api/ai/context-size',{size});
  let s=(await api('/api/new',{packId})).state;if(!s)throw new Error(`could not start pack ${packId}`);
  console.log(`playtest size=${size} model=${model} pack=${packId} turns=${plan.length}`);
  console.log(' #  sec  used/budget  cut over  cmd            recall echo  input');
  for(const [i,{input,expect}] of plan.entries()){
    const t0=Date.now(),r=await api('/api/action',{campaignId:s.campaignId,id:randomUUID(),expectedRevision:s.revision,input}),sec=(Date.now()-t0)/1000;
    const row={i,input,sec,expect:!!expect};rows.push(row);
    if(r.error){row.error=r.error;s=(await api('/api/load',{id:s.campaignId})).state||s;console.log(`${String(i).padStart(2)} ${sec.toFixed(1).padStart(4)}  ERROR ${r.error.slice(0,80)}`);continue;}
    s=r.state;const turn=Object.values(s.turns).sort((a,b)=>(a.tick??0)-(b.tick??0)).at(-1),rep=reportOf(turn);
    const text=typeof turn.narrative==='string'?turn.narrative:JSON.stringify(turn.narrative??'');
    Object.assign(row,{used:rep?.used,budget:rep?.budget,cut:rep?.cut?.length??0,over:!!rep?.overBudget,cmd:turn.command?.type??(r.clarification?'clarify':'-'),fallback:turn.fallback?turn.failureReason||'yes':'',echo:echoOf(text,input,prev),pass:expect?expect.test(text):null});prev=text;
    const rc=row.pass===null?'  ':row.pass?'ok':'NO';
    console.log(`${String(i).padStart(2)} ${sec.toFixed(1).padStart(4)}  ${`${row.used??'?'}/${row.budget??'?'}`.padStart(11)}  ${String(row.cut).padStart(3)} ${row.over?'OVER':'    '}  ${(row.fallback?'FALLBACK':row.cmd).slice(0,14).padEnd(14)} ${rc.padStart(6)} ${(row.echo||'').padEnd(6)}${input.slice(0,48)}`);
    if(verbose||row.pass===false)console.log(`      > ${text.replace(/\s+/g,' ').slice(0,200)}`);
  }
}finally{server.close();try{rmSync(dir,{recursive:true,force:true});}catch{}} // Windows may still hold the SQLite handle; the OS temp dir is fine to leave
const ok=rows.filter(r=>!r.error),peak=Math.max(0,...ok.map(r=>r.used??0)),rc=rows.filter(r=>r.expect),n=k=>ok.filter(r=>r[k]).length;
const cal=service.provider?.calibration;
console.log(`\nsummary: ${ok.length}/${rows.length} turns ok | recall ${rc.filter(r=>r.pass).length}/${rc.length} | over-budget ${n('over')} | fallbacks ${n('fallback')} | echoes ${n('echo')} | peak used ${peak}/${ok[0]?.budget??'?'} | avg ${(rows.reduce((a,r)=>a+r.sec,0)/Math.max(1,rows.length)).toFixed(1)}s/turn${cal?` | calib ${cal.ratio}x${cal.samples}`:''}`);
process.exit(0);
