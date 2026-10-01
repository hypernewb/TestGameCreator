// Falsification runs for the director-as-DM card (docs/design/director-dm.md): seeded multi-day campus runs with
// no model. 'player' resolves every incident through its first choice and takes dealt events; 'ignorer' walks out
// of every incident, so the once-only escalation is exercised. Prints the instruments the card names
// (trailingDrought, zeroBeatWindows, maxQuietDayparts, firstDrama, deadRatio, storylets) plus a funLine per run.
// Deterministic: the same seed produces the same numbers on the same build.
// Usage: node scripts/falsify-director.mjs [--pack campus] [--days 15] [--seeds 3,11,29] [--player-only] [--ignore-only]
import {fileURLToPath} from 'node:url';
import {createWorld,execute} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {readPack} from '../packages/cards/director-library.mjs';
import {funMetrics,funLine} from '../packages/testing/fun-metrics.mjs';
import {calendarFor} from '../public/calendar.mjs';
const arg=(k,d)=>{const i=process.argv.indexOf('--'+k);return i<0?d:process.argv[i+1];},flag=k=>process.argv.includes('--'+k);
const packName=arg('pack','campus'),days=+arg('days',15),seeds=arg('seeds','3,11,29').split(',').map(Number);
const profiles=flag('player-only')?['player']:flag('ignore-only')?['ignorer']:['player','ignorer'];
const p=readPack(fileURLToPath(new URL(`../packs/${packName}.json`,import.meta.url)));

const run=(seed,ignores)=>{
 let s=createWorld(p,registry,`falsify-${seed}`,seed);
 const act=(type,args={})=>{const r=execute(s,{id:`f${s.revision}`,actorId:p.playerId,type,args,expectedRevision:s.revision},p,registry);s=r.state;return r;};
 const safe=(type,args={})=>{try{return act(type,args),true;}catch{return false;}};
 let guard=0;
 while(guard++<3000&&calendarFor(s.tick,p).day<=days){
  const st=s.modules['story.scenes'],id=st.pending;
  if(id){
   const scene=p.scriptedScenes.find(x=>x.id===id),incident=scene?.trigger?.event==='story.incident';
   if(ignores&&incident){safe('story.leave',{scene:id});continue;}
   if(scene?.choices?.length&&scene.choices.some(c=>safe('story.choose',{scene:id,choice:c.id})))continue;
   safe('core.endScene',{reason:'natural'});continue;
  }
  if(s.scene){safe('core.endScene',{reason:'natural'});continue;}
  const offer=!ignores&&s.modules['story.director']?.offers?.find(o=>!o.accepted);
  if(offer&&safe('story.startOfferedScene',{scene:offer.scene}))continue;
  safe('core.wait');
 }
 return funMetrics(s,p);
};

console.log(`falsify pack=${packName} days=${days} seeds=${seeds.join(',')} profiles=${profiles.join(',')} director=${p.directorProfile?'baked':'none'}`);
const rows=[];
for(const profile of profiles)for(const seed of seeds){
 const m=run(seed,profile==='ignorer');rows.push({profile,seed,m});
 console.log(`${profile.padEnd(8)} seed=${String(seed).padStart(2)} | quiet max ${m.maxQuietDayparts??'—'} | beat windows 10m ${m.zeroBeatWindows??'—'} | tail drought ${m.trailingDrought??'—'}m | 1st drama ${m.firstDrama?`${m.firstDrama.minutes}m/t${m.firstDrama.turn}`:'—'} | dead ${m.deadRatio??'—'} | storylets ${m.storylets.seen}/${m.storylets.total} | beats cast ${m.spotlight?m.spotlight.counts.map(c=>`${c.id}:${c.n}`).join(' ')+(m.spotlight.spread?` (×${m.spotlight.spread})`:''):'—'}`);
 console.log(`         ${funLine(m)}`);
}
if(flag('json'))console.log(JSON.stringify(rows.map(({profile,seed,m})=>({profile,seed,quietMax:m.maxQuietDayparts,zeroBeatWindows:m.zeroBeatWindows,trailingDrought:m.trailingDrought,firstDrama:m.firstDrama?.minutes??null,deadRatio:m.deadRatio,storyletsSeen:m.storylets.seen,storyletsTotal:m.storylets.total,spotlight:m.spotlight}))));
