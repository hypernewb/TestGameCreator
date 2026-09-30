// Minimal 8-bit RGB/RGBA PNG read/write and the alpha-mask crop for a sprite's profile portrait. No dependencies.
import {inflateSync,deflateSync,crc32} from 'node:zlib';

const SIG=Buffer.from([137,80,78,71,13,10,26,10]);
export function decodePng(buf){
 if(!buf.subarray(0,8).equals(SIG))throw new Error('Not a PNG');
 let p=8,w,h,type,idat=[];while(p<buf.length){const len=buf.readUInt32BE(p),t=buf.toString('latin1',p+4,p+8),d=buf.subarray(p+8,p+8+len);
  if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);type=d[9];if(d[8]!==8||d[12]!==0||![2,6].includes(type))throw new Error('Only 8-bit non-interlaced RGB/RGBA');}else if(t==='IDAT')idat.push(d);else if(t==='IEND')break;p+=12+len;}
 const bpp=type===6?4:3,stride=w*bpp,raw=inflateSync(Buffer.concat(idat)),px=Buffer.alloc(w*h*4),row=Buffer.alloc(stride),prev=Buffer.alloc(stride);
 for(let y=0;y<h;y++){const f=raw[y*(stride+1)],src=raw.subarray(y*(stride+1)+1,(y+1)*(stride+1));
  for(let i=0;i<stride;i++){const a=i>=bpp?row[i-bpp]:0,b=prev[i],c=i>=bpp?prev[i-bpp]:0,pa=Math.abs(b-c),pb=Math.abs(a-c),pc=Math.abs(a+b-2*c);
   row[i]=(src[i]+(f===1?a:f===2?b:f===3?(a+b)>>1:f===4?(pa<=pb&&pa<=pc?a:pb<=pc?b:c):0))&255;}
  for(let x=0;x<w;x++){const o=(y*w+x)*4;px[o]=row[x*bpp];px[o+1]=row[x*bpp+1];px[o+2]=row[x*bpp+2];px[o+3]=bpp===4?row[x*bpp+3]:255;}row.copy(prev);}
 return {width:w,height:h,data:px};
}

export function encodePng({width:w,height:h,data}){
 const raw=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)data.copy(raw,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
 const chunk=(t,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4,'latin1');d.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,8+d.length)),8+d.length);return b;};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(w,0);ihdr.writeUInt32BE(h,4);ihdr[8]=8;ihdr[9]=6;
 return Buffer.concat([SIG,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

export const cropImage=({width,data},{x,y,size})=>{const out=Buffer.alloc(size*size*4);for(let r=0;r<size;r++)data.copy(out,r*size*4,((y+r)*width+x)*4,((y+r)*width+x+size)*4);return {width:size,height:size,data:out};};
export const isCutout=({data})=>{for(let i=3;i<data.length;i+=4*97)if(data[i]<16)return true;return false;};

// Square head crop off the alpha mask: topmost opaque row, head width from the rows below it, a little headroom.
export function profileBox({width:w,height:h,data},{band=0.14,scale=1.9,min=0.25}={}){
 const opaque=(x,y)=>data[(y*w+x)*4+3]>128;let top=0;find:for(;top<h;top++)for(let x=0;x<w;x++)if(opaque(x,top))break find;
 if(top>=h)throw new Error('Image has no opaque pixels');
 let l=w,r=-1;for(let y=top;y<Math.min(h,top+Math.round(h*band));y++)for(let x=0;x<w;x++)if(opaque(x,y)){l=Math.min(l,x);r=Math.max(r,x);}
 const size=Math.min(w,h,Math.max(Math.round(w*min),Math.round((r-l+1)*scale))),cx=(l+r)>>1;
 return {x:Math.max(0,Math.min(w-size,cx-(size>>1))),y:Math.max(0,Math.min(h-size,top-Math.round(size*0.08))),size};
}
