// Real-provider smoke test for the continuous Morning/Afternoon/Evening loop.
// Usage: node scripts/three-day-smoke.mjs http://127.0.0.1:3210 sample.crossed-plans
import {calendarFor} from '../public/calendar.mjs';

const base=(process.argv[2]||'http://127.0.0.1:3210').replace(/\/$/,''),packId=process.argv[3]||'sample.crossed-plans';
const post=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();if(!response.ok)throw Error(value.error||`${path}: ${response.status}`);return value;};
const inputs=[
 'Stay in my room and read for a while.',
 'Go to the town square and look around.',
 'Return to my room and tidy the desk.',
 'Go to the town square and watch people pass.',
 'Return to my room and sketch for a while.',
 'Go to the town square and study the shop windows.',
 'Return to my room and organize my notes.',
 'Go to the town square and take a slow walk.',
 'Return to my room and read by the window.'
];
let data=await post('/api/new',{packId}),previousTick=data.state.tick;const report=[],authoredChoices=[];
async function resolveRequiredChoices(){
 for(let guard=0;guard<20;guard++){
  const choice=data.actions?.find(action=>action.enabled&&action.type==='story.choose');if(!choice)return;
  data=await post('/api/action',{campaignId:data.state.campaignId,id:`three-day-choice-${Date.now()}-${guard}`,expectedRevision:data.state.revision,command:{type:choice.type,args:choice.args}});
  authoredChoices.push(choice.label);
 }
 throw Error('Authored choice queue did not settle after 20 choices.');
}
for(const [index,input] of inputs.entries()){
 await resolveRequiredChoices();
 try{data=await post('/api/action',{campaignId:data.state.campaignId,id:`three-day-smoke-${Date.now()}-${index}`,expectedRevision:data.state.revision,input});}
 catch(error){throw Error(`Action ${index+1} failed (tick ${previousTick}): ${input}\n${error.message}`);}
 const turn=data.turn||Object.values(data.state.turns).at(-1),clock=calendarFor(data.state.tick,data.pack),timeEvents=turn.events.filter(event=>event.type==='core.timeAdvanced');
 report.push({action:index+1,input,command:turn.command.type,from:previousTick,to:data.state.tick,weekday:clock.weekday,daypart:clock.daypart,sceneOpen:Boolean(data.state.scene),timeEvents:timeEvents.length,fallback:Boolean(turn.fallback),failureReason:turn.failureReason||''});previousTick=data.state.tick;
}
await resolveRequiredChoices();
const failures=report.filter(row=>row.to-row.from!==4||row.sceneOpen||row.timeEvents!==1||row.fallback);
console.log(JSON.stringify({campaignId:data.state.campaignId,packId,authoredChoices,actions:report,passed:failures.length===0,failures},null,2));
if(failures.length)process.exitCode=1;
