import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CARD_LISTS,CARD_LIST_KEYS,TROPES,SEX_SLIDERS,listsFor,tropesFor,applyTrope,tropeFromCharacter,splitPicks,tagOf,sexStyleText,blankFields,applyBlanks,BLANK_SECTIONS,validateCardPresets,LOOK_GROUPS} from '../public/card-presets.mjs';
import {fillBlanksMessages,fillBlanksResponseFormat,blanksPatch} from '../packages/ai/fill-blanks.mjs';
import {characterMessages,normalizeCharacter} from '../packages/ai/character-authoring.mjs';
import {validatePack,clone} from '../packages/core/engine.mjs';
import {registry} from '../packages/modules/index.mjs';
const fantasy=JSON.parse(readFileSync(new URL('../packs/template-fantasy-town.json',import.meta.url),'utf8'));
const errs=p=>{const out=[];validateCardPresets(p,m=>out.push(m));return out;};

test('pick lists: built-in defaults, per-pack overrides, emptied lists fall back',()=>{
 const p=clone(fantasy);assert.deepEqual(listsFor(p),Object.fromEntries(CARD_LIST_KEYS.map(k=>[k,[...CARD_LISTS[k]]])));
 p.cardLists={turnOns:['tavern songs','ale on the breath'],kinks:[]};const L=listsFor(p);assert.deepEqual(L.turnOns,['tavern songs','ale on the breath']);assert.deepEqual(L.kinks,[...CARD_LISTS.kinks]);
 for(const k of CARD_LIST_KEYS)assert.ok(CARD_LISTS[k].length>=8,k);assert.ok(TROPES.length>=20);assert.ok(TROPES.some(t=>t.id==='tsundere'));
 const custom={id:'tsundere',name:'Tsundere (ours)'};p.tropes=[custom,{id:'barmaid',name:'Barmaid'}];const ts=tropesFor(p);assert.equal(ts.filter(t=>t.id==='tsundere').length,1);assert.equal(ts.find(t=>t.id==='tsundere'),custom);assert.ok(ts.some(t=>t.id==='barmaid'));
});

test('tropes fill only blank fields and never overwrite authored text',()=>{
 const t=TROPES.find(x=>x.id==='tsundere'),o={name:'Wren Ash',personality:'Wren is mine.',turnOns:['ale'],sexStyle:{loud:10}};
 const did=applyTrope(o,t);
 assert.equal(o.personality,'Wren is mine.');assert.deepEqual(o.turnOns,['ale']);assert.equal(o.sexStyle.loud,10);assert.equal(o.trope,'tsundere');
 assert.ok(!did.includes('personality')&&!did.includes('turnOns'));for(const k of ['turnOffs','kinks','datingPreference','afterSex','sexStyle'])assert.ok(did.includes(k),k);
 assert.equal(typeof o.kinks,'string');assert.equal(o.sexStyle.leads,t.sexStyle.leads);
 const blank={name:'Mira Vale'};applyTrope(blank,t);assert.match(blank.personality,/^Mira is a tsundere/);assert.doesNotMatch(blank.personality,/\{name\}/);
 assert.deepEqual(applyTrope(o,t),[]);
});

test('splitPicks keeps short picks and leaves legacy prose whole; tags normalize',()=>{
 assert.deepEqual(splitPicks('praise kink, brat taming'),['praise kink','brat taming']);assert.deepEqual(splitPicks(''),[]);assert.deepEqual(splitPicks(['a','b']),['a','b']);
 const prose='She dreams of being tied up and teased for hours, slowly, until she begs.';assert.deepEqual(splitPicks(prose),[prose]);
 assert.equal(tagOf(' Wide Hips '),'wide_hips');
 assert.equal(sexStyleText({leads:90,loud:50,rough:20}),'fully dominant, tender');assert.equal(sexStyleText({}),'');
});

test('blank fields per fold; applyBlanks writes blanks only, nested paths included',()=>{
 const o={name:'Wren',personality:'Wren is blunt.',traits:[],behavior:{withFriends:'Around friends, Wren sings.'},sexStyle:{leads:80},outfitSets:{swim:['shift']}};
 assert.deepEqual(blankFields(o,'basics'),['goal','major']);assert.deepEqual(blankFields(o,'looks'),['appearanceTags','outfitTags','description']);assert.ok(blankFields(o,'depth').includes('traits'));assert.ok(!blankFields(o,'depth').includes('behavior/withFriends'));
 const sex=blankFields(o,'sex');assert.ok(!sex.includes('sexStyle/leads')&&sex.includes('sexStyle/loud')&&!sex.includes('outfitSets/swim')&&sex.includes('outfitSets/sleep'));
 const did=applyBlanks(o,{personality:'NO','sexStyle/leads':5,'sexStyle/loud':70,'outfitSets/sleep':['nightgown'],'expressionTags/aroused':['blush'],goal:'Buy the inn.'});
 assert.deepEqual(did.sort(),['expressionTags/aroused','goal','outfitSets/sleep','sexStyle/loud']);assert.equal(o.personality,'Wren is blunt.');assert.equal(o.sexStyle.leads,80);assert.deepEqual(o.expressionTags,{aroused:['blush']});
});

test('validation: pack lists, tropes and slider values; saved tropes always validate',()=>{
 assert.deepEqual(errs(fantasy),[]);
 assert.equal(errs({cardLists:{nope:['x']}}).length,1);assert.equal(errs({cardLists:{turnOns:['x'.repeat(81)]}}).length,1);
 assert.equal(errs({tropes:[{id:'Bad Id',name:'X'}]}).length,1);assert.equal(errs({tropes:[{id:'ok',name:'X',sexStyle:{leads:101}}]}).length,1);assert.equal(errs({actors:[{id:'a',sexStyle:{leads:'high'}}]}).length,1);
 const p=clone(fantasy);p.actors.find(a=>a.id==='ryn').sexStyle={leads:20};p.cardLists={turnOns:['tavern songs']};assert.doesNotThrow(()=>validatePack(p,registry));p.actors.find(a=>a.id==='ryn').sexStyle={leads:2.5};assert.throws(()=>validatePack(p,registry),/sexStyle/);
 const o={name:'Ryn Thorne!!',personality:'Ryn is a smuggler with a soft spot. She lies.',traits:['Promiscuous'],turnOns:Array.from({length:20},(_,i)=>'t'+i).concat('x'.repeat(200)),kinks:'praise kink, brat taming',sexStyle:{leads:70},isVirgin:false};
 const t=tropeFromCharacter(o,{id:'like-'+o.name});assert.match(t.id,/^[a-z0-9][a-z0-9-]*$/);assert.equal(t.personality,'{name} is a smuggler with a soft spot.');assert.equal(t.turnOns.length,12);assert.deepEqual(t.kinks,['praise kink','brat taming']);assert.deepEqual(t.sexStyle,{leads:70});
 assert.deepEqual(errs({tropes:[t]}),[]);const fresh={name:'Kel'};applyTrope(fresh,t);assert.equal(fresh.personality,'Kel is a smuggler with a soft spot.');
});

test('fill blanks: schema covers only blank fields, lists are enums, the card is sent as authored canon (fantasy pack)',()=>{
 const p=clone(fantasy);p.cardLists={turnOns:['tavern songs','ale on the breath','being pinned']};
 const o={name:'Ryn',personality:'Ryn is a smuggler.',turnOns:[],sexStyle:{leads:80},inBed:'She bites.',outfitSets:{}};
 const {messages,schema,blanks}=fillBlanksMessages(p,o,'sex'),text=messages.map(m=>m.content).join('\n');
 assert.ok(blanks.includes('turnOns')&&!blanks.includes('inBed'));assert.deepEqual(schema.properties.turnOns.items.enum,['tavern songs','ale on the breath','being pinned']);assert.ok(schema.properties.turnOnsExtra);
 assert.ok(!schema.properties.inBed);assert.deepEqual(Object.keys(schema.properties.sexStyle.properties),SEX_SLIDERS.map(s=>s[0]).filter(k=>k!=='leads'));assert.deepEqual(schema.required,Object.keys(schema.properties));
 assert.match(text,/Personality: Ryn is a smuggler/);assert.match(text,/In bed: She bites/);assert.match(text,/TURNONS LIST\ntavern songs/);assert.match(text,/erotic/);assert.doesNotMatch(text,/campus|university|venus/i);
 assert.equal(fillBlanksResponseFormat(schema).json_schema.strict,true);
 const raw={turnOns:['being pinned','not on list'],turnOnsExtra:['Warm hands'],sexStyle:{loud:88.6,rough:-4,drive:50,experience:70,adventurous:30},turnOffs:['being laughed at'],turnOffsExtra:[],afterSex:['pillow talk'],afterSexExtra:['a pipe'],bodyTags:['Wide Hips','not a body tag'],bodyTagsExtra:[],underwear:['corset'],underwearExtra:[],sleep:[],sleepExtra:[],swim:[],swimExtra:[],aroused:['blush'],arousedExtra:[],inBed:'IGNORED'};
 const patch=blanksPatch(o,raw,'sex',p);
 assert.deepEqual(patch.turnOns,['being pinned','Warm hands']);assert.equal(patch['sexStyle/loud'],89);assert.equal(patch['sexStyle/rough'],0);assert.equal(patch['sexStyle/leads'],undefined);assert.equal(patch.inBed,undefined);
 assert.equal(patch.afterSex,'pillow talk, a pipe');assert.deepEqual(patch.bodyTags,['wide_hips']);assert.equal(patch['outfitSets/sleep'],undefined);
 assert.deepEqual(applyBlanks(o,patch).includes('turnOns'),true);assert.equal(o.sexStyle.leads,80);assert.equal(o.inBed,'She bites.');
 const full=fillBlanksMessages(p,{...o,personality:'x',goal:'y',major:'z',appearanceTags:['a']},'basics');assert.deepEqual(full.blanks,[]);
 const looks=fillBlanksMessages(p,{name:'Ryn',likes:['ale']},'looks'),lt=looks.messages[1].content;assert.deepEqual(looks.blanks,['appearanceTags','outfitTags','description']);assert.match(lt,/LOOK TAGS: HAIR COLOUR \(prefer these/);assert.match(lt,/OUTFIT TAGS[^\n]*\n.*sundress/);assert.equal(looks.schema.properties.appearanceTags.items.enum,undefined);
});

test('generator steers love-life fields toward the pick lists and returns sex-style sliders',()=>{
 const p=clone(fantasy);p.cardLists={kinks:['being tied with silk rope']};const {messages,schema}=characterMessages(p,'a barmaid'),text=messages.map(m=>m.content).join('\n');
 assert.match(text,/PICK LISTS/);assert.match(text,/being tied with silk rope/);assert.ok(schema.required.includes('sexStyle'));assert.deepEqual(schema.properties.sexStyle.required,SEX_SLIDERS.map(s=>s[0]));
 const raw={name:'Wren Ash',pronouns:'she/her',age:24,appearance:'Freckled.',personality:'Wren is blunt.',backstory:'Ran.',goal:'Buy the inn.',behavior:Object.fromEntries(['withStrangers','withFriends','withCrush','withLover','withEnemy'].map(k=>[k,'Wren grins.'])),sexStyle:{leads:72.4,loud:150,rough:'x'}};
 assert.deepEqual(normalizeCharacter(raw,p).sexStyle,{leads:72,loud:100});assert.equal(normalizeCharacter({...raw,sexStyle:undefined},p).sexStyle,undefined);
});

const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8'),fn=name=>{const a=source.indexOf(`function ${name}(`);assert.ok(a>=0,name);return source.slice(a,source.indexOf('\n',a));};
const dom=()=>{const el=tag=>({tag,children:[],dataset:{},className:'',value:'',append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;}});return (tag,text)=>Object.assign(el(tag),text===undefined?{}:{textContent:text});};
const all=n=>[n,...(n.children||[]).flatMap(all)];

test('Studio pick chips toggle list values, keep custom values, and write text picks as one string',()=>{
 const msgs=[],pickChips=new Function('node','message','splitPicks','tagOf',`${fn('pickChips')}\nreturn pickChips;`)(dom(),m=>msgs.push(m),splitPicks,tagOf);
 const parent=dom()('div'),o={turnOns:['custom thing'],kinks:'praise kink',bodyTags:[]};
 pickChips(parent,o,'turnOns','Turn-ons',['praise','being pinned'],'list');let chips=all(parent).filter(n=>n.dataset?.value);
 assert.deepEqual(chips.map(c=>[c.dataset.value,c.className]),[['praise','chip check'],['being pinned','chip check'],['custom thing','chip check on']]);
 chips[0].onclick();assert.deepEqual(o.turnOns,['custom thing','praise']);chips[2].onclick();assert.deepEqual(o.turnOns,['praise']);
 pickChips(parent,o,'kinks','Kinks',['brat taming'],'text');const k=parent.children.at(-1),input=all(k).find(n=>n.tag==='input');input.value='edging, rope';input.onblur();assert.equal(o.kinks,'praise kink, edging, rope');
 pickChips(parent,o,'bodyTags','Body',['wide_hips'],'tag');const b=parent.children.at(-1),bi=all(b).find(n=>n.tag==='input');bi.value='Navel Piercing';bi.onkeydown({key:'Enter',preventDefault(){}});assert.deepEqual(o.bodyTags,['navel_piercing']);assert.equal(b.dataset.pickKey,'bodyTags');
 assert.ok(msgs.length>=4);
 // shared lists: a getter for options, custom values offered to the project list, keep() hides values owned by another group
 const shared=[],L=['red_hair'],q={appearanceTags:['red_hair','long_hair','glasses']},g=dom()('div');pickChips(g,q,'appearanceTags','Hair colour',()=>L,'tag',vs=>{shared.push(...vs);L.push(...vs);},v=>L.includes(v));
 const box=g.children[0];assert.deepEqual(all(box).filter(n=>n.dataset?.value).map(n=>n.dataset.value),['red_hair']);const gi=all(box).find(n=>n.tag==='input');gi.value='Teal Hair';gi.onkeydown({key:'Enter',preventDefault(){}});
 assert.deepEqual(shared,['teal_hair']);assert.deepEqual(q.appearanceTags,['red_hair','long_hair','glasses','teal_hair']);assert.match(gi.placeholder,/every card/);
});

test('Studio shared pick lists and grouped looks: custom picks join pack.cardLists, every look tag shows once',()=>{
 const shareTo=new Function('listsFor','tagOf',`${source.match(/const shareTo=.*;\n/)[0]}return shareTo;`)(listsFor,tagOf),p={};
 shareTo(p,'turnOns')(['moonlight','praise','moonlight']);assert.deepEqual(p.cardLists.turnOns,[...CARD_LISTS.turnOns,'moonlight']);
 shareTo(p,'lookHairColor',true)(['Teal Hair']);assert.equal(listsFor(p).lookHairColor.at(-1),'teal_hair');shareTo(p,'outfit',true)(['jeans']);assert.equal(p.cardLists.outfit,undefined);
 assert.equal(LOOK_GROUPS.length,6);for(const [k] of LOOK_GROUPS)assert.ok(CARD_LISTS[k].length>=8,k);
 const tags=LOOK_GROUPS.flatMap(([k])=>CARD_LISTS[k]);for(const t of ['petite','pale_skin','freckles'])assert.ok(tags.includes(t)&&!CARD_LISTS.bodyTags.includes(t),t);
 const calls=[],lookChips=new Function('pickChips','listsFor','tagOf','shareTo','LOOK_GROUPS',`${fn('lookChips')}\nreturn lookChips;`)((...a)=>calls.push(a),listsFor,tagOf,()=>()=>{},LOOK_GROUPS);
 const o={appearanceTags:['long_hair','teal_hair','cyber_arm']};lookChips(dom()('div'),p,o);assert.deepEqual(calls.map(c=>c[3]),[...LOOK_GROUPS.map(([,l])=>l),'Other look tags (this card only)']);assert.ok(calls.every(c=>c[2]==='appearanceTags'&&c[1]===o&&c[5]==='tag'));
 const other=calls.at(-1)[7];assert.deepEqual(o.appearanceTags.filter(other),['cyber_arm']);assert.equal(calls[0][7]('long_hair'),false);
});

test('Studio sex-style slider: unset until moved, clear removes the value',()=>{
 const sliderRow=new Function('node','message',`${fn('sliderRow')}\nreturn sliderRow;`)(dom(),()=>{}),o={};
 const row=sliderRow(dom()('div'),o,SEX_SLIDERS[0]),r=row.children.find(n=>n.tag==='input'),val=row.children.find(n=>n.tag==='small'),clear=row.children.find(n=>n.tag==='button');
 assert.equal(row.dataset.slider,'leads');assert.equal(r.className,'style-slider unset');assert.equal(val.textContent,'not set');
 r.value='75';r.oninput();assert.equal(o.leads,75);assert.equal(r.className,'style-slider');clear.onclick();assert.equal('leads' in o,false);
});

test('Studio trope picker and fill-blanks button: blanks only, AI call per fold, nothing hardcoded to one world',()=>{
 const msgs=[];let renders=0;const opt=(sel,v,l)=>sel.append({value:v,label:l});
 const field=(parent,obj,key,label)=>{const n=dom()('input');n.dataset.key=key;parent.append(n);return n;};const tropePicker=new Function('node','option','message','render','tropesFor','applyTrope','tropeFromCharacter','field','hint',`${fn('tropePicker')}\nreturn tropePicker;`)(dom(),opt,m=>msgs.push(m),()=>renders++,tropesFor,applyTrope,tropeFromCharacter,field,i=>i);
 const p={tropes:[{id:'barmaid',name:'Sharp barmaid',personality:'{name} pours and teases.'}]},o={name:'Ryn',personality:'Ryn is mine.'},w=tropePicker(dom()('div'),p,o),sel=w.children.find(n=>n.tag==='select');
 assert.ok(sel.children.some(c=>c.value==='barmaid'));sel.value='barmaid';sel.onchange();w.children.find(n=>n.dataset.action==='apply-trope').onclick();assert.equal(o.personality,'Ryn is mine.');assert.equal(o.trope,'barmaid');assert.match(msgs.at(-1),/nothing blank to fill/);
 const manage=w.children.find(n=>n.className==='trope-manage'),edit=manage.children.find(n=>n.className?.includes('trope-edit'));assert.ok(edit,'own trope is editable in place');assert.deepEqual(all(edit).filter(n=>n.dataset?.key).map(n=>n.dataset.key),['name','blurb','personality']);
 all(edit).find(n=>n.dataset?.action==='remove-trope').onclick();assert.equal(p.tropes,undefined);
 const keep={...p,tropes:[]};const w2=tropePicker(dom()('div'),keep,o);all(w2).find(n=>n.dataset?.action==='save-trope').onclick();assert.equal(keep.tropes[0].id,'like-'+o.id);assert.equal(o.trope,'like-'+o.id);p.tropes=[{id:'barmaid',name:'Sharp barmaid',personality:'{name} pours and teases.'}];
 const calls=[];const fb=new Function('node','message','fail','render','api','blankFields','applyBlanks',`${fn('fillBlanksButton')}\nreturn fillBlanksButton;`)(dom(),m=>msgs.push(m),e=>{throw e;},()=>renders++,async(path,body)=>{calls.push([path,body.section]);return {patch:{goal:'Own the inn.',personality:'NO'}};},blankFields,applyBlanks);
 return (async()=>{const b=fb(dom()('div'),p,o,'basics');assert.equal(b.dataset.section,'basics');await b.onclick();assert.deepEqual(calls,[['/api/studio/ai-fill-blanks','basics']]);assert.equal(o.goal,'Own the inn.');assert.equal(o.personality,'Ryn is mine.');assert.equal(b.disabled,false);
  const done={personality:'a',goal:'b',major:'c',appearanceTags:['d']};await fb(dom()('div'),p,done,'basics').onclick();assert.equal(calls.length,1);assert.equal(msgs.at(-1),'Nothing blank here.');
  for(const n of ['pickChips','sliderRow','tropePicker','fillBlanksButton','lookChips'])assert.doesNotMatch(fn(n),/campus|venus|university|dorm/i,n);
  const row=source.slice(source.indexOf("field(g,o,'name','Name');tropePicker(g,p,o);"),source.indexOf("rows('Lore entries'"));for(const s of ["fillBlanksButton(g,p,o,'basics')","fillBlanksButton(looks,p,o,'looks')","fillBlanksButton(depth,p,o,'depth')","fillBlanksButton(love,p,o,'love')","picks(love,p,o,'kinks'","lookChips(looks,p,o)","picks(depth,p,o,'likes'"])assert.ok(row.includes(s),s);assert.doesNotMatch(source,/cardPresetEditor|'Look \(tags\)'|Likes \(one per line\)/);assert.match(source,/tropeFromCharacter\(o,\{id:'like-'\+o\.id\}\)/);
 })();
});

test('Fill blanks sees the other cast, never the player, so new cards are not twins',()=>{
 const p=clone(fantasy),o={id:'new-one',name:'Sel'},others=p.actors.filter(a=>a.id!==p.playerId),text=fillBlanksMessages(p,o,'basics').messages[1].content;
 assert.match(text,/OTHER CAST/);for(const a of others)assert.ok(text.includes(a.name),a.name);assert.ok(!text.includes('- '+p.actors.find(a=>a.id===p.playerId).name+' |'));
 assert.doesNotMatch(fillBlanksMessages({actors:[o]},o,'basics').messages[1].content,/OTHER CAST/);
});

test('Fill all blanks on this card: one call per fold with blanks, in order, later folds see earlier fills',async()=>{
 const msgs=[],calls=[];let renders=0;const fa=new Function('node','message','render','api','blankFields','applyBlanks','BLANK_SECTIONS',`${fn('fillAllButton')}\nreturn fillAllButton;`)(dom(),m=>msgs.push(m),()=>renders++,async(path,body)=>{calls.push([body.section,body.actor.goal||'']);if(body.section==='love')throw Error('timeout');return {patch:body.section==='basics'?{goal:'Own the inn.'}:{}};},blankFields,applyBlanks,BLANK_SECTIONS);
 const o={name:'Ryn',personality:'Ryn is mine.'},b=fa(dom()('div'),{},o);assert.equal(b.dataset.action,'fill-all-blanks');await b.onclick();
 assert.deepEqual(calls.map(c=>c[0]),['basics','looks','depth','love','sex']);assert.equal(calls[1][1],'Own the inn.');assert.equal(o.personality,'Ryn is mine.');assert.equal(renders,1);assert.match(msgs.at(-1),/Filled 1 blank\..*Failed: love: timeout/);assert.equal(b.disabled,false);
 assert.match(source,/tropePicker\(g,p,o\);fillAllButton\(g,p,o\)/);assert.doesNotMatch(fn('fillAllButton'),/campus|venus|p\.actors/i);
});

test('Fill blanks endpoint retries once with feedback when the answer parses but nothing is usable',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createApp}=await import('../server.mjs'),{CompatibleProvider}=await import('../packages/ai/providers.mjs');
 const dir=mkdtempSync(join(tmpdir(),'fill-retry-')),bodies=[];const fetchImpl=async(url,init)=>{bodies.push(init.body);const value=bodies.length===1?{personality:'',goal:'',major:''}:{personality:'Ryn is a tease.',goal:'Buy the inn.',major:'barmaid'};return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(value)},finish_reason:'stop'}]}),{status:200,headers:{'Content-Type':'application/json'}});};
 const provider=new CompatibleProvider({endpoint:'http://127.0.0.1:1234/v1/chat/completions',model:'stub',fetchImpl,maxTokens:2048}),app=createApp({dataPath:':memory:',scenarioDir:dir,provider});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 try{const r=await fetch(`http://127.0.0.1:${app.server.address().port}/api/studio/ai-fill-blanks`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pack:fantasy,actor:{id:'x',name:'Ryn'},section:'basics'})}),j=await r.json();
  assert.equal(r.status,200);assert.equal(bodies.length,2);assert.match(bodies[1],/Nothing usable came back/);assert.deepEqual(j.filled.sort(),['goal','major','personality']);
 }finally{await new Promise(r=>app.server.close(r));app.store.close();rmSync(dir,{recursive:true,force:true});}
});
