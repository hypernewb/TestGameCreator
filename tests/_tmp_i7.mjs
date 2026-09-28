import {readFileSync} from 'node:fs';
import {createWorld,execute,validatePack,actions} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {createProposal,applyProposal,withProposal,playability} from '../packages/ai/bulk-authoring.mjs';
import {reviewProposal} from '../packages/ai/proposal-review.mjs';
import {intimacyCandidate} from '../packages/cards/intimacy-skeleton.mjs';
const h=JSON.parse(readFileSync('tests/fixtures/bulk-replies/huntrix.pack.json','utf8'));
const c=intimacyCandidate(h,{characters:'rumi',contentLevel:'suggestive'});console.log(c.warnings,c.intimacy);
const p=createProposal(h,c,{});try{validatePack(withProposal(h,p),registry);console.log('valid w/o ages??');}catch(e){console.log('expected fail:',e.message);}
const aged=structuredClone(h);for(const a of aged.actors)a.age=25;aged.actors.find(a=>a.id==='mira').location='kitchen-bar';
const p2=createProposal(aged,intimacyCandidate(aged,{characters:'rumi',contentLevel:'suggestive'}),{});const r=reviewProposal(aged,p2,{play:false});console.log(r.errors,r.entries.map(e=>[e.id,e.adult,e.errors,e.warnings]));
const ap={...p2,scenes:p2.scenes.map(e=>({...e,status:'approved'}))};const next=applyProposal(aged,ap);console.log(Object.keys(next.modules),next.intimacyProfiles,playability(next).filter(w=>/rumi/.test(w)));
const q=structuredClone(next);q.datingProfiles.find(d=>d.character==='rumi').initialPhase='dating';Object.assign(q.datingProfiles.find(d=>d.character==='rumi'),{initialChemistry:60,initialSatisfaction:30});
validatePack(q,registry);let s=createWorld(q,registry,'t');const act=(type,args={})=>{const r=execute(s,{id:'t'+s.revision,actorId:q.playerId,type,args,expectedRevision:s.revision},q,registry);s=r.state;return r;};
act('core.move',{to:'main-party-room'});console.log(s.actors.player.location,actions(s,q,registry).filter(a=>/intim|Rumi/i.test(a.type+a.label)).map(a=>a.type+' '+a.label));
act('social.requestIntimacy',{character:'rumi',category:'together'});act('social.beginIntimacy',{character:'rumi',category:'together'});
for(let i=0;i<5;i++){const sc=s.modules['story.scenes'];const as=actions(s,q,registry);console.log(sc.pending,sc.pendingBeat,as.filter(a=>/^Stop:/.test(a.label)||a.args?.choice==='stop').map(a=>a.label));act('story.choose',{scene:'rumi-intimate',choice:'go'});}
console.log(s.modules['story.scenes'].pending,s.flags['rumi-night'],s.modules['social.intimacy'].characters.rumi.encounters);
