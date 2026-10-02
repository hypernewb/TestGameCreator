import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {phone,messages} from '../public/campus.mjs';
const src=readFileSync(new URL('../public/play.mjs',import.meta.url),'utf8'),css=readFileSync(new URL('../public/play.css',import.meta.url),'utf8');
const pack={actors:['a','b','c','d','e'].map(id=>({id,name:id})),locations:[]},msg=(id,tick,read=true)=>({id,text:id,tick,read});
test('hub and panel group unread first, then newest thread, without mutating state',()=>{
 const state={modules:{'social.phone':{threads:{a:[msg('a',100)],b:[msg('b',5,false)],c:[msg('c',20,false)],d:[msg('d',90)],e:[msg('e1',1,false),msg('e2',2,false)]}}}},before=JSON.stringify(state);
 assert.deepEqual(phone(state,pack).map(t=>t.character),['c','b','e','a','d']);assert.deepEqual(messages(state,pack).threads.map(t=>t.character),['c','b','e','a','d']);assert.equal(messages(state,pack).unread,4);assert.equal(JSON.stringify(state),before);
});
test('empty and equal-tick threads agree in both views',()=>{
 const state={modules:{'social.phone':{threads:{b:[msg('b',2)],a:[msg('a',2)],c:[]}}}};
 assert.deepEqual(phone(state,pack).map(t=>t.character),messages(state,pack).threads.map(t=>t.character));assert.equal(phone(state,pack).length,2);assert.deepEqual(messages({modules:{}},pack),{unread:0,threads:[]});
});
const node=(tag,text,cls)=>({tag,textContent:text,className:cls,children:[],attrs:{},append(...xs){this.children.push(...xs);},prepend(...xs){this.children.unshift(...xs);},replaceChildren(...xs){this.children=xs;},setAttribute(k,v){this.attrs[k]=v;},showModal(){this.open=true;}});
function panel(threads){
 const nodes=new Map(),$=s=>{if(!nodes.has(s))nodes.set(s,node('div'));return nodes.get(s);},calls=[],state={campaignId:'one',tick:200,modules:{'social.phone':{threads}}},current={state,pack,actions:[]};
 const ctx=vm.createContext({current,messages,$,el:node,busy:false,act:r=>calls.push(r),timeCost:()=>({display:'free'}),costLabel:x=>x,document:{createElementNS:(_,tag)=>node(tag)}});
 vm.runInContext(src.slice(src.indexOf('let msgThread='),src.indexOf('function showJournal()')),ctx);return {ctx,$,calls,current,run:s=>vm.runInContext(s,ctx),log:()=>$('#messages-log').children};
}
test('long logs start at newest 50 and show older locally per thread',()=>{
 const p=panel({a:Array.from({length:121},(_,i)=>msg(`a${i}`,i)),b:Array.from({length:51},(_,i)=>msg(`b${i}`,i))});p.run('openMessages("a")');
 assert.equal(p.log().filter(n=>n.tag==='article').length,50);assert.equal(p.log()[0].children[0].textContent,'a120');assert.equal(p.log()[49].children[0].textContent,'a71');
 const older=()=>p.log().find(n=>n.className==='messages__older');assert.equal(older().textContent,'Show older');older().onclick();assert.equal(p.log().filter(n=>n.tag==='article').length,100);older().onclick();assert.equal(p.log().length,121);assert.equal(older(),undefined);
 p.run('openMessages("b")');assert.equal(p.log().filter(n=>n.tag==='article').length,50);p.run('openMessages("a")');assert.equal(p.log().length,121);assert.equal(p.calls.length,0);
});
test('short and empty threads need no older button; campaign reset forgets expansion',()=>{
 const p=panel({a:Array.from({length:50},(_,i)=>msg(`a${i}`,i))});p.run('openMessages("a")');assert.equal(p.log().length,50);
 p.current.state.modules['social.phone'].threads.a.push(msg('a50',50));p.run('renderMessages()');assert.equal(p.log().length,51);p.log().at(-1).onclick();assert.equal(p.log().length,51);assert.equal(p.log().at(-1).tag,'article');
 const reset=src.match(/if\(s\.campaignId!==msgCampaign\)\{[^\n]+\}/)?.[0];assert.ok(reset);p.ctx.s={campaignId:'two'};p.run(reset);p.run('openMessages("a")');assert.equal(p.log().filter(n=>n.tag==='article').length,50);
 p.current.state.modules['social.phone'].threads={};p.run('openMessages()');assert.equal(p.log()[0].textContent,'Pick a conversation.');assert.equal(p.$('#messages-reply').hidden,true);
});
test('nav uses a decorative phone symbol from the sprite',()=>{
 const p=panel({});p.run('messageIcon()');const svg=p.$('[data-action=messages]').children[0];assert.equal(svg.tag,'svg');assert.equal(svg.attrs['aria-hidden'],'true');assert.equal(svg.children[0].attrs.href,'assets/showcase/ui-icons.svg#phone');
 const sprite=readFileSync(new URL('../assets/showcase/ui-icons.svg',import.meta.url),'utf8');assert.match(sprite,/<symbol[^>]+id="phone"/);assert.match(sprite,/stroke="currentColor"/);
});
test('phone CSS constrains gutters, tracks, and long content',()=>{
 assert.match(css,/\.messages-panel\{[^}]*box-sizing:border-box/);assert.match(css,/\.messages-panel\{[^}]*padding:16px/);assert.match(css,/\.messages-panel\{[^}]*overflow:hidden auto/);assert.match(css,/\.messages__threads[^}]*overflow-wrap:anywhere/);assert.match(css,/\.hub__phone\{[^}]*minmax\(0,1fr\)/);assert.match(css,/\.messages__compose input\{[^}]*box-sizing:border-box/);
});
