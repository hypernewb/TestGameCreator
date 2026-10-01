// Derives the three-heroine campus (Yuna, Haruka, Min-ji; owner call 2026-10-01) from packs/campus.json, so tuning on the
// campus keeps flowing in: rerun `node scripts/reskin-campus.mjs` after campus.json changes. Personalities are reskinned
// (Jana→Yuna torn/slow, Nova→Haruka prickly/medium, Abigail→Min-ji practical/bold); Monique and Kaylee are cut, and
// Jana's ex Dominik becomes Yuna's family plan back home. Fails if any old-cast detail survives.
import {readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const DROP=['monique','kaylee'],RENAME={jana:['yuna','Yuna'],nova:['haruka','Haruka'],abigail:['minji','Min-ji']};
export const EXPRESSIONS=['neutral','smile','concerned','frustrated','embarrassed','smug','surprised'];
const NIGHT_CG={yuna:'missionary',haruka:'missionary',minji:'cowgirl'};
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
 if(p.characterSheets)p.characterSheets=p.characterSheets.filter(s=>!DROP.includes(s.actorId)).map(s=>{const bio=BIO[s.actorId];if(bio){Object.assign(s.source.actor,bio);s.personality.traits=[...bio.traits];s.personality.notes=s.personality.notes.split('\n').filter(n=>bio.traits.includes(n)).join('\n');for(const [field,section,key] of [['age','identity','age'],['description','appearance','description'],['style','appearance','style'],['voice','personality','voice'],['goal','arc','goal'],['backstory','lore','backstory']])if(bio[field]!==undefined)s[section][key]=bio[field];}return s;});
 p.actors=p.actors.map(a=>BIO[a.id]?{...a,...BIO[a.id]}:a);
 p=deep(p);
 Object.assign(p,{id:`${campus.id}-trio`,title:`${campus.title}: Yuna, Haruka and Min-ji`});
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
