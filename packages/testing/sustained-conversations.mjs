import {createHash} from 'node:crypto';

const meet=input=>({input,command:{type:'core.scene',args:{location:'apartment',characters:['jana'],activity:'talk',text:input}}});
const goodbye={input:'Goodbye',plannedExit:true};
export const SUSTAINED_SCENARIOS={
 warmth:{inputs:[meet('Hey Jana. How is your morning going?'),
  'Ask Jana whether she prefers coffee strong or mild.',
  'Tell her I like mine strong, but my sister Iris calls it swamp water.',
  'Tell her that swamp water should definitely be the name of our imaginary coffee shop.',
  'Compliment her sense of humor; she makes this apartment feel less unfamiliar.',
  'Tell her I grew up by Lake Alder and never learned to surf.',
  'Ask whether she would come to the beach with me on Sunday, just to hang out.',
  'Tell her there is no pressure to teach me; I would be happy just sharing the afternoon.',
  'Ask her what my sister calls my coffee.',goodbye]},
 continuity:{inputs:[meet('Hey Jana. I am feeling homesick today.'),
  'Tell her I miss walking by Lake Alder with my sister Iris.',
  'Tell her Iris used to bring a teal thermos of terrible coffee on those walks.',
  'Ask Jana what she misses about home.',
  'Tell her I would like to hear more about what she just shared.',
  'Thank her for listening; I do not need her to fix anything.',
  'Tell her I will call Iris on Sunday and tell her about Ashford.',
  'Ask her what color my sister’s thermos was.',
  'Ask her who I promised to call on Sunday.',goodbye]},
 affection:{initialTrust:{jana:80},inputs:[meet('Hey Jana. It is good to have a quiet moment together.'),
  'Tell her I have had a difficult morning and could use some company.',
  'Tell her I do not want advice right now, just someone willing to listen.',
  'Tell her I am worried I will disappoint my sister Iris.',
  'Tell her Iris is visiting on Sunday, and I want her to feel welcome.',
  'Ask Jana how her own morning has been.',
  'Tell her I am listening and she does not have to make it sound better than it was.',
  'Tell her I appreciate being able to talk honestly with her.',
  'Ask her when Iris is visiting.',goodbye]}
};

export function repeatedScenarios(fixtures,repeats){
 if(!Number.isInteger(repeats)||repeats<1||repeats>10)throw Error('repeats must be 1–10');
 return Object.fromEntries(Object.entries(fixtures).flatMap(([name,fixture])=>Array.from({length:repeats},(_,i)=>[`${name}-r${i+1}`,structuredClone(fixture)])));
}

// Separate public transcripts from the arm key and model verdicts, so reading can precede unblinding.
export function blindReview(rows,names,seed){
 if(names.length!==2)throw Error('Blind sustained review currently requires exactly two arms');
 const cases=[...new Set(rows.map(r=>r.scenario))],key={},parts=['# Blind sustained conversation review','',
  'Read complete A and B transcripts before opening the answer key or model report. Judge each against its own starting relationship. Jana remains a roommate with her authored relationships; high trust means close friendship, not a new romantic commitment.','',
  'For each transcript, record unmotivated topic changes (count and turn numbers), correct/wrong/missed callbacks (with quotes), reciprocal care (1–5), premature endings (turn numbers), and whether you want to answer (1–5). Also give a pair preference A/B/tie. Do not reward length alone. Refusals and failed replies are findings.',''];
 const scores=['case,transcript,topic_changes,correct_callbacks,wrong_callbacks,missed_callbacks,reciprocal_care_1_to_5,want_to_answer_1_to_5,premature_ending_turns,pair_preference,evidence'];
 for(const [i,scenario] of cases.entries()){
  const id=`Case ${i+1}`,selected=rows.filter(r=>r.scenario===scenario),reverse=createHash('sha256').update(`${seed}:${scenario}`).digest()[0]%2,order=reverse?[...names].reverse():names;
  key[id]={scenario,A:order[0],B:order[1]};
  parts.push(`## ${id}`,'',`Starting trust: ${JSON.stringify(selected[0][order[0]].before.relationships)}.`,
   `Character context: ${JSON.stringify(selected.find(r=>r[order[0]].context)?.[order[0]].context?.castProfiles||[])}`,'');
  for(const [j,n] of order.entries()){
   const label=j?'B':'A';parts.push(`### Transcript ${label}`,'');
   for(const r of selected)parts.push(`**Turn ${r.turn+1} — Player:** ${r.input}`,'','```text',r[n].text,'```','');
   scores.push(`${id},${label},,,,,,,,,`);
  }
 }
 return {markdown:parts.join('\n'),csv:scores.join('\n')+'\n',key};
}

export function sustainedMetrics(rows,names){
 return Object.fromEntries(names.map(n=>[n,{
  turns:rows.length,refusalsOrFailures:rows.filter(r=>r[n].error).length,
  sceneCalls:rows.reduce((s,r)=>s+r[n].sceneCalls,0),modelCalls:rows.reduce((s,r)=>s+(r[n].modelCalls||0),0),
  multipleCallTurns:rows.filter(r=>r[n].modelCalls>1).map(r=>`${r.scenario}:${r.turn+1}`),
  unplannedClosures:rows.filter(r=>!r.plannedExit&&r[n].events.some(e=>e.type==='core.sceneEnded')).map(r=>`${r.scenario}:${r.turn+1}`)
 }]));
}
