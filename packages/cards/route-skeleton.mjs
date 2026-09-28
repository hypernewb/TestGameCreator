// Route skeleton (docs/GENERATOR-PLAN.md step 4). Code builds each love interest's ladder — flirt → charged → kiss → night → again,
// plus a daytime hangout that is always there,
// as gated hand cards at their home, with checks that fail forward — plus the run, a last-day scene and endings. The model only
// fills the prose slots (RUNGS × PROSE, one small request per love interest); ids, gates, numbers and effects never come from it.
export const RUNGS=['hangout','flirt','charged','kiss','properly','night','again'];
export const PROSE=['title','opening','says','boldChoice','boldWorks','boldFails','safeChoice','safeResult'];
const STATS=[['charm','Charm'],['nerve','Nerve'],['wit','Wit']],RANKS=[{min:0,name:'Rusty'},{min:4,name:'Steady'},{min:8,name:'Smooth'},{min:13,name:'Unshakeable'}];
const flag=(id,value=true)=>({type:'flag',id,value}),chem=(character,delta,reason)=>({type:'chemistry',character,delta,...(reason?{reason}:{})}),trust=(character,delta)=>({type:'trust',character,delta});

// Stand-in prose so a skeleton plays (and tests run) before any model has written a word.
export function placeholderProse(n){
 const r=(title,opening,says,boldChoice,boldWorks,boldFails,safeChoice,safeResult)=>({title,opening,says,boldChoice,boldWorks,boldFails,safeChoice,safeResult});
 return {hangout:r(`Time with ${n}`,`${n} has a free moment and doesn't seem to mind spending it on you.`,'Busy?','Do something together',`You and ${n} find something to do, and the time goes fast.`,'','Just talk',`You talk about nothing much. ${n} remembers all of it.`),
  flirt:r(`${n} notices you`,`${n} catches your eye across the room and doesn't look away first.`,'Were you going to say hello, or just stare?','Say something bold',`It lands. ${n} laughs, surprised, and stays.`,`It comes out wrong. ${n} laughs anyway, which is somehow better.`,'Just say hello',`${n} says hello back, and asks your name like it matters.`),
  charged:r(`A moment with ${n}`,`${n} is alone for once, and makes room for you without being asked.`,"Everyone wants something from me tonight. What do you want?",'Tease back',`${n} gives as good as they get. The air between you changes.`,`The joke dies. ${n} rescues it, and you both know it.`,'Listen instead',`You let ${n} talk. It turns out nobody has asked in a while.`),
  kiss:r(`Close to ${n}`,`It's late and ${n} is standing closer than the room needs.`,"So. Are you going to do something about this?",'Kiss them',`You kiss ${n}, and ${n} kisses you back like they were waiting.`,`You lose your nerve halfway. ${n} kisses your cheek instead. "Halfway counts."`,'Not yet',`"Okay." ${n} means it, and doesn't move away.`),
  properly:r(`${n}, again`,`${n} hasn't forgotten, and neither have you.`,"Well? Try again?",'Kiss them properly','This time you don\'t hesitate.',`You falter; ${n} closes the distance for you.`,'Not tonight',`${n} nods. "I'm not going anywhere."`),
  night:r(`Late with ${n}`,`The night is winding down and ${n} is in no hurry to leave you.`,"Stay?",'Stay the night','The door closes; the rest is yours.','','Say goodnight at the door',`${n} kisses you goodnight and lets you go.`),
  again:r(`Another night with ${n}`,`${n} saves you the seat that is always yours now.`,"There you are.",'Go home with them','Another night, easier than the first.','','Just talk tonight','You talk until late. It is its own kind of close.'),
  ending:{name:`${n}`,text:`When it's over, ${n} is still next to you, and that was the whole point.`},close:{name:`Almost ${n}`,text:`You and ${n} never quite finished the sentence. Maybe next time.`}};
}

// The structure the pack needs to play a route at all: modules, stats, dating profiles, the run, a last-day scene and a solo ending.
// Idempotent: anything the pack already has is kept, so mergeApproved can apply it every time.
export function routeFrame(pack,{route,days=14,endings={},tastes={}}){
 const p=structuredClone(pack),ids=routeIds(p,route),start=Math.min(0,...(p.startOptions||[]).map(o=>o.tick??0)),total=days*(p.daypart?.interval||4)*3;
 if(!Number.isInteger(days)||days<1||days>60)throw Error('--days must be an integer from 1 to 60');
 p.modules={...p.modules};for(const m of ['social.relationships','social.dating','character.stats','story.endings','story.scenes'])p.modules[m]??='0.1.0';
 p.statDefinitions=[...(p.statDefinitions||[])];for(const [id,name] of STATS)if(!p.statDefinitions.some(s=>s.id===id))p.statDefinitions.push({id,name,min:0,max:20,visibility:'public',learnFromFailure:1,ranks:RANKS});
 p.initialStats=[...(p.initialStats||[])];for(const [id] of STATS)if(!p.initialStats.some(s=>s.character===p.playerId&&s.stat===id))p.initialStats.push({character:p.playerId,stat:id,value:2});
 p.datingProfiles=[...(p.datingProfiles||[])];for(const x of ids)if(!p.datingProfiles.some(d=>d.character===x))p.datingProfiles.push({character:x,initialChemistry:5,initialPhase:'available',agreements:['casual','monogamous'],thresholds:{crush:15,date:35,exclusive:70},preferences:[],signals:[]});
 // Tastes (Stardew's loved gifts, as talk): the model's likes/dislikes fill an actor who has none; learning one in conversation
 // ("What is it you love about…") pays a little chemistry, once.
 p.actors=p.actors.map(a=>{const t=ids.includes(a.id)&&tastesOf(tastes[a.id]);return t?{...a,...(!a.likes?.length&&t.likes.length?{likes:t.likes}:{}),...(!a.dislikes?.length&&t.dislikes.length?{dislikes:t.dislikes}:{})}:a;});
 p.datingProfiles=p.datingProfiles.map(d=>{if(!ids.includes(d.character))return d;const a=p.actors.find(a=>a.id===d.character),sig=[...(d.signals||[])];for(const [kind,list,delta] of [['likes',a.likes,2],['dislikes',a.dislikes,1]])for(const t of [].concat(list||[]).slice(0,4)){const id=`${d.character}-${kind}-${key(t)}`;if(!sig.some(s=>s.id===id)&&sig.length<30)sig.push({id,event:'social.topicLearned',match:{character:d.character,topic:String(t)},delta,label:kind==='likes'?`you asked about ${t}`:`you heard them out about ${t}`});}return {...d,signals:sig};});
 p.scriptedScenes=[...(p.scriptedScenes||[])];if(!p.scriptedScenes.some(s=>s.id==='route-last-day'))p.scriptedScenes.push({id:'route-last-day',title:'The last day',priority:20,opening:'The last day. Whatever you started here, tonight is where it lands.',trigger:{event:'core.timeAdvanced',match:{}},when:{minTick:start+total-12},pages:[{speaker:'',text:'Everyone is still here, for now. You know who you want to find.'}],choices:[{id:'end',label:'See how it lands',result:'You take a breath and go looking.',effects:[flag('last-day')]}]});
 p.endings=[...(p.endings||[])];if(!p.endings.some(e=>e.id==='route-solo'))p.endings.push({id:'route-solo',name:'On your own',priority:-10,requires:{flags:{'last-day':true}},text:'You leave the way you came: alone, but not the same.'});
 for(const x of ids)for(const [id,priority,flags] of [[`${x}-ending`,10,{[`${x}-kissed`]:true,[`${x}-night`]:true}],[`${x}-close`,5,{[`${x}-kissed`]:true}]])if(!p.endings.some(e=>e.id===id)){const k=id.endsWith('-ending')?'ending':'close',t=fillProse(placeholderProse(p.actors.find(a=>a.id===x).name),endings[x])[k];p.endings.push({id,name:t.name,character:x,priority,requires:{flags:{'last-day':true,...flags}},text:t.text});}
 p.run??={days,defaultEnding:'route-solo'};return p;
}

const key=t=>String(t).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)||'x';
// Likes (up to 4) and dislikes (up to 3): short phrases, without "Likes:" labels, quotes or a closing period.
export function tastesOf(v){const f=(l,n)=>[...new Set((Array.isArray(l)?l:[]).filter(x=>typeof x==='string').map(x=>x.trim().replace(/^(likes?|dislikes?|loves?|hates?)\s*:\s*/i,'').replace(/^["'“‘]+|["'”’.]+$/g,'').trim()).filter(x=>x.length>=2&&x.length<=40))].slice(0,n);return {likes:f(v?.likes,4),dislikes:f(v?.dislikes,3)};}

export function routeIds(pack,route){
 const ids=(Array.isArray(route)?route:String(route||'').split(',')).map(s=>s.trim()).filter(Boolean);if(!ids.length)throw Error('--route needs at least one character id');
 for(const x of ids){const a=pack.actors.find(a=>a.id===x);if(!a||x===pack.playerId)throw Error(`--route: ${x} is not a character in this pack`);}return [...new Set(ids)];
}

// One love interest's ladder as hand cards at their home. Tick gates spread the rungs over the run: charged after ~15%, the kiss
// after ~35%, a night after ~50%. Every check has a fail branch that still moves the ladder; intimacy is never behind a check.
export function routeScenes(pack,x,{days=14,prose}={}){
 const a=pack.actors.find(a=>a.id===x),n=a.name||x,at={[x]:a.location},start=Math.min(0,...(pack.startOptions||[]).map(o=>o.tick??0)),total=days*(pack.daypart?.interval||4)*3,g=f=>start+Math.round(total*f);
 const t=fillProse(placeholderProse(n),prose),f=s=>`${x}-${s}`,mod=(id,value,label)=>({when:{flags:{[id]:true}},value,label});
 const card=(rung,when,{bold,check,fail,safe,repeatable,hint})=>{const w=t[rung];return {id:f(rung),title:w.title,offer:'hand',timeCost:1,...(repeatable?{repeatable:true}:{}),...(hint?{offerHint:hint}:{}),opening:w.opening,trigger:{event:'story.handOffered',match:{}},when:{charactersAt:at,...when},pages:[{speaker:x,text:line(w.says,n)}],
  choices:[{id:'bold',label:w.boldChoice,result:w.boldWorks,effects:bold,...(check?{check:{...check,fail:{result:w.boldFails,effects:fail}}}:{})},{id:'safe',label:w.safeChoice,result:w.safeResult,effects:safe}]};};
 const dating=reason=>({type:'datingPhase',character:x,to:'dating',reason});
 return [
  card('hangout',{dayparts:['Morning','Afternoon']},{repeatable:true,bold:[chem(x,2)],safe:[trust(x,2)]}),
  card('flirt',{},{bold:[chem(x,4),flag(f('flirt')),flag(f('spark')),{type:'stat',stat:'charm',delta:1}],check:{stat:'charm',target:3},fail:[chem(x,2,`${n} liked that you tried`),flag(f('flirt'))],safe:[trust(x,3),chem(x,1),flag(f('flirt'))]}),
  card('charged',{flags:{[f('flirt')]:true},minTick:g(0.15)},{hint:`${n} is warming to you. Give it time.`,bold:[chem(x,5),flag(f('charged')),{type:'stat',stat:'wit',delta:1}],check:{stat:'wit',target:4,modifiers:[mod(f('spark'),1,'The first look landed')]},fail:[chem(x,2,'the awkward pause was mutual'),flag(f('charged'))],safe:[trust(x,3),chem(x,2),flag(f('charged'))]}),
  card('kiss',{flags:{[f('charged')]:true},minTick:g(0.35)},{hint:`Something is building with ${n}.`,bold:[chem(x,10),flag(f('kissed')),dating('first kiss'),{type:'stat',stat:'nerve',delta:1}],check:{stat:'nerve',target:5,modifiers:[mod(f('spark'),1,'The first look landed')]},fail:[chem(x,4,'halfway still counts'),flag(f('cheek'))],safe:[trust(x,3),flag(f('waited'))]}),
  card('properly',{flags:{[f('kissed')]:false},completedScenes:[f('kiss')],minTick:g(0.35)+6},{repeatable:true,bold:[chem(x,8),flag(f('kissed')),dating('kissed properly')],check:{stat:'nerve',target:5,modifiers:[mod(f('cheek'),2,'Halfway last time'),mod(f('waited'),2,`You let ${n} set the pace`)]},fail:[chem(x,5,`${n} closed the distance`),flag(f('kissed')),dating(`${n} closed the distance`)],safe:[trust(x,2)]}),
  card('night',{flags:{[f('kissed')]:true,[f('night')]:false},dayparts:['Evening'],minTick:g(0.5)},{repeatable:true,hint:`An evening with ${n}, once you've kissed.`,bold:[chem(x,6),flag(f('night'))],safe:[trust(x,2)]}),
  card('again',{flags:{[f('night')]:true},dayparts:['Evening']},{repeatable:true,bold:[chem(x,3)],safe:[trust(x,2)]}),
 ];
}

// A spoken line without the speaker's name or wrapping quotes, which small models add.
const line=(s,n)=>{const t=s.trim(),i=t.indexOf(':'),b=i>0&&t.slice(0,i).trim().toLowerCase()===n.toLowerCase()?t.slice(i+1).trim():t;return b.replace(/^["'“‘](.*)["'”’]$/s,'$1').trim()||s;};

// Model prose over the placeholders, slot by slot; a missing or empty slot keeps its placeholder.
export function fillProse(base,prose){
 const out=structuredClone(base);if(!prose||typeof prose!=='object')return out;
 for(const k of Object.keys(out))for(const s of Object.keys(out[k])){const v=prose[k]?.[s];if(typeof v==='string'&&v.trim())out[k][s]=v.trim().slice(0,s==='text'||s==='opening'?800:400);}
 return out;
}
// Small models copy a rung's lines into the next one; a repeated line (short choice labels may repeat) counts as missing, so it is repaired or keeps its placeholder.
export function tidyProse(prose){
 const out=structuredClone(prose||{}),seen=new Set();
 for(const k of [...RUNGS,'ending','close'])for(const s of Object.keys(out[k]||{})){const v=out[k][s],key=typeof v==='string'&&v.trim().toLowerCase();if(!key||key.length<25)continue;if(seen.has(key))delete out[k][s];else seen.add(key);}
 return out;
}
export const missingProse=prose=>[...RUNGS.flatMap(r=>PROSE.filter(s=>!(['hangout','night','again'].includes(r)&&s==='boldFails')).map(s=>[r,s])),['ending','name'],['ending','text'],['close','name'],['close','text']].filter(([k,s])=>!(typeof prose?.[k]?.[s]==='string'&&prose[k][s].trim())).map(x=>x.join('.'));

// The route as a proposal: scenes are ordinary pending entries, the frame rides along as proposal.route (mergeApproved applies it).
export function routeCandidate(pack,{route,days=14,prose={}}){
 const tastes=Object.fromEntries(Object.entries(prose).map(([x,v])=>[x,tastesOf(v)]).filter(([,t])=>t.likes.length||t.dislikes.length));
 const ids=routeIds(pack,route),framed=routeFrame(pack,{route:ids,days,tastes}),taken=new Set((pack.scriptedScenes||[]).map(s=>s.id));
 const scenes=ids.flatMap(x=>routeScenes(framed,x,{days,prose:prose[x]}));for(const s of scenes)if(taken.has(s.id))throw Error(`Scene ${s.id} already exists in this pack`);
 return {route:{route:ids,days,...(Object.keys(tastes).length?{tastes}:{}),endings:Object.fromEntries(ids.map(x=>{const t=fillProse(placeholderProse(framed.actors.find(a=>a.id===x).name),prose[x]);return [x,{ending:t.ending,close:t.close}];}))},scenes};
}

// The one model request per love interest: prose only, keyed RUNGS × PROSE plus the two endings. Small enough for a 9b model.
const BEATS={hangout:'casual daytime time together, friends so far, no touching; bold = do something together, safe = just talk',flirt:'you barely know each other; the first spark, words and looks only; bold = a bold line (works, or fails awkwardly but charmingly), safe = just say hello',charged:'a private moment, tension but no kiss yet; bold = tease back (works, or the joke dies), safe = listen',kiss:'late, standing close; bold = kiss them (works, or you lose your nerve and get a kiss on the cheek), safe = not yet',properly:'a second chance at the kiss; bold = kiss them properly (works, or you falter and they close the distance), safe = not tonight',night:'an evening after kissing; bold = stay the night (fade out, nothing explicit), safe = goodnight at the door',again:'a comfortable evening once you are together; bold = go home with them, safe = just talk',ending:'ending: together at the end of the run',close:'ending: you kissed but it never went further'};
export function proseMessages(pack,x,{brief='',error=''}={}){
 const a=pack.actors.find(a=>a.id===x),n=a.name||x,c=(v,k)=>typeof v==='string'&&v.trim()?v.trim().slice(0,k):'',g=pack.gameProject||{};
 const who=[`${n}${a.pronouns?` (${a.pronouns})`:''}: ${c(a.description,600)}`,c(a.personality,300)&&`Personality: ${c(a.personality,300)}`,c(g.setting,300)&&`Setting: ${c(g.setting,300)}`,c(g.writingStyle,200)&&`Style: ${c(g.writingStyle,200)}`,c(brief,1500)&&`Notes:\n${c(brief,1500)}`].filter(Boolean).join('\n');
 return [{role:'system',content:`You write the lines for one romance route in a Story Framework game. Return one JSON object only. Keys: ${[...RUNGS,'ending','close','likes','dislikes'].join(', ')}. Each rung is {${PROSE.join(',')}}; ending and close are {name,text}. title: 3-6 words. opening, boldWorks, boldFails, safeResult: 1-2 sentences, second person ("you"), present tense. says: one line ${n} speaks, no quotes. boldChoice, safeChoice: what the player does, 2-6 words. name: 1-4 words. text: 2-3 sentences. likes: 2-4 things ${n} loves, dislikes: 1-3 things ${n} can't stand; 1-3 words each, from who they are. Each rung is a separate scene, days apart, in this order; never jump ahead: nothing more than a touch on the arm before kiss. Stay in character; everyone is an adult; nothing explicit. Rungs:\n${Object.entries(BEATS).map(([k,v])=>`- ${k}: ${v}`).join('\n')}${error?`\nThe previous answer failed: ${error}\nReturn a complete corrected answer.`:''}`},{role:'user',content:who}];
}
export function proseSchema(){
 const s={type:'string'},obj=keys=>({type:'object',properties:Object.fromEntries(keys.map(k=>[k,s])),required:keys});
 return {type:'object',properties:{...Object.fromEntries(RUNGS.map(r=>[r,obj(PROSE)])),ending:obj(['name','text']),close:obj(['name','text']),likes:{type:'array',items:s,minItems:2,maxItems:4},dislikes:{type:'array',items:s,minItems:1,maxItems:3}},required:[...RUNGS,'ending','close','likes','dislikes']};
}
export function parseProse(raw){
 const i=raw.indexOf('{'),j=raw.lastIndexOf('}');if(i<0||j<i)throw Error('no JSON object in the reply');
 const o=JSON.parse(raw.slice(i,j+1));if(!o||typeof o!=='object'||Array.isArray(o))throw Error('the reply is not a JSON object');return o;
}
// One love interest's prose: ask(messages,schema) → raw reply; one repair when the reply fails or leaves more than 12 slots bare.
// The best try wins; its missing slots keep placeholders and come back as `missing`. onRepair(error) is for logging.
export async function draftRouteProse(ask,pack,x,{brief='',onRepair=()=>{}}={}){
 const tries=[];let error='',last;
 for(let i=0;i<2;i++){const raw=await ask(proseMessages(pack,x,{brief,error}),proseSchema());try{const p=tidyProse(parseProse(raw)),miss=missingProse(p);tries.push({p,miss});if(miss.length<=12)break;error=`${miss.length} slots are missing, empty or copied from another rung: ${miss.slice(0,12).join(', ')}`;}catch(e){error=e.message;last={e,raw};}if(!i)onRepair(error);}
 if(!tries.length)throw Object.assign(last.e,{raw:last.raw});
 const best=tries.sort((a,b)=>a.miss.length-b.miss.length)[0];return {prose:best.p,missing:best.miss};
}
