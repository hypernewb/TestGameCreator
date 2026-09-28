// Intimacy drafts (docs/GENERATOR-PLAN.md step 7). Code builds each love interest's intimacy profile and a 5-beat first encounter
// (the scene social.beginIntimacy starts) plus a short repeatable one, with a stop choice at every beat that withdraws consent.
// The model fills the prose slots only. The author sets the boundaries (content level, private places) and every age: nothing here
// writes an age, so validation refuses the frame until the author marks the player and the love interest 18+. Entries are adult
// (adultEntry), which Studio's "Approve all" skips: each one needs its own approval.
export const BEATS=['start','closer','check-in','deeper','last'];
export const SLOTS=['opening','says','go','goResult','slow','slowResult'];
export const CATEGORY='together',LEVELS=['fade','suggestive','explicit'],STOP='Say you want to stop';
const flag=(id,value=true)=>({type:'flag',id,value}),sat=(character,delta)=>({type:'satisfaction',character,delta}),trust=(character,delta)=>({type:'trust',character,delta});

// Any scene an intimacy module event starts, or that grants, withdraws or completes an encounter.
export const adultEntry=v=>/^social\.(intimacy|consent)/.test(v?.trigger?.event||'')||[v,...(v?.beats||[])].some(b=>(b?.choices||[]).some(c=>[...(c.effects||[]),...(c.check?.fail?.effects||[])].some(e=>/intimacy/i.test(e?.type||''))));
// A stop choice: unconditional, no check, withdraws consent.
export const stopChoice=c=>!c.when&&!c.check&&(c.effects||[]).some(e=>e.type==='intimacyConsent'&&e.status==='withdrawn');
// Segments of an adult scene with no stop choice (the scene's own choices are segment '').
export const missingStops=s=>adultEntry(s)&&s.trigger?.event==='social.intimacyStarted'?[s,...(s.beats||[])].filter(b=>b.choices?.length&&!b.choices.some(stopChoice)).map(b=>b===s?'':b.id):[];

export function placeholderIntimacy(n){
 const b=(opening,says,go,goResult,slow,slowResult)=>({opening,says,go,goResult,slow,slowResult});
 return {title:`A night with ${n}`,againTitle:`${n}, again`,stop:`${n} stops at once. "Then we stop." They make tea instead, and it is not awkward; ${n} makes sure of that.`,
  start:b(`The door closes behind you both. ${n} doesn't let go of your hand.`,'So. Here we are.','Kiss them',`${n} kisses you back, slow and sure.`,'Take it slow',`${n} smiles and matches your pace.`),
  closer:b(`${n} pulls you closer. The rest of the night goes quiet.`,'Come here.','Close the distance',`There is no space left between you.`,'Stay a while like this',`You stay just like this. ${n} doesn't mind at all.`),
  'check-in':b(`${n} pulls back an inch and looks at you properly.`,'Still good?','"Very." And mean it',`${n} grins like they just won something.`,'Ask what they want',`${n} tells you, and you listen.`),
  deeper:b(`The lamp is still on. Neither of you reaches for it.`,'Don\'t stop.','Follow their lead',`You follow, and ${n} makes it worth it.`,'Slow it right down',`Slower is better. ${n} says so, twice.`),
  last:b(`Somewhere past midnight, the world is very small.`,'Stay.','Stay close to the end',`The rest is yours. Later, ${n} falls asleep on your shoulder.`,'Ease it to a close',`It ends softly, and ${n} holds on for a while after.`),
  again:b(`${n} knows the way now. The door closes easier this time.`,'Missed you.','Pick up where you left off',`Easier than the first night, and no less good.`,'Just hold each other tonight',`You talk until you fall asleep.`)};
}
export const fillIntimacy=(base,prose)=>{const out=structuredClone(base);if(!prose||typeof prose!=='object')return out;for(const k of ['title','againTitle','stop'])if(typeof prose[k]==='string'&&prose[k].trim())out[k]=prose[k].trim().slice(0,400);for(const k of [...BEATS,'again'])for(const s of SLOTS){const v=prose[k]?.[s];if(typeof v==='string'&&v.trim())out[k][s]=v.trim().slice(0,s==='opening'?800:400);}return out;};
export const missingIntimacy=prose=>[...['title','againTitle','stop'].filter(k=>!(typeof prose?.[k]==='string'&&prose[k].trim())),...[...BEATS,'again'].flatMap(k=>SLOTS.filter(s=>!(typeof prose?.[k]?.[s]==='string'&&prose[k][s].trim())).map(s=>`${k}.${s}`))];

export function intimacyIds(pack,characters){
 const ids=[...new Set((Array.isArray(characters)?characters:String(characters||'').split(',')).map(s=>s.trim()).filter(Boolean))];if(!ids.length)throw Error('--characters needs at least one character id');
 for(const x of ids){if(x===pack.playerId||!pack.actors.some(a=>a.id===x))throw Error(`--characters: ${x} is not a character in this pack`);if((pack.intimacyProfiles||[]).some(p=>p.character===x&&!p.allowedCategories?.includes(CATEGORY)))throw Error(`${x} already has an intimacy profile; edit it in Studio instead`);}
 return ids;
}
// Author boundaries; nothing here is ever chosen by the model. contentLevel has no default at the CLI (the author picks it).
export function boundaries(pack,{contentLevel='fade',privateLocations}={}){
 if(!LEVELS.includes(contentLevel))throw Error(`--content must be one of ${LEVELS.join(', ')}`);
 const places=privateLocations==null?null:(Array.isArray(privateLocations)?privateLocations:String(privateLocations).split(',')).map(s=>s.trim()).filter(Boolean);
 for(const l of places||[])if(!pack.locations.some(x=>x.id===l))throw Error(`--private: ${l} is not a location in this pack`);if(places&&!places.length)throw Error('--private needs at least one location id');
 return {contentLevel,...(places?{privateLocations:places}:{})};
}

// Modules, settings, the category and one profile per love interest. Idempotent: anything the pack already has is kept (an existing
// intimacySettings keeps the author's content level). Private places default to each love interest's home.
export function intimacyFrame(pack,{characters,contentLevel='fade',privateLocations}){
 const p=structuredClone(pack),ids=intimacyIds(p,characters),home=[...new Set(ids.map(x=>p.actors.find(a=>a.id===x).location).filter(Boolean))];
 p.modules={...p.modules};for(const m of ['social.relationships','social.dating','social.intimacy'])p.modules[m]??='0.1.0';
 p.datingProfiles=[...(p.datingProfiles||[])];for(const x of ids)if(!p.datingProfiles.some(d=>d.character===x))p.datingProfiles.push({character:x,initialChemistry:5,initialPhase:'available',agreements:['casual','monogamous'],thresholds:{crush:15,date:35,exclusive:70},preferences:[],signals:[]});
 p.intimacySettings??={difficulty:'normal',contentLevel,privateLocations:privateLocations||home,aftercareWindow:2,aftercareOptions:[{id:'stay',name:'Ask them to stay'},{id:'talk',name:'Lie there and talk'},{id:'space',name:'Give them some space'}]};
 p.intimacyCategories=[...(p.intimacyCategories||[])];if(!p.intimacyCategories.some(c=>c.id===CATEGORY))p.intimacyCategories.push({id:CATEGORY,name:'Spend the night',privacy:'private',casual:false,resolution:'scene',style:CATEGORY,discretion:'discreet'});
 p.intimacyProfiles=[...(p.intimacyProfiles||[])];for(const x of ids)if(!p.intimacyProfiles.some(q=>q.character===x))p.intimacyProfiles.push({character:x,openness:50,casual:false,consentPolicy:'threshold',consentDuration:2,allowedCategories:[CATEGORY],interests:[],cooldown:12,requirements:{attraction:25,phases:['dating','exclusive']}});
 return p;
}

// The first encounter (opening + 4 beats, each ending in go / slow / stop) and a short repeatable one after it. Completion sets
// `${x}-night`, the flag a route's endings read. The stop label and effects are code; only its result line is prose.
export function intimacyScenes(pack,x,{prose}={}){
 const n=pack.actors.find(a=>a.id===x)?.name||x,t=fillIntimacy(placeholderIntimacy(n),prose),trigger={event:'social.intimacyStarted',match:{character:x}};
 const stop={id:'stop',label:STOP,result:t.stop,effects:[{type:'intimacyConsent',character:x,category:CATEGORY,status:'withdrawn'},trust(x,2)]},done=o=>({type:'completeIntimacy',character:x,category:CATEGORY,outcome:o});
 const fx={start:[[sat(x,2)],[trust(x,1)]],closer:[[sat(x,2)],[trust(x,1),sat(x,1)]],'check-in':[[sat(x,2)],[sat(x,3)]],deeper:[[sat(x,2)],[sat(x,1)]],last:[[done('positive'),sat(x,3),flag(`${x}-night`)],[done('neutral'),flag(`${x}-night`)]],again:[[done('positive'),sat(x,2)],[done('neutral'),trust(x,1)]]};
 const seg=(k,next)=>{const w=t[k],[go,slow]=fx[k];return {opening:w.opening,pages:[{speaker:x,text:w.says}],choices:[{id:'go',label:w.go,result:w.goResult,...(next?{next}:{}),effects:go},{id:'slow',label:w.slow,result:w.slowResult,...(next?{next}:{}),effects:slow},stop]};};
 const first={id:`${x}-intimate`,title:t.title,trigger,...seg('start','closer'),beats:BEATS.slice(1).map((k,i)=>({id:k,...seg(k,BEATS[i+2])}))};
 return [first,{id:`${x}-intimate-again`,title:t.againTitle,repeatable:true,trigger,when:{completedScenes:[first.id]},...seg('again')}];
}

// Proposal pieces: scenes are adult pending entries; the frame rides along as proposal.intimacy and mergeApproved applies it only for
// love interests whose first encounter is approved.
export function intimacyCandidate(pack,{characters,prose={},...bounds}){
 const ids=intimacyIds(pack,characters),b=boundaries(pack,bounds),framed=intimacyFrame(pack,{characters:ids,...b}),taken=new Set((pack.scriptedScenes||[]).map(s=>s.id));
 const scenes=ids.flatMap(x=>intimacyScenes(framed,x,{prose:prose[x]}));for(const s of scenes)if(taken.has(s.id))throw Error(`Scene ${s.id} already exists in this pack`);
 const warnings=[pack.playerId,...ids].filter(id=>!(pack.actors.find(a=>a.id===id)?.age>=18)).map(id=>`${id}: set age 18+ on ${id} in the pack before applying (the generator never sets ages)`);
 return {intimacy:{characters:ids,...b},scenes,warnings};
}
// Frame for the approved part: only characters whose first encounter is approved.
export const intimacyFor=(pack,intimacy,approvedIds)=>{const ids=intimacy.characters.filter(x=>approvedIds.has(`${x}-intimate`));return ids.length?intimacyFrame(pack,{...intimacy,characters:ids}):pack;};

const TONE={fade:'Fade to black: kisses and closeness only, cut away before anything explicit; the last beat is the morning-after feeling.',suggestive:'Sensual and suggestive, never graphic; imply more than you show.',explicit:'Frank and sensual is allowed; keep it about the two of them, their consent and their pleasure.'};
const GUIDE={start:'arriving somewhere private; go = kiss them, slow = take it slow',closer:'getting closer; go = close the distance, slow = stay like this a while','check-in':'they stop to ask if you are still good (says is that question); go = say yes and mean it, slow = ask what they want',deeper:'further in; go = follow their lead, slow = slow it right down',last:'the end of the night; go = stay close to the end, slow = ease it to a close',again:'a later night, familiar and easy; go = pick up where you left off, slow = just hold each other'};
export function intimacyMessages(pack,x,{brief='',error=''}={}){
 const a=pack.actors.find(a=>a.id===x),n=a.name||x,c=(v,k)=>typeof v==='string'&&v.trim()?v.trim().slice(0,k):'',level=pack.intimacySettings?.contentLevel||'fade';
 const who=[`${n}${a.pronouns?` (${a.pronouns})`:''}: ${c(a.description,600)}`,c(a.personality,300)&&`Personality: ${c(a.personality,300)}`,c(brief,1500)&&`Notes:\n${c(brief,1500)}`].filter(Boolean).join('\n');
 return [{role:'system',content:`You write the lines for a consensual first night between two adults in a Story Framework game. Return one JSON object only. Keys: title, againTitle, stop, ${[...BEATS,'again'].join(', ')}. title, againTitle: 3-6 words. stop: 1-2 sentences, ${n} stops at once and kindly when you say you want to stop. Each beat is {${SLOTS.join(',')}}: opening, goResult, slowResult 1-2 sentences, second person ("you"), present tense; says: one line ${n} speaks, no quotes; go, slow: what the player does, 2-6 words. ${TONE[level]} Everyone is an adult and wants this. Beats, in order:\n${Object.entries(GUIDE).map(([k,v])=>`- ${k}: ${v}`).join('\n')}${error?`\nThe previous reply failed: ${error}\nReturn the complete object again.`:''}`},{role:'user',content:who}];
}
export function intimacySchema(){const s={type:'string'},obj=keys=>({type:'object',properties:Object.fromEntries(keys.map(k=>[k,s])),required:keys});return {type:'object',properties:{title:s,againTitle:s,stop:s,...Object.fromEntries([...BEATS,'again'].map(k=>[k,obj(SLOTS)]))},required:['title','againTitle','stop',...BEATS,'again']};}
// ask(messages,schema) → raw reply; one repair when the reply fails or leaves more than 8 slots bare. Missing slots keep placeholders.
export async function draftIntimacyProse(ask,pack,x,{brief='',onRepair=()=>{}}={}){
 const tries=[];let error='',last;
 for(let i=0;i<2;i++){const raw=await ask(intimacyMessages(pack,x,{brief,error}),intimacySchema());try{const j=raw.indexOf('{'),k=raw.lastIndexOf('}');if(j<0||k<j)throw Error('no JSON object in the reply');const p=JSON.parse(raw.slice(j,k+1)),miss=missingIntimacy(p);tries.push({p,miss});if(miss.length<=8)break;error=`${miss.length} slots are missing or empty: ${miss.slice(0,12).join(', ')}`;}catch(e){error=e.message;last={e,raw};}if(!i)onRepair(error);}
 if(!tries.length)throw Object.assign(last.e,{raw:last.raw});
 const best=tries.sort((a,b)=>a.miss.length-b.miss.length)[0];return {prose:best.p,missing:best.miss};
}
