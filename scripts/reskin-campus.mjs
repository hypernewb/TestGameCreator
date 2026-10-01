// Derives the three-heroine campus (Yuna, Haruka, Min-ji; owner call 2026-10-01) from packs/campus.json, so tuning on the
// campus keeps flowing in: rerun `node scripts/reskin-campus.mjs` after campus.json changes. Personalities are reskinned
// (Jana→Yuna torn/slow, Nova→Haruka prickly/medium, Abigail→Min-ji practical/bold); Monique and Kaylee are cut, and
// Jana's ex Dominik becomes Yuna's family plan back home. Fails if any old-cast detail survives.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const DROP=['monique','kaylee'],RENAME={jana:['yuna','Yuna'],nova:['haruka','Haruka'],abigail:['minji','Min-ji']};
export const EXPRESSIONS=['neutral','smile','concerned','frustrated','embarrassed','smug','surprised'];
const NIGHT_CG={yuna:'missionary',haruka:'missionary',minji:'cowgirl'};
const BODY={
 jana:{face:[1,'ask_first'],lips:[2,'ask_first'],neck:[3,'ask_first'],arms_hands:[1,'ok'],chest:[2,'ask_first'],back:[1,'ok'],belly_waist:[2,'ask_first'],hips_butt:[2,'hard'],thighs_legs:[1,'ask_first'],intimate:[3,'ask_first']},
 nova:{face:[2,'hard'],lips:[2,'ask_first'],neck:[3,'ask_first'],arms_hands:[1,'ok'],chest:[2,'ask_first'],back:[0,'ok'],belly_waist:[3,'ask_first'],hips_butt:[1,'ask_first'],thighs_legs:[1,'ok'],intimate:[2,'ask_first']},
 abigail:{face:[0,'ok'],lips:[1,'ask_first'],neck:[3,'hard'],arms_hands:[1,'ok'],chest:[2,'ask_first'],back:[1,'ok'],belly_waist:[1,'ok'],hips_butt:[2,'ask_first'],thighs_legs:[0,'ok'],intimate:[3,'ask_first']}};
const LIMITS_NOTES={
 jana:'My hand or a gentle touch on my back is a comfortable start when we both want it; please ask about the other places and let me take my time, because I notice even small touches. Hips and bottom are not ready yet; you would have to earn that closeness, and a strong reaction is not me saying yes.',
 nova:'Hands, back, legs: comfortable territory when we both want it; everywhere else needs a real question, even if I am making a joke, and touching my face is not something I am ready for yet; you would have to earn it. My waist is ticklish and my neck reacts strongly, so ask before making either part of the bit.',
 abigail:'Simple version: face, hands, back, waist and legs are comfortable when we both want it; ask clearly before kissing or touching my chest, hips or intimate areas. Neck touching is not something I am ready for yet: you would have to earn that trust, and I would rather tell you directly than have you guess.'};
const BIO={
 jana:{age:20,description:'Yuna Han, 20, a Korean exchange student in English and Literature, here for one semester from Seoul. Petite, long black hair worn half-up with a ribbon, doe eyes, rosy cheeks. Your roommate.',
  traits:['warm','homesick','reserved','insecure'],style:'Off-shoulder blouses, pastel midi skirts, ribbons; soft pinks and whites.',goal:'Work out whether the life her parents planned for her is the one she wants.',
  voice:'Easy and warm, slightly formal English with the odd Korean word. Deflects with a joke when something is close to the bone.',
  backstory:'Grew up on Jeju, the island off Korea\'s southern tip, then moved to Seoul with her best friend Jisoo. Her parents have the next ten years planned for her: a job at her father\'s firm, a nice boy from church, a flat near them. They fought when she chose a semester abroad, and that fight is not over.'},
 nova:{age:20,description:'Haruka "Ruka" Mori, 20, a Japanese-American film major who plays guitar in a garage band. Short black bob with blunt bangs, dark brown eyes, gold hoops, a grin that means trouble.',
  traits:['guarded','mischievous','creative','rebellious'],style:'Black leather jacket over a white camisole, skinny jeans, boots; chains on a bad day.'},
 abigail:{age:20,description:'Min-ji Park, 20, a Korean-American systems-engineering major and campus skater. Platinum-blonde bob with dark roots, silver cross earrings, athletic build.',
  traits:['analytical','adventurous','practical','competitive'],style:'Cropped denim jacket, crop tops, cargo pants; a sneaker for every mood.'}};
// Exact phrases, applied before the id/name rename. Order matters where one phrase contains another.
const PHRASES=[
 ['"Can I tell you something stupid? I have not said Dominik\'s name in a week without turning it into a joke."','"Can I tell you something stupid? I have not talked about home in a week without turning it into a joke."'],
 ['she called Dominik, and it was hers to make','she called her parents, and it was hers to make'],['the way Dominik always did','the way the boys back home always did'],
 ['who sides with Dominik','who sides with her parents'],['people who pick sides about Dominik','people who pick sides about home'],['people-who-pick-sides-about-dominik','people-who-pick-sides-about-home'],
 ['Ask how Dominik is','Ask how things are at home'],['about Dominik','about home'],['jana-dominik','jana-home'],
 ['Franzbrötchen','hotteok'],['the westernmost North Sea island','the island off Korea\'s southern tip'],['Borkum','Jeju'],['Hamburg','Seoul'],['Lena','Jisoo'],
 ['in German','in Korean'],['German film','Korean film'],['freckles crinkling','eyes crinkling into crescents'],
 ['the red and black in her hair all over your pillow','her black bob a mess against your pillow'],
 ['nudges her glasses up with one knuckle','tucks a platinum strand behind one ear'],['glasses slipping down','earrings swinging'],
 ['She pushes her glasses up with a chalky finger and leaves a white smudge on her nose.','She shoves her bleached fringe back with a chalky finger and leaves a white smudge on her forehead.'],
 ['She pushes her glasses up her nose.','She tugs one silver earring, a tell.'],['pushes her glasses up and takes a breath','tugs one silver earring and takes a breath'],
 ['Her glasses have gone crooked and she does not fix them.','Her bob has gone wild and she does not fix it.'],['with her glasses still on','with her sneakers still on'],
 ['glasses on, hands in her lap','sneakers still on, hands in her lap'],['Her glasses are on the nightstand and she is squinting at you and laughing about it, warm and freckled everywhere','Her sneakers are somewhere across the room and she is laughing about it, warm everywhere'],
 ['glasses-less and determined','bleached hair in her eyes and determined'],['you noticed the new glasses','you noticed the new earrings'],
 ['Kaylee crying at everyone','half your floor crying at everyone'],['Four women, one warm friend, and','Three women and']];
const SLUGS={dominik:'home',glasses:'earrings'};
const LEFTOVER=/monique|kaylee|dominik|glasses|freckle|german|hamburg|borkum|franzbr|\blena\b|swedish|sinclair|newton|messerschmidt|pixie|assets\/campus\/(?:jana|nova|abigail)|\bjana\b|\bnova\b|\babigail\b|four women|warm friend/i;

const gone=x=>x&&typeof x==='object'&&[x.character,x.actor,x.id,x.observer,x.trigger?.match?.observer,x.match?.character].some(v=>DROP.includes(v)||typeof v==='string'&&DROP.some(d=>v.startsWith(`${d}-`)));
const prune=o=>Array.isArray(o)?o.filter(x=>!DROP.includes(x)&&!gone(x)).map(prune):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).filter(([k])=>!DROP.includes(k)).map(([k,v])=>[k,prune(v)])):o;
const names=s=>Object.entries(RENAME).reduce((t,[o,[id,n]])=>t.replace(new RegExp(`\\b${o}\\b`,'g'),id).replace(new RegExp(`\\b${o[0].toUpperCase()+o.slice(1)}\\b`,'g'),n),s);
const slugs=s=>Object.entries(SLUGS).reduce((t,[a,b])=>t.replace(new RegExp(`(^|-)${a}(?=-|$)`,'g'),`$1${b}`),s);
const text=s=>names(PHRASES.reduce((t,[a,b])=>t.split(a).join(b),/^[a-z0-9-]+$/.test(s)?slugs(s):s));
const deep=o=>typeof o==='string'?text(o):Array.isArray(o)?o.map(deep):o&&typeof o==='object'?Object.fromEntries(Object.entries(o).map(([k,v])=>[names(k),deep(v)])):o;

export function reskin(campus){
 let p=prune(structuredClone(campus));
 const LORE_ENTRIES={
 yuna:[{id:'yuna-jeju',text:'Jeju is volcanic, windy, and full of tangerine groves; she misses the sea smell most.',keys:['jeju','island','home'],scope:'character',character:'yuna',knownBy:['yuna']},{id:'yuna-jisoo',text:'Jisoo is her best friend from Jeju; they share a chat that never sleeps.',keys:['jisoo','friend','best friend'],scope:'character',character:'yuna',knownBy:['yuna']},{id:'yuna-parents',text:'Her parents mapped out the next decade: firm job, church boyfriend, nearby flat.',keys:['parents','plan','church','boyfriend'],scope:'character',character:'yuna',knownBy:['yuna']},{id:'yuna-hotteok',text:'Hotteok are sweet pancakes stuffed with brown sugar and nuts; cinnamon rolls are the closest thing here.',keys:['hotteok','food','cinnamon roll'],scope:'character',character:'yuna',knownBy:['yuna']},{id:'yuna-volleyball',text:'She grew up playing beach volleyball on Jeju; the sand court behind the fields feels like home.',keys:['volleyball','beach','hewett','sport'],scope:'character',character:'yuna',knownBy:['yuna']},{id:'yuna-roommate',text:'They share an apartment off campus; she leaves surfboard wax on the windowsill.',keys:['roommate','apartment','surfboard'],scope:'character',character:'yuna',knownBy:['yuna']}],
 haruka:[{id:'haruka-film',text:'Her thesis film is eleven seconds of usable footage; one second is her thumb.',keys:['film','thesis','footage'],scope:'character',character:'haruka',knownBy:['haruka']},{id:'haruka-band',text:'She plays guitar in a garage band that practices in someone\'s basement.',keys:['band','guitar','music','basement'],scope:'character',character:'haruka',knownBy:['haruka']},{id:'haruka-family',text:'Raised in a strict conservative family; her punk style is a deliberate answer to it.',keys:['family','conservative','strict','punk'],scope:'character',character:'haruka',knownBy:['haruka']},{id:'haruka-cider',text:'She loves cider and vinyl; the film society runs on enthusiasm more than budget.',keys:['cider','vinyl','film society'],scope:'character',character:'haruka',knownBy:['haruka']},{id:'haruka-horror',text:'Old horror films are her comfort watch; she mouths every line along with the screen.',keys:['horror','movie','screening'],scope:'character',character:'haruka',knownBy:['haruka']},{id:'haruka-cute',text:'Being called cute is the fastest way to make her bristle; she hates it.',keys:['cute','tease','nickname'],scope:'character',character:'haruka',knownBy:['haruka']}],
 minji:[{id:'minji-kayak',text:'Her senior project is a solar kayak; she needs it in the water before term ends.',keys:['kayak','solar','project','senior','engineering'],scope:'character',character:'minji',knownBy:['minji']},{id:'minji-climbing',text:'She spends more hours at the climbing wall than anywhere else; belays are her love language.',keys:['climbing','wall','belay','hewett'],scope:'character',character:'minji',knownBy:['minji']},{id:'minji-skater',text:'Campus skater with a platinum-blonde bob, silver cross earrings, and a sneaker for every mood.',keys:['skater','skate','earrings','sneaker'],scope:'character',character:'minji',knownBy:['minji']},{id:'minji-puzzles',text:'She likes puzzles, technical projects, and spontaneous outings; hates vague answers and drama.',keys:['puzzle','project','technical','drama'],scope:'character',character:'minji',knownBy:['minji']},{id:'minji-lab',text:'The engineering lab is her second home; control loops are like gossip to her.',keys:['lab','engineering','control','drone'],scope:'character',character:'minji',knownBy:['minji']},{id:'minji-hike',text:'Low tide at 7:40, sandwiches, a thermos, and a sea cave only reachable for two hours.',keys:['hike','tide','cave','coast','date'],scope:'character',character:'minji',knownBy:['minji']}]
};

if(p.characterSheets)p.characterSheets=p.characterSheets.filter(s=>!DROP.includes(s.actorId)).map(s=>{const bio=BIO[s.actorId];if(bio){Object.assign(s.source.actor,bio);s.personality.traits=[...bio.traits];s.personality.notes=s.personality.notes.split('\n').filter(n=>bio.traits.includes(n)).join('\n');s.dating.body=Object.fromEntries(Object.entries(BODY[s.actorId]).map(([r,[sensitivity,limit]])=>[r,{sensitivity,limit}]));s.dating.limitsNotes=LIMITS_NOTES[s.actorId];for(const [field,section,key] of [['age','identity','age'],['description','appearance','description'],['style','appearance','style'],['voice','personality','voice'],['goal','arc','goal'],['backstory','lore','backstory']])if(bio[field]!==undefined)s[section][key]=bio[field];s.lore.entries=(LORE_ENTRIES[RENAME[s.actorId]?RENAME[s.actorId][0]:s.actorId]||[]).map(e=>({...e}));}return s;});
 p.actors=p.actors.map(a=>BIO[a.id]?{...a,...BIO[a.id]}:a);
 p=deep(p);
 Object.assign(p,{id:`${campus.id}-trio`,title:`${campus.title}: Yuna, Haruka and Min-ji`});
  const allLore=Object.values(LORE_ENTRIES).flat();
  p.lorebook=[...(p.lorebook||[]),...allLore.map(e=>({...e}))];
 for(const a of p.actors)if(Object.values(RENAME).some(([id])=>id===a.id)){const dir=`assets/characters/${a.id}`;a.portrait=`${dir}/expressions/neutral.png`;a.poses=EXPRESSIONS.map(e=>({id:e,image:`${dir}/expressions/${e}.png`}));}
 // New art has no talk/date/kiss CGs yet; the night uses the generated scene.
 for(const f of p.firsts){if(f.rung==='night')f.cg=`assets/characters/${f.character}/scenes/${NIGHT_CG[f.character]}.png`;else delete f.cg;}
 for(const s of p.characterSheets||[]){const a=p.actors.find(a=>a.id===s.actorId);if(Object.values(RENAME).some(([id])=>id===s.actorId)){for(const target of [s.appearance,s.source.actor]){target.portrait=a.portrait;target.poses=structuredClone(a.poses);}}for(const f of s.source.profiles.firsts||[]){if(f.rung==='night')f.cg=`assets/characters/${f.character}/scenes/${NIGHT_CG[f.character]}.png`;else delete f.cg;}}
 const bad=[];(function walk(o,path){if(typeof o==='string'){if(LEFTOVER.test(o))bad.push(`${path}: ${o.slice(0,120)}`);}else if(o&&typeof o==='object')for(const [k,v] of Object.entries(o)){if(LEFTOVER.test(k))bad.push(`${path}.${k} (key)`);walk(v,`${path}.${k}`);}})(p,'');
 if(bad.length)throw new Error(`old cast survives the reskin:\n${bad.join('\n')}`);
 return p;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=new URL('../',import.meta.url),p=reskin(JSON.parse(readFileSync(new URL('packs/campus.json',root))));
 writeFileSync(new URL('packs/campus-trio.json',root),JSON.stringify(p,null,2)+'\n');
 copyFileSync(new URL('packs/director/campus.json',root),new URL('packs/director/campus-trio.json',root)); // director beats are cast-agnostic
 console.log(`wrote packs/campus-trio.json: ${p.actors.map(a=>a.id).join(', ')}`);
}
