// M5 widgets: four short real-time games, one per stat. Presentation only: each resolves to a tier the engine prices
// (packages/modules/minigames.mjs). Skip is always offered and is the floor. Pure parts are exported for tests.
export const GAMES={fitness:'timing',focus:'memory',wit:'quiz',charm:'rhythm'};
// Mirrors gameOf in packages/modules/minigames.mjs (tests pin that they agree): own game, else the game of its first trained stat.
export const gameFor=a=>a.game||GAMES[(a.effects||[]).find(e=>e.type==='stat'&&GAMES[e.stat])?.stat]||'timing';
export const TITLES={timing:'Hit the zone',memory:'Match the pairs',quiz:'Quick answers',rhythm:'Tap on the beat'};
export const HOW={timing:'Press when the marker is inside the bright zone. Five tries.',memory:'Flip two cards at a time and find all six pairs before time runs out.',quiz:'Pick the right answer before the bar runs out. Six questions.',rhythm:'Tap when the ring closes on the circle. Eight beats.'};
export const tierFor=f=>f>=0.8?'great':f>=0.5?'good':'ok';
// Timing: a hit is |marker-centre| within half the zone; the zone shrinks each try.
export const zoneFor=i=>({centre:[0.7,0.3,0.55,0.8,0.4][i%5],width:0.22-i*0.025});
export const timingHit=(pos,z)=>Math.abs(pos-z.centre)<=z.width/2;
// Rhythm: full credit within 90 ms of the beat, half within 200 ms.
export const beatScore=ms=>Math.abs(ms)<=90?1:Math.abs(ms)<=200?0.5:0;
// Memory: all pairs found, minus a little per miss beyond the first four.
export const memoryScore=(found,pairs,misses)=>Math.max(0,found/pairs-(found===pairs?Math.max(0,misses-4)*0.06:0));
export function deal(rand=Math.random,pairs=6){const faces=['☀','☂','♣','♥','♦','♠','★','☾'].slice(0,pairs),cards=[...faces,...faces];for(let i=cards.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]];}return cards;}
export function question(rand=Math.random){const a=2+Math.floor(rand()*11),b=2+Math.floor(rand()*11),op=rand()<0.5?'+':'×',answer=op==='+'?a+b:a*b,wrong=new Set();
 while(wrong.size<3){const d=(1+Math.floor(rand()*5))*(rand()<0.5?-1:1),w=answer+(op==='×'&&rand()<0.5?d*Math.min(a,b):d);if(w!==answer&&w>0)wrong.add(w);}
 const options=[answer,...wrong];for(let i=options.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[options[i],options[j]]=[options[j],options[i]];}return {text:`${a} ${op} ${b}`,answer,options};}

// DOM: one <dialog> reused. play(activity,{name}) -> Promise<'skip'|'ok'|'good'|'great'>.
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const button=(text,cls)=>{const b=el('button',text,cls);b.type='button';return b;};
function shell(){let d=document.getElementById('minigame');if(!d){d=el('dialog',undefined,'minigame');d.id='minigame';document.body.append(d);}return d;}
export function play(activity,{name=activity.name}={}){
 const kind=gameFor(activity),d=shell(),stage=el('div',undefined,'minigame__stage'),score=el('p','','minigame__score'),skip=button('Skip · take the usual','minigame__skip'),start=button('Play','minigame__go');
 d.replaceChildren(el('small',name.toUpperCase()),el('h2',TITLES[kind]),el('p',HOW[kind],'minigame__how'),stage,score,el('div',undefined,'minigame__bar'));d.lastChild.append(start,skip);
 return new Promise(resolve=>{let done=false,stop=()=>{};const finish=r=>{if(done)return;done=true;stop();d.close();resolve(r);};
  skip.onclick=()=>finish('skip');d.oncancel=e=>{e.preventDefault();finish('skip');};
  start.onclick=()=>{start.hidden=true;stop=GAME[kind](stage,score,f=>{const t=tierFor(f);score.textContent=`${Math.round(f*100)}% · ${t.toUpperCase()}`;skip.hidden=true;const ok=button('Continue','minigame__go');d.lastChild.append(ok);ok.focus();ok.onclick=()=>finish(t);});};
  d.showModal();start.focus();});
}
const GAME={
 timing(stage,score,end){const track=el('div',undefined,'mg-track'),zone=el('div',undefined,'mg-zone'),mark=el('div',undefined,'mg-mark'),hit=button('Now!','minigame__go');track.append(zone,mark);stage.replaceChildren(track,hit);
  let i=0,hits=0,pos=0,dir=1,raf,last=performance.now();const setZone=()=>{const z=zoneFor(i);zone.style.left=`${(z.centre-z.width/2)*100}%`;zone.style.width=`${z.width*100}%`;};setZone();
  const tick=t=>{pos+=dir*(t-last)/(900-i*90);last=t;if(pos>1){pos=1;dir=-1;}if(pos<0){pos=0;dir=1;}mark.style.left=`${pos*100}%`;raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  const press=()=>{const ok=timingHit(pos,zoneFor(i));hits+=ok;track.animate([{background:ok?'#6b8f5e':'#8f4a3e'},{}],{duration:250});i++;score.textContent=`${hits} / ${i}`;if(i>=5){cancelAnimationFrame(raf);hit.disabled=true;end(hits/5);}else setZone();};
  hit.onclick=press;const key=e=>{if(e.code==='Space'){e.preventDefault();press();}};document.addEventListener('keydown',key);hit.focus();
  return ()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',key);};},
 memory(stage,score,end){const cards=deal(),grid=el('div',undefined,'mg-grid'),open=[],PAIRS=6,LIMIT=30;let found=0,misses=0,left=LIMIT,lock=false,over=false;
  const finish=()=>{if(over)return;over=true;clearInterval(timer);end(memoryScore(found,PAIRS,misses));},show=()=>{score.textContent=`${found} / ${PAIRS} pairs · ${left}s`;};
  grid.append(...cards.map((f,k)=>{const c=button('?','mg-card');c.onclick=()=>{if(lock||over||c.dataset.done||open.includes(k))return;c.textContent=f;c.classList.add('mg-card--up');open.push(k);if(open.length<2)return;
   const [a,b]=open.splice(0),ca=grid.children[a],cb=grid.children[b];if(cards[a]===cards[b]){ca.dataset.done=cb.dataset.done='1';found++;show();if(found===PAIRS)finish();return;}
   misses++;lock=true;setTimeout(()=>{for(const x of [ca,cb]){x.textContent='?';x.classList.remove('mg-card--up');}lock=false;},550);};return c;}));
  stage.replaceChildren(grid);show();const timer=setInterval(()=>{left--;show();if(left<=0)finish();},1000);return ()=>clearInterval(timer);},
 quiz(stage,score,end){let n=0,right=0,timer;const N=6,MS=4000,ask=()=>{if(n>=N)return end(right/N);const q=question(),bar=el('div',undefined,'mg-time'),opts=el('div',undefined,'mg-options');
   const answer=v=>{clearTimeout(timer);right+=v===q.answer;n++;score.textContent=`${right} / ${n}`;ask();};
   opts.append(...q.options.map(v=>{const b=button(String(v),'mg-option');b.onclick=()=>answer(v);return b;}));stage.replaceChildren(el('p',q.text,'mg-question'),bar,opts);
   bar.animate([{width:'100%'},{width:'0%'}],{duration:MS,easing:'linear',fill:'forwards'});timer=setTimeout(()=>answer(null),MS);};ask();return ()=>clearTimeout(timer);},
 rhythm(stage,score,end){const pad=button('','mg-pad'),ring=el('span',undefined,'mg-ring'),N=8,GAP=900,t0=performance.now()+800;pad.append(ring);stage.replaceChildren(pad);
  let total=0,beat=0,raf,taken=new Set();const at=k=>t0+k*GAP;
  const done=setTimeout(()=>{cancelAnimationFrame(raf);end(total/N);},at(N-1)+250-performance.now());
  const tick=t=>{while(beat<N&&t>at(beat)+200){if(!taken.has(beat))score.textContent=`Missed · ${total.toFixed(1)} / ${N}`;beat++;}if(beat>=N)return;
   const p=Math.max(0,(at(beat)-t)/GAP);ring.style.transform=`scale(${1+p*1.1})`;ring.style.opacity=String(1-p*0.6);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);
  const tap=()=>{const now=performance.now(),k=Math.round((now-t0)/GAP);if(k<0||k>=N||taken.has(k))return;const s=beatScore(now-at(k));if(!s&&now<at(k))return;taken.add(k);total+=s;pad.animate([{background:s===1?'#6b8f5e':s?'#a88a45':'#8f4a3e'},{}],{duration:200});score.textContent=`${s===1?'Perfect':s?'Close':'Off'} · ${total.toFixed(1)} / ${N}`;};
  pad.onclick=tap;const key=e=>{if(e.code==='Space'){e.preventDefault();tap();}};document.addEventListener('keydown',key);pad.focus();
  return ()=>{clearTimeout(done);cancelAnimationFrame(raf);document.removeEventListener('keydown',key);};},
};
