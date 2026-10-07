import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {guardSceneLines,dropRepeats,dropAdvances,dropStock} from '../packages/ai/untrusted-output.mjs';
import {budgetSceneContext} from '../packages/ai/context-budget.mjs';
import {scenePromptMessages} from '../vendor/venus/scenePrompt.mjs';
import {actorToCard,cardToActor} from '../packages/cards/character-card.mjs';
import {createWorld} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
import {Store} from '../packages/persistence/store.mjs';
import {GameService} from '../packages/ai/service.mjs';
import {CompatibleProvider} from '../packages/ai/providers.mjs';
import {relationshipStageOf} from '../packages/ai/character-context.mjs';
import {beatDirection,topicSeeds,groundFor} from '../packages/ai/beats.mjs';
const pack=()=>JSON.parse(readFileSync(new URL('../packs/neutral.json',import.meta.url)));
const cast={playerId:'you',actors:[{id:'you',name:'You'},{id:'rowan',name:'Rowan Hale'},{id:'mina',name:'Mina'}]};
const guard=(text,slate=['rowan'],speaker='')=>guardSceneLines([{speaker,text}],slate,cast);

test('role-play narration with *actions* and quoted speech is split into narration and the NPC line',()=>{
 assert.deepEqual(guard('*Rowan nods, grinning.* "Yes! I got in. Can you believe it?" *He sips his coffee.*'),[{speaker:'',text:'Rowan nods, grinning.'},{speaker:'rowan',text:'Yes! I got in. Can you believe it?'},{speaker:'',text:'He sips his coffee.'}]);
 assert.deepEqual(guard('*I... I am not sure yet. There is a lot to sort out.'),[{speaker:'rowan',text:'I... I am not sure yet. There is a lot to sort out.'}]);
 assert.deepEqual(guard('*His gaze meets yours.*'),[{speaker:'',text:'His gaze meets yours.'}]);
 assert.deepEqual(guard('Mina tilts her head. "You\'re late," she says. "Again."',['rowan','mina']),[{speaker:'',text:'Mina tilts her head.'},{speaker:'mina',text:'You\'re late. Again.'}]);
 assert.deepEqual(guard('*smiles* Hey, you made it.',['rowan','mina'],'mina'),[{speaker:'',text:'Mina smiles.'},{speaker:'mina',text:'Hey, you made it.'}]);
 assert.deepEqual(guard('*She steps closer.* "There you are. Took you long enough,"',['mina']),[{speaker:'',text:'She steps closer.'},{speaker:'mina',text:'There you are. Took you long enough.'}]);
});

test('unmarked stage directions filed under a speaker become narration',()=>{
 assert.deepEqual(guard('She tugs at her collar. Her gaze flicks away.',['mina'],'mina'),[{speaker:'',text:'She tugs at her collar. Her gaze flicks away.'}]);
 assert.deepEqual(guard('He swallows hard. I got in, okay?',['rowan'],'rowan'),[{speaker:'',text:'He swallows hard.'},{speaker:'rowan',text:'I got in, okay?'}]);
 assert.deepEqual(guard('It was fine. Nothing spectacular.',['mina'],'mina'),[{speaker:'mina',text:'It was fine. Nothing spectacular.'}]);
 // A lead-in adverb ("Then she turns…", "After a moment, Mina nods.") does not make a stage direction speech.
 assert.deepEqual(guard('She lets out a nervous laugh. Then she turns back to the crooked frame. Ugh, this place is a mess.',['mina'],'mina'),[{speaker:'',text:'She lets out a nervous laugh. Then she turns back to the crooked frame.'},{speaker:'mina',text:'Ugh, this place is a mess.'}]);
 assert.deepEqual(guard('After a moment, Mina nods. Fine.',['mina'],'mina'),[{speaker:'',text:'After a moment, Mina nods.'},{speaker:'mina',text:'Fine.'}]);
 assert.deepEqual(guard('Then she leaves me for Paris.',['mina'],'mina'),[{speaker:'mina',text:'Then she leaves me for Paris.'}]);
});

test('role-play splitting leaves signs, plain narration and unattributable speech alone',()=>{
 assert.deepEqual(guard('The sign on the door reads "Closed". Rowan shrugs.',['rowan','mina']),[{speaker:'',text:'The sign on the door reads “Closed”. Rowan shrugs.'}]);
 assert.deepEqual(guard('You arrive at the rooftop.'),[{speaker:'',text:'You arrive at the rooftop.'}]);
 assert.deepEqual(guard('"Hey," he says.',['rowan','mina']),[{speaker:'',text:'“Hey,” he says.'}]);
 // An off-slate NPC named in the action is not silently turned into the only present speaker.
 assert.deepEqual(guard('*Mina waves from the street.* "Come down here!"'),[{speaker:'',text:'Mina waves from the street. “Come down here!”'}]);
});

test('the scene prompt carries a character rule, voiceBlock and example lines, and a speaker-ID example',()=>{
 const p=pack(),ada=p.actors.find(a=>a.id==='ada');Object.assign(ada,{fingerprint:'Sharp and concise.',examples:['Hand me the spanner. No, the other one.']});
 const [system,user]=scenePromptMessages({stagedCast:['ada'],sceneHistory:[],playerAction:'Hi',location:p.locations[0]},p);
 assert.match(system.content,/CHARACTERS: Each NPC speaks from their own cast profile/);
 assert.match(system.content,/never invent news, letters, secrets/i);
 assert.match(system.content,/\{"speaker":"ada","text":"<Ada's exact words>"\}/);
 assert.match(user.content,/Sharp and concise/);assert.match(user.content,/No, the other one/);
 const {context}=budgetSceneContext({stagedCast:['ada'],sceneHistory:[],memories:[],playerAction:'Hi'},p,{turns:{}},'now',{window:32768,reply:500,render:c=>scenePromptMessages(c,p)});
 assert.match(context.castProfiles[0].voiceBlock.fingerprint,/Sharp and concise/);assert.deepEqual(context.castProfiles[0].examples,ada.examples);
 const solo=scenePromptMessages({stagedCast:[],sceneHistory:[],playerAction:'Look around',location:p.locations[0]},p)[0].content;
 assert.doesNotMatch(solo,/CHARACTERS:/);assert.doesNotMatch(solo,/for example/);
});

test('the current turn is not recalled as a memory beside its own player action',()=>{
 const p=pack(),memories=[{source:'t9.0',kind:'statement',text:'the player told Ada: I will miss the harbor'},{source:'t3.1',kind:'disclosure',text:'the player told Ada: the player grew up by the harbor'}];
 const {context}=budgetSceneContext({stagedCast:['ada'],sceneHistory:[],memories,playerAction:'I will miss the harbor'},p,{turns:{}},'t9',{window:32768,reply:500,render:c=>scenePromptMessages(c,p)});
 assert.deepEqual(context.memories.map(m=>m.source),['t3.1']);
 assert.match(scenePromptMessages(context,p)[1].content,/RELEVANT MEMORY\n- the player told Ada: the player grew up/);
});

test('character example lines survive a card export and import',()=>{
 const p=pack();p.actors.find(a=>a.id==='ada').examples=['Hand me the spanner.'];
 assert.deepEqual(cardToActor(actorToCard(p,'ada'),{...p,actors:p.actors.filter(a=>a.id!=='ada')}).actor.examples,['Hand me the spanner.']);
});

test('mentioning an absent character mid-conversation is news for the present cast; calling out to them is not',async()=>{
 const p=pack();delete p.modules['world.schedule'];const staged=[];
 const provider={name:'probe',async interpretScene(){return {location:'hub',characters:[],activity:'talk'};},async generateScene(context){staged.push(context.stagedCast);return {lines:[{speaker:context.stagedCast[0]||'',text:'Mm.'}]};},async generateLedger(){return [];}};
 const store=new Store();store.insert(createWorld(p,registry,'news'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{let r=await service.act('news',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Sit with Ada.',location:'hub',characters:['ada'],activity:'talk'}}});
  r=await service.act('news',{id:'late',expectedRevision:r.state.revision,input:'Sorry I am late, I was with Brin.'});
  assert.equal(r.state.scene.id,'open');assert.deepEqual(staged.at(-1),['ada']);
  r=await service.act('news',{id:'call',expectedRevision:r.state.revision,input:'Hey Brin, over here!'});
  assert.notEqual(r.state.turns.call?.command.args.activity,'continue','a called-out absentee is not folded into the conversation');
 }finally{store.close();}
});

test('an NPC receives authored voice samples in the final prompt and exact sample recitation is still dropped',async()=>{
 const p=pack();delete p.modules['world.schedule'];p.actors.find(a=>a.id==='ada').examples=['I need it finished, not perfect.'];const contexts=[];
 const provider={name:'probe',async interpretScene(){return {location:'hub',characters:['ada'],activity:'talk'};},async generateScene(context){contexts.push(context);return {lines:[{speaker:'ada',text:'I need it finished, not perfect. Coffee first.'}]};},async generateLedger(){return [];}};
 const store=new Store();store.insert(createWorld(p,registry,'voice'));const service=new GameService(store,{[p.id]:p},registry,provider);
 try{const r=await service.act('voice',{id:'open',expectedRevision:0,command:{type:'core.scene',args:{text:'Sit with Ada.',location:'hub',characters:['ada'],activity:'talk'}}});
  assert.match(scenePromptMessages(contexts[0],p)[1].content,/Sounds like: I need it finished, not perfect/);assert.doesNotMatch(contexts[0].direction,/Sound like/);
  assert.deepEqual(r.state.turns.open.sceneLines.filter(l=>l.speaker).map(l=>l.text),['Coffee first.']);
 }finally{store.close();}
});

test('an NPC does not repeat a sentence they already said this scene',()=>{
 const earlier=[{speaker:'mina',text:'I don’t need your help. The frames are fine.'},{speaker:'',text:'Mina sighs.'}];
 assert.deepEqual(dropRepeats([{speaker:'',text:'Mina sighs.'},{speaker:'mina',text:'I don’t need your help, okay? I started drawing on bus tickets.'}],earlier),[{speaker:'',text:'Mina sighs.'},{speaker:'mina',text:'I started drawing on bus tickets.'}]);
 // Within one reply too, and short beats may recur.
 assert.deepEqual(dropRepeats([{speaker:'rowan',text:'Yeah. I leave on Friday morning.'},{speaker:'rowan',text:'Yeah. I leave on Friday morning, okay.'}]),[{speaker:'rowan',text:'Yeah. I leave on Friday morning.'},{speaker:'rowan',text:'Yeah.'}]);
 // A reply that is nothing but repeats is kept rather than silenced.
 const only=[{speaker:'mina',text:'I don’t need your help.'}];assert.deepEqual(dropRepeats(only,earlier),only);
 // JSON a model closed and reopened inside a string never reaches the screen.
 assert.deepEqual(guardSceneLines([{speaker:'rowan',text:'Dinner is on me tonight."} {"'}],['rowan'],{actors:[{id:'rowan',name:'Rowan'}]}).map(l=>l.text),['Dinner is on me tonight.']);
 // Cutting repeats never leaves a bare connective behind.
 assert.deepEqual(dropRepeats([{speaker:'rowan',text:"Two years. I know this sucks, especially right now. But... maybe it's what we both need?"}],[{speaker:'rowan',text:"I know this sucks, especially right now. But... maybe it's what we both need?"}]),[{speaker:'rowan',text:'Two years.'}]);
});

test('ordinary direction answers meaning with canonical grounding and memory while profiles carry authored voice',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),mina=p.actors.find(a=>a.id==='mina');
 const context=(input,history=[],phase='continuation',cast=['mina'])=>({stagedCast:cast,scenePhase:phase,playerAction:input,sceneHistory:history}),at=(...args)=>beatDirection(context(...args),p,'s1');
 const opening=context('Go see Rowan',[],'opening',['rowan']),prompt=scenePromptMessages({...opening,direction:at('Go see Rowan',[],'opening',['rowan'])},p).map(m=>m.content).join('\n');
 assert.match(prompt,/Plain speech, quick jokes, then sudden honesty/);assert.match(prompt,/Tell the player face to face about the two-year fellowship abroad/);assert.doesNotMatch(at('Go see Rowan',[],'opening',['rowan']),/disagree|dodge|four or five entries/);
 const asked=at('What made you start drawing, anyway?');assert.match(asked,/answer the actual question/);assert.match(asked,/Started drawing on the backs of bus transfers during a two-hour commute/);assert.doesNotMatch(asked,/dodge/);
 assert.match(at('Honestly that sucks. I will miss you.'),/respond to how the player feels/);assert.match(at('Tell me something dumb you will miss.'),/answer the actual question/);assert.doesNotMatch(at('Nice frames.'),/four or five entries|Sound like|never reuse a gesture|ask the player something back/);
 const voicePrompt=scenePromptMessages(context('Nice frames.'),p).map(m=>m.content).join('\n');assert.ok(voicePrompt.includes(mina.voice||mina.fingerprint));for(const e of mina.examples)assert.ok(voicePrompt.includes(e));assert.match(voicePrompt,/Stay with the current subject/);assert.match(voicePrompt,/question is optional/);
 for(const q of ['Ask Mina what my favorite color is','Ask Mina where I grew up','Do you remember the storm?']){const d=at(q);assert.match(d,/answer from what the player has told you; if they never said, admit not knowing/,q);assert.doesNotMatch(d,/Sound like/);}
 const mem=[{text:"Mara told Mina: Mara's favorite color is teal, and Mara grew up by the harbor",kind:'disclosure'},{text:"Mara told Mina about the storm that sank Mara's father's boat",kind:'statement'},{text:'the player told Mina: the player is nervous about the gallery opening',kind:'disclosure'}],withMem=q=>beatDirection({...context(q),memories:mem},p,'s1');
 assert.match(withMem('Ask Mina where I grew up'),/you grew up by the harbor/);
 const imp=[{text:'Mara told Mina: Mara grew up by the harbor',kind:'disclosure'},{text:'Mina impression: Mara wonders where Mina grew up'}];assert.match(beatDirection({...context('Ask Mina where I grew up'),memories:imp},p,'s1'),/you grew up by the harbor/);
 assert.match(withMem("Ask Mina what happened to my father's boat"),/you told me about the storm that sank your father's boat/);assert.match(withMem('Ask Mina what I was nervous about'),/you are nervous about the gallery opening/);assert.match(withMem('Ask Mina what my middle name is'),/if they never said, admit not knowing/);assert.doesNotMatch(withMem('Nice frames.'),/remind the player|harbor/);
 const hung={...context('Back again.'),hangingAsk:{by:'Mina',text:'What are you doing after shift?'},openThreads:[{text:'Mina asked: What are you doing after shift?'}]};assert.doesNotMatch(beatDirection(hung,p,'s1'),/call back their own unanswered question/);assert.match(scenePromptMessages(hung,p)[1].content,/What are you doing after shift/);
 assert.equal(at('Nice frames.'),at('Nice frames.',Array(4).fill({input:'',text:''})));assert.match(at('Rowan, did you get in?',[],'continuation',['mina','rowan']),/^Rowan:/);
 assert.ok(topicSeeds(mina).some(t=>/felt-tip pens/.test(t)));assert.ok(!topicSeeds(mina,'Mina loves her cheap felt-tip pens').some(t=>/felt-tip/.test(t)));assert.equal(at('Bye',[],'closing'),'');assert.equal(at('Look around',[],'solo',[]),'');
 const user=scenePromptMessages({...context('Hi'),location:p.locations[0],direction:at('Hi')},p)[1].content;assert.match(user,/DIRECTION: Mina:/);assert.match(user,/PLAYER ACTION\nHi/);
});

test('an NPC does not hand the player their own words back',()=>{
 assert.deepEqual(dropRepeats([{speaker:'rowan',text:'Hey. You said you had news?'},{speaker:'rowan',text:'Tell me something dumb you will miss about this city. The bodega cat, obviously.'}],[],'Hey. You said you had news? Tell me something dumb you will miss about this city.'),[{speaker:'rowan',text:'Hey.'},{speaker:'rowan',text:'The bodega cat, obviously.'}]);
 // The question parroted back, or the player's line claimed in first person, is an echo with the pronouns mirrored.
 assert.deepEqual(dropRepeats([{speaker:'rowan',text:'For how long? A year, maybe two.'}],[],'Wait, you are leaving? For how long?'),[{speaker:'rowan',text:'A year, maybe two.'}]);
 assert.deepEqual(dropRepeats([{speaker:'brin',text:"What happened to your father's boat? It sank off the point."}],[],"Ask Brin what happened to my father's boat"),[{speaker:'brin',text:'It sank off the point.'}]);
 assert.deepEqual(dropRepeats([{speaker:'mina',text:"I'm sorry for keeping you waiting, I was with Rowan. You made it, that's what counts."}],[],'Sorry I am late, I was with Rowan.'),[{speaker:'mina',text:"You made it, that's what counts."}]);
 // Answers that reuse a few of the player's words stay.
 const kept=[{speaker:'rowan',text:'I will miss the bodega cat on this city block. What about you?'}];assert.deepEqual(dropRepeats(kept,[],'Tell me something dumb you will miss about this city.'),kept);
});

test('a body-part subject filed under a speaker is narration whatever its verb',()=>{
 assert.deepEqual(guard('Her lips bite yours. Fine, you win.',['mina'],'mina'),[{speaker:'',text:'Her lips bite yours.'},{speaker:'mina',text:'Fine, you win.'}]);
 assert.deepEqual(guard('Her name was Clara. She left.',['mina'],'mina'),[{speaker:'mina',text:'Her name was Clara. She left.'}]);
 assert.deepEqual(guard('She was always like that.',['mina'],'mina'),[{speaker:'mina',text:'She was always like that.'}]);
});

test('an NPC does not kiss or grope the player unless the player started it, and the prompt says so outside intimacy packs',()=>{
 const lines=[{speaker:'mina',text:'With Rowan? Really?'},{speaker:'',text:'She grabs your collar, yanking you into a heated kiss. Her lips bite yours as she presses against you, grinding her hips roughly. The room hums.'}];
 assert.deepEqual(dropAdvances(lines,'Sorry I am late, I was with Rowan.'),[{speaker:'mina',text:'With Rowan? Really?'},{speaker:'',text:'The room hums.'}]);
 assert.deepEqual(dropAdvances(lines,'I kiss Mina.'),lines);
 assert.deepEqual(dropAdvances([{speaker:'mina',text:'Rowan kissed a frog once. Long story.'}],'Hi'),[{speaker:'mina',text:'Rowan kissed a frog once. Long story.'}]);
 const p=pack(),rule=/Nobody kisses or touches the player unless the player starts it/,sys=q=>scenePromptMessages({stagedCast:['ada'],sceneHistory:[],playerAction:'Hi',location:q.locations[0]},q)[0].content;
 assert.match(sys(p),rule);p.modules['social.intimacy']='0.1.0';assert.doesNotMatch(sys(p),rule);
});

test('a question about an NPC is answered from the authored line it touches',()=>{
 const rowan=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))).actors.find(a=>a.id==='rowan');
 assert.match(groundFor(rowan,'Where is the fellowship?'),/observatory fellowship abroad/);
 assert.match(groundFor(rowan,'Want some coffee?'),/^they love terrible vending-machine coffee/);
 assert.equal(groundFor(rowan,'How are you?'),'');assert.equal(groundFor(rowan,'Would you think about it?'),'');
});

test('a speech line never ends on a dangling comma, and a pronoun dialogue tag is dropped rather than renamed',()=>{
 assert.deepEqual(guard('I started drawing on the backs of bus transfers,',['mina'],'mina'),[{speaker:'mina',text:'I started drawing on the backs of bus transfers.'}]);
 assert.deepEqual(guard('"Try not to miss me too much," she teases lightly.',['mina']),[{speaker:'mina',text:'Try not to miss me too much.'}]);
});

test('apologies preserve who apologized and miss questions do not invent irrelevant favorite grounding',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),at=input=>beatDirection({stagedCast:['rowan'],scenePhase:'continuation',playerAction:input,sceneHistory:[]},p,'s1');
 assert.match(at('Sorry I am late, I was with Mina.'),/the player is the one who is sorry, not Rowan/);assert.match(at('Tell me something dumb you will miss about this city.'),/answer the actual question/);assert.doesNotMatch(at('Tell me something dumb you will miss about this city.'),/terrible vending-machine coffee/);assert.match(at('Will you miss the vending-machine coffee?'),/terrible vending-machine coffee/);
});

test('ordinary groups keep named targeting without mandatory alternate-turn interjections',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),at=(input,n,phase='continuation')=>beatDirection({stagedCast:['mina','rowan'],scenePhase:phase,playerAction:input,sceneHistory:Array(n).fill({input:'',text:''})},p,'s1');
 const runs=Array.from({length:6},(_,n)=>at('Nice frames.',n));assert.ok(runs.every(d=>/^Mina:/.test(d)&&!/cuts in/.test(d)));assert.equal(new Set(runs).size,1);
 for(let n=0;n<4;n++){assert.match(at('Rowan, nice frames.',n),/^Rowan:/);assert.doesNotMatch(at('Rowan, nice frames.',n),/cuts in/);assert.doesNotMatch(at('Hi.',n,'opening'),/cuts in/);assert.doesNotMatch(at('Ask Mina what my favorite color is',n),/cuts in/);}
 assert.doesNotMatch(beatDirection({stagedCast:['rowan'],scenePhase:'continuation',playerAction:'Nice.',sceneHistory:[]},p,'s1'),/cuts in/);
});

test('a cast member without authored pronouns is given they/them rather than left for the model to guess',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/00-illustrated-workshop.json',import.meta.url))),cyra=p.actors.find(a=>a.id==='cyra'),brin=p.actors.find(a=>a.id==='brin');
 assert.equal(cyra.pronouns,undefined);assert.equal(brin.pronouns,'he/him');
 const c=budgetSceneContext({stagedCast:['cyra','brin'],scenePhase:'continuation',playerAction:'Hi.',sceneHistory:[]},p,{turns:{}},'now',{window:8192,reply:512,render:x=>scenePromptMessages(x,p)}).context;
 assert.deepEqual(c.castProfiles.map(x=>[x.id,x.pronouns]).sort(),[['brin','he/him'],['cyra','they/them']]);
});

test('an opening where the cast never speaks is repaired once, then shown as it is',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'}),c={stagedCast:['ada'],sceneHistory:[],location:p.locations[0]};let calls=0,sent;
 provider.complete=async messages=>{sent=messages;return JSON.stringify({lines:++calls===1?[{speaker:'ada',text:'*She looks up from the bench.*'}]:[{speaker:'',text:'Ada looks up.'},{speaker:'ada',text:'You again. Grab a stool.'}]});};
 let r=await provider.generateScene(c,p);assert.equal(calls,2);assert.equal(r.lintTrace[0].check,'speech');assert.match(sent.at(-1).content,/Ada must speak: add their words as \{"speaker":"ada"/);assert.equal(r.lines[1].speaker,'ada');
 calls=0;provider.complete=async()=>(++calls,JSON.stringify({lines:[{speaker:'',text:'Ada keeps working.'}]}));
 r=await provider.generateScene(c,p);assert.equal(calls,2);assert.deepEqual(r.lines,[{speaker:'',text:'Ada keeps working.'}]);
 calls=0;r=await provider.generateScene({...c,scenePhase:'continuation'},p);assert.equal(calls,1,'only openings are held to it');
});

test('a reply that only repeats what was said is repaired once, and whole short lines count as repeats',async()=>{
 const p=pack(),provider=new CompatibleProvider({endpoint:'http://localhost:1234/v1/chat/completions',model:'test'}),said=[{speaker:'ada',text:"It's fine. It's a wall."}];
 const c={stagedCast:['ada'],scenePhase:'continuation',sceneHistory:[],location:p.locations[0],playerAction:'How is it going?',spokenBefore:said};let calls=0,sent;
 provider.complete=async messages=>{sent=messages;return JSON.stringify({lines:[{speaker:'',text:'You ask Ada how things are going.'},{speaker:'ada',text:++calls===1?"It's fine. It's a wall.":'Slow. Two people so far.'}]});};
 let r=await provider.generateScene(c,p);assert.equal(calls,2);assert.equal(r.lintTrace[0].check,'repeat');assert.match(sent.at(-1).content,/Ada already said that: reply to "How is it going\?" with something new/);assert.equal(r.lines.find(l=>l.speaker==='ada').text,'Slow. Two people so far.');
 calls=0;provider.complete=async()=>(++calls,JSON.stringify({lines:[{speaker:'',text:'You ask Ada how things are going.'},{speaker:'ada',text:"It's fine. It's a wall."}]}));
 r=await provider.generateScene(c,p);assert.equal(calls,2);assert.equal(r.lines.find(l=>l.speaker==='ada').text,"It's fine. It's a wall.",'the second answer stands');
 // A whole short line is dropped once other speech remains; its sentences alone are too short to count.
 assert.deepEqual(dropRepeats([{speaker:'ada',text:"It's fine. It's a wall."},{speaker:'ada',text:'Coffee?'}],said),[{speaker:'ada',text:'Coffee?'}]);
});

test('stock RP reactions are trimmed from narration, concrete actions and speech are kept',()=>{
 const run=ls=>dropStock(ls.map(([speaker,text])=>({speaker,text}))).map(l=>`${l.speaker}:${l.text}`);
 assert.deepEqual(run([['','Rowan considers your question, a small smile tugging at his lips. He takes another sip before setting the cup aside.'],['rowan','Paris, mostly.']]),[':He takes another sip before setting the cup aside.','rowan:Paris, mostly.']);
 assert.deepEqual(run([['','She pauses and glances at you again, her expression softening slightly.'],['','He sets down his cup, meeting your gaze. There\'s no smirk this time, just raw vulnerability laid bare.'],['mina','Fine.']]),[':She pauses and glances at you again.',':He sets down his cup, meeting your gaze.','mina:Fine.']);
 assert.deepEqual(run([['','His gaze softens.'],['','He places a comforting hand on your shoulder.'],['rowan','Hey.']]),[':He places a comforting hand on your shoulder.','rowan:Hey.']);
 assert.deepEqual(run([['','Mina steps into the gallery, her eyes scanning the space quickly.'],['mina','Hi.']]),[':Mina steps into the gallery, her eyes scanning the space quickly.','mina:Hi.']);
 // Speech is never edited, and a narration-only reply keeps its lone reaction rather than going blank.
 assert.deepEqual(run([['rowan','A small smile tugging at my lips, huh?']]),['rowan:A small smile tugging at my lips, huh?']);
 assert.deepEqual(run([['','Her expression softens.']]),[':Her expression softens.']);
});

test('per-NPC relationship stages preserve boundaries without stock temperament or romance moves',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),mina=p.actors.find(a=>a.id==='mina'),c=extra=>({stagedCast:['mina'],scenePhase:'continuation',playerAction:'Nice frames.',sceneHistory:[],...extra}),at=extra=>beatDirection(c(extra),p,'s1'),actor=t=>({actor:{id:'mina',relationshipToPlayer:t}}),stage=extra=>relationshipStageOf(c(extra),mina);
 assert.equal(stage(actor(0)),'stranger');assert.match(at(actor(0)),/no touching or leaning in/);assert.doesNotMatch(at(actor(0)),/quick to spar|tease the player|admit one small/);
 assert.equal(stage({...actor(0),memories:[{text:'Met Mina',knownBy:[p.playerId,'mina']}]}),'familiar');assert.equal(stage({...actor(0),memories:[{text:'Met Rowan',knownBy:[p.playerId,'rowan']}]}),'stranger');assert.equal(stage(actor(20)),'familiar');assert.match(at(actor(20)),/no touching or leaning in/);assert.doesNotMatch(at(actor(20)),/banter and charged looks/);
 for(const [trust,expected] of [[45,'friend'],[80,'close']]){assert.equal(stage(actor(trust)),expected);assert.match(scenePromptMessages(c(actor(trust)),p)[1].content,new RegExp('Relationship with player: '+expected));assert.doesNotMatch(at(actor(trust)),/admit one small|knows the player well: relaxed/);}
 assert.equal(stage({}),'');assert.equal(stage({actor:{id:'rowan',relationshipToPlayer:90}}),'');
 const dating=(phase,x={})=>({...actor(80),dating:[{character:'mina',phase,...x}]});for(const phase of ['crush','dating','exclusive']){assert.equal(stage(dating(phase)),phase);assert.doesNotMatch(at(dating(phase)),/flirt a little/);}
 assert.equal(stage(dating('crush',{strained:true})),'strained');assert.match(at(dating('crush',{strained:true})),/physical distance/);for(const ph of ['rejected','broken']){assert.equal(stage(dating(ph)),ph);assert.match(at(dating(ph)),/no romantic or physical escalation/);assert.doesNotMatch(at(dating(ph)),/flirt a little|admit one small/);}assert.equal(stage(dating('available')),'close');
});

test('past disclosures and promises remain available without forced opening callbacks or invented fulfillment',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),mem=[{source:'t0',text:"the player told Mina: the player's name is Mara",kind:'disclosure'},{source:'t1',text:'Mara told Mina: Mara is nervous about the gallery opening',kind:'disclosure'},{source:'t2',text:'Mara promised Mina to bring coffee tomorrow',kind:'promise',promise:true},{source:'scene:x',text:'Mina and Mara argued'}];
 const c={stagedCast:['mina'],scenePhase:'opening',playerAction:'Go see Mina',sceneHistory:[],memories:mem},seeds='abcdefghijklmnop'.split(''),directions=seeds.map(seed=>beatDirection(c,p,seed));assert.equal(new Set(directions).size,1);assert.ok(directions.every(d=>!/follow up|kept their word|name is/.test(d)));
 const user=scenePromptMessages(c,p)[1].content;assert.match(user,/Mara is nervous about the gallery opening/);assert.match(user,/Mara promised Mina to bring coffee tomorrow/);assert.doesNotMatch(user,/Mara kept|coffee was brought/);const empty=scenePromptMessages({...c,memories:[]},p)[1].content;assert.doesNotMatch(empty,/Mara promised|gallery opening/);
});

test('authored mood cues remain available without invented ordinary daily moods',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),c={stagedCast:['mina'],scenePhase:'continuation',playerAction:'Nice frames.',sceneHistory:[],day:3},authored={...p,actors:p.actors.map(a=>a.id==='mina'?{...a,moods:['humming under her breath']}:a)};
 for(let day=1;day<=30;day++)assert.doesNotMatch(beatDirection({...c,day},p,'s'),/good mood today|tired today|quieter than usual today|restless today|chattier than usual today/);
 for(const source of [c,budgetSceneContext(c,authored,{turns:{}},'now',{window:8192,reply:512,render:x=>scenePromptMessages(x,authored)}).context])assert.match(scenePromptMessages(source,authored)[1].content,/Authored mood cues \(when appropriate\): humming under her breath/);assert.doesNotMatch(scenePromptMessages(c,p)[1].content,/Authored mood cues/);assert.equal(beatDirection(c,authored,'a'),beatDirection(c,authored,'b'));
});
test('ordinary filler and substantive input preserve author topics without compulsory topic switches',()=>{
 const p=JSON.parse(readFileSync(new URL('../packs/crossed-plans.json',import.meta.url))),c=input=>({stagedCast:['mina'],scenePhase:'continuation',playerAction:input,sceneHistory:[]});
 for(const input of ['Go on.',"I spent the whole summer fixing my uncle's boat"])for(let n=0;n<40;n++)assert.doesNotMatch(beatDirection(c(input),p,'t'+n),/bring up /);
 const user=scenePromptMessages(c("I spent the whole summer fixing my uncle's boat"),p)[1].content;assert.match(user,/fixing my uncle's boat/);assert.match(user,/felt-tip pens/);
});
