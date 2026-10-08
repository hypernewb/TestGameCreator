import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {wornSetOf as packWorn} from '../packages/assets/character-sprites.mjs';
import {wornSetOf,wornImageOf,undressedOf} from '../public/wardrobe.mjs';
const ada={id:'ada',outfitSets:{casual:['tunic'],swim:['bikini']},outfitRules:[{set:'swim',location:'beach'},{set:'casual',daypart:'Evening'},{set:'default',undressed:'no'}],poses:[{id:'neutral',image:'ada.png'},{id:'casual-neutral',image:'casual.png'},{id:'casual-smile',image:'casual-smile.png'}]};

test('browser wardrobe picks the same set as the packages copy across contexts',()=>{
 for(const ctx of [{},{daypart:'Evening'},{daypart:'Morning'},{location:'beach'},{location:'beach',daypart:'Evening'},{undressed:true},{undressed:true,location:'beach'},{stage:'exclusive'}])
  assert.equal(wornSetOf(ada,ctx),packWorn(ada,ctx),JSON.stringify(ctx));
 assert.equal(wornSetOf(null,{}),'default');
});

test('outfit image comes from the actor pose named set-emotion; dressed default and missing poses fall back',()=>{
 assert.equal(wornImageOf(ada,'neutral',{daypart:'Evening'}),'casual.png');
 assert.equal(wornImageOf(ada,'smile',{daypart:'Evening'}),'casual-smile.png');
 assert.equal(wornImageOf(ada,undefined,{daypart:'Evening'}),'casual.png');
 assert.equal(wornImageOf(ada,'frustrated',{daypart:'Evening'}),undefined);
 assert.equal(wornImageOf(ada,'neutral',{daypart:'Morning'}),undefined);
 assert.equal(wornImageOf(ada,'neutral',{location:'beach',daypart:'Evening'}),undefined);
});

test('undressed means an active or pending intimate scene for that character only',()=>{
 const s={modules:{'social.intimacy':{characters:{ada:{active:{category:'fling'},pendingAftercare:null},bo:{active:null,pendingAftercare:{category:'fling'}},cy:{active:null,pendingAftercare:null}}}}};
 assert.equal(undressedOf(s,'ada'),true);assert.equal(undressedOf(s,'bo'),true);assert.equal(undressedOf(s,'cy'),false);assert.equal(undressedOf(s,'nobody'),false);
 assert.equal(undressedOf({modules:{}},'ada'),false);
});

test('the play-time stage consults wardrobe for every visible character',()=>{
 const src=readFileSync(new URL('../public/vn.mjs',import.meta.url),'utf8');
 assert.match(src,/wornImageOf\(actor,poses\[id\],ctxOf\(actor\)\)\|\|actor\.poses/);
 assert.match(src,/syncSprites\(slots,present,poses,a=>\(\{daypart:calendarFor\(s\.tick,p\)\.daypart/);
});
