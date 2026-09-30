import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateSync} from 'node:zlib';
import {decodePng,encodePng,cropImage,isCutout,profileBox} from '../packages/assets/png.mjs';

// A 100x200 cut sprite: transparent background, a 20px-wide head at rows 30-60 centred on x=50, a 60px-wide body below.
const sprite=()=>{const w=100,h=200,data=Buffer.alloc(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const o=(y*w+x)*4;data[o]=x;data[o+1]=y;data[o+2]=7;
 data[o+3]=(y>=30&&y<60&&x>=40&&x<60)||(y>=60&&x>=20&&x<80)?255:0;}return {width:w,height:h,data};};

test('PNG encode/decode round-trips RGBA, and decodes filtered RGB',()=>{
 const img=sprite(),back=decodePng(encodePng(img));assert.equal(back.width,100);assert.equal(back.height,200);assert.ok(back.data.equals(img.data));
 const chunk=(t,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4,'latin1');d.copy(b,8);return b;},ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(2,0);ihdr.writeUInt32BE(2,4);ihdr[8]=8;ihdr[9]=2;
 const raw=Buffer.from([1,10,20,30,5,5,5, 2,1,1,1,2,2,2]);// row 0 Sub filter, row 1 Up filter
 const rgb=decodePng(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
 assert.deepEqual([...rgb.data],[10,20,30,255,15,25,35,255,11,21,31,255,17,27,37,255]);assert.throws(()=>decodePng(Buffer.from('nope')),/Not a PNG/);
});

test('isCutout spots transparency; profileBox squares the head with headroom and crops inside the image',()=>{
 const img=sprite();assert.equal(isCutout(img),true);assert.equal(isCutout({...img,data:Buffer.alloc(img.data.length,255)}),false);
 const box=profileBox(img);assert.deepEqual(box,{x:30,y:27,size:38});assert.ok(box.y<30&&box.y+box.size>60);assert.ok(box.x>=0&&box.x+box.size<=100);
 const crop=cropImage(img,{x:40,y:30,size:10});assert.equal(crop.width,10);assert.deepEqual([...crop.data.subarray(0,4)],[40,30,7,255]);
 assert.throws(()=>profileBox({width:2,height:2,data:Buffer.alloc(16)}),/no opaque/);
});
