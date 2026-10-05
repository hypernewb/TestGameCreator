import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPortrait} from '../public/character-media.mjs';
class Element{constructor(tag,doc){this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.isConnected=true;}append(...xs){this.children.push(...xs);}setAttribute(k,v){this[k]=v;}}
const doc={createElement:tag=>new Element(tag,doc)};
test('retired actor forms and intervening portrait selections cannot accept an upload',async()=>{
 const oldBitmap=globalThis.createImageBitmap,oldReader=globalThis.FileReader,oldDocument=globalThis.document;globalThis.document=doc;let resolveUpload,active=true;
 doc.createElement=tag=>{const e=new Element(tag,doc);if(tag==='canvas'){e.getContext=()=>({clearRect(){},drawImage(){},getImageData:()=>({data:new Uint8Array([0,0,0,0])})});e.toBlob=fn=>fn({size:1});}return e;};globalThis.createImageBitmap=async()=>({width:4,height:4,close(){}});globalThis.FileReader=class{readAsDataURL(){this.result='data:image/png;base64,fixture';this.onload();}};
 try{for(const retire of ['actor','selection']){active=true;const actor={id:'ada',name:'Ada'},other={id:'bea',name:'Bea'},root=new Element('div',doc),box=mountPortrait(root,{actor,active:()=>active,onChange:()=>assert.fail('Stale upload applied'),upload:()=>new Promise(r=>resolveUpload=r)}),input=box.children[2].children.at(-1);input.files=[{type:'image/png',size:1}];const work=input.onchange();while(!resolveUpload)await Promise.resolve();if(retire==='actor')active=false;else actor.portrait='assets/selected.png';resolveUpload('scenario-media/11111111-1111-1111-1111-111111111111.png');await work;assert.equal(other.portrait,undefined);assert.equal(actor.portrait,retire==='selection'?'assets/selected.png':undefined);resolveUpload=null;}}
 finally{globalThis.createImageBitmap=oldBitmap;globalThis.FileReader=oldReader;globalThis.document=oldDocument;}
});
