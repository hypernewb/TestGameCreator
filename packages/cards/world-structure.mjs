// M2 structure pass: premise -> a readable proposal (names, enum picks, references by name) -> a structure-only spec.
// The model (or the owner, editing the proposal) picks; code owns ids, exits, prices, yields, schedules, stats and the age rule.
import {TEMPERAMENTS,PACES,slug} from './beat-library.mjs';
import {parseModelObject} from '../ai/json.mjs';
import {readCard,clean} from './character-card.mjs';
import {TONE_CEILINGS} from './director-library.mjs';

// M5: a paid job that trains no stat plays the widget its place suggests (serving drinks is rhythm, a till is quick sums).
export const JOB_GAMES={bar:'rhythm',shop:'quiz',outdoors:'timing',public:'memory',home:'memory'};
export const PLACE_KINDS=['home','public','shop','bar','outdoors'],PRICES={cheap:5,mid:15,pricey:40},STATS=['charm','wit','fitness','focus'],WANT_MIN={some:5,lots:8};
const RANKS={charm:['Awkward','Likable','Magnetic','Irresistible'],wit:['Slow','Quick','Sharp','Brilliant'],fitness:['Soft','Fit','Athletic','Peak'],focus:['Scattered','Steady','Driven','Top of the class']};
export const STAT_KIT=STATS.map(id=>({id,name:id[0].toUpperCase()+id.slice(1),min:0,max:20,visibility:'public',learnFromFailure:1,ranks:[0,4,8,13].map((min,i)=>({min,name:RANKS[id][i]}))}));
const PACE_ABOUT={slow:'only after you are exclusive',steady:'once you are dating',easy:'once you are dating, a little sooner',casual:'early, and open to a fling'};
const assert=(ok,msg)=>{if(!ok)throw new Error(`world proposal: ${msg}`);};
const idFor=(name,taken)=>{let b=slug(String(name||'').normalize('NFD').replace(/[̀-ͯ]/g,'')).replace(/[^a-z0-9_-]+/g,'').replace(/-{2,}/g,'-').replace(/^[-_]+|-+$/g,'')||'x',id=b,i=2;while(taken.has(id))id=`${b}-${i++}`;taken.add(id);return id;};
const list=x=>[].concat(x??[]).filter(v=>typeof v==='string'?v.trim():v);

// A character card seeds a world: its heroine (name, voice, looks) and its scenario as the premise. Cards are untrusted text,
// so they are cleaned, capped, and refused when they make the character a minor. Backstory ages ("age 10 she ran away") pass only next to an adult age.
const MINOR_TAG=/\b(?:loli|shota|minor|underage|child|teen|jailbait)\b/i,AGES=/\b(?:aged?\s*[:=]?|(?:she|he) is|she's|i am|i'm)\s*(\d{1,3})\b(?![.,]\d|\s*(?:foot|feet|ft|cm|'|"))/gi;
export function cardSeed(input){
 const {data}=readCard(input),name=data.name.trim().slice(0,80),md=s=>s.replace(/!\[[^\]]*\]\([^)]*\)|<[^>]+>|^\s*[-*_=]{3,}\s*$/gm,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\n{3,}/g,'\n\n').trim();
 const c=(v,n)=>typeof v==='string'&&v.trim()?md(clean(v,name)).slice(0,n):'';
 // Card text only reaches the cloud drafter, never the local model's context, so the caps are generous: the voice often sits deep in the description.
 const text=[c(data.description,3000),c(data.personality,600)&&`Personality: ${c(data.personality,600)}`,c(data.first_mes,400)&&`Opening: ${c(data.first_mes,400)}`].filter(Boolean).join('\n');
 const ages=[...[data.description,data.personality,data.first_mes].map(v=>c(v,1e5)).join('\n').matchAll(AGES)].map(m=>+m[1]);
 assert(text,`${name}: the card has no description`);assert(!MINOR_TAG.test([].concat(data.tags||[]).join(' '))&&!(ages.some(a=>a<18)&&!ages.some(a=>a>=18)),`${name}: this card describes someone under 18`);
 return {name,text,premise:c(data.scenario,600)};
}

export function proposalMessages(premise,{heroines=4,style,card}={}){
 const T=Object.entries(TEMPERAMENTS).map(([k,t])=>`${k}: ${t.about}`).join('\n'),P=Object.entries(PACES).map(([k])=>`${k}: intimacy ${PACE_ABOUT[k]}`).join('\n');
 return [{role:'system',content:`You design adult dating-sim worlds. Every character is an adult (18+) with an integer age. Love interests are women. Reply with one JSON object only, no commentary.${style?` Style: ${style}`:''}`},
  {role:'user',content:`Premise: ${premise}\n\nPropose a small world with ${heroines} love interests, each a different temperament if possible.
Temperaments:\n${T}\nPaces:\n${P}\nStats the player trains: ${STATS.join(', ')} (or "money" for a paid job).
JSON shape:
{"title":"","premise":"1-2 sentences","setting":"1-2 sentences","player":{"name":"","age":21},
"places":[{"name":"","kind":"${PLACE_KINDS.join('|')}","about":"one sentence"}],  (5-7 places; the first is the player's home)
"items":[{"name":"","at":"place name","price":"cheap|mid|pricey","drink":false}],  (6-10 things to buy or gift)
"activities":[{"name":"","at":"place name","gives":"${[...STATS,'money'].join('|')}","with":"love interest name or empty","about":"one sentence"}],  (6-10; at least one pays money; one per love interest done with her)
"weather":[{"name":"","text":"one sentence"}],  (3)
"heroines":[{"name":"","age":24,"temperament":"","pace":"","home":"place name","hangouts":["place","place"],"topic":"what she loves to talk about, 1-3 words","quirk":"small thing to notice, 1-3 words","looks":"compliment that misses, 1-3 words","loved":"item name","liked":"item name","disliked":"item name","buy":"item name","likes":["",""],"dislikes":["",""],"wants":[{"stat":"","level":"some|lots"}]}]}${card?`\n\nThe first love interest is ${card.name} from this character card. Keep her name, looks and personality; pick the temperament and pace that fit her; use the card's age if it gives one (18+). Build the places and the other love interests around her world.\n${card.text}`:''}`}];
}

// Proposal -> structure-only spec. notes: what code changed or invented, for the wizard to show.
export function structureFromProposal(p){
 const notes=[],taken=new Set(['player']),byName=new Map(),key=s=>String(s||'').trim().toLowerCase();
 const places=list(p.places).slice(0,8).map((x,i)=>{const nm=String(x.name||'').trim()||`Place ${i+1}`;if(!String(x.name||'').trim())notes.push(`place ${i+1} had no name: called it "${nm}"`);return {id:idFor(nm,taken),name:nm,kind:PLACE_KINDS.includes(x.kind)?x.kind:'public',about:x.about||''};});assert(places.length>=2,'needs at least two places');
 places.forEach(x=>byName.set(key(x.name),x));const home=places[0];
 const place=(n,fallback)=>{const x=byName.get(key(n));if(n&&!x)notes.push(`unknown place "${n}": used ${fallback.name}`);return x||fallback;};
 const shops=places.filter(x=>x.kind==='shop'||x.kind==='bar'),shop=shops[0]||places.find(x=>x!==home)||home;
 const items=[],itemBy=new Map(),addItem=(x,why)=>{const it={id:idFor(x.name,taken),name:String(x.name).trim(),owner:place(x.at,shop).id,shop:true,price:PRICES[x.price]??PRICES.mid,stock:20,...(x.drink?{drink:true}:{})};items.push(it);itemBy.set(key(it.name),it);if(why)notes.push(why);return it;};
 list(p.items).slice(0,12).forEach(x=>x.name&&addItem(x));
 const item=n=>!n?undefined:(itemBy.get(key(n))||addItem({name:n},`"${n}" was not in the shop list: added at ${shop.name}`)).id;
 const hs=list(p.heroines).slice(0,6);assert(hs.length,'needs at least one love interest');
 const heroines=hs.map((h,i)=>{const unnamed=!String(h.name||'').trim(),nm=unnamed?`Love interest ${i+1}`:String(h.name).trim(),who=unnamed?`${nm} (unnamed)`:nm,id=idFor(nm,taken);if(unnamed)notes.push(`love interest ${i+1} had no name: called her "${nm}"`);assert(Number.isInteger(h.age)&&h.age>=18,`${who}: every character is an adult with an integer age of 18 or more`);
  assert(TEMPERAMENTS[h.temperament],`${who}: temperament must be one of ${Object.keys(TEMPERAMENTS)}`);assert(PACES[h.pace],`${who}: pace must be one of ${Object.keys(PACES)}`);assert(String(h.topic||'').trim(),`${who}: needs a topic (or remove this blank love interest)`);
  const hh=place(h.home,home),hang=list(h.hangouts).map(n=>place(n,places[1]||home)),stops=[hh,hang[0]||places[1]||hh,hang[1]||hang[0]||hh];
  byName.set(key(nm),{heroine:id});
  return {id,temperament:h.temperament,pace:h.pace,topic:String(h.topic).trim(),...(h.looks?{looks:h.looks}:{}),...(h.quirk?{quirk:h.quirk}:{}),
   gifts:{...(h.loved?{loved:item(h.loved)}:{}),...(h.liked?{liked:[item(h.liked)]}:{}),...(h.disliked?{disliked:item(h.disliked)}:{})},...(h.buy?{buy:item(h.buy)}:{}),
   wants:list(h.wants).filter(w=>STATS.includes(w.stat)).slice(0,2).map(w=>({id:w.stat,stat:w.stat,min:WANT_MIN[w.level]||WANT_MIN.some})),activities:[],
   actor:{name:nm,...(h.portrait?{portrait:h.portrait}:{}),age:h.age,pronouns:'she/her',location:hh.id,likes:list(h.likes).slice(0,4),dislikes:list(h.dislikes).slice(0,3)},_stops:stops.map(x=>x.id)};});
 // The opening scene needs someone in it: if no love interest starts at the player's home, the game opens where the first one spends her morning.
 let start=home;if(!heroines.some(h=>h._stops[0]===home.id)){const h=heroines[0],i=Math.max(0,h._stops.findIndex(s=>s!==h.actor.location));h._stops=[...h._stops.slice(i),...h._stops.slice(0,i)];h.actor.location=h._stops[0];start=places.find(x=>x.id===h._stops[0]);notes.push(`nobody starts at ${home.name}: the game opens at ${start.name}, where ${h.actor.name} is`);}
 const hero=n=>{const x=byName.get(key(n));return x?.heroine;};
 const activities=list(p.activities).slice(0,14).map(a=>{const at=place(a.at,home),w=hero(a.with),money=a.gives==='money',stat=STATS.includes(a.gives)?a.gives:money?null:'charm';
  const act={id:idFor(a.name,taken),name:String(a.name).trim(),description:a.about||'',location:at.id,duration:4,phrases:[String(a.name).trim().toLowerCase()],
   effects:[...(money?[{type:'money',delta:30}]:[]),...(stat?[{type:'stat',stat,delta:w?1:2}]:[]),...(w?[{type:'trust',character:w,delta:2}]:[])],...(w?{character:w,perDay:1}:{}),...(money&&!stat?{game:JOB_GAMES[at.kind]||'timing'}:{})};
  if(w)heroines.find(h=>h.id===w).activities.push(act.id);return act;});
 if(!activities.some(a=>a.effects.some(e=>e.type==='money'))){activities.push({id:idFor('Odd job',taken),name:'Odd job',description:'',location:shop.id,duration:4,phrases:['odd job','work'],effects:[{type:'money',delta:30}],game:JOB_GAMES[shop.kind]||'timing'});notes.push('no paid job was proposed: added "Odd job"');}
 const exits=x=>{const i=places.indexOf(x),n=places.length,to=new Set(i?[home.id]:places.slice(1).map(y=>y.id));if(i){to.add(places[i%(n-1)+1].id);to.add(places[(i-2+n-1)%(n-1)+1].id);}to.delete(x.id);return [...to].map(t=>({to:t}));};
 const drinks=items.filter(i=>i.drink).map(i=>i.id);items.forEach(i=>delete i.drink);
 const weather=list(p.weather).slice(0,3).map((w,i)=>({id:idFor(w.name,new Set()),name:String(w.name).trim(),weight:[50,30,20][i],text:w.text||''}));
 const spec={id:idFor(p.title||'world',new Set()),title:p.title||'',days:28,player:{name:p.player?.name||'You',age:p.player?.age,pronouns:'you',location:start.id,identityTags:['adult']},
  project:{premise:p.premise||'',setting:p.setting||''},
  world:{locations:places.map(x=>({id:x.id,name:x.name,description:x.about,exits:exits(x)})),items,activities,statDefinitions:STAT_KIT,initialStats:STATS.map(stat=>({character:'player',stat,value:2})),
   schedules:heroines.map(h=>({actor:h.id,period:12,stops:h._stops.map((location,i)=>({at:i*4,location}))})),calendar:{startDate:'2026-09-07',...(weather.length?{weather}:{})},
   initialMoney:60,economySettings:{debtLimit:10},privateLocations:[...new Set([home.id,...places.filter(x=>x.kind==='home').map(x=>x.id)])],...(drinks.length?{sobriety:{drinkItems:drinks,tipsyAt:2,drunkAt:3,soberPerDaypart:1}}:{}),...(p.firsts?{firsts:p.firsts}:{})},
  heroines:heroines.map(({_stops,...h})=>h),director:{tone:TONE_CEILINGS.includes(p.tone)?p.tone:'soap'}};
 if(!Number.isInteger(spec.player.age)||spec.player.age<18){spec.player.age=21;notes.push('player age set to 21');}
 // The card's text rides along so every draft of her keeps the card's voice.
 if(p.card?.text){const first=n=>key(n).split(' ')[0],h=spec.heroines.find(h=>key(h.actor.name)===key(p.card.name))||spec.heroines.find(h=>first(h.actor.name)===first(p.card.name));
  if(h)spec.source={card:{heroine:h.id,name:String(p.card.name).slice(0,80),text:String(p.card.text).slice(0,4000)}};else notes.push(`no love interest is named ${p.card.name}: the card is not used`);}
 return {spec,notes};
}

// complete(messages) -> Promise<string>. Returns the raw proposal too, so the wizard can show and edit it.
export async function proposeWorld(premise,{complete,heroines=4,style,card}={}){
 const proposal=parseModelObject(await complete(proposalMessages(premise,{heroines,style,card})));if(card)proposal.card={name:card.name,text:card.text};
 return {proposal,...structureFromProposal(proposal)};
}
