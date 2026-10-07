import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {CHARACTER_TRAITS,TRAIT_DESCRIPTIONS} from '../packages/ai/character-authoring.mjs';
const source=readFileSync(new URL('../public/studio.mjs',import.meta.url),'utf8');
const fn=name=>{const a=source.indexOf(`function ${name}(`);return source.slice(a,source.indexOf('\n',a));};
const el=tag=>({tag,children:[],dataset:{},value:'',append(...c){this.children.push(...c);},replaceChildren(...c){this.children=c;},focus(){}});
const node=(tag,text)=>Object.assign(el(tag),{textContent:text});
const load=()=>{let msgs=0;const f=new Function('node','message','CHARACTER_TRAITS','TRAIT_DESCRIPTIONS',`${fn('tagChips')}\n${fn('traitPicker')}\nreturn {tagChips,traitPicker};`);return {...f(node,()=>msgs++,CHARACTER_TRAITS,TRAIT_DESCRIPTIONS),msgs:()=>msgs};};

test('Studio character editor follows the Venus sheet: tag chips, trait picker, love life, legacy voice tucked away',()=>{
 const row=source.slice(source.indexOf("rows('Characters',"));const chars=row.slice(0,row.indexOf('o=>[o.name,o.major]'));
 for(const k of ["'appearanceTags'","'outfitTags'","traitPicker(depth,o)","'datingHistory'","'datingPreference'","'kinks'","'isVirgin'","picks(depth,p,o,'likes'","picks(depth,p,o,'dislikes'","'backstory'","'goal'","eroticFold(g,p,o)"])assert.ok(chars.includes(k),k);
 assert.doesNotMatch(chars,/field\(g,o,'voice'|field\(g,o,'style'/);assert.match(chars,/node\('details'\)[^]*Legacy voice fields/);
 assert.doesNotMatch(chars,/campus|venus/i);assert.doesNotMatch(chars,/romance\?|if\(romance|p\.modules\['social\.(dating|intimacy)'\]/,'love life and erotic fields never hide behind modules');
 const {tagChips,traitPicker,msgs}=load(),parent=el('div'),o={appearanceTags:['short_hair']};tagChips(parent,o,'appearanceTags','Appearance tags','');
 const box=parent.children[0].children[1],input=box.children.at(-1);input.value='Green Eyes, freckles';input.onkeydown({key:'Enter',preventDefault(){}});
 assert.deepEqual(o.appearanceTags,['short_hair','green_eyes','freckles']);box.children[0].onclick();assert.deepEqual(o.appearanceTags,['green_eyes','freckles']);
 input.value='';input.onkeydown({key:'Backspace',preventDefault(){}});assert.deepEqual(o.appearanceTags,['green_eyes']);
 const t={traits:['Custom']},p2=el('div');traitPicker(p2,t);const boxes=p2.children[0].children.slice(1).map(l=>l.children[0]);assert.equal(boxes.length,CHARACTER_TRAITS.length);
 boxes[5].checked=true;boxes[5].onchange();boxes[0].checked=true;boxes[0].onchange();assert.deepEqual(t.traits,['Mood-swings','Promiscuous','Custom']);boxes[0].checked=false;boxes[0].onchange();assert.deepEqual(t.traits,['Promiscuous','Custom']);assert.ok(msgs()>=6);
});

test('character generation uses the long authoring output budget, not the chat reply cap',()=>{
 const server=readFileSync(new URL('../server.mjs',import.meta.url),'utf8'),route=server.slice(server.indexOf("path==='/api/studio/ai-character'"));
 assert.match(route.slice(0,route.indexOf('return send(')),/authorProvider\(\)\.complete\(/);assert.match(server,/const authorProvider=[^\n]*maxTokens:8000/);
});
