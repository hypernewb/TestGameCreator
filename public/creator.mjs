import {mountUiProject} from './ui-project.mjs';
import {mountPortrait} from './character-media.mjs';
// M2 world creator: premise -> editable proposal -> structure -> draft every card -> review/edit/redraft scene cards -> save as a new campaign.
// Talks to /api/creator/*; code on the server owns ids, numbers and the age rule, this page only edits names, picks and text.
const $=id=>document.getElementById(id),view=$('view'),KEY='creator-draft';
const h=(tag,props={},...kids)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{}))k.startsWith('on')?e.addEventListener(k.slice(2),v):k==='class'?e.className=v:k in e&&k!=='list'?e[k]=v:e.setAttribute(k,v);for(const c of kids.flat(Infinity))if(c!=null&&c!==false)e.append(c);return e;};
const api=async(path,body)=>{const r=await fetch('/api/creator/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{});const d=await r.json();if(!r.ok||d.error)throw new Error(d.error||r.statusText);return d;};
const say=(m,bad)=>{$('status').textContent=m||'';$('status').style.color=bad?'#e39a7a':'';};
let O,S={step:1,premise:'',heroines:4,style:''};
try{S={...S,...JSON.parse(localStorage.getItem(KEY)||'{}')};}catch{}
if(S.navigation!==3){if(S.spec)S.step=S.navigation===2?(S.step===4?5:S.step===5?6:S.step):(S.step===4?6:S.step===5?5:S.step);S.navigation=3;}
const keep=()=>{try{localStorage.setItem(KEY,JSON.stringify(S));}catch{}};
const go=step=>{S.step=step;keep();render();scrollTo(0,0);};
const busy=async(btn,msg,fn)=>{const all=[...view.querySelectorAll('button')];all.forEach(b=>b.disabled=true);say(msg);try{await fn();}catch(e){say(e.message,true);}finally{all.forEach(b=>b.disabled=false);}};

// Paths: heroines.<id>.… picks the heroine by id; numeric keys make arrays.
const getPath=(o,p)=>p.split('.').reduce((x,k)=>x==null?x:Array.isArray(x)&&x===S.spec?.heroines?x.find(v=>v.id===k):x[k],o);
const setPath=(o,p,v)=>{const ks=p.split('.');let x=o;ks.slice(0,-1).forEach((k,i)=>{const nx=x===o.heroines?x.find(v=>v.id===k):(x[k]??=(/^\d+$/.test(ks[i+1])?[]:{}));x=nx;});x[ks.at(-1)]=v;};

// Small form helpers bound to an object field.
const field=(label,o,k,{type='text',opts,num,wide,onchange}={})=>{const set=v=>{o[k]=num?Number(v):v;keep();};
 const el=opts?h('select',{onchange:e=>{set(e.target.value);onchange?.();}},opts.map(x=>{const [v,t]=Array.isArray(x)?x:[x,x];return h('option',{value:v,selected:String(o[k]??'')===v},t);}))
  :type==='area'?h('textarea',{value:o[k]??'',oninput:e=>set(e.target.value)}):h('input',{type,value:o[k]??'',oninput:e=>set(e.target.value),...(onchange?{onchange}:{}),...(type==='number'?{min:18,step:1}:{})});
 return h('div',wide?{style:'grid-column:1/-1'}:{},h('label',{},label),el);};
const names=a=>(a||[]).map(x=>x.name).filter(Boolean);

function stepPremise(){
 const worlds=h('div',{},h('p',{class:'muted'},'Loading saved worlds…'));
 api('worlds').then(({worlds:w})=>worlds.replaceChildren(...(w.length?w.map(x=>h('div',{class:'bar'},h('button',{onclick:()=>openWorld(x.id)},'Open'),h('span',{},x.title||x.id),h('span',{class:'muted'},new Date(x.saved).toLocaleString()))):[h('p',{class:'muted'},'No saved worlds yet.')])));
 return [h('section',{},h('h2',{},'Premise'),O.drafter?null:h('p',{class:'errs'},h('li',{},'No drafter key: set OPENROUTER_API_KEY in .env and restart the server.')),
  h('div',{class:'bar'},S.card?[h('span',{class:'tone best'},'card'),h('span',{},`${S.card.name} is love interest 1; the rest of the cast fits around her.`),h('button',{title:'Remove the card',onclick:()=>{S.card=null;keep();render();}},'✕')]
   :[h('label',{},'Start from a character card (optional): '),h('input',{type:'file',accept:'.png,.json,image/png,application/json',onchange:e=>loadCard(e.target.files[0])})]),
  field('One or two sentences: who you are and where the story takes place',S,'premise',{type:'area'}),
  h('div',{class:'row'},field('Love interests',S,'heroines',{opts:['1','2','3','4','5','6'],num:true}),field('Writing style (optional)',S,'style')),
  h('div',{class:'bar'},h('button',{id:'creator-next',onclick:()=>{S.proposal||={title:'',premise:S.premise,setting:'',player:{name:'',age:21},places:[{name:'',kind:'home',about:''},{name:'',kind:'public',about:''}],items:[],activities:[],weather:[],heroines:Array.from({length:Number(S.heroines)||1},()=>({name:'',age:21,temperament:'torn',pace:'steady',topic:'',home:'',wants:[]}))};go(2);}},'Next: edit setup (no generation)'),h('button',{onclick:e=>busy(e.target,'Proposing a world… (about 30 seconds)',async()=>{const r=await api('propose',{premise:S.premise,heroines:S.heroines,style:S.style,card:S.card||undefined});S.proposal=r.proposal;S.notes=r.notes;S.spec=null;go(2);say('');})},'Propose a world'),
   S.proposal?h('button',{onclick:()=>go(S.spec?6:2)},'Back to the current draft'):null)),
  h('section',{},h('h2',{},'Saved worlds'),h('p',{class:'muted'},'Reopen a world to edit or redraft it. Saving again makes a new campaign.'),worlds)];
}

// A SillyTavern card is read on the server (no model call); its scenario becomes the premise if there is none yet.
async function loadCard(file){if(!file)return;try{const png=/png$/i.test(file.type||file.name),card=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=()=>no(new Error('Could not read the file'));png?r.readAsDataURL(file):r.readAsText(file);});
 const c=await api('card',{card});S.card={name:c.name,text:c.text};if(!S.premise.trim())S.premise=c.premise||`A love story with ${c.name}.`;keep();render();say(`Card loaded: ${c.name}.`);}catch(e){say(e.message,true);}}

function stepProposal(){
 const p=S.proposal,rerender=()=>{keep();render();},places=names(p.places),items=['',...names(p.items)],hs=names(p.heroines);
 const del=(arr,i)=>h('button',{title:'Remove',onclick:()=>{arr.splice(i,1);rerender();}},'✕');
 const list=(title,key,row,blank,note)=>h('section',{},h('h2',{},title),note?h('p',{class:'muted'},note):null,(p[key]||=[]).map((x,i)=>h('div',{class:'row'},row(x,i),del(p[key],i))),h('button',{onclick:()=>{p[key].push(blank());rerender();}},'Add'));
 const heroine=(x,i)=>{x.wants=[0,1].map(j=>x.wants?.[j]||{stat:'',level:'some'});x.hangouts=[0,1].map(j=>x.hangouts?.[j]||'');
  const csv=k=>h('div',{},h('label',{},`${k[0].toUpperCase()+k.slice(1)} (comma-separated)`),h('input',{value:(x[k]||[]).join(', '),oninput:e=>{x[k]=e.target.value.split(',').map(s=>s.trim()).filter(Boolean);keep();}}));
  const portrait=h('div');mountPortrait(portrait,{actor:x,candidates:()=>p.heroines.map(a=>a.portrait),active:()=>S.proposal===p&&p.heroines.includes(x),onChange:rerender,onStatus:say});return h('div',{class:'her'},portrait,h('div',{class:'row'},field('Name',x,'name',{onchange:rerender}),field('Age (18+)',x,'age',{type:'number',num:true}),
    field('Temperament',x,'temperament',{opts:Object.entries(O.temperaments).map(([k,a])=>[k,`${k} — ${a}`])}),field('Pace',x,'pace',{opts:O.paces}),field('Loves talking about',x,'topic'),field('Home',x,'home',{opts:places})),
   h('div',{class:'row'},x.wants.map((w,j)=>[field(`Wants ${j+1}: stat`,w,'stat',{opts:[['','(none)'],...O.stats]}),field('How much',w,'level',{opts:O.levels})])),
   h('details',{},h('summary',{},'More: hangouts, gifts, likes, quirk'),h('div',{class:'row'},x.hangouts.map((_,j)=>field(`Hangout ${j+1}`,x.hangouts,j,{opts:['',...places]})),field('Quirk to notice',x,'quirk'),field('Compliment that misses',x,'looks')),
    h('div',{class:'row'},field('Loved gift',x,'loved',{opts:items}),field('Liked gift',x,'liked',{opts:items}),field('Disliked gift',x,'disliked',{opts:items}),field('Buys you',x,'buy',{opts:items})),h('div',{class:'row'},csv('likes'),csv('dislikes'))),
   h('div',{class:'bar'},del(p.heroines,i)));};
 p.player||={name:'',age:21};p.tone||='soap';p.firsts??='free';
 return [h('section',{},h('h2',{},'World'),h('div',{class:'row'},field('Title',p,'title'),field('Player name',p.player,'name'),field('Player age',p.player,'age',{type:'number',num:true})),
   field('Premise',p,'premise',{type:'area'}),field('Setting',p,'setting',{type:'area'}),
   h('div',{class:'row'},field('Drama ceiling',p,'tone',{opts:(O.tones||['soap']).map(t=>[t,{grounded:'grounded: small everyday trouble',soap:'soap: jealousy and rumors',melodrama:'melodrama: public clashes, close calls'}[t]||t])}),
    field('Firsts',p,'firsts',{opts:[['free','free: the player types; code holds the checkpoints'],['authored','authored: classic choice scenes']]}))),
  list('Places','places',x=>[field('Name',x,'name',{onchange:rerender}),field('Kind',x,'kind',{opts:O.placeKinds}),field('About',x,'about')],()=>({name:'',kind:'public',about:''}),'The first place is the player\'s home. Code links the places together.'),
  list('Things to buy or gift','items',x=>[field('Name',x,'name',{onchange:rerender}),field('Sold at',x,'at',{opts:places}),field('Price',x,'price',{opts:O.prices}),h('div',{},h('label',{},'Drink'),h('input',{type:'checkbox',checked:!!x.drink,onchange:e=>{x.drink=e.target.checked;keep();}}))],()=>({name:'',at:places[0]||'',price:'mid'})),
  list('Activities','activities',x=>[field('Name',x,'name'),field('Where',x,'at',{opts:places}),field('Trains',x,'gives',{opts:[...O.stats,'money']}),field('Done with',x,'with',{opts:['',...hs]}),field('About',x,'about')],()=>({name:'',at:places[0]||'',gives:'charm',with:''}),'Code sets the rewards: paid jobs +30, training +2, with a love interest +1 and trust.'),
  list('Weather','weather',x=>[field('Name',x,'name'),field('Text',x,'text')],()=>({name:'',text:''})),
  h('section',{},h('h2',{},'Love interests'),(p.heroines||=[]).map(heroine),p.heroines.length<6?h('button',{onclick:()=>{p.heroines.push({name:'',age:21,temperament:'torn',pace:'steady',topic:'',wants:[]});rerender();}},'Add a love interest'):null),
  h('div',{class:'foot'},h('button',{onclick:()=>go(1)},'Back'),h('button',{id:'creator-next',onclick:e=>{if(S.spec){go(3);say('Existing structure and edits retained. Rebuild explicitly to use changed setup fields.');}else build(e);}},'Next: Draft text'),S.spec?h('button',{onclick:e=>{if(confirm('Rebuilding replaces drafted text and later settings with a fresh structure. Continue?'))build(e);}},'Rebuild structure'):null)];
 function build(e){return busy(e.target,'Building the structure.',async()=>{const used=(p.heroines||[]).filter(x=>String(x.name||'').trim()||String(x.topic||'').trim()),r=await api('structure',{proposal:used.length?{...p,heroines:used}:p});Object.assign(S,{uiOwner:crypto.randomUUID(),uiDesigner:{review:null},spec:r.spec,notes:r.notes,cards:r.cards,batches:r.batches,errors:[],progress:{}});go(3);say('');});}
}

// Draft: world first (title, tone), then profiles (voice + description feed the scenes), then the scenes six at a time; two passes.
let stop=false,running=false;
async function draftAll(){running=true;try{await draftRun();}finally{running=false;render();}}
async function draftRun(){
 stop=false;S.errors=[];S.progress||={};
 for(let pass=0;pass<2&&!stop;pass++){const left=(await api('check',{spec:S.spec})).batches.map(b=>b.id);if(!left.length)break;
  const groups=[left.filter(i=>i==='world'),left.filter(i=>i.endsWith(':profile'))],rest=left.filter(i=>i!=='world'&&!i.endsWith(':profile'));for(let i=0;i<rest.length;i+=6)groups.push(rest.slice(i,i+6));
  for(const g of groups.filter(g=>g.length)){if(stop)break;g.forEach(i=>S.progress[i]='run');render();
   const r=await api('fill',{spec:S.spec,batches:g,style:S.style});S.spec=r.spec;S.cards=r.cards;S.batches=r.batches;S.errors.push(...r.errors);
   const bad=new Set(r.batches.map(b=>b.id));g.forEach(i=>S.progress[i]=bad.has(i)?'bad':'ok');keep();render();}}
 say(stop?'Stopped. Draft the rest when ready.':S.batches.length?`${S.batches.length} cards still have blanks: draft again, or fill them by hand in review.`:'Every card is drafted.');
 if(!stop&&!S.batches.length)go(6);
}
const cardName=id=>{if(id==='world')return 'World';if(id.startsWith('director:'))return `Director · ${id.slice(9)}`;const [hid,r]=id.split(':'),mode=r&&getPath(S.spec,`heroines.${hid}.rungs.${r}.mode`),eff=mode||S.spec?.world?.firsts||(r?'authored':'');
 return `${getPath(S.spec,`heroines.${hid}.actor.name`)||hid} · ${r}${eff==='free'?' (free)':''}${mode==='authored'&&S.spec?.world?.firsts==='free'?' (authored)':''}`;};
function stepDraft(){
 const cards=S.cards||[];
 return [S.notes?.length?h('section',{},h('h2',{},'What code changed'),h('ul',{class:'notes'},S.notes.map(n=>h('li',{},n)))):null,
  h('section',{},h('h2',{},'Draft the text'),h('p',{class:'muted'},`${cards.length} cards. Scenes are drafted six at a time; a whole world takes a few minutes.`),
   h('ul',{class:'prog'},cards.map(c=>h('li',{class:S.progress?.[c.id]||''},cardName(c.id)))),S.errors?.length?h('ul',{class:'errs'},S.errors.map(e=>h('li',{},e))):null,
   h('div',{class:'bar'},h('button',{disabled:running,onclick:e=>busy(e.target,'Drafting…',draftAll)},Object.keys(S.progress||{}).length?'Draft what is left':'Draft everything'),h('button',{onclick:()=>{stop=true;say('Stopping after the current group…');}},'Stop'),h('button',{id:'creator-next',onclick:()=>go(4)},'Next: Gameplay modules'),h('button',{onclick:()=>go(6)},'Edit text / Review now'))),
  h('div',{class:'foot'},h('button',{onclick:()=>go(2)},'Back to the proposal'))];
}

// Review: one card per scene; every field editable; choices show their tone; Redraft rewrites just that card.
const pretty=rel=>rel.replace(/(\w+?)s?\.(\d+)(?=\.|$)/g,(_,k,n)=>`${k} ${+n+1}`).replace(/\.(text|label)$/,'').replace(/\.result$/,'.what happens').replace(/checkIn/g,'check-in').replace(/checkpoints\.([\w-]+)$/,'cue ($1)').replaceAll('.',' › ');
const blankCount=()=>(S.cards||[]).reduce((n,c)=>n+c.paths.filter(p=>!String(getPath(S.spec,p)??'').trim()).length,0);
function card(c){
 const base=c.id==='world'?'':c.id.startsWith('director:')?'director.beats.':`heroines.${c.id.split(':')[0]}.${c.id.endsWith(':profile')?'':`rungs.${c.id.split(':')[1]}.`}`;
 const ORDER=['title','name','description','voice','opening','checkpoints','pages','choices','lead','rush','checkIn','peak','stop'],rank=p=>{const i=ORDER.indexOf(p.slice(base.length).split('.')[0]);return i<0?ORDER.length:i;};
 const fields=[...c.paths].sort((a,b)=>rank(a)-rank(b)).map(p=>{const rel=p.slice(base.length),v=String(getPath(S.spec,p)??''),m=rel.match(/^(.*choices\.\d+)\.label$/),tone=m&&getPath(S.spec,`${base}${m[1]}.tone`),short=/(^|\.)(title|label|name|stop)$/.test(rel)||/\.ranks\.\d+$|^ranks\.\d+$/.test(rel);
  const wrap=h('div',{class:'f'+(v.trim()?'':' blank')}),mark=e=>{setPath(S.spec,p,e.target.value);wrap.className='f'+(e.target.value.trim()?'':' blank');keep();foot();};
  wrap.append(h('label',{},pretty(rel),tone?h('span',{class:`tone ${tone}`},tone):null),short?h('input',{value:v,oninput:mark}):h('textarea',{value:v,rows:Math.min(8,Math.ceil(v.length/110)+1),oninput:mark}));return wrap;});
 // O1: a rung card can flip its first between free (typed, checkpoint cues) and authored (choice scenes); the card set is re-derived.
 const rung=c.id.includes(':')&&!c.id.startsWith('director:')&&!c.id.endsWith(':profile')?c.id.split(':')[1]:null;
 const modeSel=rung?h('select',{title:'How this first plays',onchange:e=>busy(e.target,'Switching…',async()=>{setPath(S.spec,`${base}mode`,e.target.value);keep();const r=await api('check',{spec:S.spec});Object.assign(S,{cards:r.cards,batches:r.batches});render();say('');})},
  [['','world setting'],['free','free'],['authored','authored']].map(([v,t])=>h('option',{value:v,selected:(getPath(S.spec,`${base}mode`)??'')===v},t))):null;
 const el=h('div',{class:'card'},h('header',{},h('h3',{},cardName(c.id)),modeSel,h('button',{onclick:e=>busy(e.target,`Redrafting ${cardName(c.id)}…`,async()=>{const r=await api('fill',{spec:S.spec,batches:[c.id],redo:true,style:S.style});S.spec=r.spec;keep();el.replaceWith(card(c));foot();say(r.errors.length?r.errors.join('; '):'Redrafted.',r.errors.length);})},'Redraft')),fields);
 if(c.id.endsWith(':profile')){const actor=getPath(S.spec,base+'actor'),spec=S.spec;mountPortrait(el,{actor,candidates:()=>spec.heroines.map(x=>x.actor.portrait),active:()=>S.spec===spec&&spec.heroines.some(x=>x.actor===actor),onChange:()=>{keep();render();},onStatus:say});}return el;
}
let footEl;
const foot=()=>{const n=blankCount();footEl?.replaceChildren(h('button',{onclick:()=>go(3)},'Back to drafting'),h('button',{onclick:()=>go(5)},'Back to Game UI'),h('span',{class:n?'errs':'muted'},n?`${n} blank fields`:'No blanks'),h('button',{disabled:!!n||!!S.uiDesigner?.designerDirty,onclick:e=>busy(e.target,'Saving…',async()=>{const r=await api('save',{spec:S.spec,proposal:S.proposal});S.saved=r;keep();say('');render();})},'Save as a new campaign'));};
function stepReview(){
 if(S.saved)return [h('section',{},h('h2',{},`Saved: ${S.saved.title}`),h('p',{},'It is a new campaign now. Open Campaigns on the Play page to start it.'),h('div',{class:'bar'},h('a',{class:'button',href:'/play.html?campaign='+encodeURIComponent(S.saved.campaignId)},'Play this saved campaign'),h('button',{onclick:()=>{S.saved=null;keep();render();}},'Keep editing'),h('button',{onclick:()=>{S={step:1,premise:'',heroines:4,style:''};go(1);}},'Start a new world')))];
 const groups=new Map();for(const c of S.cards||[]){const g=c.id==='world'?'World':c.id.startsWith('director:')?'Director beats (any love interest can play {lead} or {rival})':getPath(S.spec,`heroines.${c.id.split(':')[0]}.actor.name`)||c.id;if(!groups.has(g))groups.set(g,[]);groups.get(g).push(c);}
 footEl=h('div',{class:'foot'});foot();
 return [h('section',{},h('h2',{},'Review / Save'),S.uiDesigner?.designerDirty?h('p',{class:'errs'},'Game UI edits are pending. Return to Game UI and Apply or Cancel before saving.'):null),...[...groups].map(([g,cs])=>[h('div',{class:'group'},g),...cs.map(card)]).flat(),footEl];
}

async function openWorld(id){await busy(null,'Opening…',async()=>{const w=await api(`world?id=${encodeURIComponent(id)}`),r=await api('check',{spec:w.spec});Object.assign(S,{uiOwner:crypto.randomUUID(),uiDesigner:{review:null},proposal:w.proposal,spec:w.spec,cards:r.cards,batches:r.batches,notes:[],errors:[],progress:{},saved:null});go(6);say('');});}

function stepModules(){
 const spec=S.spec,box=h('section',{},h('h2',{},'Gameplay modules'),h('p',{class:'muted'},'These are engine systems, separate from Game UI element visibility. Dependencies are enabled automatically. Existing configuration is retained; unsupported changes explain the required configuration.'));
 api('modules',{spec}).then(r=>{if(S.spec!==spec||S.step!==4||!box.isConnected)return;for(const meta of Object.values(O.modules||{})){const input=h('input',{type:'checkbox',checked:!!r.modules[meta.id],'data-module':meta.id,onchange:e=>busy(e.target,'Validating module dependencies.',async()=>{let result;try{result=await api('modules',{spec,id:meta.id,enabled:input.checked});}catch(e){input.checked=!!r.modules[meta.id];throw e;}if(S.spec!==spec)return;S.spec=result.spec;keep();render();say('Module choice validated. Existing configuration retained.');})});box.append(h('label',{class:'bar'},input,meta.title));}}).catch(e=>say(e.message,true));
 return [box,h('div',{class:'foot'},h('button',{onclick:()=>go(3)},'Back: Draft text'),h('button',{id:'creator-next',onclick:()=>go(5)},'Next: Game UI'))];
}
function stepGameUi(){
 const spec=S.spec;S.uiOwner||=crypto.randomUUID();S.uiDesigner||={review:null};const box=h('section',{},h('h2',{},'Game UI'));
 const getPack=()=>({title:spec.title||S.proposal?.title,playerId:'player',actors:[{id:'player',...spec.player},...spec.heroines.map(x=>({id:x.id,...x.actor}))],locations:spec.world?.locations||[],activities:spec.world?.activities||[],modules:spec.modules||{'character.stats':'0.1.0'},statDefinitions:spec.world?.statDefinitions||[],gameProject:spec.project||{}});
 mountUiProject(box,{getPack,getProjectId:()=>S.spec===spec?S.uiOwner:'',state:S.uiDesigner,getPreviewData:()=>fetch('/api/ui-preview',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({spec})}).then(async r=>{const j=await r.json();if(!r.ok)throw Error(j.error);return j;}),onStatus:say,onChange:p=>{spec.project||={};spec.project.ui=p.gameProject.ui;keep();},onWizardBack:()=>go(4),onWizardNext:()=>go(6)});
 return [box,h('div',{class:'bar'},h('button',{onclick:()=>go(4)},'Back: Gameplay modules'),h('button',{id:'creator-next',onclick:()=>go(6)},'Next: Review / Save'))];
}
function render(){
 [...$('steps').children].forEach((li,i)=>li.classList.toggle('on',i+1===S.step));
 const step=S.step===2&&!S.proposal||S.step>2&&!S.spec?1:S.step;
 view.replaceChildren(...[[stepPremise,stepProposal,stepDraft,stepModules,stepGameUi,stepReview][step-1]()].flat().filter(Boolean));if(S.spec&&step!==5&&!S.saved)view.prepend(h('div',{class:'bar'},h('button',{onclick:()=>go(5)},'Game UI')));
}
api('options').then(o=>{O=o;render();}).catch(e=>say(e.message,true));
